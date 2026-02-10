import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateEpisodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  seriesId!: string;

  @ApiPropertyOptional({ description: 'If omitted, next episode number is used' })
  @IsOptional()
  @IsInt()
  @Min(1)
  episodeNumber?: number;
}
