import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { CreateSeriesDto } from './dto/create-series.dto';
import { Workspace } from '../common/decorators/workspace.decorator';

@ApiTags('series')
@Controller('api/series')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Start series generation (async)' })
  @ApiResponse({ status: 202, description: 'Series creation started' })
  async create(@Body() createSeriesDto: CreateSeriesDto, @Workspace() workspaceId: string) {
    return this.seriesService.create(createSeriesDto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List series in workspace' })
  async findAll(@Workspace() workspaceId: string) {
    return this.seriesService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get series details' })
  async findById(@Param('id') id: string, @Workspace() workspaceId: string) {
    return this.seriesService.findById(id, workspaceId);
  }
}