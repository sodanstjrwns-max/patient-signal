// Patient Signal - ABHS 데이터 자산 진단 스크립트
// 목적: Tier 1/2/3 진행 전 데이터 양/품질을 정량 파악
// 사용법: cd apps/api && npx ts-node scripts/abhs-data-audit.ts

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditReport {
  generatedAt: string;
  scope: {
    totalHospitals: number;
    activeHospitals: number;
    totalPrompts: number;
    totalAIResponses: number;
    totalDailyScores: number;
    dataRangeDays: number;
  };
  platformCoverage: Record<string, {
    responses: number;
    mentioned: number;
    sovPercent: number;
    avgResponseLength: number;
  }>;
  abhsFieldCompleteness: {
    sentimentScoreV2: { filled: number; total: number; pct: number };
    recommendationDepth: { filled: number; total: number; pct: number };
    queryIntent: { filled: number; total: number; pct: number };
    platformWeight: { filled: number; total: number; pct: number };
    abhsContribution: { filled: number; total: number; pct: number };
    answerPositionType: { filled: number; total: number; pct: number };
    answerQualityScore: { filled: number; total: number; pct: number };
    confidenceScore: { filled: number; total: number; pct: number };
    sourceHints: { filled: number; total: number; pct: number };
  };
  sentimentV2Distribution: Record<string, number>;
  depthDistribution: Record<string, number>;
  intentDistribution: Record<string, number>;
  aeoPipelineAssets: {
    totalPipelines: number;
    withRemeasurement: number;
    avgSovLift: number | null;
    positiveLiftCount: number;
    negativeLiftCount: number;
    statusBreakdown: Record<string, number>;
  };
  citationAssets: {
    totalAnalyses: number;
    uniqueQueries: number;
    avgUrlsAnalyzed: number;
  };
  textCorpus: {
    totalResponseTextChars: number;
    avgResponseTextChars: number;
    responsesWithSources: number;
  };
  tierReadiness: {
    tier1_WeightCalibration: { ready: boolean; reason: string };
    tier2_TextMining: { ready: boolean; reason: string };
    tier3_SelfLearningLoop: { ready: boolean; reason: string };
  };
}

