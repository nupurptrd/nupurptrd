import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { NewsArticle } from '../../entities/news-article.entity';
import { Category } from '../../entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewsArticle, Category])],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
