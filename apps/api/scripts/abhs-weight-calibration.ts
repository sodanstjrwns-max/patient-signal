// Patient Signal - ABHS 가중치 캘리브레이션 (Phase A / Tier 1)
// 목적: 직관 기반 가중치를 56,320건 실데이터 기반으로 재산정
// 사용법: cd apps/api && npx ts-node scripts/abhs-weight-calibration.ts

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============ 현재 (기존) 가중치 — 비교 베이스라인 ============
const CURRENT_PLATFORM_WEIGHTS: Record<string, number> = {
  PERPLEXITY: 1.4,
  CHATGPT: 1.3,
  GEMINI: 1.2,
  CLAUDE: 1.0,
};

const CURRENT_DEPTH_SCORES: Record<string, number> = {
  R3: 4.0, R2: 3.0, R1: 1.5, R0: 0.0,
};

const CURRENT_INTENT_MULTIPLIERS: Record<string, number> = {
  RESERVATION: 1.5,
  REVIEW: 1.3,
  FEAR: 1.2,
  COMPARISON: 1.1,
  INFORMATION: 1.0,
};

// ============ 캘리브레이션 결과 타입 ============
interface CalibrationReport {
  generatedAt: string;
  dataScope: {
    totalResponses: number;
    rangeDays: number;
    activeHospitals: number;
  };
  platformWeights: {
    current: Record<string, number>;
    calibrated: Record<string, number>;
    method: string;
    evidence: Record<string, {
      responses: number;
      sovPercent: number;
      avgSentiment: number;
      avgConfidence: number;
      sourceQualityScore: number;
      compositeScore: number;
      rationale: string;
    }>;
  };
  depthScores: {
    current: Record<string, number>;
    calibrated: Record<string, number>;
    method: string;
    evidence: Record<string, {
      count: number;
      avgSentimentV2: number;
      avgConfidence: number;
      uniqueHospitalsRatio: number;
      rationale: string;
    }>;
  };
  intentMultipliers: {
    current: Record<string, number>;
    calibrated: Record<string, number>;
    method: string;
    evidence: Record<string, {
      count: number;
      mentionRate: number;
      avgSentimentV2: number;
      r2r3Ratio: number;
      businessValue: number;
      rationale: string;
    }>;
  };
  abhsScoreComparison: Array<{
    hospitalId: string;
    hospitalName: string;
    currentABHS: number;
    calibratedABHS: number;
    delta: number;
  }>;
  insights: string[];
}

