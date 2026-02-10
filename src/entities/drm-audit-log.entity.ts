import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { SeriesEpisode } from './series-episode.entity';

export enum DrmEventType {
  URL_SIGNED = 'url_signed',
  PLAYBACK_STARTED = 'playback_started',
  PLAYBACK_ENDED = 'playback_ended',
  PLAYBACK_VALIDATED = 'playback_validated',
  PLAYBACK_REJECTED = 'playback_rejected',
  LICENSE_GRANTED = 'license_granted',
  LICENSE_REVOKED = 'license_revoked',
  CONCURRENT_STREAM_BLOCKED = 'concurrent_stream_blocked',
  DOWNLOAD_AUTHORIZED = 'download_authorized',
  DOWNLOAD_COMPLETED = 'download_completed',
}

@Entity('drm_audit_logs')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class DrmAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', nullable: true })
  userId!: string;

  @Column({ name: 'episode_id', nullable: true })
  episodeId!: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId!: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: DrmEventType,
  })
  eventType!: DrmEventType;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress!: string;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any>;

  @Column({ nullable: true })
  reason!: string;

  @Column({ name: 'was_successful', default: true })
  wasSuccessful!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => SeriesEpisode, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'episode_id' })
  episode!: SeriesEpisode;
}
