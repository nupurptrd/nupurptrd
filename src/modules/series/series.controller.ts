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
import { SeriesService } from './series.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateSeriesDto,
  UpdateSeriesDto,
  CreateCharacterDto,
  UpdateCharacterDto,
  CreateEpisodeDto,
  UpdateEpisodeDto,
} from './dto/series.dto';
import * as CommonTypes from '../../common/types';

@ApiTags('series')
@Controller('series')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  // Series endpoints
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all series with search, filters, and pagination (public)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'genre', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('genre') genre?: string,
    @Query('language') language?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.seriesService.findAllSeries({
      search,
      genre,
      language,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get series by ID (public)' })
  findOne(@Param('id') id: string) {
    return this.seriesService.findOneSeries(id);
  }

  @Public()
  @Get(':id/bundle')
  @ApiOperation({
    summary:
      'Get series bundle - series, episodes, and characters in one call (public)',
  })
  getBundle(@Param('id') id: string) {
    return this.seriesService.getSeriesBundle(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new series' })
  create(
    @Body() dto: CreateSeriesDto,
    @Request() req: CommonTypes.AuthenticatedRequest,
  ) {
    return this.seriesService.createSeries(dto, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update series' })
  update(@Param('id') id: string, @Body() dto: UpdateSeriesDto) {
    return this.seriesService.updateSeries(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete series' })
  remove(@Param('id') id: string) {
    return this.seriesService.deleteSeries(id);
  }

  // Characters endpoints
  @Get(':seriesId/characters')
  @ApiOperation({ summary: 'Get all characters for a series' })
  findCharacters(@Param('seriesId') seriesId: string) {
    return this.seriesService.findCharacters(seriesId);
  }

  @Post(':seriesId/characters')
  @ApiOperation({ summary: 'Create character' })
  createCharacter(
    @Param('seriesId') seriesId: string,
    @Body() dto: CreateCharacterDto,
  ) {
    return this.seriesService.createCharacter({ ...dto, seriesId });
  }

  @Put('characters/:id')
  @ApiOperation({ summary: 'Update character' })
  updateCharacter(@Param('id') id: string, @Body() dto: UpdateCharacterDto) {
    return this.seriesService.updateCharacter(id, dto);
  }

  @Delete('characters/:id')
  @ApiOperation({ summary: 'Delete character' })
  deleteCharacter(@Param('id') id: string) {
    return this.seriesService.deleteCharacter(id);
  }

  // Episodes endpoints
  @Public()
  @Get(':seriesId/episodes')
  @ApiOperation({ summary: 'Get all episodes for a series (public)' })
  findEpisodes(@Param('seriesId') seriesId: string) {
    return this.seriesService.findEpisodes(seriesId);
  }

  @Public()
  @Get(':seriesId/episodes/:episodeId')
  @ApiOperation({ summary: 'Get episode by ID (public)' })
  findOneEpisode(@Param('episodeId') episodeId: string) {
    return this.seriesService.findOneEpisode(episodeId);
  }

  @Post(':seriesId/episodes')
  @ApiOperation({ summary: 'Create episode' })
  createEpisode(
    @Param('seriesId') seriesId: string,
    @Body() dto: CreateEpisodeDto,
  ) {
    return this.seriesService.createEpisode({ ...dto, seriesId });
  }

  @Put('episodes/:id')
  @ApiOperation({ summary: 'Update episode' })
  updateEpisode(@Param('id') id: string, @Body() dto: UpdateEpisodeDto) {
    return this.seriesService.updateEpisode(id, dto);
  }

  @Delete('episodes/:id')
  @ApiOperation({ summary: 'Delete episode' })
  deleteEpisode(@Param('id') id: string) {
    return this.seriesService.deleteEpisode(id);
  }
}
