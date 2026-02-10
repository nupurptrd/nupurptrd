import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DrmLicense } from '../../entities/drm-license.entity';
import { ActiveStream } from '../../entities/active-stream.entity';
import { DrmAuditLog, DrmEventType } from '../../entities/drm-audit-log.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import {
  SignUrlDto,
  ValidatePlaybackDto,
  PlaybackStartedDto,
  PlaybackEndedDto,
  HeartbeatDto,
  UrlType,
} from './dto/drm.dto';

export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
  sessionToken: string;
}

export interface ValidationResponse {
  valid: boolean;
  reason?: string;
  sessionToken?: string;
}

@Injectable()
export class DrmService {
  private readonly logger = new Logger(DrmService.name);
  private readonly drmSecret: string;
  private readonly maxConcurrentStreams: number;
  private readonly heartbeatTimeoutMinutes: number;

  constructor(
    @InjectRepository(DrmLicense)
    private readonly licenseRepository: Repository<DrmLicense>,
    @InjectRepository(ActiveStream)
    private readonly activeStreamRepository: Repository<ActiveStream>,
    @InjectRepository(DrmAuditLog)
    private readonly auditLogRepository: Repository<DrmAuditLog>,
    @InjectRepository(SeriesEpisode)
    private readonly episodeRepository: Repository<SeriesEpisode>,
    private readonly configService: ConfigService,
  ) {
    this.drmSecret = this.configService.get(
      'DRM_SECRET',
      'smarton-drm-secret-key-change-in-production',
    );
    this.maxConcurrentStreams = this.configService.get(
      'MAX_CONCURRENT_STREAMS',
      2,
    );
    this.heartbeatTimeoutMinutes = this.configService.get(
      'HEARTBEAT_TIMEOUT_MINUTES',
      5,
    );
  }

  /**
   * Generate a signed URL for streaming or downloading content
   */
  async signUrl(
    userId: string,
    dto: SignUrlDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SignedUrlResponse> {
    const {
      episodeId,
      type = UrlType.STREAM,
      validityMinutes = 60,
      deviceId,
    } = dto;

    // Verify episode exists
    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    if (!episode.audioUrl) {
      throw new BadRequestException('Episode has no audio content');
    }

    // Check if user has valid license (or grant temporary one)
    await this.ensureLicense(
      userId,
      episodeId,
      type === UrlType.DOWNLOAD ? 'download' : 'stream',
    );

    // Generate expiration time
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

    // Generate session token for tracking
    const sessionToken = this.generateSessionToken(userId, episodeId, deviceId);

    // Generate signature
    const signature = this.generateSignature(
      episode.audioUrl,
      userId,
      expiresAt.getTime(),
      sessionToken,
    );

    // Construct signed URL
    const signedUrl = this.constructSignedUrl(
      episode.audioUrl,
      userId,
      expiresAt.getTime(),
      signature,
      sessionToken,
    );

    // Log the event
    await this.logEvent({
      userId,
      episodeId,
      deviceId,
      eventType: DrmEventType.URL_SIGNED,
      ipAddress,
      userAgent,
      wasSuccessful: true,
      metadata: {
        type,
        validityMinutes,
        expiresAt: expiresAt.toISOString(),
      },
    });

    this.logger.log(
      `Signed URL for user ${userId}, episode ${episodeId}, expires ${expiresAt}`,
    );

    return {
      signedUrl,
      expiresAt: expiresAt.toISOString(),
      sessionToken,
    };
  }

  /**
   * Validate if playback is allowed
   */
  async validatePlayback(
    userId: string,
    dto: ValidatePlaybackDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ValidationResponse> {
    const { episodeId, deviceId, sessionToken } = dto;

    // Clean up stale streams first
    await this.cleanupStaleStreams();

    // Check license validity
    const license = await this.licenseRepository.findOne({
      where: { userId, episodeId, isValid: true },
    });

    if (!license) {
      await this.logEvent({
        userId,
        episodeId,
        deviceId,
        eventType: DrmEventType.PLAYBACK_REJECTED,
        ipAddress,
        userAgent,
        wasSuccessful: false,
        reason: 'No valid license',
      });
      return { valid: false, reason: 'No valid license for this content' };
    }

    // Check license expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      await this.logEvent({
        userId,
        episodeId,
        deviceId,
        eventType: DrmEventType.PLAYBACK_REJECTED,
        ipAddress,
        userAgent,
        wasSuccessful: false,
        reason: 'License expired',
      });
      return { valid: false, reason: 'License has expired' };
    }

