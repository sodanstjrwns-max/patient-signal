import { Controller, Post, Get, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('스케줄러')
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  /**
   * Cron Job 엔드포인트 - 자동 크롤링
   * 
   * Render Cron Jobs 설정:
   * 1. daily-crawl: 0 0 * * * (매일 00:00 UTC = 09:00 KST)
   * 
   * 보안: CRON_SECRET 헤더 검증
   */
  @Post('daily-crawl')
  @ApiOperation({ 
    summary: '자동 크롤링 실행', 
    description: 'Cron Job에서 호출. session 파라미터로 시간대 지정 가능.' 
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  @ApiQuery({ name: 'session', required: false, enum: ['morning', 'afternoon', 'evening'] })
  @ApiQuery({ name: 'includeCompetitors', required: false, type: Boolean })
  @ApiQuery({ name: 'includeContentGap', required: false, type: Boolean })
  async dailyCrawl(
    @Headers('x-cron-secret') cronSecret: string,
    @Query('session') session?: 'morning' | 'afternoon' | 'evening',
    @Query('includeCompetitors') includeCompetitors?: string,
    @Query('includeContentGap') includeContentGap?: string,
  ) {
    // 시크릿 키 검증
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runDailyCrawling({
      session,
      includeCompetitors: includeCompetitors === 'true',
      includeContentGap: includeContentGap === 'true',
    });
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * 상태 확인 엔드포인트 (공개)
   */
  @Get('status')
  @ApiOperation({ summary: '스케줄러 상태 확인' })
  async getStatus() {
    return {
      status: 'active',
      version: 'v2.1 - 찐 AI 4개 플랫폼',
      platforms: ['ChatGPT', 'Claude', 'Perplexity', 'Gemini'],
      cronSchedule: {
        daily: '매일 오전 9시 (KST) - 전체 플랫폼 크롤링',
      },
      improvements: [
        '개선1: temperature 0 + 3회 반복 측정',
        '개선2: 시스템 프롬프트 제거',
        '개선3: 경쟁사 AEO 점수 실측',
        '개선4: 프롬프트별 성과 분석 API',
        '개선5: Content Gap AI 가이드 자동 생성',
        '개선6: 세션별 크롤링',
        '개선7: AI 기반 감성 분석 (GPT-4o-mini)',
        '개선8: 웹 검색 모드 활성화 (Google Search, Perplexity citations)',
        '개선10: AI 환각 필터링 (패턴 기반)',
      ],
      lastCheck: new Date().toISOString(),
    };
  }
}
