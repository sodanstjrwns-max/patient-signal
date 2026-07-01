const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  // 1) '으뜸' 들어간 병원 찾기
  const hs = await prisma.hospital.findMany({
    where: { OR:[{name:{contains:'으뜸'}},{nameAliases:{has:'으뜸'}}] },
    select:{id:true,name:true,subscriptionStatus:true,websiteUrl:true,createdAt:true},
  });
  console.log('=== 으뜸 매칭 병원 ===');
  for(const h of hs) console.log(JSON.stringify(h));
  // 광범위하게 '서울' 들어간 것 중 으뜸 비슷한 것도
  const hs2 = await prisma.hospital.findMany({
    where: { name:{contains:'서울'} },
    select:{id:true,name:true},
  });
  console.log('\n=== 서울 들어간 병원(참고) ===', hs2.length,'개');
  await prisma.$disconnect();
})();
