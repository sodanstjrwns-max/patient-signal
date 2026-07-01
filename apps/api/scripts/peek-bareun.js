const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const h = await prisma.hospital.findFirst({ where: { name: { contains: '바른얼굴' } }, select: { id:true, name:true, nameAliases:true } });
  console.log('병원:', h.name, '| aliases:', JSON.stringify(h.nameAliases));
  const r = await prisma.aIResponse.findFirst({
    where: { hospitalId: h.id, isMentioned: false, responseText: { contains: '바른얼굴' } },
    select: { responseText: true, aiPlatform: true, responseDate: true },
  });
  if (!r) { console.log('샘플 없음'); return prisma.$disconnect(); }
  console.log('플랫폼:', r.aiPlatform, '| 날짜:', r.responseDate.toISOString().slice(0,10));
  const idx = r.responseText.indexOf('바른얼굴');
  console.log('---응답 발췌---');
  console.log(r.responseText.slice(Math.max(0,idx-60), idx+80));
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
