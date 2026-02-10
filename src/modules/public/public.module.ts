import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { SeriesModule } from '../series/series.module';
import { CategoriesModule } from '../categories/categories.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [SeriesModule, CategoriesModule, NewsModule],
  controllers: [PublicController],
})
export class PublicModule {}
