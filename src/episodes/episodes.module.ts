import { Module } from '@nestjs/common';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { EpisodeValidatorService } from './services/episode-validator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { BooksModule } from '../books/books.module';
import { SeriesModule } from '../series/series.module';

@Module({
  imports: [PrismaModule, CommonModule, BooksModule, SeriesModule],
  controllers: [EpisodesController],
  providers: [EpisodesService, EpisodeValidatorService],
  exports: [EpisodesService],
})
export class EpisodesModule {}
