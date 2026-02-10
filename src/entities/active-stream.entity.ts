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

@Entity('active_streams')
@Index(['userId', 'deviceId'], { unique: true })
export class ActiveStream {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'episode_id' })
  episodeId!: string;

  @Column({ name: 'device_id' })
  deviceId!: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName!: string;

  @Column({ name: 'device_platform', nullable: true })
  devicePlatform!: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress!: string;

  @Column({ name: 'session_token', unique: true })
  sessionToken!: string;

  @Column({ name: 'last_heartbeat' })
  lastHeartbeat!: Date;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => SeriesEpisode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'episode_id' })
  episode!: SeriesEpisode;
}
