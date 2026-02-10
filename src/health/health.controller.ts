import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LLMClientService } from '../series/services/llm-client.service';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  constructor(private readonly llmClient: LLMClientService) {}

  @Get()
  @ApiOperation({ summary: 'Check API health' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('gemini')
  @ApiOperation({ summary: 'Check Gemini API connection' })
  async checkGeminiConnection() {
    const connected = await this.llmClient.testConnection();
    return {
      status: connected ? 'connected' : 'disconnected',
      service: 'Gemini API',
      timestamp: new Date().toISOString(),
    };
  }
}