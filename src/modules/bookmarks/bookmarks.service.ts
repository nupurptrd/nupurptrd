import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from '../../entities/bookmark.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';

// Transform bookmark to snake_case for frontend compatibility
function transformBookmark(bookmark: Bookmark): any {
  if (!bookmark) return null;
  return {
    id: bookmark.id,
    user_id: bookmark.userId,
    series_id: bookmark.seriesId,
    episode_id: bookmark.episodeId,
    position_seconds: bookmark.positionSeconds,
    duration_seconds: bookmark.durationSeconds,
    note: bookmark.note,
    title: bookmark.title,
    created_at: bookmark.createdAt,
    updated_at: bookmark.updatedAt,
    series: bookmark.series
      ? {
          id: bookmark.series.id,
          title: bookmark.series.title,
          primary_genre: bookmark.series.primaryGenre,
        }
      : null,
    episode: bookmark.episode
      ? {
          id: bookmark.episode.id,
          title: bookmark.episode.title,
          episode_number: bookmark.episode.episodeNumber,
          audio_url: bookmark.episode.audioUrl,
          duration_seconds: bookmark.episode.durationSeconds,
        }
      : null,
  };
}

export interface CreateBookmarkDto {
  series_id: string;
  episode_id: string;
  position_seconds: number;
  duration_seconds?: number;
  note?: string;
  title?: string;
}

export interface UpdateBookmarkDto {
  note?: string;
  title?: string;
}

export interface SyncBookmarkDto extends CreateBookmarkDto {
  local_id?: number; // For syncing local SQLite IDs
  created_at?: string;
}

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
  ) {}

  /**
   * Create a new bookmark
   */
  async create(userId: string, dto: CreateBookmarkDto) {
    // Verify episode exists
    const episode = await this.episodeRepository.findOne({
      where: { id: dto.episode_id },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    const bookmark = this.bookmarkRepository.create({
      userId,
      seriesId: dto.series_id,
      episodeId: dto.episode_id,
      positionSeconds: dto.position_seconds,
      durationSeconds: dto.duration_seconds || episode.durationSeconds,
      note: dto.note,
      title: dto.title,
    });

    const saved = await this.bookmarkRepository.save(bookmark);

    // Reload with relations
    const full = await this.bookmarkRepository.findOne({
      where: { id: saved.id },
      relations: ['series', 'episode'],
    });

    return transformBookmark(full!);
  }

  /**
   * Get all bookmarks for a user
   */
  async findAll(userId: string) {
    const bookmarks = await this.bookmarkRepository.find({
      where: { userId },
      relations: ['series', 'episode'],
      order: { createdAt: 'DESC' },
    });

    return bookmarks.map(transformBookmark);
  }

  /**
   * Get bookmarks for a specific series
   */
  async findBySeriesId(userId: string, seriesId: string) {
    const bookmarks = await this.bookmarkRepository.find({
      where: { userId, seriesId },
      relations: ['series', 'episode'],
      order: { createdAt: 'DESC' },
    });

    return bookmarks.map(transformBookmark);
  }

  /**
   * Get bookmarks for a specific episode
   */
  async findByEpisodeId(userId: string, episodeId: string) {
    const bookmarks = await this.bookmarkRepository.find({
      where: { userId, episodeId },
      relations: ['series', 'episode'],
      order: { positionSeconds: 'ASC' },
    });

    return bookmarks.map(transformBookmark);
  }

  /**
   * Get a single bookmark
   */
  async findOne(userId: string, id: string) {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { id, userId },
      relations: ['series', 'episode'],
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    return transformBookmark(bookmark);
  }

  /**
   * Update a bookmark
   */
  async update(userId: string, id: string, dto: UpdateBookmarkDto) {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { id, userId },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    if (dto.note !== undefined) bookmark.note = dto.note;
    if (dto.title !== undefined) bookmark.title = dto.title;

    await this.bookmarkRepository.save(bookmark);

    // Reload with relations
    const full = await this.bookmarkRepository.findOne({
      where: { id },
      relations: ['series', 'episode'],
    });

    return transformBookmark(full!);
  }

  /**
   * Delete a bookmark
   */
  async delete(userId: string, id: string) {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { id, userId },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    await this.bookmarkRepository.remove(bookmark);
    return { success: true };
  }

  /**
   * Delete all bookmarks for a user
   */
  async deleteAll(userId: string) {
    await this.bookmarkRepository.delete({ userId });
    return { success: true };
  }

  /**
   * Batch sync bookmarks from local device
   * Handles merge of local and server bookmarks
   */
  async batchSync(userId: string, bookmarks: SyncBookmarkDto[]) {
    const results = {
      created: [] as any[],
      updated: [] as any[],
      errors: [] as any[],
    };

    for (const dto of bookmarks) {
      try {
        // Check if bookmark already exists at same position
        const existing = await this.bookmarkRepository.findOne({
          where: {
            userId,
            episodeId: dto.episode_id,
            positionSeconds: dto.position_seconds,
          },
        });

        if (existing) {
          // Update existing
          if (dto.note !== undefined) existing.note = dto.note;
          if (dto.title !== undefined) existing.title = dto.title;
          await this.bookmarkRepository.save(existing);
          results.updated.push({
            local_id: dto.local_id,
            server_id: existing.id,
          });
        } else {
          // Create new
          const bookmark = this.bookmarkRepository.create({
            userId,
            seriesId: dto.series_id,
            episodeId: dto.episode_id,
            positionSeconds: dto.position_seconds,
            durationSeconds: dto.duration_seconds,
            note: dto.note,
            title: dto.title,
          });
          const saved = await this.bookmarkRepository.save(bookmark);
          results.created.push({
            local_id: dto.local_id,
            server_id: saved.id,
          });
        }
      } catch (error: any) {
        results.errors.push({
          local_id: dto.local_id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get bookmark count for a user
   */
  async getCount(userId: string) {
    const count = await this.bookmarkRepository.count({ where: { userId } });
    return { count };
  }
}
