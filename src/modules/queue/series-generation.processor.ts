import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import type { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_NAMES } from './queue.constants';
import {
  Book,
  BookChunk,
  Series,
  SeriesEpisode,
  SeriesCharacter,
} from '../../entities';
import {
  EpisodeStatus,
  SeriesStatus,
  CharacterRoleType,
} from '../../common/enums';
import { AiService } from '../ai/ai.service';

export interface SeriesFromBookJobData {
  bookId: string;
  userId: string;
  episodeCount?: number; // Optional - will auto-calculate if not provided
  adaptationStyle: 'faithful' | 'enhanced' | 'immersive';
  targetDurationMinutes: number; // ~5 minutes per episode for audiobook
}

export interface EpisodeGenerationJobData {
  seriesId: string;
  bookId: string;
  userId: string;
  episodeNumber: number;
  synopsis: string;
  chunkIds: string[]; // Relevant chunks for this episode
}

// Target episode length for ~5 minute audiobook episodes
// At 150 wpm narration pace, 750 words = 5 minutes
const WORDS_PER_MINUTE_NARRATION = 150;

@Processor(QUEUE_NAMES.SERIES_GENERATION)
export class SeriesGenerationProcessor {
  private readonly logger = new Logger(SeriesGenerationProcessor.name);

  constructor(
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    @InjectRepository(BookChunk)
    private chunkRepository: Repository<BookChunk>,
    @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
    @InjectRepository(SeriesCharacter)
    private characterRepository: Repository<SeriesCharacter>,
    @InjectQueue(QUEUE_NAMES.SERIES_GENERATION)
    private seriesQueue: Queue,
    private aiService: AiService,
  ) {}

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Series generation job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Create a series from a processed book
   * This is the main entry point for book-to-series conversion
   */
  @Process('create-series-from-book')
  async handleCreateSeriesFromBook(job: Job<SeriesFromBookJobData>) {
    const {
      bookId,
      userId,
      episodeCount: requestedEpisodeCount,
      adaptationStyle,
      targetDurationMinutes,
    } = job.data;

    try {
      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (!book) {
        throw new Error('Book not found');
      }

      if (book.processingStatus !== 'ready') {
        throw new Error('Book is not fully processed yet');
      }

      // Use the userId from job data, or fall back to the book uploader
      const creatorId = userId || book.uploadedById;
      if (!creatorId) {
        throw new Error('No valid user ID available for series creation');
      }

      // Auto-calculate episode count based on book word count if not provided
      const calculatedEpisodeCount = await this.calculateEpisodeCount(
        bookId,
        targetDurationMinutes,
      );
      const episodeCount = requestedEpisodeCount || calculatedEpisodeCount;

      this.logger.log(
        `Creating audiobook series from "${book.title}" with ${episodeCount} episodes (~${targetDurationMinutes} min each)`,
      );

      // Create the series - Audiobook style naming
      const series = new Series();
      series.title = `${book.title} - Audiobook`;
      series.abstract =
        book.metadata?.synopsis ||
        `An audiobook adaptation of "${book.title}" by ${book.author}. Listen to the complete story across ${episodeCount} episodes.`;
      series.language = 'English';
      series.primaryGenre = book.metadata?.genre || 'Fiction';
      series.worldSetting = book.metadata?.setting || 'Contemporary';
      series.logline = this.generateStoryHook(book);
      series.status = SeriesStatus.DRAFT;
      series.isBookAdaptation = true;
      series.bookId = book.id;
      series.adaptationStyle = adaptationStyle;
      series.totalEpisodes = episodeCount;
      series.episodesGenerated = 0;
      series.generationProgress = 0;
      series.createdById = creatorId;
      const savedSeries = await this.seriesRepository.save(series);

      // Create characters from extracted book characters
      if (book.extractedCharacters && book.extractedCharacters.length > 0) {
        for (const char of book.extractedCharacters) {
          const character = new SeriesCharacter();
          character.seriesId = savedSeries.id;
          character.name = char.name;
          character.roleType =
            char.role === 'protagonist'
              ? CharacterRoleType.PROTAGONIST
              : char.role === 'antagonist'
                ? CharacterRoleType.ANTAGONIST
                : CharacterRoleType.SUPPORTING;
          character.backstory = char.description;
          character.publicMask = char.traits?.slice(0, 2).join(', ') || '';
          character.internalReality = char.voiceDescription || '';
          character.sortOrder = book.extractedCharacters.indexOf(char);
          await this.characterRepository.save(character);
        }
      }

      // Plan episode distribution based on story structure
      const episodePlan = await this.planEpisodes(
        book,
        episodeCount,
        adaptationStyle,
      );

      // Queue generation for each episode
      for (let i = 0; i < episodePlan.length; i++) {
        const plan = episodePlan[i];
        await this.seriesQueue.add(
          'generate-episode-from-book',
          {
            seriesId: savedSeries.id,
            bookId,
            userId,
            episodeNumber: i + 1,
            synopsis: plan.synopsis,
            chunkIds: plan.chunkIds,
          } as EpisodeGenerationJobData,
          {
            delay: 3000 * i, // Stagger to avoid rate limits
          },
        );
      }

      // Update book with series reference
      book.seriesId = savedSeries.id;
      await this.bookRepository.save(book);

      return {
        success: true,
        seriesId: savedSeries.id,
        episodesPlanned: episodePlan.length,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create series from book ${bookId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Generate a single episode from book content
   */
  @Process('generate-episode-from-book')
  async handleGenerateEpisode(job: Job<EpisodeGenerationJobData>) {
    const { seriesId, bookId, userId, episodeNumber, synopsis, chunkIds } =
      job.data;
    this.logger.log(
      `Generating episode ${episodeNumber} for series ${seriesId}`,
    );

    try {
      const series = await this.seriesRepository.findOne({
        where: { id: seriesId },
        relations: ['characters'],
      });
      if (!series) {
        throw new Error('Series not found');
      }

      const book = await this.bookRepository.findOne({ where: { id: bookId } });
      if (!book) {
        throw new Error('Book not found');
      }

      // Get relevant chunks for this episode
      const chunks =
        chunkIds.length > 0
          ? await this.chunkRepository.find({
              where: { id: In(chunkIds) },
            })
          : [];

      // If no specific chunks, use semantic search to find relevant content
      let relevantContent: string;
      if (chunks.length === 0) {
        relevantContent = await this.findRelevantContent(
          bookId,
          synopsis,
          userId,
        );
      } else {
        relevantContent = chunks.map((c) => c.content).join('\n\n');
      }

      // Get characters for the series
      const characters = await this.characterRepository.find({
        where: { seriesId },
        order: { sortOrder: 'ASC' },
      });

      // Generate the episode script using AI
      const episodeScript = await this.aiService.generateBookEpisodeScript(
        userId,
        {
          bookTitle: book.title,
          seriesTitle: series.title,
          episodeNumber,
          totalEpisodes: series.totalEpisodes,
          synopsis,
          relevantContent,
          characters: characters.map((c) => ({
            name: c.name,
            role: c.roleType,
            description: c.backstory,
          })),
          adaptationStyle: series.adaptationStyle as
            | 'faithful'
            | 'enhanced'
            | 'immersive',
          previousEpisodeSummary:
            (await this.getPreviousEpisodeSummary(seriesId, episodeNumber)) ||
            undefined,
          isFirstEpisode: episodeNumber === 1,
          isFinalEpisode: episodeNumber === series.totalEpisodes,
        },
      );

      // Create the episode
      const episode = new SeriesEpisode();
      episode.seriesId = seriesId;
      episode.episodeNumber = episodeNumber;
      episode.title = episodeScript.title;
      episode.synopsis = episodeScript.synopsis;
      episode.fullScript = episodeScript.fullScript;
      episode.formattedAudioScript = episodeScript.fullScript;
      episode.durationSeconds = episodeScript.estimatedDuration;
      episode.status = EpisodeStatus.DRAFT;
      const savedEpisode = await this.episodeRepository.save(episode);

      // Update series progress
      series.episodesGenerated = (series.episodesGenerated || 0) + 1;
      series.generationProgress = Math.round(
        (series.episodesGenerated / series.totalEpisodes) * 100,
      );
      if (series.episodesGenerated >= series.totalEpisodes) {
        series.status = SeriesStatus.COMPLETE;
      }
      await this.seriesRepository.save(series);

      // Optionally queue audio generation
      // Commented out - let user trigger audio generation manually
      // await this.audioQueue.add('generate-episode-audio', {
      //   episodeId: savedEpisode.id,
      //   seriesId,
      //   userId,
      // });

      return {
        success: true,
        episodeId: savedEpisode.id,
        title: episodeScript.title,
        progress: series.generationProgress,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate episode ${episodeNumber}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Calculate the optimal number of episodes based on book word count
   * Targets ~5 minute episodes (750 words at 150 wpm narration pace)
   */
  private async calculateEpisodeCount(
    bookId: string,
    targetDurationMinutes: number,
  ): Promise<number> {
    const chunks = await this.chunkRepository.find({
      where: { bookId },
      select: ['content'],
    });

    // Calculate total word count from all chunks
    const totalWords = chunks.reduce((sum, chunk) => {
      return sum + (chunk.content?.split(/\s+/).length || 0);
    }, 0);

    // Calculate words per episode based on target duration
    const wordsPerEpisode = targetDurationMinutes * WORDS_PER_MINUTE_NARRATION;

    // Calculate episode count (minimum 5, maximum 300)
    let episodeCount = Math.ceil(totalWords / wordsPerEpisode);
    episodeCount = Math.max(5, Math.min(300, episodeCount));

    this.logger.log(
      `Book has ~${totalWords} words, calculated ${episodeCount} episodes at ${targetDurationMinutes} min each`,
    );
    return episodeCount;
  }

  /**
   * Generate a compelling story hook from book content
   */
  private generateStoryHook(book: Book): string {
    const plotPoints = book.storyStructure?.plotPoints;
    if (plotPoints && plotPoints.length > 0) {
      return plotPoints[0];
    }
    if (book.metadata?.synopsis) {
      // Take first sentence
      const firstSentence = book.metadata.synopsis.split('.')[0];
      return firstSentence + '...';
    }
    return `Discover the captivating world of "${book.title}"`;
  }

  /**
   * Plan how to distribute book content across episodes
   * For audiobook style - natural chapter breaks, no artificial cliffhangers
   */
  private async planEpisodes(
    book: Book,
    episodeCount: number,
    style: string,
  ): Promise<Array<{ synopsis: string; chunkIds: string[] }>> {
    const chunks = await this.chunkRepository.find({
      where: { bookId: book.id },
      order: { chunkIndex: 'ASC' },
    });

    const plan: Array<{ synopsis: string; chunkIds: string[] }> = [];
    const chunksPerEpisode = Math.ceil(chunks.length / episodeCount);

    // Use story structure if available
    const plotPoints = book.storyStructure?.plotPoints || [];
    const episodeSuggestions = book.storyStructure?.episodeSuggestions || [];

    for (let i = 0; i < episodeCount; i++) {
      const startIdx = i * chunksPerEpisode;
      const endIdx = Math.min(startIdx + chunksPerEpisode, chunks.length);
      const episodeChunks = chunks.slice(startIdx, endIdx);

      let synopsis: string;
      if (episodeSuggestions[i]) {
        synopsis = episodeSuggestions[i];
      } else if (plotPoints[i]) {
        synopsis = plotPoints[i];
      } else {
        // Generate synopsis based on chunk content
        synopsis = this.generateEpisodeSynopsis(
          i + 1,
          episodeCount,
          episodeChunks,
          style,
        );
      }

      // Audiobook style - natural transitions, not dramatic cliffhangers
      if (i === 0) {
        synopsis =
          '[Begin the story - introduce the world and characters] ' + synopsis;
      } else if (i === episodeCount - 1) {
        synopsis += ' [Conclude the story naturally]';
      } else {
        synopsis += ' [End at a natural pause point]';
      }

      plan.push({
        synopsis,
        chunkIds: episodeChunks.map((c) => c.id),
      });
    }

    return plan;
  }

  /**
   * Generate a synopsis for an episode based on its chunks
   */
  private generateEpisodeSynopsis(
    episodeNum: number,
    totalEpisodes: number,
    _chunks: BookChunk[],
    style: string,
  ): string {
    const position = episodeNum / totalEpisodes;

    let template: string;
    if (position <= 0.15) {
      template =
        'Introduction: Establish the world and main characters. Hook the listener immediately.';
    } else if (position <= 0.25) {
      template =
        'Rising action: Deepen character relationships. Introduce the central conflict.';
    } else if (position <= 0.5) {
      template =
        'Development: Escalate tensions. Reveal crucial information. Twist expectations.';
    } else if (position <= 0.75) {
      template =
        'Complications: Everything falls apart. Stakes reach their highest. Betrayals and revelations.';
    } else if (position <= 0.9) {
      template =
        'Climax: The final confrontation. All threads converge. Maximum emotional impact.';
    } else {
      template =
        'Resolution: Wrap up the story. Emotional payoff. Leave a lasting impression.';
    }

    // Add style-specific instructions
    if (style === 'dramatized') {
      template += ' Amplify emotions and dramatic moments.';
    } else if (style === 'creative') {
      template += ' Take creative liberties to enhance engagement.';
    }

    return `Episode ${episodeNum}: ${template}`;
  }

  /**
   * Find relevant content using semantic search on embeddings
   */
  private async findRelevantContent(
    bookId: string,
    synopsis: string,
    userId: string,
  ): Promise<string> {
    // Get query embedding
    const queryEmbedding = await this.aiService.generateTextEmbedding(
      userId,
      synopsis,
    );

    // Get all chunks with embeddings
    const chunks = await this.chunkRepository.find({
      where: { bookId },
      order: { chunkIndex: 'ASC' },
    });

    // Calculate cosine similarity for each chunk
    const scoredChunks = chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((chunk) => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 most relevant chunks

    return scoredChunks.map((sc) => sc.chunk.content).join('\n\n---\n\n');
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
   * Get summary of previous episode for continuity
   */
  private async getPreviousEpisodeSummary(
    seriesId: string,
    currentEpisode: number,
  ): Promise<string | null> {
    if (currentEpisode <= 1) return null;

    const previousEpisode = await this.episodeRepository.findOne({
      where: { seriesId, episodeNumber: currentEpisode - 1 },
    });

    if (!previousEpisode) return null;

    return (
      previousEpisode.synopsis || 'Previous episode summary not available.'
    );
  }
}
