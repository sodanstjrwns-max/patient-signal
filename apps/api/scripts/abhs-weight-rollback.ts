// 가중치 RUN 롤백 — 직전 활성 RUN으로 되돌림 (없으면 DEFAULT 복귀)
// 사용법: npx ts-node scripts/abhs-weight-rollback.ts [scopeKey=GLOBAL]

import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WeightService } = require('../src/scores/weight.service');

const prisma = new PrismaClient();

async function main() {
  const scopeKey = process.argv[2] || 'GLOBAL';
  const weightService = new WeightService(prisma as any);

  console.log(`🔄 롤백 시도: scope=GLOBAL, scopeKey=${scopeKey}`);
  const result = await weightService.rollback('GLOBAL', scopeKey);

  if (result.rolledBackTo) {
    console.log(`✅ 직전 RUN으로 롤백됨: ${result.rolledBackTo}`);
  } else {
    console.log(`✅ 이전 RUN이 없어 DEFAULT 가중치로 복귀했습니다.`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ 롤백 실패:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
