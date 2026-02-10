import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { SeriesEpisode } from './series-episode.entity';
import { Series } from './series.entity';

@Entity('playback_positions')
@Index(['userId', 'episodeId'], { unique: true })
export class PlaybackPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'episode_id' })
  episodeId!: string;

  @Column({ name: 'series_id' })
  seriesId!: string;

  @Column({ name: 'position_seconds', type: 'int', default: 0 })
  positionSeconds!: number;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number;

  @Column({ name: 'progress_percent', type: 'float', default: 0 })
  progressPercent!: number;

  @Column({ name: 'is_completed', default: false })
  isCompleted!: boolean;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'play_count', type: 'int', default: 1 })
  playCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => SeriesEpisode)
  @JoinColumn({ name: 'episode_id' })
  episode!: SeriesEpisode;

  @ManyToOne(() => Series)
  @JoinColumn({ name: 'series_id' })
  series!: Series;
}
