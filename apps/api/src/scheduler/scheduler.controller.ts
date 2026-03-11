import { Controller, Post, Get, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('스케줄러')
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  /**
   * 【개선6】Cron Job 엔드포인트 - 하루 3회 자동 크롤링
   * 
   * Render Cron Jobs 설정:
   * 1. morning-crawl:  0 0 * * *  (매일 00:00 UTC = 09:00 KST)
   * 2. afternoon-crawl: 0 4 * * * (매일 04:00 UTC = 13:00 KST)
   * 3. evening-crawl:  0 9 * * *  (매일 09:00 UTC = 18:00 KST)
   * 
   * 보안: CRON_SECRET 헤더 검증
   */
  @Post('daily-crawl')
  @ApiOperation({ 
    summary: '자동 크롤링 실행 (하루 3회)', 
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
      version: 'v2.0 - 하루 3회 크롤링',
      cronSchedule: {
        morning: '매일 오전 9시 (KST) - 전체 플랫폼 크롤링',
        afternoon: '매일 오후 1시 (KST) - ChatGPT+Gemini 경량 크롤링',
        evening: '매일 오후 6시 (KST) - 전체 + 경쟁사 + Content Gap 분석',
      },
      improvements: [
        '개선1: temperature 0 + 3회 반복 측정',
        '개선2: 시스템 프롬프트 제거',
        '개선3: 경쟁사 AEO 점수 실측 (저녁 세션)',
        '개선4: 프롬프트별 성과 분석 API',
        '개선5: Content Gap AI 가이드 자동 생성 (저녁 세션)',
        '개선6: 하루 3회 크롤링 (오전/오후/저녁)',
        '개선7: AI 기반 감성 분석 (GPT-4o-mini)',
        '개선8: 웹 검색 모드 활성화 (Google Search, Perplexity citations)',
        '개선9: Naver CUE 크롤링 (네이버 검색 API)',
        '개선10: AI 환각 필터링 (패턴 기반 + Naver Place 검증)',
      ],
      lastCheck: new Date().toISOString(),
    };
  }
}
