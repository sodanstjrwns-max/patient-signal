import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { FunnelStage } from './funnel.service';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【본질 강화 2】실측 퍼널 벤치마크
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 하드코딩 벤치마크(15/30/25/40%)를 전체 고객 병원의 실측 분포로 대체.
 *
 * - 진료과 × 퍼널 단계별로 전 병원의 최근 30일 SoV 분포 집계
 * - p25/p50/p75 percentile 산출 → 벤치마크 = p75 (상위 25% 병원 수준)
 * - 표본 병원 수가 부족한 진료과는 하드코딩 기본값으로 자동 fallback
 *
 * 이것이 데이터 해자: 기능은 베껴도 축적된 병원 분포 데이터는 못 베낌.
 * 병원이 쌓일수록 "강남 피부과 상위 25%는 신뢰 단계 SoV 32%" 같은
 * 실측 기준이 저절로 정교해짐.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const STAGE_INTENTS: Record<FunnelStage, string[]> = {
  AWARENESS: ['INFORMATION'],
  COMPARISON: ['COMPARISON'],
  TRUST: ['REVIEW', 'FEAR'],
  DECISION: ['RESERVATION'],
};

const STAGES: FunnelStage[] = ['AWARENESS', 'COMPARISON', 'TRUST', 'DECISION'];

// 하드코딩 기본값 (실측 표본 부족 시 fallback)
export const DEFAULT_BENCHMARKS: Record<FunnelStage, number> = {
  AWARENESS: 15,
  COMPARISON: 30,
  TRUST: 25,
  DECISION: 40,
};

// 실측 벤치마크 채택 최소 조건
const MIN_SAMPLE_HOSPITALS = 5;        // 진료과별 최소 5개 병원
const MIN_RESPONSES_PER_HOSPITAL = 10; // 병원당 단계별 최소 10개 응답
const AGGREGATION_WINDOW_DAYS = 30;

