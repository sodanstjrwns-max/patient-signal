import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 CrawlJob 소요시간 분석 — 5/26 vs 5/30\n');

  for (const targetDate of ['2026-05-26', '2026-05-27', '2026-05-28', '2026-05-30']) {
    const from = new Date(`${targetDate}T00:00:00Z`);
    const to = new Date(from.getTime() + 24 * 3600 * 1000);

    const jobs = await prisma.crawlJob.findMany({
      where: {
        startedAt: { gte: from, lt: to },
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: {
        startedAt: true,
        completedAt: true,
        totalPrompts: true,
        completed: true,
      },
    });

    const validJobs = jobs.filter(j => j.startedAt && j.completedAt);
    const durations = validJobs.map(j => {
      const ms = j.completedAt!.getTime() - j.startedAt!.getTime();
      return ms / 1000;
    });

    if (durations.length === 0) {
      console.log(`${targetDate}: COMPLETED 잡 없음`);
      continue;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = Math.max(...durations);
    const totalPrompts = validJobs.reduce((a, j) => a + (j.totalPrompts || 0), 0);

    console.log(`📅 ${targetDate}: COMPLETED ${durations.length}건`);
    console.log(`   평균 소요: ${avg.toFixed(1)}초 (=${(avg/60).toFixed(1)}분)`);
    console.log(`   중앙값:    ${median.toFixed(1)}초`);
    console.log(`   최대:      ${max.toFixed(1)}초`);
    console.log(`   총 프롬프트 처리: ${totalPrompts}개`);
    console.log(`   잡당 평균 프롬프트: ${(totalPrompts / validJobs.length).toFixed(1)}개`);
    console.log('');
  }

  // 5/27 vs 5/30 RUNNING 좀비들의 startedAt 시간대 보기
  console.log('\n🧟 5/30 RUNNING 좀비 시간 분포:');
  const zombies = await prisma.crawlJob.findMany({
    where: {
      startedAt: { gte: new Date('2026-05-30T00:00:00Z'), lt: new Date('2026-05-31T00:00:00Z') },
      status: 'RUNNING',
    },
    select: { startedAt: true, totalPrompts: true },
    orderBy: { startedAt: 'asc' },
  });
  console.log(`총 ${zombies.length}개`);
  if (zombies.length > 0) {
    const first = zombies[0].startedAt!;
    const last = zombies[zombies.length - 1].startedAt!;
    console.log(`첫 좀비: ${first.toISOString()}`);
    console.log(`마지막 좀비: ${last.toISOString()}`);
    console.log(`총 프롬프트(미완): ${zombies.reduce((a, z) => a + (z.totalPrompts || 0), 0)}개`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
