import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ContentAnalyzerService } from './services/content-analyzer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [BooksController],
  providers: [BooksService, ContentAnalyzerService],
  exports: [BooksService, ContentAnalyzerService],
})
export class BooksModule {}
