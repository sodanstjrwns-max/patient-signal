const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const h = await prisma.hospital.findFirst({ where: { name: { contains: '정원' } } });
  console.log('정원한의원:', h.name, h.id);
  const todayKST = new Date(); todayKST.setUTCHours(0, 0, 0, 0);
  const scoredToday = await prisma.dailyScore.findFirst({
    where: { hospitalId: h.id, scoreDate: { gte: todayKST } },
  });
  console.log('오늘 점수 났나?', scoredToday ? `예 (sov=${scoredToday.sovPercent}%)` : '아니오');
  const lastCrawl = await prisma.crawlJob.findFirst({
    where: { hospitalId: h.id }, orderBy: { startedAt: 'desc' },
  });
  console.log('마지막 크롤:', lastCrawl ? lastCrawl.startedAt : '없음');
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
