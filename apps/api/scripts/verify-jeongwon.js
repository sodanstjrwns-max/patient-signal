const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const h = await p.hospital.findFirst({where:{name:{contains:'정원'}}});
  // 대시보드 Hero가 읽는 경로: getLatestScore = 최신 DailyScore
  const latest = await p.dailyScore.findFirst({where:{hospitalId:h.id}, orderBy:{scoreDate:'desc'}});
  console.log('=== ✅ 대시보드 Hero가 읽을 값 (최신 DailyScore) ===');
  console.log(`  날짜: ${latest.scoreDate.toISOString().slice(0,10)}`);
  console.log(`  >>> Voice Share(SoV): ${latest.sovPercent}%   (이전: 0%)`);
  console.log(`  >>> 언급 수: ${latest.mentionCount}`);

  // AIResponse 실집계 (abhs.service 실시간 계산 경로)
  const total = await p.aIResponse.count({where:{hospitalId:h.id}});
  const ment = await p.aIResponse.count({where:{hospitalId:h.id, isMentioned:true}});
  console.log(`\n=== ✅ AIResponse 실집계 (abhs 실시간 경로) ===`);
  console.log(`  전체 ${total}건 중 언급 ${ment}건 → SoV ${(ment/total*100).toFixed(1)}%`);

  // 플랫폼별
  console.log(`\n=== 플랫폼별 ===`);
  for(const pf of ['CHATGPT','PERPLEXITY','CLAUDE','GEMINI']){
    const t=await p.aIResponse.count({where:{hospitalId:h.id,aiPlatform:pf}});
    const m=await p.aIResponse.count({where:{hospitalId:h.id,aiPlatform:pf,isMentioned:true}});
    console.log(`  ${pf}: ${m}/${t} → ${(m/t*100).toFixed(0)}%`);
  }
  // 순위 분포
  const ranked = await p.aIResponse.findMany({where:{hospitalId:h.id,isMentioned:true,mentionPosition:{not:null}}, select:{mentionPosition:true}});
  const posCount={};
  ranked.forEach(r=>posCount[r.mentionPosition]=(posCount[r.mentionPosition]||0)+1);
  console.log(`\n=== 노출 순위 분포 (언급된 건 중 순위 잡힌 것) ===`);
  Object.entries(posCount).sort((a,b)=>a[0]-b[0]).forEach(([k,v])=>console.log(`  ${k}위: ${v}건`));
  await p.$disconnect();
})();
