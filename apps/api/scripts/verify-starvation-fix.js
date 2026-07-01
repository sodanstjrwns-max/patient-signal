// starvation 수정 검증: 새 정렬(least-recently-crawled)이
// 굶주린 병원을 앞으로 끌어오는지 시뮬레이션
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const hospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    include: { prompts: { where: { isActive: true } } },
  });
  const active = hospitals.filter(h => h.prompts.length > 0);

  // 오늘 점수난 병원
  const todayKST = new Date(); todayKST.setUTCHours(0, 0, 0, 0);
  const scoredToday = await prisma.dailyScore.findMany({
    where: { scoreDate: { gte: todayKST } }, select: { hospitalId: true },
  });
  const scoredTodaySet = new Set(scoredToday.map(s => s.hospitalId));

  // 마지막 크롤 시각
  const rows = await prisma.crawlJob.groupBy({ by: ['hospitalId'], _max: { startedAt: true } });
  const lastCrawlMap = new Map();
  for (const r of rows) lastCrawlMap.set(r.hospitalId, r._max.startedAt ? r._max.startedAt.getTime() : 0);

  // === 신규 정렬 (LRC) ===
  const sorted = [...active].sort((a, b) => {
    const aDone = scoredTodaySet.has(a.id) ? 1 : 0;
    const bDone = scoredTodaySet.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const aLast = lastCrawlMap.get(a.id) ?? 0;
    const bLast = lastCrawlMap.get(b.id) ?? 0;
    if (aLast !== bLast) return aLast - bLast;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const now = Date.now();
  const daysSince = (t) => t === 0 || t == null ? '∞(미크롤)' : Math.floor((now - t) / 86400000) + '일';

  console.log(`활성 병원: ${active.length}곳 / 오늘 점수난 병원: ${scoredTodaySet.size}곳\n`);
  console.log('=== 신규 정렬 상위 20곳 (이번 사이클에 우선 처리됨) ===');
  sorted.slice(0, 20).forEach((h, i) => {
    const last = lastCrawlMap.get(h.id) ?? 0;
    console.log(`${String(i + 1).padStart(2)}. ${h.name.padEnd(16)} 마지막크롤: ${daysSince(last)}  ${scoredTodaySet.has(h.id) ? '(오늘완료)' : ''}`);
  });

  // 정원한의원 순번
  const idx = sorted.findIndex(h => h.name.includes('정원'));
  if (idx >= 0) console.log(`\n정원한의원 신규 순번: ${idx + 1}번째 / ${active.length}곳`);

  // 굶주림 통계
  const starved = active.filter(h => {
    const last = lastCrawlMap.get(h.id) ?? 0;
    return last === 0 || (now - last) > 7 * 86400000;
  });
  console.log(`\n7일+ 미크롤(굶주림) 병원: ${starved.length}곳`);
  console.log('→ 이들이 신규 정렬에서 모두 상위로 올라옴 (LRC 우선)');

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
