import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElevenLabsService } from './elevenlabs.service';
import { ElevenLabsController } from './elevenlabs.controller';
import { ElevenLabsVoice } from '../../entities/elevenlabs-voice.entity';
import { ElevenLabsLanguage } from '../../entities/elevenlabs-language.entity';
import { ElevenLabsSyncStatus } from '../../entities/elevenlabs-sync-status.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ElevenLabsVoice,
      ElevenLabsLanguage,
      ElevenLabsSyncStatus,
    ]),
    SettingsModule,
  ],
  controllers: [ElevenLabsController],
  providers: [ElevenLabsService],
  exports: [ElevenLabsService],
})
export class ElevenLabsModule {}
