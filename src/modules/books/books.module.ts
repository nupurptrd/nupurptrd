import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import {
  Book,
  BookChunk,
  Series,
  SeriesEpisode,
  SeriesCharacter,
} from '../../entities';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Book,
      BookChunk,
      Series,
      SeriesEpisode,
      SeriesCharacter,
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'books'),
        filename: (_req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, callback) => {
        // Only allow PDF files
        if (file.mimetype === 'application/pdf') {
          callback(null, true);
        } else {
          callback(new Error('Only PDF files are allowed'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
      },
    }),
    forwardRef(() => QueueModule),
    forwardRef(() => AiModule),
    StorageModule,
  ],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
