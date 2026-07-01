const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
(async()=>{
  // 1) raw SQL로 직접 count (Prisma 필터 우회)
  const raw = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "AIResponse" WHERE "hospitalId" = '${HID}'`
  );
  console.log('1) raw SQL AIResponse count for 으뜸:', JSON.stringify(raw));

  // 2) 혹시 promptId를 통해 연결된 응답이 있나? (hospitalId 없이 promptId로)
  const prompts = await prisma.prompt.findMany({where:{hospitalId:HID},select:{id:true,createdAt:true}});
  const pids = prompts.map(p=>p.id);
  console.log('\n2) 으뜸 프롬프트 IDs:', pids.length, '개');
  for(const pid of pids){
    const c = await prisma.aIResponse.count({where:{promptId:pid}});
    if(c>0) console.log(`   promptId ${pid}: ${c}건 응답`);
  }
  const totalByPrompt = await prisma.aIResponse.count({where:{promptId:{in:pids}}});
  console.log('   프롬프트로 연결된 총 응답:', totalByPrompt);

  // 3) 전체 AIResponse 테이블 행 수 + 가장 오래된/최신 createdAt
  const totalAll = await prisma.aIResponse.count();
  const oldest = await prisma.aIResponse.findFirst({orderBy:{createdAt:'asc'},select:{createdAt:true}});
  const newest = await prisma.aIResponse.findFirst({orderBy:{createdAt:'desc'},select:{createdAt:true}});
  console.log('\n3) 전체 AIResponse:', totalAll, '| 최古', oldest?.createdAt?.toISOString(), '| 최新', newest?.createdAt?.toISOString());

  // 4) 으뜸 응답이 과거에 있었는지 - 삭제로그/감사테이블 존재 확인
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%audit%' OR table_name ILIKE '%log%' OR table_name ILIKE '%history%' OR table_name ILIKE '%delete%')`
  );
  console.log('\n4) 감사/로그/히스토리 테이블:', JSON.stringify(tables));

  // 5) 프롬프트 promptText 중복으로 과거 으뜸 흔적 (지역 키워드로 다른 병원ID 응답 검색)
  const cityResp = await prisma.aIResponse.count({
    where:{ promptId:{in:pids} }
  });
  console.log('\n5) (재확인) 으뜸 프롬프트 연결 응답:', cityResp);
  await prisma.$disconnect();
})();
