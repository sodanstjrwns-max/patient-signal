/**
 * 최근 5일간 cron 트리거 패턴 분석
 * - 잡 시작 시각의 시(hour) 분포 → cron이 정확히 언제 트리거되는지 식별
 * - 30분 이상 떨어진 그룹 = 별개 cron 실행
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: fiveDaysAgo } },
    select: { id: true, startedAt: true, status: true, hospitalId: true },
    orderBy: { startedAt: 'asc' },
  });

  console.log(`\n[최근 5일 트리거 시각 분포]`);
  console.log(`전체 잡: ${jobs.length}건\n`);

  // 시작 시각이 1분 이내인 잡들을 한 그룹으로 묶음
  const groups: { start: Date; end: Date; count: number; statuses: Record<string, number> }[] = [];
  for (const job of jobs) {
    if (!job.startedAt) continue;
    const last = groups[groups.length - 1];
    if (last && job.startedAt.getTime() - last.end.getTime() < 60 * 1000) {
      // 같은 그룹
      last.end = job.startedAt;
      last.count++;
      last.statuses[job.status] = (last.statuses[job.status] || 0) + 1;
    } else {
      // 새 그룹
      groups.push({
        start: job.startedAt,
        end: job.startedAt,
        count: 1,
        statuses: { [job.status]: 1 },
      });
    }
  }

  console.log(`[검출된 트리거 그룹 ${groups.length}개]`);
  console.log(`KST 시각          │ 잡수 │ COMPLETED │ FAILED │ RUNNING │ 지속시간`);
  console.log(`──────────────────┼──────┼───────────┼────────┼─────────┼──────────`);
  for (const g of groups) {
    const kst = new Date(g.start.getTime() + 9 * 60 * 60 * 1000);
    const kstStr = kst.toISOString().replace('T', ' ').slice(0, 16);
    const completed = g.statuses['COMPLETED'] || 0;
    const failed = g.statuses['FAILED'] || 0;
    const running = g.statuses['RUNNING'] || 0;
    const durSec = (g.end.getTime() - g.start.getTime()) / 1000;
    const durStr = durSec < 60 ? `${durSec.toFixed(0)}초` : `${(durSec / 60).toFixed(1)}분`;
    console.log(
      `${kstStr} │ ${String(g.count).padStart(4)} │ ${String(completed).padStart(9)} │ ${String(failed).padStart(6)} │ ${String(running).padStart(7)} │ ${durStr}`
    );
  }

  // 시(hour) 분포 — cron 시각 후보
  console.log(`\n[KST 시각대별 트리거 시작 분포]`);
  const hourDist: Record<number, number> = {};
  for (const g of groups) {
    const kstHour = new Date(g.start.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    hourDist[kstHour] = (hourDist[kstHour] || 0) + 1;
  }
  Object.entries(hourDist)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([h, c]) => console.log(`  ${String(h).padStart(2)}시: ${'█'.repeat(c)} ${c}회`));

  await prisma.$disconnect();
}
main().catch(console.error);
