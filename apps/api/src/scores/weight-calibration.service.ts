import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WeightService } from './weight.service';

/**
 * ABHS 가중치 캘리브레이션 서비스 (Tier 1)
 *
 * 목적: 직관 기반 하드코딩 가중치를 실데이터 기반으로 재산정
 * 사용처:
 *  - 주간 Cron (SchedulerService.runWeeklyWeightCalibration)
 *  - Admin API (수동 트리거)
 *
 * 베이스: scripts/abhs-weight-calibration.ts 와 동일한 산식
 *   - PLATFORM:  0.4×SoV + 0.25×Sentiment + 0.20×Confidence + 0.15×SourceRatio → 1.0~1.4
 *   - DEPTH:     Sentiment_norm × Confidence × (1 + scarcity_bonus) → R3=4.0 normalized
 *   - INTENT:    mentionRate × Sentiment_norm × (1 + R2R3_ratio × 0.5) → 1.0~1.5
 */

// 비교 베이스라인 (기존 하드코딩 값 — 변동 감지용)
const BASELINE_PLATFORM: Record<string, number> = {
  PERPLEXITY: 1.4, CHATGPT: 1.3, GEMINI: 1.2, CLAUDE: 1.0,
};
const BASELINE_DEPTH: Record<string, number> = {
  R3: 4.0, R2: 3.0, R1: 1.5, R0: 0.0,
};
const BASELINE_INTENT: Record<string, number> = {
  RESERVATION: 1.5, REVIEW: 1.3, FEAR: 1.2, COMPARISON: 1.1, INFORMATION: 1.0,
};

export interface CalibrationOptions {
  /** DB 저장 여부 (false면 dry-run) */
  save?: boolean;
  /** 저장 후 즉시 활성화 여부 — 자동 스케줄러에서는 항상 false */
  activate?: boolean;
  /** 호출자 식별 — RUN 레코드의 triggeredBy 필드 */
  triggeredBy?: string;
}

export interface CalibrationResult {
  generatedAt: string;
  dataScope: { totalResponses: number; rangeDays: number; activeHospitals: number };
  platformWeights: ReturnType<typeof emptyBlock>;
  depthScores: ReturnType<typeof emptyBlock>;
  intentMultipliers: ReturnType<typeof emptyBlock>;
  abhsScoreComparison: Array<{
    hospitalId: string;
    hospitalName: string;
    currentABHS: number;
    calibratedABHS: number;
    delta: number;
  }>;
  insights: string[];
  saved?: { runId: string; profilesUpserted: number; activated: boolean };
}

function emptyBlock() {
  return {
    current: {} as Record<string, number>,
    calibrated: {} as Record<string, number>,
    method: '',
    evidence: {} as Record<string, any>,
  };
}

@Injectable()
export class WeightCalibrationService {
  private readonly logger = new Logger(WeightCalibrationService.name);

  constructor(
    private prisma: PrismaService,
    private weightService: WeightService,
  ) {}

