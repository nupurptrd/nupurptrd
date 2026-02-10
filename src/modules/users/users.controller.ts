import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppRole } from '../../common/enums';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('device-token')
  @ApiOperation({ summary: 'Register device token for push notifications' })
  async registerDeviceToken(
    @Req() req: any,
    @Body() body: { token: string; platform: 'ios' | 'android' },
  ) {
    const userId = req.user.id;
    await this.usersService.registerDeviceToken(
      userId,
      body.token,
      body.platform,
    );
    return { success: true };
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Remove device token' })
  async removeDeviceToken(@Req() req: any, @Body() body: { token: string }) {
    const userId = req.user.id;
    await this.usersService.removeDeviceToken(userId, body.token);
    return { success: true };
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with their roles' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a single user by ID' })
  async findOne(@Param('userId') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @Body()
    body: {
      email: string;
      password: string;
      fullName?: string;
      role?: AppRole;
    },
  ) {
    return this.usersService.createUser(
      body.email,
      body.password,
      body.fullName || '',
      body.role || AppRole.VIEWER,
    );
  }

  @Put(':userId/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateRole(
    @Param('userId') userId: string,
    @Body() body: { role: AppRole },
  ) {
    await this.usersService.updateRole(userId, body.role);
    return { success: true };
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(@Param('userId') userId: string) {
    await this.usersService.deleteUser(userId);
    return { success: true };
  }
}
