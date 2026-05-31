/**
 * 좀비 CrawlJob 일괄 정리
 *
 * 정의: 시작된 지 30분 이상 지났는데 여전히 RUNNING 상태인 잡
 *
 * 동작:
 *   1. dry-run 으로 대상 식별
 *   2. --apply 플래그가 있으면 실제 FAILED로 업데이트
 *
 * 사용:
 *   npx ts-node scripts/cleanup-zombie-jobs.ts          # dry-run
 *   npx ts-node scripts/cleanup-zombie-jobs.ts --apply  # 실제 실행
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

const ZOMBIE_THRESHOLD_MINUTES = 30;

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('\n🧟 좀비 잡 정리 시작');
  console.log(`모드: ${apply ? '🔥 APPLY (실제 업데이트)' : '🔍 DRY-RUN (조회만)'}\n`);
  console.log('='.repeat(80));

  const threshold = new Date(Date.now() - ZOMBIE_THRESHOLD_MINUTES * 60 * 1000);

  // 좀비 = RUNNING + startedAt이 30분 이전
  const zombies = await prisma.crawlJob.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: threshold },
    },
    select: {
      id: true,
      hospitalId: true,
      startedAt: true,
      totalPrompts: true,
      completed: true,
      failed: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  console.log(`발견된 좀비: ${zombies.length}건\n`);

  // 날짜별 분포
  const byDate = new Map<string, number>();
  for (const z of zombies) {
    if (!z.startedAt) continue;
    const d = z.startedAt.toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + 1);
  }
  console.log('📅 날짜별 좀비 분포:');
  Array.from(byDate.entries()).sort().forEach(([d, c]) => {
    console.log(`  ${d} │ ${c}건`);
  });

  // 병원별 좀비 카운트 (가장 자주 죽는 곳)
  const byHospital = new Map<string, number>();
  for (const z of zombies) {
    byHospital.set(z.hospitalId, (byHospital.get(z.hospitalId) || 0) + 1);
  }
  const topZombieHospitals = Array.from(byHospital.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topZombieHospitals.length > 0) {
    const hospitalIds = topZombieHospitals.map(([id]) => id);
    const hospitals = await prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true, planType: true },
    });
    const hMap = new Map(hospitals.map(h => [h.id, h]));

    console.log('\n💀 좀비 잡 TOP 10 병원 (자주 죽는 곳):');
    topZombieHospitals.forEach(([id, count], i) => {
      const h = hMap.get(id);
      console.log(`  ${(i + 1).toString().padStart(2)}. ${count}건 │ ${h?.planType || '?'} │ ${h?.name || id}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  if (!apply) {
    console.log('\n💡 실제로 정리하려면: npx ts-node scripts/cleanup-zombie-jobs.ts --apply\n');
    return;
  }

  // 실제 업데이트
  console.log('\n🔥 좀비 정리 실행 중...\n');

  const ids = zombies.map(z => z.id);
  const result = await prisma.crawlJob.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
    },
  });

  console.log(`✅ ${result.count}개 잡을 RUNNING → FAILED로 변경 완료`);
  console.log(`\n다음 단계: 스케줄러가 다시 돌면 정상 처리됩니다.\n`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
