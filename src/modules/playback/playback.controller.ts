import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlaybackService } from './playback.service';
import * as CommonTypes from '../../common/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('playback')
@Controller('playback')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlaybackController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Post('position')
  @ApiOperation({ summary: 'Save playback position for an episode' })
  savePosition(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body()
    body: {
      episodeId: string;
      positionSeconds: number;
      durationSeconds?: number;
    },
  ) {
    return this.playbackService.savePosition(
      req.user.id,
      body.episodeId,
      body.positionSeconds,
      body.durationSeconds,
    );
  }

  @Get('position/:episodeId')
  @ApiOperation({ summary: 'Get playback position for an episode' })
  getPosition(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('episodeId') episodeId: string,
  ) {
    return this.playbackService.getPosition(req.user.id, episodeId);
  }

  @Get('continue-listening')
  @ApiOperation({ summary: 'Get in-progress episodes to continue listening' })
  getContinueListening(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.playbackService.getContinueListening(
      req.user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get listening history' })
  getHistory(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.playbackService.getListeningHistory(
      req.user.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get personalized recommendations based on history',
  })
  getRecommendations(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.playbackService.getRecommendations(
      req.user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending series (most played recently)' })
  getTrending(@Query('limit') limit?: string) {
    return this.playbackService.getTrending(limit ? parseInt(limit, 10) : 10);
  }

  @Public()
  @Get('new-releases')
  @ApiOperation({ summary: 'Get newest series' })
  getNewReleases(@Query('limit') limit?: string) {
    return this.playbackService.getNewReleases(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Public()
  @Get('all-time-popular')
  @ApiOperation({ summary: 'Get all-time popular series (most total plays)' })
  getAllTimePopular(@Query('limit') limit?: string) {
    return this.playbackService.getAllTimePopular(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Post('complete/:episodeId')
  @ApiOperation({ summary: 'Mark episode as completed' })
  markCompleted(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('episodeId') episodeId: string,
  ) {
    return this.playbackService.markCompleted(req.user.id, episodeId);
  }

  @Delete('position/:episodeId')
  @ApiOperation({ summary: 'Clear playback position (restart)' })
  clearPosition(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('episodeId') episodeId: string,
  ) {
    return this.playbackService.clearPosition(req.user.id, episodeId);
  }
}
