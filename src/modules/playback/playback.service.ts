import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PlaybackPosition } from '../../entities/playback-position.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Series } from '../../entities/series.entity';
import { SeriesStatus } from '../../common/enums';

@Injectable()
export class PlaybackService {
  constructor(
    @InjectRepository(PlaybackPosition)
    private playbackRepository: Repository<PlaybackPosition>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
    @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
  ) {}

  /**
   * Save or update playback position
   */
  async savePosition(
    userId: string,
    episodeId: string,
    positionSeconds: number,
    durationSeconds?: number,
  ) {
    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    const duration = durationSeconds || episode.durationSeconds || 0;
    const progressPercent =
      duration > 0 ? (positionSeconds / duration) * 100 : 0;
    const isCompleted = progressPercent >= 95; // Consider 95%+ as completed

    let position = await this.playbackRepository.findOne({
      where: { userId, episodeId },
    });

    if (position) {
      position.positionSeconds = positionSeconds;
      position.durationSeconds = duration;
      position.progressPercent = progressPercent;
      position.isCompleted = isCompleted;
      if (isCompleted && !position.completedAt) {
        position.completedAt = new Date();
      }
    } else {
      position = this.playbackRepository.create({
        userId,
        episodeId,
        seriesId: episode.seriesId,
        positionSeconds,
        durationSeconds: duration,
        progressPercent,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      });
    }

    await this.playbackRepository.save(position);

    return {
      success: true,
      position: {
        episodeId,
        positionSeconds,
        progressPercent: Math.round(progressPercent * 10) / 10,
        isCompleted,
      },
    };
  }

  /**
   * Get playback position for an episode
   */
  async getPosition(userId: string, episodeId: string) {
    const position = await this.playbackRepository.findOne({
      where: { userId, episodeId },
    });

    if (!position) {
      return { positionSeconds: 0, progressPercent: 0, isCompleted: false };
    }

    return {
      positionSeconds: position.positionSeconds,
      progressPercent: position.progressPercent,
      isCompleted: position.isCompleted,
      durationSeconds: position.durationSeconds,
    };
  }

