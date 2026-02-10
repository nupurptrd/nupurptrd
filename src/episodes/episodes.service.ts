import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { GenerateEpisodeDto } from './dto/generate-episode.dto';
import { EpisodeValidatorService } from './services/episode-validator.service';
import { LoggerService } from '../common/logger/logger.service';
import { ContentAnalyzerService } from '../books/services/content-analyzer.service';
import { EpisodeGeneratorService } from '../series/services/episode-generator.service';

@Injectable()
export class EpisodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: EpisodeValidatorService,
    private readonly logger: LoggerService,
    private readonly contentAnalyzer: ContentAnalyzerService,
    private readonly episodeGenerator: EpisodeGeneratorService,
  ) {}

  async create(createEpisodeDto: CreateEpisodeDto, workspaceId: string) {
    this.logger.log(`Creating episode: ${createEpisodeDto.title}`, 'EpisodesService');

    const series = await this.prisma.series.findFirst({
      where: { id: createEpisodeDto.seriesId, workspaceId },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    const lastEpisode = await this.prisma.episode.findFirst({
      where: { seriesId: createEpisodeDto.seriesId },
      orderBy: { episodeNumber: 'desc' },
    });
    const nextEpisodeNumber = lastEpisode ? lastEpisode.episodeNumber + 1 : 1;

    const validation = this.validator.validate({
      scriptText: createEpisodeDto.scriptText,
    });

    const episode = await this.prisma.episode.create({
      data: {
        seriesId: createEpisodeDto.seriesId,
        workspaceId,
        episodeNumber: nextEpisodeNumber,
        title: createEpisodeDto.title,
        scriptText: createEpisodeDto.scriptText,
        durationTargetSec: 75,
        estimatedReadTimeSec: validation.metrics.durationSec,
        characterCount: validation.metrics.characterCount,
        hasCliffhanger: validation.metrics.hasCliffhanger,
        narratorRatioPct: validation.metrics.narratorRatio,
        dialogueRatioPct: validation.metrics.dialogueRatio,
        status: validation.isValid ? 'READY' : 'VALIDATION_FAILED',
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      },
      include: { scenes: true },
    });

    if (Array.isArray(createEpisodeDto.scenes) && createEpisodeDto.scenes.length > 0) {
      const perSceneDuration = Math.max(
        10,
        Math.floor(validation.metrics.durationSec / createEpisodeDto.scenes.length),
      );

      for (let i = 0; i < createEpisodeDto.scenes.length; i++) {
        const scene = createEpisodeDto.scenes[i] || {};
        await this.prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNumber: scene.sceneNumber ?? i + 1,
            title: scene.title ?? `Scene ${i + 1}`,
            narration: scene.narration ?? '',
            dialogue: scene.dialogue ?? null,
            characters: Array.isArray(scene.characters) ? scene.characters : [],
            sfxNotes: scene.sfxNotes ?? null,
            durationSec: scene.durationSec ?? perSceneDuration,
          },
        });
      }
    }

    this.logger.log(`Episode created: ${episode.id}`, 'EpisodesService');
    return this.findById(episode.id, workspaceId);
  }

  async findAll(workspaceId: string, seriesId?: string) {
    return this.prisma.episode.findMany({
      where: {
        workspaceId,
        ...(seriesId ? { seriesId } : {}),
      },
      include: { scenes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, workspaceId: string) {
    const episode = await this.prisma.episode.findFirst({
      where: { id, workspaceId },
      include: {
        scenes: true,
        promptTrace: true,
        generationStats: true,
        series: { select: { id: true, title: true } },
      },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    return episode;
  }

  async generate(
    generateEpisodeDto: GenerateEpisodeDto,
    workspaceId: string,
  ) {
    const series = await this.prisma.series.findFirst({
      where: { id: generateEpisodeDto.seriesId, workspaceId },
      include: {
        book: true,
        dramaSkeleton: { include: { beats: true } },
      },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    if (!series.dramaSkeleton || series.dramaSkeleton.beats.length === 0) {
      throw new NotFoundException('Drama skeleton not found for series');
    }

    const lastEpisode = await this.prisma.episode.findFirst({
      where: { seriesId: generateEpisodeDto.seriesId },
      orderBy: { episodeNumber: 'desc' },
    });
    const episodeNumber =
      generateEpisodeDto.episodeNumber ?? (lastEpisode ? lastEpisode.episodeNumber + 1 : 1);

    const beat = series.dramaSkeleton.beats.find(
      (b) => b.episodeStart === episodeNumber,
    );

    if (!beat) {
      throw new NotFoundException('No beat found for the requested episode');
    }

    const analysis = this.contentAnalyzer.analyze(
      series.book.contentText,
      series.book.title,
    );
    const mainCharacters = Array.from(analysis.characterFrequency.keys()).slice(0, 3);
    const themes = analysis.keyThemes;
    const excerpt = this.buildExcerpt(series.book.contentText);

    const previousEpisode = await this.prisma.episode.findFirst({
      where: {
        seriesId: generateEpisodeDto.seriesId,
        episodeNumber: episodeNumber - 1,
      },
    });
    const previousEpisodeSummary = previousEpisode
      ? previousEpisode.scriptText.slice(0, 500)
      : undefined;

    return this.episodeGenerator.generateEpisode({
      seriesId: generateEpisodeDto.seriesId,
      episodeNumber,
      beat: {
        type: beat.beatType,
        description: beat.description,
        narrativeNote: beat.narrativeNote || '',
      },
      bookContext: {
        title: series.book.title,
        author: series.book.author,
        excerpt,
        mainCharacters,
        genre: series.book.genre,
        themes,
      },
      previousEpisodeSummary,
    });
  }

  private buildExcerpt(text: string): string {
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const excerpt = paragraphs.slice(0, 2).join('\n\n');
    return excerpt.substring(0, 1000);
  }
}
