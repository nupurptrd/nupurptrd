import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Series } from '../../entities/series.entity';
import { PlaybackService } from '../playback/playback.service';
import { CategoriesService } from '../categories/categories.service';
import { NewsService } from '../news/news.service';

// Transform functions for consistent API responses
function transformSeries(series: Series): any {
  if (!series) return null;
  return {
    id: series.id,
    title: series.title,
    logline: series.logline,
    primary_genre: series.primaryGenre,
    secondary_genre: series.secondaryGenre,
    language: series.language,
    episode_count: series.episodeCount,
    status: series.status,
    created_at: series.createdAt,
  };
}

@Injectable()
export class HomeService {
  private readonly CACHE_TTL_SHORT = 300; // 5 minutes
  private readonly CACHE_TTL_MEDIUM = 600; // 10 minutes
  private readonly CACHE_TTL_LONG = 1800; // 30 minutes

  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private playbackService: PlaybackService,
    private categoriesService: CategoriesService,
    private newsService: NewsService,
  ) {}

  /**
   * Get home feed - combines multiple data sources into single response
   * Reduces 6 API calls to 1
   */
  async getHomeFeed(userId?: string) {
    // Fetch public data from cache or database in parallel
    const [
      newsUpdates,
      trending,
      newReleases,
      allTimePopular,
      categories,
      continueListening,
    ] = await Promise.all([
      this.getCachedNewsUpdates(),
      this.getCachedTrending(),
      this.getCachedNewReleases(),
      this.getCachedAllTimePopular(),
      this.getCachedCategories(),
      userId ? this.playbackService.getContinueListening(userId, 10) : [],
    ]);

    return {
      news_updates: newsUpdates,
      continue_listening: continueListening,
      trending: trending,
      new_releases: newReleases,
      all_time_popular: allTimePopular,
      categories: categories,
      fetched_at: new Date().toISOString(),
    };
  }

  /**
   * Get cached news updates (top 10)
   */
  private async getCachedNewsUpdates() {
    const cacheKey = 'home:news_updates';
    let cached = await this.cacheManager.get<any[]>(cacheKey);

    if (!cached) {
      const result = await this.newsService.findAll({
        status: 'published',
        limit: 10,
        page: 1,
      });
      cached = result.data;
      await this.cacheManager.set(
        cacheKey,
        cached,
        this.CACHE_TTL_SHORT * 1000,
      );
    }

    return cached;
  }

  /**
   * Get cached trending series
   */
  private async getCachedTrending() {
    const cacheKey = 'home:trending';
    let cached = await this.cacheManager.get<any[]>(cacheKey);

    if (!cached) {
      const trending = await this.playbackService.getTrending(10);
      cached = trending.map(transformSeries);
      await this.cacheManager.set(
        cacheKey,
        cached,
        this.CACHE_TTL_SHORT * 1000,
      );
    }

    return cached;
  }

  /**
   * Get cached new releases
   */
  private async getCachedNewReleases() {
    const cacheKey = 'home:new_releases';
    let cached = await this.cacheManager.get<any[]>(cacheKey);

    if (!cached) {
      const newReleases = await this.playbackService.getNewReleases(10);
      cached = newReleases.map(transformSeries);
      await this.cacheManager.set(
        cacheKey,
        cached,
        this.CACHE_TTL_MEDIUM * 1000,
      );
    }

    return cached;
  }

  /**
   * Get cached all-time popular
   */
  private async getCachedAllTimePopular() {
    const cacheKey = 'home:all_time_popular';
    let cached = await this.cacheManager.get<any[]>(cacheKey);

    if (!cached) {
      const popular = await this.playbackService.getAllTimePopular(10);
      cached = popular.map(transformSeries);
      await this.cacheManager.set(cacheKey, cached, this.CACHE_TTL_LONG * 1000);
    }

    return cached;
  }

  /**
   * Get cached categories
   */
  private async getCachedCategories() {
    const cacheKey = 'home:categories';
    let cached = await this.cacheManager.get<any[]>(cacheKey);

    if (!cached) {
      cached = await this.categoriesService.findRootCategories();
      await this.cacheManager.set(cacheKey, cached, this.CACHE_TTL_LONG * 1000);
    }

    return cached;
  }

  /**
   * Invalidate home feed cache
   * Call this when content is created/updated/deleted
   */
  async invalidateCache(keys?: string[]) {
    const allKeys = [
      'home:news_updates',
      'home:trending',
      'home:new_releases',
      'home:all_time_popular',
      'home:categories',
    ];

    const keysToInvalidate = keys || allKeys;
    await Promise.all(
      keysToInvalidate.map((key) => this.cacheManager.del(key)),
    );
  }
}
