import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { QUEUE_NAMES } from './queue.constants';
import {
  NewsArticle,
  NewsBatch,
  NewsBatchStatus,
  SeriesEpisode,
  ArticleType,
  Category,
} from '../../entities';
import { AiService } from '../ai/ai.service';
import { EpisodeStatus } from '../../common/enums';

export interface NewsAudioJobData {
  batchId: string;
  articleId: string;
  userId: string;
  voiceId?: string;
}

export interface EpisodeAudioJobData {
  episodeId: string;
  seriesId: string;
  userId: string;
}

@Processor(QUEUE_NAMES.AUDIO_GENERATION)
export class AudioProcessor {
  private readonly logger = new Logger(AudioProcessor.name);

  constructor(
    @InjectRepository(NewsArticle)
    private newsRepository: Repository<NewsArticle>,
    @InjectRepository(NewsBatch)
    private batchRepository: Repository<NewsBatch>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
    private aiService: AiService,
  ) {}

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Audio job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Generate audio for a news article
   */
  @Process('generate-news-audio')
  async handleNewsAudio(job: Job<NewsAudioJobData>) {
    const { batchId, articleId, userId, voiceId } = job.data;
    this.logger.log(`Generating audio for article ${articleId}`);

    try {
      // Update batch status if needed
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });
      if (batch && batch.status === NewsBatchStatus.DETAILED_COMPLETE) {
        batch.status = NewsBatchStatus.GENERATING_AUDIO;
        await this.batchRepository.save(batch);
      }

      // Generate audio using existing AI service method
      const result = await this.aiService.generateNewsAudio(
        userId,
        articleId,
        voiceId,
      );

      // Update the article with audio info
      const article = await this.newsRepository.findOne({
        where: { id: articleId },
      });
      if (article) {
        article.audioUrl = result.audioUrl;
        article.voiceId = result.voiceId;
        article.status = 'completed';
        await this.newsRepository.save(article);
      }

      // Update batch count and check if complete
      if (batch) {
        batch.audioGeneratedCount = (batch.audioGeneratedCount || 0) + 1;

        // Count all detailed articles
        const totalDetailed = await this.newsRepository.count({
          where: { batchId, articleType: ArticleType.DETAILED as string },
        });

        if (batch.audioGeneratedCount >= totalDetailed) {
          batch.status = NewsBatchStatus.COMPLETE;
          batch.completedAt = new Date();

          // Update category's last generated timestamp
          if (batch.categoryId) {
            const categoryRepo =
              this.newsRepository.manager.getRepository(Category);
            await categoryRepo.update(batch.categoryId, {
              lastGeneratedAt: new Date(),
            });
          }
        }
        await this.batchRepository.save(batch);
      }

      return { success: true, audioUrl: result.audioUrl };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate audio for article ${articleId}: ${(error as Error).message}`,
      );

      // Mark article as failed
      const article = await this.newsRepository.findOne({
        where: { id: articleId },
      });
      if (article) {
        article.status = 'failed';
        await this.newsRepository.save(article);
      }

      throw error;
    }
  }

  /**
   * Generate production audio for a series episode
   */
  @Process('generate-episode-audio')
  async handleEpisodeAudio(job: Job<EpisodeAudioJobData>) {
    const { episodeId, seriesId, userId } = job.data;
    this.logger.log(`Generating audio for episode ${episodeId}`);

    try {
      // Use existing episode audio generation
      const result = await this.aiService.generateEpisodeAudio(
        userId,
        episodeId,
        seriesId,
      );

      return { success: true, audioUrl: result.audioUrl };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate episode audio ${episodeId}: ${(error as Error).message}`,
      );

      // Update episode status to failed
      const episode = await this.episodeRepository.findOne({
        where: { id: episodeId },
      });
      if (episode) {
        episode.status = EpisodeStatus.DRAFT;
        await this.episodeRepository.save(episode);
      }

      throw error;
    }
  }

  /**
   * Batch generate audio for multiple articles
   */
  @Process('batch-news-audio')
  async handleBatchNewsAudio(
    job: Job<{ articleIds: string[]; userId: string; batchId: string }>,
  ) {
    const { articleIds, userId, batchId } = job.data;
    this.logger.log(`Batch generating audio for ${articleIds.length} articles`);

    const results: {
      articleId: string;
      success: boolean;
      audioUrl?: string;
      error?: string;
    }[] = [];

    for (const articleId of articleIds) {
      try {
        const result = await this.aiService.generateNewsAudio(
          userId,
          articleId,
        );
        results.push({ articleId, success: true, audioUrl: result.audioUrl });

        // Small delay between generations to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: unknown) {
        results.push({
          articleId,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    // Update batch status
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });
    if (batch) {
      const successCount = results.filter((r) => r.success).length;
      batch.audioGeneratedCount = successCount;
      if (successCount >= articleIds.length) {
        batch.status = NewsBatchStatus.COMPLETE;
        batch.completedAt = new Date();
      }
      await this.batchRepository.save(batch);
    }

    return { results };
  }
}
