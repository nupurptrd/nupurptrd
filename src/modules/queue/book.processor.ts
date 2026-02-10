import {
  Process,
  Processor,
  OnQueueProgress,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_NAMES } from './queue.constants';
import { Book, BookChunk, BookProcessingStatus } from '../../entities';
import { AiService } from '../ai/ai.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface BookProcessingJobData {
  bookId: string;
  userId: string;
  filePath: string; // Path to uploaded PDF
}

export interface ChunkEmbeddingJobData {
  bookId: string;
  chunkId: string;
  userId: string;
}

export interface BookAnalysisJobData {
  bookId: string;
  userId: string;
}

// Token estimation: ~4 chars per token for English
const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 1500;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;

@Processor(QUEUE_NAMES.BOOK_PROCESSING)
export class BookProcessor {
  private readonly logger = new Logger(BookProcessor.name);

  constructor(
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    @InjectRepository(BookChunk)
    private chunkRepository: Repository<BookChunk>,
    @InjectQueue(QUEUE_NAMES.BOOK_PROCESSING)
    private bookQueue: Queue,
    private aiService: AiService,
  ) {}

  @OnQueueProgress()
  onProgress(job: Job, progress: number) {
    this.logger.log(`Book processing job ${job.id} is ${progress}% done`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Book processing job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Main book processing pipeline:
   * 1. Extract text from PDF
   * 2. Create intelligent chunks
   * 3. Queue embedding generation
   * 4. Analyze content for characters and structure
   */
  @Process('process-book')
  async handleProcessBook(job: Job<BookProcessingJobData>) {
    const { bookId, userId, filePath } = job.data;
    this.logger.log(`Starting book processing for ${bookId}`);

    try {
      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (!book) {
        throw new Error('Book not found');
      }

      // Step 1: Extract text from PDF
      book.processingStatus = BookProcessingStatus.EXTRACTING_TEXT;
      await this.bookRepository.save(book);
      await job.progress(10);

      const pdfBuffer = await this.loadPdfFile(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      const fullText = pdfData.text;

      // Update book with basic metadata
      book.totalPages = pdfData.numpages;
      book.wordCount = fullText.split(/\s+/).length;
      await this.bookRepository.save(book);
      await job.progress(25);

      // Step 2: Create intelligent chunks
      book.processingStatus = BookProcessingStatus.CHUNKING;
      await this.bookRepository.save(book);

      const chunks = this.createIntelligentChunks(fullText);
      this.logger.log(`Created ${chunks.length} chunks from book`);

      // Save chunks to database
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const bookChunk = new BookChunk();
        bookChunk.bookId = bookId;
        bookChunk.content = chunk.content;
        bookChunk.chunkIndex = i;
        bookChunk.tokenCount = Math.ceil(
          chunk.content.length / CHARS_PER_TOKEN,
        );
        bookChunk.charCount = chunk.content.length;
        if (chunk.chapter) bookChunk.chapter = chunk.chapter;
        if (chunk.pageStart !== undefined)
          bookChunk.pageStart = chunk.pageStart;
        if (chunk.pageEnd !== undefined) bookChunk.pageEnd = chunk.pageEnd;
        bookChunk.metadata = {
          hasDialogue: this.hasDialogue(chunk.content),
          sceneType: this.detectSceneType(chunk.content),
          narrativeType: this.detectNarrativeType(chunk.content) as any,
        };
        await this.chunkRepository.save(bookChunk);
      }

      book.chunkCount = chunks.length;
      await this.bookRepository.save(book);
      await job.progress(50);

      // Step 3: Queue embedding generation for each chunk
      book.processingStatus = BookProcessingStatus.GENERATING_EMBEDDINGS;
      await this.bookRepository.save(book);

      const savedChunks = await this.chunkRepository.find({
        where: { bookId },
        order: { chunkIndex: 'ASC' },
      });

      for (const chunk of savedChunks) {
        await this.bookQueue.add('generate-chunk-embedding', {
          bookId,
          chunkId: chunk.id,
          userId,
        } as ChunkEmbeddingJobData);
      }

      await job.progress(60);

      // Step 4: Queue content analysis (after embeddings start)
      await this.bookQueue.add(
        'analyze-book-content',
        {
          bookId,
          userId,
        } as BookAnalysisJobData,
        {
          delay: 5000, // Give embeddings a head start
        },
      );

      return { success: true, chunksCreated: chunks.length };
    } catch (error: unknown) {
      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (book) {
        book.processingStatus = BookProcessingStatus.FAILED;
        book.processingError = (error as Error).message;
        await this.bookRepository.save(book);
      }
      throw error;
    }
  }

  /**
   * Generate embedding for a single chunk
   */
  @Process('generate-chunk-embedding')
  async handleChunkEmbedding(job: Job<ChunkEmbeddingJobData>) {
    const { bookId, chunkId, userId } = job.data;
    this.logger.log(`Generating embedding for chunk ${chunkId}`);

    try {
      const chunk = await this.chunkRepository.findOne({
        where: { id: chunkId },
      });
      if (!chunk) {
        throw new Error('Chunk not found');
      }

      // Generate embedding using AI service
      const embedding = await this.aiService.generateTextEmbedding(
        userId,
        chunk.content,
      );

      chunk.embedding = embedding;
      await this.chunkRepository.save(chunk);

      // Check if all chunks have embeddings
      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (book) {
        const totalChunks = await this.chunkRepository.count({
          where: { bookId },
        });
        const chunksWithEmbeddings = await this.chunkRepository
          .createQueryBuilder('chunk')
          .where('chunk.bookId = :bookId', { bookId })
          .andWhere('chunk.embedding IS NOT NULL')
          .getCount();

        if (chunksWithEmbeddings >= totalChunks) {
          book.processingStatus = BookProcessingStatus.ANALYZING_CONTENT;
          await this.bookRepository.save(book);
        }
      }

      return { success: true, chunkId };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate embedding for chunk ${chunkId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Analyze book content to extract characters, themes, and story structure
   */
  @Process('analyze-book-content')
  async handleBookAnalysis(job: Job<BookAnalysisJobData>) {
    const { bookId, userId } = job.data;
    this.logger.log(`Analyzing content for book ${bookId}`);

    try {
      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (!book) {
        throw new Error('Book not found');
      }

      // Get all chunks for analysis
      const chunks = await this.chunkRepository.find({
        where: { bookId },
        order: { chunkIndex: 'ASC' },
        take: 20, // Use first 20 chunks for initial analysis (covers most books' setup)
      });

      // Concatenate sample text for analysis
      const sampleText = chunks
        .map((c) => c.content)
        .join('\n\n---\n\n')
        .substring(0, 50000);

      // Use AI to analyze the book
      const analysis = await this.aiService.analyzeBookContent(
        userId,
        book.title,
        sampleText,
      );

      // Update book with analysis results
      book.metadata = {
        ...book.metadata,
        genre: analysis.genre,
        themes: analysis.themes,
        setting: analysis.setting,
        synopsis: analysis.synopsis,
        mood: analysis.mood,
        targetAudience: analysis.targetAudience,
      };

      book.extractedCharacters = analysis.characters.map((char) => ({
        name: char.name,
        gender: char.gender || 'unknown',
        role: char.role,
        description: char.description,
        traits: char.traits || [],
        voiceDescription: char.voiceDescription,
      }));

      book.storyStructure = {
        plotPoints: analysis.plotPoints || [],
        arcs: analysis.arcs || [],
        climax: analysis.climax,
        resolution: analysis.resolution,
        episodeSuggestions: analysis.episodeSuggestions || [],
      };

      book.processingStatus = BookProcessingStatus.READY;
      await this.bookRepository.save(book);

      this.logger.log(`Book analysis complete for ${bookId}`);

      return {
        success: true,
        characters: book.extractedCharacters.length,
        plotPoints: book.storyStructure.plotPoints?.length || 0,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to analyze book ${bookId}: ${(error as Error).message}`,
      );

      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (book) {
        book.processingStatus = BookProcessingStatus.FAILED;
        book.processingError = (error as Error).message;
        await this.bookRepository.save(book);
      }

      throw error;
    }
  }

  /**
   * Load PDF file from storage
   */
  private async loadPdfFile(filePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Check if it's a URL (S3) or local path
    if (filePath.startsWith('http')) {
      const axios = (await import('axios')).default;
      const response = await axios.get(filePath, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } else {
      // Local file - stored in uploads/books/ directory
      const fullPath = path.join(process.cwd(), 'uploads', 'books', filePath);
      return fs.readFile(fullPath);
    }
  }

  /**
   * Create intelligent chunks that respect paragraph and chapter boundaries
   */
  private createIntelligentChunks(text: string): Array<{
    content: string;
    chapter?: string;
    pageStart?: number;
    pageEnd?: number;
  }> {
    const chunks: Array<{
      content: string;
      chapter?: string;
      pageStart?: number;
      pageEnd?: number;
    }> = [];

    // Split by chapter markers first
    const chapterPatterns = [
      /^Chapter\s+\d+/im,
      /^CHAPTER\s+\d+/m,
      /^Part\s+\d+/im,
      /^PART\s+\d+/m,
      /^\d+\.\s+[A-Z]/m,
    ];

    let currentChapter = 'Introduction';
    let currentContent = '';

    // Split text into paragraphs
    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      // Check if this is a chapter heading
      const isChapterHeading = chapterPatterns.some((p) => p.test(trimmed));
      if (isChapterHeading && trimmed.length < 100) {
        // Save current chunk if it has content
        if (currentContent.length > 200) {
          chunks.push({
            content: currentContent.trim(),
            chapter: currentChapter,
          });
        }
        currentChapter = trimmed;
        currentContent = '';
        continue;
      }

      // Add paragraph to current chunk
      const potentialContent = currentContent + '\n\n' + trimmed;

      // If adding this paragraph exceeds target size, save current chunk
      if (
        potentialContent.length > TARGET_CHUNK_CHARS &&
        currentContent.length > 500
      ) {
        chunks.push({
          content: currentContent.trim(),
          chapter: currentChapter,
        });
        currentContent = trimmed;
      } else {
        currentContent = potentialContent;
      }
    }

    // Don't forget the last chunk
    if (currentContent.length > 100) {
      chunks.push({
        content: currentContent.trim(),
        chapter: currentChapter,
      });
    }

    return chunks;
  }

  /**
   * Detect if chunk contains dialogue
   */
  private hasDialogue(text: string): boolean {
    // Look for quoted speech patterns
    const dialoguePatterns = [
      /"[^"]+"/, // Double quotes
      /'[^']+'/, // Single quotes
      /said\s+\w+/i,
      /asked\s+\w+/i,
      /replied\s+\w+/i,
      /whispered\s+\w+/i,
      /shouted\s+\w+/i,
    ];
    return dialoguePatterns.some((p) => p.test(text));
  }

  /**
   * Detect scene type from content
   */
  private detectSceneType(text: string): string {
    const lower = text.toLowerCase();

    if (
      lower.includes('fight') ||
      lower.includes('battle') ||
      lower.includes('attack')
    ) {
      return 'action';
    }
    if (
      lower.includes('love') ||
      lower.includes('kiss') ||
      lower.includes('heart')
    ) {
      return 'romantic';
    }
    if (
      lower.includes('mystery') ||
      lower.includes('clue') ||
      lower.includes('discover')
    ) {
      return 'mystery';
    }
    if (
      lower.includes('tense') ||
      lower.includes('fear') ||
      lower.includes('danger')
    ) {
      return 'suspense';
    }
    if (
      lower.includes('laugh') ||
      lower.includes('joke') ||
      lower.includes('funny')
    ) {
      return 'comedy';
    }
    return 'general';
  }

  /**
   * Detect narrative type
   */
  private detectNarrativeType(text: string): string {
    // Check for first person
    if (/\bI\s+(was|am|had|have|went|said|thought|felt)\b/i.test(text)) {
      return 'first-person';
    }
    // Check for dialogue-heavy
    const dialogueMatches = text.match(/["'][^"']+["']/g) || [];
    if (dialogueMatches.length > 3) {
      return 'dialogue-heavy';
    }
    // Default to third person narrative
    return 'third-person';
  }
}
