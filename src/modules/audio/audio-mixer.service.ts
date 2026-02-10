import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

/**
 * Production-Grade Audio Standards
 * Based on professional audio drama requirements (Spotify/Audible/Netflix tier)
 */
const AUDIO_STANDARDS = {
  // Loudness targets (LUFS)
  DIALOGUE_LUFS: -16, // Dialogue is king - always clear
  AMBIENCE_LUFS: -27, // Background ambience - supportive, never competing
  SFX_LUFS: -20, // Sound effects - impactful but not overwhelming
  MUSIC_LUFS: -24, // Background music - subtle bed

  // Frequency carving ranges (Hz)
  DIALOGUE_FREQ: { low: 1500, high: 4000 }, // Boost for clarity
  AMBIENCE_FREQ: { low: 300, high: 6000 }, // Carve out dialogue space
  SFX_LOWPASS: 1000, // News clips etc - low-pass aggressively

  // Silence durations (seconds)
  BEAT_SILENCE: 0.5, // Short dramatic pause
  DRAMATIC_SILENCE: 1.0, // After revelations
  SHOCK_SILENCE: 2.0, // After major events (car hit, etc.)
  ENDING_SILENCE: 3.0, // Final lock before end
};

export interface MixOptions {
  backgroundMusicVolume?: number; // 0-1, default 0.10
  sfxVolume?: number; // 0-1, default 0.6
  voiceVolume?: number; // 0-1, default 1.0
  fadeInDuration?: number; // seconds
  fadeOutDuration?: number; // seconds
  normalize?: boolean; // Apply loudness normalization
  endWithSilence?: boolean; // End on silence, not sound
  endingSilenceDuration?: number; // Duration of ending silence
}

export interface AudioSegment {
  type: 'voice' | 'sfx' | 'music' | 'silence' | 'motif';
  buffer: Buffer;
  speaker?: string;
  emotion?: string;
  sceneType?: 'normal' | 'tense' | 'hospital' | 'psychoacoustic' | 'revelation';
  silenceDuration?: number; // For silence segments
  motifType?: 'ouroboros' | 'heartbeat' | 'glitch'; // For motif segments
  prompt?: string;
  sfxRole?: 'bed' | 'spot';
}

