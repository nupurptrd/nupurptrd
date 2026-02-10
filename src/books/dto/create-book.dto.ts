import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty({ example: 'Moby Dick' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Herman Melville' })
  @IsString()
  @IsNotEmpty()
  author!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  language: string = 'en';

  @ApiProperty({ example: 'Classic Fiction' })
  @IsString()
  @IsNotEmpty()
  genre!: string;

  @ApiProperty({ example: 'Call me Ishmael...' })
  @IsString()
  @IsNotEmpty()
  @MinLength(100)
  contentText!: string;
}
