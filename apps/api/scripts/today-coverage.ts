import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);

  // 1) 활성 병원 전체
  const hospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true, name: true, planType: true, _count: { select: { prompts: { where: { isActive: true } } } } },
  });

  // 2) 오늘 점수 받은 병원
  const scoredToday = await prisma.dailyScore.findMany({
    where: { scoreDate: { gte: todayUTC } },
    select: { hospitalId: true },
  });
  const scoredSet = new Set(scoredToday.map(s => s.hospitalId));

  // 3) 오늘 잡 처리량 (status별)
  const todayJobs = await prisma.crawlJob.groupBy({
    by: ['status'],
    where: { startedAt: { gte: todayUTC } },
    _count: true,
  });

  console.log(`\n[활성 병원 ${hospitals.length}곳 vs 오늘 점수 ${scoredSet.size}곳]`);
  console.log(`커버리지: ${((scoredSet.size / hospitals.length) * 100).toFixed(1)}%`);

  // 플랜별 분포
  const planStat: Record<string, { total: number; scored: number; promptsTotal: number; promptsAvg: number }> = {};
  for (const h of hospitals) {
    const p = h.planType || 'FREE';
    if (!planStat[p]) planStat[p] = { total: 0, scored: 0, promptsTotal: 0, promptsAvg: 0 };
    planStat[p].total++;
    planStat[p].promptsTotal += h._count.prompts;
    if (scoredSet.has(h.id)) planStat[p].scored++;
  }
  for (const p of Object.keys(planStat)) {
    planStat[p].promptsAvg = planStat[p].promptsTotal / planStat[p].total;
  }
  console.log(`\n[플랜별 커버리지 & 평균 프롬프트 수]`);
  for (const [plan, s] of Object.entries(planStat)) {
    console.log(`  ${plan}: ${s.scored}/${s.total} (${((s.scored/s.total)*100).toFixed(0)}%) | 평균 ${s.promptsAvg.toFixed(1)} prompts`);
  }

  // 미처리 병원 명단 (상위 20)
  console.log(`\n[오늘 미처리 병원 ${hospitals.length - scoredSet.size}곳 (상위 20)]`);
  const unscored = hospitals.filter(h => !scoredSet.has(h.id));
  unscored.slice(0, 20).forEach(h => {
    console.log(`  ${h.name} (${h.planType}) | ${h._count.prompts} prompts`);
  });

  console.log(`\n[오늘 CrawlJob status 분포]`);
  todayJobs.forEach(g => console.log(`  ${g.status}: ${g._count}건`));

  await prisma.$disconnect();
}
main().catch(console.error);
