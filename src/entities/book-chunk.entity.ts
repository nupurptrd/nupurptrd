import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('book_chunks')
@Index('idx_book_chunks_book_id', ['bookId'])
@Index('idx_book_chunks_chunk_index', ['chunkIndex'])
export class BookChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'book_id' })
  bookId!: string;

  @Column({ name: 'chunk_index' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'token_count', nullable: true })
  tokenCount!: number;

  @Column({ name: 'char_count', nullable: true })
  charCount!: number;

  // Vector embedding stored as float array (for pgvector)
  // We'll use a custom type or jsonb for now, upgrade to pgvector later
  @Column({ type: 'jsonb', nullable: true })
  embedding!: number[];

  @Column({ name: 'embedding_model', nullable: true })
  embeddingModel!: string;

  @Column({ name: 'page_start', nullable: true })
  pageStart!: number;

  @Column({ name: 'page_end', nullable: true })
  pageEnd!: number;

  @Column({ nullable: true })
  chapter!: string;

  @Column({ name: 'chapter_index', nullable: true })
  chapterIndex!: number;

  // Content analysis
  @Column({ type: 'jsonb', nullable: true })
  metadata!: {
    hasDialogue?: boolean;
    characters?: string[];
    emotions?: string[];
    sceneType?: string;
    isActionScene?: boolean;
    isClimactic?: boolean;
    narrativeType?:
      | 'exposition'
      | 'dialogue'
      | 'action'
      | 'description'
      | 'mixed';
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Book, (book) => book.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book!: Book;
}
