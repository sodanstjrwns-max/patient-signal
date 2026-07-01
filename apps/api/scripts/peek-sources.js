const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 전체 규모
  const total = await prisma.aIResponse.count();
  const withHints = await prisma.aIResponse.count({ where: { sourceHints: { not: null } } });
  const withCited = await prisma.aIResponse.count({ where: { NOT: { citedSources: { isEmpty: true } } } });
  console.log(`총 응답: ${total} / sourceHints 있음: ${withHints} / citedSources 있음: ${withCited}\n`);

  // sourceHints 샘플 3개 구조 확인
  const samples = await prisma.aIResponse.findMany({
    where: { sourceHints: { not: null } },
    select: { aiPlatform: true, citedSources: true, citedUrl: true, sourceHints: true },
    take: 3,
  });
  samples.forEach((s, i) => {
    console.log(`--- 샘플 ${i+1} [${s.aiPlatform}] ---`);
    console.log('citedUrl:', s.citedUrl);
    console.log('citedSources:', JSON.stringify(s.citedSources).slice(0, 200));
    console.log('sourceHints:', JSON.stringify(s.sourceHints).slice(0, 500));
    console.log();
  });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