async function audit(): Promise<AuditReport> {
  console.log('🔍 ABHS Data Audit 시작...\n');

  // ============ Scope ============
  const [totalHospitals, totalPrompts, totalAIResponses, totalDailyScores] = await Promise.all([
    prisma.hospital.count(),
    prisma.prompt.count(),
    prisma.aIResponse.count(),
    prisma.dailyScore.count(),
  ]);

  const activeHospitals = await prisma.hospital.count({
    where: { aiResponses: { some: {} } },
  });

  const oldestResponse = await prisma.aIResponse.findFirst({
    orderBy: { responseDate: 'asc' },
    select: { responseDate: true },
  });
  const newestResponse = await prisma.aIResponse.findFirst({
    orderBy: { responseDate: 'desc' },
    select: { responseDate: true },
  });
  const dataRangeDays = oldestResponse && newestResponse
    ? Math.ceil((newestResponse.responseDate.getTime() - oldestResponse.responseDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  console.log(`📊 Scope: ${activeHospitals} hospitals, ${totalAIResponses} responses, ${dataRangeDays}일 데이터\n`);

  // ============ Platform Coverage ============
  const platformCoverage: AuditReport['platformCoverage'] = {};
  for (const platform of ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'GOOGLE_AI_OVERVIEW'] as const) {
    const responses = await prisma.aIResponse.count({ where: { aiPlatform: platform } });
    const mentioned = await prisma.aIResponse.count({ where: { aiPlatform: platform, isMentioned: true } });
    // 응답 길이는 샘플 1000개로 추정
    const sample = await prisma.aIResponse.findMany({
      where: { aiPlatform: platform },
      select: { responseText: true },
      take: 1000,
    });
    const avgLen = sample.length > 0
      ? Math.round(sample.reduce((acc, r) => acc + (r.responseText?.length || 0), 0) / sample.length)
      : 0;

    platformCoverage[platform] = {
      responses,
      mentioned,
      sovPercent: responses > 0 ? Math.round((mentioned / responses) * 1000) / 10 : 0,
      avgResponseLength: avgLen,
    };
  }

  // ============ ABHS Field Completeness ============
  const total = totalAIResponses;
  const fieldPct = (filled: number) => total > 0 ? Math.round((filled / total) * 1000) / 10 : 0;

  const [
    sentV2, depthFilled, intentFilled, platWeight, abhsContrib,
    answerPos, answerQual, confScore, sourceH
  ] = await Promise.all([
    prisma.aIResponse.count({ where: { sentimentScoreV2: { not: null } } }),
    prisma.aIResponse.count({ where: { recommendationDepth: { not: null } } }),
    prisma.aIResponse.count({ where: { queryIntent: { not: null } } }),
    prisma.aIResponse.count({ where: { platformWeight: { not: null } } }),
    prisma.aIResponse.count({ where: { abhsContribution: { not: null } } }),
    prisma.aIResponse.count({ where: { answerPositionType: { not: null } } }),
    prisma.aIResponse.count({ where: { answerQualityScore: { not: null } } }),
    prisma.aIResponse.count({ where: { confidenceScore: { not: null } } }),
    prisma.aIResponse.count({ where: { sourceHints: { not: Prisma.JsonNull } } as any }),
  ]);

  const abhsFieldCompleteness = {
    sentimentScoreV2: { filled: sentV2, total, pct: fieldPct(sentV2) },
    recommendationDepth: { filled: depthFilled, total, pct: fieldPct(depthFilled) },
    queryIntent: { filled: intentFilled, total, pct: fieldPct(intentFilled) },
    platformWeight: { filled: platWeight, total, pct: fieldPct(platWeight) },
    abhsContribution: { filled: abhsContrib, total, pct: fieldPct(abhsContrib) },
    answerPositionType: { filled: answerPos, total, pct: fieldPct(answerPos) },
    answerQualityScore: { filled: answerQual, total, pct: fieldPct(answerQual) },
    confidenceScore: { filled: confScore, total, pct: fieldPct(confScore) },
    sourceHints: { filled: sourceH, total, pct: fieldPct(sourceH) },
  };

  // ============ Distributions ============
  const sentDist = await prisma.aIResponse.groupBy({
    by: ['sentimentScoreV2'],
    _count: true,
    where: { sentimentScoreV2: { not: null } },
  });
  const sentimentV2Distribution: Record<string, number> = {};
  sentDist.forEach(s => { sentimentV2Distribution[String(s.sentimentScoreV2)] = s._count; });

  const depthDist = await prisma.aIResponse.groupBy({
    by: ['recommendationDepth'],
    _count: true,
    where: { recommendationDepth: { not: null } },
  });
  const depthDistribution: Record<string, number> = {};
  depthDist.forEach(d => { depthDistribution[d.recommendationDepth!] = d._count; });

  const intentDist = await prisma.aIResponse.groupBy({
    by: ['queryIntent'],
    _count: true,
    where: { queryIntent: { not: null } },
  });
  const intentDistribution: Record<string, number> = {};
  intentDist.forEach(i => { intentDistribution[i.queryIntent!] = i._count; });

  // ============ AEO Pipeline (Tier 3 핵심) ============
  const totalPipelines = await prisma.aeoPipeline.count();
  const remeasured = await prisma.aeoPipeline.findMany({
    where: { sovLift: { not: null } },
    select: { sovLift: true },
  });
  const avgSovLift = remeasured.length > 0
    ? Math.round((remeasured.reduce((acc, p) => acc + (p.sovLift || 0), 0) / remeasured.length) * 100) / 100
    : null;
  const positiveLiftCount = remeasured.filter(p => (p.sovLift || 0) > 0).length;
  const negativeLiftCount = remeasured.filter(p => (p.sovLift || 0) < 0).length;

  const statusGroups = await prisma.aeoPipeline.groupBy({
    by: ['status'],
    _count: true,
  });
  const statusBreakdown: Record<string, number> = {};
  statusGroups.forEach(s => { statusBreakdown[s.status] = s._count; });

  // ============ Citation Analyses ============
  const totalAnalyses = await prisma.citationAnalysis.count();
  const distinctQueries = await prisma.citationAnalysis.findMany({
    select: { queryText: true },
    distinct: ['queryText'],
  });
  const allAnalyses = await prisma.citationAnalysis.findMany({
    select: { topCitationCount: true },
  });
  const avgUrlsAnalyzed = allAnalyses.length > 0
    ? Math.round((allAnalyses.reduce((a, c) => a + c.topCitationCount, 0) / allAnalyses.length) * 10) / 10
    : 0;

  // ============ Text Corpus 추정 ============
  // PostgreSQL의 char_length 집계 사용 (수백만 건일 수 있으므로)
  const textStats = await prisma.$queryRaw<Array<{ total_chars: bigint; avg_chars: number; with_sources: bigint }>>`
    SELECT
      COALESCE(SUM(char_length(response_text)), 0)::bigint AS total_chars,
      COALESCE(AVG(char_length(response_text)), 0)::float AS avg_chars,
      COALESCE(SUM(CASE WHEN array_length(cited_sources, 1) > 0 THEN 1 ELSE 0 END), 0)::bigint AS with_sources
    FROM ai_responses
  `;
  const textCorpus = {
    totalResponseTextChars: Number(textStats[0]?.total_chars || 0n),
    avgResponseTextChars: Math.round(textStats[0]?.avg_chars || 0),
    responsesWithSources: Number(textStats[0]?.with_sources || 0n),
  };

  // ============ Tier Readiness 판정 ============
  const tier1Ready = totalAIResponses >= 500 && Object.keys(platformCoverage).filter(p => platformCoverage[p].responses > 50).length >= 2;
  const tier2Ready = textCorpus.totalResponseTextChars >= 500_000;
  const tier3Ready = remeasured.length >= 20;

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    scope: { totalHospitals, activeHospitals, totalPrompts, totalAIResponses, totalDailyScores, dataRangeDays },
    platformCoverage,
    abhsFieldCompleteness,
    sentimentV2Distribution,
    depthDistribution,
    intentDistribution,
    aeoPipelineAssets: {
      totalPipelines,
      withRemeasurement: remeasured.length,
      avgSovLift,
      positiveLiftCount,
      negativeLiftCount,
      statusBreakdown,
    },
    citationAssets: {
      totalAnalyses,
      uniqueQueries: distinctQueries.length,
      avgUrlsAnalyzed,
    },
    textCorpus,
    tierReadiness: {
      tier1_WeightCalibration: {
        ready: tier1Ready,
        reason: tier1Ready
          ? `${totalAIResponses}건의 응답, 다중 플랫폼 커버리지 확보 — Tier 1 즉시 진행 가능`
          : `샘플 부족 (${totalAIResponses}건 / 권장 500+) 또는 플랫폼 커버리지 부족`,
      },
      tier2_TextMining: {
        ready: tier2Ready,
        reason: tier2Ready
          ? `${(textCorpus.totalResponseTextChars / 1_000_000).toFixed(2)}M자 텍스트 코퍼스 확보 — LLM 배치 추출 가능`
          : `텍스트 코퍼스 부족 (${textCorpus.totalResponseTextChars}자 / 권장 500K+)`,
      },
      tier3_SelfLearningLoop: {
        ready: tier3Ready,
        reason: tier3Ready
          ? `${remeasured.length}개 pre/post 측정 케이스 확보 — 자가학습 모델 학습 가능`
          : `재측정 케이스 부족 (${remeasured.length}건 / 권장 20+). AEO 파이프라인 더 돌려야 함`,
      },
    },
  };

  return report;
}

