import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { BooksService } from './books.service';
import { BookProcessingStatus } from '../../entities';

// Multer file type for file uploads
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@Controller('books')
@UseGuards(AuthGuard('jwt'))
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /**
   * Upload a new PDF book
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBook(
    @UploadedFile() file: MulterFile,
    @Body() body: { title?: string; author?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.booksService.uploadBook(req.user.userId, file, body);
  }

  /**
   * Get all books for the current user
   */
  @Get()
  async getBooks(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: BookProcessingStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.booksService.getBooks(
      req.user.userId,
      status,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Get a single book with its chunks
   */
  @Get(':id')
  async getBook(@Param('id') id: string, @Req() _req: AuthenticatedRequest) {
    const book = await this.booksService.getBookById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }

  /**
   * Get book chunks (paginated)
   */
  @Get(':id/chunks')
  async getBookChunks(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.booksService.getBookChunks(
      id,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }

  /**
   * Start processing a book (extract text, create chunks, generate embeddings)
   */
  @Post(':id/process')
  async processBook(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.booksService.startProcessing(id, req.user.userId);
  }

  /**
   * Get processing status for a book
   */
  @Get(':id/status')
  async getProcessingStatus(@Param('id') id: string) {
    return this.booksService.getProcessingStatus(id);
  }

  /**
   * Convert a processed book to a series
   */
  @Post(':id/convert-to-series')
  async convertToSeries(
    @Param('id') id: string,
    @Body()
    body: {
      episodeCount?: number; // Optional - auto-calculated from book length if not provided
      adaptationStyle?: 'faithful' | 'enhanced' | 'immersive';
      targetDurationMinutes?: number; // Default 5 minutes per episode
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const book = await this.booksService.getBookById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.processingStatus !== BookProcessingStatus.READY) {
      throw new BadRequestException(
        'Book must be fully processed before converting to series',
      );
    }

    // Auto-calculate episode count if not provided
    // Will be calculated in processor based on book word count
    return this.booksService.convertToSeries(
      id,
      req.user.userId,
      body.episodeCount, // undefined = auto-calculate
      body.adaptationStyle || 'immersive',
      body.targetDurationMinutes || 5,
    );
  }

  /**
   * Update book metadata
   */
  @Put(':id')
  async updateBook(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      author?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.booksService.updateBook(id, body);
  }

  /**
   * Delete a book and all its chunks
   */
  @Delete(':id')
  async deleteBook(@Param('id') id: string) {
    return this.booksService.deleteBook(id);
  }

  /**
   * Search chunks using semantic similarity
   */
  @Post(':id/search')
  async searchChunks(
    @Param('id') id: string,
    @Body() body: { query: string; limit?: number },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.query) {
      throw new BadRequestException('Query is required');
    }
    return this.booksService.searchChunks(
      id,
      body.query,
      req.user.userId,
      body.limit || 10,
    );
  }

  /**
   * Get extracted characters from the book
   */
  @Get(':id/characters')
  async getBookCharacters(@Param('id') id: string) {
    const book = await this.booksService.getBookById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book.extractedCharacters || [];
  }

  /**
   * Get story structure analysis
   */
  @Get(':id/story-structure')
  async getStoryStructure(@Param('id') id: string) {
    const book = await this.booksService.getBookById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    return book.storyStructure || {};
  }

  /**
   * Retry failed processing
   */
  @Post(':id/retry')
  async retryProcessing(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const book = await this.booksService.getBookById(id);
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.processingStatus !== BookProcessingStatus.FAILED) {
      throw new BadRequestException('Can only retry failed processing');
    }

    return this.booksService.startProcessing(id, req.user.userId);
  }
}
