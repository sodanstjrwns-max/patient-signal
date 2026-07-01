// 플랫폼별 × 월별 '출처 제공률' 추이
//  - 출처 보유 정의: citedUrl 있거나, citedSources 1+ , 또는 sourceHints.sources 1+
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function hasSource(r){
  if (r.citedUrl) return true;
  if ((r.citedSources||[]).length>0) return true;
  const sh=r.sourceHints;
  if (sh && typeof sh==='object' && (sh.sources||[]).length>0) return true;
  return false;
}
function monthKey(d){ if(!d) return 'NA'; const t=new Date(d); return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}`; }
const inc=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};

(async()=>{
  const BATCH=2000; let cursor=null, processed=0;
  // platform -> month -> {total, withSrc}
  const agg={};
  while(true){
    const rows=await prisma.aIResponse.findMany({
      select:{id:true,aiPlatform:true,responseDate:true,citedUrl:true,citedSources:true,sourceHints:true},
      orderBy:{id:'asc'},take:BATCH,
      ...(cursor?{cursor:{id:cursor},skip:1}:{}),
    });
    if(rows.length===0)break;
    cursor=rows[rows.length-1].id;
    for(const r of rows){
      const p=r.aiPlatform||'UNKNOWN';
      const m=monthKey(r.responseDate);
      agg[p]=agg[p]||{};
      agg[p][m]=agg[p][m]||{total:0,withSrc:0};
      agg[p][m].total++;
      if(hasSource(r)) agg[p][m].withSrc++;
    }
    processed+=rows.length;
    if(processed%20000===0)console.error('processed',processed);
  }
  const out={generatedAt:new Date().toISOString(),processed,table:{}};
  for(const [p,months] of Object.entries(agg)){
    out.table[p]={};
    for(const [m,v] of Object.entries(months)){
      out.table[p][m]={total:v.total,withSrc:v.withSrc,rate:v.total?+(v.withSrc/v.total*100).toFixed(1):0};
    }
  }
  fs.writeFileSync(__dirname+'/platform-source-trend.json',JSON.stringify(out,null,2));
  console.error('DONE',processed);
  await prisma.$disconnect();
})();
