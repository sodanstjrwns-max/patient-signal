// 리뉴앤영의원 - PF2026-STARTER-FREE 쿠폰 적용 (서비스 applyCoupon 로직 동일 재현)
// 사용법: node scripts/apply-coupon-renew.js [--apply]
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const PLAN_PRICES = { FREE:0, STARTER:120000, STANDARD:290000, PRO:590000, ENTERPRISE:0 };
const CODE = 'PF2026-STARTER-FREE';
const PLAN = 'STARTER';

async function main(){
  const h = await prisma.hospital.findFirst({ where:{ name:'리뉴앤영의원' } });
  const owner = await prisma.user.findFirst({ where:{ hospitalId:h.id, role:'OWNER' } });
  const coupon = await prisma.coupon.findUnique({ where:{ code:CODE } });

  console.log(`[${APPLY?'🔴 APPLY':'🟡 DRY-RUN'}] 쿠폰 적용`);
  console.log(`  병원: ${h.name} (${h.id}) / 현재 plan=${h.planType} status=${h.subscriptionStatus}`);
  console.log(`  유저: ${owner.name} <${owner.email}>`);
  console.log(`  쿠폰: ${coupon.code} (${coupon.name}) freeMonths=${coupon.freeMonths} plans=${coupon.applicablePlans}`);

  // ── 검증 (validateCoupon 동일) ──
  const now = new Date();
  if(!coupon.isActive) throw new Error('사용 중지된 쿠폰');
  if(coupon.startsAt > now) throw new Error('아직 사용 기간 아님');
  if(coupon.expiresAt && coupon.expiresAt < now) throw new Error('만료된 쿠폰');
  if(coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) throw new Error('소진됨');
  const prior = await prisma.couponRedemption.count({ where:{ couponId:coupon.id, hospitalId:h.id } });
  if(prior >= coupon.maxUsesPerUser) throw new Error('이미 이 쿠폰 사용함');
  if(coupon.applicablePlans.length>0 && !coupon.applicablePlans.includes(PLAN)) throw new Error(`${PLAN} 플랜 미적용 대상`);

  const freeMonths = coupon.freeMonths || 0;
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (freeMonths>0?freeMonths:1));
  console.log(`\n  ✔ 검증 통과 → STARTER 플랜 ${freeMonths}개월 무료, 만료일 ${periodEnd.toISOString().slice(0,10)}`);

  if(!APPLY){ console.log('\n🟡 DRY-RUN 종료. --apply 로 실제 적용.'); await prisma.$disconnect(); return; }

  const result = await prisma.$transaction(async (tx) => {
    const redemption = await tx.couponRedemption.create({ data:{
      couponId:coupon.id, userId:owner.id, hospitalId:h.id,
      appliedPlan:PLAN, discountAmount: PLAN_PRICES[PLAN]*freeMonths, freeMonths,
    }});
    await tx.coupon.update({ where:{id:coupon.id}, data:{ currentUses:{ increment:1 } } });
    const subscription = await tx.subscription.upsert({
      where:{ hospitalId:h.id },
      create:{ hospitalId:h.id, planType:PLAN, status:'ACTIVE', currentPeriodStart:now, currentPeriodEnd:periodEnd },
      update:{ planType:PLAN, status:'ACTIVE', currentPeriodStart:now, currentPeriodEnd:periodEnd, cancelAtPeriodEnd:false },
    });
    await tx.hospital.update({ where:{id:h.id}, data:{ planType:PLAN, subscriptionStatus:'ACTIVE' } });
    return { redemption, subscription };
  });

  console.log(`\n✅ 적용 완료!`);
  console.log(`   구독: ${result.subscription.planType} / ${result.subscription.status} / 만료 ${result.subscription.currentPeriodEnd.toISOString().slice(0,10)}`);
  await prisma.$disconnect();
}
main().catch(e=>{console.error('❌',e.message);process.exit(1);});
