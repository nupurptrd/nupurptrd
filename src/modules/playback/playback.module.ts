import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { PlaybackPosition } from '../../entities/playback-position.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Series } from '../../entities/series.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaybackPosition, SeriesEpisode, Series]),
  ],
  controllers: [PlaybackController],
  providers: [PlaybackService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
