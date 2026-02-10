import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';
import { Series } from '../../entities/series.entity';
import { SeriesCharacter } from '../../entities/series-character.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Book } from '../../entities/book.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Series, SeriesCharacter, SeriesEpisode, Book]),
  ],
  controllers: [SeriesController],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
