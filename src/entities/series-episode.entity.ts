import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Series } from './series.entity';
import { EpisodeStatus } from '../common/enums';

@Entity('series_episodes')
export class SeriesEpisode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'series_id' })
  seriesId!: string;

  @Column({ name: 'episode_number' })
  episodeNumber!: number;

  @Column()
  title!: string;

  @Column({ nullable: true, type: 'text' })
  synopsis!: string;

  @Column({ name: 'generation_prompt', nullable: true, type: 'text' })
  generationPrompt!: string;

  @Column({ name: 'full_script', nullable: true, type: 'text' })
  fullScript!: string;

  @Column({ name: 'formatted_audio_script', nullable: true, type: 'text' })
  formattedAudioScript!: string;

  @Column({ name: 'audio_url', nullable: true })
  audioUrl!: string;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds!: number;

  @Column({
    type: 'enum',
    enum: EpisodeStatus,
    default: EpisodeStatus.OUTLINE,
    nullable: true,
  })
  status!: EpisodeStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Series, (series) => series.episodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series!: Series;
}
