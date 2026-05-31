/**
 * 5/30 vs 5/31 비교 분석
 * - 평균 prompts/job (B안 효과 측정)
 * - 평균 duration (24분 budget 안에 처리 가능한 병원 수 산출)
 * - 플랜별 분포
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface DayStat {
  date: string;
  totalJobs: number;
  completed: number;
  failed: number;
  running: number;
  avgPromptsPerJob: number;
  avgDurationSec: number;
  medianDurationSec: number;
  p90DurationSec: number;
  totalProcessingMinutes: number;
}

async function analyzeDate(startUTC: Date, endUTC: Date, label: string): Promise<DayStat> {
  const jobs = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: startUTC, lt: endUTC } },
    include: { hospital: { select: { planType: true } } },
  });

  const completed = jobs.filter(j => j.status === 'COMPLETED');
  const failed = jobs.filter(j => j.status === 'FAILED');
  const running = jobs.filter(j => j.status === 'RUNNING');

  const totalPrompts = jobs.reduce((s, j) => s + (j.totalPrompts || 0), 0);
  const avgPromptsPerJob = jobs.length > 0 ? totalPrompts / jobs.length : 0;

  // duration은 COMPLETED만 (FAILED는 cleanup 시각이라 의미 없음)
  const durations = completed
    .filter(j => j.startedAt && j.completedAt)
    .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 1000)
    .sort((a, b) => a - b);

  const avg = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
  const median = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
  const p90 = durations.length > 0 ? durations[Math.floor(durations.length * 0.9)] : 0;

  // 플랜별 평균 prompts
  const byPlan: Record<string, { count: number; promptsTotal: number; avgDuration: number; durationSum: number; durationCount: number }> = {};
  for (const j of jobs) {
    const p = j.hospital.planType || 'FREE';
    if (!byPlan[p]) byPlan[p] = { count: 0, promptsTotal: 0, avgDuration: 0, durationSum: 0, durationCount: 0 };
    byPlan[p].count++;
    byPlan[p].promptsTotal += j.totalPrompts || 0;
    if (j.status === 'COMPLETED' && j.startedAt && j.completedAt) {
      byPlan[p].durationSum += (j.completedAt.getTime() - j.startedAt.getTime()) / 1000;
      byPlan[p].durationCount++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📅 ${label}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`총 잡: ${jobs.length} (COMPLETED=${completed.length}, FAILED=${failed.length}, RUNNING=${running.length})`);
  console.log(`평균 prompts/job: ${avgPromptsPerJob.toFixed(2)}`);
  console.log(`COMPLETED duration — avg=${avg.toFixed(1)}초 / median=${median.toFixed(1)}초 / p90=${p90.toFixed(1)}초`);
  console.log(`\n[플랜별 분포]`);
  for (const [p, s] of Object.entries(byPlan)) {
    const avgPrompts = s.count > 0 ? s.promptsTotal / s.count : 0;
    const avgDur = s.durationCount > 0 ? s.durationSum / s.durationCount : 0;
    console.log(`  ${p.padEnd(10)} | ${s.count}건 | avg ${avgPrompts.toFixed(1)} prompts | avg ${avgDur.toFixed(0)}초/잡`);
  }

  return {
    date: label,
    totalJobs: jobs.length,
    completed: completed.length,
    failed: failed.length,
    running: running.length,
    avgPromptsPerJob,
    avgDurationSec: avg,
    medianDurationSec: median,
    p90DurationSec: p90,
    totalProcessingMinutes: durations.reduce((s, d) => s + d, 0) / 60,
  };
}

async function main() {
  // KST 자정 = UTC 15:00 전날
  // 5/30 KST = 5/29 15:00 UTC ~ 5/30 15:00 UTC
  // 5/31 KST = 5/30 15:00 UTC ~ 5/31 15:00 UTC
  // 실제로 우리 cron은 KST 9시(=UTC 0시) 시작이므로 단순히 UTC 일자로 봐도 무방
  const d28Start = new Date('2026-05-28T00:00:00Z');
  const d29Start = new Date('2026-05-29T00:00:00Z');
  const d30Start = new Date('2026-05-30T00:00:00Z');
  const d31Start = new Date('2026-05-31T00:00:00Z');
  const d31End   = new Date('2026-06-01T00:00:00Z');

  const stat28 = await analyzeDate(d28Start, d29Start, '5/28 (UTC, Breadth-B 추가 직후)');
  const stat29 = await analyzeDate(d29Start, d30Start, '5/29 (UTC)');
  const stat30 = await analyzeDate(d30Start, d31Start, '5/30 (UTC, 일일 배치 18곳만 처리된 날)');
  const stat31 = await analyzeDate(d31Start, d31End, '5/31 (UTC, A안 + B안 배포된 날)');

  // 비교 요약
  console.log(`\n\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║                       📊 A·B안 효과 요약                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log(`날짜   │ 잡수 │ 완료 │ 실패 │ avg prompts │ avg duration │ 처리분`);
  console.log(`───────┼──────┼──────┼──────┼─────────────┼──────────────┼──────`);
  [stat28, stat29, stat30, stat31].forEach(s => {
    console.log(
      `${s.date.slice(0, 4)}  │ ${String(s.totalJobs).padStart(4)} │ ${String(s.completed).padStart(4)} │ ${String(s.failed).padStart(4)} │ ` +
      `${s.avgPromptsPerJob.toFixed(2).padStart(11)} │ ${s.avgDurationSec.toFixed(0).padStart(8)}초 │ ${s.totalProcessingMinutes.toFixed(1).padStart(5)}분`
    );
  });

  // 24분 budget 안에 몇 곳 처리 가능?
  console.log(`\n[24분 budget 산출 — 5/31 기준]`);
  const budgetMs = 24 * 60;
  if (stat31.medianDurationSec > 0) {
    console.log(`  median 기준: ${(budgetMs / stat31.medianDurationSec).toFixed(0)}곳/세션`);
    console.log(`  avg 기준:    ${(budgetMs / stat31.avgDurationSec).toFixed(0)}곳/세션`);
    console.log(`  p90 기준:    ${(budgetMs / stat31.p90DurationSec).toFixed(0)}곳/세션 (안전)`);
    console.log(`  3-way cron (72분) — p90 기준: ${((budgetMs * 3) / stat31.p90DurationSec).toFixed(0)}곳 커버 가능`);
  } else if (stat30.medianDurationSec > 0) {
    console.log(`  (5/31 데이터 부족, 5/30 기준 추정)`);
    console.log(`  median 기준: ${(budgetMs / stat30.medianDurationSec).toFixed(0)}곳/세션`);
    console.log(`  p90 기준:    ${(budgetMs / stat30.p90DurationSec).toFixed(0)}곳/세션 (안전)`);
  }

  // B안 효과 진단
  console.log(`\n[B안 효과 진단]`);
  if (stat31.totalJobs > 0) {
    const promptsDelta = stat31.avgPromptsPerJob - stat30.avgPromptsPerJob;
    const sign = promptsDelta < 0 ? '✅ 감소' : promptsDelta === 0 ? '⚪ 동일' : '⚠️ 증가';
    console.log(`  prompts/job: 5/30 ${stat30.avgPromptsPerJob.toFixed(2)} → 5/31 ${stat31.avgPromptsPerJob.toFixed(2)} (${sign} ${promptsDelta.toFixed(2)})`);
    if (stat31.avgDurationSec > 0 && stat30.avgDurationSec > 0) {
      const durDelta = stat31.avgDurationSec - stat30.avgDurationSec;
      const durSign = durDelta < 0 ? '✅ 빨라짐' : durDelta === 0 ? '⚪ 동일' : '⚠️ 느려짐';
      console.log(`  duration:    5/30 ${stat30.avgDurationSec.toFixed(0)}초 → 5/31 ${stat31.avgDurationSec.toFixed(0)}초 (${durSign} ${durDelta.toFixed(0)}초)`);
    }
  }

  await prisma.$disconnect();
}
main().catch(console.error);
