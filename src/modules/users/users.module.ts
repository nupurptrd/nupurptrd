import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../entities/user.entity';
import { Profile } from '../../entities/profile.entity';
import { UserRole } from '../../entities/user-role.entity';
import { DeviceToken } from '../../entities/device-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, UserRole, DeviceToken])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
