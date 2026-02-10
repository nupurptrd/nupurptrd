import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/create-series.dto';
import { DramaSkeletonService } from './services/drama-skeleton.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dramateSkeleton: DramaSkeletonService,
    private readonly logger: LoggerService,
  ) {}

  async create(createSeriesDto: CreateSeriesDto, workspaceId: string) {
    this.logger.log(`Creating series: ${createSeriesDto.title}`, 'SeriesService');

    // Verify book exists
    const book = await this.prisma.book.findFirst({
      where: { id: createSeriesDto.bookId, workspaceId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Check for existing series from this book
    const existingSeries = await this.prisma.series.findFirst({
      where: { bookId: createSeriesDto.bookId, workspaceId },
    });

    if (existingSeries) {
      throw new ConflictException('Series already exists for this book');
    }

    // Generate drama skeleton
    const skeleton = this.dramateSkeleton.generateSkeleton(
      book.contentText,
      createSeriesDto.targetEpisodeCount,
      book.title,
      book.author,
    );

    // Create series
    const series = await this.prisma.series.create({
      data: {
        bookId: createSeriesDto.bookId,
        workspaceId,
        title: createSeriesDto.title,
        description: createSeriesDto.description,
        episodeCount: createSeriesDto.targetEpisodeCount,
        status: 'GENERATING',
        dramaSkeleton: {
          create: {
            beats: {
              create: skeleton.arcs.flatMap((arc) =>
                arc.beats.map((beat, idx) => ({
                  arcNumber: arc.arcNumber,
                  beatType: beat.type,
                  description: beat.description,
                  narrativeNote: beat.narrativeNote,
                  episodeStart: arc.episodeRange.start + idx,
                  episodeEnd: arc.episodeRange.start + idx,
                })),
              ),
            },
          },
        },
      },
      include: {
        dramaSkeleton: { include: { beats: true } },
      },
    });

    this.logger.log(`Series created: ${series.id}`, 'SeriesService');
    return series;
  }

  async findAll(workspaceId: string) {
    return this.prisma.series.findMany({
      where: { workspaceId },
      include: {
        book: { select: { title: true, author: true } },
        episodes: { select: { id: true, episodeNumber: true, status: true } },
      },
    });
  }

  async findById(id: string, workspaceId: string) {
    const series = await this.prisma.series.findFirst({
      where: { id, workspaceId },
      include: {
        book: true,
        dramaSkeleton: { include: { beats: true } },
        episodes: {
          include: {
            promptTrace: true,
            generationStats: true,
            scenes: true,
          },
        },
      },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    return series;
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.series.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });
  }
}