  /**
   * 전체 캘리브레이션 파이프라인 실행
   */
  async runCalibration(opts: CalibrationOptions = {}): Promise<CalibrationResult> {
    const SAVE = opts.save ?? false;
    const ACTIVATE = opts.activate ?? false;
    const triggeredBy = opts.triggeredBy ?? 'SYSTEM';
    const mode = ACTIVATE ? 'SAVE+ACTIVATE' : SAVE ? 'SAVE-only' : 'DRY-RUN';

    this.logger.log(`=== ABHS Weight Calibration [${mode}] 시작 (by ${triggeredBy}) ===`);

    // 데이터 스코프
    const totalResp = await this.prisma.aIResponse.count();
    const oldest = await this.prisma.aIResponse.findFirst({ orderBy: { responseDate: 'asc' }, select: { responseDate: true } });
    const newest = await this.prisma.aIResponse.findFirst({ orderBy: { responseDate: 'desc' }, select: { responseDate: true } });
    const rangeDays = oldest && newest
      ? Math.ceil((newest.responseDate.getTime() - oldest.responseDate.getTime()) / 86400000)
      : 0;
    const activeHospitals = await this.prisma.hospital.count({ where: { aiResponses: { some: {} } } });

    this.logger.log(`데이터 스코프: ${totalResp.toLocaleString()}건 / ${rangeDays}일 / ${activeHospitals}개 병원`);

    // 3축 캘리브레이션 병렬 실행
    const [platformWeights, depthScores, intentMultipliers] = await Promise.all([
      this.calibratePlatformWeights(),
      this.calibrateDepthScores(),
      this.calibrateIntentMultipliers(),
    ]);

    // 점수 변화 시뮬레이션
    const abhsScoreComparison = await this.compareABHSScores(
      platformWeights.calibrated,
      depthScores.calibrated,
      intentMultipliers.calibrated,
    );

    // 인사이트 추출
    const insights: string[] = [];
    for (const p of Object.keys(platformWeights.calibrated)) {
      const cur = platformWeights.current[p];
      const cal = platformWeights.calibrated[p];
      const diff = cal - cur;
      if (Math.abs(diff) >= 0.15) {
        insights.push(`[PLATFORM:${p}] ${cur} → ${cal} (${diff > 0 ? '+' : ''}${diff.toFixed(2)}) — ${platformWeights.evidence[p].rationale}`);
      }
    }
    for (const i of Object.keys(intentMultipliers.calibrated)) {
      const cur = intentMultipliers.current[i];
      const cal = intentMultipliers.calibrated[i];
      const diff = cal - cur;
      if (Math.abs(diff) >= 0.15) {
        insights.push(`[INTENT:${i}] ${cur} → ${cal} (${diff > 0 ? '+' : ''}${diff.toFixed(2)}) — ${intentMultipliers.evidence[i].rationale}`);
      }
    }
    const bigDelta = abhsScoreComparison.filter(h => Math.abs(h.delta) >= 5).length;
    insights.push(`${abhsScoreComparison.length}개 병원 중 ${bigDelta}개가 ABHS ±5 이상 변동`);

    const result: CalibrationResult = {
      generatedAt: new Date().toISOString(),
      dataScope: { totalResponses: totalResp, rangeDays, activeHospitals },
      platformWeights,
      depthScores,
      intentMultipliers,
      abhsScoreComparison,
      insights,
    };

    // DB 저장
    if (SAVE) {
      const weightDiffs = {
        PLATFORM: Object.fromEntries(Object.keys(platformWeights.calibrated).map(p => [p, {
          old: platformWeights.current[p],
          new: platformWeights.calibrated[p],
          delta: Math.round((platformWeights.calibrated[p] - platformWeights.current[p]) * 100) / 100,
        }])),
        DEPTH: Object.fromEntries(Object.keys(depthScores.calibrated).map(d => [d, {
          old: depthScores.current[d],
          new: depthScores.calibrated[d],
          delta: Math.round((depthScores.calibrated[d] - depthScores.current[d]) * 100) / 100,
        }])),
        INTENT: Object.fromEntries(Object.keys(intentMultipliers.calibrated).map(i => [i, {
          old: intentMultipliers.current[i],
          new: intentMultipliers.calibrated[i],
          delta: Math.round((intentMultipliers.calibrated[i] - intentMultipliers.current[i]) * 100) / 100,
        }])),
      };

      const toEvidenceMap = (raw: Record<string, any>, calibrated: Record<string, number>) => {
        const out: Record<string, { value: number; evidence: any }> = {};
        for (const k of Object.keys(calibrated)) {
          out[k] = { value: calibrated[k], evidence: raw[k] ?? null };
        }
        return out;
      };

      const saved = await this.weightService.saveCalibration({
        scope: 'GLOBAL',
        scopeKey: 'GLOBAL',
        dataRangeDays: rangeDays,
        responsesAnalyzed: totalResp,
        hospitalsAnalyzed: activeHospitals,
        triggeredBy,
        weights: {
          PLATFORM: toEvidenceMap(platformWeights.evidence, platformWeights.calibrated),
          DEPTH:    toEvidenceMap(depthScores.evidence,    depthScores.calibrated),
          INTENT:   toEvidenceMap(intentMultipliers.evidence, intentMultipliers.calibrated),
        },
        weightDiffs,
        scoreImpact: abhsScoreComparison.slice(0, 20),
        insights,
        activate: ACTIVATE,
      });

      result.saved = {
        runId: saved.runId,
        profilesUpserted: saved.profilesUpserted,
        activated: saved.activated,
      };

      this.logger.log(`✅ RUN ${saved.runId} 저장 완료 (${saved.profilesUpserted} profiles, activated=${saved.activated})`);
    }

    this.logger.log(`=== Calibration 완료 [${mode}]: ${insights.length} insights ===`);
    return result;
  }

