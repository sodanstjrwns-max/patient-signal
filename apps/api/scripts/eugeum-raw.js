const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
const q = (s)=>prisma.$queryRawUnsafe(s);
(async()=>{
  // ai_responses 컬럼 확인
  const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_responses' ORDER BY ordinal_position`);
  const colNames = cols.map(c=>c.column_name);
  console.log('ai_responses 컬럼:', colNames.join(', '));
  // hospital 관련 컬럼 추정
  const hosCol = colNames.find(c=>/hospital/i.test(c)) || 'hospitalId';
  console.log('→ hospital 컬럼:', hosCol);

  // 1) 으뜸 응답 직접 카운트
  const c1 = await q(`SELECT COUNT(*)::int c FROM ai_responses WHERE "${hosCol}" = '${HID}'`);
  console.log('\n1) ai_responses 으뜸 응답수:', c1[0].c);

  // 2) 다른 주요 테이블에 으뜸 데이터 있나
  for(const tbl of ['daily_scores','citation_analyses','crawl_jobs','competitor_scores','reports']){
    try{
      const tc = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='${tbl}' AND column_name ILIKE '%hospital%'`);
      if(tc.length){
        const hc=tc[0].column_name;
        const cc = await q(`SELECT COUNT(*)::int c FROM ${tbl} WHERE "${hc}" = '${HID}'`);
        console.log(`   ${tbl}: ${cc[0].c}건`);
      } else console.log(`   ${tbl}: (hospital 컬럼 없음)`);
    }catch(e){ console.log(`   ${tbl}: 오류 ${e.message.slice(0,50)}`); }
  }

  // 3) ai_responses 전체 행수 + 으뜸 createdAt 범위(혹시 있으면)
  const total = await q(`SELECT COUNT(*)::int c FROM ai_responses`);
  console.log('\n3) ai_responses 전체:', total[0].c);

  // 4) 과거 으뜸 데이터 흔적: response_text/citation에 으뜸 들어간 행 (다른 병원ID라도)
  const textCol = colNames.find(c=>/response.*text|text|content|answer/i.test(c));
  if(textCol){
    const c4 = await q(`SELECT COUNT(*)::int c FROM ai_responses WHERE "${textCol}" ILIKE '%으뜸%'`);
    console.log(`4) 응답 본문(${textCol})에 '으뜸' 포함된 행:`, c4[0].c);
  }
  await prisma.$disconnect();
})();
