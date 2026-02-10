import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Profile } from '../../entities/profile.entity';
import { UserRole } from '../../entities/user-role.entity';
import { PlatformSettings } from '../../entities/platform-settings.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { SecuritySettings } from '../../entities/security-settings.entity';
import { AppRole } from '../../common/enums';
import { RegisterDto, LoginDto, GoogleAuthDto } from './dto/auth.dto';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepository: Repository<NotificationSettings>,
    @InjectRepository(SecuritySettings)
    private securitySettingsRepository: Repository<SecuritySettings>,
    private jwtService: JwtService,
    private firebaseService: FirebaseService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

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

    // Check if this is the first user - assign super_admin
    const userCount = await this.userRepository.count();
    const role = userCount === 1 ? AppRole.SUPER_ADMIN : AppRole.VIEWER;

    const userRole = this.userRoleRepository.create({
      userId: user.id,
      role,
    });
    await this.userRoleRepository.save(userRole);

    // Create default settings
    await this.platformSettingsRepository.save({
      userId: user.id,
      platformName: 'Smarton Content Studio',
      defaultLanguages: ['English', 'Hindi'],
    });

    await this.notificationSettingsRepository.save({
      userId: user.id,
      breakingNews: true,
      dailyDigest: true,
      seriesEpisodes: true,
    });

    await this.securitySettingsRepository.save({
      userId: user.id,
      twoFactorEnabled: false,
      sessionTimeoutEnabled: false,
      sessionTimeoutMinutes: 30,
    });

    const token = this.generateToken(user.id, email);

    return {
      user: {
        id: user.id,
        email: user.email,
        profile,
        roles: [role],
      },
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile', 'roles'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user.id, email);
    const roles = user.roles?.map((r) => r.role) || [];

    return {
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
        roles,
      },
      access_token: token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'roles'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = user.roles?.map((r) => r.role) || [];

    return {
      id: user.id,
      email: user.email,
      profile: user.profile,
      roles,
      isAdmin:
        roles.includes(AppRole.ADMIN) || roles.includes(AppRole.SUPER_ADMIN),
      isSuperAdmin: roles.includes(AppRole.SUPER_ADMIN),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'roles'],
    });
  }

  async googleAuth(googleAuthDto: GoogleAuthDto) {
    const { idToken } = googleAuthDto;

    // Verify Firebase ID token
    let firebaseUser;
    try {
      firebaseUser = await this.firebaseService.verifyIdToken(idToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase token');
    }

    const { email, displayName, photoURL } = firebaseUser;

    if (!email) {
      throw new BadRequestException('Email not provided by Google');
    }

    // Check if user already exists
    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile', 'roles'],
    });

    if (!user) {
      // Create new user from Google Sign-In
      // Generate a random password since they're using Google auth
      const randomPassword = Math.random().toString(36).slice(-16);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = this.userRepository.create({
        email,
        password: hashedPassword,
      });
      await this.userRepository.save(user);

      // Create profile with Google info
      const profile = this.profileRepository.create({
        userId: user.id,
        email,
        fullName: displayName || email.split('@')[0],
        avatarUrl: photoURL,
      });
      await this.profileRepository.save(profile);

      // Assign VIEWER role for new Google users
      const userRole = this.userRoleRepository.create({
        userId: user.id,
        role: AppRole.VIEWER,
      });
      await this.userRoleRepository.save(userRole);

      // Create default settings
      await this.platformSettingsRepository.save({
        userId: user.id,
        platformName: 'Smarton Content Studio',
        defaultLanguages: ['English', 'Hindi'],
      });

      await this.notificationSettingsRepository.save({
        userId: user.id,
        breakingNews: true,
        dailyDigest: true,
        seriesEpisodes: true,
      });

      await this.securitySettingsRepository.save({
        userId: user.id,
        twoFactorEnabled: false,
        sessionTimeoutEnabled: false,
        sessionTimeoutMinutes: 30,
      });

      // Reload user with relations
      user = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['profile', 'roles'],
      });
    } else {
      // Optionally update avatar if not set
      if (photoURL && user.profile && !user.profile.avatarUrl) {
        user.profile.avatarUrl = photoURL;
        await this.profileRepository.save(user.profile);
      }
    }

    if (!user) {
      throw new BadRequestException('Failed to create or retrieve user');
    }

    const token = this.generateToken(user.id, email);
    const refreshToken = this.generateRefreshToken(user.id, email);
    const roles = user.roles?.map((r) => r.role) || [];

    return {
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
        roles,
      },
      access_token: token,
      refresh_token: refreshToken,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(userId: string, email: string): string {
    const payload = { sub: userId, email, type: 'refresh' };
    return this.jwtService.sign(payload, { expiresIn: '30d' });
  }

  async refreshTokens(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'roles'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const token = this.generateToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id, user.email);
    const roles = user.roles?.map((r) => r.role) || [];

    return {
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
        roles,
      },
      access_token: token,
      refresh_token: refreshToken,
    };
  }
}
