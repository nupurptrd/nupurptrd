import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Category } from './category.entity';
import { NewsBatch } from './news-batch.entity';

export enum ArticleType {
  HIGHLIGHT = 'highlight',
  DETAILED = 'detailed',
}

@Entity('news_articles')
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId!: string;

  @Column({ name: 'batch_id', nullable: true })
  batchId!: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true, type: 'text' })
  summary!: string;

  @Column()
  language!: string;

  @Column({ name: 'article_type', nullable: true, default: 'detailed' })
  articleType!: string; // 'highlight' or 'detailed'

  @Column({ name: 'is_highlight', default: false })
  isHighlight!: boolean;

  @Column({ name: 'highlight_order', nullable: true })
  highlightOrder!: number;

  @Column({ name: 'locality_focus', nullable: true })
  localityFocus!: string;

  @Column({ type: 'text', array: true, nullable: true })
  tags!: string[];

  @Column({ name: 'emotion_tags', type: 'text', array: true, nullable: true })
  emotionTags!: string[];

  @Column({ name: 'suggested_emotion', nullable: true })
  suggestedEmotion!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ name: 'formatted_script', nullable: true, type: 'text' })
  formattedScript!: string;

  @Column({ name: 'voice_id', nullable: true })
  voiceId!: string;

  @Column({ name: 'voice_name', nullable: true })
  voiceName!: string;

  @Column({ name: 'voice_settings', type: 'jsonb', nullable: true })
  voiceSettings!: Record<string, any>;

  @Column({ name: 'audio_url', nullable: true })
  audioUrl!: string;

  @Column({ name: 's3_key', nullable: true })
  s3Key!: string;

  @Column({ name: 'audio_duration_seconds', nullable: true })
  audioDurationSeconds!: number;

  @Column({ nullable: true, default: 'draft' })
  status!: string;

  @Column({ name: 'generated_at', nullable: true })
  generatedAt!: Date;

  @Column({ name: 'published_at', nullable: true })
  publishedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Category, (category) => category.articles)
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @ManyToOne(() => NewsBatch, (batch) => batch.articles)
  @JoinColumn({ name: 'batch_id' })
  batch!: NewsBatch;

  @ManyToOne(() => NewsArticle, (article) => article.detailedVersions)
  @JoinColumn({ name: 'parent_id' })
  parent!: NewsArticle;

  @OneToMany(() => NewsArticle, (article) => article.parent)
  detailedVersions!: NewsArticle[];
}
