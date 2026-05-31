import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const running = await prisma.crawlJob.findMany({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'asc' },
    include: { hospital: { select: { name: true, planType: true } } },
  });
  console.log(`\n[RUNNING ${running.length}건 상세]`);
  for (const r of running) {
    const startMs = r.startedAt ? r.startedAt.getTime() : Date.now();
    const elapsedMin = ((Date.now() - startMs) / 60000).toFixed(1);
    const startIso = r.startedAt ? r.startedAt.toISOString() : 'null';
    console.log(`  ${r.hospital.name} (${r.hospital.planType}) | prompts=${r.totalPrompts} | completed=${r.completed} | failed=${r.failed} | startedAt=${startIso} | ${elapsedMin}분 경과`);
  }

  // 오늘(KST) 처리된 DailyScore
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  const todayScores = await prisma.dailyScore.findMany({
    where: { scoreDate: { gte: todayUTC } },
    include: { hospital: { select: { name: true } } },
    orderBy: { scoreDate: 'desc' },
  });
  console.log(`\n[오늘 생성된 DailyScore ${todayScores.length}건]`);
  todayScores.slice(0, 15).forEach(s => {
    console.log(`  ${s.hospital.name} | overall=${s.overallScore} | ${s.scoreDate.toISOString()}`);
  });
  if (todayScores.length > 15) console.log(`  ... +${todayScores.length - 15}건`);

  // 최근 10분 내 COMPLETED 잡
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCompleted = await prisma.crawlJob.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: tenMinAgo } },
    orderBy: { completedAt: 'desc' },
    include: { hospital: { select: { name: true, planType: true } } },
  });
  console.log(`\n[최근 10분 COMPLETED ${recentCompleted.length}건]`);
  recentCompleted.slice(0, 20).forEach(c => {
    const dur = c.completedAt && c.startedAt
      ? ((c.completedAt.getTime() - c.startedAt.getTime()) / 1000).toFixed(0)
      : '?';
    console.log(`  ${c.hospital.name} (${c.hospital.planType}) | prompts=${c.totalPrompts} (${c.completed}✓ ${c.failed}✗) | ${dur}초`);
  });

  // 최근 10분 내 FAILED 잡
  const recentFailed = await prisma.crawlJob.findMany({
    where: { status: 'FAILED', completedAt: { gte: tenMinAgo } },
    orderBy: { completedAt: 'desc' },
    include: { hospital: { select: { name: true, planType: true } } },
  });
  console.log(`\n[최근 10분 FAILED ${recentFailed.length}건]`);
  recentFailed.slice(0, 10).forEach(c => {
    console.log(`  ${c.hospital.name} (${c.hospital.planType}) | prompts=${c.totalPrompts} (${c.completed}✓ ${c.failed}✗)`);
  });

  await prisma.$disconnect();
}
main().catch(console.error);
