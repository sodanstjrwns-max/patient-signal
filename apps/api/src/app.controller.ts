import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug/env')
  getEnvStatus(): Record<string, any> {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    
    return {
      timestamp: new Date().toISOString(),
      node_env: process.env.NODE_ENV || 'unknown',
      openai: {
        exists: !!openaiKey,
        length: openaiKey?.length || 0,
        prefix: openaiKey?.substring(0, 7) || 'EMPTY',
        valid: openaiKey?.startsWith('sk-') || false,
        hasWhitespace: openaiKey !== process.env.OPENAI_API_KEY,
      },
      anthropic: {
        exists: !!anthropicKey,
        length: anthropicKey?.length || 0,
      },
      gemini: {
        exists: !!geminiKey,
        length: geminiKey?.length || 0,
      },
    };
  }
}
