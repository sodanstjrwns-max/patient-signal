const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  // 정원: 백필 전 상태를 createdAt 기준으로 추정 — 같은 날 크롤된 다른 병원과 비교
  const h = await p.hospital.findFirst({where:{name:{contains:'정원'}}});
  console.log('정원 createdAt:', h.createdAt.toISOString());

  // 정원 응답의 createdAt 분포 (언제 크롤됐나)
  const jr = await p.$queryRaw`SELECT date_trunc('day', created_at) as d, count(*)::int n FROM ai_responses WHERE hospital_id=${h.id} GROUP BY 1 ORDER BY 1`;
  console.log('\n정원 응답 크롤 시각(생성일):'); jr.forEach(r=>console.log(`  ${r.d.toISOString()} : ${r.n}건`));

  // 5/28~5/31 사이 전체 크롤된 병원들의 SoV 분포 — 정원만 0이었나?
  const others = await p.$queryRaw`
    SELECT h.name, h.specialty_type as sp, count(*)::int total,
           sum(case when ar.is_mentioned then 1 else 0 end)::int ment
    FROM ai_responses ar JOIN hospitals h ON h.id=ar.hospital_id
    WHERE ar.response_date BETWEEN '2026-05-28' AND '2026-05-31'
    GROUP BY h.name, h.specialty_type
    HAVING count(*) >= 20
    ORDER BY (sum(case when ar.is_mentioned then 1 else 0 end)::float/count(*)) ASC
    LIMIT 20`;
  console.log('\n=== 5/28~31 크롤된 병원 SoV 낮은 순 (현재 DB값) ===');
  others.forEach(r=>console.log(`  ${r.name.slice(0,18).padEnd(20)} ${String(r.sp).slice(0,12).padEnd(13)} ${r.ment}/${r.total} = ${(r.ment/r.total*100).toFixed(0)}%`));

  // 한의원(KOREAN_MEDICINE) 전체는 어떤가
  const km = await p.$queryRaw`
    SELECT h.name, count(*)::int total, sum(case when ar.is_mentioned then 1 else 0 end)::int ment
    FROM ai_responses ar JOIN hospitals h ON h.id=ar.hospital_id
    WHERE h.specialty_type='KOREAN_MEDICINE'
    GROUP BY h.name ORDER BY total DESC`;
  console.log('\n=== 한의원(KOREAN_MEDICINE) 전체 ===');
  km.forEach(r=>console.log(`  ${r.name.slice(0,18).padEnd(20)} ${r.ment}/${r.total} = ${(r.ment/r.total*100).toFixed(0)}%`));
  await p.$disconnect();
})();
