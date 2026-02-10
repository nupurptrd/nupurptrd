import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Profile } from '../../entities/profile.entity';
import { UserRole } from '../../entities/user-role.entity';
import { DeviceToken } from '../../entities/device-token.entity';
import { AppRole } from '../../common/enums';

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async findAll(): Promise<UserWithRole[]> {
    const profiles = await this.profileRepository.find({
      order: { createdAt: 'DESC' },
    });

    const roles = await this.userRoleRepository.find();

    return profiles.map((profile) => ({
      id: profile.id,
      user_id: profile.userId,
      email: profile.email,
      full_name: profile.fullName,
      created_at: profile.createdAt.toISOString(),
      roles: roles
        .filter((r) => r.userId === profile.userId)
        .map((r) => r.role),
    }));
  }

  async findOne(userId: string): Promise<UserWithRole> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.userRoleRepository.find({
      where: { userId },
    });

    return {
      id: profile.id,
      user_id: profile.userId,
      email: profile.email,
      full_name: profile.fullName,
      created_at: profile.createdAt.toISOString(),
      roles: roles.map((r) => r.role),
    };
  }

  async createUser(
    email: string,
    password: string,
    fullName: string,
    role: AppRole = AppRole.VIEWER,
  ): Promise<UserWithRole> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
    });
    await this.userRepository.save(user);

    // Create profile
    const profile = this.profileRepository.create({
      userId: user.id,
      email,
      fullName,
    });
    await this.profileRepository.save(profile);

    // Create role
    const userRole = this.userRoleRepository.create({
      userId: user.id,
      role,
    });
    await this.userRoleRepository.save(userRole);

    return {
      id: profile.id,
      user_id: user.id,
      email,
      full_name: fullName,
      created_at: profile.createdAt.toISOString(),
      roles: [role],
    };
  }

  async updateRole(userId: string, newRole: AppRole): Promise<void> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete existing roles
    await this.userRoleRepository.delete({ userId });

    // Create new role
    const userRole = this.userRoleRepository.create({
      userId,
      role: newRole,
    });
    await this.userRoleRepository.save(userRole);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete roles first
    await this.userRoleRepository.delete({ userId });

    // Delete device tokens
    await this.deviceTokenRepository.delete({ userId });

    // Delete profile
    await this.profileRepository.delete({ userId });

    // Delete user
    await this.userRepository.remove(user);
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<DeviceToken> {
    // Check if token already exists for this user
    let deviceToken = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (deviceToken) {
      // Update existing token
      deviceToken.isActive = true;
      deviceToken.lastUsedAt = new Date();
      return this.deviceTokenRepository.save(deviceToken);
    }

    // Create new token entry
    deviceToken = this.deviceTokenRepository.create({
      userId,
      token,
      platform,
      isActive: true,
      lastUsedAt: new Date(),
    });

    return this.deviceTokenRepository.save(deviceToken);
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ userId, token });
  }

  /**
   * Get all active device tokens for a user
   */
  async getActiveDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });
  }

  /**
   * Get all active device tokens (for broadcast notifications)
   */
  async getAllActiveDeviceTokens(): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { isActive: true },
    });
  }

  /**
   * Deactivate a token (when FCM returns invalid token error)
   */
  async deactivateToken(token: string): Promise<void> {
    await this.deviceTokenRepository.update({ token }, { isActive: false });
  }
}
