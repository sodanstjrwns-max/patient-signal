import { Controller, Post, Get, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'API 상태 확인 (개선 사항 포함)', description: 'AI API 키 설정 및 개선 사항 상태를 확인합니다' })
  async getApiStatus() {
    return this.aiCrawlerService.getApiStatus();
  }

  @Get('test-openai')
  @ApiOperation({ summary: 'OpenAI 테스트' })
  async testOpenAI() {
    try {
      const result = await this.aiCrawlerService.testOpenAICall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-gemini')
  @ApiOperation({ summary: 'Gemini 테스트' })
  async testGemini() {
    try {
      const result = await this.aiCrawlerService.testGeminiCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-claude')
  @ApiOperation({ summary: 'Claude 테스트' })
  async testClaude() {
    try {
      const result = await this.aiCrawlerService.testClaudeCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-perplexity')
  @ApiOperation({ summary: 'Perplexity 테스트' })
  async testPerplexity() {
    try {
      const result = await this.aiCrawlerService.testPerplexityCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== 개선된 크롤링 엔드포인트 ====================

  @Post('crawl/:hospitalId')
  @ApiOperation({ 
    summary: '수동 크롤링 실행 (개선: 3회 반복, temp=0, 웹검색)',
    description: '해당 병원의 활성 프롬프트에 대해 개선된 AI 크롤링을 실행합니다. 각 플랫폼 3회 반복 측정.' 
  })
  async triggerCrawl(
    @Param('hospitalId') hospitalId: string,
  ) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error('병원을 찾을 수 없습니다');
    }

    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
    });

    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        hospitalId,
        status: 'RUNNING',
        totalPrompts: prompts.length,
        startedAt: new Date(),
      },
    });

    // 비동기로 개선된 크롤링 실행
    this.executeCrawling(crawlJob.id, hospital, prompts);

    return {
      jobId: crawlJob.id,
      totalPrompts: prompts.length,
      status: 'RUNNING',
      message: '개선된 크롤링이 시작되었습니다 (3회 반복 측정, temperature=0, 웹검색 활성화)',
      improvements: [
        'temperature=0 (재현성 확보)',
        '3회 반복 측정 (일관성 검증)',
        '시스템 프롬프트 제거 (왜곡 방지)',
        '웹 검색 모드 활성화',
        'AI 감성 분석',
        '환각 필터링',
      ],
    };
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: '크롤링 작업 상태 조회' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new Error('작업을 찾을 수 없습니다');
    return job;
  }

  @Get('responses/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 목록 조회 (반복 인덱스, 웹검색 여부 포함)' })
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
  @ApiOperation({ summary: '일일 점수 계산 (개선: 다수결 기반)' })
  async calculateScore(@Param('hospitalId') hospitalId: string) {
    const score = await this.aiCrawlerService.calculateDailyScore(hospitalId);
    return { hospitalId, score, date: new Date().toISOString() };
  }

  // ==================== 개선3: 경쟁사 AEO 측정 ====================

  @Post('competitor-aeo/:hospitalId/:competitorId')
  @ApiOperation({ 
    summary: '【개선3】경쟁사 AEO 점수 측정',
    description: '동일한 프롬프트로 경쟁사의 AI 가시성을 실제 측정합니다' 
  })
  async measureCompetitorAEO(
    @Param('hospitalId') hospitalId: string,
    @Param('competitorId') competitorId: string,
  ) {
    const competitor = await this.prisma.competitor.findUnique({
      where: { id: competitorId },
    });

    if (!competitor) throw new Error('경쟁사를 찾을 수 없습니다');

    const result = await this.aiCrawlerService.measureCompetitorAEO(
      hospitalId,
      competitorId,
      competitor.competitorName,
    );

    return {
      competitorName: competitor.competitorName,
      ...result,
    };
  }

  @Post('competitor-aeo-all/:hospitalId')
  @ApiOperation({ 
    summary: '【개선3】모든 경쟁사 AEO 일괄 측정',
    description: '등록된 모든 활성 경쟁사의 AEO 점수를 측정합니다' 
  })
  async measureAllCompetitorAEO(@Param('hospitalId') hospitalId: string) {
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
    });

    const results = [];
    for (const competitor of competitors) {
      try {
        const result = await this.aiCrawlerService.measureCompetitorAEO(
          hospitalId,
          competitor.id,
          competitor.competitorName,
        );
        results.push({
          competitorId: competitor.id,
          competitorName: competitor.competitorName,
          ...result,
        });
      } catch (error) {
        results.push({
          competitorId: competitor.id,
          competitorName: competitor.competitorName,
          error: error.message,
        });
      }
      
      // 경쟁사 간 딜레이
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return {
      hospitalId,
      totalCompetitors: competitors.length,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 개선4: 프롬프트별 성과 분석 ====================

  @Get('prompt-performance/:hospitalId')
  @ApiOperation({ 
    summary: '【개선4】프롬프트별 성과 분석',
    description: '각 프롬프트의 플랫폼별 언급률, 순위, 감성, 경쟁사 등 상세 분석' 
  })
  async getPromptPerformance(@Param('hospitalId') hospitalId: string) {
    return this.aiCrawlerService.getPromptPerformance(hospitalId);
  }

  // ==================== 개선5: Content Gap 분석 ====================

  @Post('content-gap/:hospitalId')
  @ApiOperation({ 
    summary: '【개선5】Content Gap 분석 + AI 개선 가이드',
    description: 'AI가 경쟁사 대비 부족한 콘텐츠를 분석하고 개선 전략을 제안합니다' 
  })
  async analyzeContentGap(@Param('hospitalId') hospitalId: string) {
    const gaps = await this.aiCrawlerService.generateContentGapGuide(hospitalId);
    return {
      hospitalId,
      totalGaps: gaps.length,
      gaps,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 개선10: 환각 검증 ====================

  @Get('verify-hospital/:hospitalName')
  @ApiOperation({ 
    summary: '【개선10】병원 실존 여부 검증',
    description: '패턴 기반으로 병원명의 실존 여부를 검증합니다' 
  })
  async verifyHospital(
    @Param('hospitalName') hospitalName: string,
    @Query('region') region?: string,
  ) {
    return this.aiCrawlerService.verifyHospitalExists(hospitalName, region);
  }

  // ==================== 크롤링 실행 로직 ====================

  private async executeCrawling(
    jobId: string,
    hospital: any,
    prompts: any[],
  ) {
    let completed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    console.log(`[Crawl] 시작: ${hospital.name}, 프롬프트 ${prompts.length}개 (3회 반복 측정)`);

    // 플랫폼 결정: 찐 AI만 (ChatGPT, Claude, Perplexity, Gemini)
    const platforms: any[] = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'];

    for (const prompt of prompts) {
      try {
        console.log(`[Crawl] 프롬프트: ${prompt.promptText.substring(0, 30)}...`);
        const results = await this.aiCrawlerService.queryAllPlatforms(
          prompt.id,
          hospital.id,
          hospital.name,
          prompt.promptText,
          platforms,
        );
        console.log(`[Crawl] 결과: ${results.length}개 응답`);
        
        if (results.length > 0) {
          completed++;
        } else {
          failed++;
          errors.push(`${prompt.promptText.substring(0, 20)}: 응답 없음`);
        }
      } catch (error) {
        failed++;
        errors.push(`${prompt.promptText.substring(0, 20)}: ${error.message}`);
        console.error(`[Crawl] 에러: ${error.message}`);
      }

      await this.prisma.crawlJob.update({
        where: { id: jobId },
        data: { completed, failed },
      });
    }

    const errorMessage = errors.length > 0 ? errors.join('; ') : null;
    await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: failed === prompts.length ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        errorMessage,
      },
    });
    
    console.log(`[Crawl] 완료: completed=${completed}, failed=${failed}`);

    if (completed > 0) {
      await this.aiCrawlerService.calculateDailyScore(hospital.id);
    }
  }
}
