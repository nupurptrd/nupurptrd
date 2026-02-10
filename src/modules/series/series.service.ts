import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Series } from '../../entities/series.entity';
import { SeriesCharacter } from '../../entities/series-character.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Book } from '../../entities/book.entity';

// Transform series to snake_case for frontend compatibility
function transformSeries(series: Series): any {
  if (!series) return null;
  return {
    id: series.id,
    title: series.title,
    logline: series.logline,
    abstract: series.abstract,
    world_setting: series.worldSetting,
    themes: series.themes || [],
    format: series.format,
    primary_genre: series.primaryGenre,
    secondary_genre: series.secondaryGenre,
    language: series.language,
    comps: series.comps,
    episode_count: series.episodeCount,
    episode_duration_minutes: series.episodeDurationMinutes,
    pilot_synopsis: series.pilotSynopsis,
    season_arc: series.seasonArc,
    visual_style: series.visualStyle,
    music_soundscape: series.musicSoundscape,
    central_mystery: series.centralMystery,
    future_seasons: series.futureSeasons,
    status: series.status,
    created_by: series.createdById,
    created_at: series.createdAt,
    updated_at: series.updatedAt,
    characters: series.characters?.map(transformCharacter) || [],
    episodes: series.episodes?.map(transformEpisode) || [],
  };
}

function transformCharacter(char: SeriesCharacter): any {
  if (!char) return null;
  return {
    id: char.id,
    series_id: char.seriesId,
    name: char.name,
    age: char.age,
    role_type: char.roleType,
    public_mask: char.publicMask,
    internal_reality: char.internalReality,
    fatal_flaw: char.fatalFlaw,
    character_arc: char.characterArc,
    backstory: char.backstory,
    voice_id: char.voiceId,
    voice_name: char.voiceName,
    voice_settings: char.voiceSettings,
    sort_order: char.sortOrder,
    created_at: char.createdAt,
    updated_at: char.updatedAt,
  };
}

function transformEpisode(ep: SeriesEpisode): any {
  if (!ep) return null;
  return {
    id: ep.id,
    series_id: ep.seriesId,
    episode_number: ep.episodeNumber,
    title: ep.title,
    synopsis: ep.synopsis,
    generation_prompt: ep.generationPrompt,
    full_script: ep.fullScript,
    formatted_audio_script: ep.formattedAudioScript,
    audio_url: ep.audioUrl,
    duration_seconds: ep.durationSeconds,
    status: ep.status,
    created_at: ep.createdAt,
    updated_at: ep.updatedAt,
  };
}

@Injectable()
export class SeriesService {
  constructor(
    @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
    @InjectRepository(SeriesCharacter)
    private characterRepository: Repository<SeriesCharacter>,
    @InjectRepository(SeriesEpisode)
    private episodeRepository: Repository<SeriesEpisode>,
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
  ) {}

  // Series CRUD
  async findAllSeries(options?: {
    userId?: string;
    search?: string;
    genre?: string;
    language?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      search,
      genre,
      language,
      status,
      page = 1,
      limit = 20,
    } = options || {};

    const query = this.seriesRepository
      .createQueryBuilder('series')
      .orderBy('series.updatedAt', 'DESC');

    if (userId) {
      query.andWhere('series.createdById = :userId', { userId });
    }

    if (search) {
      query.andWhere(
        '(series.title ILIKE :search OR series.logline ILIKE :search OR series.abstract ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (genre) {
      query.andWhere(
        '(series.primaryGenre = :genre OR series.secondaryGenre = :genre)',
        { genre },
      );
    }

    if (language) {
      query.andWhere('series.language = :language', { language });
    }

    if (status) {
      query.andWhere('series.status = :status', { status });
    } else {
      // Default to published for public access
      query.andWhere('series.status = :status', { status: 'published' });
    }

    // Get total count for pagination
    const total = await query.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const series = await query.getMany();

    return {
      data: series.map(transformSeries),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + series.length < total,
      },
    };
  }

  /**
   * Find published series that have at least one published episode with audio (for public/mobile app)
   */
  async findPublishedWithAudio(options?: {
    search?: string;
    genre?: string;
    language?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, genre, language, page = 1, limit = 20 } = options || {};

    // Get series IDs that have at least one published episode with audio
    const seriesWithAudio = await this.episodeRepository
      .createQueryBuilder('episode')
      .select('DISTINCT episode.seriesId', 'seriesId')
      .where('episode.status = :status', { status: 'published' })
      .andWhere('episode.audioUrl IS NOT NULL')
      .andWhere("episode.audioUrl != ''")
      .getRawMany();

    const seriesIds = seriesWithAudio.map((e) => e.seriesId);

    if (seriesIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }

    const query = this.seriesRepository
      .createQueryBuilder('series')
      .where('series.id IN (:...seriesIds)', { seriesIds })
      .andWhere('series.status = :status', { status: 'published' })
      .orderBy('series.updatedAt', 'DESC');

    if (search) {
      query.andWhere(
        '(series.title ILIKE :search OR series.logline ILIKE :search OR series.abstract ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (genre) {
      query.andWhere(
        '(series.primaryGenre = :genre OR series.secondaryGenre = :genre)',
        { genre },
      );
    }

    if (language) {
      query.andWhere('series.language = :language', { language });
    }

    // Get total count for pagination
    const total = await query.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const series = await query.getMany();

    return {
      data: series.map(transformSeries),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + series.length < total,
      },
    };
  }

