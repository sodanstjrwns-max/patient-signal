const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const eugeum = 'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
  // 스케줄러 findMany 그대로 재현
  const hospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE','TRIAL'] } },
    include: { prompts: { where: { isActive: true } } },
  });
  console.log('스케줄러 대상 병원 수:', hospitals.length);
  const e = hospitals.find(h => h.id === eugeum);
  console.log('으뜸 포함?', !!e, e ? `| active프롬프트 ${e.prompts.length}` : '');

  // 으뜸 raw subscriptionStatus 확인
  const raw = await prisma.$queryRawUnsafe(`SELECT subscription_status, plan_type FROM hospitals WHERE id=$1`, eugeum);
  console.log('으뜸 raw:', JSON.stringify(raw[0]));

  // 정렬 후 으뜸 순위 (least-recently-crawled)
  const lastCrawlRows = await prisma.crawlJob.groupBy({ by:['hospitalId'], _max:{ startedAt:true } });
  const m = new Map(); lastCrawlRows.forEach(r=>m.set(r.hospitalId, r._max.startedAt?r._max.startedAt.getTime():0));
  const todayKST = new Date(); todayKST.setUTCHours(0,0,0,0);
  const scored = await prisma.dailyScore.findMany({ where:{scoreDate:{gte:todayKST}}, select:{hospitalId:true} });
  const scoredSet = new Set(scored.map(s=>s.hospitalId));
  hospitals.sort((a,b)=>{
    const ad=scoredSet.has(a.id)?1:0, bd=scoredSet.has(b.id)?1:0;
    if(ad!==bd) return ad-bd;
    const al=m.get(a.id)??0, bl=m.get(b.id)??0;
    if(al!==bl) return al-bl;
    return a.createdAt.getTime()-b.createdAt.getTime();
  });
  const rank = hospitals.findIndex(h=>h.id===eugeum);
  console.log(`\n으뜸 정렬 순위: ${rank+1} / ${hospitals.length} (1=최우선)`);
  console.log('상위 10개 병원:');
  hospitals.slice(0,10).forEach((h,i)=>console.log(`  ${i+1}. ${h.name} | lastCrawl=${m.get(h.id)?new Date(m.get(h.id)).toISOString().slice(0,10):'never'} | prompts=${h.prompts.length}`));
  await prisma.$disconnect();
})();
