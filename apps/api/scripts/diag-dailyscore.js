const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const h = await p.hospital.findFirst({where:{name:{contains:'정원'}}});
  const ds = await p.dailyScore.findMany({where:{hospitalId:h.id}, orderBy:{scoreDate:'desc'}, take:10,
    select:{scoreDate:true, sovPercent:true, mentionCount:true, overallScore:true, abhsScore:true, positiveRatio:true}});
  console.log('=== DailyScore (정원한의원) ===');
  ds.forEach(d=>console.log(`  ${d.scoreDate.toISOString().slice(0,10)} | sov=${d.sovPercent} | mentionCount=${d.mentionCount} | overall=${d.overallScore} | abhs=${d.abhsScore}`));
  console.log(`총 DailyScore row: ${await p.dailyScore.count({where:{hospitalId:h.id}})}`);
  // 응답 날짜 분포
  const dates = await p.$queryRaw`SELECT response_date::date as d, count(*)::int as n, sum(case when is_mentioned then 1 else 0 end)::int as m FROM ai_responses WHERE hospital_id=${h.id} GROUP BY 1 ORDER BY 1`;
  console.log('\n=== 응답 날짜별 분포 ===');
  dates.forEach(r=>console.log(`  ${r.d.toISOString().slice(0,10)}: 총 ${r.n}건, DB언급 ${r.m}건`));
  await p.$disconnect();
})();
