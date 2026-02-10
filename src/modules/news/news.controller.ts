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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('news')
@Controller('news')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Get all news articles with search, filters, and pagination (public)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'articleType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('language') language?: string,
    @Query('status') status?: string,
    @Query('articleType') articleType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsService.findAll({
      search,
      categoryId,
      language,
      status,
      articleType,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get article by ID (public)' })
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Public()
  @Get('feed/bundle')
  @ApiOperation({
    summary:
      'Get news feed bundle - featured, categories, and paginated articles (public)',
  })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getNewsFeed(
    @Query('categoryId') categoryId?: string,
    @Query('language') language?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsService.getNewsFeed({
      categoryId,
      language,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create article' })
  create(@Body() data: any) {
    return this.newsService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update article' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.newsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete article' })
  remove(@Param('id') id: string) {
    return this.newsService.delete(id);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Update article status' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.newsService.updateStatus(id, body.status);
  }
}
