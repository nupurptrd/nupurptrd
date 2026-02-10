import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DrmService } from './drm.service';
import {
  SignUrlDto,
  ValidatePlaybackDto,
  PlaybackStartedDto,
  PlaybackEndedDto,
  HeartbeatDto,
  GrantLicenseDto,
  RevokeLicenseDto,
} from './dto/drm.dto';
import * as CommonTypes from '../../common/types';

@ApiTags('drm')
@Controller('drm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DrmController {
  constructor(private readonly drmService: DrmService) {}

  // ==================== User Endpoints ====================

  @Post('sign-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a signed URL for streaming or downloading content',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Episode not found' })
  async signUrl(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() dto: SignUrlDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.drmService.signUrl(req.user.id, dto, ip, userAgent);
  }

  @Post('validate-playback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate if playback is allowed' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  async validatePlayback(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() dto: ValidatePlaybackDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.drmService.validatePlayback(req.user.id, dto, ip, userAgent);
  }

  @Post('playback-started')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that playback has started' })
  @ApiResponse({ status: 200, description: 'Playback start recorded' })
  async playbackStarted(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() dto: PlaybackStartedDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.drmService.playbackStarted(req.user.id, dto, ip, userAgent);
  }

  @Post('playback-ended')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that playback has ended' })
  @ApiResponse({ status: 200, description: 'Playback end recorded' })
  async playbackEnded(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() dto: PlaybackEndedDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.drmService.playbackEnded(req.user.id, dto, ip, userAgent);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send heartbeat to keep stream active' })
  @ApiResponse({ status: 200, description: 'Heartbeat processed' })
  async heartbeat(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Body() dto: HeartbeatDto,
  ) {
    return this.drmService.heartbeat(req.user.id, dto);
  }

  @Get('active-streams')
  @ApiOperation({ summary: 'Get list of active streams for current user' })
  @ApiResponse({ status: 200, description: 'Active streams returned' })
  async getActiveStreams(@Request() req: CommonTypes.AuthenticatedRequest) {
    return this.drmService.getActiveStreams(req.user.id);
  }

  @Delete('stream/:deviceId')
  @ApiOperation({ summary: 'Force stop a stream on a specific device' })
  @ApiResponse({ status: 200, description: 'Stream stopped' })
  async forceStopStream(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
  ) {
    return this.drmService.forceStopStream(req.user.id, deviceId);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get DRM audit logs for current user' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  async getAuditLogs(
    @Request() req: CommonTypes.AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.drmService.getAuditLogs(
      req.user.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ==================== Admin Endpoints ====================

  @Post('admin/grant-license')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Grant a license to a user' })
  @ApiResponse({ status: 201, description: 'License granted' })
  async grantLicense(@Body() dto: GrantLicenseDto) {
    return this.drmService.grantLicense(
      dto.userId,
      dto.episodeId,
      dto.licenseType || 'stream',
      dto.validityDays,
    );
  }

  @Post('admin/revoke-license')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Revoke a license from a user' })
  @ApiResponse({ status: 200, description: 'License revoked' })
  async revokeLicense(@Body() dto: RevokeLicenseDto) {
    return this.drmService.revokeLicense(dto.userId, dto.episodeId, dto.reason);
  }

  @Get('admin/user/:userId/streams')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Get active streams for a specific user' })
  @ApiResponse({ status: 200, description: 'Active streams returned' })
  async getAdminUserStreams(@Param('userId') userId: string) {
    return this.drmService.getActiveStreams(userId);
  }

  @Get('admin/user/:userId/audit-logs')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Get DRM audit logs for a specific user' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  async getAdminUserAuditLogs(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.drmService.getAuditLogs(
      userId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
