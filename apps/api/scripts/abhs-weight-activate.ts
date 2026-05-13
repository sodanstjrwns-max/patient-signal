// 특정 캘리브레이션 RUN을 활성화 (이전 활성 RUN은 자동 비활성화됨)
// 사용법: npx ts-node scripts/abhs-weight-activate.ts <runId>

import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WeightService } = require('../src/scores/weight.service');

const prisma = new PrismaClient();

async function main() {
  const runId = process.argv[2];
  if (!runId) {
    console.error('❌ 사용법: npx ts-node scripts/abhs-weight-activate.ts <runId>');
    console.error('\n사용 가능한 RUN 목록:');
    const runs = await prisma.weightCalibrationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, scope: true, scopeKey: true, isActive: true, createdAt: true, responsesAnalyzed: true },
    });
    for (const r of runs) {
      const flag = r.isActive ? '🟢 ACTIVE' : '⚪ idle';
      console.error(`  ${flag}  ${r.id} | ${r.scope}/${r.scopeKey} | ${r.responsesAnalyzed}건 | ${r.createdAt.toISOString().slice(0, 16)}`);
    }
    process.exit(1);
  }

  const weightService = new WeightService(prisma as any);
  console.log(`🔄 RUN 활성화 시도: ${runId}`);
  await weightService.activateRun(runId, process.env.USER ? `USER:${process.env.USER}` : 'CLI');
  console.log(`✅ 활성화 완료. 다음 ABHS 계산부터 새 가중치가 반영됩니다.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ 활성화 실패:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
