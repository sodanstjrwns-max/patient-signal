const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
function dayKey(d){const t=new Date(d);return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')}`;}
(async()=>{
  const total = await prisma.aIResponse.count({where:{hospitalId:HID}});
  const mentioned = await prisma.aIResponse.count({where:{hospitalId:HID,isMentioned:true}});
  console.log('=== 서울으뜸치과 전체 ===');
  console.log('총 응답:', total, '| 언급:', mentioned, '| 언급률:', total?(mentioned/total*100).toFixed(1)+'%':'-');

  // 일자별 집계
  const rows = await prisma.aIResponse.findMany({
    where:{hospitalId:HID},
    select:{responseDate:true,isMentioned:true,aiPlatform:true,createdAt:true},
    orderBy:{responseDate:'asc'},
  });
  const byDay={}, byPlat={};
  let minDate=null,maxDate=null,minCreate=null,maxCreate=null;
  for(const r of rows){
    const d=dayKey(r.responseDate);
    byDay[d]=byDay[d]||{t:0,m:0};
    byDay[d].t++; if(r.isMentioned)byDay[d].m++;
    byPlat[r.aiPlatform]=(byPlat[r.aiPlatform]||0)+1;
    if(!minDate||r.responseDate<minDate)minDate=r.responseDate;
    if(!maxDate||r.responseDate>maxDate)maxDate=r.responseDate;
    if(!minCreate||r.createdAt<minCreate)minCreate=r.createdAt;
    if(!maxCreate||r.createdAt>maxCreate)maxCreate=r.createdAt;
  }
  console.log('\nresponseDate 범위:', dayKey(minDate),'~',dayKey(maxDate));
  console.log('createdAt 범위 :', minCreate?.toISOString(),'~',maxCreate?.toISOString());
  console.log('\n=== 플랫폼별 응답수 ===', JSON.stringify(byPlat));
  console.log('\n=== 최근 14일 일자별 (응답/언급) ===');
  const days=Object.keys(byDay).sort();
  for(const d of days.slice(-20)) console.log(`  ${d}: ${byDay[d].t}건 / 언급 ${byDay[d].m}`);
  await prisma.$disconnect();
})();