// ============ Phase A.1: 플랫폼 가중치 재산정 ============
async function calibratePlatformWeights() {
  console.log('🌐 [A.1] 플랫폼 가중치 캘리브레이션...');
  const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
  const evidence: Record<string, any> = {};

  for (const platform of platforms) {
    // 방법론: 플랫폼별 합성 가치 = (SoV 영향력) × (감성 신뢰도) × (소스 권위)
    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      mentioned: bigint;
      avg_sentiment_v2: number | null;
      avg_confidence: number | null;
      with_sources: bigint;
      avg_response_len: number | null;
    }>>`
      SELECT
        COUNT(*)::bigint AS total,
        SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::bigint AS mentioned,
        AVG(sentiment_score_v2)::float AS avg_sentiment_v2,
        AVG(confidence_score)::float AS avg_confidence,
        SUM(CASE WHEN array_length(cited_sources, 1) > 0 THEN 1 ELSE 0 END)::bigint AS with_sources,
        AVG(char_length(response_text))::float AS avg_response_len
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

    // 합성 점수 = 0.4 × SoV normalized + 0.25 × sentiment normalized + 0.20 × confidence + 0.15 × source ratio
    // SoV normalized: 0~50% → 0~1 (50% 이상이면 1)
    // sentiment normalized: -2~+2 → 0~1
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

  // 캘리브레이션: 합성 점수를 1.0~1.4 범위로 매핑 (최저값=1.0, 최고값=1.4)
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
    current: CURRENT_PLATFORM_WEIGHTS,
    calibrated,
    method: '합성점수 = 0.4×SoV + 0.25×Sentiment + 0.20×Confidence + 0.15×SourceRatio → 1.0~1.4 매핑',
    evidence,
  };
}

// ============ Phase A.2: 추천 깊이 점수 재산정 ============
async function calibrateDepthScores() {
  console.log('🎯 [A.2] 추천 깊이 점수 캘리브레이션...');
  const depths = ['R0', 'R1', 'R2', 'R3'] as const;
  const evidence: Record<string, any> = {};

  for (const depth of depths) {
    // 방법론: 각 깊이가 실제로 어느 정도의 "가치"를 갖는가?
    // = 평균 감성 × 신뢰도 × 병원 다양성 (R3가 특정 병원만 받는지)
    const stats = await prisma.$queryRaw<Array<{
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

    // 전체 활성 병원 대비 비율 (희소성 지표)
    const totalHospitals = await prisma.hospital.count();
    const uniqueRatio = totalHospitals > 0 ? uniqueHospitals / totalHospitals : 0;

    evidence[depth] = {
      count,
      avgSentimentV2: Math.round(avgSent * 100) / 100,
      avgConfidence: Math.round(avgConf * 100) / 100,
      uniqueHospitalsRatio: Math.round(uniqueRatio * 100) / 100,
      rationale: `${count}건, Sent=${avgSent.toFixed(2)}, Conf=${avgConf.toFixed(2)}, 병원커버 ${(uniqueRatio * 100).toFixed(0)}%`,
    };
  }

  // 캘리브레이션: R0=0 고정, R3는 가장 높음
  // value = sentiment normalized × confidence × (1 + 희소성 보정)
  const calibrated: Record<string, number> = { R0: 0.0 };
  const baseScores: Record<string, number> = {};
  for (const d of ['R1', 'R2', 'R3'] as const) {
    const e = evidence[d];
    const sentNorm = (e.avgSentimentV2 + 2) / 4;
    const scarcityBonus = 1 + (1 - e.uniqueHospitalsRatio) * 0.3;
    baseScores[d] = sentNorm * e.avgConfidence * scarcityBonus;
  }
  // R3가 4.0이 되도록 정규화 (기존과 호환)
  const maxBase = Math.max(...Object.values(baseScores));
  for (const d of ['R1', 'R2', 'R3'] as const) {
    calibrated[d] = Math.round((baseScores[d] / maxBase) * 4.0 * 10) / 10;
  }

  return {
    current: CURRENT_DEPTH_SCORES,
    calibrated,
    method: 'value = Sentiment_norm × Confidence × (1 + 희소성 보정) → R3=4.0 정규화',
    evidence,
  };
}

// ============ Phase A.3: 의도 배율 재산정 ============
async function calibrateIntentMultipliers() {
  console.log('💭 [A.3] 의도 배율 캘리브레이션...');
  const intents = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'] as const;
  const evidence: Record<string, any> = {};

  for (const intent of intents) {
    // 방법론: 의도별 비즈니스 가치 = 멘션률 × 감성 × R2/R3 비율
    // R2/R3 비율 = 깊이 있는 추천을 받는 비율 (단순 언급 아닌 진짜 추천)
    const stats = await prisma.$queryRaw<Array<{
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
    // 비즈니스 가치 = mentionRate × sentNorm × (1 + r2r3 부스트)
    const businessValue = mentionRate * sentNorm * (1 + r2r3Ratio * 0.5);

    evidence[intent] = {
      count: total,
      mentionRate: Math.round(mentionRate * 1000) / 1000,
      avgSentimentV2: Math.round(avgSent * 100) / 100,
      r2r3Ratio: Math.round(r2r3Ratio * 1000) / 1000,
      businessValue: Math.round(businessValue * 1000) / 1000,
      rationale: `${total}건, 멘션률 ${(mentionRate * 100).toFixed(1)}%, R2+R3 비율 ${(r2r3Ratio * 100).toFixed(0)}%`,
    };
  }

  // 캘리브레이션: 비즈니스 가치를 1.0~1.5로 매핑
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
    current: CURRENT_INTENT_MULTIPLIERS,
    calibrated,
    method: 'businessValue = mentionRate × Sentiment_norm × (1 + R2R3_ratio × 0.5) → 1.0~1.5 매핑',
    evidence,
  };
}

// ============ Phase A.4: 기존 vs 신규 ABHS 점수 비교 ============
async function compareABHSScores(
  newPlatformWeights: Record<string, number>,
  newDepthScores: Record<string, number>,
  newIntentMultipliers: Record<string, number>,
) {
  console.log('📊 [A.4] 병원별 ABHS 점수 변화 시뮬레이션...');

  const hospitals = await prisma.hospital.findMany({
    where: { aiResponses: { some: {} } },
    select: { id: true, name: true },
    take: 20, // 상위 20개만
  });

  const comparison: Array<{
    hospitalId: string;
    hospitalName: string;
    currentABHS: number;
    calibratedABHS: number;
    delta: number;
  }> = [];

  for (const h of hospitals) {
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId: h.id, responseDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: {
        aiPlatform: true,
        isMentioned: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
        queryIntent: true,
      },
    });
    if (responses.length === 0) continue;

    const currentScore = computeABHS(responses, CURRENT_PLATFORM_WEIGHTS, CURRENT_DEPTH_SCORES, CURRENT_INTENT_MULTIPLIERS);
    const newScore = computeABHS(responses, newPlatformWeights, newDepthScores, newIntentMultipliers);
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

function computeABHS(
  responses: any[],
  platformW: Record<string, number>,
  depthS: Record<string, number>,
  intentM: Record<string, number>,
): number {
  let total = 0, max = 0;
  const sentFactor = (v: number | null) => {
    if (v == null) return 0.5;
    return Math.max(0, (v + 2) / 4 * 1.5);
  };
  for (const r of responses) {
    const w = platformW[r.aiPlatform] || 1.0;
    const d = depthS[r.recommendationDepth || 'R0'] || 0;
    const i = intentM[r.queryIntent || 'INFORMATION'] || 1.0;
    const sf = sentFactor(r.sentimentScoreV2);
    const maxW = Math.max(...Object.values(platformW));
    const maxD = Math.max(...Object.values(depthS));
    const maxI = Math.max(...Object.values(intentM));

    total += (r.isMentioned ? 1 : 0) * sf * d * w * i;
    max += 1 * 1.5 * maxD * w * maxI;
  }
  return max > 0 ? Math.round((total / max) * 100) : 0;
}

// ============ Main ============
async function main() {
  // CLI 플래그 파싱
  // --save     : 결과를 DB에 저장 (이전 RUN과 별개 row로 보관, 비활성)
  // --activate : --save와 함께 사용 시 즉시 운영 활성화 (이전 RUN deactivate)
  // (둘 다 없으면 dry-run = 콘솔 출력 + JSON 저장만)
  const SAVE = process.argv.includes('--save');
  const ACTIVATE = process.argv.includes('--activate');
  const mode = ACTIVATE ? '🟢 SAVE + ACTIVATE (운영 반영)'
            : SAVE     ? '🟡 SAVE only (DB 저장, 비활성)'
            :            '⚪ DRY-RUN (콘솔/JSON만)';
  console.log(`🚀 ABHS Weight Calibration 시작 [${mode}]\n`);

  const totalResp = await prisma.aIResponse.count();
  const oldest = await prisma.aIResponse.findFirst({ orderBy: { responseDate: 'asc' }, select: { responseDate: true } });
  const newest = await prisma.aIResponse.findFirst({ orderBy: { responseDate: 'desc' }, select: { responseDate: true } });
  const rangeDays = oldest && newest ? Math.ceil((newest.responseDate.getTime() - oldest.responseDate.getTime()) / 86400000) : 0;
  const activeHospitals = await prisma.hospital.count({ where: { aiResponses: { some: {} } } });

  const platformWeights = await calibratePlatformWeights();
  const depthScores = await calibrateDepthScores();
  const intentMultipliers = await calibrateIntentMultipliers();
  const abhsScoreComparison = await compareABHSScores(
    platformWeights.calibrated,
    depthScores.calibrated,
    intentMultipliers.calibrated,
  );

  const insights: string[] = [];
  // Insight 추출
  for (const p of Object.keys(platformWeights.calibrated)) {
    const cur = platformWeights.current[p];
    const cal = platformWeights.calibrated[p];
    const diff = cal - cur;
    if (Math.abs(diff) >= 0.15) {
      insights.push(`🔴 ${p} 가중치 변화 큼: ${cur} → ${cal} (${diff > 0 ? '+' : ''}${diff.toFixed(2)}) — ${platformWeights.evidence[p].rationale}`);
    }
  }
  for (const i of Object.keys(intentMultipliers.calibrated)) {
    const cur = intentMultipliers.current[i];
    const cal = intentMultipliers.calibrated[i];
    const diff = cal - cur;
    if (Math.abs(diff) >= 0.15) {
      insights.push(`🔴 의도 [${i}] 배율 변화 큼: ${cur} → ${cal} (${diff > 0 ? '+' : ''}${diff.toFixed(2)}) — ${intentMultipliers.evidence[i].rationale}`);
    }
  }
  const bigDeltaHospitals = abhsScoreComparison.filter(h => Math.abs(h.delta) >= 5).length;
  insights.push(`📊 ${abhsScoreComparison.length}개 병원 중 ${bigDeltaHospitals}개가 ABHS 점수 ±5 이상 변동`);

  const report: CalibrationReport = {
    generatedAt: new Date().toISOString(),
    dataScope: { totalResponses: totalResp, rangeDays, activeHospitals },
    platformWeights,
    depthScores,
    intentMultipliers,
    abhsScoreComparison,
    insights,
  };

  printReport(report);

  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.join(process.cwd(), 'audit-reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `abhs-calibration-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 JSON 리포트 저장: ${outPath}\n`);

  // ============ DB 저장 (--save / --activate 플래그 있을 때만) ============
  if (SAVE || ACTIVATE) {
    console.log('💾 [Save] 캘리브레이션 결과를 DB에 저장합니다...');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { WeightService } = require('../src/scores/weight.service');
    const weightService = new WeightService(prisma as any);

    // CalibrationSnapshot 구조에 맞게 변환
    const toEvidenceMap = (raw: Record<string, any>, calibrated: Record<string, number>) => {
      const out: Record<string, { value: number; evidence: any }> = {};
      for (const k of Object.keys(calibrated)) {
        out[k] = { value: calibrated[k], evidence: raw[k] ?? null };
      }
      return out;
    };

    // weightDiffs: 기존 → 신규 비교 (감사용)
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

    const result = await weightService.saveCalibration({
      scope: 'GLOBAL',
      scopeKey: 'GLOBAL',
      dataRangeDays: rangeDays,
      responsesAnalyzed: totalResp,
      hospitalsAnalyzed: activeHospitals,
      triggeredBy: process.env.USER ? `USER:${process.env.USER}` : 'SYSTEM',
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

    console.log(`   ✅ RUN ID: ${result.runId}`);
    console.log(`   ✅ 프로파일 upsert: ${result.profilesUpserted}건`);
    console.log(`   ✅ 활성화: ${result.activated ? 'YES (즉시 운영 반영됨)' : 'NO (저장만, 활성화는 별도 명령 필요)'}`);

    if (ACTIVATE) {
      console.log('\n🎯 새 가중치가 즉시 운영에 반영되었습니다.');
      console.log('   롤백이 필요하면: npx ts-node scripts/abhs-weight-rollback.ts');
    } else if (SAVE) {
      console.log(`\n💡 RUN을 활성화하려면: npx ts-node scripts/abhs-weight-activate.ts ${result.runId}`);
    }
  } else {
    console.log('💡 DB 저장을 원하시면:');
    console.log('   - 저장만:        npx ts-node scripts/abhs-weight-calibration.ts --save');
    console.log('   - 저장+즉시 활성: npx ts-node scripts/abhs-weight-calibration.ts --save --activate');
  }

  await prisma.$disconnect();
}

function printReport(r: CalibrationReport) {
  const line = '━'.repeat(72);
  console.log('\n' + line);
  console.log('🎯 ABHS WEIGHT CALIBRATION REPORT');
  console.log(line);
  console.log(`데이터 스코프: ${r.dataScope.totalResponses.toLocaleString()}건 / ${r.dataScope.rangeDays}일 / ${r.dataScope.activeHospitals}개 병원\n`);

  console.log('🌐 [1] 플랫폼 가중치');
  console.log(`방법론: ${r.platformWeights.method}`);
  console.log('  플랫폼      | 기존  → 신규   | 변화   | 근거');
  console.log('  ' + '-'.repeat(78));
  for (const p of Object.keys(r.platformWeights.calibrated)) {
    const cur = r.platformWeights.current[p];
    const cal = r.platformWeights.calibrated[p];
    const diff = cal - cur;
    const arrow = diff > 0.05 ? '⬆️' : diff < -0.05 ? '⬇️' : '➡️';
    const sign = diff > 0 ? '+' : '';
    console.log(`  ${p.padEnd(12)}| ${cur.toFixed(2)}  → ${cal.toFixed(2)}  | ${sign}${diff.toFixed(2)} ${arrow} | ${r.platformWeights.evidence[p].rationale}`);
  }
  console.log();

  console.log('🎯 [2] 추천 깊이 점수');
  console.log(`방법론: ${r.depthScores.method}`);
  console.log('  깊이 | 기존  → 신규   | 변화   | 근거');
  console.log('  ' + '-'.repeat(70));
  for (const d of ['R0', 'R1', 'R2', 'R3']) {
    const cur = r.depthScores.current[d];
    const cal = r.depthScores.calibrated[d];
    const diff = cal - cur;
    const sign = diff > 0 ? '+' : '';
    const ev = r.depthScores.evidence[d];
    console.log(`  ${d}   | ${cur.toFixed(2)}  → ${cal.toFixed(2)}  | ${sign}${diff.toFixed(2)} | ${ev ? ev.rationale : '데이터 없음'}`);
  }
  console.log();

  console.log('💭 [3] 의도 배율');
  console.log(`방법론: ${r.intentMultipliers.method}`);
  console.log('  의도          | 기존  → 신규   | 변화   | 근거');
  console.log('  ' + '-'.repeat(80));
  for (const i of Object.keys(r.intentMultipliers.calibrated)) {
    const cur = r.intentMultipliers.current[i];
    const cal = r.intentMultipliers.calibrated[i];
    const diff = cal - cur;
    const sign = diff > 0 ? '+' : '';
    console.log(`  ${i.padEnd(14)}| ${cur.toFixed(2)}  → ${cal.toFixed(2)}  | ${sign}${diff.toFixed(2)} | ${r.intentMultipliers.evidence[i].rationale}`);
  }
  console.log();

  console.log('📊 [4] 병원별 ABHS 점수 변화 (Top 10 변동 큰 순)');
  console.log('  병원명                              | 기존  → 신규   | Δ');
  console.log('  ' + '-'.repeat(64));
  for (const h of r.abhsScoreComparison.slice(0, 10)) {
    const sign = h.delta > 0 ? '+' : '';
    const arrow = h.delta > 0 ? '📈' : h.delta < 0 ? '📉' : '➡️';
    console.log(`  ${h.hospitalName.padEnd(34).substring(0, 34)}  | ${String(h.currentABHS).padStart(3)}  → ${String(h.calibratedABHS).padStart(3)}    | ${sign}${h.delta} ${arrow}`);
  }
  console.log();

  console.log(line);
  console.log('💡 KEY INSIGHTS');
  console.log(line);
  r.insights.forEach(i => console.log(`  ${i}`));
  console.log(line);
}

main().catch(async (e) => {
  console.error('❌ 캘리브레이션 실패:', e);
  await prisma.$disconnect();
  process.exit(1);
});
