import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ElevenLabsService } from './elevenlabs.service';
import * as CommonTypes from '../../common/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('elevenlabs')
@Controller('elevenlabs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ElevenLabsController {
  constructor(private readonly elevenLabsService: ElevenLabsService) {}

  @Get('languages')
  @ApiOperation({ summary: 'Get all languages' })
  getLanguages() {
    return this.elevenLabsService.getLanguages();
  }

  @Get('voices')
  @ApiOperation({ summary: 'Get voices by language' })
  getVoices(@Query('language') language?: string) {
    return this.elevenLabsService.getVoices(language);
  }

  @Get('voices/:voiceId')
  @ApiOperation({ summary: 'Get voice by ID' })
  getVoiceById(@Param('voiceId') voiceId: string) {
    return this.elevenLabsService.getVoiceById(voiceId);
  }

  @Post('languages/:id/toggle')
  @ApiOperation({ summary: 'Toggle language active status' })
  toggleLanguageActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.elevenLabsService.toggleLanguageActive(id, body.isActive);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync voices from ElevenLabs' })
  syncVoices(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() body: { language?: string },
  ) {
    return this.elevenLabsService.syncVoices(req.user.id, body.language);
  }
}
