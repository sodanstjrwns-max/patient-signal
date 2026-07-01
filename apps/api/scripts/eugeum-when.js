const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const HID='c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
const q=(s)=>prisma.$queryRawUnsafe(s);
(async()=>{
  // crawl_jobs 으뜸: 날짜 범위 + 상태
  console.log('=== crawl_jobs (으뜸) ===');
  const cj = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='crawl_jobs' ORDER BY ordinal_position`);
  console.log('컬럼:', cj.map(c=>c.column_name).join(', '));
  const cjData = await q(`SELECT * FROM crawl_jobs WHERE hospital_id='${HID}' ORDER BY created_at DESC LIMIT 8`);
  cjData.forEach(r=>console.log(`  ${r.created_at?.toISOString?.()||r.created_at} | status=${r.status} | platform=${r.ai_platform||r.platform||''} | responses=${r.total_responses||r.responses_count||'?'}`));

  // daily_scores 으뜸: 날짜 범위
  console.log('\n=== daily_scores (으뜸) 날짜 범위 ===');
  const ds = await q(`SELECT MIN(score_date) mn, MAX(score_date) mx, COUNT(*)::int c FROM daily_scores WHERE hospital_id='${HID}'`).catch(async()=>{
    return await q(`SELECT MIN(created_at) mn, MAX(created_at) mx, COUNT(*)::int c FROM daily_scores WHERE hospital_id='${HID}'`);
  });
  console.log(JSON.stringify(ds[0]));

  // 최근 daily_scores 몇 개
  const dsRecent = await q(`SELECT * FROM daily_scores WHERE hospital_id='${HID}' ORDER BY created_at DESC LIMIT 5`);
  console.log('\n최근 daily_scores 5건:');
  dsRecent.forEach(r=>{
    const keys=Object.keys(r).filter(k=>/date|score|mention|created/i.test(k));
    console.log('  ', keys.map(k=>`${k}=${r[k]?.toISOString?.()||r[k]}`).join(' '));
  });
  await prisma.$disconnect();
})();
