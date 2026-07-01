const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const id = 'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
  const h = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='hospitals' AND column_name LIKE '%subscri%' OR column_name LIKE '%active%' OR column_name LIKE '%status%'`);
  console.log('hospitals 관련 컬럼:', h.map(c=>c.column_name).join(', '));
  const hosp = await prisma.$queryRawUnsafe(`SELECT * FROM hospitals WHERE id=$1`, id);
  const keys = Object.keys(hosp[0]).filter(k=>/subscri|active|status|plan|crawl/i.test(k));
  console.log('\n=== 으뜸 병원 상태 ===');
  keys.forEach(k => console.log(`  ${k} = ${hosp[0][k]}`));

  // 최근 24h 응답 있는 병원들의 prompt_type 분포
  console.log('\n=== 최근24h 크롤된 prompt_type 분포 ===');
  const dist = await prisma.$queryRawUnsafe(
    `SELECT p.prompt_type, count(DISTINCT r.id)::int AS responses
     FROM ai_responses r JOIN prompts p ON p.id = r.prompt_id
     WHERE r.created_at > now() - interval '24 hours'
     GROUP BY p.prompt_type ORDER BY responses DESC`);
  dist.forEach(d => console.log(`  ${(d.prompt_type||'-').padEnd(16)} ${d.responses}건`));

  // CUSTOM 타입 prompt가 최근 크롤된 적이 있나? (스케줄러가 CUSTOM 포함하나)
  console.log('\n=== CUSTOM prompt가 크롤된 적 있나 (전체 기간) ===');
  const customCrawled = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS c, max(r.created_at) AS last
     FROM ai_responses r JOIN prompts p ON p.id=r.prompt_id
     WHERE p.prompt_type='CUSTOM'`);
  console.log(`  CUSTOM 응답 총 ${customCrawled[0].c}건, 마지막 ${customCrawled[0].last?.toISOString() ?? '없음'}`);

  await prisma.$disconnect();
})();
