import { Controller, Post, Get, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AICrawlerService } from './ai-crawler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('AI 크롤러')
@Controller('ai-crawler')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AICrawlerController {
  constructor(
    private aiCrawlerService: AICrawlerService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'API 상태 확인', description: 'AI API 키 설정 상태를 확인합니다' })
  async getApiStatus() {
    return this.aiCrawlerService.getApiStatus();
  }

  @Post('crawl/:hospitalId')
  @ApiOperation({ summary: '수동 크롤링 실행', description: '해당 병원의 모든 활성 프롬프트에 대해 AI 크롤링을 실행합니다' })
  @ApiResponse({ status: 200, description: '크롤링 시작' })
  async triggerCrawl(@Param('hospitalId') hospitalId: string) {
    // 병원 정보 조회
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error('병원을 찾을 수 없습니다');
    }

    // 활성 프롬프트 조회
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
    });

    // 크롤링 작업 생성
    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        hospitalId,
        status: 'RUNNING',
        totalPrompts: prompts.length,
        startedAt: new Date(),
      },
    });

    // 비동기로 크롤링 실행
    this.executeCrawling(crawlJob.id, hospital, prompts);

    return {
      jobId: crawlJob.id,
      totalPrompts: prompts.length,
      status: 'RUNNING',
      message: '크롤링이 시작되었습니다',
    };
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: '크롤링 작업 상태 조회' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('작업을 찾을 수 없습니다');
    }

    return job;
  }

  @Get('responses/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 목록 조회' })
  async getResponses(
    @Param('hospitalId') hospitalId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ) {
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        ...(platform && { aiPlatform: platform as any }),
      },
      orderBy: { responseDate: 'desc' },
      take: parseInt(limit || '50'),
      include: {
        prompt: true,
      },
    });

    return responses;
  }

  @Post('score/:hospitalId')
  @ApiOperation({ summary: '일일 점수 계산' })
  async calculateScore(@Param('hospitalId') hospitalId: string) {
    const score = await this.aiCrawlerService.calculateDailyScore(hospitalId);
    return { hospitalId, score, date: new Date().toISOString() };
  }

  private async executeCrawling(
    jobId: string,
    hospital: any,
    prompts: any[],
  ) {
    let completed = 0;
    let failed = 0;

    for (const prompt of prompts) {
      try {
        await this.aiCrawlerService.queryAllPlatforms(
          prompt.id,
          hospital.id,
          hospital.name,
          prompt.promptText,
        );
        completed++;
      } catch (error) {
        failed++;
      }

      // 진행 상황 업데이트
      await this.prisma.crawlJob.update({
        where: { id: jobId },
        data: { completed, failed },
      });
    }

    // 완료 처리
    await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: failed === prompts.length ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 일일 점수 계산
    await this.aiCrawlerService.calculateDailyScore(hospital.id);
  }
}
