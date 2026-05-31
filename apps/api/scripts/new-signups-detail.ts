import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  // 최근 30일 전체 가입자
  const recentUsers = await prisma.user.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 30 * oneDay) } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      hospitalId: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 병원 정보
  const hospitalIds = [...new Set(recentUsers.map(u => u.hospitalId).filter(Boolean))] as string[];
  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: hospitalIds } },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      planType: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });
  const hMap = new Map(hospitals.map(h => [h.id, h]));

  // 쿠폰 사용
  const userIds = recentUsers.map(u => u.id);
  const redemptions = await prisma.couponRedemption.findMany({
    where: { userId: { in: userIds } },
  });
  const couponIds = [...new Set(redemptions.map(r => r.couponId))];
  const coupons = await prisma.coupon.findMany({
    where: { id: { in: couponIds } },
    select: { id: true, code: true },
  });
  const cMap = new Map(coupons.map(c => [c.id, c.code]));
  const userCoupons = new Map<string, string>();
  redemptions.forEach(r => userCoupons.set(r.userId, cMap.get(r.couponId) || '?'));

  // 일자별 그룹핑
  const byDay: Record<string, typeof recentUsers> = {};
  for (const u of recentUsers) {
    const day = u.createdAt.toISOString().split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(u);
  }

  console.log('\n========== 🆕 최근 30일 신규 가입자 (일자별) ==========\n');
  
  const sortedDays = Object.keys(byDay).sort().reverse();
  for (const day of sortedDays) {
    const users = byDay[day];
    const dayOfWeek = ['일','월','화','수','목','금','토'][new Date(day).getDay()];
    console.log(`\n📅 ${day} (${dayOfWeek}) - ${users.length}명`);
    users.forEach((u, i) => {
      const time = u.createdAt.toISOString().substring(11, 16);
      const h = u.hospitalId ? hMap.get(u.hospitalId) : null;
      const hName = (h?.name || '?').padEnd(28);
      const plan = h?.planType || '?';
      const status = h?.subscriptionStatus || '?';
      const coupon = userCoupons.get(u.id) || '🚫 NO COUPON';
      const lastLogin = u.lastLoginAt 
        ? `최근접속:${u.lastLoginAt.toISOString().substring(5, 16).replace('T', ' ')}` 
        : '❌ 로그인안함';
      
      console.log(`  ${time} | ${hName} | ${plan.padEnd(8)} | ${status.padEnd(7)} | ${coupon.padEnd(22)} | ${lastLogin}`);
      console.log(`         📧 ${u.email}`);
    });
  }

  // 통계 요약
  console.log('\n========== 📊 30일 가입자 요약 ==========');
  console.log(`총 신규 가입자       : ${recentUsers.length}명`);
  console.log(`쿠폰 사용자          : ${redemptions.length}명 (${Math.round(redemptions.length/recentUsers.length*100)}%)`);
  console.log(`쿠폰 미사용자        : ${recentUsers.length - redemptions.length}명`);
  
  const neverLoggedIn = recentUsers.filter(u => !u.lastLoginAt).length;
  console.log(`한 번도 로그인 안함  : ${neverLoggedIn}명`);

  // 도메인 분포 (이메일)
  console.log('\n========== 📧 이메일 도메인 분포 ==========');
  const domainCount: Record<string, number> = {};
  for (const u of recentUsers) {
    const domain = u.email.split('@')[1];
    domainCount[domain] = (domainCount[domain] || 0) + 1;
  }
  const sortedDomains = Object.entries(domainCount).sort(([,a], [,b]) => b - a);
  for (const [domain, count] of sortedDomains) {
    console.log(`  ${domain.padEnd(20)} : ${count}명`);
  }

  // 시간대 분포
  console.log('\n========== ⏰ 가입 시간대 분포 ==========');
  const hourCount: Record<number, number> = {};
  for (const u of recentUsers) {
    const hour = u.createdAt.getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  }
  const sortedHours = Object.entries(hourCount).sort(([,a], [,b]) => b - a).slice(0, 5);
  for (const [hour, count] of sortedHours) {
    console.log(`  ${hour}시 : ${'█'.repeat(count)} (${count}명)`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
