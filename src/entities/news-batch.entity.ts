import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { NewsArticle } from './news-article.entity';
import { User } from './user.entity';

export enum NewsBatchStatus {
  PENDING = 'pending',
  GENERATING_HIGHLIGHTS = 'generating_highlights',
  HIGHLIGHTS_COMPLETE = 'highlights_complete',
  GENERATING_DETAILED = 'generating_detailed',
  DETAILED_COMPLETE = 'detailed_complete',
  GENERATING_AUDIO = 'generating_audio',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

@Entity('news_batches')
export class NewsBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId!: string;

  @Column()
  language!: string;

  @Column({ name: 'locality_focus', nullable: true })
  localityFocus!: string;

  @Column({
    type: 'enum',
    enum: NewsBatchStatus,
    default: NewsBatchStatus.PENDING,
  })
  status!: NewsBatchStatus;

  @Column({ name: 'highlights_count', default: 0 })
  highlightsCount!: number;

  @Column({ name: 'detailed_count', default: 0 })
  detailedCount!: number;

  @Column({ name: 'audio_generated_count', default: 0 })
  audioGeneratedCount!: number;

  @Column({ name: 'total_expected', default: 15 })
  totalExpected!: number;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage!: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt!: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @OneToMany(() => NewsArticle, (article) => article.batch)
  articles!: NewsArticle[];
}
