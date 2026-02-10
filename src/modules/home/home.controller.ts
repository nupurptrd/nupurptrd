import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /**
   * Get home feed - combines multiple data sources into single response
   * Public endpoint but enriched with user data if authenticated
   */
  @Get('feed')
  @SkipThrottle() // Skip rate limiting for this frequently accessed endpoint
  @ApiOperation({ summary: 'Get home feed (6-in-1 bundled response)' })
  async getHomeFeed(@Request() req: any) {
    // Try to get user ID from optional JWT
    const userId = req.user?.userId;
    return this.homeService.getHomeFeed(userId);
  }

  /**
   * Get home feed with authentication (includes continue listening)
   */
  @Get('feed/authenticated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Get home feed with user-specific data' })
  async getAuthenticatedHomeFeed(@Request() req: any) {
    return this.homeService.getHomeFeed(req.user.userId);
  }

  /**
   * Admin endpoint to invalidate home feed cache
   */
  @Post('cache/invalidate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate home feed cache (admin)' })
  async invalidateCache() {
    await this.homeService.invalidateCache();
    return { success: true, message: 'Home feed cache invalidated' };
  }
}
