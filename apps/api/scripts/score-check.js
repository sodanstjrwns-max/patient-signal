const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const q=(s)=>prisma.$queryRawUnsafe(s);
(async()=>{
  const victims = require('./victims.json');
  console.log('=== 피해 4개 병원 점수(daily_scores) 보존 현황 ===');
  for(const v of victims){
    const ds = await q(`SELECT score_date, overall_score, mention_count FROM daily_scores WHERE hospital_id='${v.id}' ORDER BY score_date DESC LIMIT 3`);
    console.log(`\n[${v.name}] 점수 ${v.scoreDays}일치 보존`);
    ds.forEach(r=>console.log(`   ${r.score_date?.toISOString?.().slice(0,10)} | 점수 ${r.overall_score} | 언급 ${r.mention_count}`));
  }
  await prisma.$disconnect();
})();
