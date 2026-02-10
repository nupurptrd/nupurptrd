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
import { BookChunk } from './book-chunk.entity';
import { Series } from './series.entity';

export enum BookProcessingStatus {
  UPLOADED = 'uploaded',
  EXTRACTING_TEXT = 'extracting_text',
  CHUNKING = 'chunking',
  GENERATING_EMBEDDINGS = 'generating_embeddings',
  ANALYZING_CONTENT = 'analyzing_content',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  author!: string;

  @Column({ nullable: true })
  language!: string;

  @Column({ name: 'original_filename', nullable: true })
  originalFilename!: string;

  @Column({ name: 'file_path', nullable: true })
  filePath!: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl!: string;

  @Column({ name: 's3_key', nullable: true })
  s3Key!: string;

  @Column({ name: 'file_size', nullable: true })
  fileSize!: number;

  @Column({ name: 'total_pages', nullable: true })
  totalPages!: number;

  @Column({ name: 'word_count', nullable: true })
  wordCount!: number;

  @Column({ name: 'chunk_count', default: 0 })
  chunkCount!: number;

  @Column({ name: 'total_characters', default: 0 })
  totalCharacters!: number;

  @Column({
    name: 'processing_status',
    type: 'enum',
    enum: BookProcessingStatus,
    default: BookProcessingStatus.UPLOADED,
  })
  processingStatus!: BookProcessingStatus;

  @Column({ name: 'processing_progress', default: 0 })
  processingProgress!: number;

  @Column({ name: 'processing_error', nullable: true, type: 'text' })
  processingError!: string;

  // Extracted metadata from AI analysis
  @Column({ type: 'jsonb', nullable: true })
  metadata!: {
    genre?: string;
    themes?: string[];
    setting?: string;
    timeperiod?: string;
    tone?: string;
    mood?: string;
    targetAudience?: string;
    synopsis?: string;
    chapters?: { title: string; startPage: number; endPage: number }[];
  };

  // Extracted characters from the book
  @Column({ name: 'extracted_characters', type: 'jsonb', nullable: true })
  extractedCharacters!: {
    name: string;
    gender: string;
    role: string;
    description: string;
    firstAppearance?: number;
    traits?: string[];
    voiceDescription?: string;
  }[];

  // Story structure analysis
  @Column({ name: 'story_structure', type: 'jsonb', nullable: true })
  storyStructure!: {
    plotPoints?: string[];
    arcs?: string[];
    climax?: string;
    resolution?: string;
    episodeSuggestions?: string[];
  };

  @Column({ name: 'uploaded_by_id', nullable: true })
  uploadedById!: string;

  @Column({ name: 'series_id', type: 'varchar', nullable: true })
  seriesId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: User;

  @OneToMany(() => BookChunk, (chunk) => chunk.book)
  chunks!: BookChunk[];

  @OneToOne(() => Series, (series) => series.book)
  @JoinColumn({ name: 'series_id' })
  series!: Series;
}
