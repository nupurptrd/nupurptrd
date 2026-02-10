import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { Workspace } from '../common/decorators/workspace.decorator';

@ApiTags('books')
@Controller('api/books')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a book' })
  async create(@Body() createBookDto: CreateBookDto, @Workspace() workspaceId: string) {
    return this.booksService.create(createBookDto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List books in workspace' })
  async findAll(@Workspace() workspaceId: string) {
    return this.booksService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book details' })
  async findById(@Param('id') id: string, @Workspace() workspaceId: string) {
    return this.booksService.findById(id, workspaceId);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Analyze book content' })
  async getAnalysis(@Param('id') id: string, @Workspace() workspaceId: string) {
    return this.booksService.getAnalysis(id, workspaceId);
  }
}