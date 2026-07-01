const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  console.log('병원 수:', await p.hospital.count());
  console.log('AIResponse 총:', await p.aIResponse.count());
  console.log('  isMentioned=true:', await p.aIResponse.count({where:{isMentioned:true}}));
  // 응답 있는 병원 수
  const hg = await p.aIResponse.groupBy({by:['hospitalId'], _count:{_all:true}});
  console.log('응답 보유 병원 수:', hg.length);
  await p.$disconnect();
})();
