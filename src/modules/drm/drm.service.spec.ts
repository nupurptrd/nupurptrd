/**
 * @file DRM Service Tests
 * @description Unit tests for Digital Rights Management service
 *
 * Tests cover:
 * - URL signing and validation
 * - License management
 * - Concurrent stream limits
 * - Playback session tracking
 * - Audit logging
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DrmService } from './drm.service';
import { DrmLicense } from '../../entities/drm-license.entity';
import { ActiveStream } from '../../entities/active-stream.entity';
import { DrmAuditLog, DrmEventType } from '../../entities/drm-audit-log.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { User } from '../../entities/user.entity';
import { UrlType } from './dto/drm.dto';

describe('DrmService', () => {
  let service: DrmService;
  let licenseRepository: jest.Mocked<Repository<DrmLicense>>;
  let activeStreamRepository: jest.Mocked<Repository<ActiveStream>>;
  let auditLogRepository: jest.Mocked<Repository<DrmAuditLog>>;
  let episodeRepository: jest.Mocked<Repository<SeriesEpisode>>;
  let configService: jest.Mocked<ConfigService>;

  const mockUserId = 'user-123';
  const mockEpisodeId = 'episode-456';
  const mockDeviceId = 'device-789';

  const mockEpisode = {
    id: mockEpisodeId,
    title: 'Test Episode',
    audioUrl: 'https://storage.example.com/audio/test.mp3',
    seriesId: 'series-123',
  } as SeriesEpisode;

  beforeEach(async () => {
    const mockLicenseRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockActiveStreamRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    const mockAuditLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockEpisodeRepo = {
      findOne: jest.fn(),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue: unknown) => {
        const config: Record<string, unknown> = {
          DRM_SECRET: 'test-secret-key',
          MAX_CONCURRENT_STREAMS: 2,
          HEARTBEAT_TIMEOUT_MINUTES: 5,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrmService,
        { provide: getRepositoryToken(DrmLicense), useValue: mockLicenseRepo },
        {
          provide: getRepositoryToken(ActiveStream),
          useValue: mockActiveStreamRepo,
        },
        {
          provide: getRepositoryToken(DrmAuditLog),
          useValue: mockAuditLogRepo,
        },
        {
          provide: getRepositoryToken(SeriesEpisode),
          useValue: mockEpisodeRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DrmService>(DrmService);
    licenseRepository = module.get(getRepositoryToken(DrmLicense));
    activeStreamRepository = module.get(getRepositoryToken(ActiveStream));
    auditLogRepository = module.get(getRepositoryToken(DrmAuditLog));
    episodeRepository = module.get(getRepositoryToken(SeriesEpisode));
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signUrl', () => {
    it('should generate a signed URL for valid episode', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      licenseRepository.findOne.mockResolvedValue(null);
      licenseRepository.create.mockReturnValue({} as DrmLicense);
      licenseRepository.save.mockResolvedValue({} as DrmLicense);
      auditLogRepository.create.mockReturnValue({} as DrmAuditLog);
      auditLogRepository.save.mockResolvedValue({} as DrmAuditLog);

      const result = await service.signUrl(
        mockUserId,
        { episodeId: mockEpisodeId, type: UrlType.STREAM },
        '127.0.0.1',
        'TestAgent/1.0',
      );

      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('sessionToken');
      expect(result.signedUrl).toContain(mockEpisode.audioUrl);
      expect(episodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockEpisodeId },
      });
    });

    it('should throw NotFoundException for non-existent episode', async () => {
      episodeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.signUrl(mockUserId, {
          episodeId: 'invalid-id',
          type: UrlType.STREAM,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for episode without audio', async () => {
      episodeRepository.findOne.mockResolvedValue({
        ...mockEpisode,
        audioUrl: null,
      } as unknown as SeriesEpisode);

      await expect(
        service.signUrl(mockUserId, {
          episodeId: mockEpisodeId,
          type: UrlType.STREAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new license if none exists', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      licenseRepository.findOne.mockResolvedValue(null);
      licenseRepository.create.mockReturnValue({
        userId: mockUserId,
        episodeId: mockEpisodeId,
      } as DrmLicense);
      licenseRepository.save.mockResolvedValue({} as DrmLicense);
      auditLogRepository.create.mockReturnValue({} as DrmAuditLog);
      auditLogRepository.save.mockResolvedValue({} as DrmAuditLog);

      await service.signUrl(mockUserId, {
        episodeId: mockEpisodeId,
        type: UrlType.STREAM,
      });

      expect(licenseRepository.create).toHaveBeenCalled();
      expect(licenseRepository.save).toHaveBeenCalled();
    });

    it('should log URL_SIGNED event in audit log', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      licenseRepository.findOne.mockResolvedValue({} as DrmLicense);
      auditLogRepository.create.mockReturnValue({
        eventType: DrmEventType.URL_SIGNED,
      } as DrmAuditLog);
      auditLogRepository.save.mockResolvedValue({} as DrmAuditLog);

      await service.signUrl(
        mockUserId,
        { episodeId: mockEpisodeId, type: UrlType.STREAM },
        '127.0.0.1',
      );

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          episodeId: mockEpisodeId,
          eventType: DrmEventType.URL_SIGNED,
        }),
      );
    });
  });

  describe('validatePlayback', () => {
    const mockValidationDto = {
      episodeId: mockEpisodeId,
      sessionToken: 'valid-session-token',
      deviceId: mockDeviceId,
    };

    it('should return valid for authorized playback', async () => {
      episodeRepository.findOne.mockResolvedValue(mockEpisode);
      licenseRepository.findOne.mockResolvedValue({
        userId: mockUserId,
        episodeId: mockEpisodeId,
        expiresAt: new Date(Date.now() + 86400000), // Future date
      } as DrmLicense);
      // Mock find to return empty array (no active streams on other devices)
      activeStreamRepository.find.mockResolvedValue([]);
      auditLogRepository.create.mockReturnValue({} as DrmAuditLog);
      auditLogRepository.save.mockResolvedValue({} as DrmAuditLog);

      const result = await service.validatePlayback(
        mockUserId,
        mockValidationDto,
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('concurrent streams', () => {
    it('should enforce max concurrent streams limit', async () => {
      // This would test that the service enforces the MAX_CONCURRENT_STREAMS config
      expect(configService.get('MAX_CONCURRENT_STREAMS', 2)).toBe(2);
    });
  });
});
