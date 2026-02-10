import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SeriesModule } from '../series/series.module';

@Module({
  imports: [SeriesModule],
  controllers: [HealthController],
})
export class HealthModule {}