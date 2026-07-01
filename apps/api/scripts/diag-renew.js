const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  // 병원/유저 찾기
  const hs = await p.hospital.findMany({where:{OR:[{name:{contains:'리뉴'}},{name:{contains:'앤영'}}]}});
  console.log('=== 병원 후보 ===');
  for(const h of hs){
    console.log(`- ${h.name} | id=${h.id} | plan=${h.planType} | subStatus=${h.subscriptionStatus} | created=${h.createdAt.toISOString().slice(0,10)}`);
    const users = await p.user.findMany({where:{hospitalId:h.id}, select:{id:true, email:true, name:true, role:true}});
    users.forEach(u=>console.log(`    user: ${u.name} <${u.email}> [${u.role}] id=${u.id}`));
    // 구독
    const sub = await p.subscription.findFirst({where:{hospitalId:h.id}});
    console.log(`    subscription:`, sub?`plan=${sub.planType} status=${sub.status} end=${sub.currentPeriodEnd?.toISOString().slice(0,10)}`:'없음');
    // 쿠폰 사용이력
    const red = await p.couponRedemption.findMany({where:{hospitalId:h.id}, include:{coupon:true}});
    console.log(`    쿠폰 사용이력: ${red.length}건`);
    red.forEach(r=>console.log(`      - ${r.coupon.code} (${r.coupon.name}) @ ${r.createdAt.toISOString().slice(0,10)}`));
  }
  // 이우석 유저로도 검색
  const byName = await p.user.findMany({where:{OR:[{name:{contains:'이우석'}}]}, select:{id:true,email:true,name:true,hospitalId:true}});
  console.log('\n=== 이름 "이우석" 유저 ===');
  byName.forEach(u=>console.log(`  ${u.name} <${u.email}> hospitalId=${u.hospitalId}`));

  // 사용 가능한 쿠폰 목록
  console.log('\n=== 활성 쿠폰 목록 ===');
  const coupons = await p.coupon.findMany({where:{isActive:true}});
  coupons.forEach(c=>console.log(`  ${c.code} | ${c.name} | type=${c.couponType} | freeMonths=${c.freeMonths} %=${c.discountPercent} | plans=${c.applicablePlans} | uses=${c.currentUses}/${c.maxUses}`));
  await p.$disconnect();
})();
