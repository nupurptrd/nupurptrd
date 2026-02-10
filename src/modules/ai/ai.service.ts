import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Series } from '../../entities/series.entity';
import { SeriesCharacter } from '../../entities/series-character.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Category } from '../../entities/category.entity';
import { NewsArticle } from '../../entities/news-article.entity';
import { SettingsService } from '../settings/settings.service';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
import { StorageService } from '../storage/storage.service';
import { AudioMixerService, AudioSegment } from '../audio/audio-mixer.service';
import { ApiKeyType, EpisodeStatus } from '../../common/enums';

const EMOTION_SETTINGS: Record<
  string,
  { stability: number; similarity_boost: number; style: number }
> = {
  excited: { stability: 0.25, similarity_boost: 0.75, style: 0.7 },
  nervous: { stability: 0.3, similarity_boost: 0.7, style: 0.6 },
  calm: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
  serious: { stability: 0.4, similarity_boost: 0.85, style: 0.5 },
  angry: { stability: 0.2, similarity_boost: 0.8, style: 0.8 },
  sad: { stability: 0.45, similarity_boost: 0.85, style: 0.4 },
  weary: { stability: 0.45, similarity_boost: 0.8, style: 0.4 },
  patient: { stability: 0.5, similarity_boost: 0.85, style: 0.3 },
  urgent: { stability: 0.25, similarity_boost: 0.75, style: 0.65 },
  tight: { stability: 0.3, similarity_boost: 0.8, style: 0.6 },
  soft: { stability: 0.55, similarity_boost: 0.85, style: 0.25 },
  firm: { stability: 0.4, similarity_boost: 0.85, style: 0.55 },
  whispered: { stability: 0.6, similarity_boost: 0.9, style: 0.2 },
  grim: { stability: 0.4, similarity_boost: 0.85, style: 0.5 },
  hoarse: { stability: 0.35, similarity_boost: 0.75, style: 0.4 },
  robotic: { stability: 0.7, similarity_boost: 0.5, style: 0.1 },
  cold: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
  terrified: { stability: 0.2, similarity_boost: 0.7, style: 0.7 },
  disbelieving: { stability: 0.3, similarity_boost: 0.75, style: 0.6 },
  confused: { stability: 0.35, similarity_boost: 0.75, style: 0.5 },
  default: { stability: 0.35, similarity_boost: 0.8, style: 0.5 },
};

// Female news anchor voice - professional, clear, and authoritative
// Using Rachel (21m00Tcm4TlvDq8ikWAM) - mature American female, professional tone
const FEMALE_NEWS_ANCHOR_VOICE = '21m00Tcm4TlvDq8ikWAM';

// Voice pools organized by accent/region for proper pronunciation
// These are ElevenLabs voice IDs with specific accents
const VOICE_POOLS = {
  // Indian English accented voices (for characters with Indian names)
  indian_male: [
    'pqHfZKP75CvOlQylNhV4', // Bill - Indian accent
    'nPczCjzI2devNBz1zQrb', // Brian - South Asian
    'IKne3meq5aSn9XLyUdCD', // Charlie - Indian
  ],
  indian_female: [
    'jBpfuIE2acCO8z3wKNLl', // Gigi - Indian accent
    'XB0fDUnXU5powFXDhCwa', // Charlotte - South Asian
  ],
  // American English voices
  american_male: [
    'TX3LPaxmHKxFdv7VOQHJ', // Liam - American young male
    'TxGEqnHWrfWFTfGW9XjX', // Josh - American mature male
    'VR6AewLTigWG4xSOukaG', // Arnold - American deep male
    'pNInz6obpgDQGcFmaJgB', // Adam - American neutral
  ],
  american_female: [
    'EXAVITQu4vr4xnSDxMaL', // Bella - American young female
    '21m00Tcm4TlvDq8ikWAM', // Rachel - American mature female
    'AZnzlk1XvdvUeBnXmlld', // Domi - American professional
  ],
  // British English voices
  british_male: [
    'N2lVS1w4EtoT3dr4eOWO', // Callum - British male
    'CYw3kZ02Hs0563khs1Fj', // Dave - British male
  ],
  british_female: [
    'ThT5KcBeYPX3keUQqHPh', // Dorothy - British female
    'z9fAnlkpzviPz146aGWa', // Glinda - British female
  ],
  // Special purpose voices
  robotic: ['SOYHLrjzK2X1ezoPC6cr'], // Harry - robotic
  narrator: ['pqHfZKP75CvOlQylNhV4'], // Indian-accented narrator for Indian drama
  elderly_male: ['2EiwWnXFnvU5JabPnv8n'], // Clyde - elderly
  elderly_female: ['t0jbNlBVZ17f02VDIeMI'], // Freya - elderly
};

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
    @InjectRepository(SeriesCharacter)
    private characterRepository: Repository<SeriesCharacter>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(NewsArticle)
    private newsRepository: Repository<NewsArticle>,
    private settingsService: SettingsService,
    private elevenLabsService: ElevenLabsService,
    private storageService: StorageService,
    private audioMixerService: AudioMixerService,
  ) {}

  async generateEpisodeScript(
    userId: string,
    episodeId: string,
    seriesId: string,
  ) {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const series = await this.seriesRepository.findOne({
      where: { id: seriesId },
    });
    if (!series) throw new NotFoundException('Series not found');

    const characters = await this.characterRepository.find({
      where: { seriesId },
      order: { sortOrder: 'ASC' },
    });

    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
    });
    if (!episode) throw new NotFoundException('Episode not found');

    const characterProfiles = characters
      .map(
        (char) => `
${char.name} (${char.roleType || 'supporting'})
Age: ${char.age || 'Unknown'}
Public Mask: ${char.publicMask || 'Not defined'}
Internal Reality: ${char.internalReality || 'Not defined'}
Fatal Flaw: ${char.fatalFlaw || 'Not defined'}
Character Arc: ${char.characterArc || 'Not defined'}
Backstory: ${char.backstory || 'Not defined'}
`,
      )
      .join('\n');

    const systemPrompt = `You are an expert audio-drama writer for SMARTON — a mobile app for blind and visually impaired audiences.

## CORE RULES
- Listener CANNOT see anything
- Attention span is SHORT
- Emotion must be IMMEDIATE
- Every episode MUST end with a CLIFFHANGER
- Goal: instant addiction and emotional payoff

## SERIES BIBLE
Title: ${series.title}
Genre: ${series.primaryGenre || 'Thriller'}${series.secondaryGenre ? ` / ${series.secondaryGenre}` : ''}
Setting: ${series.worldSetting || 'Modern India (urban, realistic, grounded)'}
Logline: ${series.logline || 'Not defined'}
Central Mystery: ${series.centralMystery || 'Not defined'}

## CHARACTERS
${characterProfiles || 'No characters defined yet.'}

## FORMAT & LENGTH (STRICT)
- Episode Duration: 180 seconds (3 minutes)
- Characters per Scene: Maximum 2-3
- Scenes per Episode: 3 scenes ONLY
- Every episode MUST end on EXTREME cliffhanger
- Start HOOKED — inside conflict from first second

## EPISODE STRUCTURE (3 SCENES - MANDATORY)

### SCENE 1 – THE HOOK (0-60 seconds)
IMMEDIATE tension. Narrator sets WHO + WHERE + CONFLICT in first 10 seconds.
Then: confrontation, humiliation, or threat that grabs listener.
End scene with protagonist forced into submission OR receiving threat.

Example opening:
NARRATOR [urgent]
Arjun Kale. Forty-two. Twenty years hunting stories. Tonight, the story hunts him.
(SOUND: phone buzzing on desk, newsroom ambience)
NARRATOR [tense]
The message was three words. "Stop. Or else."

### SCENE 2 – ESCALATION (60-140 seconds)
Raise stakes DRAMATICALLY. Include:
- Personal threat (family, career, life)
- Violence OR near-violence (3-beat: environment shifts → vulnerable moment → impact)
- Emotional extreme (fear, humiliation, shock)
- Protagonist realizes the danger is REAL

This scene should feel like the world closing in. No escape.

### SCENE 3 – EXTREME CLIFFHANGER (140-180 seconds)
The gut-punch. End on maximum tension:
- Life-threatening moment (car strike, attack, confrontation)
- Devastating realization
- Betrayal reveal
- Or: silence after violence

Final 10 seconds MUST force listener to unlock next episode.
End with: narrator line that reframes everything + 2 seconds silence.

## HIGH-HEAT REQUIREMENT (NON-NEGOTIABLE)
Each episode MUST include at least ONE:
- Humiliation
- Fear
- Shock
- Betrayal
- Violence
- Realization
- Emotional collapse

If episode feels "calm" or "balanced" → it is WRONG.

## NARRATION RULES (CRITICAL FOR BLIND LISTENERS)
This is an AUDIOBOOK for blind users. Narrator is the EYES of the listener.
NARRATION MUST BE RICH AND DESCRIPTIVE — like a novel being read aloud.

### NARRATOR MUST DESCRIBE:
1. SETTING: Where are we? What does it look like? Time of day? Weather?
2. CHARACTERS: What are they wearing? Their posture? Their expression?
3. ACTIONS: Every movement, gesture, reaction must be narrated
4. EMOTIONS: Internal feelings, physical sensations, tension in the air
5. TRANSITIONS: How we move from one moment to the next

### NARRATION RATIO: 60% narration, 40% dialogue
Most of the episode should be the narrator painting the picture.

### BAD (too short):
NARRATOR
Morning in the newsroom.

### GOOD (book-style, descriptive):
NARRATOR [observant]
Morning in the newsroom. Fluorescent lights hummed above rows of cluttered desks. Arjun sat in the corner, his tie loosened, dark circles under his eyes. His fingers hovered over the keyboard, but his mind was somewhere else. The chai on his desk had gone cold hours ago.

### BAD (action without description):
(SOUND: door opens)
VIKRAM
Arjun, my cabin.

### GOOD (narrator describes everything):
NARRATOR [tense]
The editor's cabin door swung open. Vikram Rao stood in the doorway, his jaw tight, a file clutched in his hand. His eyes found Arjun across the room.
(SOUND: door creaking open, footsteps stopping)
VIKRAM [cold]
Arjun. My cabin. Now.
NARRATOR [internal]
Arjun's stomach dropped. He knew that tone. He'd heard it before resignations.

### NARRATOR DESCRIBES BETWEEN EVERY DIALOGUE:
After each character speaks, narrator should describe:
- How they said it (tone, volume, hesitation)
- Physical reaction of other characters
- The atmosphere shifting
- Internal thoughts of protagonist

## DIALOGUE RULES
- SHORT, SHARP, FUNCTIONAL
- Every line must: reveal info, deliver threat, or increase tension
- Use broken sentences, interruptions, Indian English cadence
- NO long explanations or philosophy monologues

Emotion tags (ElevenLabs compatible): soft, urgent, weak, calm, tense, whispered, cold, warm

EXPRESS EMOTION IN TEXT:
BAD: "What happened?"
GOOD: "What... where am I? I can't... why can't I feel my legs?"

BAD: "I was worried."
GOOD: "Three in the morning, Arjun. They called at three. I thought you were gone."

## VIOLENCE RULES
Violence IS allowed if story-justified. Violence MUST:
1. Interrupt a HUMAN thought (not neutral moment)
2. Feel accidental, not cinematic
3. Be followed by SILENCE
4. CHANGE the protagonist

Example:
ARJUN [soft]
I should call Anika—
(SOUND: violent car impact, metal crushing, body hitting ground)
(SILENCE: 2 seconds)

## INDIAN TEXTURE (SUBTLE)
- Indian English rhythm
- Micro-textures: ceiling fan hum, auto horn, hospital corridor echo, chai vendor
- ONE cultural sound per scene is enough
- No stereotypes

## CLIFFHANGER ENDING (MANDATORY)
Every episode MUST end with:
- A shocking line
- A realization
- A threat
- A dangerous silence

Example:
NARRATOR [chilling]
The pattern didn't appear. It recognized him.
(SILENCE: 2 seconds)

## OUTPUT FORMAT
Plain text only. No markdown. Scenes separated by ---

NARRATOR [tone]
(Narration text)

(SOUND: contextual description)

CHARACTER [emotion]
Dialogue text

Tones: observant, internal, urgent, afraid, breaking, chilling, cold, soft

## QUALITY CHECKLIST (MUST PASS ALL)
- Conflict in first 10 seconds
- No scene exceeds 2-3 characters
- At least one emotional extreme occurs
- Violence/shock is meaningful
- Ending forces next episode
- Clear narration for blind listeners
- Indian context feels natural
- Runtime fits 180 seconds minimum (3 minutes)

OUTPUT ONLY THE SCRIPT. Start with --- now.`;

    const userPrompt = `Write Episode ${episode.episodeNumber}: "${episode.title}"

${episode.synopsis ? `Synopsis: ${episode.synopsis}` : ''}
${episode.generationPrompt ? `Special Instructions: ${episode.generationPrompt}` : ''}

TARGET: 180 seconds (3 minutes) of audio (~500 words, 3 SCENES ONLY)

CRITICAL - THIS IS FOR BLIND LISTENERS:
- Write like an AUDIOBOOK - narrator is the listener's EYES
- 60% narration, 40% dialogue
- Narrator describes EVERYTHING: setting, expressions, movements, emotions, atmosphere
- After EVERY dialogue line, narrator describes reaction/atmosphere
- Rich, descriptive prose like a novel being read aloud

STRUCTURE THIS EPISODE:
SCENE 1 (0-60s): THE HOOK - narrator paints setting vividly, introduces conflict, confrontation/threat
SCENE 2 (60-140s): ESCALATION - narrator describes escalating danger, internal feelings, physical sensations
SCENE 3 (140-180s): EXTREME CLIFFHANGER - narrator builds to gut-punch, describes impact viscerally, reframe + silence

HIGH-HEAT REQUIRED: Include at least ONE of: humiliation, fear, shock, betrayal, violence, realization, emotional collapse

CLIFFHANGER ENDING REQUIRED: End with narrator's chilling reframe + 2 seconds silence

${
  episode.episodeNumber === 1
    ? `EPISODE 1 MUST:
- Open with narrator painting WHO Arjun is - his appearance, his desk, his obsession
- Show his pattern-seeing through narrator's description of his behavior
- End with narrator reframe that forces listener to unlock next episode
`
    : ''
}

START WITH --- NOW:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
      },
    );

    const generatedScript =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedScript) throw new Error('No script content generated');

    const formattedAudioScript =
      this.postProcessEpisodeScriptForAudio(generatedScript).trim();

    episode.fullScript = generatedScript;
    episode.formattedAudioScript = formattedAudioScript;
    episode.status = EpisodeStatus.DRAFT;
    await this.episodeRepository.save(episode);

    return { success: true, episodeId, scriptLength: generatedScript.length };
  }

  async generateEpisodeAudio(
    userId: string,
    episodeId: string,
    seriesId: string,
  ) {
    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
    });
    if (!episode) throw new NotFoundException('Episode not found');

    if (!episode.formattedAudioScript && !episode.fullScript) {
      throw new Error('No script available for audio generation');
    }

    // Reset voice assignments for this episode
    this.resetVoiceAssignments();

    const series = await this.seriesRepository.findOne({
      where: { id: seriesId },
    });
    const characters = await this.characterRepository.find({
      where: { seriesId },
    });
    const characterVoiceMap = this.buildCharacterVoiceMap(characters);

    const script = episode.formattedAudioScript || episode.fullScript;
    const segments = this.parseScript(script);

    // Store all audio segments with full metadata for production mixing
    const audioSegments: AudioSegment[] = [];
    let sfxGenerated = 0;
    let voiceGenerated = 0;
    let silenceCount = 0;
    let totalEstimatedDuration = 0;
    const sfxCache = new Map<string, Buffer>();

    console.log(`\n🎬 PRODUCTION AUDIO GENERATION`);
    console.log(`   Episode: ${episode.title}`);
    console.log(`   Genre: ${series?.primaryGenre || 'drama'}`);
    console.log(`   Segments: ${segments.length}`);
    console.log(`\n📝 Processing segments...`);

    for (const segment of segments) {
      // Handle SILENCE segments (intentional pauses for dynamic contrast)
      if (segment.type === 'silence') {
        if (segment.silenceDuration && segment.silenceDuration > 0) {
          audioSegments.push({
            type: 'silence',
            buffer: Buffer.alloc(0), // Mixer will generate silence
            silenceDuration: segment.silenceDuration,
          });
          silenceCount++;
          totalEstimatedDuration += segment.silenceDuration;
          console.log(
            `   🔇 Silence: ${segment.silenceDuration}s (${segment.text})`,
          );
        }
        continue;
      }

      // Handle SFX segments
      if (segment.type === 'sfx') {
        try {
          const shaped = this.shapeSfxPrompt(segment.sfxPrompt!);
          const truncatedPrompt = shaped.prompt.substring(0, 180);
          console.log(
            `   🔊 SFX (${shaped.role}): "${truncatedPrompt.substring(0, 50)}..."`,
          );

          const sfxDuration =
            shaped.role === 'bed'
              ? 10
              : this.estimateSfxDuration(truncatedPrompt);

          let sfxBuffer: Buffer | undefined;
          if (shaped.role === 'bed') {
            sfxBuffer = sfxCache.get(truncatedPrompt);
          }

          if (!sfxBuffer) {
            sfxBuffer = await this.elevenLabsService.generateSFX(
              userId,
              truncatedPrompt,
              sfxDuration,
            );
            sfxGenerated++;
            if (shaped.role === 'bed') {
              sfxCache.set(truncatedPrompt, sfxBuffer);
            }
          } else {
            console.log(`   🔁 Reusing cached ambience bed`);
          }

          audioSegments.push({
            type: 'sfx',
            buffer: sfxBuffer,
            sceneType: segment.sceneType,
            motifType: segment.motifType,
            prompt: truncatedPrompt,
            sfxRole: shaped.role,
          });
        } catch (error: any) {
          console.error(`   ❌ SFX failed: ${error.message?.substring(0, 50)}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      // Handle DIALOGUE segments
      if (segment.type === 'dialogue') {
        const voiceId = this.findVoiceForSpeaker(
          segment.speaker!,
          characterVoiceMap,
        );
        const emotion = segment.emotion || 'default';
        const settings = EMOTION_SETTINGS[emotion] || EMOTION_SETTINGS.default;

        const cleanText = segment.text
          .replace(/\[[^\]]+\]/g, '')
          .replace(/\((?!SOUND|SFX|MUSIC)[^)]*\)/gi, '')
          .trim();

        if (!cleanText) continue;

        try {
          console.log(
            `   🎤 ${segment.speaker} [${emotion}] [${segment.sceneType || 'normal'}]`,
          );
          const ttsBuffer = await this.elevenLabsService.generateTTS(
            userId,
            cleanText,
            voiceId,
            settings,
          );

          audioSegments.push({
            type: 'voice',
            buffer: ttsBuffer,
            speaker: segment.speaker,
            emotion,
            sceneType: segment.sceneType,
          });
          voiceGenerated++;

          // Add natural pause after each voice segment for clarity
          // Narrator gets longer pauses, dialogue gets shorter pauses
          const isNarrator = segment.speaker
            ?.toUpperCase()
            .includes('NARRATOR');
          const pauseDuration = isNarrator ? 0.8 : 0.5; // seconds
          audioSegments.push({
            type: 'silence',
            buffer: Buffer.alloc(0),
            silenceDuration: pauseDuration,
          });
          silenceCount++;

          const wordCount = cleanText.split(/\s+/).length;
          totalEstimatedDuration += (wordCount / 150) * 60;
        } catch (error: any) {
          console.error(`   ❌ TTS failed: ${error.message?.substring(0, 50)}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (audioSegments.length === 0) {
      throw new Error('No audio segments were generated');
    }

    console.log(`\n✅ Generation complete:`);
    console.log(
      `   Voice: ${voiceGenerated} | SFX: ${sfxGenerated} | Silences: ${silenceCount}`,
    );

    // Delete old audio if exists
    if (episode.audioUrl) {
      try {
        const oldKey = episode.audioUrl.split('.amazonaws.com/')[1];
        if (oldKey) {
          await this.storageService.deleteFile(oldKey);
          console.log(`🗑️ Deleted old audio: ${oldKey}`);
        }
      } catch (error) {
        console.error('Failed to delete old audio:', error);
      }
    }

    // Generate background music based on series genre
    let backgroundMusic: Buffer | undefined;
    try {
      const genre = series?.primaryGenre || 'drama';
      const musicPrompt = this.generateMusicPrompt(
        genre,
        series?.musicSoundscape,
      );
      console.log(`\n🎵 Generating background music...`);
      console.log(`   Prompt: "${musicPrompt.substring(0, 60)}..."`);
      backgroundMusic = await this.elevenLabsService.generateSFX(
        userId,
        musicPrompt,
        22,
      );
      console.log(`   Size: ${(backgroundMusic.length / 1024).toFixed(0)} KB`);
    } catch (error: any) {
      console.error(
        `⚠️ Background music failed: ${error.message?.substring(0, 50)}`,
      );
    }

    // Production-grade audio mixing with ffmpeg
    // Implements: frequency carving, loudness standards, dynamic contrast, ending lock
    console.log(`\n🎛️ PRODUCTION MIXING`);
    console.log(
      `   Features: Frequency carving, LUFS normalization, ending silence`,
    );

    const finalBuffer = await this.audioMixerService.mixProductionAudio(
      audioSegments, // Pass full segments with all metadata
      backgroundMusic,
      {
        backgroundMusicVolume: 0.08, // 8% - very subtle, never competing
        voiceVolume: 1.0, // Full volume for dialogue clarity
        sfxVolume: 0.85, // Higher SFX volume for clear impacts and sounds
        fadeInDuration: 1.5, // Smooth fade in
        fadeOutDuration: 2.5, // Longer fade out
        normalize: true, // Broadcast-ready -16 LUFS
        endWithSilence: true, // End on silence, not sound
        endingSilenceDuration: 3.0, // 3 second lock effect
      },
    );

    // Upload final audio
    const fileName = `episodes/${seriesId}/${episodeId}_${Date.now()}.mp3`;
    const audioUrl = await this.storageService.uploadFile(
      fileName,
      finalBuffer,
      'audio/mpeg',
    );

    episode.audioUrl = audioUrl;
    episode.durationSeconds = Math.round(totalEstimatedDuration);
    episode.status = EpisodeStatus.AUDIO_GENERATED;
    await this.episodeRepository.save(episode);

    console.log(`\n🎧 AUDIO COMPLETE`);
    console.log(`   URL: ${audioUrl}`);
    console.log(`   Duration: ~${Math.round(totalEstimatedDuration)}s`);

    return {
      success: true,
      audioUrl,
      durationSeconds: Math.round(totalEstimatedDuration),
      sfxGenerated,
      voiceGenerated,
      silenceCount,
      totalSegments: audioSegments.length,
    };
  }

  private generateMusicPrompt(
    genre: string,
    customSoundscape?: string,
  ): string {
    if (customSoundscape) {
      return `ambient background music: ${customSoundscape}`;
    }

    const genreMusic: Record<string, string> = {
      drama:
        'soft emotional ambient piano and strings background music, subtle and atmospheric',
      thriller:
        'tense suspenseful ambient background music with subtle bass, dark atmospheric',
      comedy:
        'light cheerful ambient background music, upbeat but not overpowering',
      horror: 'eerie dark ambient background music, haunting and atmospheric',
      romance:
        'gentle romantic ambient background music, soft piano and strings',
      scifi:
        'futuristic ambient electronic background music, sci-fi atmosphere',
      fantasy:
        'mystical ambient orchestral background music, magical and ethereal',
      mystery:
        'mysterious ambient background music, subtle tension and intrigue',
      action:
        'dynamic ambient background music, energetic but not overwhelming',
      default: 'soft ambient background music, subtle and atmospheric',
    };

    return genreMusic[genre.toLowerCase()] || genreMusic.default;
  }

  async generateNews(
    userId: string,
    categoryId: string,
    language: string = 'English',
    contentType: 'detailed' | 'highlights' = 'detailed',
    languages?: string[], // Support multiple languages
  ) {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const today = new Date().toISOString().split('T')[0];
    const formattedDate = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Determine which languages to generate for
    const targetLanguages =
      languages && languages.length > 0 ? languages : [language];

    // Use Gemini 2.0 Pro for higher quality, more detailed output
    const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Best available model with grounding

    // For highlights, generate ONE article with 15 detailed highlights as a news digest
    if (contentType === 'highlights') {
      const createdArticles: any[] = [];

      for (const targetLang of targetLanguages) {
        const highlightsPrompt = `You are an AWARD-WINNING SENIOR NEWS ANCHOR at a major Indian news network. Your job is to create a comprehensive, fact-rich daily news digest that sounds professional, authoritative, and engaging.

## ASSIGNMENT
Research and compile the TOP 15 BREAKING NEWS STORIES about "${category.name}" in India for today's broadcast.

## TODAY'S DATE: ${today}
## BROADCAST LANGUAGE: ${targetLang}

## OUTPUT FORMAT (JSON)
{
  "title": "Breaking: ${category.name} News Digest - ${formattedDate}",
  "summary": "Comprehensive ${targetLang} news digest with 15 major stories covering ${category.name}. Includes latest updates, key figures, and important developments.",
  "highlights": [
    {
      "headline": "Impactful headline with key detail (max 80 chars)",
      "summary": "Detailed 4-5 sentence summary with SPECIFIC FACTS",
      "key_facts": {
        "who": "Names of key people/organizations involved",
        "what": "Specific event or development",
        "when": "Date/time if available",
        "where": "Location/city/state",
        "numbers": "Key statistics, amounts, percentages"
      }
    }
  ],
  "formatted_script": "COMPLETE BROADCAST SCRIPT (see requirements below)",
  "tags": ["specific", "relevant", "tags", "for", "this", "digest"],
  "suggested_emotion": "informative",
  "word_count": 1200
}

## CRITICAL REQUIREMENTS FOR EACH OF THE 15 STORIES:

### MUST INCLUDE SPECIFIC DETAILS:
1. **NAMES** - Full names of ministers, officials, CEOs, celebrities, athletes involved
2. **NUMBERS** - Exact figures: rupee amounts (₹), percentages, quantities, distances, scores
3. **DATES/TIMES** - When events happened or will happen
4. **LOCATIONS** - Specific cities, states, venues, addresses
5. **ORGANIZATIONS** - Company names, government departments, institutions
6. **QUOTES** - Direct quotes from key figures when available
7. **CONTEXT** - Why this matters, background information

### EXAMPLE OF GOOD vs BAD:
❌ BAD: "A minister announced new education policy changes."
✅ GOOD: "Union Education Minister Dharmendra Pradhan announced ₹15,000 crore allocation for the National Education Policy 2024 implementation, benefiting 2.5 crore students across 850 universities."

❌ BAD: "Stock markets showed positive movement today."
✅ GOOD: "Sensex surged 847 points to close at 76,532, while Nifty gained 2.3% to 23,156. Reliance Industries led the rally with a 4.2% jump after announcing ₹75,000 crore green energy investment."

## FORMATTED_SCRIPT REQUIREMENTS:

Write a professional 8-10 minute broadcast script (1200-1500 words) as if YOU are the anchor reading LIVE on air.

### SCRIPT STRUCTURE:
1. **OPENING (30 seconds)**
   - Warm, professional greeting
   - "Good [morning/afternoon/evening], I'm your news anchor bringing you today's comprehensive ${category.name} coverage for ${formattedDate}."
   - Brief overview of top 3 stories

2. **BODY - 15 STORIES (7-8 minutes)**
   For EACH story, include:
   - Engaging transition phrase
   - The headline
   - 3-4 sentences of detailed coverage with FACTS and NUMBERS
   - [pause] marker after each story

   Use varied transitions:
   - "In our lead story today..."
   - "Breaking news from [city]..."
   - "Turning to [topic]..."
   - "In a significant development..."
   - "Meanwhile, in [location]..."
   - "Here's an update on..."
   - "In financial news..."
   - "On the political front..."
   - "Sports update now..."
   - "And in lighter news..."

3. **CLOSING (30 seconds)**
   - Recap the top 3 stories in one line each
   - Professional sign-off
   - "That's all for today's ${category.name} digest. Stay informed, stay ahead."

### SCRIPT STYLE:
- Conversational but authoritative
- Include the emotion naturally (don't be robotic)
- Use [pause] for natural breathing breaks
- Include [emphasis] around key numbers or names
- ALL content MUST be in ${targetLang} language
- If ${targetLang} is not English, use natural ${targetLang} expressions and idioms

## QUALITY STANDARDS:
- ONLY use REAL, VERIFIABLE news from today or this week
- NO fabricated stories or fake statistics
- Include proper source attribution where relevant
- Balance serious news with some lighter/positive stories
- Cover different aspects: politics, economy, society, sports, entertainment as relevant to ${category.name}

Respond ONLY with valid JSON. No markdown code blocks.`;

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKeyRecord.apiKey}`,
          {
            contents: [{ parts: [{ text: highlightsPrompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 16384,
              topP: 0.95,
              topK: 40,
            },
          },
        );

        const responseText =
          response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error('No content generated');

        let generatedContent;
        try {
          // Clean up response - remove markdown code blocks if present
          const cleanedResponse = responseText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedContent = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON in response');
          }
        } catch (error) {
          console.error('Failed to parse news digest:', responseText);
          throw new Error('Failed to parse generated news digest');
        }

        // Combine highlights into rich content with key facts
        const highlightsContent =
          generatedContent.highlights
            ?.map((h: any, i: number) => {
              let content = `## ${i + 1}. ${h.headline}\n\n${h.summary}`;
              if (h.key_facts) {
                content += '\n\n**Key Facts:**\n';
                if (h.key_facts.who)
                  content += `- **Who:** ${h.key_facts.who}\n`;
                if (h.key_facts.what)
                  content += `- **What:** ${h.key_facts.what}\n`;
                if (h.key_facts.when)
                  content += `- **When:** ${h.key_facts.when}\n`;
                if (h.key_facts.where)
                  content += `- **Where:** ${h.key_facts.where}\n`;
                if (h.key_facts.numbers)
                  content += `- **Numbers:** ${h.key_facts.numbers}\n`;
              }
              return content;
            })
            .join('\n\n---\n\n') || '';

        // Create ONE article with the complete news digest
        const article = this.newsRepository.create({
          categoryId,
          title:
            generatedContent.title ||
            `Breaking: ${category.name} News Digest - ${formattedDate}`,
          content: highlightsContent,
          summary:
            generatedContent.summary ||
            `Comprehensive ${targetLang} news digest with 15 major stories.`,
          language: targetLang,
          tags: generatedContent.tags || [],
          formattedScript: generatedContent.formatted_script,
          suggestedEmotion: generatedContent.suggested_emotion || 'informative',
          localityFocus: 'National',
          articleType: 'highlights',
          isHighlight: true,
          highlightOrder: 1,
          status: 'draft',
          generatedAt: new Date(),
          metadata: {
            highlightCount: generatedContent.highlights?.length || 15,
            highlights: generatedContent.highlights,
            wordCount: generatedContent.word_count,
            model: GEMINI_MODEL,
            generatedAt: new Date().toISOString(),
          },
        });

        const saved = await this.newsRepository.save(article);
        createdArticles.push(saved);
      }

      return {
        success: true,
        articles: createdArticles,
        count: createdArticles.length,
        generated: createdArticles.length,
        message: `Generated ${createdArticles.length} comprehensive news digest(s) with 15 detailed stories each`,
      };
    }

    // For detailed, generate a single in-depth article with full journalism
    const prompt = `You are a SENIOR INVESTIGATIVE JOURNALIST at a top Indian news organization. Write an in-depth, fact-rich article about the LATEST BREAKING NEWS in "${category.name}".

## TODAY'S DATE: ${today}
## ARTICLE LANGUAGE: ${language}

## REQUIREMENTS:
Research the most significant current news story and write a comprehensive article with:

1. **SPECIFIC NAMES** - Ministers, CEOs, officials, key figures with full names and titles
2. **EXACT NUMBERS** - ₹ amounts, percentages, statistics, quantities
3. **DATES & TIMES** - When events occurred or will occur
4. **LOCATIONS** - Specific cities, states, venues
5. **DIRECT QUOTES** - From officials, experts, witnesses
6. **CONTEXT** - Historical background, why this matters
7. **IMPACT** - Who is affected, what changes

## OUTPUT FORMAT (JSON):
{
  "title": "Compelling headline with key fact or number - ${language}",
  "content": "Full in-depth article (500-700 words) with all specific details",
  "summary": "3-4 sentence summary with key facts",
  "tags": ["specific", "relevant", "tags"],
  "formatted_script": "Article formatted for professional TTS narration with [pause] markers and natural flow",
  "suggested_emotion": "primary emotion (informative/serious/excited)",
  "locality_focus": "Specific region or National",
  "key_figures": ["Name 1 - Title", "Name 2 - Title"],
  "key_numbers": ["₹X crore investment", "Y% increase", "Z million affected"]
}

ALL content must be in ${language}. Use natural ${language} expressions.
Respond ONLY with valid JSON.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.95,
        },
      },
    );

    const responseText =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No content generated');

    let generatedContent;
    try {
      const cleanedResponse = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (error) {
      throw new Error('Failed to parse generated content');
    }

    const article = this.newsRepository.create({
      categoryId,
      title: generatedContent.title,
      content: generatedContent.content,
      summary: generatedContent.summary,
      language,
      tags: generatedContent.tags,
      formattedScript: generatedContent.formatted_script,
      suggestedEmotion: generatedContent.suggested_emotion,
      localityFocus: generatedContent.locality_focus,
      articleType: contentType,
      status: 'draft',
      generatedAt: new Date(),
      metadata: {
        keyFigures: generatedContent.key_figures,
        keyNumbers: generatedContent.key_numbers,
        model: GEMINI_MODEL,
      },
    });

    await this.newsRepository.save(article);

    return { success: true, article, generated: 1 };
  }

  async generateNewsAudio(userId: string, articleId: string, voiceId?: string) {
    const article = await this.newsRepository.findOne({
      where: { id: articleId },
      relations: ['category'],
    });

    if (!article) throw new NotFoundException('Article not found');

    const textToConvert = article.formattedScript || article.content;
    // Clean up the text for TTS - remove markers, brackets, etc.
    const cleanedText = textToConvert
      .replace(
        /\[(excited|soft|serious|warm|urgent|calm|informative|pause)\]/gi,
        '',
      )
      .replace(/\[pause\]/gi, '... ')
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic markdown
      .trim();

    // Use informative emotion settings for news - professional and clear
    const newsSettings = {
      stability: 0.5, // More stable for professional delivery
      similarity_boost: 0.85, // High clarity
      style: 0.3, // Moderate style for natural but professional sound
    };

    // For news, default to female news anchor voice if no voice specified
    const finalVoiceId = voiceId || article.voiceId || FEMALE_NEWS_ANCHOR_VOICE;

    const audioBuffer = await this.elevenLabsService.generateTTS(
      userId,
      cleanedText,
      finalVoiceId,
      newsSettings,
    );

    const fileName = `news/${article.categoryId || 'uncategorized'}/${articleId}_${Date.now()}.mp3`;
    const audioUrl = await this.storageService.uploadFile(
      fileName,
      audioBuffer,
      'audio/mpeg',
    );

    article.audioUrl = audioUrl;
    article.voiceId = finalVoiceId;
    article.voiceName = 'Rachel (News Anchor)';
    await this.newsRepository.save(article);

    return {
      success: true,
      audioUrl,
      voiceId: finalVoiceId,
      voiceName: 'Rachel (News Anchor)',
    };
  }

  private parseScript(script: string): Array<{
    type: 'dialogue' | 'sfx' | 'silence' | 'motif';
    speaker?: string;
    emotion?: string;
    text: string;
    sfxPrompt?: string;
    sceneType?:
      | 'normal'
      | 'tense'
      | 'hospital'
      | 'psychoacoustic'
      | 'revelation';
    silenceDuration?: number;
    motifType?: 'ouroboros' | 'heartbeat' | 'glitch';
  }> {
    const segments: Array<{
      type: 'dialogue' | 'sfx' | 'silence' | 'motif';
      speaker?: string;
      emotion?: string;
      text: string;
      sfxPrompt?: string;
      sceneType?:
        | 'normal'
        | 'tense'
        | 'hospital'
        | 'psychoacoustic'
        | 'revelation';
      silenceDuration?: number;
      motifType?: 'ouroboros' | 'heartbeat' | 'glitch';
    }> = [];

    // Clean markdown formatting from the script
    const cleanScript = script
      .replace(/\*\*\(/g, '(') // **( -> (
      .replace(/\)\*\*/g, ')') // )** -> )
      .replace(/\*\*([^*]+)\*\*/g, '$1') // **text** -> text
      .replace(/\*([^*]+)\*/g, '$1') // *text* -> text
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/^-{3,}$/gm, '---'); // Normalize horizontal rules

    const lines = cleanScript.split('\n');
    let currentSpeaker = '';
    let currentEmotion = 'default';
    let currentText = '';
    let currentSceneType:
      | 'normal'
      | 'tense'
      | 'hospital'
      | 'psychoacoustic'
      | 'revelation' = 'normal';

    console.log(
      '📝 Parsing script for production audio, total lines:',
      lines.length,
    );

    // Scene type detection keywords
    const detectSceneType = (text: string): typeof currentSceneType => {
      const lower = text.toLowerCase();
      if (
        lower.includes('hospital') ||
        lower.includes('medical') ||
        lower.includes('heart monitor')
      ) {
        return 'hospital';
      }
      if (
        lower.includes('revelation') ||
        lower.includes('realize') ||
        lower.includes('discover')
      ) {
        return 'revelation';
      }
      if (
        lower.includes('tense') ||
        lower.includes('suspense') ||
        lower.includes('thriller')
      ) {
        return 'tense';
      }
      return 'normal';
    };

    // Silence cue detection
    const detectSilenceCue = (text: string): number | null => {
      const lower = text.toLowerCase();
      // Heavy silence, absolute silence, etc.
      if (
        lower.includes('heavy silence') ||
        lower.includes('absolute silence')
      ) {
        return 2.0; // Shock silence
      }
      if (
        lower.includes('silence') ||
        lower.includes('pause') ||
        lower.includes('beat')
      ) {
        return 1.0; // Dramatic silence
      }
      // After major events
      if (lower.includes('cut to') || lower.includes('cut to black')) {
        return 0.5; // Beat silence
      }
      return null;
    };

    // Motif detection (ouroboros symbol, glitch, etc.)
    const detectMotif = (
      text: string,
    ): 'ouroboros' | 'heartbeat' | 'glitch' | null => {
      const lower = text.toLowerCase();
      if (
        lower.includes('ouroboros') ||
        lower.includes('symbol') ||
        lower.includes('pattern')
      ) {
        return 'ouroboros';
      }
      if (
        lower.includes('heart monitor') ||
        lower.includes('heartbeat') ||
        lower.includes('pulse')
      ) {
        return 'heartbeat';
      }
      if (
        lower.includes('glitch') ||
        lower.includes('distort') ||
        lower.includes('billboard')
      ) {
        return 'glitch';
      }
      return null;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) continue;

      // Safety-net: treat screenplay sluglines and camera directions as scene breaks (never spoken)
      if (
        /^\s*(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\b/i.test(trimmedLine) ||
        /^\s*(CUT TO:|SMASH CUT:|DISSOLVE TO:|FADE IN:|FADE OUT:|CLOSE UP|WIDE SHOT)\b/i.test(
          trimmedLine,
        )
      ) {
        if (segments.length > 0) {
          segments.push({
            type: 'silence',
            text: 'scene_transition',
            silenceDuration: 1.0,
          });
          console.log(
            '  🔇 Slugline/camera direction converted to scene transition',
          );
        }
        continue;
      }

      // Handle scene markers - update scene type
      if (trimmedLine === '---' || trimmedLine.startsWith('(SCENE')) {
        // Add dramatic silence at scene transitions
        if (segments.length > 0) {
          segments.push({
            type: 'silence',
            text: 'scene_transition',
            silenceDuration: 1.0,
          });
          console.log('  🔇 Scene transition silence: 1.0s');
        }
        continue;
      }

      // Handle explicit SILENCE cues: (SILENCE: X seconds) or (SILENCE: Xs)
      const silenceMatch = trimmedLine.match(
        /^\(?\s*SILENCE:\s*([\d.]+)\s*(?:seconds?|s)?\s*\)?$/i,
      );
      if (silenceMatch) {
        const duration = parseFloat(silenceMatch[1]) || 1.5;
        segments.push({
          type: 'silence',
          text: 'explicit_silence',
          silenceDuration: Math.min(duration, 5.0), // Cap at 5 seconds
        });
        console.log(`  🔇 Explicit silence: ${duration}s`);
        continue;
      }

      // Match SOUND/SFX/MUSIC cues
      const sfxMatch = trimmedLine.match(
        /^\(?\s*(?:SOUND|SFX|MUSIC):\s*(.+?)\s*\)?$/i,
      );
      if (sfxMatch) {
        // Save any pending dialogue
        if (currentText.trim()) {
          segments.push({
            type: 'dialogue',
            speaker: currentSpeaker || 'NARRATOR',
            emotion: currentEmotion,
            text: currentText.trim(),
            sceneType: currentSceneType,
          });
          currentText = '';
        }

        const sfxPrompt = sfxMatch[1].replace(/\)$/, '').trim();

        // Check if this SFX should trigger a silence
        const silenceDuration = detectSilenceCue(sfxPrompt);
        if (silenceDuration) {
          segments.push({
            type: 'silence',
            text: 'dramatic_pause',
            silenceDuration,
          });
          console.log(`  🔇 Detected silence cue: ${silenceDuration}s`);
        }

        // Check if this should be a motif
        const motifType = detectMotif(sfxPrompt);
        if (motifType) {
          // Still generate the SFX but mark it as a motif for special processing
          segments.push({
            type: 'sfx',
            text: sfxPrompt,
            sfxPrompt,
            sceneType: currentSceneType,
            motifType,
          });
          console.log(`  🔔 Motif detected: ${motifType}`);
        } else {
          segments.push({
            type: 'sfx',
            text: sfxPrompt,
            sfxPrompt,
            sceneType: currentSceneType,
          });
          console.log(`  🔊 SFX: "${sfxPrompt.substring(0, 40)}..."`);
        }

        // Update scene type based on SFX content
        const newSceneType = detectSceneType(sfxPrompt);
        if (newSceneType !== 'normal') {
          currentSceneType = newSceneType;
          console.log(`  🎬 Scene type: ${currentSceneType}`);
        }

        continue;
      }

      // Match speaker lines
      const speakerMatch = trimmedLine.match(
        /^([A-Z][A-Z0-9\s.']+)(?:\s*\[([^\]]+)\])?$/,
      );
      if (
        speakerMatch &&
        speakerMatch[1].length <= 30 &&
        !speakerMatch[1].includes(':')
      ) {
        // Save any pending dialogue
        if (currentText.trim()) {
          segments.push({
            type: 'dialogue',
            speaker: currentSpeaker || 'NARRATOR',
            emotion: currentEmotion,
            text: currentText.trim(),
            sceneType: currentSceneType,
          });
        }
        currentSpeaker = speakerMatch[1].trim();
        currentEmotion =
          speakerMatch[2]?.toLowerCase().split(',')[0].trim() || 'default';
        currentText = '';
        console.log(`  🎤 Speaker: ${currentSpeaker} [${currentEmotion}]`);
      } else {
        // Dialogue text - append
        if (
          !trimmedLine.match(/^\([^)]+\)$/) ||
          trimmedLine.toLowerCase().includes('sound')
        ) {
          currentText += ' ' + trimmedLine;
        }
      }
    }

    // Don't forget the last segment
    if (currentText.trim()) {
      segments.push({
        type: 'dialogue',
        speaker: currentSpeaker || 'NARRATOR',
        emotion: currentEmotion,
        text: currentText.trim(),
        sceneType: currentSceneType,
      });
    }

    // Add ending silence for "lock" effect (handled by mixer, but we can add a marker)
    segments.push({
      type: 'silence',
      text: 'ending_lock',
      silenceDuration: 0, // Mixer will add the actual ending silence
    });

    console.log(
      `Parsed ${segments.length} segments: ${segments.filter((s) => s.type === 'dialogue').length} dialogue, ${segments.filter((s) => s.type === 'sfx').length} SFX`,
    );

    return segments.filter((s) => s.text.length > 0);
  }

  private postProcessEpisodeScriptForAudio(script: string): string {
    // Goal:
    // - Enforce audio-first scene flow
    // - Remove INT/EXT sluglines and camera directions
    // - Ensure scenes are separated by ---
    // - Ensure each scene starts with an ambience bed cue
    // - Keep only SOUND/SFX/MUSIC cues in parentheses (avoid visual stage directions)

    if (!script) return '';

    const text = script
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n');

    const lines = text.split('\n');
    const out: string[] = [];

    let sceneOpen = false;
    let sceneHasBed = false;

    const pushSceneStartIfNeeded = (hint: string) => {
      if (!sceneOpen) {
        out.push('---');
        sceneOpen = true;
        sceneHasBed = false;
      }
      if (!sceneHasBed) {
        out.push(`(SOUND: ${this.deriveAmbienceBed(hint)})`);
        sceneHasBed = true;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Convert any slugline into a new scene start
      if (/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\b/i.test(line)) {
        sceneOpen = false;
        pushSceneStartIfNeeded(line);
        continue;
      }

      // Convert camera directions into a soft scene break
      if (
        /^(CUT TO:|SMASH CUT:|DISSOLVE TO:|FADE IN:|FADE OUT:)\b/i.test(line)
      ) {
        sceneOpen = false;
        pushSceneStartIfNeeded(line);
        continue;
      }

      // Keep explicit scene separators
      if (line === '---') {
        sceneOpen = false;
        out.push('---');
        continue;
      }

      // Keep SOUND/SFX/MUSIC cues, but sanitize over-long descriptions
      const sfxMatch = line.match(
        /^\(?\s*(?:SOUND|SFX|MUSIC):\s*(.+?)\s*\)?$/i,
      );
      if (sfxMatch) {
        pushSceneStartIfNeeded(sfxMatch[1]);
        const cleaned = sfxMatch[1].replace(/\s+/g, ' ').trim().slice(0, 160);
        out.push(`(SOUND: ${cleaned})`);
        continue;
      }

      // Speaker header line (keep)
      const speakerMatch = line.match(
        /^([A-Z][A-Z0-9\s.']+)(?:\s*\[[^\]]+\])?$/,
      );
      if (
        speakerMatch &&
        speakerMatch[1].length <= 30 &&
        !speakerMatch[1].includes(':')
      ) {
        pushSceneStartIfNeeded(line);
        out.push(line);
        continue;
      }

      // Parenthetical directions that are not SOUND cues should be dropped (audio-first)
      if (/^\([^)]+\)$/.test(line)) {
        continue;
      }

      // Regular dialogue line (keep). If model starts with description, turn it into a subtle bed cue.
      pushSceneStartIfNeeded(line);
      if (this.looksLikeVisualDescription(line)) {
        const hint = line.slice(0, 120);
        out.push(`(SOUND: ${this.deriveAmbienceBed(hint)})`);
      } else {
        out.push(line);
      }
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  private looksLikeVisualDescription(line: string): boolean {
    const lower = line.toLowerCase();
    if (lower.startsWith('int ') || lower.startsWith('ext ')) return true;
    if (
      lower.includes('we see ') ||
      lower.includes('camera') ||
      lower.includes('shot')
    )
      return true;
    if (
      lower.startsWith('in the ') ||
      lower.startsWith('inside the ') ||
      lower.startsWith('outside the ')
    )
      return true;
    return false;
  }

  private deriveAmbienceBed(hint: string): string {
    const lower = (hint || '').toLowerCase();

    if (
      lower.includes('hospital') ||
      lower.includes('monitor') ||
      lower.includes('icu')
    ) {
      return 'hospital room tone bed, distant monitor beeps, HVAC hum, subtle';
    }
    if (
      lower.includes('newsroom') ||
      lower.includes('studio') ||
      lower.includes('anchor')
    ) {
      return 'newsroom ambience bed, distant typing, soft murmurs, subtle';
    }
    if (lower.includes('rain') || lower.includes('storm')) {
      return 'light rain ambience bed, distant traffic hush, subtle';
    }
    if (lower.includes('street') || lower.includes('traffic')) {
      return 'city street ambience bed, distant traffic, subtle';
    }
    if (
      lower.includes('archive') ||
      lower.includes('basement') ||
      lower.includes('files')
    ) {
      return 'quiet room tone bed, faint fluorescent hum, subtle';
    }
    return 'room tone ambience bed, subtle';
  }

  private buildCharacterVoiceMap(
    characters: SeriesCharacter[],
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const char of characters) {
      if (char.voiceId) {
        map[char.name.toUpperCase()] = char.voiceId;
        const firstName = char.name.split(/\s+/)[0].toUpperCase();
        map[firstName] = char.voiceId;
      }
    }
    return map;
  }

  // Track which voices have been assigned to which speakers for consistent voice assignment
  private speakerVoiceAssignments: Record<string, string> = {};
  private usedVoiceIndices = {
    indian_male: 0,
    indian_female: 0,
    american_male: 0,
    american_female: 0,
    british_male: 0,
    british_female: 0,
  };

  // Detect gender from name/role keywords
  private detectGender(speaker: string): 'male' | 'female' {
    const femaleKeywords = [
      'NURSE',
      'WOMAN',
      'FEMALE',
      'GIRL',
      'MRS',
      'MS',
      'LADY',
      'MOTHER',
      'SISTER',
      'DAUGHTER',
      'WIFE',
      'QUEEN',
      'PRINCESS',
      'PRIYA',
      'ANANYA',
      'NEHA',
      'POOJA',
      'ANJALI',
      'KAVYA',
      'MEERA',
    ];
    return femaleKeywords.some((kw) => speaker.toUpperCase().includes(kw))
      ? 'female'
      : 'male';
  }

  private findVoiceForSpeaker(
    speaker: string,
    map: Record<string, string>,
  ): string {
    const speakerUpper = speaker.toUpperCase().trim();

    // Check if speaker has a pre-assigned voice from character database
    if (map[speakerUpper]) return map[speakerUpper];
    const firstName = speakerUpper.split(/\s+/)[0];
    if (map[firstName]) return map[firstName];

    // Check if we've already assigned a voice to this speaker in this session
    if (this.speakerVoiceAssignments[speakerUpper]) {
      return this.speakerVoiceAssignments[speakerUpper];
    }

    // Assign a voice based on speaker characteristics
    let assignedVoice: string;
    let voiceDescription: string;

    // Special handling for known speaker types
    if (speakerUpper === 'NARRATOR' || speakerUpper.includes('NARRATOR')) {
      assignedVoice = VOICE_POOLS.narrator[0];
      voiceDescription = 'Narrator (neutral)';
    } else if (
      speakerUpper.includes('PHONE') ||
      speakerUpper.includes('ROBOT') ||
      speakerUpper.includes('COMPUTER') ||
      speakerUpper.includes('AI') ||
      (speakerUpper.includes('VOICE') && speakerUpper.includes('PHONE'))
    ) {
      assignedVoice = VOICE_POOLS.robotic[0];
      voiceDescription = 'Robotic/Phone voice';
    } else if (
      speakerUpper.includes('OLD') ||
      speakerUpper.includes('ELDERLY') ||
      speakerUpper.includes('GRANDPA') ||
      speakerUpper.includes('GRANDMA')
    ) {
      const gender = this.detectGender(speakerUpper);
      const pool =
        gender === 'female'
          ? VOICE_POOLS.elderly_female
          : VOICE_POOLS.elderly_male;
      assignedVoice = pool[0];
      voiceDescription = `Elderly ${gender}`;
    } else {
      // Default to Indian accents for all characters (Indian drama setting)
      const gender = this.detectGender(speakerUpper);

      let voicePool: string[];
      let indexKey: keyof typeof this.usedVoiceIndices;

      // Always use Indian-accented voices for this Indian drama
      voicePool =
        gender === 'female'
          ? VOICE_POOLS.indian_female
          : VOICE_POOLS.indian_male;
      indexKey = gender === 'female' ? 'indian_female' : 'indian_male';
      voiceDescription = `Indian ${gender}`;

      // Rotate through the voice pool for variety
      const index = this.usedVoiceIndices[indexKey] % voicePool.length;
      assignedVoice = voicePool[index];
      this.usedVoiceIndices[indexKey]++;
    }

    // Store the assignment for consistency
    this.speakerVoiceAssignments[speakerUpper] = assignedVoice;
    console.log(
      `🎭 Voice assigned: ${speakerUpper} → ${voiceDescription} (${assignedVoice.substring(0, 8)}...)`,
    );

    return assignedVoice;
  }

  // Reset voice assignments between episodes
  private resetVoiceAssignments(): void {
    this.speakerVoiceAssignments = {};
    this.usedVoiceIndices = {
      indian_male: 0,
      indian_female: 0,
      american_male: 0,
      american_female: 0,
      british_male: 0,
      british_female: 0,
    };
  }

  private estimateSfxDuration(prompt: string): number {
    const lower = prompt.toLowerCase();
    // Critical impact sounds - need longer duration for dramatic effect
    if (['car', 'crash', 'violent', 'collision'].some((s) => lower.includes(s)))
      return 4;
    if (['ground', 'body', 'thud'].some((s) => lower.includes(s))) return 3;
    // Phone sounds - short and clear
    if (
      lower.includes('phone') &&
      (lower.includes('vibrat') || lower.includes('ring'))
    )
      return 3;
    if (lower.includes('dial') || lower.includes('disconnect')) return 2;
    // Standard sounds
    if (['knock', 'slam', 'click', 'bang'].some((s) => lower.includes(s)))
      return 2;
    if (['footsteps', 'engine'].some((s) => lower.includes(s))) return 4;
    if (
      ['ambient', 'rain', 'crowd', 'street', 'newsroom', 'hospital'].some((s) =>
        lower.includes(s),
      )
    )
      return 8;
    return 4;
  }

  private shapeSfxPrompt(prompt: string): {
    prompt: string;
    role: 'bed' | 'spot';
  } {
    const raw = (prompt || '').trim();
    const lower = raw.toLowerCase();

    const bedKeywords = [
      'ambient',
      'ambience',
      'room tone',
      'murmur',
      'hum',
      'wind',
      'rain',
      'crowd',
      'newsroom',
      'street',
      'traffic',
    ];
    const role: 'bed' | 'spot' = bedKeywords.some((k) => lower.includes(k))
      ? 'bed'
      : 'spot';

    let shaped = raw;

    // CRITICAL SOUNDS - High priority with detailed prompts
    // Car/vehicle impact - dramatic, visceral
    if (
      (lower.includes('car') || lower.includes('vehicle')) &&
      (lower.includes('hit') ||
        lower.includes('impact') ||
        lower.includes('strike'))
    ) {
      shaped =
        'dramatic car crash impact, metal crunching, glass shattering, body thud on ground, 3 seconds, cinematic, visceral';
    }
    // Phone sounds - clear, recognizable
    else if (
      lower.includes('phone') &&
      (lower.includes('ring') || lower.includes('vibrat'))
    ) {
      shaped =
        'smartphone vibrating on table, buzzing sound, 2 seconds, clear, realistic Indian phone tone';
    } else if (lower.includes('phone') && lower.includes('dial')) {
      shaped =
        'phone dial tone, abrupt disconnect beep, realistic, 1.5 seconds';
    } else if (
      lower.includes('phone') &&
      (lower.includes('call') || lower.includes('notification'))
    ) {
      shaped = 'smartphone notification ping, clear, modern, 1 second';
    }
    // Violence/impact sounds
    else if (lower.includes('violent') && lower.includes('impact')) {
      shaped =
        'violent collision impact, metal crashing, body hitting ground, glass breaking, 4 seconds, dramatic, cinematic';
    } else if (
      lower.includes('ground') &&
      (lower.includes('contact') ||
        lower.includes('body') ||
        lower.includes('hit'))
    ) {
      shaped =
        'body hitting ground, dull thud, clothes rustling, gravel scraping, realistic, 2 seconds';
    }
    // Traffic/street sounds
    else if (lower.includes('traffic') && lower.includes('muffle')) {
      shaped =
        'traffic sounds becoming muffled, dreamlike, underwater effect, tension building, 3 seconds';
    }
    // Montage/news sounds
    else if (
      lower.includes('montage') ||
      lower.includes('overlapping') ||
      lower.includes('chaotic')
    ) {
      shaped = 'distant TV news murmur, low intelligibility, room tone, subtle';
    }
    // Newsroom ambience
    else if (lower.includes('newsroom')) {
      shaped =
        'Indian newsroom ambience, ceiling fan hum, distant typing, chai cups clinking, soft Hindi conversations, subtle';
    }
    // Hospital sounds
    else if (
      lower.includes('hospital') ||
      lower.includes('heart monitor') ||
      lower.includes('icu')
    ) {
      shaped =
        'hospital ICU ambience, steady heart monitor beeping, distant PA announcement in Hindi, subtle ventilator hum, calm';
    }
    // Street/outdoor sounds
    else if (
      lower.includes('street') ||
      lower.includes('mumbai') ||
      lower.includes('india')
    ) {
      shaped =
        'Mumbai street ambience, auto-rickshaw horns, distant chai vendor calling, traffic sounds, bustling city, subtle';
    }
    // Rain sounds
    else if (lower.includes('rain')) {
      shaped =
        'light monsoon rain ambience, raindrops on window, distant thunder, subtle';
    }
    // Door sounds
    else if (lower.includes('door')) {
      shaped =
        'wooden door opening/closing, creaking hinges, latch click, realistic, 1.5 seconds';
    }
    // Footsteps
    else if (lower.includes('footsteps')) {
      shaped =
        'footsteps on concrete, approaching, leather shoes, echoing slightly, 3 seconds';
    }
    // Generic impact
    else if (
      lower.includes('hit') ||
      lower.includes('crash') ||
      lower.includes('impact')
    ) {
      shaped = 'sudden impact thud, dramatic, realistic, 2 seconds';
    }

    shaped = shaped.replace(/\s+/g, ' ').trim();
    if (shaped.length > 220) shaped = shaped.slice(0, 220);
    return { prompt: shaped, role };
  }

  // ============================================================================
  // NEWS HIGHLIGHTS GENERATION
  // ============================================================================

  /**
   * Generate up to 15 abstract news highlights for a category
   * These are short, attention-grabbing summaries that will be expanded later
   */
  async generateNewsHighlights(
    userId: string,
    categoryId: string,
    language: string = 'English',
    count: number = 15,
  ): Promise<
    Array<{
      title: string;
      summary: string;
      keywords: string[];
      sources: string[];
    }>
  > {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are a news research assistant. Search for the TOP ${count} LATEST news stories about "${category.name}" in India.

TODAY'S DATE: ${today}
TARGET LANGUAGE: ${language}

Find current, REAL news from reliable sources and return ${count} distinct news highlights as a JSON array:
[
  {
    "title": "Compelling headline (max 80 chars) in ${language}",
    "summary": "Abstract summary (40-60 words) - attention-grabbing, key facts only",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "sources": ["source name or URL"]
  }
]

REQUIREMENTS:
1. Each story must be DIFFERENT and cover a unique angle
2. Titles must be compelling and clickable (use power words, numbers)
3. Summaries should tease the story without giving everything away
4. Focus on BREAKING news and developing stories
5. Include a mix of serious and lighter news if appropriate
6. ALL content in ${language} language

Respond ONLY with the JSON array, no markdown.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      },
    );

    const responseText =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No content generated');

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const highlights = JSON.parse(jsonMatch[0]);
        return highlights.slice(0, count);
      }
      throw new Error('No JSON array in response');
    } catch (error) {
      console.error('Failed to parse highlights:', responseText);
      throw new Error('Failed to parse generated highlights');
    }
  }

  /**
   * Expand a single highlight into a detailed 1-2 minute news article
   * This creates engaging content suitable for audio narration
   */
  async expandHighlightToDetailed(
    userId: string,
    highlight: {
      title: string;
      content: string;
      language?: string;
      metadata?: any;
    },
  ): Promise<{
    title: string;
    content: string;
    formattedScript: string;
    emotion: string;
    estimatedDuration: number; // in seconds
  }> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const language = highlight.language || 'English';
    const keywords = highlight.metadata?.keywords?.join(', ') || '';

    const prompt = `You are an expert audio news writer. Expand this news highlight into a compelling 1-2 minute audio news segment.

HIGHLIGHT TITLE: ${highlight.title}
SUMMARY: ${highlight.content}
KEYWORDS: ${keywords}
LANGUAGE: ${language}

Create an engaging detailed news article in JSON format:
{
  "title": "Refined, compelling headline in ${language}",
  "content": "Full detailed article (200-350 words) that:
    - Opens with a hook that grabs attention
    - Provides context and background
    - Includes quotes or expert opinions where relevant
    - Ends with implications or what to watch next
    - Is written for LISTENING (clear, conversational, no complex sentences)",
  "formatted_script": "The same content but formatted for TTS:
    - Use [excited], [serious], [calm], [urgent] emotion tags at key moments
    - Add ... for natural pauses
    - Emphasize key words naturally
    - Break into short, breathable sentences",
  "emotion": "primary emotion for narration (excited/calm/serious/urgent/warm/informative)",
  "estimated_duration_seconds": approximate reading time at 150 words per minute
}

CRITICAL: Content must be factual, based on the highlight. All in ${language}.
Respond ONLY with JSON.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      },
    );

    const responseText =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No content generated');

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title,
          content: parsed.content,
          formattedScript: parsed.formatted_script,
          emotion: parsed.emotion || 'informative',
          estimatedDuration: parsed.estimated_duration_seconds || 90,
        };
      }
      throw new Error('No JSON in response');
    } catch (error) {
      console.error('Failed to parse detailed content:', responseText);
      throw new Error('Failed to parse expanded content');
    }
  }

  // ============================================================================
  // EMBEDDING GENERATION
  // ============================================================================

  /**
   * Generate text embedding using Gemini's embedding model
   * Used for semantic search in book chunks
   */
  async generateTextEmbedding(userId: string, text: string): Promise<number[]> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Truncate text if too long (Gemini embedding has token limits)
    const truncatedText = text.substring(0, 8000);

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKeyRecord.apiKey}`,
        {
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: truncatedText }],
          },
        },
      );

      const embedding = response.data?.embedding?.values;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }

      return embedding;
    } catch (error: unknown) {
      const err = error as any;
      console.error(
        'Embedding generation failed:',
        err.response?.data || err.message,
      );
      throw new Error(`Failed to generate embedding: ${err.message}`);
    }
  }

  // ============================================================================
  // BOOK CONTENT ANALYSIS
  // ============================================================================

  /**
   * Analyze book content to extract characters, themes, and story structure
   */
  async analyzeBookContent(
    userId: string,
    bookTitle: string,
    sampleText: string,
  ): Promise<{
    genre: string;
    themes: string[];
    setting: string;
    synopsis: string;
    mood: string;
    targetAudience: string;
    characters: Array<{
      name: string;
      gender?: string;
      role: string;
      description: string;
      traits?: string[];
      voiceDescription?: string;
    }>;
    plotPoints: string[];
    arcs: string[];
    climax?: string;
    resolution?: string;
    episodeSuggestions: string[];
  }> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `You are a literary analyst specializing in audio drama adaptations. Analyze this book excerpt and provide a comprehensive breakdown.

