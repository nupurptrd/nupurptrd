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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import type {
  CreateBookmarkDto,
  UpdateBookmarkDto,
  SyncBookmarkDto,
} from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bookmark' })
  async create(@Request() req: any, @Body() dto: CreateBookmarkDto) {
    return this.bookmarksService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookmarks for current user' })
  @ApiQuery({ name: 'series_id', required: false })
  @ApiQuery({ name: 'episode_id', required: false })
  async findAll(
    @Request() req: any,
    @Query('series_id') seriesId?: string,
    @Query('episode_id') episodeId?: string,
  ) {
    if (seriesId) {
      return this.bookmarksService.findBySeriesId(req.user.userId, seriesId);
    }
    if (episodeId) {
      return this.bookmarksService.findByEpisodeId(req.user.userId, episodeId);
    }
    return this.bookmarksService.findAll(req.user.userId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get bookmark count for current user' })
  async getCount(@Request() req: any) {
    return this.bookmarksService.getCount(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bookmark' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.bookmarksService.findOne(req.user.userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a bookmark' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBookmarkDto,
  ) {
    return this.bookmarksService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bookmark' })
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.bookmarksService.delete(req.user.userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all bookmarks for current user' })
  async deleteAll(@Request() req: any) {
    return this.bookmarksService.deleteAll(req.user.userId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Batch sync bookmarks from local device' })
  async batchSync(@Request() req: any, @Body() bookmarks: SyncBookmarkDto[]) {
    return this.bookmarksService.batchSync(req.user.userId, bookmarks);
  }
}
