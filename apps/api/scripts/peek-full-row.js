const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.aIResponse.findFirst({
    where: { isMentioned: true, responseText: { not: '' } },
    include: { prompt: { select: { promptText: true, intent: true } }, hospital: { select: { name: true } } },
  });
  console.log('=== 한 건의 전체 필드 ===');
  console.log(Object.keys(r).join(', '));
  console.log('\n=== 값 미리보기 ===');
  console.log('hospital:', r.hospital?.name);
  console.log('promptText:', r.prompt?.promptText);
  console.log('aiPlatform:', r.aiPlatform, '| model:', r.aiModel);
  console.log('responseDate:', r.responseDate);
  console.log('isMentioned:', r.isMentioned, '| position:', r.mentionPosition);
  console.log('responseText 길이:', (r.responseText||'').length, '자');
  console.log('responseText 앞 300자:', (r.responseText||'').slice(0,300));
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
