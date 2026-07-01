const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  for (const name of ['정원', '바른얼굴']) {
    const h = await prisma.hospital.findFirst({ where: { name: { contains: name } }, select: { id:true, name:true } });
    const latest = await prisma.dailyScore.findFirst({ where: { hospitalId: h.id }, orderBy: { scoreDate: 'desc' } });
    console.log(`[${h.name}] 최신 SoV: ${latest ? latest.sovPercent.toFixed(1)+'% (mentionCount='+latest.mentionCount+', '+latest.scoreDate.toISOString().slice(0,10)+')' : '점수없음'}`);
  }
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
