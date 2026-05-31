import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const CODE = 'PF2026-STARTER-FREE';
  const NEW_MAX = 2147483647; // PostgreSQL Int 최대값 (사실상 무제한)

  // 1. 현재 상태 확인
  const before = await prisma.coupon.findUnique({
    where: { code: CODE },
    select: { code: true, name: true, currentUses: true, maxUses: true, isActive: true, expiresAt: true },
  });

  if (!before) {
    console.log(`❌ 쿠폰을 찾을 수 없습니다: ${CODE}`);
    return;
  }

  console.log('\n========== 📋 변경 전 ==========');
  console.log(`  코드      : ${before.code}`);
  console.log(`  이름      : ${before.name}`);
  console.log(`  현재 사용  : ${before.currentUses}회`);
  console.log(`  최대 사용  : ${before.maxUses}회`);
  console.log(`  활성 여부  : ${before.isActive ? '✅ 활성' : '❌ 비활성'}`);
  console.log(`  만료일    : ${before.expiresAt?.toISOString().split('T')[0] || '없음'}`);

  // 2. 업데이트
  const after = await prisma.coupon.update({
    where: { code: CODE },
    data: {
      maxUses: NEW_MAX,
      isActive: true, // 혹시 비활성 상태였다면 활성화
    },
    select: { code: true, name: true, currentUses: true, maxUses: true, isActive: true },
  });

  console.log('\n========== ✅ 변경 후 ==========');
  console.log(`  코드      : ${after.code}`);
  console.log(`  이름      : ${after.name}`);
  console.log(`  현재 사용  : ${after.currentUses}회`);
  console.log(`  최대 사용  : ${after.maxUses.toLocaleString()}회 (사실상 무제한)`);
  console.log(`  활성 여부  : ${after.isActive ? '✅ 활성' : '❌ 비활성'}`);
  console.log(`  잔여 수량  : ${(after.maxUses - after.currentUses).toLocaleString()}개\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
