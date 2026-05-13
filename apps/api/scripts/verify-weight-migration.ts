// 마이그레이션 적용 확인용 quick check
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const profileCount = await prisma.weightProfile.count();
  const runCount = await prisma.weightCalibrationRun.count();
  console.log(`✅ weight_profiles: ${profileCount}건 (DEFAULT 시드 17건 예상)`);
  console.log(`✅ weight_calibration_runs: ${runCount}건`);

  const samples = await prisma.weightProfile.findMany({
    where: { source: 'DEFAULT' },
    orderBy: [{ kind: 'asc' }, { weightKey: 'asc' }],
  });
  console.log(`\n📋 DEFAULT 프로파일 시드 확인:`);
  for (const p of samples) {
    console.log(`  ${p.kind.padEnd(10)} | ${p.weightKey.padEnd(15)} | ${p.weightValue}`);
  }
  await prisma.$disconnect();
})();
