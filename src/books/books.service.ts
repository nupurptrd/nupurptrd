import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { ContentAnalyzerService } from './services/content-analyzer.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentAnalyzer: ContentAnalyzerService,
    private readonly logger: LoggerService,
  ) {}

  async create(createBookDto: CreateBookDto, workspaceId: string) {
    this.logger.log(`Creating book: ${createBookDto.title}`, 'BooksService');

    if (createBookDto.contentText.length < 100) {
      throw new BadRequestException('Content must be at least 100 characters');
    }

    const analysis = this.contentAnalyzer.analyze(
      createBookDto.contentText,
      createBookDto.title,
    );

    const book = await this.prisma.book.create({
      data: {
        title: createBookDto.title,
        author: createBookDto.author,
        language: createBookDto.language,
        genre: createBookDto.genre,
        contentText: createBookDto.contentText,
        wordCount: analysis.wordCount,
        estimatedPages: analysis.estimatedPages,
        workspaceId,
      },
    });

    this.logger.log(`Book created: ${book.id}`, 'BooksService');
    return book;
  }

  async findAll(workspaceId: string) {
    return this.prisma.book.findMany({
      where: { workspaceId },
      include: { series: { select: { id: true, episodeCount: true } } },
    });
  }

  async findById(id: string, workspaceId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id, workspaceId },
      include: { series: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  async getAnalysis(id: string, workspaceId: string) {
    const book = await this.findById(id, workspaceId);
    return this.contentAnalyzer.analyze(book.contentText, book.title);
  }
}