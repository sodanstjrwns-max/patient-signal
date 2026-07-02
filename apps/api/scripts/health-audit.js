/* eslint-disable */
// 측정 시스템 실데이터 감사 스크립트 (read-only)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d3 = new Date(now.getTime() - 3 * 86400000);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  // ===== 1. 병원 현황 =====
  const hospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true, name: true, planType: true, subscriptionStatus: true, createdAt: true },
  });
  console.log(`\n===== 활성/체험 병원: ${hospitals.length}곳 =====`);
  const byPlan = {};
  hospitals.forEach(h => { byPlan[h.planType] = (byPlan[h.planType] || 0) + 1; });
  console.log('플랜 분포:', JSON.stringify(byPlan));

  // ===== 2. 전체 병원 최신 점수 순위 =====
  const latestScores = await prisma.$queryRaw`
    SELECT DISTINCT ON (ds.hospital_id)
      ds.hospital_id, h.name, h.plan_type,
      ds.score_date, ds.overall_score, ds.mention_count, ds.sov_percent
    FROM daily_scores ds
    JOIN hospitals h ON h.id = ds.hospital_id
    WHERE h.subscription_status IN ('ACTIVE','TRIAL')
    ORDER BY ds.hospital_id, ds.score_date DESC
  `;
  const ranked = [...latestScores].sort((a, b) => b.overall_score - a.overall_score);
  console.log(`\n===== 전체 병원 점수 순위 (최신 DailyScore 기준, ${ranked.length}곳) =====`);
  ranked.forEach((r, i) => {
    const dateStr = new Date(r.score_date).toISOString().slice(0, 10);
    const stale = (now - new Date(r.score_date)) > 3 * 86400000 ? ' ⚠️점수낡음' : '';
    console.log(`${String(i + 1).padStart(3)}. ${String(r.overall_score).padStart(3)}점 | ${r.name} [${r.plan_type}] (${dateStr}, 언급 ${r.mention_count})${stale}`);
  });

  // 점수 없는 병원
  const scoredIds = new Set(latestScores.map(r => r.hospital_id));
  const noScore = hospitals.filter(h => !scoredIds.has(h.id));
  if (noScore.length) {
    console.log(`\n⚠️ 점수 자체가 없는 병원 (${noScore.length}곳):`);
    noScore.forEach(h => console.log(`  - ${h.name} [${h.planType}] 가입 ${h.createdAt.toISOString().slice(0,10)}`));
  }

  // ===== 3. 크롤링 헬스 (최근 7일) =====
  console.log('\n===== 크롤링 헬스 (최근 7일) =====');
  const jobs = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: d7 } },
    select: { hospitalId: true, status: true, startedAt: true, completedAt: true, totalPrompts: true, completed: true, failed: true },
  });
  const statusCount = {};
  jobs.forEach(j => { statusCount[j.status] = (statusCount[j.status] || 0) + 1; });
  console.log(`총 크롤잡: ${jobs.length}건 | 상태:`, JSON.stringify(statusCount));

  // 좀비 (RUNNING 30분+)
  const zombies = jobs.filter(j => j.status === 'RUNNING' && (now - j.startedAt) > 30 * 60000);
  console.log(`현재 좀비(RUNNING 30분+): ${zombies.length}건`);

  // 프롬프트 성공률
  const done = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'FAILED');
  const totP = done.reduce((s, j) => s + (j.totalPrompts || 0), 0);
  const totC = done.reduce((s, j) => s + (j.completed || 0), 0);
  const totF = done.reduce((s, j) => s + (j.failed || 0), 0);
  console.log(`프롬프트 처리: 성공 ${totC} / 실패 ${totF} / 목표 ${totP} (성공률 ${totP ? Math.round(totC/totP*100) : 0}%)`);

  // 병원별 마지막 크롤 — 3일+ 굶은 병원
  const lastCrawl = await prisma.crawlJob.groupBy({ by: ['hospitalId'], _max: { startedAt: true } });
  const lastMap = new Map(lastCrawl.map(r => [r.hospitalId, r._max.startedAt]));
  const starved = hospitals
    .map(h => ({ ...h, last: lastMap.get(h.id) || null }))
    .filter(h => !h.last || h.last < d3)
    .sort((a, b) => (a.last?.getTime() || 0) - (b.last?.getTime() || 0));
  console.log(`\n3일+ 크롤 안 된 병원: ${starved.length}곳`);
  starved.slice(0, 20).forEach(h => {
    console.log(`  - ${h.name} [${h.planType}] 마지막: ${h.last ? h.last.toISOString().slice(0,10) : '없음'}`);
  });

  // 오늘 크롤/점수 커버리지
  const todayJobs = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: today } }, select: { hospitalId: true },
  });
  const todayScores = await prisma.dailyScore.count({ where: { scoreDate: { gte: today } } });
  console.log(`\n오늘 크롤된 병원: ${new Set(todayJobs.map(j => j.hospitalId)).size}곳 / 오늘 점수 생성: ${todayScores}곳 (활성 ${hospitals.length}곳 중)`);

  // ===== 4. 측정 품질 지표 (최근 7일 응답) =====
  console.log('\n===== 측정 품질 (최근 7일 AI 응답) =====');
  const respStats = await prisma.$queryRaw`
    SELECT ai_platform,
      COUNT(*)::int AS total,
      SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::int AS mentioned,
      SUM(CASE WHEN sentiment_score_v2 IS NULL AND is_mentioned THEN 1 ELSE 0 END)::int AS null_sent_v2,
      SUM(CASE WHEN recommendation_depth IS NULL AND is_mentioned THEN 1 ELSE 0 END)::int AS null_depth,
      SUM(CASE WHEN query_intent IS NULL THEN 1 ELSE 0 END)::int AS null_intent
    FROM ai_responses
    WHERE response_date >= ${d7}
    GROUP BY ai_platform ORDER BY total DESC
  `;
  console.log('플랫폼 | 응답수 | 언급 | 언급률 | ABHS누락(sentV2/depth/intent)');
  respStats.forEach(r => {
    console.log(`${r.ai_platform.padEnd(10)} | ${String(r.total).padStart(5)} | ${String(r.mentioned).padStart(4)} | ${String(Math.round(r.mentioned/r.total*100)).padStart(3)}% | ${r.null_sent_v2}/${r.null_depth}/${r.null_intent}`);
  });

  // 최근 7일 vs 이전 7일 언급률 추이 (측정 안정성)
  const d14 = new Date(now.getTime() - 14 * 86400000);
  const trend = await prisma.$queryRaw`
    SELECT (CASE WHEN response_date >= ${d7} THEN 'recent7' ELSE 'prev7' END) AS period,
      COUNT(*)::int AS total,
      SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::int AS mentioned
    FROM ai_responses WHERE response_date >= ${d14}
    GROUP BY 1
  `;
  trend.forEach(r => console.log(`${r.period}: ${r.mentioned}/${r.total} = ${Math.round(r.mentioned/r.total*100)}% 언급률`));

  // repeat 측정 여부 (같은 prompt+platform+day 중복 횟수)
  const repeats = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS groups, AVG(cnt)::float AS avg_repeat
    FROM (
      SELECT prompt_id, ai_platform, DATE(response_date), COUNT(*) AS cnt
      FROM ai_responses WHERE response_date >= ${d7} AND prompt_id IS NOT NULL
      GROUP BY prompt_id, ai_platform, DATE(response_date)
    ) t
  `;
  console.log(`\n반복측정: 그룹 ${repeats[0].groups}개, 평균 반복 ${Number(repeats[0].avg_repeat).toFixed(2)}회 (1.0 = 단발 측정)`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