  /**
   * Get continue listening (in-progress episodes)
   */
  async getContinueListening(userId: string, limit: number = 10) {
    const positions = await this.playbackRepository.find({
      where: {
        userId,
        isCompleted: false,
        progressPercent: MoreThan(1), // At least 1% progress
      },
      relations: ['episode', 'series'],
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return positions.map((p) => ({
      episode: {
        id: p.episode?.id,
        title: p.episode?.title,
        episodeNumber: p.episode?.episodeNumber,
        audioUrl: p.episode?.audioUrl,
        durationSeconds: p.episode?.durationSeconds,
      },
      series: {
        id: p.series?.id,
        title: p.series?.title,
        primaryGenre: p.series?.primaryGenre,
      },
      playback: {
        positionSeconds: p.positionSeconds,
        progressPercent: p.progressPercent,
        lastPlayedAt: p.updatedAt,
      },
    }));
  }

  /**
   * Get listening history (completed + in-progress)
   */
  async getListeningHistory(userId: string, limit: number = 50) {
    const positions = await this.playbackRepository.find({
      where: { userId },
      relations: ['episode', 'series'],
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return positions.map((p) => ({
      episode: {
        id: p.episode?.id,
        title: p.episode?.title,
        episodeNumber: p.episode?.episodeNumber,
      },
      series: {
        id: p.series?.id,
        title: p.series?.title,
      },
      playback: {
        positionSeconds: p.positionSeconds,
        progressPercent: p.progressPercent,
        isCompleted: p.isCompleted,
        completedAt: p.completedAt,
        lastPlayedAt: p.updatedAt,
      },
    }));
  }

  /**
   * Get recommendations based on listening history
   */
  async getRecommendations(userId: string, limit: number = 10) {
    // Get user's listening history to understand preferences
    const history = await this.playbackRepository.find({
      where: { userId },
      relations: ['series'],
      order: { updatedAt: 'DESC' },
      take: 20,
    });

    // Extract genres from listening history
    const genreCounts: Record<string, number> = {};
    const listenedSeriesIds = new Set<string>();

    for (const pos of history) {
      listenedSeriesIds.add(pos.seriesId);
      const genre = pos.series?.primaryGenre;
      if (genre) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }

    // Get top genres
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    // Find series in those genres that user hasn't listened to
    let recommendations: Series[] = [];

    if (topGenres.length > 0) {
      const qb = this.seriesRepository
        .createQueryBuilder('series')
        .where('series.primary_genre IN (:...genres)', { genres: topGenres })
        .andWhere('series.status = :status', { status: SeriesStatus.PUBLISHED })
        .orderBy('series.created_at', 'DESC')
        .take(limit * 2);

      recommendations = await qb.getMany();

      // Filter out already listened series
      recommendations = recommendations.filter(
        (s) => !listenedSeriesIds.has(s.id),
      );
    }

    // If not enough recommendations, add trending/new series
    if (recommendations.length < limit) {
      const additionalCount = limit - recommendations.length;
      const additionalSeries = await this.seriesRepository.find({
        where: { status: SeriesStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: additionalCount + listenedSeriesIds.size,
      });

      const filtered = additionalSeries.filter(
        (s) =>
          !listenedSeriesIds.has(s.id) &&
          !recommendations.find((r) => r.id === s.id),
      );
      recommendations.push(...filtered.slice(0, additionalCount));
    }

    return recommendations.slice(0, limit).map((s) => ({
      id: s.id,
      title: s.title,
      logline: s.logline,
      primaryGenre: s.primaryGenre,
      secondaryGenre: s.secondaryGenre,
      episodeCount: s.episodeCount,
      language: s.language,
      reason: topGenres.includes(s.primaryGenre || '')
        ? `Because you enjoyed ${s.primaryGenre} content`
        : 'New and trending',
    }));
  }

  /**
   * Get trending series (most played recently)
   */
  async getTrending(limit: number = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get series with most plays in last 30 days
    const trending = await this.playbackRepository
      .createQueryBuilder('playback')
      .select('playback.seriesId', 'seriesId')
      .addSelect('COUNT(*)', 'totalPlays')
      .where('playback.updatedAt > :date', { date: thirtyDaysAgo })
      .groupBy('playback.seriesId')
      .orderBy('"totalPlays"', 'DESC')
      .limit(limit)
      .getRawMany();

    const seriesIds = trending.map((t) => t.seriesId);

    if (seriesIds.length === 0) {
      // Fallback to newest series if no playback data
      return this.seriesRepository.find({
        where: { status: SeriesStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }

    const series = await this.seriesRepository.findByIds(seriesIds);

    // Sort by trending order
    return seriesIds
      .map((id) => series.find((s) => s.id === id))
      .filter((s) => s != null);
  }

  /**
   * Get new releases
   */
  async getNewReleases(limit: number = 10) {
    return this.seriesRepository.find({
      where: { status: SeriesStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get all-time popular series (most total plays)
   */
  async getAllTimePopular(limit: number = 10) {
    // Get series with most total plays ever
    const popular = await this.playbackRepository
      .createQueryBuilder('playback')
      .select('playback.seriesId', 'seriesId')
      .addSelect('COUNT(*)', 'totalPlays')
      .addSelect('SUM(playback.playCount)', 'totalCompletions')
      .groupBy('playback.seriesId')
      .orderBy('"totalPlays"', 'DESC')
      .limit(limit)
      .getRawMany();

    const seriesIds = popular.map((p) => p.seriesId);

    if (seriesIds.length === 0) {
      // Fallback to published series if no playback data
      return this.seriesRepository.find({
        where: { status: SeriesStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }

    const series = await this.seriesRepository.findByIds(seriesIds);

    // Sort by popularity order and include play count
    return seriesIds
      .map((id) => {
        const s = series.find((s) => s.id === id);
        const stats = popular.find((p) => p.seriesId === id);
        if (!s) return null;
        return {
          ...s,
          totalPlays: parseInt(stats?.totalPlays || '0', 10),
        };
      })
      .filter((s) => s != null);
  }

  /**
   * Mark episode as completed
   */
  async markCompleted(userId: string, episodeId: string) {
    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    let position = await this.playbackRepository.findOne({
      where: { userId, episodeId },
    });

    if (position) {
      position.isCompleted = true;
      position.completedAt = new Date();
      position.progressPercent = 100;
      position.positionSeconds = episode.durationSeconds || 0;
      position.playCount += 1;
    } else {
      position = this.playbackRepository.create({
        userId,
        episodeId,
        seriesId: episode.seriesId,
        positionSeconds: episode.durationSeconds || 0,
        durationSeconds: episode.durationSeconds,
        progressPercent: 100,
        isCompleted: true,
        completedAt: new Date(),
      });
    }

    await this.playbackRepository.save(position);
    return { success: true, isCompleted: true };
  }

  /**
   * Clear playback position (restart episode)
   */
  async clearPosition(userId: string, episodeId: string) {
    await this.playbackRepository.delete({ userId, episodeId });
    return { success: true };
  }
}
