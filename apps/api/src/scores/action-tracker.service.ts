import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { FunnelStage } from './funnel.service';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【본질 강화 1】액션 임팩트 트래커
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * "측정 → 처방 → 실행 → 재측정" 루프의 마지막 조각.
 *
 * 기존: 플레이북이 "블로그 쓰세요" 처방만 하고 끝 → 효과 검증 불가
 * 개선: 액션 실행 시작 시점의 퍼널 단계 지표(SoV/감성/R3)를 스냅샷으로 동결
 *       → 이후 크롤링 데이터로 자동 재측정
 *       → "이 액션으로 비교 단계 SoV +8%p" 인과를 제품 안에서 증명
 *
 * 상태 머신:
 *   시작(IN_PROGRESS, baseline 스냅샷)
 *     → 매일 재측정 (MEASURING: 표본 부족 or 14일 미경과)
 *     → 판정 (IMPROVED / FLAT / DECLINED)
 *     → 완료(COMPLETED) 시 최종 성과 동결
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const INTENT_TO_STAGE: Record<string, FunnelStage> = {
  INFORMATION: 'AWARENESS',
  COMPARISON: 'COMPARISON',
  REVIEW: 'TRUST',
  FEAR: 'TRUST',
  RESERVATION: 'DECISION',
};

const STAGE_INTENTS: Record<FunnelStage, string[]> = {
  AWARENESS: ['INFORMATION'],
  COMPARISON: ['COMPARISON'],
  TRUST: ['REVIEW', 'FEAR'],
  DECISION: ['RESERVATION'],
};

const VALID_STAGES: FunnelStage[] = ['AWARENESS', 'COMPARISON', 'TRUST', 'DECISION'];

// 판정 기준
const BASELINE_WINDOW_DAYS = 14;      // 베이스라인 측정 윈도우
const OUTCOME_WINDOW_DAYS = 14;       // 성과 측정 윈도우 (최근 14일)
const MIN_JUDGE_DAYS = 14;            // 판정까지 최소 경과일 (콘텐츠 반영 시차 고려)
const MIN_SAMPLE_RESPONSES = 10;      // 판정 최소 표본 수
const IMPROVE_THRESHOLD = 3;          // SoV +3%p 이상 = 개선
const DECLINE_THRESHOLD = -3;         // SoV -3%p 이하 = 악화

export interface StageMetrics {
  sov: number;
  avgSentiment: number | null;
  r3Rate: number;
  totalResponses: number;
}

export interface StartActionDto {
  funnelStage: string;
  title: string;
  description?: string;
  expectedEffect?: string;
  priority?: string;
  effort?: string;
  source?: string; // PLAYBOOK / MANUAL
}

