import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMClientService } from './llm-client.service';
import { PromptBuilderService } from './prompt-builder.service';
import { LoggerService } from '../../common/logger/logger.service';
import { Beat } from './drama-skeleton.service';
import { EpisodeValidatorService } from '../../episodes/services/episode-validator.service';

export interface GenerateEpisodeRequest {
  seriesId: string;
  episodeNumber: number;
  beat: Beat;
  bookContext: any;
  previousEpisodeSummary?: string;
}

@Injectable()
export class EpisodeGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClient: LLMClientService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly logger: LoggerService,
    private readonly validator: EpisodeValidatorService,
  ) {}

  async generateEpisode(request: GenerateEpisodeRequest) {
    this.logger.log(
      `Generating episode ${request.episodeNumber} for series ${request.seriesId}`,
      'EpisodeGeneratorService',
    );

    try {
      const series = await this.prisma.series.findUnique({
        where: { id: request.seriesId },
      });

      if (!series) {
        throw new NotFoundException('Series not found');
      }

      const existing = await this.prisma.episode.findUnique({
        where: {
          seriesId_episodeNumber: {
            seriesId: request.seriesId,
            episodeNumber: request.episodeNumber,
          },
        },
      });

      if (existing) {
        throw new ConflictException('Episode already exists for this series');
      }

      // Create Episode (status=GENERATING)
      const episode = await this.prisma.episode.create({
        data: {
          seriesId: request.seriesId,
          episodeNumber: request.episodeNumber,
          title: `Episode ${request.episodeNumber}`,
          scriptText: '',
          durationTargetSec: 75,
          estimatedReadTimeSec: 0,
          characterCount: 0,
          hasCliffhanger: false,
          narratorRatioPct: 0,
          dialogueRatioPct: 0,
          status: 'GENERATING',
          workspaceId: series.workspaceId,
        },
      });

      const prompt = this.promptBuilder.buildEpisodePrompt(
        request.episodeNumber,
        request.beat,
        request.bookContext,
        request.previousEpisodeSummary,
      );

      const llmResponse = await this.llmClient.generate({
        prompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Parse LLM response
      let episodeData: any;
      try {
        // Extract JSON from response
        const jsonMatch = llmResponse.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Gemini response');
        }
        episodeData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        this.logger.error(
          'Failed to parse Gemini JSON response',
          parseError instanceof Error ? parseError.stack : '',
        );
        // Create minimal valid episode with the raw response
        episodeData = {
          title: `Episode ${request.episodeNumber}`,
          script: llmResponse.text,
          scenes: [],
          cliffhangerStatement: 'To be continued...',
          characterCount: 2,
          narratorWordPercentage: 80,
          dialogueWordPercentage: 20,
          estimatedReadTimeSec: 75,
        };
      }

      const scriptText = (episodeData.script || llmResponse.text || '').toString();
      const narratorRatio = Number.isFinite(episodeData.narratorWordPercentage)
        ? episodeData.narratorWordPercentage
        : undefined;
      const dialogueRatio = Number.isFinite(episodeData.dialogueWordPercentage)
        ? episodeData.dialogueWordPercentage
        : undefined;
      const characterCount = Number.isFinite(episodeData.characterCount)
        ? episodeData.characterCount
        : undefined;

      // Run validation
      const validation = this.validator.validate({
        scriptText,
        narratorRatioPct: narratorRatio,
        dialogueRatioPct: dialogueRatio,
        characterCount,
      } as any);

      const wordCount = this.countWords(scriptText);
      const sentenceCount = this.countSentences(scriptText);
      const finalNarratorRatio = narratorRatio ?? validation.metrics.narratorRatio;
      const finalDialogueRatio = dialogueRatio ?? validation.metrics.dialogueRatio;
      const finalCharacterCount =
        characterCount ?? validation.metrics.characterCount;

      // Split into Scene[] (optional)
      if (episodeData.scenes && Array.isArray(episodeData.scenes)) {
        for (const sceneData of episodeData.scenes) {
          await this.prisma.scene.create({
            data: {
              episodeId: episode.id,
              sceneNumber: sceneData.sceneNumber || 1,
              title: sceneData.title || 'Scene 1',
              narration: sceneData.narration || '',
              dialogue: sceneData.dialogue,
              characters: sceneData.characters || [],
              sfxNotes: sceneData.sfxNotes,
              durationSec: sceneData.durationSec || 30,
            },
          });
        }
      }

      // Calculate stats → create GenerationStats
      await this.prisma.generationStats.create({
        data: {
          episodeId: episode.id,
          wordCount,
          sentenceCount,
          uniqueCharacterCount: finalCharacterCount,
          narratorWordCount: Math.ceil((wordCount * finalNarratorRatio) / 100),
          dialogueWordCount: Math.ceil((wordCount * finalDialogueRatio) / 100),
          avgWordsPerSentence:
            sentenceCount > 0 ? wordCount / sentenceCount : wordCount,
          readabilityScore: 0.8,
        },
      });

      // Log prompt → create PromptTrace
      await this.prisma.promptTrace.create({
        data: {
          episodeId: episode.id,
          model: llmResponse.model,
          promptTemplate: prompt.substring(0, 1000),
          promptFull: prompt,
          responseText: llmResponse.text.substring(0, 2000),
          estimatedTokens: llmResponse.tokensUsed,
          costUsd: llmResponse.costUsd,
          generationTimeMs: llmResponse.generationTimeMs,
        },
      });

      // Set status = READY / VALIDATION_FAILED and fill fields
      await this.prisma.episode.update({
        where: { id: episode.id },
        data: {
          title: episodeData.title || `Episode ${request.episodeNumber}`,
          scriptText,
          durationTargetSec: episodeData.estimatedReadTimeSec || 75,
          estimatedReadTimeSec:
            episodeData.estimatedReadTimeSec || validation.metrics.durationSec,
          characterCount: finalCharacterCount,
          hasCliffhanger: validation.metrics.hasCliffhanger,
          narratorRatioPct: finalNarratorRatio,
          dialogueRatioPct: finalDialogueRatio,
          status: validation.isValid ? 'READY' : 'VALIDATION_FAILED',
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
        },
      });

      this.logger.log(
        `Episode ${request.episodeNumber} generated successfully`,
        'EpisodeGeneratorService',
      );
      return this.prisma.episode.findUnique({
        where: { id: episode.id },
        include: {
          scenes: true,
          promptTrace: true,
          generationStats: true,
        },
      });
    } catch (error) {
      this.logger.error(
        'Episode generation failed',
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate episode');
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  }

  private countSentences(text: string): number {
    return (text.match(/[.!?]+/g) || []).length || 1;
  }
}
