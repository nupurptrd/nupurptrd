import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ApiKey } from '../../entities/api-key.entity';
import { PlatformSettings } from '../../entities/platform-settings.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { SecuritySettings } from '../../entities/security-settings.entity';
import { ApiKeyType } from '../../common/enums';
import axios from 'axios';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(SecuritySettings)
    private securitySettingsRepository: Repository<SecuritySettings>,
    private configService: ConfigService,
  ) {}

  // API Keys
  async getApiKeys(userId: string) {
    return this.apiKeyRepository.find({
      where: { userId },
      select: ['id', 'keyType', 'isConnected', 'lastVerifiedAt', 'createdAt'],
    });
  }

  async getApiKey(userId: string, keyType: ApiKeyType) {
    // First try to get user-specific API key from database
    const dbKey = await this.apiKeyRepository.findOne({
      where: { userId, keyType },
    });

    if (dbKey?.apiKey) {
      console.log(
        `[getApiKey] Using DB key for user ${userId}, type ${keyType}, key starts with: ${dbKey.apiKey.substring(0, 10)}...`,
      );
      return dbKey;
    }

    // Fall back to environment variables
    let envKey: string | undefined;
    if (keyType === ApiKeyType.GEMINI) {
      envKey = this.configService.get('GEMINI_API_KEY');
    } else if (keyType === ApiKeyType.ELEVENLABS) {
      envKey = this.configService.get('ELEVENLABS_API_KEY');
    }

    if (envKey) {
      console.log(
        `[getApiKey] Using ENV key for user ${userId}, type ${keyType}, key starts with: ${envKey.substring(0, 10)}...`,
      );
      // Return a virtual API key record from env
      return {
        id: 'env',
        userId,
        keyType,
        apiKey: envKey,
        isConnected: true,
        lastVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ApiKey;
    }

    console.log(
      `[getApiKey] No API key found for user ${userId}, type ${keyType}`,
    );
    return null;
  }

  async saveApiKey(userId: string, keyType: ApiKeyType, apiKey: string) {
    const existing = await this.apiKeyRepository.findOne({
      where: { userId, keyType },
    });

    if (existing) {
      existing.apiKey = apiKey;
      existing.isConnected = false;
      return this.apiKeyRepository.save(existing);
    }

    const newKey = this.apiKeyRepository.create({
      userId,
      keyType,
      apiKey,
      isConnected: false,
    });
    return this.apiKeyRepository.save(newKey);
  }

  async verifyApiKey(userId: string, keyType: ApiKeyType) {
    const apiKeyRecord = await this.getApiKey(userId, keyType);
    if (!apiKeyRecord) {
      throw new NotFoundException('API key not found');
    }

    let isValid = false;

    try {
      if (keyType === ApiKeyType.GEMINI) {
        const response = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeyRecord.apiKey}`,
        );
        isValid = response.status === 200;
      } else if (keyType === ApiKeyType.ELEVENLABS) {
        const response = await axios.get('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': apiKeyRecord.apiKey },
        });
        isValid = response.status === 200;
      }
    } catch (error) {
      isValid = false;
    }

    apiKeyRecord.isConnected = isValid;
    apiKeyRecord.lastVerifiedAt = new Date();
    await this.apiKeyRepository.save(apiKeyRecord);

    return { isConnected: isValid, keyType };
  }

  async deleteApiKey(userId: string, keyType: ApiKeyType) {
    const apiKey = await this.getApiKey(userId, keyType);
    if (apiKey) {
      await this.apiKeyRepository.remove(apiKey);
    }
    return { success: true };
  }

  // Platform Settings
  async getPlatformSettings(userId: string) {
    let settings = await this.platformSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.platformSettingsRepository.create({
        userId,
        platformName: 'Smarton Content Studio',
        defaultLanguages: ['English', 'Hindi'],
      });
      await this.platformSettingsRepository.save(settings);
    }

    return settings;
  }

  async updatePlatformSettings(
    userId: string,
    data: Partial<PlatformSettings>,
  ) {
    const settings = await this.getPlatformSettings(userId);
    Object.assign(settings, data);
    return this.platformSettingsRepository.save(settings);
  }

  // Notification Settings
  async getNotificationSettings(userId: string) {
    let settings = await this.notificationSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.notificationSettingsRepository.create({
        userId,
        breakingNews: true,
        dailyDigest: true,
        seriesEpisodes: true,
      });
      await this.notificationSettingsRepository.save(settings);
    }

    return settings;
  }

  async updateNotificationSettings(
    userId: string,
    data: Partial<NotificationSettings>,
  ) {
    const settings = await this.getNotificationSettings(userId);
    Object.assign(settings, data);
    return this.notificationSettingsRepository.save(settings);
  }

  // Security Settings
  async getSecuritySettings(userId: string) {
    let settings = await this.securitySettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        userId,
        twoFactorEnabled: false,
        sessionTimeoutEnabled: false,
        sessionTimeoutMinutes: 30,
      });
      await this.securitySettingsRepository.save(settings);
    }

    return settings;
  }

  async updateSecuritySettings(
    userId: string,
    data: Partial<SecuritySettings>,
  ) {
    const settings = await this.getSecuritySettings(userId);
    Object.assign(settings, data);
    return this.securitySettingsRepository.save(settings);
  }
}
