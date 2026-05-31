/**
 * 강제 청소: 모든 RUNNING 잡을 FAILED로 (시간 룰 무시)
 * 트리거 충돌 상황에서 사용
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.crawlJob.count({ where: { status: 'RUNNING' } });
  console.log(`현재 RUNNING: ${before}건`);

  if (before === 0) {
    console.log('정리할 잡 없음');
    return;
  }

  console.log('💥 강제 청소 실행...');
  const result = await prisma.crawlJob.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'FAILED', completedAt: new Date() },
  });
  console.log(`✅ ${result.count}건 FAILED 처리 완료`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
