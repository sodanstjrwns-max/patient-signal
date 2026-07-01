const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 전체 병원 수 (상태별)
  const all = await prisma.$queryRawUnsafe(
    `SELECT subscription_status, count(*)::int c FROM hospitals GROUP BY subscription_status ORDER BY c DESC`);
  console.log('=== 전체 병원 (상태별) ===');
  let total=0; all.forEach(x=>{console.log(`  ${(x.subscription_status||'null').padEnd(12)} ${x.c}`); total+=x.c;});
  console.log(`  --- 합계: ${total}곳`);

  const active = await prisma.hospital.count({ where:{ subscriptionStatus:{in:['ACTIVE','TRIAL']} }});
  console.log(`\n크롤 대상(ACTIVE+TRIAL): ${active}곳`);

  // 플랜별 분포 (프롬프트 수 차이) — 처리시간 산정
  const byPlan = await prisma.$queryRawUnsafe(
    `SELECT plan_type, count(*)::int c FROM hospitals WHERE subscription_status IN ('ACTIVE','TRIAL') GROUP BY plan_type ORDER BY c DESC`);
  console.log('\n=== 크롤 대상 플랜별 ===');
  byPlan.forEach(x=>console.log(`  ${(x.plan_type||'null').padEnd(12)} ${x.c}`));

  // 실제 1병원당 크롤 소요시간 측정 (최근 COMPLETED 잡의 started~completed)
  const dur = await prisma.$queryRawUnsafe(
    `SELECT avg(extract(epoch from (completed_at - started_at)))::int avg_sec,
            min(extract(epoch from (completed_at - started_at)))::int min_sec,
            max(extract(epoch from (completed_at - started_at)))::int max_sec,
            count(*)::int n
     FROM crawl_jobs
     WHERE status='COMPLETED' AND completed_at IS NOT NULL AND started_at > now()-interval '3 days'`);
  console.log('\n=== 1병원 크롤 소요시간 (최근3일 COMPLETED) ===');
  console.log(`  평균 ${dur[0].avg_sec}s | 최소 ${dur[0].min_sec}s | 최대 ${dur[0].max_sec}s | 표본 ${dur[0].n}건`);

  // 용량 계산
  const avg = dur[0].avg_sec || 60;
  console.log('\n=== 용량 시뮬레이션 ===');
  [24,50].forEach(min=>{
    const perSession = Math.floor(min*60/avg);
    console.log(`  예산 ${min}분 → 세션당 ${perSession}곳 × 3세션 = 하루 ${perSession*3}곳`);
  });
  console.log(`  (병원당 평균 ${avg}s 기준)`);
  await prisma.$disconnect();
})();