  async findOneSeries(id: string) {
    const series = await this.seriesRepository.findOne({
      where: { id },
      relations: ['characters', 'episodes'],
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    return transformSeries(series);
  }

  async createSeries(data: any, userId: string) {
    // Transform snake_case input to camelCase for entity
    const series = this.seriesRepository.create({
      title: data.title,
      logline: data.logline,
      abstract: data.abstract,
      worldSetting: data.world_setting,
      themes: data.themes || [],
      format: data.format,
      primaryGenre: data.primary_genre,
      secondaryGenre: data.secondary_genre,
      language: data.language,
      comps: data.comps,
      episodeCount: data.episode_count,
      episodeDurationMinutes: data.episode_duration_minutes,
      pilotSynopsis: data.pilot_synopsis,
      seasonArc: data.season_arc,
      visualStyle: data.visual_style,
      musicSoundscape: data.music_soundscape,
      centralMystery: data.central_mystery,
      futureSeasons: data.future_seasons,
      status: data.status,
      createdById: userId,
    });
    const saved = await this.seriesRepository.save(series);
    return transformSeries(saved);
  }

  async updateSeries(id: string, data: any) {
    const series = await this.seriesRepository.findOne({ where: { id } });
    if (!series) {
      throw new NotFoundException('Series not found');
    }
    // Transform snake_case input to camelCase for entity
    if (data.title !== undefined) series.title = data.title;
    if (data.logline !== undefined) series.logline = data.logline;
    if (data.abstract !== undefined) series.abstract = data.abstract;
    if (data.world_setting !== undefined)
      series.worldSetting = data.world_setting;
    if (data.themes !== undefined) series.themes = data.themes;
    if (data.format !== undefined) series.format = data.format;
    if (data.primary_genre !== undefined)
      series.primaryGenre = data.primary_genre;
    if (data.secondary_genre !== undefined)
      series.secondaryGenre = data.secondary_genre;
    if (data.language !== undefined) series.language = data.language;
    if (data.comps !== undefined) series.comps = data.comps;
    if (data.episode_count !== undefined)
      series.episodeCount = data.episode_count;
    if (data.episode_duration_minutes !== undefined)
      series.episodeDurationMinutes = data.episode_duration_minutes;
    if (data.pilot_synopsis !== undefined)
      series.pilotSynopsis = data.pilot_synopsis;
    if (data.season_arc !== undefined) series.seasonArc = data.season_arc;
    if (data.visual_style !== undefined) series.visualStyle = data.visual_style;
    if (data.music_soundscape !== undefined)
      series.musicSoundscape = data.music_soundscape;
    if (data.central_mystery !== undefined)
      series.centralMystery = data.central_mystery;
    if (data.future_seasons !== undefined)
      series.futureSeasons = data.future_seasons;
    if (data.status !== undefined) series.status = data.status;
    const saved = await this.seriesRepository.save(series);
    return transformSeries(saved);
  }

  async deleteSeries(id: string) {
    const series = await this.seriesRepository.findOne({ where: { id } });
    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // Unlink any books that reference this series before deleting
    await this.bookRepository.update({ seriesId: id }, { seriesId: null });

    await this.seriesRepository.remove(series);
    return { success: true };
  }

  // Characters CRUD
  async findCharacters(seriesId: string) {
    const characters = await this.characterRepository.find({
      where: { seriesId },
      order: { sortOrder: 'ASC' },
    });
    return characters.map(transformCharacter);
  }

  async createCharacter(data: any) {
    // Transform snake_case input to camelCase for entity
    const character = this.characterRepository.create({
      seriesId: data.series_id,
      name: data.name,
      age: data.age,
      roleType: data.role_type,
      publicMask: data.public_mask,
      internalReality: data.internal_reality,
      fatalFlaw: data.fatal_flaw,
      characterArc: data.character_arc,
      backstory: data.backstory,
      voiceId: data.voice_id,
      voiceName: data.voice_name,
      voiceSettings: data.voice_settings,
      sortOrder: data.sort_order || 0,
    });
    const saved = await this.characterRepository.save(character);
    return transformCharacter(saved);
  }

  async updateCharacter(id: string, data: any) {
    const character = await this.characterRepository.findOne({ where: { id } });
    if (!character) {
      throw new NotFoundException('Character not found');
    }
    // Transform snake_case input to camelCase for entity
    if (data.name !== undefined) character.name = data.name;
    if (data.age !== undefined) character.age = data.age;
    if (data.role_type !== undefined) character.roleType = data.role_type;
    if (data.public_mask !== undefined) character.publicMask = data.public_mask;
    if (data.internal_reality !== undefined)
      character.internalReality = data.internal_reality;
    if (data.fatal_flaw !== undefined) character.fatalFlaw = data.fatal_flaw;
    if (data.character_arc !== undefined)
      character.characterArc = data.character_arc;
    if (data.backstory !== undefined) character.backstory = data.backstory;
    if (data.voice_id !== undefined) character.voiceId = data.voice_id;
    if (data.voice_name !== undefined) character.voiceName = data.voice_name;
    if (data.voice_settings !== undefined)
      character.voiceSettings = data.voice_settings;
    if (data.sort_order !== undefined) character.sortOrder = data.sort_order;
    const saved = await this.characterRepository.save(character);
    return transformCharacter(saved);
  }

  async deleteCharacter(id: string) {
    const character = await this.characterRepository.findOne({ where: { id } });
    if (!character) {
      throw new NotFoundException('Character not found');
    }
    await this.characterRepository.remove(character);
    return { success: true };
  }

  // Episodes CRUD
  async findEpisodes(seriesId: string) {
    const episodes = await this.episodeRepository.find({
      where: { seriesId },
      order: { episodeNumber: 'ASC' },
    });
    return episodes.map(transformEpisode);
  }

  // Public episodes - only published with audio
  async findPublishedEpisodes(seriesId: string) {
    const episodes = await this.episodeRepository
      .createQueryBuilder('episode')
      .where('episode.seriesId = :seriesId', { seriesId })
      .andWhere('episode.status = :status', { status: 'published' })
      .andWhere('episode.audioUrl IS NOT NULL')
      .andWhere("episode.audioUrl != ''")
      .orderBy('episode.episodeNumber', 'ASC')
      .getMany();
    return episodes.map(transformEpisode);
  }

  async findOneEpisode(id: string) {
    const episode = await this.episodeRepository.findOne({
      where: { id },
      relations: ['series'],
    });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }
    return transformEpisode(episode);
  }

  async createEpisode(data: any) {
    // Transform snake_case input to camelCase for entity
    const episode = this.episodeRepository.create({
      seriesId: data.series_id,
      episodeNumber: data.episode_number,
      title: data.title,
      synopsis: data.synopsis,
      generationPrompt: data.generation_prompt,
      fullScript: data.full_script,
      formattedAudioScript: data.formatted_audio_script,
      audioUrl: data.audio_url,
      durationSeconds: data.duration_seconds,
      status: data.status || 'outline',
    });
    const saved = await this.episodeRepository.save(episode);
    return transformEpisode(saved);
  }

  async updateEpisode(id: string, data: any) {
    const episode = await this.episodeRepository.findOne({ where: { id } });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }
    // Transform snake_case input to camelCase for entity
    if (data.episode_number !== undefined)
      episode.episodeNumber = data.episode_number;
    if (data.title !== undefined) episode.title = data.title;
    if (data.synopsis !== undefined) episode.synopsis = data.synopsis;
    if (data.generation_prompt !== undefined)
      episode.generationPrompt = data.generation_prompt;
    if (data.full_script !== undefined) episode.fullScript = data.full_script;
    if (data.formatted_audio_script !== undefined)
      episode.formattedAudioScript = data.formatted_audio_script;
    if (data.audio_url !== undefined) episode.audioUrl = data.audio_url;
    if (data.duration_seconds !== undefined)
      episode.durationSeconds = data.duration_seconds;
    if (data.status !== undefined) episode.status = data.status;
    const saved = await this.episodeRepository.save(episode);
    return transformEpisode(saved);
  }

  async deleteEpisode(id: string) {
    const episode = await this.episodeRepository.findOne({ where: { id } });
    if (!episode) {
      throw new NotFoundException('Episode not found');
    }
    await this.episodeRepository.remove(episode);
    return { success: true };
  }

  /**
   * Get series bundle - combines series, episodes, and characters in single response
   * Reduces 2+ API calls to 1
   */
  async getSeriesBundle(id: string, _userId?: string) {
    const series = await this.seriesRepository.findOne({
      where: { id },
      relations: ['characters', 'episodes'],
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // Sort episodes by episode number
    const episodes = (series.episodes || [])
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .map(transformEpisode);

    // Sort characters by sort order
    const characters = (series.characters || [])
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(transformCharacter);

    return {
      series: transformSeries(series),
      episodes,
      characters,
      meta: {
        total_episodes: episodes.length,
        total_characters: characters.length,
        has_audio: episodes.some((e) => e?.audio_url),
        fetched_at: new Date().toISOString(),
      },
    };
  }
}
