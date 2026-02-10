import { IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSeriesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bookId!: string;

  @ApiProperty({ example: 'Season 1: The Beginning' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 20, description: 'Target number of episodes' })
  @Min(1)
  targetEpisodeCount!: number;
}
