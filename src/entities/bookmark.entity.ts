import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Series } from './series.entity';
import { SeriesEpisode } from './series-episode.entity';

@Entity('bookmarks')
@Unique(['userId', 'episodeId', 'positionSeconds']) // Prevent duplicate bookmarks at same position
@Index(['userId', 'seriesId'])
@Index(['userId', 'episodeId'])
export class Bookmark {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'series_id' })
  seriesId!: string;

  @Column({ name: 'episode_id' })
  episodeId!: string;

  @Column({ name: 'position_seconds', type: 'int' })
  positionSeconds!: number;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number;

  @Column({ type: 'text', nullable: true })
  note!: string;

  @Column({ type: 'text', nullable: true })
  title!: string; // Optional custom title for the bookmark

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Series, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series!: Series;

  @ManyToOne(() => SeriesEpisode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'episode_id' })
  episode!: SeriesEpisode;
}
