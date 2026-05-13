// 가중치가 실제로 운영에 반영됐는지 + 점수 변화 안 보이는 원인 진단
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 가중치 적용 상태 + 점수 변화 진단\n');
  console.log('━'.repeat(72));

  // 1. 현재 활성 RUN
  const activeRun = await prisma.weightCalibrationRun.findFirst({
    where: { scope: 'GLOBAL', scopeKey: 'GLOBAL', isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n[1] 활성 RUN:');
  if (activeRun) {
    console.log(`  ✅ RUN ID:        ${activeRun.id}`);
    console.log(`  ✅ activatedAt:   ${activeRun.activatedAt}`);
    console.log(`  ✅ activatedBy:   ${activeRun.activatedBy}`);
    console.log(`  ✅ responses:     ${activeRun.responsesAnalyzed}건`);
  } else {
    console.log(`  ❌ 활성 RUN 없음`);
  }

  // 2. 활성 프로파일 (실제 운영에 사용되는 값)
  const activeProfiles = await prisma.weightProfile.findMany({
    where: { scope: 'GLOBAL', scopeKey: 'GLOBAL', isActive: true },
    orderBy: [{ kind: 'asc' }, { weightKey: 'asc' }],
  });
  console.log(`\n[2] 활성 가중치 프로파일 (총 ${activeProfiles.length}개):`);
  const grouped: Record<string, any[]> = {};
  for (const p of activeProfiles) {
    if (!grouped[p.kind]) grouped[p.kind] = [];
    grouped[p.kind].push(p);
  }
  for (const [kind, items] of Object.entries(grouped)) {
    console.log(`\n  [${kind}] ${items.length}개`);
    for (const p of items) {
      console.log(`    ${p.weightKey.padEnd(14)} = ${String(p.weightValue).padStart(5)}  source=${p.source}`);
    }
  }

  // 3. 최근 DailyScore 레코드 — 새 가중치로 계산된 게 있는가?
  console.log('\n' + '━'.repeat(72));
  console.log('[3] 최근 7일 DailyScore 생성 추이:');
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentScores = await prisma.dailyScore.groupBy({
    by: ['scoreDate'],
    where: { scoreDate: { gte: sevenDaysAgo } },
    _count: { _all: true },
    orderBy: { scoreDate: 'desc' },
  });
  if (recentScores.length === 0) {
    console.log('  ⚠️  최근 7일간 DailyScore 레코드 0건');
  } else {
    for (const s of recentScores) {
      console.log(`  ${s.scoreDate.toISOString().slice(0, 10)}: ${s._count._all}개 병원`);
    }
  }

  // 4. 활성화 시점 이후 DailyScore가 생성됐는가?
  console.log('\n[4] 활성화 시점 이후 DailyScore:');
  if (activeRun?.activatedAt) {
    const after = await prisma.dailyScore.count({
      where: { createdAt: { gte: activeRun.activatedAt } },
    });
    const before = await prisma.dailyScore.count({
      where: { createdAt: { lt: activeRun.activatedAt } },
    });
    console.log(`  활성화 전 생성:  ${before}건`);
    console.log(`  활성화 후 생성:  ${after}건`);
    if (after === 0) {
      console.log(`\n  🔴 진단: 활성화 후 새 점수가 생성되지 않았습니다.`);
      console.log(`         → 새 가중치는 "다음 점수 계산 시점"부터 반영됩니다.`);
      console.log(`         → 이미 저장된 DailyScore는 옛날 가중치로 계산된 값입니다.`);
    }
  }

  // 5. 가장 최근 DailyScore 1건 자세히 보기
  const latestScore = await prisma.dailyScore.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { hospital: { select: { name: true } } },
  });
  if (latestScore) {
    console.log(`\n[5] 가장 최근 DailyScore:`);
    console.log(`  병원:         ${latestScore.hospital.name}`);
    console.log(`  scoreDate:    ${latestScore.scoreDate.toISOString().slice(0, 10)}`);
    console.log(`  createdAt:    ${latestScore.createdAt.toISOString()}`);
    console.log(`  overallScore: ${latestScore.overallScore}`);
    if (activeRun?.activatedAt && latestScore.createdAt < activeRun.activatedAt) {
      const hoursDiff = ((activeRun.activatedAt.getTime() - latestScore.createdAt.getTime()) / 3600000).toFixed(1);
      console.log(`  ⚠️  이 점수는 활성화 ${hoursDiff}시간 전에 생성됨 → 옛 가중치 기준`);
    }
  }

  console.log('\n' + '━'.repeat(72));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
