import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
  const today = new Date(now.getTime() - 1 * oneDay);
  const threeDaysAgo = new Date(now.getTime() - 3 * oneDay);
  const sevenDaysAgo = new Date(now.getTime() - 7 * oneDay);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * oneDay);

  const [
    totalUsers,
    totalHospitals,
    last1Hour,
    last24Hours,
    last3Days,
    last7Days,
    last30Days,
    recentUsers,
    recentRedemptions,
    starterFreeCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.hospital.count(),
    prisma.user.count({ where: { createdAt: { gte: oneHourAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: threeDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { email: true, createdAt: true, hospitalId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.couponRedemption.findMany({
      where: { redeemedAt: { gte: sevenDaysAgo } },
      orderBy: { redeemedAt: 'desc' },
    }),
    prisma.coupon.findUnique({ where: { code: 'PF2026-STARTER-FREE' }, select: { currentUses: true } }),
  ]);

  // 병원 정보 매핑
  const hospitalIds = [...new Set(recentUsers.map(u => u.hospitalId).filter(Boolean))] as string[];
  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: hospitalIds } },
    select: { id: true, name: true },
  });
  const hMap = new Map(hospitals.map(h => [h.id, h.name]));

  console.log('\n========== 📊 가입자 추세 (실시간) ==========');
  console.log(`👤 총 가입자: ${totalUsers}명`);
  console.log(`🏥 총 병원: ${totalHospitals}개`);
  console.log(`🎟️  PF2026-STARTER-FREE 누적 사용: ${starterFreeCount?.currentUses}회`);

  console.log('\n========== 🆕 최근 가입 추세 ==========');
  console.log(`⚡ 최근 1시간    : ${last1Hour}명`);
  console.log(`📅 최근 24시간   : ${last24Hours}명`);
  console.log(`📅 최근 3일      : ${last3Days}명`);
  console.log(`📅 최근 7일      : ${last7Days}명`);
  console.log(`📅 최근 30일     : ${last30Days}명`);

  if (recentUsers.length > 0) {
    console.log('\n========== 📋 최근 7일 신규 가입자 ==========');
    recentUsers.forEach((u, i) => {
      const date = u.createdAt.toISOString().replace('T', ' ').substring(0, 16);
      const hName = u.hospitalId ? (hMap.get(u.hospitalId) || '?') : '(병원 없음)';
      console.log(`  ${(i + 1).toString().padStart(2)}. ${date} | ${hName.padEnd(30)} | ${u.email}`);
    });
  } else {
    console.log('\n📭 최근 7일 신규 가입 없음');
  }

  if (recentRedemptions.length > 0) {
    console.log('\n========== 🎟️ 최근 7일 쿠폰 사용 ==========');
    const userIds = [...new Set(recentRedemptions.map(r => r.userId))];
    const couponIds = [...new Set(recentRedemptions.map(r => r.couponId))];
    const [users, coupons] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
      prisma.coupon.findMany({ where: { id: { in: couponIds } }, select: { id: true, code: true } }),
    ]);
    const uMap = new Map(users.map(u => [u.id, u.email]));
    const cMap = new Map(coupons.map(c => [c.id, c.code]));

    recentRedemptions.forEach((r, i) => {
      const date = r.redeemedAt.toISOString().replace('T', ' ').substring(0, 16);
      console.log(`  ${(i + 1).toString().padStart(2)}. ${date} | ${cMap.get(r.couponId)} | ${uMap.get(r.userId)}`);
    });
  } else {
    console.log('\n📭 최근 7일 쿠폰 사용 없음');
  }

  // 비교: 이전 1주일 vs 최근 1주일
  const previous7Days = await prisma.user.count({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - 14 * oneDay),
        lt: sevenDaysAgo,
      },
    },
  });

  console.log('\n========== 📈 주간 비교 ==========');
  console.log(`이전 주 (7~14일 전): ${previous7Days}명`);
  console.log(`최근 주 (0~7일 전) : ${last7Days}명`);
  if (previous7Days > 0) {
    const change = ((last7Days - previous7Days) / previous7Days * 100).toFixed(1);
    const arrow = last7Days > previous7Days ? '📈' : last7Days < previous7Days ? '📉' : '➡️';
    console.log(`${arrow} 증감: ${change}%`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
