import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

class AuthTokenDto {
  userId!: string;
  workspaceId!: string;
}
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  @ApiOperation({ summary: 'Generate JWT token' })
  @ApiResponse({ status: 201, description: 'Token generated' })
  @ApiBody({ type: AuthTokenDto })
  async generateToken(
    @Body('userId') userId: string,
    @Body('workspaceId') workspaceId: string,
  ) {
    if (!userId || !workspaceId) {
      throw new BadRequestException('userId and workspaceId required');
    }
    const token = this.authService.generateToken(userId, workspaceId);
    return { token, expiresIn: '24h' };
  }
}
