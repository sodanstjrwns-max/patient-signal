import { Controller, Post, Get, Headers, UnauthorizedException, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  generateMatrixCandidates,
  selectDailyPrompts,
  getMatrixStats,
} from './daily-prompt-matrix';

@ApiTags('스케줄러')
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private schedulerService: SchedulerService,
    private prisma: PrismaService,
  ) {}

  /**
   * Cron Job 엔드포인트 - 자동 크롤링
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
   * Daily Prompt Refresh V3 - 5×5 매트릭스 엔진
   * Cron: 매일 오전 8시 (KST) - 크롤링 전에 실행
   */
  @Post('daily-prompt-refresh')
  @ApiOperation({ summary: '일일 자동 프롬프트 생성 V3 (5×5 매트릭스 엔진)' })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async dailyPromptRefresh(
    @Headers('x-cron-secret') cronSecret: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runDailyPromptRefresh();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      engine: 'v3-matrix',
      ...result,
    };
  }

  /**
   * 매트릭스 미리보기 (저장 없이)
   * 프론트엔드에서 어떤 후보가 생성되는지 확인용
   */
  @Get('matrix-preview/:hospitalId')
  @ApiOperation({ summary: '매트릭스 프롬프트 후보 미리보기 (저장 없이)' })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async matrixPreview(@Param('hospitalId') hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        prompts: { where: { isActive: true }, select: { promptText: true } },
      },
    });

    if (!hospital) {
      return { error: '병원을 찾을 수 없습니다' };
    }

    // 매트릭스 후보 생성
    const candidates = generateMatrixCandidates({
      name: hospital.name,
      specialtyType: hospital.specialtyType,
      regionSido: hospital.regionSido,
      regionSigungu: hospital.regionSigungu,
      regionDong: hospital.regionDong,
      coreTreatments: hospital.coreTreatments || [],
      keyProcedures: hospital.keyProcedures || [],
      targetRegions: hospital.targetRegions || [],
      hospitalStrengths: hospital.hospitalStrengths || [],
    });

    const stats = getMatrixStats(candidates);

    // 기존 프롬프트와 비교해서 선택
    const existingTexts = new Set<string>(hospital.prompts.map(p => p.promptText));
    const selected = selectDailyPrompts(candidates, existingTexts, 10, true);

    return {
      hospital: {
        name: hospital.name,
        specialty: hospital.specialtyType,
        region: `${hospital.regionSido} ${hospital.regionSigungu}`,
        procedures: hospital.keyProcedures?.length ? hospital.keyProcedures : hospital.coreTreatments,
        strengths: hospital.hospitalStrengths,
      },
      matrix: {
        totalCandidates: stats.totalCandidates,
        byIntent: stats.byIntent,
        byTone: stats.byTone,
        bySeason: stats.bySeason,
        byProcedure: stats.byProcedure,
      },
      existingCount: hospital.prompts.length,
      todaySelection: selected.map(s => ({
        text: s.text,
        intent: s.intent,
        tone: s.tone,
        season: s.season,
        weight: Math.round(s.weight * 100) / 100,
        procedure: s.procedure,
      })),
      todayCount: selected.length,
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
      version: 'v3.0 - 5×5 병원 범용 매트릭스 엔진',
      platforms: ['ChatGPT', 'Claude', 'Perplexity', 'Gemini'],
      engine: {
        name: 'Daily Prompt Matrix V3',
        axes: [
          '축1: Intent (RESERVATION, COMPARISON, INFORMATION, REVIEW, FEAR)',
          '축2: Procedure (병원 핵심 시술 최대 5개)',
          '축3: Tone (구어체, 정중체, 비교형, 감성형, 전문형)',
          '축4: Season (월별 시즌, 요일, 명절, 개학)',
          '축5: Region (시군구, 동, 타겟지역, 약식)',
        ],
        features: [
          'ABHS 성과 기반 가중치 부스팅',
          'Jaccard 유사도 0.85 중복 제거',
          '의도×톤 다양성 보장 선택',
          '진료과별 증상 기반 템플릿',
          '강점/경쟁사 비교 보너스 템플릿',
          '13개 진료과 범용 대응',
        ],
      },
      cronSchedule: {
        promptRefresh: '매일 오전 8시 (KST) - 5×5 매트릭스 프롬프트 생성',
        dailyCrawl: '매일 오전 9시 (KST) - 전체 플랫폼 크롤링',
      },
      supportedSpecialties: [
        'DENTAL (치과)', 'DERMATOLOGY (피부과)', 'PLASTIC_SURGERY (성형외과)',
        'ORTHOPEDICS (정형외과)', 'KOREAN_MEDICINE (한의원)', 'OPHTHALMOLOGY (안과)',
        'INTERNAL_MEDICINE (내과)', 'UROLOGY (비뇨기과)', 'ENT (이비인후과)',
        'PSYCHIATRY (정신건강의학과)', 'OBSTETRICS (산부인과)', 'PEDIATRICS (소아과)',
      ],
      lastCheck: new Date().toISOString(),
    };
  }
}
