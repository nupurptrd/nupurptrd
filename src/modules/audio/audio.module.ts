import { Module } from '@nestjs/common';
import { AudioMixerService } from './audio-mixer.service';

@Module({
  providers: [AudioMixerService],
  exports: [AudioMixerService],
})
export class AudioModule {}