export interface ResolvedBenchmark {
  stage: FunnelStage;
  benchmark: number;
  source: 'MEASURED' | 'DEFAULT';
  sampleHospitals?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  avgSov?: number;
  computedAt?: Date;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 전체 진료과 × 단계 벤치마크 재집계
   * — 매일 크롤링 완료 후 Cron으로 실행
   */
  async recomputeAll() {
    const since = new Date();
    since.setDate(since.getDate() - AGGREGATION_WINDOW_DAYS);

    // 활성 병원 전체 (진료과 포함)
    const hospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true, specialtyType: true },
    });

    // 병원별 × 단계별 SoV 계산 (쿼리 1방으로 전체 응답 groupBy)
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        responseDate: { gte: since },
        queryIntent: { not: null },
        hospitalId: { in: hospitals.map((h) => h.id) },
      },
      select: { hospitalId: true, queryIntent: true, isMentioned: true },
    });

    // hospitalId → stage → {total, mentioned}
    const stats = new Map<string, Record<FunnelStage, { total: number; mentioned: number }>>();
    const intentToStage: Record<string, FunnelStage> = {};
    for (const stage of STAGES) {
      for (const intent of STAGE_INTENTS[stage]) intentToStage[intent] = stage;
    }

    for (const r of responses) {
      const stage = intentToStage[r.queryIntent as string];
      if (!stage) continue;
      if (!stats.has(r.hospitalId)) {
        stats.set(r.hospitalId, {
          AWARENESS: { total: 0, mentioned: 0 },
          COMPARISON: { total: 0, mentioned: 0 },
          TRUST: { total: 0, mentioned: 0 },
          DECISION: { total: 0, mentioned: 0 },
        });
      }
      const s = stats.get(r.hospitalId)![stage];
      s.total++;
      if (r.isMentioned) s.mentioned++;
    }

    // 진료과별 그룹핑
    const hospitalsBySpecialty = new Map<string, string[]>();
    for (const h of hospitals) {
      const key = h.specialtyType as string;
      if (!hospitalsBySpecialty.has(key)) hospitalsBySpecialty.set(key, []);
      hospitalsBySpecialty.get(key)!.push(h.id);
    }

    let upserted = 0;
    const summary: any[] = [];

    for (const [specialty, hospitalIds] of hospitalsBySpecialty.entries()) {
      for (const stage of STAGES) {
        // 표본: 이 단계에서 충분한 응답이 있는 병원들의 SoV
        const sovValues: number[] = [];
        let totalResponses = 0;
        for (const hid of hospitalIds) {
          const s = stats.get(hid)?.[stage];
          if (!s || s.total < MIN_RESPONSES_PER_HOSPITAL) continue;
          sovValues.push((s.mentioned / s.total) * 100);
          totalResponses += s.total;
        }

        if (sovValues.length < MIN_SAMPLE_HOSPITALS) continue; // 표본 부족 → 저장 안 함 (fallback 유지)

        sovValues.sort((a, b) => a - b);
        const p25 = Math.round(percentile(sovValues, 0.25) * 10) / 10;
        const p50 = Math.round(percentile(sovValues, 0.5) * 10) / 10;
        const p75 = Math.round(percentile(sovValues, 0.75) * 10) / 10;
        const avg = Math.round((sovValues.reduce((a, b) => a + b, 0) / sovValues.length) * 10) / 10;
        // 벤치마크 = p75 (상위 25% 병원 수준). 단 기본값의 50% 미만으로 내려가지 않게 하한
        const benchmark = Math.max(p75, DEFAULT_BENCHMARKS[stage] * 0.5);

        await this.prisma.funnelBenchmark.upsert({
          where: {
            specialtyType_stage: { specialtyType: specialty as any, stage },
          },
          create: {
            specialtyType: specialty as any,
            stage,
            windowDays: AGGREGATION_WINDOW_DAYS,
            sampleHospitals: sovValues.length,
            sampleResponses: totalResponses,
            avgSov: avg,
            p25Sov: p25,
            p50Sov: p50,
            p75Sov: p75,
            benchmarkSov: Math.round(benchmark * 10) / 10,
          },
          update: {
            windowDays: AGGREGATION_WINDOW_DAYS,
            sampleHospitals: sovValues.length,
            sampleResponses: totalResponses,
            avgSov: avg,
            p25Sov: p25,
            p50Sov: p50,
            p75Sov: p75,
            benchmarkSov: Math.round(benchmark * 10) / 10,
            computedAt: new Date(),
          },
        });
        upserted++;
        summary.push({ specialty, stage, samples: sovValues.length, p25, p50, p75, benchmark: Math.round(benchmark * 10) / 10 });
      }
    }

    this.logger.log(`실측 벤치마크 재집계 완료: ${upserted}개 (진료과×단계) 갱신`);
    return { upserted, totalHospitals: hospitals.length, totalResponses: responses.length, summary };
  }

  /**
   * 진료과의 단계별 벤치마크 조회 (실측 우선, 부족 시 기본값 fallback)
   */
  async resolveBenchmarks(specialtyType: string): Promise<Record<FunnelStage, ResolvedBenchmark>> {
    const measured = await this.prisma.funnelBenchmark.findMany({
      where: { specialtyType: specialtyType as any },
    });
    const byStage = new Map(measured.map((m) => [m.stage, m]));

    const result = {} as Record<FunnelStage, ResolvedBenchmark>;
    for (const stage of STAGES) {
      const m = byStage.get(stage);
      if (m && m.sampleHospitals >= MIN_SAMPLE_HOSPITALS) {
        result[stage] = {
          stage,
          benchmark: m.benchmarkSov,
          source: 'MEASURED',
          sampleHospitals: m.sampleHospitals,
          p25: m.p25Sov,
          p50: m.p50Sov,
          p75: m.p75Sov,
          avgSov: m.avgSov,
          computedAt: m.computedAt,
        };
      } else {
        result[stage] = {
          stage,
          benchmark: DEFAULT_BENCHMARKS[stage],
          source: 'DEFAULT',
        };
      }
    }
    return result;
  }

  /**
   * 병원 SoV의 동료 그룹 내 위치 (percentile 랭킹 문구용)
   */
  positionInPeers(sov: number, bm: ResolvedBenchmark): string | null {
    if (bm.source !== 'MEASURED' || bm.p25 === undefined || bm.p50 === undefined || bm.p75 === undefined) {
      return null;
    }
    if (sov >= bm.p75) return '상위 25%';
    if (sov >= bm.p50) return '상위 50%';
    if (sov >= bm.p25) return '하위 50%';
    return '하위 25%';
  }
}
