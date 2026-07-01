const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async()=>{
  const t = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('=== public 스키마 테이블 목록 ===');
  t.forEach(x=>console.log(' ', x.table_name));
  await prisma.$disconnect();
})();
