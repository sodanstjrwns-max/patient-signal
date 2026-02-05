import { Controller, Post, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('스케줄러')
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  /**
   * Cron Job 엔드포인트 - 매일 자동 크롤링
   * Render Cron Job 또는 외부 스케줄러에서 호출
   * 
   * 보안: CRON_SECRET 헤더 검증
   */
  @Post('daily-crawl')
  @ApiOperation({ 
    summary: '일일 자동 크롤링', 
    description: 'Cron Job에서 호출. CRON_SECRET 헤더 필요' 
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async dailyCrawl(@Headers('x-cron-secret') cronSecret: string) {
    // 시크릿 키 검증
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runDailyCrawling();
    
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
      cronSchedule: '매일 오전 9시 (KST)',
      lastCheck: new Date().toISOString(),
    };
  }
}
