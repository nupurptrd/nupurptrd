import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SeriesStatus,
  CharacterRoleType,
  EpisodeStatus,
} from '../../../common/enums';

export class CreateSeriesDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  logline?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  abstract?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  worldSetting?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  themes?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  primaryGenre?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  secondaryGenre?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  episodeCount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  episodeDurationMinutes?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pilotSynopsis?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  seasonArc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  visualStyle?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  musicSoundscape?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  centralMystery?: string;

  @ApiProperty({ required: false })
  @IsEnum(SeriesStatus)
  @IsOptional()
  status?: SeriesStatus;
}

export class UpdateSeriesDto extends CreateSeriesDto {}

export class CreateCharacterDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  age?: string;

  @ApiProperty({ required: false })
  @IsEnum(CharacterRoleType)
  @IsOptional()
  roleType?: CharacterRoleType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  publicMask?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  internalReality?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fatalFlaw?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  characterArc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  backstory?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  voiceId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  voiceName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  voiceSettings?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateCharacterDto extends CreateCharacterDto {}

export class CreateEpisodeDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsNumber()
  episodeNumber!: number;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  synopsis?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  generationPrompt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullScript?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  formattedAudioScript?: string;

  @ApiProperty({ required: false })
  @IsEnum(EpisodeStatus)
  @IsOptional()
  status?: EpisodeStatus;
}

export class UpdateEpisodeDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  episodeNumber?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  synopsis?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  generationPrompt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullScript?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  formattedAudioScript?: string;

  @ApiProperty({ required: false })
  @IsEnum(EpisodeStatus)
  @IsOptional()
  status?: EpisodeStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  durationSeconds?: number;
}
