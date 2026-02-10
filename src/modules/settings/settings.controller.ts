import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import * as CommonTypes from '../../common/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyType } from '../../common/enums';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // API Keys
  @Get('api-keys')
  @ApiOperation({ summary: 'Get all API keys for user' })
  getApiKeys(@Request() req: CommonTypes.AuthenticatedRequest) {
    return this.settingsService.getApiKeys(req.user.id);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Save API key' })
  saveApiKey(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() body: { keyType: ApiKeyType; apiKey: string },
  ) {
    return this.settingsService.saveApiKey(
      req.user.id,
      body.keyType,
      body.apiKey,
    );
  }

  @Post('api-keys/:keyType/verify')
  @ApiOperation({ summary: 'Verify API key' })
  verifyApiKey(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('keyType') keyType: ApiKeyType,
  ) {
    return this.settingsService.verifyApiKey(req.user.id, keyType);
  }

  @Delete('api-keys/:keyType')
  @ApiOperation({ summary: 'Delete API key' })
  deleteApiKey(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('keyType') keyType: ApiKeyType,
  ) {
    return this.settingsService.deleteApiKey(req.user.id, keyType);
  }

  // Platform Settings
  @Get('platform')
  @ApiOperation({ summary: 'Get platform settings' })
  getPlatformSettings(@Request() req: CommonTypes.AuthenticatedRequest) {
    return this.settingsService.getPlatformSettings(req.user.id);
  }

  @Put('platform')
  @ApiOperation({ summary: 'Update platform settings' })
  updatePlatformSettings(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() data: any,
  ) {
    return this.settingsService.updatePlatformSettings(req.user.id, data);
  }

  // Notification Settings
  @Get('notifications')
  @ApiOperation({ summary: 'Get notification settings' })
  getNotificationSettings(@Request() req: CommonTypes.AuthenticatedRequest) {
    return this.settingsService.getNotificationSettings(req.user.id);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update notification settings' })
  updateNotificationSettings(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() data: any,
  ) {
    return this.settingsService.updateNotificationSettings(req.user.id, data);
  }

  // Security Settings
  @Get('security')
  @ApiOperation({ summary: 'Get security settings' })
  getSecuritySettings(@Request() req: CommonTypes.AuthenticatedRequest) {
    return this.settingsService.getSecuritySettings(req.user.id);
  }

  @Put('security')
  @ApiOperation({ summary: 'Update security settings' })
  updateSecuritySettings(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() data: any,
  ) {
    return this.settingsService.updateSecuritySettings(req.user.id, data);
  }
}
