import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SeriesService } from '../series/series.service';
import { CategoriesService } from '../categories/categories.service';
import { NewsService } from '../news/news.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly seriesService: SeriesService,
    private readonly categoriesService: CategoriesService,
    private readonly newsService: NewsService,
  ) {}

  // Series endpoints - public browsing
  @Get('series')
  @ApiOperation({
    summary: 'Get published series with audio episodes (public)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'genre', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllSeries(
    @Query('search') search?: string,
    @Query('genre') genre?: string,
    @Query('language') language?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.seriesService.findPublishedWithAudio({
      search,
      genre,
      language,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Get series details by ID (public)' })
  async getSeriesById(@Param('id') id: string) {
    return this.seriesService.findOneSeries(id);
  }

  @Get('series/:seriesId/episodes')
  @ApiOperation({ summary: 'Get episodes for a series (public)' })
  async getSeriesEpisodes(@Param('seriesId') seriesId: string) {
    return this.seriesService.findPublishedEpisodes(seriesId);
  }

  @Get('series/:seriesId/episodes/:episodeId')
  @ApiOperation({ summary: 'Get single episode details (public)' })
  async getEpisodeById(
    @Param('seriesId') _seriesId: string,
    @Param('episodeId') episodeId: string,
  ) {
    return this.seriesService.findOneEpisode(episodeId);
  }

  // Categories endpoints - public
  @Get('categories')
  @ApiOperation({ summary: 'Get all categories (public)' })
  async getAllCategories() {
    return this.categoriesService.findAll();
  }

  @Get('categories/root')
  @ApiOperation({ summary: 'Get root categories (public)' })
  async getRootCategories() {
    return this.categoriesService.findRootCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category by ID (public)' })
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  // News endpoints - public
  @Get('news')
  @ApiOperation({ summary: 'Get published news articles with audio (public)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'articleType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getNews(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('language') language?: string,
    @Query('articleType') articleType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsService.findPublishedWithAudio({
      search,
      categoryId,
      language,
      articleType,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('news/:id')
  @ApiOperation({ summary: 'Get news article by ID (public)' })
  async getNewsById(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }
}
