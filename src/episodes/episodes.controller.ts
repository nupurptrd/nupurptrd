import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { GenerateEpisodeDto } from './dto/generate-episode.dto';
import { Workspace } from '../common/decorators/workspace.decorator';

@ApiTags('episodes')
@Controller('api/episodes')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class EpisodesController {
  constructor(private readonly episodesService: EpisodesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an episode' })
  async create(
    @Body() createEpisodeDto: CreateEpisodeDto,
    @Workspace() workspaceId: string,
  ) {
    return this.episodesService.create(createEpisodeDto, workspaceId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate an episode using Gemini' })
  @ApiBody({ type: GenerateEpisodeDto })
  @ApiResponse({ status: 201, description: 'Episode generated' })
  async generate(
    @Body() generateEpisodeDto: GenerateEpisodeDto,
    @Workspace() workspaceId: string,
  ) {
    return this.episodesService.generate(generateEpisodeDto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List episodes in workspace' })
  @ApiQuery({ name: 'seriesId', required: false })
  async findAll(
    @Workspace() workspaceId: string,
    @Query('seriesId') seriesId?: string,
  ) {
    return this.episodesService.findAll(workspaceId, seriesId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get episode details' })
  async findById(@Param('id') id: string, @Workspace() workspaceId: string) {
    return this.episodesService.findById(id, workspaceId);
  }
}