  // ========== Phase A.1: 플랫폼 가중치 ==========
  private async calibratePlatformWeights() {
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const evidence: Record<string, any> = {};

    for (const platform of platforms) {
      const stats = await this.prisma.$queryRaw<Array<{
        total: bigint;
        mentioned: bigint;
        avg_sentiment_v2: number | null;
        avg_confidence: number | null;
        with_sources: bigint;
      }>>`
        SELECT
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::bigint AS mentioned,
          AVG(sentiment_score_v2)::float AS avg_sentiment_v2,
          AVG(confidence_score)::float AS avg_confidence,
          SUM(CASE WHEN array_length(cited_sources, 1) > 0 THEN 1 ELSE 0 END)::bigint AS with_sources
        FROM ai_responses
        WHERE ai_platform = ${platform}::"AIPlatform"
      `;
      const s = stats[0];
      const total = Number(s.total);
      const mentioned = Number(s.mentioned);
      const withSources = Number(s.with_sources);
      const sovPercent = total > 0 ? (mentioned / total) * 100 : 0;
      const avgSentiment = s.avg_sentiment_v2 ?? 0;
      const avgConfidence = s.avg_confidence ?? 0;
      const sourceRatio = total > 0 ? withSources / total : 0;

      const sovNorm = Math.min(sovPercent / 50, 1);
      const sentNorm = (avgSentiment + 2) / 4;
      const composite = 0.4 * sovNorm + 0.25 * sentNorm + 0.20 * avgConfidence + 0.15 * sourceRatio;

      evidence[platform] = {
        responses: total,
        sovPercent: Math.round(sovPercent * 10) / 10,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        sourceQualityScore: Math.round(sourceRatio * 100) / 100,
        compositeScore: Math.round(composite * 1000) / 1000,
        rationale: `SoV=${sovPercent.toFixed(1)}%, Sent=${avgSentiment.toFixed(2)}, Conf=${avgConfidence.toFixed(2)}, Sources=${(sourceRatio * 100).toFixed(0)}%`,
      };
    }

    const composites = platforms.map(p => evidence[p].compositeScore);
    const minC = Math.min(...composites);
    const maxC = Math.max(...composites);
    const range = maxC - minC || 1;

    const calibrated: Record<string, number> = {};
    for (const p of platforms) {
      const normalized = (evidence[p].compositeScore - minC) / range;
      calibrated[p] = Math.round((1.0 + normalized * 0.4) * 100) / 100;
    }

    return {
      current: BASELINE_PLATFORM,
      calibrated,
      method: '합성점수 = 0.4×SoV + 0.25×Sentiment + 0.20×Confidence + 0.15×SourceRatio → 1.0~1.4 매핑',
      evidence,
    };
  }

  // ========== Phase A.2: 추천 깊이 점수 ==========
  private async calibrateDepthScores() {
    const depths = ['R0', 'R1', 'R2', 'R3'] as const;
    const evidence: Record<string, any> = {};
    const totalHospitals = await this.prisma.hospital.count();

    for (const depth of depths) {
      const stats = await this.prisma.$queryRaw<Array<{
        total: bigint;
        avg_sent: number | null;
        avg_conf: number | null;
        unique_hospitals: bigint;
      }>>`
        SELECT
          COUNT(*)::bigint AS total,
          AVG(sentiment_score_v2)::float AS avg_sent,
          AVG(confidence_score)::float AS avg_conf,
          COUNT(DISTINCT hospital_id)::bigint AS unique_hospitals
        FROM ai_responses
        WHERE recommendation_depth = ${depth}::"RecommendationDepth"
      `;
      const s = stats[0];
      const count = Number(s.total);
      const avgSent = s.avg_sent ?? 0;
      const avgConf = s.avg_conf ?? 0;
      const uniqueHospitals = Number(s.unique_hospitals);
      const uniqueRatio = totalHospitals > 0 ? uniqueHospitals / totalHospitals : 0;

      evidence[depth] = {
        count,
        avgSentimentV2: Math.round(avgSent * 100) / 100,
        avgConfidence: Math.round(avgConf * 100) / 100,
        uniqueHospitalsRatio: Math.round(uniqueRatio * 100) / 100,
        rationale: `${count}건, Sent=${avgSent.toFixed(2)}, Conf=${avgConf.toFixed(2)}, 병원커버 ${(uniqueRatio * 100).toFixed(0)}%`,
      };
    }

    const calibrated: Record<string, number> = { R0: 0.0 };
    const baseScores: Record<string, number> = {};
    for (const d of ['R1', 'R2', 'R3'] as const) {
      const e = evidence[d];
      const sentNorm = (e.avgSentimentV2 + 2) / 4;
      const scarcityBonus = 1 + (1 - e.uniqueHospitalsRatio) * 0.3;
      baseScores[d] = sentNorm * e.avgConfidence * scarcityBonus;
    }
    const maxBase = Math.max(...Object.values(baseScores)) || 1;
    for (const d of ['R1', 'R2', 'R3'] as const) {
      calibrated[d] = Math.round((baseScores[d] / maxBase) * 4.0 * 10) / 10;
    }

    return {
      current: BASELINE_DEPTH,
      calibrated,
      method: 'value = Sentiment_norm × Confidence × (1 + 희소성) → R3=4.0 정규화',
      evidence,
    };
  }

