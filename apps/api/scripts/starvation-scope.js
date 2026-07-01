const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 전체 활성 병원의 마지막 크롤 분포 — 진짜 몇 곳이 멈췄나
  const hospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE','TRIAL'] } },
    select: { id:true, name:true, planType:true, subscriptionStatus:true },
  });
  const rows = await prisma.crawlJob.groupBy({ by:['hospitalId'], _max:{ startedAt:true } });
  const m = new Map(); rows.forEach(r=>m.set(r.hospitalId, r._max.startedAt));
  const now = Date.now();
  const bucket = { '오늘~1일':0, '2~3일':0, '4~7일':0, '8~14일':0, '15일+':0, '한번도없음':0 };
  const stalled = [];
  for (const h of hospitals) {
    const last = m.get(h.id);
    if (!last) { bucket['한번도없음']++; continue; }
    const days = (now - last.getTime())/(24*3600*1000);
    if (days<=1) bucket['오늘~1일']++;
    else if (days<=3) bucket['2~3일']++;
    else if (days<=7) bucket['4~7일']++;
    else if (days<=14) bucket['8~14일']++;
    else { bucket['15일+']++; stalled.push({name:h.name, plan:h.planType, sub:h.subscriptionStatus, last:last.toISOString().slice(0,10), days:Math.floor(days)}); }
  }
  console.log('=== 활성 병원 마지막 크롤 분포 (총 '+hospitals.length+'곳) ===');
  Object.entries(bucket).forEach(([k,v])=>console.log(`  ${k.padEnd(10)} : ${v}곳`));
  console.log('\n=== 🔴 15일+ 방치된 병원 (전부) ===');
  stalled.sort((a,b)=>b.days-a.days).forEach(s=>console.log(`  ${s.name.padEnd(22)} ${s.plan}/${s.sub} | 마지막 ${s.last} (${s.days}일 전)`));
  console.log(`\n총 ${stalled.length}곳이 15일 이상 방치됨`);
  await prisma.$disconnect();
})();
