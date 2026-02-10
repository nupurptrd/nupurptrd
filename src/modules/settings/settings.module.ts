import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ApiKey } from '../../entities/api-key.entity';
import { PlatformSettings } from '../../entities/platform-settings.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { SecuritySettings } from '../../entities/security-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      PlatformSettings,
      NotificationSettings,
      SecuritySettings,
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