    // Check concurrent streams
    const activeStreams = await this.activeStreamRepository.find({
      where: { userId },
    });

    const otherDeviceStreams = activeStreams.filter(
      (stream) => stream.deviceId !== deviceId,
    );

    if (otherDeviceStreams.length >= this.maxConcurrentStreams) {
      await this.logEvent({
        userId,
        episodeId,
        deviceId,
        eventType: DrmEventType.CONCURRENT_STREAM_BLOCKED,
        ipAddress,
        userAgent,
        wasSuccessful: false,
        reason: `Max ${this.maxConcurrentStreams} concurrent streams exceeded`,
        metadata: {
          activeDevices: otherDeviceStreams.map((s) => s.deviceId),
        },
      });
      return {
        valid: false,
        reason: `Maximum of ${this.maxConcurrentStreams} devices can stream simultaneously`,
      };
    }

    await this.logEvent({
      userId,
      episodeId,
      deviceId,
      eventType: DrmEventType.PLAYBACK_VALIDATED,
      ipAddress,
      userAgent,
      wasSuccessful: true,
    });

    return {
      valid: true,
      sessionToken:
        sessionToken || this.generateSessionToken(userId, episodeId, deviceId),
    };
  }

  /**
   * Record playback start
   */
  async playbackStarted(
    userId: string,
    dto: PlaybackStartedDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; sessionToken: string }> {
    const { episodeId, deviceId, deviceName, devicePlatform, sessionToken } =
      dto;

    // Clean up stale streams
    await this.cleanupStaleStreams();

    // Generate or use provided session token
    const token =
      sessionToken || this.generateSessionToken(userId, episodeId, deviceId);

    // Remove any existing stream for this device
    await this.activeStreamRepository.delete({ userId, deviceId });

    // Create new active stream record
    const activeStream = this.activeStreamRepository.create({
      userId,
      episodeId,
      deviceId,
      deviceName,
      devicePlatform,
      ipAddress,
      sessionToken: token,
      lastHeartbeat: new Date(),
    });

    await this.activeStreamRepository.save(activeStream);

    await this.logEvent({
      userId,
      episodeId,
      deviceId,
      eventType: DrmEventType.PLAYBACK_STARTED,
      ipAddress,
      userAgent,
      wasSuccessful: true,
      metadata: { deviceName, devicePlatform },
    });

    this.logger.log(
      `Playback started: user ${userId}, episode ${episodeId}, device ${deviceId}`,
    );

    return { success: true, sessionToken: token };
  }

  /**
   * Record playback end
   */
  async playbackEnded(
    userId: string,
    dto: PlaybackEndedDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    const { episodeId, deviceId, positionSeconds } = dto;

    // Remove active stream
    await this.activeStreamRepository.delete({ userId, deviceId });

    await this.logEvent({
      userId,
      episodeId,
      deviceId,
      eventType: DrmEventType.PLAYBACK_ENDED,
      ipAddress,
      userAgent,
      wasSuccessful: true,
      metadata: { positionSeconds },
    });

    this.logger.log(`Playback ended: user ${userId}, episode ${episodeId}`);

    return { success: true };
  }

  /**
   * Process heartbeat to keep stream alive
   */
  async heartbeat(
    userId: string,
    dto: HeartbeatDto,
  ): Promise<{ valid: boolean }> {
    const { deviceId, sessionToken, positionSeconds: _positionSeconds } = dto;

    const stream = await this.activeStreamRepository.findOne({
      where: { userId, deviceId, sessionToken },
    });

    if (!stream) {
      return { valid: false };
    }

    // Update last heartbeat
    stream.lastHeartbeat = new Date();
    await this.activeStreamRepository.save(stream);

    return { valid: true };
  }

  /**
   * Get active streams for a user
   */
  async getActiveStreams(userId: string): Promise<ActiveStream[]> {
    await this.cleanupStaleStreams();
    return this.activeStreamRepository.find({
      where: { userId },
      relations: ['episode'],
    });
  }

  /**
   * Force stop a stream on a specific device
   */
  async forceStopStream(
    userId: string,
    deviceId: string,
  ): Promise<{ success: boolean }> {
    await this.activeStreamRepository.delete({ userId, deviceId });
    return { success: true };
  }

  /**
   * Grant a license to a user for an episode
   */
  async grantLicense(
    userId: string,
    episodeId: string,
    licenseType: 'stream' | 'download' | 'offline' = 'stream',
    validityDays?: number,
  ): Promise<DrmLicense> {
    // Check if license already exists
    let license = await this.licenseRepository.findOne({
      where: { userId, episodeId },
    });

    const expiresAt = validityDays
      ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
      : null;

    if (license) {
      // Update existing license
      license.isValid = true;
      license.licenseType = licenseType;
      license.expiresAt = expiresAt;
      license.revokedAt = null;
      license.revocationReason = null;
    } else {
      // Create new license
      license = this.licenseRepository.create({
        userId,
        episodeId,
        licenseType,
        isValid: true,
        expiresAt,
      });
    }

    await this.licenseRepository.save(license);

    await this.logEvent({
      userId,
      episodeId,
      eventType: DrmEventType.LICENSE_GRANTED,
      wasSuccessful: true,
      metadata: { licenseType, validityDays },
    });

    return license;
  }

  /**
   * Revoke a license
   */
  async revokeLicense(
    userId: string,
    episodeId: string,
    reason?: string,
  ): Promise<{ success: boolean }> {
    const license = await this.licenseRepository.findOne({
      where: { userId, episodeId },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    license.isValid = false;
    license.revokedAt = new Date();
    license.revocationReason = reason ?? null;

    await this.licenseRepository.save(license);

    // Also terminate any active streams
    await this.activeStreamRepository.delete({ userId });

    await this.logEvent({
      userId,
      episodeId,
      eventType: DrmEventType.LICENSE_REVOKED,
      wasSuccessful: true,
      reason,
    });

    return { success: true };
  }

  /**
   * Get DRM audit logs for a user
   */
  async getAuditLogs(userId: string, limit = 50): Promise<DrmAuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ==================== Private Helper Methods ====================

  private async ensureLicense(
    userId: string,
    episodeId: string,
    licenseType: 'stream' | 'download' | 'offline',
  ): Promise<DrmLicense> {
    let license = await this.licenseRepository.findOne({
      where: { userId, episodeId, isValid: true },
    });

    if (!license) {
      // Auto-grant license for authenticated users (adjust based on your business logic)
      // In production, you might check subscription status here
      license = await this.grantLicense(userId, episodeId, licenseType);
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      throw new ForbiddenException('License has expired');
    }

    return license;
  }

  private generateSessionToken(
    userId: string,
    episodeId: string,
    deviceId?: string,
  ): string {
    const data = `${userId}:${episodeId}:${deviceId || 'default'}:${Date.now()}`;
    return crypto
      .createHmac('sha256', this.drmSecret)
      .update(data)
      .digest('hex')
      .substring(0, 32);
  }

  private generateSignature(
    originalUrl: string,
    userId: string,
    expiresAt: number,
    sessionToken: string,
  ): string {
    const data = `${originalUrl}|${userId}|${expiresAt}|${sessionToken}`;
    return crypto
      .createHmac('sha256', this.drmSecret)
      .update(data)
      .digest('hex');
  }

  private constructSignedUrl(
    originalUrl: string,
    userId: string,
    expiresAt: number,
    signature: string,
    sessionToken: string,
  ): string {
    const url = new URL(originalUrl);
    url.searchParams.set('userId', userId);
    url.searchParams.set('expires', expiresAt.toString());
    url.searchParams.set('sig', signature);
    url.searchParams.set('token', sessionToken);
    return url.toString();
  }

  private async cleanupStaleStreams(): Promise<void> {
    const timeoutThreshold = new Date(
      Date.now() - this.heartbeatTimeoutMinutes * 60 * 1000,
    );

    await this.activeStreamRepository.delete({
      lastHeartbeat: LessThan(timeoutThreshold),
    });
  }

  private async logEvent(params: {
    userId?: string;
    episodeId?: string;
    deviceId?: string;
    eventType: DrmEventType;
    ipAddress?: string;
    userAgent?: string;
    wasSuccessful: boolean;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const log = this.auditLogRepository.create(params);
      await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.error('Failed to write DRM audit log', error);
    }
  }
}
