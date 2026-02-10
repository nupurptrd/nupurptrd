import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import * as CommonTypes from '../../common/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-episode-script')
  @ApiOperation({ summary: 'Generate episode script using AI' })
  generateEpisodeScript(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() body: { episodeId: string; seriesId: string },
  ) {
    return this.aiService.generateEpisodeScript(
      req.user.id,
      body.episodeId,
      body.seriesId,
    );
  }

  @Post('generate-episode-audio')
  @ApiOperation({ summary: 'Generate audio for episode' })
  generateEpisodeAudio(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() body: { episodeId: string; seriesId: string },
  ) {
    return this.aiService.generateEpisodeAudio(
      req.user.id,
      body.episodeId,
      body.seriesId,
    );
  }

  @Post('generate-news')
  @ApiOperation({ summary: 'Generate news article using AI' })
  generateNews(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body()
    body: {
      categoryId: string;
      language?: string;
      languages?: string[];
      contentType?: 'detailed' | 'highlights';
    },
  ) {
    return this.aiService.generateNews(
      req.user.id,
      body.categoryId,
      body.language,
      body.contentType,
      body.languages,
    );
  }

  @Post('generate-news-audio/:articleId')
  @ApiOperation({ summary: 'Generate audio for news article' })
  generateNewsAudio(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('articleId') articleId: string,
    @Body() body: { voiceId?: string },
  ) {
    return this.aiService.generateNewsAudio(
      req.user.id,
      articleId,
      body.voiceId,
    );
  }
}
