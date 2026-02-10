import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Series } from '../../entities/series.entity';
import { SeriesCharacter } from '../../entities/series-character.entity';
import { SeriesEpisode } from '../../entities/series-episode.entity';
import { Category } from '../../entities/category.entity';
import { NewsArticle } from '../../entities/news-article.entity';
import { SettingsModule } from '../settings/settings.module';
import { ElevenLabsModule } from '../elevenlabs/elevenlabs.module';
import { StorageModule } from '../storage/storage.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Series,
      SeriesCharacter,
      SeriesEpisode,
      Category,
      NewsArticle,
    ]),
    SettingsModule,
    ElevenLabsModule,
    StorageModule,
    AudioModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
