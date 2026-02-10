import {
  Process,
  Processor,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_NAMES } from './queue.constants';
import {
  Category,
  NewsArticle,
  NewsBatch,
  NewsBatchStatus,
  ArticleType,
} from '../../entities';
import { AiService } from '../ai/ai.service';
import { NewsAudioJobData } from './audio.processor';

export interface NewsHighlightsJobData {
  batchId: string;
  categoryId: string;
  language: string;
  userId: string;
}

export interface NewsDetailedJobData {
  batchId: string;
  highlightArticleId: string;
  userId: string;
}

@Processor(QUEUE_NAMES.NEWS_GENERATION)
export class NewsProcessor {
  private readonly logger = new Logger(NewsProcessor.name);

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(NewsArticle)
    private newsRepository: Repository<NewsArticle>,
    @InjectRepository(NewsBatch)
    private batchRepository: Repository<NewsBatch>,
    @InjectQueue(QUEUE_NAMES.NEWS_GENERATION)
    private newsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUDIO_GENERATION)
    private audioQueue: Queue,
    private aiService: AiService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `Job ${job.id} completed with result: ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed with error: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Generate 10 abstract news highlights for a category
   * This is the first step in the news generation pipeline
   */
  @Process('generate-highlights')
  async handleGenerateHighlights(job: Job<NewsHighlightsJobData>) {
    const { batchId, categoryId, language, userId } = job.data;
    this.logger.log(`Generating highlights for batch ${batchId}`);

    try {
      // Update batch status
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });
      if (!batch) {
        throw new Error('Batch not found');
      }

      batch.status = NewsBatchStatus.GENERATING_HIGHLIGHTS;
      batch.startedAt = new Date();
      await this.batchRepository.save(batch);

      // Get category info for context
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        throw new Error('Category not found');
      }

      // Generate 15 abstract highlights using AI
      const highlights = await this.aiService.generateNewsHighlights(
        userId,
        categoryId,
        language,
        15, // Generate 15 highlights per batch
      );

      // Create news articles for each highlight
      const createdArticles: NewsArticle[] = [];
      for (let i = 0; i < highlights.length; i++) {
        const highlight = highlights[i];
        const article = new NewsArticle();
        article.title = highlight.title;
        article.content = highlight.summary;
        article.categoryId = categoryId;
        article.language = language;
        article.batchId = batchId;
        article.articleType = ArticleType.HIGHLIGHT;
        article.isHighlight = true;
        article.highlightOrder = i + 1;
        article.status = 'pending';
        article.metadata = {
          keywords: highlight.keywords,
          sources: highlight.sources,
          generatedAt: new Date().toISOString(),
        };
        const saved = await this.newsRepository.save(article);
        createdArticles.push(saved);
      }

      // Update batch with highlights count
      batch.highlightsCount = createdArticles.length;
      batch.status = NewsBatchStatus.HIGHLIGHTS_COMPLETE;
      await this.batchRepository.save(batch);

      // Queue detailed generation for each highlight
      for (const article of createdArticles) {
        await this.newsQueue.add(
          'generate-detailed',
          {
            batchId,
            highlightArticleId: article.id,
            userId,
          } as NewsDetailedJobData,
          {
            delay: 1000 * createdArticles.indexOf(article), // Stagger to avoid rate limits
          },
        );
      }

      return { success: true, highlightsCount: createdArticles.length };
    } catch (error: unknown) {
      // Update batch status to failed
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });
      if (batch) {
        batch.status = NewsBatchStatus.FAILED;
        batch.errorMessage = (error as Error).message;
        await this.batchRepository.save(batch);
      }
      throw error;
    }
  }

  /**
   * Expand a single highlight into a detailed 1-2 minute article
   */
  @Process('generate-detailed')
  async handleGenerateDetailed(job: Job<NewsDetailedJobData>) {
    const { batchId, highlightArticleId, userId } = job.data;
    this.logger.log(
      `Generating detailed content for highlight ${highlightArticleId}`,
    );

    try {
      // Update batch status if this is the first detailed generation
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });
      if (batch && batch.status === NewsBatchStatus.HIGHLIGHTS_COMPLETE) {
        batch.status = NewsBatchStatus.GENERATING_DETAILED;
        await this.batchRepository.save(batch);
      }

      // Get the highlight article
      const highlightArticle = await this.newsRepository.findOne({
        where: { id: highlightArticleId },
      });
      if (!highlightArticle) {
        throw new Error('Highlight article not found');
      }

      // Generate detailed content from the highlight
      const detailedContent = await this.aiService.expandHighlightToDetailed(
        userId,
        highlightArticle,
      );

      // Create a new detailed article linked to the highlight
      const detailedArticle = new NewsArticle();
      detailedArticle.title = detailedContent.title;
      detailedArticle.content = detailedContent.content;
      detailedArticle.formattedScript = detailedContent.formattedScript;
      detailedArticle.categoryId = highlightArticle.categoryId;
      detailedArticle.language = highlightArticle.language;
      detailedArticle.batchId = batchId;
      detailedArticle.articleType = ArticleType.DETAILED;
      detailedArticle.isHighlight = false;
      detailedArticle.parentId = highlightArticleId;
      detailedArticle.status = 'ready';
      detailedArticle.suggestedEmotion = detailedContent.emotion;
      detailedArticle.audioDurationSeconds = detailedContent.estimatedDuration;
      detailedArticle.metadata = {
        ...highlightArticle.metadata,
        expandedAt: new Date().toISOString(),
        wordCount: detailedContent.content.split(/\s+/).length,
      };
      const savedDetailed = await this.newsRepository.save(detailedArticle);

      // Update highlight article to link to detailed version
      highlightArticle.status = 'ready';
      await this.newsRepository.save(highlightArticle);

      // Update batch count
      if (batch) {
        batch.detailedCount = (batch.detailedCount || 0) + 1;

        // Check if all detailed articles are generated
        if (batch.detailedCount >= batch.highlightsCount) {
          batch.status = NewsBatchStatus.DETAILED_COMPLETE;

          // Queue audio generation for all detailed articles
          const detailedArticles = await this.newsRepository.find({
            where: { batchId, articleType: ArticleType.DETAILED as string },
          });

          for (const article of detailedArticles) {
            await this.audioQueue.add(
              'generate-news-audio',
              {
                batchId,
                articleId: article.id,
                userId,
              } as NewsAudioJobData,
              {
                delay: 2000 * detailedArticles.indexOf(article), // Stagger for rate limits
              },
            );
          }
        }
        await this.batchRepository.save(batch);
      }

      return { success: true, detailedArticleId: savedDetailed.id };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate detailed for ${highlightArticleId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
