/**
 * 실시간 크롤링 진행 모니터
 * 트리거 후 진행 상황을 보기 위함
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // 1. 오늘 만들어진 CrawlJob 상태별
  const jobs = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: todayStart } },
    select: {
      id: true,
      hospitalId: true,
      status: true,
      totalPrompts: true,
      completed: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  const byStatus = new Map<string, number>();
  for (const j of jobs) {
    byStatus.set(j.status, (byStatus.get(j.status) || 0) + 1);
  }

  console.log(`\n📊 오늘 (UTC ${todayStart.toISOString().slice(0,10)}) CrawlJob: 총 ${jobs.length}건`);
  Array.from(byStatus.entries()).forEach(([s, c]) => {
    console.log(`  ${s}: ${c}건`);
  });

  // 2. 오늘 발생한 DailyScore (점수 계산 완료된 곳)
  const scoresToday = await prisma.dailyScore.findMany({
    where: { scoreDate: { gte: todayStart } },
    select: { hospitalId: true, overallScore: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\n📈 오늘 DailyScore 신규: ${scoresToday.length}건`);

  if (scoresToday.length > 0) {
    const latest5 = scoresToday.slice(0, 5);
    const hospitalIds = latest5.map(s => s.hospitalId);
    const hospitals = await prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(hospitals.map(h => [h.id, h.name]));

    console.log('  최근 5개:');
    latest5.forEach(s => {
      const time = s.createdAt.toISOString().slice(11, 19);
      console.log(`    ${time} UTC │ ${s.overallScore}pt │ ${nameMap.get(s.hospitalId) || s.hospitalId}`);
    });
  }

  // 3. 현재 RUNNING 중인 잡
  const running = jobs.filter(j => j.status === 'RUNNING');
  console.log(`\n🏃 현재 RUNNING: ${running.length}건`);
  if (running.length > 0 && running.length <= 5) {
    const hospitalIds = running.map(j => j.hospitalId);
    const hospitals = await prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(hospitals.map(h => [h.id, h.name]));
    running.forEach(j => {
      if (!j.startedAt) return;
      const elapsed = ((Date.now() - j.startedAt.getTime()) / 1000).toFixed(0);
      console.log(`    [${elapsed}s] ${nameMap.get(j.hospitalId) || j.hospitalId}`);
    });
  }

  // 4. 가장 최근 COMPLETED 잡의 소요시간
  const completed = jobs.filter(j => j.status === 'COMPLETED' && j.startedAt && j.completedAt);
  if (completed.length > 0) {
    const durations = completed.map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 1000);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`\n⏱️  COMPLETED ${completed.length}건, 평균 소요: ${avg.toFixed(1)}초`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
