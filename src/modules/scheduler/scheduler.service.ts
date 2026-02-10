import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Category, NewsBatch, NewsBatchStatus } from '../../entities';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(NewsBatch)
    private newsBatchRepository: Repository<NewsBatch>,
    @InjectQueue(QUEUE_NAMES.NEWS_GENERATION)
    private newsQueue: Queue,
  ) {}

  /**
   * Daily News Generation - Runs every day at 6 AM
   * Generates news for all categories with is_automated = true
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyNewsGeneration() {
    this.logger.log('Starting daily news generation for automated categories');

    try {
      // Get all categories with automation enabled
      const automatedCategories = await this.categoryRepository.find({
        where: {
          isAutomated: true,
          isActive: true,
          automationStatus: 'running',
        },
      });

      this.logger.log(
        `Found ${automatedCategories.length} automated categories`,
      );

      for (const category of automatedCategories) {
        await this.queueNewsGeneration(category);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Error in daily news generation',
        (error as Error).stack,
      );
    }
  }

  /**
   * Evening News Update - Runs every day at 6 PM
   * Refreshes news for high-priority categories
   */
  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async handleEveningNewsUpdate() {
    this.logger.log('Starting evening news update');

    try {
      const priorityCategories = await this.categoryRepository.find({
        where: {
          isAutomated: true,
          isActive: true,
          automationStatus: 'running',
        },
        take: 5, // Top 5 categories
        order: { sortOrder: 'ASC' },
      });

      for (const category of priorityCategories) {
        await this.queueNewsGeneration(category);
      }
    } catch (error: unknown) {
      this.logger.error('Error in evening news update', (error as Error).stack);
    }
  }

  /**
   * Cleanup old batches - Runs every day at midnight
   * Removes failed batches older than 7 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleBatchCleanup() {
    this.logger.log('Starting batch cleanup');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await this.newsBatchRepository
        .createQueryBuilder()
        .delete()
        .where('status = :status', { status: NewsBatchStatus.FAILED })
        .andWhere('created_at < :date', { date: sevenDaysAgo })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} failed batches`);
    } catch (error: unknown) {
      this.logger.error('Error in batch cleanup', (error as Error).stack);
    }
  }

  /**
   * Check stale batches - Runs every hour
   * Marks batches stuck for more than 2 hours as failed
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleStaleBatchCheck() {
    this.logger.log('Checking for stale batches');

    try {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const staleBatches = await this.newsBatchRepository.find({
        where: {
          status: In([
            NewsBatchStatus.GENERATING_HIGHLIGHTS,
            NewsBatchStatus.GENERATING_DETAILED,
            NewsBatchStatus.GENERATING_AUDIO,
          ]),
        },
      });

      for (const batch of staleBatches) {
        if (batch.startedAt && batch.startedAt < twoHoursAgo) {
          batch.status = NewsBatchStatus.FAILED;
          batch.errorMessage = 'Batch timed out after 2 hours';
          await this.newsBatchRepository.save(batch);
          this.logger.warn(`Marked batch ${batch.id} as failed due to timeout`);
        }
      }
    } catch (error: unknown) {
      this.logger.error('Error checking stale batches', (error as Error).stack);
    }
  }

  /**
   * Queue news generation for a category
   */
  private async queueNewsGeneration(category: Category, userId?: string) {
    try {
      // Create a new batch
      const batch = this.newsBatchRepository.create({
        categoryId: category.id,
        language: category.languages?.[0] || 'English',
        status: NewsBatchStatus.PENDING,
        totalExpected: 15,
      });
      await this.newsBatchRepository.save(batch);

      this.logger.log(
        `Created news batch ${batch.id} for category ${category.name}`,
      );

      // Queue the news generation job
      await this.newsQueue.add('generate-highlights', {
        batchId: batch.id,
        categoryId: category.id,
        language: batch.language,
        userId: userId || 'system', // Use provided userId or 'system' for automated jobs
      });

      this.logger.log(`Queued news generation job for batch ${batch.id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Error queueing news for category ${category.name}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Manually trigger news generation for a category
   */
  async triggerNewsGeneration(
    categoryId: string,
    _language: string = 'English',
  ) {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return this.queueNewsGeneration(category);
  }

  /**
   * Get automation status for all categories
   */
  async getAutomationStatus() {
    const categories = await this.categoryRepository.find({
      where: { isAutomated: true },
      select: ['id', 'name', 'automationStatus', 'lastGeneratedAt'],
    });

    const pendingBatches = await this.newsBatchRepository.count({
      where: {
        status: In([
          NewsBatchStatus.PENDING,
          NewsBatchStatus.GENERATING_HIGHLIGHTS,
          NewsBatchStatus.GENERATING_DETAILED,
        ]),
      },
    });

    return {
      automatedCategories: categories.length,
      runningCategories: categories.filter(
        (c) => c.automationStatus === 'running',
      ).length,
      pendingBatches,
      categories,
    };
  }
}
