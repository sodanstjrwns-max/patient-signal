const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 오늘(KST) 크롤된 병원 수 vs 전체
  const total = await prisma.hospital.count({ where:{ subscriptionStatus:{in:['ACTIVE','TRIAL']} }});
  const todayKST = new Date(); todayKST.setUTCHours(0,0,0,0);
  const jobs = await prisma.$queryRawUnsafe(
    `SELECT count(DISTINCT hospital_id)::int c FROM crawl_jobs WHERE started_at >= $1 AND status='COMPLETED'`, todayKST);
  const resp = await prisma.$queryRawUnsafe(
    `SELECT count(DISTINCT hospital_id)::int c FROM ai_responses WHERE created_at >= $1`, todayKST);
  console.log('활성 병원:', total);
  console.log('오늘 COMPLETED 크롤된 병원:', jobs[0].c);
  console.log('오늘 응답 생성된 병원:', resp[0].c);

  // 최근 7일간 일별 크롤 완료 병원 수 (스케줄러가 매일 몇 곳 처리하나)
  console.log('\n=== 일별 크롤 처리량 (최근 7일) ===');
  const daily = await prisma.$queryRawUnsafe(
    `SELECT date_trunc('day', started_at) d, count(DISTINCT hospital_id)::int hospitals, count(*)::int jobs
     FROM crawl_jobs WHERE started_at > now()-interval '7 days' AND status='COMPLETED'
     GROUP BY d ORDER BY d DESC`);
  daily.forEach(x=>console.log(`  ${x.d.toISOString().slice(0,10)} : ${x.hospitals}곳 / ${x.jobs}잡`));
  await prisma.$disconnect();
})();
