import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SeriesCharacter } from './series-character.entity';
import { SeriesEpisode } from './series-episode.entity';
import { Book } from './book.entity';
import { SeriesStatus } from '../common/enums';

@Entity('series')
export class Series {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  logline!: string;

  @Column({ nullable: true, type: 'text' })
  abstract!: string;

  @Column({ name: 'world_setting', nullable: true, type: 'text' })
  worldSetting!: string;

  @Column({ type: 'text', array: true, nullable: true })
  themes!: string[];

  @Column({ nullable: true })
  format!: string;

  @Column({ name: 'primary_genre', nullable: true })
  primaryGenre!: string;

  @Column({ name: 'secondary_genre', nullable: true })
  secondaryGenre!: string;

  @Column({ nullable: true })
  language!: string;

  @Column({ nullable: true })
  comps!: string;

  @Column({ name: 'episode_count', nullable: true })
  episodeCount!: number;

  @Column({ name: 'episode_duration_minutes', nullable: true })
  episodeDurationMinutes!: number;

  @Column({ name: 'pilot_synopsis', nullable: true, type: 'text' })
  pilotSynopsis!: string;

  @Column({ name: 'season_arc', nullable: true, type: 'text' })
  seasonArc!: string;

  @Column({ name: 'visual_style', nullable: true, type: 'text' })
  visualStyle!: string;

  @Column({ name: 'music_soundscape', nullable: true, type: 'text' })
  musicSoundscape!: string;

  @Column({ name: 'central_mystery', nullable: true, type: 'text' })
  centralMystery!: string;

  @Column({ name: 'future_seasons', nullable: true, type: 'text' })
  futureSeasons!: string;

  // Book adaptation fields
  @Column({ name: 'book_id', nullable: true })
  bookId!: string;

  @Column({ name: 'is_book_adaptation', default: false })
  isBookAdaptation!: boolean;

  @Column({ name: 'adaptation_style', nullable: true })
  adaptationStyle!: string; // 'faithful', 'creative', 'dramatized'

  @Column({ name: 'total_episodes', default: 0 })
  totalEpisodes!: number;

  @Column({ name: 'episodes_generated', default: 0 })
  episodesGenerated!: number;

  @Column({ name: 'generation_progress', default: 0 })
  generationProgress!: number;

  @Column({
    type: 'enum',
    enum: SeriesStatus,
    default: SeriesStatus.DRAFT,
    nullable: true,
  })
  status!: SeriesStatus;

  @Column({ name: 'created_by' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.series)
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @OneToOne(() => Book, (book) => book.series)
  @JoinColumn({ name: 'book_id' })
  book!: Book;

  @OneToMany(() => SeriesCharacter, (character) => character.series)
  characters!: SeriesCharacter[];

  @OneToMany(() => SeriesEpisode, (episode) => episode.series)
  episodes!: SeriesEpisode[];
}
