// ABHS Weight Service (Phase A - Tier 1)
// 책임: DB에서 가중치 lookup, 캘리브레이션 결과 저장, 인메모리 캐시 관리
//
// 우선순위 규칙: HOSPITAL > SPECIALTY > GLOBAL > 코드 하드코딩 fallback
//   - hospitalId가 주어지면: HOSPITAL 프로파일 먼저 찾고, 없으면 SPECIALTY, 그래도 없으면 GLOBAL
//   - 어느 단계에서도 못 찾으면 DEFAULT_WEIGHTS (코드 fallback)
//
// 캐시 전략:
//   - 메모리 캐시 TTL 5분
//   - 캘리브레이션 저장 시 자동 invalidate

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WeightKind, WeightScope, Prisma } from '@prisma/client';

// ============ 코드 fallback (DB 비어있을 때 안전망) ============
export const FALLBACK_WEIGHTS = {
  PLATFORM: {
    PERPLEXITY: 1.4,
    CHATGPT: 1.3,
    GEMINI: 1.2,
    CLAUDE: 1.0,
  } as Record<string, number>,
  DEPTH: {
    R3: 4.0,
    R2: 3.0,
    R1: 1.5,
    R0: 0.0,
  } as Record<string, number>,
  INTENT: {
    RESERVATION: 1.5,
    REVIEW: 1.3,
    FEAR: 1.2,
    COMPARISON: 1.1,
    INFORMATION: 1.0,
  } as Record<string, number>,
  SENTIMENT: {
    '-2': 0.0,
    '-1': 0.25,
    '0': 0.5,
    '1': 1.0,
    '2': 1.5,
  } as Record<string, number>,
};

// ============ 캐시 ============
interface CacheEntry {
  weights: Record<string, number>;
  fetchedAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

interface WeightLookupContext {
  hospitalId?: string;
  specialtyCategory?: string; // ex: 'DENTAL', 'DERMATOLOGY'
}

export interface CalibrationSnapshot {
  scope: WeightScope;
  scopeKey: string;
  dataRangeDays: number;
  responsesAnalyzed: number;
  hospitalsAnalyzed: number;
  triggeredBy?: string;
  weights: {
    PLATFORM: Record<string, { value: number; evidence?: any }>;
    DEPTH: Record<string, { value: number; evidence?: any }>;
    INTENT: Record<string, { value: number; evidence?: any }>;
    SENTIMENT?: Record<string, { value: number; evidence?: any }>;
  };
  weightDiffs?: Record<string, any>;
  scoreImpact?: any;
  insights?: string[];
  activate?: boolean; // true면 저장과 동시에 활성화(이전 RUN deactivate)
}

@Injectable()
export class WeightService {
  private readonly logger = new Logger(WeightService.name);
  private cache: Map<string, CacheEntry> = new Map();

  constructor(private prisma: PrismaService) {}

  // ============ Public API: 가중치 조회 ============

  /**
   * 단일 가중치 값을 lookup. HOSPITAL > SPECIALTY > GLOBAL > FALLBACK 순.
   */
  async getWeight(
    kind: WeightKind,
    weightKey: string,
    ctx: WeightLookupContext = {},
  ): Promise<number> {
    const all = await this.getWeightsByKind(kind, ctx);
    if (all[weightKey] !== undefined) return all[weightKey];
    const fallback = FALLBACK_WEIGHTS[kind as keyof typeof FALLBACK_WEIGHTS];
    return fallback?.[weightKey] ?? 0;
  }