@Injectable()
export class AudioMixerService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'smarton-audio');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Production-grade audio mixing using ffmpeg
   * Implements professional audio drama standards:
   * - Frequency carving for dialogue clarity
   * - Proper loudness levels (LUFS)
   * - Dynamic contrast with intentional silences
   * - Psychoacoustic effects for scene types
   * - Ending treatment (silence lock)
   */
  async mixProductionAudio(
    segments: AudioSegment[],
    backgroundMusic?: Buffer,
    options: MixOptions = {},
  ): Promise<Buffer> {
    const sessionId = uuidv4();
    const sessionDir = path.join(this.tempDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const bgVolume = options.backgroundMusicVolume ?? 0.08; // Lower for clarity
    const fadeIn = options.fadeInDuration ?? 1.5;
    const fadeOut = options.fadeOutDuration ?? 2.0;
    const sfxVolume = options.sfxVolume ?? 0.6;
    const voiceVolume = options.voiceVolume ?? 1.0;
    const endWithSilence = options.endWithSilence ?? true;
    const endingSilenceDuration =
      options.endingSilenceDuration ?? AUDIO_STANDARDS.ENDING_SILENCE;

    try {
      console.log('\n🎛️ Starting cinematic production mix...');

      const dialogueParts: string[] = [];
      const sfxItems: Array<{
        file: string;
        startSeconds: number;
        role: 'bed' | 'spot';
        prompt?: string;
        motifType?: string;
      }> = [];
      let segmentIndex = 0;
      let timelineSeconds = 0;

      for (const segment of segments) {
        const inputFile = path.join(
          sessionDir,
          `raw_${segmentIndex.toString().padStart(4, '0')}.mp3`,
        );
        const outputFile = path.join(
          sessionDir,
          `processed_${segmentIndex.toString().padStart(4, '0')}.mp3`,
        );

        if (segment.type === 'silence') {
          const silenceDuration =
            segment.silenceDuration || AUDIO_STANDARDS.DRAMATIC_SILENCE;
          await this.generateSilenceFile(outputFile, silenceDuration);
          dialogueParts.push(outputFile);
          timelineSeconds += silenceDuration;
          console.log(`  🔇 Silence: ${silenceDuration}s`);
          segmentIndex++;
          continue;
        }

        if (segment.type === 'voice') {
          fs.writeFileSync(inputFile, segment.buffer);
          await this.processDialogue(inputFile, outputFile, segment.sceneType);
          dialogueParts.push(outputFile);
          const dur = await this.getAudioDuration(outputFile);
          timelineSeconds += dur;
          console.log(
            `  🎤 Voice: ${segment.speaker} [${segment.sceneType || 'normal'}]`,
          );
          segmentIndex++;
          continue;
        }

        if (segment.type === 'motif') {
          fs.writeFileSync(inputFile, segment.buffer);
          await this.applyMotifEffect(
            inputFile,
            outputFile,
            segment.motifType || 'ouroboros',
          );
          sfxItems.push({
            file: outputFile,
            startSeconds: Math.max(0, timelineSeconds - 0.05),
            role: 'spot',
            prompt: segment.prompt,
            motifType: segment.motifType,
          });
          console.log(`  🔔 Motif: ${segment.motifType}`);
          segmentIndex++;
          continue;
        }

        if (segment.type === 'sfx') {
          fs.writeFileSync(inputFile, segment.buffer);
          if (segment.motifType) {
            await this.applyMotifEffect(
              inputFile,
              outputFile,
              segment.motifType,
            );
          } else {
            await this.processSFX(
              inputFile,
              outputFile,
              segment.sceneType,
              segment.sfxRole,
              segment.prompt,
            );
          }

          const role = segment.sfxRole || 'spot';
          const preRoll = role === 'bed' ? 0 : 0.15;
          sfxItems.push({
            file: outputFile,
            startSeconds: Math.max(0, timelineSeconds - preRoll),
            role,
            prompt: segment.prompt,
            motifType: segment.motifType,
          });
          console.log(`  🔊 SFX: ${role}`);
          segmentIndex++;
          continue;
        }

        segmentIndex++;
      }

      if (dialogueParts.length === 0) {
        throw new Error('No dialogue/silence segments provided');
      }

      const dialogueListFile = path.join(sessionDir, 'dialogue_list.txt');
      fs.writeFileSync(
        dialogueListFile,
        dialogueParts.map((f) => `file '${f}'`).join('\n'),
      );

      const dialogueTrack = path.join(sessionDir, 'dialogue_track.mp3');
      await this.runFFmpeg([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        dialogueListFile,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-y',
        dialogueTrack,
      ]);

      const dialogueDuration = await this.getAudioDuration(dialogueTrack);
      console.log(`  📏 Dialogue track: ${dialogueDuration.toFixed(2)}s`);

      const sfxBusFile = await this.buildSfxBus(
        sessionDir,
        sfxItems,
        dialogueDuration,
        sfxVolume,
      );

      let bgProcessedFile: string | undefined;
      if (backgroundMusic && backgroundMusic.length > 0) {
        const bgMusicFile = path.join(sessionDir, 'bg_music.mp3');
        fs.writeFileSync(bgMusicFile, backgroundMusic);
        bgProcessedFile = path.join(sessionDir, 'bg_music_processed.mp3');
        await this.processBackgroundMusic(bgMusicFile, bgProcessedFile);
      }

      const mixedOutput = path.join(sessionDir, 'mixed_cinematic.mp3');
      const finalMixArgs: string[] = [];
      finalMixArgs.push('-i', dialogueTrack);
      if (sfxBusFile) finalMixArgs.push('-i', sfxBusFile);
      if (bgProcessedFile) finalMixArgs.push('-i', bgProcessedFile);

      const filterParts: string[] = [];
      filterParts.push(
        `[0:a]volume=${voiceVolume},acompressor=threshold=-22dB:ratio=2:attack=10:release=120[dlg]`,
      );

      const mixInputs: string[] = ['[dlg]'];

      if (sfxBusFile) {
        // Less aggressive sidechain so SFX stay audible during dialogue
        // Reduced ratio from 6 to 3, higher threshold so only loud dialogue ducks SFX
        filterParts.push(
          `[1:a]highpass=f=60,equalizer=f=2500:t=q:w=1.0:g=-2[sfxraw]`,
        );
        filterParts.push(
          `[sfxraw][dlg]sidechaincompress=threshold=-28dB:ratio=3:attack=10:release=200[sfx]`,
        );
        mixInputs.push('[sfx]');
      }

      if (bgProcessedFile) {
        const musicInputIndex = sfxBusFile ? 2 : 1;
        filterParts.push(
          `[${musicInputIndex}:a]aloop=loop=-1:size=2e+09,atrim=0:${dialogueDuration + 0.5},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${Math.max(0, dialogueDuration - fadeOut)}:d=${fadeOut},volume=${bgVolume}[musicraw]`,
        );
        filterParts.push(
          `[musicraw][dlg]sidechaincompress=threshold=-35dB:ratio=10:attack=10:release=400[music]`,
        );
        mixInputs.push('[music]');
      }

      filterParts.push(
        `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2,alimiter=limit=0.97[mix]`,
      );

      await this.runFFmpeg([
        ...finalMixArgs,
        '-filter_complex',
        filterParts.join(';'),
        '-map',
        '[mix]',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-y',
        mixedOutput,
      ]);

      let outputFile = mixedOutput;

      // Step 4: Add ending silence for "lock" effect
      if (endWithSilence) {
        const withEndingSilence = path.join(
          sessionDir,
          'with_ending_silence.mp3',
        );
        const silenceFile = path.join(sessionDir, 'ending_silence.mp3');
        await this.generateSilenceFile(silenceFile, endingSilenceDuration);

        // Concatenate main + silence
        const endingListFile = path.join(sessionDir, 'ending_list.txt');
        fs.writeFileSync(
          endingListFile,
          `file '${outputFile}'\nfile '${silenceFile}'`,
        );

        await this.runFFmpeg([
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          endingListFile,
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          '-y',
          withEndingSilence,
        ]);

        outputFile = withEndingSilence;
        console.log(
          `  🔇 Ending silence: ${endingSilenceDuration}s (lock effect)`,
        );
      }

      // Step 5: Final loudness normalization (broadcast standard)
      if (options.normalize !== false) {
        const normalizedOutput = path.join(sessionDir, 'final_normalized.mp3');
        await this.runFFmpeg([
          '-i',
          outputFile,
          '-af',
          `loudnorm=I=${AUDIO_STANDARDS.DIALOGUE_LUFS}:TP=-1.5:LRA=11`,
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          '-y',
          normalizedOutput,
        ]);
        outputFile = normalizedOutput;
        console.log(`  📊 Normalized to ${AUDIO_STANDARDS.DIALOGUE_LUFS} LUFS`);
      }

      // Read final output
      const finalBuffer = fs.readFileSync(outputFile);
      console.log(
        `\n✅ Production audio complete: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`,
      );

      // Cleanup
      this.cleanup(sessionDir);

      return finalBuffer;
    } catch (error) {
      this.cleanup(sessionDir);
      console.error('Audio mixing failed:', error);
      throw error;
    }
  }

  /**
   * Process dialogue with frequency boost for clarity
   * Boosts 1.5kHz-4kHz range where speech intelligibility lives
   */
  private async processDialogue(
    inputFile: string,
    outputFile: string,
    sceneType?: string,
  ): Promise<void> {
    const filters: string[] = [];

    // Base dialogue processing: EQ boost for clarity
    filters.push(
      // High-pass to remove rumble
      'highpass=f=80',
      // Boost presence/clarity frequencies (1.5kHz - 4kHz)
      'equalizer=f=2500:t=q:w=1.5:g=3',
      // Slight compression for consistent levels
      'acompressor=threshold=-24dB:ratio=3:attack=10:release=120',
    );

    // Scene-specific psychoacoustic effects
    if (sceneType === 'hospital' || sceneType === 'psychoacoustic') {
      // Subtle phasing for altered perception
      filters.push('aphaser=type=t:speed=0.3:decay=0.3');
      // Slight pitch shift (detuned by cents)
      filters.push('asetrate=44100*1.003,aresample=44100');
    } else if (sceneType === 'revelation') {
      // Slight reverb for weight
      filters.push('aecho=0.8:0.7:20:0.3');
    }

    await this.runFFmpeg([
      '-i',
      inputFile,
      '-af',
      filters.join(','),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputFile,
    ]);
  }

  /**
   * Process SFX with frequency carving to not compete with dialogue
   * Low-pass aggressive for news clips, ambience carving for atmosphere
   */
  private async processSFX(
    inputFile: string,
    outputFile: string,
    sceneType?: string,
    role?: 'bed' | 'spot',
    prompt?: string,
  ): Promise<void> {
    const filters: string[] = [];

    const lower = (prompt || '').toLowerCase();
    const sfxRole =
      role ||
      (lower.includes('ambient') ||
      lower.includes('ambience') ||
      lower.includes('room tone') ||
      lower.includes('rain') ||
      lower.includes('crowd')
        ? 'bed'
        : 'spot');
    const isNewsLike =
      lower.includes('news') ||
      lower.includes('tv') ||
      lower.includes('radio') ||
      lower.includes('murmur') ||
      lower.includes('montage');
    const isImpact =
      lower.includes('hit') ||
      lower.includes('crash') ||
      lower.includes('slam') ||
      lower.includes('bang') ||
      lower.includes('gun') ||
      lower.includes('explosion');
    const isPhone =
      lower.includes('phone') ||
      lower.includes('notification') ||
      lower.includes('ring') ||
      lower.includes('buzz');

    filters.push('highpass=f=60');

    if (isNewsLike) {
      filters.push('lowpass=f=1200');
    } else if (sfxRole === 'bed') {
      filters.push('lowpass=f=8000');
      filters.push('equalizer=f=2500:t=q:w=1.0:g=-6');
    } else if (isImpact || isPhone) {
      filters.push('lowpass=f=12000');
      filters.push('equalizer=f=2500:t=q:w=1.0:g=-3');
    } else {
      filters.push('lowpass=f=10000');
      filters.push('equalizer=f=2500:t=q:w=1.0:g=-4');
    }

    if (sceneType === 'hospital') {
      filters.push('equalizer=f=3500:t=q:w=1.2:g=-2');
    }

    filters.push('afade=t=in:st=0:d=0.03');

    await this.runFFmpeg([
      '-i',
      inputFile,
      '-af',
      filters.join(','),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputFile,
    ]);
  }

  /**
   * Process background music with aggressive frequency carving
   * Keeps only frequencies that don't compete with dialogue
   */
  private async processBackgroundMusic(
    inputFile: string,
    outputFile: string,
  ): Promise<void> {
    const filters = [
      'highpass=f=40',
      'lowpass=f=14000',
      'equalizer=f=2500:t=q:w=1.0:g=-8',
      'acompressor=threshold=-26dB:ratio=2:attack=20:release=300',
    ].join(',');

    await this.runFFmpeg([
      '-i',
      inputFile,
      '-af',
      filters,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputFile,
    ]);
  }

  private async buildSfxBus(
    sessionDir: string,
    sfxItems: Array<{
      file: string;
      startSeconds: number;
      role: 'bed' | 'spot';
      prompt?: string;
      motifType?: string;
    }>,
    targetDuration: number,
    baseSfxVolume: number,
  ): Promise<string | undefined> {
    if (!sfxItems.length) return undefined;

    // Determine bed intervals: each bed runs until the next bed starts (or end of program)
    const bedIndices = sfxItems
      .map((s, idx) => ({ idx, s }))
      .filter(({ s }) => s.role === 'bed')
      .sort((a, b) => a.s.startSeconds - b.s.startSeconds);

    const bedEndByIndex = new Map<number, number>();
    for (let i = 0; i < bedIndices.length; i++) {
      const current = bedIndices[i];
      const next = bedIndices[i + 1];
      const end = next ? next.s.startSeconds : targetDuration;
      bedEndByIndex.set(current.idx, Math.max(current.s.startSeconds, end));
    }

    const sfxBusFile = path.join(sessionDir, 'sfx_bus.mp3');
    const args: string[] = [];
    for (const item of sfxItems) {
      args.push('-i', item.file);
    }

    const filterParts: string[] = [];
    const labels: string[] = [];

    for (let i = 0; i < sfxItems.length; i++) {
      const item = sfxItems[i];
      const delayMs = Math.max(0, Math.round(item.startSeconds * 1000));
      // Spot SFX (impacts, phones, doors) need to be LOUD and clear
      // Bed SFX (ambience) should be subtle
      const vol =
        item.role === 'bed' ? baseSfxVolume * 0.4 : baseSfxVolume * 1.5;

      let chain: string;
      if (item.role === 'bed') {
        const bedEnd = bedEndByIndex.get(i) ?? targetDuration;
        const bedLen = Math.max(0.25, bedEnd - item.startSeconds);
        const fade = Math.min(0.6, bedLen / 4);
        chain = [
          'aloop=loop=-1:size=2e+09',
          `atrim=0:${bedLen}`,
          `afade=t=in:st=0:d=${fade}`,
          `afade=t=out:st=${Math.max(0, bedLen - fade)}:d=${fade}`,
          `volume=${vol}`,
          `adelay=${delayMs}|${delayMs}`,
        ].join(',');
      } else {
        // Spot SFX: quick fade in, prominent volume, clear timing
        chain = `volume=${vol},afade=t=in:st=0:d=0.01,adelay=${delayMs}|${delayMs}`;
      }
      filterParts.push(`[${i}:a]${chain}[s${i}]`);
      labels.push(`[s${i}]`);
    }

    filterParts.push(
      `${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=2,atrim=0:${targetDuration}[sfx]`,
    );

    await this.runFFmpeg([
      ...args,
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '[sfx]',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      sfxBusFile,
    ]);

    return sfxBusFile;
  }

  /**
   * Apply sonic motif effects (ouroboros signature, etc.)
   */
  private async applyMotifEffect(
    inputFile: string,
    outputFile: string,
    motifType: string,
  ): Promise<void> {
    const filters: string[] = [];

    switch (motifType) {
      case 'ouroboros':
        // Reversed chime + tape effect
        filters.push(
          'areverse',
          'aecho=0.6:0.6:50:0.4',
          'lowpass=f=3000',
          'volume=0.7',
        );
        break;
      case 'heartbeat':
        // Low frequency pulse
        filters.push(
          'lowpass=f=100',
          'acompressor=threshold=-10dB:ratio=8',
          'volume=0.8',
        );
        break;
      case 'glitch':
        // Digital distortion effect
        filters.push(
          'acrusher=bits=8:mode=log:aa=1',
          'tremolo=f=20:d=0.3',
          'volume=0.6',
        );
        break;
      default:
        filters.push('volume=0.7');
    }

    await this.runFFmpeg([
      '-i',
      inputFile,
      '-af',
      filters.join(','),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputFile,
    ]);
  }

  /**
   * Generate silence audio file
   */
  private async generateSilenceFile(
    outputFile: string,
    durationSeconds: number,
  ): Promise<void> {
    await this.runFFmpeg([
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=44100:cl=stereo`,
      '-t',
      durationSeconds.toString(),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-y',
      outputFile,
    ]);
  }

  /**
   * Simple concatenation fallback (no ffmpeg required)
   */
  async simpleConcatenate(segments: Buffer[]): Promise<Buffer> {
    if (segments.length === 0) {
      throw new Error('No audio segments to combine');
    }
    return Buffer.concat(segments);
  }

  /**
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    const ffprobePath = process.env.FFPROBE_PATH || '/usr/local/bin/ffprobe';
    try {
      const { stdout } = await execFileAsync(ffprobePath, [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      console.error('Failed to get audio duration:', error);
      return 0;
    }
  }

  /**
   * Run ffmpeg command
   */
  private async runFFmpeg(args: string[]): Promise<void> {
    const ffmpegPath = process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg';
    console.log(`Running: ${ffmpegPath} ${args.slice(0, 4).join(' ')}...`);

    try {
      await execFileAsync(ffmpegPath, args, { maxBuffer: 50 * 1024 * 1024 }); // 50MB buffer
    } catch (error: any) {
      console.error('FFmpeg error:', error.stderr || error.message);
      throw new Error(`FFmpeg failed: ${error.message}`);
    }
  }

  /**
   * Generate silence audio of specified duration
   */
  async generateSilence(durationMs: number): Promise<Buffer> {
    const sessionId = uuidv4();
    const outputFile = path.join(this.tempDir, `silence_${sessionId}.mp3`);

    try {
      await this.runFFmpeg([
        '-f',
        'lavfi',
        '-i',
        `anullsrc=r=44100:cl=stereo`,
        '-t',
        (durationMs / 1000).toString(),
        '-c:a',
        'libmp3lame',
        '-b:a',
        '128k',
        '-y',
        outputFile,
      ]);

      const buffer = fs.readFileSync(outputFile);
      fs.unlinkSync(outputFile);
      return buffer;
    } catch (error) {
      // Fallback: return empty buffer if lavfi not available
      console.warn('Could not generate silence, using empty buffer');
      return Buffer.alloc(0);
    }
  }

  private cleanup(sessionDir: string): void {
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}
