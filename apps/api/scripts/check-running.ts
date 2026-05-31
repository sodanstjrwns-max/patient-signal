import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();
(async () => {
  const running = await prisma.crawlJob.findMany({
    where: { status: 'RUNNING' },
    select: { startedAt: true, hospitalId: true },
    orderBy: { startedAt: 'asc' },
  });
  if (running.length === 0) {
    console.log('RUNNING 없음');
  } else {
    const first = running[0].startedAt!;
    const last = running[running.length-1].startedAt!;
    console.log(`RUNNING ${running.length}건`);
    console.log(`최초 시작: ${first.toISOString()}`);
    console.log(`최후 시작: ${last.toISOString()}`);
    console.log(`현재시각:  ${new Date().toISOString()}`);
    const oldestAgo = ((Date.now() - first.getTime())/1000).toFixed(0);
    const newestAgo = ((Date.now() - last.getTime())/1000).toFixed(0);
    console.log(`최초로부터 경과: ${oldestAgo}초 = ${(Number(oldestAgo)/60).toFixed(1)}분`);
    console.log(`최후로부터 경과: ${newestAgo}초`);
  }
  await prisma.$disconnect();
})();
