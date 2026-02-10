import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from './queue.constants';
import { NewsProcessor } from './news.processor';
import { AudioProcessor } from './audio.processor';
import { BookProcessor } from './book.processor';
import { SeriesGenerationProcessor } from './series-generation.processor';
import {
  Category,
  NewsArticle,
  NewsBatch,
  Series,
  SeriesEpisode,
  SeriesCharacter,
  Book,
  BookChunk,
} from '../../entities';
import { AiModule } from '../ai/ai.module';
import { ElevenLabsModule } from '../elevenlabs/elevenlabs.module';
import { StorageModule } from '../storage/storage.module';
import { SettingsModule } from '../settings/settings.module';

// Re-export for convenience
export { QUEUE_NAMES } from './queue.constants';

@Module({
  imports: [
    // Register all queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NEWS_GENERATION },
      { name: QUEUE_NAMES.AUDIO_GENERATION },
      { name: QUEUE_NAMES.BOOK_PROCESSING },
      { name: QUEUE_NAMES.SERIES_GENERATION },
    ),
    TypeOrmModule.forFeature([
      Category,
      NewsArticle,
      NewsBatch,
      Series,
      SeriesEpisode,
      SeriesCharacter,
      Book,
      BookChunk,
    ]),
    forwardRef(() => AiModule),
    ElevenLabsModule,
    StorageModule,
    SettingsModule,
  ],
  providers: [
    NewsProcessor,
    AudioProcessor,
    BookProcessor,
    SeriesGenerationProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
