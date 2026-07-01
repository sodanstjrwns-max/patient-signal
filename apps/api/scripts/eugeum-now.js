const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const id = 'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
  const now = await prisma.$queryRawUnsafe(`SELECT now() AS n`);
  console.log('서버시각(UTC):', now[0].n.toISOString(), '/ KST:', new Date(now[0].n.getTime()+9*3600*1000).toISOString().slice(0,16).replace('T',' '));

  // 으뜸 최근 응답
  const r = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE created_at > now()-interval '24 hours')::int h24,
            count(*) FILTER (WHERE created_at > now()-interval '72 hours')::int h72,
            min(created_at) first, max(created_at) last
     FROM ai_responses WHERE hospital_id=$1`, id);
  console.log('\n=== 으뜸 ai_responses ===');
  console.log(`  총 ${r[0].total} | 24h ${r[0].h24} | 72h ${r[0].h72}`);
  console.log(`  범위: ${r[0].first?.toISOString().slice(0,16) ?? '없음'} ~ ${r[0].last?.toISOString().slice(0,16) ?? '없음'}`);

  // 으뜸 최근 크롤잡
  const j = await prisma.$queryRawUnsafe(
    `SELECT status, started_at, completed_at, total_prompts FROM crawl_jobs WHERE hospital_id=$1 ORDER BY started_at DESC LIMIT 8`, id);
  console.log('\n=== 으뜸 최근 crawl_jobs ===');
  j.forEach(x=>console.log(`  ${x.status.padEnd(10)} ${x.started_at?.toISOString().slice(0,16)} prompts=${x.total_prompts ?? '-'}`));

  // 으뜸 최근 점수
  const s = await prisma.$queryRawUnsafe(
    `SELECT score_date, overall_score, mention_count FROM daily_scores WHERE hospital_id=$1 ORDER BY score_date DESC LIMIT 5`, id);
  console.log('\n=== 으뜸 최근 daily_scores ===');
  s.forEach(x=>console.log(`  ${x.score_date.toISOString().slice(0,10)} 점수 ${x.overall_score} 언급 ${x.mention_count}`));

  await prisma.$disconnect();
})();
