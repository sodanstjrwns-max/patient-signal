const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  // 1) 모든 병원 + 응답수 (으뜸 관련 ID 찾기 위해 전체 hospitalId distinct)
  const hospitals = await prisma.hospital.findMany({select:{id:true,name:true}});
  const hMap={}; hospitals.forEach(h=>hMap[h.id]=h.name);

  // 2) 응답 테이블에서 hospitalId별 카운트 — 으뜸 이름 가진 ID 전부 확인
  const grp = await prisma.aIResponse.groupBy({
    by:['hospitalId'], _count:{_all:true},
  });
  console.log('=== 응답 보유 병원 수:', grp.length);
  // 으뜸/수원 관련 병원 매칭
  const eu = grp.filter(g=>{ const n=hMap[g.hospitalId]||''; return n.includes('으뜸')||n.includes('수원'); });
  console.log('\n=== 으뜸/수원 관련 응답보유 병원 ===');
  eu.forEach(g=>console.log(`  ${hMap[g.hospitalId]} (${g.hospitalId}): ${g._count._all}건`));

  // 3) orphan: 응답이 있는데 hospital 마스터에 없는 ID
  const orphan = grp.filter(g=>!hMap[g.hospitalId]);
  console.log('\n=== orphan hospitalId (마스터에 없음):', orphan.length);
  orphan.slice(0,10).forEach(g=>console.log(`  ${g.hospitalId}: ${g._count._all}건`));

  // 4) 으뜸 이름 가진 hospital이 또 있나 (별칭 포함 재확인)
  const dupName = hospitals.filter(h=>h.name.includes('으뜸'));
  console.log('\n=== 이름에 으뜸 들어간 모든 hospital ===');
  dupName.forEach(h=>console.log(`  ${h.name} : ${h.id}`));
  await prisma.$disconnect();
})();
