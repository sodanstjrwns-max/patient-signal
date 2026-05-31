import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const allRedemptions = await prisma.couponRedemption.findMany({
    orderBy: { redeemedAt: 'desc' },
  });

  // 쿠폰/병원/유저 정보 매핑
  const couponIds = [...new Set(allRedemptions.map(r => r.couponId))];
  const hospitalIds = [...new Set(allRedemptions.map(r => r.hospitalId))];
  const userIds = [...new Set(allRedemptions.map(r => r.userId))];

  const [coupons, hospitals, users] = await Promise.all([
    prisma.coupon.findMany({ where: { id: { in: couponIds } }, select: { id: true, code: true, name: true } }),
    prisma.hospital.findMany({ where: { id: { in: hospitalIds } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
  ]);

  const couponMap = new Map(coupons.map(c => [c.id, c]));
  const hospitalMap = new Map(hospitals.map(h => [h.id, h]));
  const userMap = new Map(users.map(u => [u.id, u]));

  // 쿠폰별 그룹핑
  const byCode: Record<string, any[]> = {};
  for (const r of allRedemptions) {
    const code = couponMap.get(r.couponId)?.code || 'UNKNOWN';
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(r);
  }

  console.log('\n========== 🎟️  쿠폰별 실제 사용 이력 ==========\n');
  for (const [code, redemptions] of Object.entries(byCode)) {
    const couponName = couponMap.get(redemptions[0].couponId)?.name || '?';
    console.log(`\n【${code}】 (${couponName}) — ${redemptions.length}회 사용`);
    redemptions.forEach((r, i) => {
      const date = r.redeemedAt.toISOString().split('T')[0];
      const hName = hospitalMap.get(r.hospitalId)?.name || '?';
      const uEmail = userMap.get(r.userId)?.email || '?';
      console.log(`  ${(i + 1).toString().padStart(2)}. ${date} | ${hName.padEnd(30)} | ${uEmail.padEnd(35)} | ${r.appliedPlan} (${r.freeMonths}개월)`);
    });
  }

  console.log(`\n========== 📊 총정리 ==========`);
  console.log(`총 쿠폰 사용 건수: ${allRedemptions.length}건`);
  console.log(`쿠폰 사용 병원(고유): ${new Set(allRedemptions.map(r => r.hospitalId)).size}개`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
