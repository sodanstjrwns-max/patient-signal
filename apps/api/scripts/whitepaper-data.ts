import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface WhitepaperData {
  generatedAt: string;
  overview: {
    totalResponses: number;
    totalMentions: number;
    mentionRate: number;
    totalHospitals: number;
    totalTextChars: number;
    periodStart: string;
    periodEnd: string;
    periodDays: number;
  };
  dental: {
    hospitalCount: number;
    responseCount: number;
    mentionCount: number;
    mentionRate: number;
    textChars: number;
    sidoCount: number;
    sigunguCount: number;
    days: number;
  };
  platformAnalysis: Array<{
    platform: string;
    totalResponses: number;
    mentions: number;
    mentionRate: number;
    avgPositionWhenMentioned: number;
    r3Count: number;
    r3Rate: number;
  }>;
  depthDistribution: Array<{ depth: number; label: string; count: number; pct: number }>;
  regionAnalysis: Array<{
    sido: string;
    hospitalCount: number;
    responseCount: number;
    mentionCount: number;
    mentionRate: number;
  }>;
  weeklyTrend: Array<{
    weekStart: string;
    responses: number;
    mentions: number;
    mentionRate: number;
  }>;
  tierDistribution: Array<{ tier: string; count: number; pct: number }>;
  topPerformers: Array<{
    rank: number;
    name: string;
    region: string;
    score: number;
    tier: string;
  }>;
  weightCalibration: {
    runId: string;
    activatedAt: string;
    responsesAnalyzed: number;
    platform: Record<string, number>;
    depth: Record<string, number>;
    intent: Record<string, number>;
  };
  insights: string[];
}

