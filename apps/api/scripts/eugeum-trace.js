const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
(async()=>{
  // 1) 으뜸치과 hospital 전체 필드 덤프
  const h = await prisma.hospital.findUnique({where:{id:HID}});
  console.log('=== 으뜸치과 hospital 레코드 전체 ===');
  console.log(JSON.stringify(h,null,2));

  // 2) websiteUrl/도메인으로 다른 hospital 중복 있나
  const dups = await prisma.hospital.findMany({
    where:{ websiteUrl:{contains:'eutteum'} },
    select:{id:true,name:true,subscriptionStatus:true,createdAt:true}
  });
  console.log('\n=== eutteum 도메인 가진 병원들 ===');
  dups.forEach(d=>console.log(JSON.stringify(d)));

  // 3) 으뜸 텍스트가 응답 본문/키워드에 있는데 hospitalId가 다른 경우?
  //    keyword에 으뜸/eutteum 들어간 응답 카운트
  const kwCount = await prisma.aIResponse.count({
    where:{ OR:[
      {citedUrl:{contains:'eutteum'}},
      {citedSources:{has:'eutteum'}},
    ]}
  });
  console.log('\n=== eutteum URL 인용된 응답수(다른 병원ID 포함) ===', kwCount);
  await prisma.$disconnect();
})();