@Injectable()
export class ActionTrackerService {
  private readonly logger = new Logger(ActionTrackerService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * 특정 퍼널 단계의 지표 계산 (기간 윈도우)
   */
  private async computeStageMetrics(
    hospitalId: string,
    stage: FunnelStage,
    since: Date,
    until?: Date,
  ): Promise<StageMetrics> {
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        queryIntent: { in: STAGE_INTENTS[stage] as any },
        responseDate: { gte: since, ...(until ? { lte: until } : {}) },
      },
      select: {
        isMentioned: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
      },
    });

    const total = responses.length;
    const mentioned = responses.filter((r) => r.isMentioned).length;
    const sov = total > 0 ? Math.round((mentioned / total) * 1000) / 10 : 0;

    const sentiments = responses
      .filter((r) => r.isMentioned && r.sentimentScoreV2 !== null)
      .map((r) => r.sentimentScoreV2 as number);
    const avgSentiment = sentiments.length > 0
      ? Math.round((sentiments.reduce((a, b) => a + b, 0) / sentiments.length) * 100) / 100
      : null;

    const r3Count = responses.filter((r) => r.recommendationDepth === 'R3').length;
    const r3Rate = total > 0 ? Math.round((r3Count / total) * 1000) / 10 : 0;

    return { sov, avgSentiment, r3Rate, totalResponses: total };
  }

  /**
   * 액션 추적 시작 — 베이스라인 스냅샷 동결
   */
  async startAction(hospitalId: string, dto: StartActionDto) {
    const stage = (dto.funnelStage || '').toUpperCase() as FunnelStage;
    if (!VALID_STAGES.includes(stage)) {
      throw new BadRequestException(`유효하지 않은 퍼널 단계: ${dto.funnelStage}`);
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('액션 제목이 필요합니다.');
    }

    // 동일 제목의 진행중 액션 중복 방지
    const existing = await this.prisma.improvementAction.findFirst({
      where: {
        hospitalId,
        title: dto.title,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
    if (existing) {
      return { alreadyTracking: true, action: existing };
    }

    // 베이스라인 스냅샷: 최근 14일 단계 지표
    const since = new Date();
    since.setDate(since.getDate() - BASELINE_WINDOW_DAYS);
    const baseline = await this.computeStageMetrics(hospitalId, stage, since);

    const action = await this.prisma.improvementAction.create({
      data: {
        hospitalId,
        actionType: 'FUNNEL_PLAYBOOK',
        title: dto.title,
        description: dto.description,
        status: 'IN_PROGRESS',
        funnelStage: stage,
        expectedEffect: dto.expectedEffect,
        priority: dto.priority,
        effort: dto.effort,
        source: dto.source || 'PLAYBOOK',
        baselineSov: baseline.sov,
        baselineSentiment: baseline.avgSentiment,
        baselineR3Rate: baseline.r3Rate,
        baselineResponses: baseline.totalResponses,
        baselineWindowDays: BASELINE_WINDOW_DAYS,
        startedAt: new Date(),
        outcomeStatus: 'MEASURING',
      },
    });

    await this.cache.invalidateHospital(hospitalId).catch(() => undefined);

    this.logger.log(
      `액션 추적 시작 [${hospitalId}] "${dto.title}" (${stage}) — 베이스라인 SoV ${baseline.sov}% (표본 ${baseline.totalResponses})`,
    );

    return { alreadyTracking: false, action };
  }

  /**
   * 진행중 액션 성과 재측정 (단일 병원 or 전체)
   * — 매일 크롤링 후 Cron으로 자동 실행
   */
  async measureOutcomes(hospitalId?: string) {
    const actions = await this.prisma.improvementAction.findMany({
      where: {
        status: 'IN_PROGRESS',
        funnelStage: { not: null },
        startedAt: { not: null },
        ...(hospitalId ? { hospitalId } : {}),
      },
    });

    let measured = 0;
    const results: any[] = [];

    for (const action of actions) {
      try {
        const stage = action.funnelStage as FunnelStage;
        const outcomeSince = new Date();
        outcomeSince.setDate(outcomeSince.getDate() - OUTCOME_WINDOW_DAYS);
        // 성과 윈도우는 시작 시점 이후 데이터만 (시작 전 데이터 혼입 방지)
        const effectiveSince = action.startedAt! > outcomeSince ? action.startedAt! : outcomeSince;

        const outcome = await this.computeStageMetrics(action.hospitalId, stage, effectiveSince);
        const deltaSov = action.baselineSov !== null
          ? Math.round((outcome.sov - action.baselineSov) * 10) / 10
          : null;

        const daysSinceStart = Math.floor(
          (Date.now() - action.startedAt!.getTime()) / (1000 * 60 * 60 * 24),
        );

        let outcomeStatus = 'MEASURING';
        if (daysSinceStart >= MIN_JUDGE_DAYS && outcome.totalResponses >= MIN_SAMPLE_RESPONSES && deltaSov !== null) {
          outcomeStatus =
            deltaSov >= IMPROVE_THRESHOLD ? 'IMPROVED'
            : deltaSov <= DECLINE_THRESHOLD ? 'DECLINED'
            : 'FLAT';
        }

        await this.prisma.improvementAction.update({
          where: { id: action.id },
          data: {
            outcomeSov: outcome.sov,
            outcomeDeltaSov: deltaSov,
            outcomeStatus,
            lastMeasuredAt: new Date(),
          },
        });

        measured++;
        results.push({
          actionId: action.id,
          hospitalId: action.hospitalId,
          title: action.title,
          stage,
          baselineSov: action.baselineSov,
          outcomeSov: outcome.sov,
          deltaSov,
          outcomeStatus,
          daysSinceStart,
        });
      } catch (err: any) {
        this.logger.error(`액션 재측정 실패 [${action.id}]: ${err.message}`);
      }
    }

    if (measured > 0) {
      this.logger.log(`액션 임팩트 재측정 완료: ${measured}/${actions.length}건`);
      // 재측정된 병원들 캐시 무효화
      const hospitalIds = [...new Set(results.map((r) => r.hospitalId))];
      for (const hid of hospitalIds) {
        await this.cache.invalidateHospital(hid).catch(() => undefined);
      }
    }

    return { totalActions: actions.length, measured, results };
  }

  /**
   * 병원의 액션 임팩트 목록 (대시보드용)
   */
  async getActionImpacts(hospitalId: string) {
    const actions = await this.prisma.improvementAction.findMany({
      where: { hospitalId, actionType: 'FUNNEL_PLAYBOOK' },
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      take: 50,
    });

    const active = actions.filter((a) => a.status === 'IN_PROGRESS');
    const completed = actions.filter((a) => a.status === 'COMPLETED');

    // 성과 요약: 개선된 액션들의 총 SoV 상승분
    const improvedActions = actions.filter((a) => a.outcomeStatus === 'IMPROVED');
    const totalSovGain = improvedActions.reduce((sum, a) => sum + (a.outcomeDeltaSov || 0), 0);

    return {
      summary: {
        activeCount: active.length,
        completedCount: completed.length,
        improvedCount: improvedActions.length,
        totalSovGain: Math.round(totalSovGain * 10) / 10,
      },
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        funnelStage: a.funnelStage,
        expectedEffect: a.expectedEffect,
        priority: a.priority,
        effort: a.effort,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        baseline: {
          sov: a.baselineSov,
          sentiment: a.baselineSentiment,
          r3Rate: a.baselineR3Rate,
          responses: a.baselineResponses,
          windowDays: a.baselineWindowDays,
        },
        outcome: {
          sov: a.outcomeSov,
          deltaSov: a.outcomeDeltaSov,
          status: a.outcomeStatus,
          lastMeasuredAt: a.lastMeasuredAt,
        },
        daysSinceStart: a.startedAt
          ? Math.floor((Date.now() - a.startedAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
    };
  }

  /**
   * 액션 상태 변경 (완료/중단)
   */
  async updateActionStatus(hospitalId: string, actionId: string, status: 'COMPLETED' | 'DISMISSED') {
    const action = await this.prisma.improvementAction.findFirst({
      where: { id: actionId, hospitalId },
    });
    if (!action) throw new NotFoundException('액션을 찾을 수 없습니다.');

    // 완료 시 최종 성과 한 번 더 측정해서 동결
    if (status === 'COMPLETED' && action.funnelStage && action.startedAt) {
      await this.measureOutcomes(hospitalId);
    }

    const updated = await this.prisma.improvementAction.update({
      where: { id: actionId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    await this.cache.invalidateHospital(hospitalId).catch(() => undefined);
    return updated;
  }
}