function printReport(r: AuditReport) {
  const line = '━'.repeat(70);
  console.log('\n' + line);
  console.log('📋 PATIENT SIGNAL — ABHS DATA AUDIT REPORT');
  console.log(line);
  console.log(`생성 시각: ${r.generatedAt}\n`);

  console.log('📦 [1] 데이터 스코프');
  console.log(`  • 등록 병원: ${r.scope.totalHospitals}개 (활성: ${r.scope.activeHospitals}개)`);
  console.log(`  • 총 프롬프트: ${r.scope.totalPrompts.toLocaleString()}건`);
  console.log(`  • 총 AI 응답: ${r.scope.totalAIResponses.toLocaleString()}건`);
  console.log(`  • 일별 점수: ${r.scope.totalDailyScores.toLocaleString()}건`);
  console.log(`  • 데이터 기간: ${r.scope.dataRangeDays}일\n`);

  console.log('🌐 [2] 플랫폼별 커버리지');
  for (const [platform, data] of Object.entries(r.platformCoverage)) {
    if (data.responses === 0) continue;
    console.log(`  • ${platform.padEnd(20)} | 응답 ${data.responses.toLocaleString().padStart(6)}건 | 멘션 ${data.mentioned.toLocaleString().padStart(5)}건 | SoV ${String(data.sovPercent).padStart(5)}% | 평균길이 ${data.avgResponseLength}자`);
  }
  console.log();

  console.log('✅ [3] ABHS 필드 완성도 (전체 응답 대비 %)');
  for (const [field, data] of Object.entries(r.abhsFieldCompleteness)) {
    const bar = '█'.repeat(Math.round(data.pct / 5)) + '░'.repeat(20 - Math.round(data.pct / 5));
    const flag = data.pct >= 80 ? '✅' : data.pct >= 50 ? '⚠️ ' : '❌';
    console.log(`  ${flag} ${field.padEnd(22)} ${bar} ${String(data.pct).padStart(5)}% (${data.filled.toLocaleString()}건)`);
  }
  console.log();

  console.log('🎭 [4] Sentiment V2 분포 (-2 ~ +2)');
  for (const [v, c] of Object.entries(r.sentimentV2Distribution).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  ${v.padStart(3)}: ${c.toLocaleString()}건`);
  }
  console.log();

  console.log('🎯 [5] 추천 깊이 분포');
  for (const [d, c] of Object.entries(r.depthDistribution)) {
    console.log(`  ${d}: ${c.toLocaleString()}건`);
  }
  console.log();

  console.log('💭 [6] 질문 의도 분포');
  for (const [i, c] of Object.entries(r.intentDistribution)) {
    console.log(`  ${i.padEnd(15)}: ${c.toLocaleString()}건`);
  }
  console.log();

  console.log('🚀 [7] AEO Pipeline 자산 (Tier 3 ground truth)');
  console.log(`  • 총 파이프라인: ${r.aeoPipelineAssets.totalPipelines}건`);
  console.log(`  • 재측정 완료: ${r.aeoPipelineAssets.withRemeasurement}건`);
  console.log(`  • 평균 SoV Lift: ${r.aeoPipelineAssets.avgSovLift ?? 'N/A'}%p`);
  console.log(`  • Positive Lift: ${r.aeoPipelineAssets.positiveLiftCount}건 / Negative: ${r.aeoPipelineAssets.negativeLiftCount}건`);
  console.log(`  • 상태별: ${JSON.stringify(r.aeoPipelineAssets.statusBreakdown)}\n`);

  console.log('🔗 [8] Citation Analysis 자산');
  console.log(`  • 총 분석: ${r.citationAssets.totalAnalyses}건 | 고유 질문: ${r.citationAssets.uniqueQueries}개 | 평균 URL: ${r.citationAssets.avgUrlsAnalyzed}\n`);

  console.log('📝 [9] 텍스트 코퍼스 (Tier 2 핵심)');
  console.log(`  • 총 글자수: ${(r.textCorpus.totalResponseTextChars / 1_000_000).toFixed(2)}M자`);
  console.log(`  • 평균 응답 길이: ${r.textCorpus.avgResponseTextChars}자`);
  console.log(`  • 인용 소스 있는 응답: ${r.textCorpus.responsesWithSources.toLocaleString()}건\n`);

  console.log(line);
  console.log('🎯 [10] Tier 진행 가능성 진단');
  console.log(line);
  for (const [tier, data] of Object.entries(r.tierReadiness)) {
    const icon = data.ready ? '✅ READY' : '⏸️  WAIT';
    console.log(`  ${icon}  ${tier}`);
    console.log(`         → ${data.reason}`);
  }
  console.log(line + '\n');
}

audit()
  .then(async (report) => {
    printReport(report);
    // JSON 파일로도 저장
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'audit-reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `abhs-audit-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`💾 JSON 리포트 저장: ${outPath}\n`);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Audit 실패:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