BOOK TITLE: ${bookTitle}

SAMPLE TEXT:
${sampleText.substring(0, 40000)}

Provide a detailed analysis in JSON format:
{
  "genre": "Primary genre (Drama, Thriller, Romance, Mystery, etc.)",
  "themes": ["theme1", "theme2", "theme3"],
  "setting": "Where and when the story takes place",
  "synopsis": "2-3 paragraph plot summary (avoid major spoilers)",
  "mood": "Overall emotional tone (dark, hopeful, tense, light-hearted, etc.)",
  "target_audience": "Target demographic",
  "characters": [
    {
      "name": "Character name",
      "gender": "male/female/other/unknown",
      "role": "protagonist/antagonist/supporting/narrator",
      "description": "Brief character description",
      "traits": ["trait1", "trait2"],
      "voice_description": "Voice casting notes (age, accent, quality)"
    }
  ],
  "plot_points": [
    "Major plot point 1 (chronological)",
    "Major plot point 2",
    "..."
  ],
  "arcs": [
    "Character/story arc 1",
    "..."
  ],
  "climax": "The story's climactic moment",
  "resolution": "How the story resolves",
  "episode_suggestions": [
    "Episode 1: Introduction - ...",
    "Episode 2: Rising action - ...",
    "..."
  ]
}

