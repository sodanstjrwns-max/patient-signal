const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
(async()=>{
  // 1) 으뜸 관련 모든 연관 테이블 카운트
  const prompts = await prisma.prompt.count({where:{hospitalId:HID}});
  const promptsByType = await prisma.prompt.groupBy({by:['promptType'],where:{hospitalId:HID},_count:{_all:true}});
  const resp = await prisma.aIResponse.count({where:{hospitalId:HID}});
  console.log('=== 으뜸치과 연관 데이터 현황 ===');
  console.log('prompt 총:', prompts);
  console.log('promptType별:', JSON.stringify(promptsByType));
  console.log('aIResponse:', resp);

  // 2) 프롬프트 최근 생성/수정 시각
  const recentP = await prisma.prompt.findMany({
    where:{hospitalId:HID}, select:{id:true,promptType:true,createdAt:true,promptText:true},
    orderBy:{createdAt:'desc'}, take:5,
  });
  console.log('\n=== 최근 프롬프트 5개 ===');
  recentP.forEach(p=>console.log(`  [${p.promptType}] ${p.createdAt.toISOString()} : ${String(p.promptText||'').slice(0,40)}`));

  // 3) 전체 응답 중 createdAt이 06-18~06-20 사이인 것의 hospitalId 분포 (크롤 정상 작동 확인)
  const recent = await prisma.aIResponse.groupBy({
    by:['hospitalId'], _count:{_all:true},
    where:{ createdAt:{ gte:new Date('2026-06-18T00:00:00Z') } },
  });
  console.log('\n=== 06/18 이후 응답 생성된 병원 수:', recent.length);
  console.log('총 신규 응답:', recent.reduce((s,r)=>s+r._count._all,0));

  // 4) 같은 STARTER 플랜 병원들은 응답 있나 (비교)
  const starters = await prisma.hospital.findMany({where:{planType:'STARTER'},select:{id:true,name:true}});
  console.log('\n=== STARTER 플랜 병원들의 응답수 ===');
  for(const s of starters.slice(0,10)){
    const c=await prisma.aIResponse.count({where:{hospitalId:s.id}});
    console.log(`  ${s.name}: ${c}건`);
  }
  await prisma.$disconnect();
})();
