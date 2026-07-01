const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  // 제미나이 응답 중 출처 있는 것 몇 개 샘플
  const rows = await prisma.aIResponse.findMany({
    where: { aiPlatform: 'GEMINI', NOT: { citedUrl: null } },
    select: { citedUrl:true, citedSources:true, sourceHints:true },
    take: 5, orderBy:{ id:'desc' }
  });
  let i=0;
  for (const r of rows){
    i++;
    console.log(`\n===== 샘플 ${i} =====`);
    console.log('citedUrl:', String(r.citedUrl).slice(0,110));
    console.log('citedSources[0]:', (r.citedSources&&r.citedSources[0])? String(r.citedSources[0]).slice(0,110):'(없음)');
    const sh=r.sourceHints;
    if(sh&&sh.sources&&sh.sources.length){
      const s=sh.sources[0];
      console.log('sourceHints.sources[0].url  :', s.url? String(s.url).slice(0,90):'(없음)');
      console.log('sourceHints.sources[0].title:', s.title||'(없음)');
      console.log('sourceHints.sources[0].domain:', s.domain||'(없음)');
    }
  }
  await prisma.$disconnect();
})();
