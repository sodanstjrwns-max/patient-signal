import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const grouped = await prisma.aIResponse.groupBy({
    by: ['hospitalId'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { hospitalId: 'desc' } },
    take: 5,
  });
  for (const g of grouped) {
    const h = await prisma.hospital.findUnique({ where: { id: g.hospitalId }, select: { name: true } });
    console.log(`${g._count._all.toString().padStart(5)} | ${g.hospitalId} | ${h?.name}`);
  }
  await prisma.$disconnect();
}
main();
