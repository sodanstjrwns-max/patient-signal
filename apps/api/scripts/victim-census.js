const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const q=(s)=>prisma.$queryRawUnsafe(s);
(async()=>{
  // 모든 병원 + ai_responses 카운트 + daily_scores 카운트 + crawl_jobs 마지막 상태
  const hospitals = await q(`SELECT id, name, subscription_status, plan_type FROM hospitals`);
  console.log('총 병원:', hospitals.length);

  const respByHos = await q(`SELECT hospital_id, COUNT(*)::int c FROM ai_responses GROUP BY hospital_id`);
  const rmap={}; respByHos.forEach(r=>rmap[r.hospital_id]=r.c);

  const dsByHos = await q(`SELECT hospital_id, COUNT(*)::int c, MIN(score_date) mn, MAX(score_date) mx FROM daily_scores GROUP BY hospital_id`);
  const dmap={}; dsByHos.forEach(r=>dmap[r.hospital_id]={c:r.c,mn:r.mn,mx:r.mx});

  // 피해 병원: daily_scores는 있는데 ai_responses는 0(또는 없음)
  const victims=[];
  for(const h of hospitals){
    const resp = rmap[h.id]||0;
    const ds = dmap[h.id];
    if(ds && ds.c>0 && resp===0){
      victims.push({name:h.name,id:h.id,status:h.subscription_status,plan:h.plan_type,scoreDays:ds.c,from:ds.mn,to:ds.mx});
    }
  }
  console.log('\n=== 🔴 피해 병원 (점수 O / 응답 0) ===', victims.length,'개');
  victims.sort((a,b)=>b.scoreDays-a.scoreDays);
  for(const v of victims){
    const to = v.to?.toISOString?.().slice(0,10)||v.to;
    const from = v.from?.toISOString?.().slice(0,10)||v.from;
    console.log(`  ${v.name} | ${v.status}/${v.plan} | 점수 ${v.scoreDays}일치 (${from}~${to}) | 응답 0`);
  }

  // 정상 병원 요약
  const normal = hospitals.filter(h=>(rmap[h.id]||0)>0).length;
  const noData = hospitals.filter(h=>!(rmap[h.id]>0) && !(dmap[h.id]?.c>0)).length;
  console.log(`\n정상(응답 있음): ${normal}개 | 데이터 전혀없음: ${noData}개 | 피해: ${victims.length}개`);
  require('fs').writeFileSync(__dirname+'/victims.json',JSON.stringify(victims,null,2));
  await prisma.$disconnect();
})();