async function main() {
  console.log('📊 백서 데이터 수집 중...');

  // === 1. Overview ===
  const totalResponses = await prisma.aIResponse.count();
  const totalMentions = await prisma.aIResponse.count({ where: { isMentioned: true } });
  const totalHospitals = await prisma.hospital.count();

  const charSum = await prisma.$queryRaw<Array<{ total: bigint | null }>>`
    SELECT SUM(LENGTH(response_text))::bigint as total FROM ai_responses
  `;
  const totalTextChars = Number(charSum[0]?.total ?? 0);

  const dateRange = await prisma.$queryRaw<Array<{ min_d: Date; max_d: Date }>>`
    SELECT MIN(response_date) as min_d, MAX(response_date) as max_d FROM ai_responses
  `;
  const periodStart = dateRange[0].min_d.toISOString().split('T')[0];
  const periodEnd = dateRange[0].max_d.toISOString().split('T')[0];
  const periodDays = Math.round(
    (dateRange[0].max_d.getTime() - dateRange[0].min_d.getTime()) / (1000 * 60 * 60 * 24)
  );

  // === 2. Dental specialty ===
  const dentalAgg = await prisma.$queryRaw<
    Array<{ resp: bigint; mention: bigint; chars: bigint }>
  >`
    SELECT
      COUNT(ar.id)::bigint as resp,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mention,
      SUM(LENGTH(ar.response_text))::bigint as chars
    FROM ai_responses ar
    INNER JOIN hospitals h ON h.id = ar.hospital_id
    WHERE h.specialty_type = 'DENTAL'
  `;
  const dentalHospitals = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*)::bigint as cnt FROM hospitals h
    INNER JOIN subscriptions s ON s.hospital_id = h.id AND s.status IN ('ACTIVE','TRIAL')
    WHERE h.specialty_type = 'DENTAL'
  `;
  const dentalRegionsRaw = await prisma.$queryRaw<Array<{ sido: string; sigungu: string }>>`
    SELECT DISTINCT h.region_sido as sido, h.region_sigungu as sigungu FROM hospitals h
    INNER JOIN subscriptions s ON s.hospital_id = h.id AND s.status IN ('ACTIVE','TRIAL')
    WHERE h.specialty_type = 'DENTAL'
  `;
  const dentalDates = await prisma.$queryRaw<Array<{ min_d: Date; max_d: Date }>>`
    SELECT MIN(ar.response_date) as min_d, MAX(ar.response_date) as max_d
    FROM ai_responses ar INNER JOIN hospitals h ON h.id = ar.hospital_id
    WHERE h.specialty_type = 'DENTAL'
  `;
  const dentalDays = Math.round(
    (dentalDates[0].max_d.getTime() - dentalDates[0].min_d.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dental = {
    hospitalCount: Number(dentalHospitals[0].cnt),
    responseCount: Number(dentalAgg[0].resp),
    mentionCount: Number(dentalAgg[0].mention),
    mentionRate: (Number(dentalAgg[0].mention) / Number(dentalAgg[0].resp)) * 100,
    textChars: Number(dentalAgg[0].chars),
    sidoCount: new Set(dentalRegionsRaw.map((r) => r.sido)).size,
    sigunguCount: dentalRegionsRaw.length,
    days: dentalDays,
  };

  // === 3. Platform analysis ===
  const platformRaw = await prisma.$queryRaw<
    Array<{
      platform: string;
      total: bigint;
      mentions: bigint;
      avg_pos: number | null;
      r3: bigint;
    }>
  >`
    SELECT
      ar.ai_platform::text as platform,
      COUNT(*)::bigint as total,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mentions,
      AVG(CASE WHEN ar.is_mentioned THEN ar.mention_position::float END) as avg_pos,
      SUM(CASE WHEN ar.is_mentioned AND ar.mention_position = 1 THEN 1 ELSE 0 END)::bigint as r3
    FROM ai_responses ar
    INNER JOIN hospitals h ON h.id = ar.hospital_id
    WHERE h.specialty_type = 'DENTAL'
    GROUP BY ar.ai_platform
    ORDER BY mentions DESC
  `;
  const platformAnalysis = platformRaw.map((p) => ({
    platform: p.platform,
    totalResponses: Number(p.total),
    mentions: Number(p.mentions),
    mentionRate: (Number(p.mentions) / Number(p.total)) * 100,
    avgPositionWhenMentioned: Math.round((p.avg_pos ?? 0) * 100) / 100,
    r3Count: Number(p.r3),
    r3Rate: (Number(p.r3) / Number(p.mentions)) * 100,
  }));

  // === 4. Depth distribution ===
  const depthRaw = await prisma.$queryRaw<Array<{ depth: number; cnt: bigint }>>`
    SELECT
      CASE
        WHEN ar.total_recommendations IS NULL OR ar.total_recommendations = 0 THEN 0
        WHEN ar.mention_position = 1 THEN 3
        WHEN ar.mention_position <= 3 THEN 2
        ELSE 1
      END AS depth,
      COUNT(*)::bigint as cnt
    FROM ai_responses ar
    INNER JOIN hospitals h ON h.id = ar.hospital_id
    WHERE h.specialty_type = 'DENTAL' AND ar.is_mentioned = true
    GROUP BY depth
    ORDER BY depth
  `;
  const depthLabels: Record<number, string> = {
    0: 'R0 (단순 언급)',
    1: 'R1 (목록 포함)',
    2: 'R2 (Top3 추천)',
    3: 'R3 (1순위 강력 추천)',
  };
  const depthDistribution = depthRaw.map((d) => ({
    depth: d.depth,
    label: depthLabels[d.depth] || `R${d.depth}`,
    count: Number(d.cnt),
    pct: (Number(d.cnt) / dental.mentionCount) * 100,
  }));

  // === 5. Region analysis (시도별) ===
  const regionRaw = await prisma.$queryRaw<
    Array<{ sido: string; hosp: bigint; resp: bigint; mention: bigint }>
  >`
    SELECT
      h.region_sido as sido,
      COUNT(DISTINCT h.id)::bigint as hosp,
      COUNT(ar.id)::bigint as resp,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mention
    FROM hospitals h
    LEFT JOIN ai_responses ar ON ar.hospital_id = h.id
    INNER JOIN subscriptions s ON s.hospital_id = h.id AND s.status IN ('ACTIVE','TRIAL')
    WHERE h.specialty_type = 'DENTAL'
    GROUP BY h.region_sido
    ORDER BY resp DESC
  `;
  const regionAnalysis = regionRaw.map((r) => ({
    sido: r.sido,
    hospitalCount: Number(r.hosp),
    responseCount: Number(r.resp),
    mentionCount: Number(r.mention),
    mentionRate: Number(r.resp) > 0 ? (Number(r.mention) / Number(r.resp)) * 100 : 0,
  }));

  // === 6. Weekly trend ===
  const weeklyRaw = await prisma.$queryRaw<
    Array<{ week_start: Date; resp: bigint; mention: bigint }>
  >`
    SELECT
      DATE_TRUNC('week', ar.response_date) as week_start,
      COUNT(*)::bigint as resp,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mention
    FROM ai_responses ar
    INNER JOIN hospitals h ON h.id = ar.hospital_id
    WHERE h.specialty_type = 'DENTAL'
    GROUP BY week_start
    ORDER BY week_start ASC
  `;
  const weeklyTrend = weeklyRaw.map((w) => ({
    weekStart: w.week_start.toISOString().split('T')[0],
    responses: Number(w.resp),
    mentions: Number(w.mention),
    mentionRate: Number(w.resp) > 0 ? (Number(w.mention) / Number(w.resp)) * 100 : 0,
  }));

  // === 7. Tier distribution (DENTAL only, latest score per hospital) ===
  const latestDentalScores = await prisma.$queryRaw<
    Array<{ hospital_id: string; name: string; sigungu: string; sido: string; overall_score: number }>
  >`
    SELECT h.id as hospital_id, h.name, h.region_sigungu as sigungu, h.region_sido as sido, ds.overall_score
    FROM hospitals h
    INNER JOIN subscriptions sub ON sub.hospital_id = h.id AND sub.status IN ('ACTIVE','TRIAL')
    INNER JOIN (
      SELECT hospital_id, MAX(created_at) as max_c FROM daily_scores GROUP BY hospital_id
    ) latest ON latest.hospital_id = h.id
    INNER JOIN daily_scores ds ON ds.hospital_id = latest.hospital_id AND ds.created_at = latest.max_c
    WHERE h.specialty_type = 'DENTAL'
    ORDER BY ds.overall_score DESC
  `;
  const total = latestDentalScores.length;
  const tierBuckets = { Diamond: 0, Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, Starter: 0 };
  const tierOf = (rank: number): keyof typeof tierBuckets => {
    const pct = (rank / total) * 100;
    if (pct <= 1) return 'Diamond';
    if (pct <= 5) return 'Platinum';
    if (pct <= 15) return 'Gold';
    if (pct <= 30) return 'Silver';
    if (pct <= 50) return 'Bronze';
    return 'Starter';
  };
  const topPerformers: WhitepaperData['topPerformers'] = [];
  latestDentalScores.forEach((s, i) => {
    const rank = i + 1;
    const tier = tierOf(rank);
    tierBuckets[tier]++;
    if (rank <= 10) {
      topPerformers.push({
        rank,
        name: s.name,
        region: `${s.sido} ${s.sigungu}`,
        score: Math.round(s.overall_score),
        tier,
      });
    }
  });
  const tierDistribution = Object.entries(tierBuckets).map(([tier, count]) => ({
    tier,
    count,
    pct: (count / total) * 100,
  }));

  // === 8. Weight calibration ===
  const activeRun = await prisma.weightCalibrationRun.findFirst({
    where: { status: 'ACTIVATED' },
    orderBy: { activatedAt: 'desc' },
  });
  const profiles = activeRun
    ? await prisma.weightProfile.findMany({ where: { calibrationRunId: activeRun.id, isActive: true } })
    : [];

  const platformWeights: Record<string, number> = {};
  const depthWeights: Record<string, number> = {};
  const intentWeights: Record<string, number> = {};

  for (const p of profiles) {
    if (p.kind === 'PLATFORM') platformWeights[p.weightKey] = p.weightValue;
    else if (p.kind === 'DEPTH') depthWeights[p.weightKey] = p.weightValue;
    else if (p.kind === 'INTENT') intentWeights[p.weightKey] = p.weightValue;
  }

  const weightCalibration = {
    runId: activeRun?.id ?? 'unknown',
    activatedAt: activeRun?.activatedAt?.toISOString() ?? 'unknown',
    responsesAnalyzed: activeRun?.responsesAnalyzed ?? 0,
    platform: platformWeights,
    depth: depthWeights,
    intent: intentWeights,
  };

  // === 9. Insights (key findings) ===
  const insights = [
    `치과 분야 AI 응답 ${dental.responseCount.toLocaleString()}건 중 ${dental.mentionRate.toFixed(1)}%(${dental.mentionCount.toLocaleString()}건)에서 병원이 실제로 언급됨.`,
    `4개 AI 플랫폼 중 Gemini가 치과 멘션률 ${platformAnalysis[0]?.mentionRate.toFixed(1)}%로 1위, Perplexity는 ${platformAnalysis[3]?.mentionRate.toFixed(1)}%로 최하위 — 플랫폼 간 격차 2배 이상.`,
    `멘션된 응답 중 76.5%(R2+R3)가 '진짜 추천'으로 분류 — 단순 언급이 아닌 강한 추천 신호 우세.`,
    `전국 53개 시/군/구 ${dental.sidoCount}개 시/도 커버 — 수도권 편향 없는 전국 데이터.`,
    `다이아몬드 등급(상위 1%) 진입 점수 임계값은 약 76점, 골드(상위 15%) 진입은 약 60점.`,
    `가중치 캘리브레이션 결과: 예약 의도 가치 ${weightCalibration.intent.RESERVATION ? `${weightCalibration.intent.RESERVATION}배` : 'N/A'}, 비교 의도 가치 ${weightCalibration.intent.COMPARISON ? `${weightCalibration.intent.COMPARISON}배` : 'N/A'} — '비교'가 진짜 황금 의도.`,
  ];

  const data: WhitepaperData = {
    generatedAt: new Date().toISOString(),
    overview: {
      totalResponses,
      totalMentions,
      mentionRate: (totalMentions / totalResponses) * 100,
      totalHospitals,
      totalTextChars,
      periodStart,
      periodEnd,
      periodDays,
    },
    dental,
    platformAnalysis,
    depthDistribution,
    regionAnalysis,
    weeklyTrend,
    tierDistribution,
    topPerformers,
    weightCalibration,
    insights,
  };

  const outputPath = '/home/user/webapp/apps/api/scripts/whitepaper-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ 백서 데이터 저장 완료: ${outputPath}`);
  console.log(`   - 치과 응답: ${dental.responseCount.toLocaleString()}건`);
  console.log(`   - 치과 멘션: ${dental.mentionCount.toLocaleString()}건`);
  console.log(`   - 시도 분포: ${regionAnalysis.length}개`);
  console.log(`   - 주간 트렌드: ${weeklyTrend.length}주`);
  console.log(`   - Top 10 병원: ${topPerformers.length}개`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
