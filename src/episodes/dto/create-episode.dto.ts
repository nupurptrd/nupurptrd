import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEpisodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  seriesId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  scriptText!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  scenes?: any[];
}
