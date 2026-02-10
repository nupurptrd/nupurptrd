import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrmController } from './drm.controller';
import { DrmService } from './drm.service';
import { DrmLicense } from '../../entities/drm-license.entity';
import { ActiveStream } from '../../entities/active-stream.entity';
import { DrmAuditLog } from '../../entities/drm-audit-log.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DrmLicense,
      ActiveStream,
      DrmAuditLog,
      SeriesEpisode,
      User,
    ]),
  ],
  controllers: [DrmController],
  providers: [DrmService],
  exports: [DrmService],
})
export class DrmModule {}
