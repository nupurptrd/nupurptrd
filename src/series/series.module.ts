import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { DramaSkeletonService } from './services/drama-skeleton.service';
import { EpisodeGeneratorService } from './services/episode-generator.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { LLMClientService } from './services/llm-client.service';
import { EpisodeValidatorService } from '../episodes/services/episode-validator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [SeriesController],
  providers: [
    SeriesService,
    DramaSkeletonService,
    EpisodeGeneratorService,
    PromptBuilderService,
    LLMClientService,
    EpisodeValidatorService,
  ],
  exports: [SeriesService, LLMClientService, EpisodeGeneratorService],
})
export class SeriesModule {}
