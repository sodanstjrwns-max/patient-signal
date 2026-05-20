import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 AIPlatform enum 확장 — GROK + CLOVA_X 추가\n');

  for (const value of ['GROK', 'CLOVA_X']) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "AIPlatform" ADD VALUE '${value}'`);
      console.log(`✅ 추가됨: ${value}`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`⏭️  이미 존재: ${value}`);
      } else {
        console.error(`❌ ${value}:`, e.message);
      }
    }
  }

  const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT enumlabel FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AIPlatform') 
    ORDER BY enumsortorder
  `;
  console.log('\n📋 현재 AIPlatform enum 값:');
  rows.forEach((r) => console.log(`   - ${r.enumlabel}`));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
