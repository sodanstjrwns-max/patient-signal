import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

(async () => {
  const running = await prisma.crawlJob.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, hospitalId: true, startedAt: true, totalPrompts: true },
    orderBy: { startedAt: 'asc' },
  });

  console.log(`\n총 RUNNING: ${running.length}건\n`);

  // hospitalId별 카운트
  const byHospital = new Map<string, number>();
  for (const j of running) {
    byHospital.set(j.hospitalId, (byHospital.get(j.hospitalId) || 0) + 1);
  }
  console.log(`유니크 병원 수: ${byHospital.size}`);

  // 중복 있는 병원들
  const dups = Array.from(byHospital.entries()).filter(([_, c]) => c > 1);
  console.log(`중복 잡 있는 병원: ${dups.length}곳`);

  if (dups.length > 0) {
    console.log('\n중복 TOP 5:');
    dups.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([id, c]) => {
      console.log(`  ${c}건 │ ${id.slice(0, 8)}...`);
    });
  }

  // 처음 5개와 마지막 5개의 startedAt 간격
  console.log('\n처음 10개 잡의 시작 간격:');
  for (let i = 0; i < Math.min(10, running.length); i++) {
    const j = running[i];
    const t = j.startedAt!.toISOString().slice(11, 23);
    const gap = i > 0 ? ((j.startedAt!.getTime() - running[i-1].startedAt!.getTime())/1000).toFixed(2) : '-';
    console.log(`  [${i+1}] ${t} (+${gap}s) hosp=${j.hospitalId.slice(0,8)} prompts=${j.totalPrompts}`);
  }

  await prisma.$disconnect();
})();
