const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const victims = {
    '서울으뜸치과의원':'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d',
    '진심을 담은 치과교정과':'ffa892d9-8a9c-4941-a35d-cf523d339f27',
    '검단퍼스트치과':'f1bb5198-1101-40da-a825-22edd76d2692',
    '해운대함소아한의원':'2c35f881-422a-4bf9-b153-ed835b8f868c',
  };
  // 서버 기준 현재 시각 + 최근 응답 전체 흐름
  const now = await prisma.$queryRawUnsafe(`SELECT now() AS server_now`);
  console.log('서버 현재시각(UTC):', now[0].server_now.toISOString());

  // 전체 DB에서 가장 최근 응답 시각 (크롤러가 살아 도는지)
  const last = await prisma.$queryRawUnsafe(
    `SELECT max(created_at) AS last, count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last24h FROM ai_responses`);
  console.log('전체 마지막 응답:', last[0].last?.toISOString(), '/ 최근24h 생성:', last[0].last24h, '건');

  console.log('\n=== 4개 병원 오늘/최근 응답 ===');
  for (const [name,id] of Object.entries(victims)) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS h24,
              count(*) FILTER (WHERE created_at > now() - interval '72 hours')::int AS h72,
              max(created_at) AS last
       FROM ai_responses WHERE hospital_id = $1`, id);
    console.log(`${name.padEnd(16)} | 총 ${r[0].total} | 24h ${r[0].h24} | 72h ${r[0].h72} | 마지막 ${r[0].last?.toISOString() ?? '없음'}`);
  }

  console.log('\n=== 으뜸 크롤 작업(crawl_jobs) 최근 상태 ===');
  const jobs = await prisma.$queryRawUnsafe(
    `SELECT status, count(*)::int AS c, max(created_at) AS last
     FROM crawl_jobs WHERE hospital_id = $1
     AND created_at > now() - interval '72 hours'
     GROUP BY status ORDER BY last DESC`, victims['서울으뜸치과의원']);
  if (jobs.length === 0) console.log('  최근 72h 크롤 작업 없음');
  jobs.forEach(j => console.log(`  ${j.status.padEnd(12)} ${j.c}건  마지막 ${j.last?.toISOString()}`));

  await prisma.$disconnect();
})();