IMPORTANT:
- Extract ALL named characters you can identify
- Episode suggestions should create Netflix-style hooks and cliffhangers
- Each episode should end on tension or revelation
- Identify 8-15 natural episode break points

Respond ONLY with JSON.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
      },
    );

    const responseText =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No analysis generated');

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          genre: analysis.genre || 'Drama',
          themes: analysis.themes || [],
          setting: analysis.setting || 'Unknown',
          synopsis: analysis.synopsis || '',
          mood: analysis.mood || 'Engaging',
          targetAudience: analysis.target_audience || 'General',
          characters: (analysis.characters || []).map((c: any) => ({
            name: c.name,
            gender: c.gender,
            role: c.role,
            description: c.description,
            traits: c.traits,
            voiceDescription: c.voice_description,
          })),
          plotPoints: analysis.plot_points || [],
          arcs: analysis.arcs || [],
          climax: analysis.climax,
          resolution: analysis.resolution,
          episodeSuggestions: analysis.episode_suggestions || [],
        };
      }
      throw new Error('No JSON in response');
    } catch (error) {
      console.error('Failed to parse book analysis:', responseText);
      throw new Error('Failed to parse book analysis');
    }
  }

  // ============================================================================
  // BOOK-TO-SERIES EPISODE GENERATION
  // ============================================================================

  /**
   * Generate a single episode script from book content
   * Creates Netflix-style engaging audio drama with cliffhangers
   */
  async generateBookEpisodeScript(
    userId: string,
    params: {
      bookTitle: string;
      seriesTitle: string;
      episodeNumber: number;
      totalEpisodes: number;
      synopsis: string;
      relevantContent: string;
      characters: Array<{ name: string; role: string; description: string }>;
      adaptationStyle: 'faithful' | 'enhanced' | 'immersive';
      previousEpisodeSummary?: string;
      isFirstEpisode: boolean;
      isFinalEpisode: boolean;
    },
  ): Promise<{
    title: string;
    synopsis: string;
    fullScript: string;
    estimatedDuration: number;
  }> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.GEMINI,
    );
    if (!apiKeyRecord?.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Audiobook narration styles - no SFX, narrator-driven storytelling
    const styleInstructions = {
      faithful:
        "Read the book content exactly as written. Preserve the author's original prose, descriptions, and dialogue verbatim. This is a true audiobook experience.",
      enhanced:
        'Adapt the book content for audio with slight enhancements for clarity. Keep 90% of original text, but smooth transitions between scenes and clarify ambiguous passages.',
      immersive:
        "Create an engaging audio adaptation that captures the book's essence. Use expressive narration, but keep dialogue only for key dramatic moments. Maintain the book's literary quality.",
    };

    const prompt = `You are an expert audiobook narrator and adapter creating a serialized audiobook from a novel.

SERIES: ${params.seriesTitle}
SOURCE BOOK: ${params.bookTitle}
EPISODE: ${params.episodeNumber} of ${params.totalEpisodes}
STYLE: ${styleInstructions[params.adaptationStyle]}

${params.previousEpisodeSummary ? `PREVIOUS EPISODE ENDED WITH: ${params.previousEpisodeSummary}` : ''}

EPISODE CONTENT GUIDANCE: ${params.synopsis}

BOOK CONTENT FOR THIS EPISODE:
${params.relevantContent.substring(0, 15000)}

CHARACTERS IN THIS SECTION:
${params.characters.map((c) => `- ${c.name} (${c.role}): ${c.description}`).join('\n')}

Create a ~5 minute audiobook episode (approximately 750-1000 words).

CRITICAL RULES:
1. NO SOUND EFFECTS - This is a pure audiobook narration, not an audio drama
2. 90% NARRATOR - The narrator tells the story, describes scenes, conveys emotions through prose
3. DIALOGUE ONLY WHEN ESSENTIAL - Use character dialogue sparingly, only for key dramatic moments or when it's in the original text
4. PRESERVE THE BOOK'S ESSENCE - Keep the literary quality, the author's voice, the descriptive prose
5. MAKE IT LISTENABLE - Smooth transitions, clear scene descriptions, engaging pacing

FORMAT YOUR SCRIPT AS:
---
NARRATOR: (calm) The morning light crept through the curtains as...
NARRATOR: (contemplative) She had always known this day would come...
CHARACTER_NAME: (emotion) "Only use dialogue for important moments."
NARRATOR: (tense) The words hung in the air between them...
---

EMOTION TAGS: Use (calm), (warm), (tense), (sad), (excited), (whispered), (contemplative), (urgent) etc.

STRUCTURE:
1. ${params.isFirstEpisode ? 'Begin with an engaging hook that draws listeners into the world' : 'Briefly reconnect with where we left off'}
2. Develop the story naturally through narration
3. ${params.isFinalEpisode ? 'Bring the story to a satisfying conclusion' : 'End at a natural pause point that makes listeners want to continue'}

Return JSON:
{
  "title": "Episode ${params.episodeNumber}: [Title from book content or chapter]",
  "synopsis": "Brief 1-2 sentence summary of what happens in this episode",
  "full_script": "Complete narration script with NARRATOR lines and occasional CHARACTER dialogue",
  "estimated_duration_seconds": 300
}

Respond ONLY with valid JSON.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyRecord.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
      },
    );

    const responseText =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No script generated');

    try {
      // Remove markdown code blocks if present
      let cleanedText = responseText;
      if (cleanedText.includes('```json')) {
        cleanedText = cleanedText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '');
      } else if (cleanedText.includes('```')) {
        cleanedText = cleanedText.replace(/```\s*/g, '');
      }

      // Try to find and parse JSON
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || `Episode ${params.episodeNumber}`,
          synopsis: parsed.synopsis || '',
          fullScript: parsed.full_script || '',
          estimatedDuration: parsed.estimated_duration_seconds || 240,
        };
      }
      throw new Error('No JSON in response');
    } catch (error) {
      console.error(
        'Failed to parse episode script:',
        responseText.substring(0, 500),
      );
      throw new Error('Failed to parse generated episode script');
    }
  }
}
