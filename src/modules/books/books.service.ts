import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Book, BookChunk, BookProcessingStatus, Series } from '../../entities';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AiService } from '../ai/ai.service';

// Define Multer file type inline to avoid import issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    @InjectRepository(BookChunk)
    private chunkRepository: Repository<BookChunk>,
    @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
    @InjectQueue(QUEUE_NAMES.BOOK_PROCESSING)
    private bookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SERIES_GENERATION)
    private seriesQueue: Queue,
    private aiService: AiService,
  ) {}

  /**
   * Upload a new book
   */
  async uploadBook(
    userId: string,
    file: MulterFile,
    metadata: { title?: string; author?: string },
  ) {
    // Extract title from filename if not provided
    const title = metadata.title || file.originalname.replace(/\.pdf$/i, '');

    const book = this.bookRepository.create({
      title,
      author: metadata.author || 'Unknown',
      originalFilename: file.originalname,
      filePath: file.filename, // Stored in uploads/books/
      fileSize: file.size,
      uploadedById: userId,
      processingStatus: BookProcessingStatus.UPLOADED,
    });

    const savedBook = await this.bookRepository.save(book);
    this.logger.log(`Book uploaded: ${savedBook.id} - ${title}`);

    return {
      id: savedBook.id,
      title: savedBook.title,
      author: savedBook.author,
      status: savedBook.processingStatus,
      message:
        'Book uploaded successfully. Call /books/:id/process to start processing.',
    };
  }

  /**
   * Get all books with optional filtering
   */
  async getBooks(
    _userId: string,
    status?: BookProcessingStatus,
    page: number = 1,
    limit: number = 20,
  ) {
    const queryBuilder = this.bookRepository.createQueryBuilder('book');

    if (status) {
      queryBuilder.where('book.processingStatus = :status', { status });
    }

    const [books, total] = await queryBuilder
      .orderBy('book.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      books: books.map((book) => this.transformBook(book)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single book by ID
   */
  async getBookById(id: string): Promise<Book | null> {
    return this.bookRepository.findOne({
      where: { id },
    });
  }

  /**
   * Get book chunks with pagination
   */
  async getBookChunks(bookId: string, page: number = 1, limit: number = 50) {
    const [chunks, total] = await this.chunkRepository.findAndCount({
      where: { bookId },
      order: { chunkIndex: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
      select: [
        'id',
        'chunkIndex',
        'chapter',
        'tokenCount',
        'pageStart',
        'pageEnd',
        'metadata',
      ],
    });

    return {
      chunks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Start processing a book
   */
  async startProcessing(bookId: string, userId: string) {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Reset processing state if retrying
    book.processingStatus = BookProcessingStatus.UPLOADED;
    book.processingError = undefined as any;
    await this.bookRepository.save(book);

    // Queue the processing job
    const job = await this.bookQueue.add('process-book', {
      bookId,
      userId,
      filePath: book.filePath, // Just the filename, processor adds the directory
    });

    this.logger.log(`Started processing book ${bookId}, job ${job.id}`);

    return {
      bookId,
      jobId: job.id,
      status: 'processing_started',
      message:
        'Book processing has been queued. Check /books/:id/status for progress.',
    };
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(bookId: string) {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Count chunks and embeddings
    const totalChunks = await this.chunkRepository.count({ where: { bookId } });
    const chunksWithEmbeddings = await this.chunkRepository
      .createQueryBuilder('chunk')
      .where('chunk.bookId = :bookId', { bookId })
      .andWhere('chunk.embedding IS NOT NULL')
      .getCount();

    return {
      bookId,
      title: book.title,
      status: book.processingStatus,
      error: book.processingError,
      progress: {
        totalChunks,
        chunksWithEmbeddings,
        embeddingProgress:
          totalChunks > 0
            ? Math.round((chunksWithEmbeddings / totalChunks) * 100)
            : 0,
      },
      stats: {
        wordCount: book.wordCount,
        totalPages: book.totalPages,
        chunkCount: book.chunkCount,
      },
      hasCharacters: (book.extractedCharacters?.length ?? 0) > 0,
      hasStoryStructure: (book.storyStructure?.plotPoints?.length ?? 0) > 0,
    };
  }

  /**
   * Convert book to series
   */
  async convertToSeries(
    bookId: string,
    userId: string,
    episodeCount: number | undefined, // undefined = auto-calculate from book length
    adaptationStyle: 'faithful' | 'enhanced' | 'immersive',
    targetDurationMinutes: number,
  ) {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Check if already converted
    if (book.seriesId) {
      const existingSeries = await this.seriesRepository.findOne({
        where: { id: book.seriesId },
      });
      if (existingSeries) {
        return {
          message: 'Book already converted to series',
          seriesId: existingSeries.id,
          seriesTitle: existingSeries.title,
        };
      }
    }

    // Queue series generation
    const job = await this.seriesQueue.add('create-series-from-book', {
      bookId,
      userId,
      episodeCount,
      adaptationStyle,
      targetDurationMinutes,
    });

    this.logger.log(
      `Queued series generation for book ${bookId}, job ${job.id}`,
    );

    return {
      bookId,
      jobId: job.id,
      status: 'series_generation_started',
      settings: {
        episodeCount,
        adaptationStyle,
        targetDurationMinutes,
      },
      message:
        'Series generation has been queued. Episodes will be created automatically.',
    };
  }

  /**
   * Update book metadata
   */
  async updateBook(
    bookId: string,
    updates: {
      title?: string;
      author?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (updates.title) book.title = updates.title;
    if (updates.author) book.author = updates.author;
    if (updates.metadata) {
      book.metadata = { ...book.metadata, ...updates.metadata };
    }

    await this.bookRepository.save(book);
    return this.transformBook(book);
  }

  /**
   * Delete a book and all related data
   */
  async deleteBook(bookId: string) {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // First, unlink any series that reference this book using raw query
    await this.seriesRepository
      .createQueryBuilder()
      .update()
      .set({ bookId: () => 'NULL', isBookAdaptation: false })
      .where('book_id = :bookId', { bookId })
      .execute();
    this.logger.log(`Unlinked series from book ${bookId}`);

    // Delete chunks
    await this.chunkRepository.delete({ bookId });

    // Delete the file
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(
        process.cwd(),
        'uploads',
        'books',
        book.filePath,
      );
      await fs.unlink(filePath);
    } catch (error: unknown) {
      this.logger.warn(`Could not delete file: ${(error as Error).message}`);
    }

    // Delete the book
    await this.bookRepository.delete(bookId);

    return { success: true, message: 'Book deleted successfully' };
  }

  /**
   * Search chunks using semantic similarity
   */
  async searchChunks(
    bookId: string,
    query: string,
    userId: string,
    limit: number = 10,
  ) {
    // Generate embedding for query
    const queryEmbedding = await this.aiService.generateTextEmbedding(
      userId,
      query,
    );

    // Get all chunks with embeddings
    const chunks = await this.chunkRepository.find({
      where: { bookId },
      order: { chunkIndex: 'ASC' },
    });

    // Calculate similarities and sort
    const scoredChunks = chunks
      .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
      .map((chunk) => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        chapter: chunk.chapter,
        content:
          chunk.content.substring(0, 500) +
          (chunk.content.length > 500 ? '...' : ''),
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        metadata: chunk.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      query,
      results: scoredChunks,
      totalChunksSearched: chunks.filter((c) => c.embedding).length,
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Transform book entity to API response
   */
  private transformBook(book: Book) {
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      originalFilename: book.originalFilename,
      fileSize: book.fileSize,
      processingStatus: book.processingStatus,
      processingError: book.processingError,
      wordCount: book.wordCount,
      totalPages: book.totalPages,
      chunkCount: book.chunkCount,
      metadata: book.metadata,
      extractedCharacters: book.extractedCharacters,
      storyStructure: book.storyStructure,
      seriesId: book.seriesId,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  }
}