  /**
   * 특정 Kind의 모든 가중치 맵을 조회 (캐시됨).
   * HOSPITAL 프로파일에 없는 key는 SPECIALTY에서 보충, 그래도 없으면 GLOBAL에서 보충.
   */
  async getWeightsByKind(
    kind: WeightKind,
    ctx: WeightLookupContext = {},
  ): Promise<Record<string, number>> {
    const cacheKey = `${kind}::${ctx.hospitalId || ''}::${ctx.specialtyCategory || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.weights;
    }

    // 3단 lookup
    const result: Record<string, number> = { ...(FALLBACK_WEIGHTS[kind as keyof typeof FALLBACK_WEIGHTS] || {}) };

    // GLOBAL 먼저 적용
    const globalRows = await this.prisma.weightProfile.findMany({
      where: { kind, scope: 'GLOBAL', isActive: true },
      select: { weightKey: true, weightValue: true },
    });
    globalRows.forEach(r => { result[r.weightKey] = r.weightValue; });

    // SPECIALTY 덮어쓰기
    if (ctx.specialtyCategory) {
      const specialtyRows = await this.prisma.weightProfile.findMany({
        where: { kind, scope: 'SPECIALTY', scopeKey: ctx.specialtyCategory, isActive: true },
        select: { weightKey: true, weightValue: true },
      });
      specialtyRows.forEach(r => { result[r.weightKey] = r.weightValue; });
    }

    // HOSPITAL 덮어쓰기 (최우선)
    if (ctx.hospitalId) {
      const hospRows = await this.prisma.weightProfile.findMany({
        where: { kind, scope: 'HOSPITAL', scopeKey: ctx.hospitalId, isActive: true },
        select: { weightKey: true, weightValue: true },
      });
      hospRows.forEach(r => { result[r.weightKey] = r.weightValue; });
    }

    this.cache.set(cacheKey, { weights: result, fetchedAt: Date.now() });
    return result;
  }

  /**
   * ABHS 서비스용 통합 가중치 번들 (4종 한번에)
   */
  async getWeightBundle(ctx: WeightLookupContext = {}) {
    const [platform, depth, intent, sentiment] = await Promise.all([
      this.getWeightsByKind('PLATFORM', ctx),
      this.getWeightsByKind('DEPTH', ctx),
      this.getWeightsByKind('INTENT', ctx),
      this.getWeightsByKind('SENTIMENT', ctx),
    ]);
    return { platform, depth, intent, sentiment };
  }

  // ============ Public API: 캘리브레이션 저장 ============

  /**
   * 캘리브레이션 결과를 DB에 저장하고, activate=true이면 즉시 활성화
   * 기존 동일 scope+scopeKey의 활성 RUN은 deactivate됨 (히스토리 유지)
   */
  async saveCalibration(snapshot: CalibrationSnapshot): Promise<{
    runId: string;
    profilesUpserted: number;
    activated: boolean;
  }> {
    this.logger.log(
      `Saving calibration: scope=${snapshot.scope}, scopeKey=${snapshot.scopeKey}, ` +
      `responses=${snapshot.responsesAnalyzed}, activate=${snapshot.activate}`,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 새 CalibrationRun 생성
      const run = await tx.weightCalibrationRun.create({
        data: {
          triggeredBy: snapshot.triggeredBy || 'SYSTEM',
          scope: snapshot.scope,
          scopeKey: snapshot.scopeKey,
          dataRangeDays: snapshot.dataRangeDays,
          responsesAnalyzed: snapshot.responsesAnalyzed,
          hospitalsAnalyzed: snapshot.hospitalsAnalyzed,
          status: 'COMPLETED',
          insightsJson: snapshot.insights ?? Prisma.JsonNull,
          weightDiffs: snapshot.weightDiffs ?? Prisma.JsonNull,
          scoreImpactJson: snapshot.scoreImpact ?? Prisma.JsonNull,
          isActive: false, // activate는 별도 로직에서
        },
      });

      // 2. 활성화 요청 시: 이전 활성 RUN을 비활성화 + 이전 활성 프로파일 비활성화
      if (snapshot.activate) {
        await tx.weightCalibrationRun.updateMany({
          where: {
            scope: snapshot.scope,
            scopeKey: snapshot.scopeKey,
            isActive: true,
            id: { not: run.id },
          },
          data: { isActive: false },
        });

        // 이전 CALIBRATED 프로파일들을 비활성화 (DEFAULT는 보존)
        await tx.weightProfile.updateMany({
          where: {
            scope: snapshot.scope,
            scopeKey: snapshot.scopeKey,
            source: 'CALIBRATED',
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      // 3. 새 가중치 프로파일 upsert
      let upserted = 0;
      for (const kindStr of ['PLATFORM', 'DEPTH', 'INTENT', 'SENTIMENT'] as WeightKind[]) {
        const kindWeights = snapshot.weights[kindStr];
        if (!kindWeights) continue;

        for (const [weightKey, payload] of Object.entries(kindWeights)) {
          await tx.weightProfile.upsert({
            where: {
              scope_scopeKey_kind_weightKey: {
                scope: snapshot.scope,
                scopeKey: snapshot.scopeKey,
                kind: kindStr,
                weightKey,
              },
            },
            create: {
              scope: snapshot.scope,
              scopeKey: snapshot.scopeKey,
              kind: kindStr,
              weightKey,
              weightValue: payload.value,
              source: 'CALIBRATED',
              calibrationRunId: run.id,
              evidence: payload.evidence ?? Prisma.JsonNull,
              isActive: !!snapshot.activate,
            },
            update: {
              weightValue: payload.value,
              source: 'CALIBRATED',
              calibrationRunId: run.id,
              evidence: payload.evidence ?? Prisma.JsonNull,
              isActive: !!snapshot.activate,
            },
          });
          upserted++;
        }
      }

      // 4. activate 요청이면 RUN도 활성화 마킹
      if (snapshot.activate) {
        await tx.weightCalibrationRun.update({
          where: { id: run.id },
          data: {
            isActive: true,
            activatedAt: new Date(),
            activatedBy: snapshot.triggeredBy || 'SYSTEM',
          },
        });
      }

      return { runId: run.id, profilesUpserted: upserted, activated: !!snapshot.activate };
    }, { timeout: 60_000 });

    // 캐시 invalidate
    this.invalidateCache();

    this.logger.log(`✅ Calibration saved: runId=${result.runId}, upserted=${result.profilesUpserted}`);
    return result;
  }

  /**
   * 캘리브레이션 RUN 활성화 (이미 저장된 RUN을 나중에 활성화하고 싶을 때)
   */
  async activateRun(runId: string, activatedBy = 'SYSTEM'): Promise<void> {
    const run = await this.prisma.weightCalibrationRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`CalibrationRun not found: ${runId}`);

    await this.prisma.$transaction(async (tx) => {
      // 같은 scope의 다른 RUN 비활성화
      await tx.weightCalibrationRun.updateMany({
        where: { scope: run.scope, scopeKey: run.scopeKey, isActive: true, id: { not: runId } },
        data: { isActive: false },
      });
      // 같은 scope의 CALIBRATED 프로파일 비활성화
      await tx.weightProfile.updateMany({
        where: {
          scope: run.scope,
          scopeKey: run.scopeKey,
          source: 'CALIBRATED',
          isActive: true,
          calibrationRunId: { not: runId },
        },
        data: { isActive: false },
      });
      // 해당 RUN의 프로파일 활성화
      await tx.weightProfile.updateMany({
        where: { calibrationRunId: runId },
        data: { isActive: true },
      });
      // RUN 활성화
      await tx.weightCalibrationRun.update({
        where: { id: runId },
        data: { isActive: true, activatedAt: new Date(), activatedBy },
      });
    });

    this.invalidateCache();
    this.logger.log(`✅ Run activated: ${runId}`);
  }

  /**
   * 가중치 RUN 롤백 — 직전 활성 RUN으로 되돌림 (없으면 DEFAULT로 복귀)
   */
  async rollback(scope: WeightScope = 'GLOBAL', scopeKey = 'GLOBAL'): Promise<{
    rolledBackTo: string | null;
  }> {
    const previousRun = await this.prisma.weightCalibrationRun.findFirst({
      where: { scope, scopeKey, status: 'COMPLETED', isActive: false },
      orderBy: { createdAt: 'desc' },
    });

    if (previousRun) {
      await this.activateRun(previousRun.id, 'ROLLBACK');
      return { rolledBackTo: previousRun.id };
    }

    // 이전 RUN이 없으면 DEFAULT 프로파일만 활성으로 복귀
    await this.prisma.$transaction(async (tx) => {
      await tx.weightCalibrationRun.updateMany({
        where: { scope, scopeKey, isActive: true },
        data: { isActive: false },
      });
      await tx.weightProfile.updateMany({
        where: { scope, scopeKey, source: 'CALIBRATED' },
        data: { isActive: false },
      });
      await tx.weightProfile.updateMany({
        where: { scope, scopeKey, source: 'DEFAULT' },
        data: { isActive: true },
      });
    });

    this.invalidateCache();
    return { rolledBackTo: null };
  }

  // ============ Public API: 관리/조회 ============

  /**
   * 현재 활성 RUN 정보 (스코프별)
   */
  async getActiveRun(scope: WeightScope = 'GLOBAL', scopeKey = 'GLOBAL') {
    return this.prisma.weightCalibrationRun.findFirst({
      where: { scope, scopeKey, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 캘리브레이션 RUN 히스토리
   */
  async getRunHistory(scope: WeightScope = 'GLOBAL', scopeKey = 'GLOBAL', limit = 20) {
    return this.prisma.weightCalibrationRun.findMany({
      where: { scope, scopeKey },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 단일 RUN 상세 + 해당 RUN이 만든 프로파일 목록
   */
  async getRunDetail(runId: string) {
    const run = await this.prisma.weightCalibrationRun.findUnique({
      where: { id: runId },
    });
    if (!run) return null;

    const profiles = await this.prisma.weightProfile.findMany({
      where: { calibrationRunId: runId },
      orderBy: [{ kind: 'asc' }, { weightKey: 'asc' }],
    });

    const groupedProfiles: Record<string, Array<{ key: string; value: number; isActive: boolean; evidence: any }>> = {};
    for (const p of profiles) {
      if (!groupedProfiles[p.kind]) groupedProfiles[p.kind] = [];
      groupedProfiles[p.kind].push({
        key: p.weightKey,
        value: p.weightValue,
        isActive: p.isActive,
        evidence: p.evidence,
      });
    }

    return {
      run,
      profiles: groupedProfiles,
      profileCount: profiles.length,
    };
  }

  /**
   * 모든 활성 가중치 dump (관리자 대시보드용)
   */
  async dumpActiveWeights(scope: WeightScope = 'GLOBAL', scopeKey = 'GLOBAL') {
    const profiles = await this.prisma.weightProfile.findMany({
      where: { scope, scopeKey, isActive: true },
      orderBy: [{ kind: 'asc' }, { weightKey: 'asc' }],
    });
    const grouped: Record<string, Array<{ key: string; value: number; source: string; evidence: any }>> = {};
    for (const p of profiles) {
      if (!grouped[p.kind]) grouped[p.kind] = [];
      grouped[p.kind].push({
        key: p.weightKey,
        value: p.weightValue,
        source: p.source,
        evidence: p.evidence,
      });
    }
    return grouped;
  }

  invalidateCache() {
    this.cache.clear();
  }
}
