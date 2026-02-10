import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { Profile } from '../../entities/profile.entity';
import { UserRole } from '../../entities/user-role.entity';
import { PlatformSettings } from '../../entities/platform-settings.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { SecuritySettings } from '../../entities/security-settings.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let profileRepository: any;
  let userRoleRepository: any;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [{ role: 'viewer' }],
    profile: { fullName: 'Test User', email: 'test@example.com' },
  };

  beforeEach(async () => {
    const mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    const mockProfileRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockUserRoleRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockPlatformSettingsRepo = {
      save: jest.fn(),
    };

    const mockNotificationSettingsRepo = {
      save: jest.fn(),
    };

    const mockSecuritySettingsRepo = {
      save: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
    };

    const mockFirebaseService = {
      verifyIdToken: jest.fn(),
      getUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Profile), useValue: mockProfileRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        {
          provide: getRepositoryToken(PlatformSettings),
          useValue: mockPlatformSettingsRepo,
        },
        {
          provide: getRepositoryToken(NotificationSettings),
          useValue: mockNotificationSettingsRepo,
        },
        {
          provide: getRepositoryToken(SecuritySettings),
          useValue: mockSecuritySettingsRepo,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    profileRepository = module.get(getRepositoryToken(Profile));
    userRoleRepository = module.get(getRepositoryToken(UserRole));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue({
        id: 'new-user-id',
        email: 'new@example.com',
      });
      userRepository.save.mockResolvedValue({
        id: 'new-user-id',
        email: 'new@example.com',
      });
      userRepository.count.mockResolvedValue(1);
      profileRepository.create.mockReturnValue({});
      profileRepository.save.mockResolvedValue({});
      userRoleRepository.create.mockReturnValue({});
      userRoleRepository.save.mockResolvedValue({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe('new@example.com');
    });

    it('should throw ConflictException for existing email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('test-user-id');

      expect(result.email).toBe('test@example.com');
      expect(result.roles).toContain('viewer');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
