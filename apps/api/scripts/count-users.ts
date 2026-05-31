import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

const prisma = new PrismaClient();

async function main() {
  const [totalUsers, totalHospitals, planBreakdown, recentSignups, couponUsage, subscriptionStatus] = await Promise.all([
    prisma.user.count(),
    prisma.hospital.count(),
    prisma.hospital.groupBy({
      by: ['planType'],
      _count: { id: true },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.coupon.findMany({
      select: {
        code: true,
        name: true,
        currentUses: true,
        maxUses: true,
      },
      orderBy: { currentUses: 'desc' },
    }),
    prisma.hospital.groupBy({
      by: ['subscriptionStatus'],
      _count: { id: true },
    }),
  ]);

  console.log('\n========== 📊 Patient Signal 가입자 현황 ==========\n');
  console.log(`👤 총 가입자 (User): ${totalUsers}명`);
  console.log(`🏥 총 병원 (Hospital): ${totalHospitals}개`);
  console.log(`🆕 최근 7일 신규 가입: ${recentSignups}명`);

  console.log('\n========== 💳 플랜 분포 ==========');
  for (const p of planBreakdown) {
    console.log(`  ${p.planType.padEnd(12)}: ${p._count.id}개`);
  }

  console.log('\n========== 📋 구독 상태 ==========');
  for (const s of subscriptionStatus) {
    console.log(`  ${(s.subscriptionStatus || 'NULL').padEnd(12)}: ${s._count.id}개`);
  }

  console.log('\n========== 🎟️  쿠폰 사용 현황 ==========');
  for (const c of couponUsage) {
    const remaining = c.maxUses - c.currentUses;
    const pct = c.maxUses > 0 ? Math.round((c.currentUses / c.maxUses) * 100) : 0;
    console.log(`  ${c.code.padEnd(22)} ${c.currentUses}/${c.maxUses} 사용 (${pct}%, 잔여 ${remaining}개) — ${c.name}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
