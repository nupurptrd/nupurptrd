import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface LLMGenerationRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMGenerationResponse {
  text: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
  generationTimeMs: number;
}

@Injectable()
export class LLMClientService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly pricingPerKInput: number;
  private readonly pricingPerKOutput: number;
  private readonly genAI: GoogleGenerativeAI;
  private readonly generativeModel: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.model = this.configService.get<string>('LLM_MODEL', 'gemini-pro');
    this.temperature = this.configService.get<number>('LLM_TEMPERATURE', 0.7);
    this.maxTokens = this.configService.get<number>('LLM_MAX_TOKENS', 2000);
    this.pricingPerKInput = this.configService.get<number>(
      'GEMINI_PRICING_PER_1K_INPUT',
      0.0005,
    );
    this.pricingPerKOutput = this.configService.get<number>(
      'GEMINI_PRICING_PER_1K_OUTPUT',
      0.0015,
    );

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY not set', 'LLMClientService');
    }

    // Initialize Gemini API
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.generativeModel = this.genAI.getGenerativeModel({
      model: this.model,
    });
  }

  async generate(request: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('Gemini API key not configured');
    }

    const startTime = Date.now();

    try {
      // Call Gemini API
      const response = await this.generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: request.prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: request.temperature || this.temperature,
          maxOutputTokens: request.maxTokens || this.maxTokens,
        },
      });

      const generationTime = Date.now() - startTime;
      const generatedText = response.response.text();

      // Estimate tokens (Gemini doesn't always return token counts)
      const inputTokens = Math.ceil(request.prompt.length / 4);
      const outputTokens = Math.ceil(generatedText.length / 4);
      const tokensUsed = inputTokens + outputTokens;

      const costUsd = this.calculateCost(inputTokens, outputTokens);

      this.logger.debug(
        'Gemini generation completed',
        'LLMClientService',
        {
          model: this.model,
          tokensUsed,
          costUsd,
          generationTimeMs: generationTime,
        },
      );

      return {
        text: generatedText,
        tokensUsed,
        costUsd,
        model: this.model,
        generationTimeMs: generationTime,
      };
    } catch (error) {
      this.logger.error(
        'Gemini generation failed',
        error instanceof Error ? error.stack : JSON.stringify(error),
        'LLMClientService',
      );

      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new InternalServerErrorException('Invalid Gemini API key');
        }
        if (error.message.includes('quota')) {
          throw new InternalServerErrorException('Gemini API quota exceeded');
        }
      }

      throw new InternalServerErrorException('Failed to generate content with Gemini');
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1000) * this.pricingPerKInput +
           (outputTokens / 1000) * this.pricingPerKOutput;
  }

  /**
   * Test the Gemini API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Say "Connection successful" in one sentence.';
      const response = await this.generate({
        prompt: testPrompt,
        maxTokens: 50,
      });
      this.logger.log('✅ Gemini API connection successful', 'LLMClientService');
      return true;
    } catch (error) {
      this.logger.error(
        '❌ Gemini API connection failed',
        error instanceof Error ? error.stack : '',
      );
      return false;
    }
  }
}