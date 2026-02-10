import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from '../../entities/bookmark.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bookmark, SeriesEpisode])],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
