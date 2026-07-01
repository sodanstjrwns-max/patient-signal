const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const eugeum = 'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
  // 으뜸 crawl_jobs 전체 이력 (상태별, 최근순)
  console.log('=== 으뜸 crawl_jobs 전체 이력 ===');
  const jobs = await prisma.$queryRawUnsafe(
    `SELECT status, count(*)::int AS c, min(created_at) AS first, max(created_at) AS last
     FROM crawl_jobs WHERE hospital_id=$1 GROUP BY status ORDER BY last DESC`, eugeum);
  jobs.forEach(j => console.log(`  ${j.status.padEnd(12)} ${String(j.c).padStart(4)}건  ${j.first?.toISOString().slice(0,10)} ~ ${j.last?.toISOString().slice(0,16)}`));

  // 정상 크롤 중인 병원 1곳 골라 비교 (최근24h 응답 있는 STARTER 병원)
  console.log('\n=== 정상 작동 병원 샘플 (최근24h 응답 O) ===');
  const healthy = await prisma.$queryRawUnsafe(
    `SELECT h.id, h.name, h.plan_type, h.subscription_status,
            count(DISTINCT r.id)::int AS resp24h,
            (SELECT count(*)::int FROM prompts p WHERE p.hospital_id=h.id AND p.is_active=true) AS active_prompts,
            (SELECT max(cj.created_at) FROM crawl_jobs cj WHERE cj.hospital_id=h.id) AS last_job
     FROM hospitals h JOIN ai_responses r ON r.hospital_id=h.id
     WHERE r.created_at > now() - interval '24 hours'
     GROUP BY h.id, h.name, h.plan_type, h.subscription_status
     ORDER BY resp24h DESC LIMIT 3`);
  healthy.forEach(x => console.log(`  ${x.name} | ${x.plan_type}/${x.subscription_status} | 24h응답 ${x.resp24h} | active프롬프트 ${x.active_prompts} | 마지막job ${x.last_job?.toISOString().slice(0,16)}`));

  // 으뜸의 active prompt 수 + 마지막 job 시점
  console.log('\n=== 으뜸 vs ===');
  const e = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*)::int FROM prompts WHERE hospital_id=$1 AND is_active=true) AS active_prompts,
            (SELECT max(created_at) FROM crawl_jobs WHERE hospital_id=$1) AS last_job`, eugeum);
  console.log(`  으뜸 | active프롬프트 ${e[0].active_prompts} | 마지막job ${e[0].last_job?.toISOString().slice(0,16) ?? '없음'}`);

  await prisma.$disconnect();
})();
