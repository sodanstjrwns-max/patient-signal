const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const h = await p.hospital.findFirst({where:{name:'리뉴앤영의원'}});
  const sub = await p.subscription.findFirst({where:{hospitalId:h.id}});
  const red = await p.couponRedemption.findMany({where:{hospitalId:h.id}, include:{coupon:true}});
  const c = await p.coupon.findUnique({where:{code:'PF2026-STARTER-FREE'}});
  console.log('=== ✅ 최종 상태 (리뉴앤영의원 / 이우석) ===');
  console.log(`  병원 plan: ${h.planType} | status: ${h.subscriptionStatus}`);
  console.log(`  구독: ${sub.planType} / ${sub.status} / ${sub.currentPeriodStart.toISOString().slice(0,10)} ~ ${sub.currentPeriodEnd.toISOString().slice(0,10)}`);
  console.log(`  쿠폰 사용이력: ${red.length}건`);
  red.forEach(r=>console.log(`    - ${r.coupon.code} | ${r.freeMonths}개월 무료 | ${r.createdAt.toISOString().slice(0,10)}`));
  console.log(`  쿠폰 누적사용: ${c.currentUses}`);
  await p.$disconnect();
})();
