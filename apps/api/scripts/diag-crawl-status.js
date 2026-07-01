const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const lastResp = await p.aIResponse.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, responseDate: true } });
  const lastDs = await p.dailyScore.findFirst({ orderBy: { scoreDate: 'desc' }, select: { scoreDate: true, createdAt: true } });
  console.log('=== 시스템 최신성 ===');
  console.log(`  마지막 AIResponse: responseDate=${lastResp?.responseDate?.toISOString().slice(0,10)} (생성 ${lastResp?.createdAt?.toISOString()})`);
  console.log(`  마지막 DailyScore: scoreDate=${lastDs?.scoreDate?.toISOString().slice(0,10)} (생성 ${lastDs?.createdAt?.toISOString()})`);
  const today = new Date();
  const daysSince = Math.floor((today - lastResp.createdAt) / 86400000);
  console.log(`  >>> 마지막 크롤로부터 ${daysSince}일 경과 (오늘 ${today.toISOString().slice(0,10)})`);

  console.log('\n=== CrawlJob 상태 분포 ===');
  const byStatus = await p.crawlJob.groupBy({ by: ['status'], _count: { _all: true } });
  for (const s of byStatus) console.log(`  ${s.status}: ${s._count._all}건`);

  console.log('\n=== 최근 CrawlJob 15개 ===');
  const recent = await p.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 15, include: { hospital: { select: { name: true } } } });
  for (const j of recent) {
    const err = j.errorMessage ? ('err: ' + j.errorMessage.slice(0, 40)) : '';
    console.log(`  ${j.createdAt.toISOString().slice(0,16)} | ${j.status.padEnd(10)} | ${j.completed}/${j.totalPrompts} fail=${j.failed} | ${j.hospital.name.slice(0,14)} | ${err}`);
  }

  const stuck = await p.crawlJob.findMany({ where: { status: { in: ['RUNNING', 'PENDING'] } }, orderBy: { createdAt: 'asc' }, take: 10, include: { hospital: { select: { name: true } } } });
  console.log(`\n=== 멈춰있는(RUNNING/PENDING) 잡 (최대 10개 표시) ===`);
  for (const j of stuck) console.log(`  ${j.createdAt.toISOString().slice(0,16)} | ${j.status} | ${j.hospital.name.slice(0,14)} | started=${j.startedAt?.toISOString().slice(0,16) || '-'}`);

  console.log('\n=== 최근 응답 생성 추이 (createdAt 일별) ===');
  const trend = await p.$queryRaw`SELECT created_at::date d, count(*)::int n FROM ai_responses WHERE created_at > now() - interval '40 days' GROUP BY 1 ORDER BY 1 DESC LIMIT 15`;
  for (const r of trend) console.log(`  ${r.d.toISOString().slice(0,10)}: ${r.n}건`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
