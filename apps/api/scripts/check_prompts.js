require('dotenv').config({ path: '/home/user/webapp/apps/api/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vd = await prisma.hospital.findFirst({
    where: { name: { contains: '불당본점' } },
    select: { id: true, name: true, specialtyType: true, subSpecialties: true, keyProcedures: true, regionSido: true, regionSigungu: true, regionDong: true, targetRegions: true, coreTreatments: true, nameAliases: true }
  });
  console.log('병원:', JSON.stringify(vd, null, 2));

  const prompts = await prisma.prompt.findMany({
    where: { hospitalId: vd.id },
    select: { promptText: true, promptType: true, isActive: true, specialtyCategory: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('\n총 프롬프트:', prompts.length, '| 활성:', prompts.filter(p=>p.isActive).length);
  const byType = {};
  prompts.forEach(p => { byType[p.promptType] = (byType[p.promptType]||0)+1; });
  console.log('타입별:', JSON.stringify(byType));
  console.log('\n=== 활성 프롬프트 전체 목록 ===');
  prompts.filter(p=>p.isActive).forEach((p,i)=>console.log(`${i+1}. [${p.promptType}|${p.specialtyCategory||'-'}] ${p.promptText}`));
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e.message);process.exit(1);});
