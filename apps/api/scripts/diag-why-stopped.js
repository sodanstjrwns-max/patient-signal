const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 1) 정원한의원: 왜 5/31 이후 크롤이 안 됐나
  const h = await p.hospital.findFirst({ where: { name: { contains: '정원' } } });
  console.log('=== 정원한의원 상태 ===');
  console.log(`  planType=${h.planType} | subscriptionStatus=${h.subscriptionStatus}`);
  const jobs = await p.crawlJob.findMany({ where: { hospitalId: h.id }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(`  최근 CrawlJob:`);
  for (const j of jobs) console.log(`    ${j.createdAt.toISOString().slice(0,16)} | ${j.status} | ${j.completed}/${j.totalPrompts}`);
  const activePrompts = await p.prompt.count({ where: { hospitalId: h.id, isActive: true } });
  console.log(`  활성 질문 수: ${activePrompts}`);

  // 2) 크롤 대상 선정 기준 확인을 위해: subscriptionStatus별 병원 수 + 각 그룹의 오늘 크롤 여부
  console.log('\n=== 구독상태별 병원 수 ===');
  const byStatus = await p.hospital.groupBy({ by: ['subscriptionStatus'], _count: { _all: true } });
  for (const s of byStatus) console.log(`  ${s.subscriptionStatus}: ${s._count._all}곳`);
  console.log('\n=== plan별 병원 수 ===');
  const byPlan = await p.hospital.groupBy({ by: ['planType'], _count: { _all: true } });
  for (const s of byPlan) console.log(`  ${s.planType}: ${s._count._all}곳`);

  // 3) 오늘(6/16) 크롤된 병원 수 vs 활성 병원 수
  const todayStart = new Date('2026-06-16T00:00:00Z');
  const crawledToday = await p.$queryRaw`SELECT count(distinct hospital_id)::int n FROM ai_responses WHERE created_at >= ${todayStart}`;
  console.log(`\n오늘 크롤된 병원 수: ${crawledToday[0].n}곳`);

  // 정원이 ACTIVE인데 오늘 안 돌았는지 교차 확인
  const jeongwonToday = await p.aIResponse.count({ where: { hospitalId: h.id, createdAt: { gte: todayStart } } });
  console.log(`정원한의원 오늘 응답 수: ${jeongwonToday}건`);

  // 4) FAILED 잡 분석 — 에러 메시지 분포
  console.log('\n=== FAILED CrawlJob 에러 분포 (최근 30일) ===');
  const fails = await p.crawlJob.findMany({ where: { status: 'FAILED', createdAt: { gte: new Date('2026-05-17') } }, select: { errorMessage: true, createdAt: true }, take: 2000 });
  const errMap = {};
  for (const f of fails) {
    const key = (f.errorMessage || '(no message)').slice(0, 50);
    errMap[key] = (errMap[key] || 0) + 1;
  }
  const sorted = Object.entries(errMap).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [k, v] of sorted) console.log(`  ${v}건 | ${k}`);
  console.log(`  (최근 30일 FAILED 총 ${fails.length}건)`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
