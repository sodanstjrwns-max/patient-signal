const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const todayStart = new Date('2026-06-16T00:00:00Z');
  // ACTIVE/TRIAL 병원 + 활성 프롬프트 보유
  const hospitals = await p.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    include: { prompts: { where: { isActive: true }, select: { id: true } } },
  });
  // 오늘 점수난 병원
  const scoredToday = await p.dailyScore.findMany({ where: { scoreDate: { gte: todayStart } }, select: { hospitalId: true } });
  const scoredSet = new Set(scoredToday.map(s => s.hospitalId));

  // 스케줄러와 동일 정렬
  hospitals.sort((a, b) => {
    const aDone = scoredSet.has(a.id) ? 1 : 0;
    const bDone = scoredSet.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const withPrompts = hospitals.filter(h => h.prompts.length > 0);
  console.log(`ACTIVE/TRIAL 병원: ${hospitals.length}곳 (활성질문 보유 ${withPrompts.length}곳)`);
  console.log(`오늘 점수난 병원: ${scoredSet.size}곳\n`);

  console.log('=== 크롤 처리 순번 (스케줄러 정렬 그대로, 앞 40곳) ===');
  console.log('순번 | 오늘처리 | 가입일       | 병원명');
  withPrompts.slice(0, 40).forEach((h, i) => {
    const done = scoredSet.has(h.id) ? '✅' : '⬜';
    const mark = h.name.includes('정원') ? '  👈 정원한의원' : '';
    console.log(`  ${String(i+1).padStart(2)} |   ${done}   | ${h.createdAt.toISOString().slice(0,10)} | ${h.name.slice(0,18)}${mark}`);
  });

  // 정원 순번
  const idx = withPrompts.findIndex(h => h.name.includes('정원'));
  console.log(`\n>>> 정원한의원 처리 순번: ${idx + 1}번째 / ${withPrompts.length}곳`);

  // 마지막 14일간 각 병원이 며칠이나 크롤됐는지 (굶주림 측정)
  console.log('\n=== 최근 14일 크롤 일수 분포 (굶주림 측정) ===');
  const rows = await p.$queryRaw`
    SELECT h.name, count(distinct ar.created_at::date)::int days, max(ar.created_at::date) last
    FROM hospitals h
    LEFT JOIN ai_responses ar ON ar.hospital_id = h.id AND ar.created_at > now() - interval '14 days'
    WHERE h.subscription_status IN ('ACTIVE','TRIAL')
    GROUP BY h.name
    ORDER BY days ASC, last ASC NULLS FIRST`;
  const buckets = { '0일(완전굶주림)': 0, '1-3일': 0, '4-7일': 0, '8-14일': 0 };
  const starved = [];
  for (const r of rows) {
    const d = r.days;
    if (d === 0) { buckets['0일(완전굶주림)']++; starved.push(r); }
    else if (d <= 3) buckets['1-3일']++;
    else if (d <= 7) buckets['4-7일']++;
    else buckets['8-14일']++;
  }
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k}: ${v}곳`);
  console.log(`\n  ── 최근 14일간 0일 크롤된(굶주린) 병원 ${starved.length}곳 (앞 25곳) ──`);
  starved.slice(0, 25).forEach(r => console.log(`    ${r.name.slice(0,20).padEnd(22)} 마지막 ${r.last ? r.last.toISOString().slice(0,10) : '없음'}`));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
