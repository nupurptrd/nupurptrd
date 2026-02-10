import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ElevenLabsVoice } from '../../entities/elevenlabs-voice.entity';
import { ElevenLabsLanguage } from '../../entities/elevenlabs-language.entity';
import { ElevenLabsSyncStatus } from '../../entities/elevenlabs-sync-status.entity';
import { SettingsService } from '../settings/settings.service';
import { ApiKeyType } from '../../common/enums';

// Transform to snake_case for frontend compatibility
function transformVoice(voice: ElevenLabsVoice): any {
  if (!voice) return null;
  return {
    id: voice.id,
    voice_id: voice.voiceId,
    name: voice.name,
    category: voice.category,
    language: voice.language,
    accent: voice.accent,
    gender: voice.gender,
    age: voice.age,
    description: voice.description,
    preview_url: voice.previewUrl,
    labels: voice.labels,
    created_at: voice.createdAt,
    updated_at: voice.updatedAt,
  };
}

function transformLanguage(lang: ElevenLabsLanguage): any {
  if (!lang) return null;
  return {
    id: lang.id,
    language_code: lang.languageCode,
    language_name: lang.languageName,
    voice_count: lang.voiceCount,
    is_active: lang.isActive,
    created_at: lang.createdAt,
    updated_at: lang.updatedAt,
  };
}

const ELEVENLABS_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'es', name: 'Spanish' },
  { code: 'ta', name: 'Tamil' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
];

@Injectable()
export class ElevenLabsService {
  constructor(
    @InjectRepository(ElevenLabsVoice)
    private voiceRepository: Repository<ElevenLabsVoice>,
    @InjectRepository(ElevenLabsLanguage)
    private languageRepository: Repository<ElevenLabsLanguage>,
    @InjectRepository(ElevenLabsSyncStatus)
    private syncStatusRepository: Repository<ElevenLabsSyncStatus>,
    private settingsService: SettingsService,
  ) {}

  async getLanguages() {
    const languages = await this.languageRepository.find({
      order: { languageName: 'ASC' },
    });
    return languages.map(transformLanguage);
  }

  async getVoices(language?: string) {
    const query = this.voiceRepository.createQueryBuilder('voice');

    if (language) {
      query.where('voice.language = :language', { language });
    }

    const voices = await query.orderBy('voice.name', 'ASC').getMany();
    return voices.map(transformVoice);
  }

  async getVoiceById(voiceId: string) {
    const voice = await this.voiceRepository.findOne({ where: { voiceId } });
    return voice ? transformVoice(voice) : null;
  }

  async toggleLanguageActive(id: string, isActive: boolean) {
    const language = await this.languageRepository.findOne({ where: { id } });
    if (!language) {
      throw new NotFoundException('Language not found');
    }
    language.isActive = isActive;
    const saved = await this.languageRepository.save(language);
    return transformLanguage(saved);
  }

  async syncVoices(userId: string, languageName: string = 'English') {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.ELEVENLABS,
    );

    if (!apiKeyRecord?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const apiKey = apiKeyRecord.apiKey;
    const languageCode =
      ELEVENLABS_LANGUAGES.find((l) => l.name === languageName)?.code || 'en';

    // Delete existing voices for this language
    await this.voiceRepository.delete({ language: languageName });

    const allVoices: Partial<ElevenLabsVoice>[] = [];
    let hasMore = true;
    let lastSortId: string | null = null;
    let pageCount = 0;

    // Fetch shared voices
    while (hasMore && pageCount < 50) {
      const url = new URL('https://api.elevenlabs.io/v1/shared-voices');
      url.searchParams.set('page_size', '100');
      url.searchParams.set('language', languageName.toLowerCase());
      if (lastSortId) {
        url.searchParams.set('sort_id', lastSortId);
      }

      const response = await axios.get(url.toString(), {
        headers: { 'xi-api-key': apiKey },
      });

      const voices = response.data.voices || [];

      for (const voice of voices) {
        allVoices.push({
          voiceId: voice.voice_id,
          name: voice.name,
          category: voice.category || 'shared',
          language: languageName,
          accent: voice.accent || voice.labels?.accent || null,
          gender: voice.gender || voice.labels?.gender || null,
          age: voice.age || voice.labels?.age || null,
          description: voice.description || null,
          previewUrl: voice.preview_url || null,
          labels: voice.labels || null,
        });
      }

      pageCount++;
      hasMore = response.data.has_more === true;
      lastSortId = response.data.last_sort_id || null;

      if (allVoices.length >= 200) break;
    }

    // Insert voices
    if (allVoices.length > 0) {
      await this.voiceRepository.save(allVoices);
    }

    // Update language count
    await this.languageRepository.upsert(
      {
        languageCode,
        languageName,
        voiceCount: allVoices.length,
        isActive: true,
      },
      ['languageCode'],
    );

    // Update sync status
    await this.syncStatusRepository.save({
      lastSyncAt: new Date(),
      totalVoicesFetched: allVoices.length,
      isComplete: true,
    });

    return {
      success: true,
      language: languageName,
      voiceCount: allVoices.length,
    };
  }

  async generateTTS(
    userId: string,
    text: string,
    voiceId: string,
    voiceSettings?: {
      stability: number;
      similarity_boost: number;
      style: number;
    },
  ): Promise<Buffer> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.ELEVENLABS,
    );

    if (!apiKeyRecord?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: voiceSettings || {
          stability: 0.35,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key': apiKeyRecord.apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data);
  }

  async generateSFX(
    userId: string,
    prompt: string,
    durationSeconds: number = 4,
  ): Promise<Buffer> {
    const apiKeyRecord = await this.settingsService.getApiKey(
      userId,
      ApiKeyType.ELEVENLABS,
    );

    if (!apiKeyRecord?.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/sound-generation',
      {
        text: prompt,
        duration_seconds: Math.min(durationSeconds, 22),
        prompt_influence: 0.3,
      },
      {
        headers: {
          'xi-api-key': apiKeyRecord.apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data);
  }
}
