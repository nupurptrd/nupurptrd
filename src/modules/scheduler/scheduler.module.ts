import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import {
  Category,
  NewsArticle,
  NewsBatch,
  Series,
  SeriesEpisode,
  Book,
} from '../../entities';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Category,
      NewsArticle,
      NewsBatch,
      Series,
      SeriesEpisode,
      Book,
    ]),
    forwardRef(() => QueueModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
