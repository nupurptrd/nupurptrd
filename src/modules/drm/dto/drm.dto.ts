import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UrlType {
  STREAM = 'stream',
  DOWNLOAD = 'download',
}

export class SignUrlDto {
  @ApiProperty({ description: 'Episode ID to sign URL for' })
  @IsString()
  episodeId!: string;

  @ApiProperty({ enum: UrlType, default: UrlType.STREAM })
  @IsEnum(UrlType)
  @IsOptional()
  type?: UrlType = UrlType.STREAM;

  @ApiPropertyOptional({
    description: 'Validity duration in minutes',
    default: 60,
  })
  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(1440) // Max 24 hours
  validityMinutes?: number = 60;

  @ApiPropertyOptional({ description: 'Device ID for tracking' })
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class ValidatePlaybackDto {
  @ApiProperty({ description: 'Episode ID to validate' })
  @IsString()
  episodeId!: string;

  @ApiProperty({ description: 'Device ID' })
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Session token from signed URL' })
  @IsString()
  @IsOptional()
  sessionToken?: string;
}

export class PlaybackStartedDto {
  @ApiProperty({ description: 'Episode ID' })
  @IsString()
  episodeId!: string;

  @ApiProperty({ description: 'Device ID' })
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Device name for display' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Device platform (ios, android, web)' })
  @IsString()
  @IsOptional()
  devicePlatform?: string;

  @ApiPropertyOptional({ description: 'Session token from signed URL' })
  @IsString()
  @IsOptional()
  sessionToken?: string;
}

export class PlaybackEndedDto {
  @ApiProperty({ description: 'Episode ID' })
  @IsString()
  episodeId!: string;

  @ApiProperty({ description: 'Device ID' })
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Session token' })
  @IsString()
  @IsOptional()
  sessionToken?: string;

  @ApiPropertyOptional({ description: 'Final playback position in seconds' })
  @IsNumber()
  @IsOptional()
  positionSeconds?: number;
}

export class HeartbeatDto {
  @ApiProperty({ description: 'Episode ID' })
  @IsString()
  episodeId!: string;

  @ApiProperty({ description: 'Device ID' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: 'Session token' })
  @IsString()
  sessionToken!: string;

  @ApiPropertyOptional({ description: 'Current playback position' })
  @IsNumber()
  @IsOptional()
  positionSeconds?: number;
}

export class GrantLicenseDto {
  @ApiProperty({ description: 'User ID to grant license to' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Episode ID' })
  @IsString()
  episodeId!: string;

  @ApiPropertyOptional({ description: 'License type' })
  @IsString()
  @IsOptional()
  licenseType?: 'stream' | 'download' | 'offline';

  @ApiPropertyOptional({ description: 'Validity in days' })
  @IsNumber()
  @IsOptional()
  validityDays?: number;
}

export class RevokeLicenseDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Episode ID' })
  @IsString()
  episodeId!: string;

  @ApiPropertyOptional({ description: 'Reason for revocation' })
  @IsString()
  @IsOptional()
  reason?: string;
}
