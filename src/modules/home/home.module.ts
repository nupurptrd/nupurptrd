import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { PlaybackModule } from '../playback/playback.module';
import { CategoriesModule } from '../categories/categories.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [PlaybackModule, CategoriesModule, NewsModule],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