  // ========== Phase A.3: 의도 배율 ==========
  private async calibrateIntentMultipliers() {
    const intents = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'] as const;
    const evidence: Record<string, any> = {};

    for (const intent of intents) {
      const stats = await this.prisma.$queryRaw<Array<{
        total: bigint;
        mentioned: bigint;
        avg_sent: number | null;
        r2_count: bigint;
        r3_count: bigint;
      }>>`
        SELECT
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::bigint AS mentioned,
          AVG(sentiment_score_v2)::float AS avg_sent,
          SUM(CASE WHEN recommendation_depth = 'R2' THEN 1 ELSE 0 END)::bigint AS r2_count,
          SUM(CASE WHEN recommendation_depth = 'R3' THEN 1 ELSE 0 END)::bigint AS r3_count
        FROM ai_responses
        WHERE query_intent = ${intent}::"QueryIntent"
      `;
      const s = stats[0];
      const total = Number(s.total);
      const mentioned = Number(s.mentioned);
      const r2 = Number(s.r2_count);
      const r3 = Number(s.r3_count);
      const avgSent = s.avg_sent ?? 0;

      const mentionRate = total > 0 ? mentioned / total : 0;
      const r2r3Ratio = mentioned > 0 ? (r2 + r3) / mentioned : 0;
      const sentNorm = (avgSent + 2) / 4;
      const businessValue = mentionRate * sentNorm * (1 + r2r3Ratio * 0.5);

      evidence[intent] = {
        count: total,
        mentionRate: Math.round(mentionRate * 1000) / 1000,
        avgSentimentV2: Math.round(avgSent * 100) / 100,
        r2r3Ratio: Math.round(r2r3Ratio * 1000) / 1000,
        businessValue: Math.round(businessValue * 1000) / 1000,
        rationale: `${total}건, 멘션률 ${(mentionRate * 100).toFixed(1)}%, R2+R3 ${(r2r3Ratio * 100).toFixed(0)}%`,
      };
    }

    const values = intents.map(i => evidence[i].businessValue);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    const calibrated: Record<string, number> = {};
    for (const i of intents) {
      const normalized = (evidence[i].businessValue - minV) / range;
      calibrated[i] = Math.round((1.0 + normalized * 0.5) * 100) / 100;
    }

    return {
      current: BASELINE_INTENT,
      calibrated,
      method: 'businessValue = mentionRate × Sentiment_norm × (1 + R2R3_ratio × 0.5) → 1.0~1.5 매핑',
      evidence,
    };
  }

  // ========== Phase A.4: ABHS 점수 변화 시뮬레이션 ==========
  private async compareABHSScores(
    newPlatformWeights: Record<string, number>,
    newDepthScores: Record<string, number>,
    newIntentMultipliers: Record<string, number>,
  ) {
    const hospitals = await this.prisma.hospital.findMany({
      where: { aiResponses: { some: {} } },
      select: { id: true, name: true },
      take: 20,
    });

    const comparison: Array<{
      hospitalId: string;
      hospitalName: string;
      currentABHS: number;
      calibratedABHS: number;
      delta: number;
    }> = [];

    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const h of hospitals) {
      const responses = await this.prisma.aIResponse.findMany({
        where: { hospitalId: h.id, responseDate: { gte: sinceDate } },
        select: {
          aiPlatform: true,
          isMentioned: true,
          sentimentScoreV2: true,
          recommendationDepth: true,
          queryIntent: true,
        },
      });
      if (responses.length === 0) continue;

      const currentScore = this.computeABHS(responses, BASELINE_PLATFORM, BASELINE_DEPTH, BASELINE_INTENT);
      const newScore = this.computeABHS(responses, newPlatformWeights, newDepthScores, newIntentMultipliers);
      comparison.push({
        hospitalId: h.id,
        hospitalName: h.name,
        currentABHS: currentScore,
        calibratedABHS: newScore,
        delta: Math.round((newScore - currentScore) * 10) / 10,
      });
    }

    return comparison.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  private computeABHS(
    responses: any[],
    platformW: Record<string, number>,
    depthS: Record<string, number>,
    intentM: Record<string, number>,
  ): number {
    let total = 0, max = 0;
    const sentFactor = (v: number | null) => v == null ? 0.5 : Math.max(0, (v + 2) / 4 * 1.5);
    const maxD = Math.max(...Object.values(depthS));
    const maxI = Math.max(...Object.values(intentM));

    for (const r of responses) {
      const w = platformW[r.aiPlatform] || 1.0;
      const d = depthS[r.recommendationDepth || 'R0'] || 0;
      const i = intentM[r.queryIntent || 'INFORMATION'] || 1.0;
      const sf = sentFactor(r.sentimentScoreV2);
      total += (r.isMentioned ? 1 : 0) * sf * d * w * i;
      max += 1 * 1.5 * maxD * w * maxI;
    }
    return max > 0 ? Math.round((total / max) * 100) : 0;
  }
}
