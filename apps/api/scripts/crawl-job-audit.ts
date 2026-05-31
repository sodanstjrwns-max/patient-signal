import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 CrawlJob 추적 — 5/26 ~ 5/31\n');

  // 1. 최근 6일치 CrawlJob 상태별 카운트
  const since = new Date('2026-05-26T00:00:00Z');
  const jobsRaw = await prisma.crawlJob.findMany({
    where: { startedAt: { gte: since } },
    select: {
      id: true,
      hospitalId: true,
      status: true,
      totalPrompts: true,
      completed: true,
      failed: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { startedAt: 'desc' },
  });
  // startedAt이 null인 잡은 제외 (필터 조건상 이미 not null이지만 TS 안전)
  const jobs = jobsRaw.filter((j): j is typeof jobsRaw[0] & { startedAt: Date } => j.startedAt !== null);

  console.log(`총 ${jobs.length}건 (5/26 이후)\n`);

  // 날짜별 + 상태별 카운트
  const byDateStatus = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const d = j.startedAt.toISOString().slice(0, 10);
    if (!byDateStatus.has(d)) byDateStatus.set(d, new Map());
    const m = byDateStatus.get(d)!;
    m.set(j.status, (m.get(j.status) || 0) + 1);
  }

  console.log('날짜       │ COMPLETED │ FAILED │ RUNNING │ 합계');
  console.log('───────────┼───────────┼────────┼─────────┼─────');
  Array.from(byDateStatus.keys()).sort().reverse().forEach(d => {
    const m = byDateStatus.get(d)!;
    const c = m.get('COMPLETED') || 0;
    const f = m.get('FAILED') || 0;
    const r = m.get('RUNNING') || 0;
    const total = c + f + r;
    console.log(`${d} │ ${c.toString().padStart(9)} │ ${f.toString().padStart(6)} │ ${r.toString().padStart(7)} │ ${total.toString().padStart(4)}`);
  });

  // 2. 5/30 RUNNING 상태로 멈춘 잡 (= 끝까지 못 돌고 죽음)
  const runningOn530 = jobs.filter(j =>
    j.startedAt.toISOString().slice(0, 10) === '2026-05-30' &&
    j.status === 'RUNNING'
  );
  console.log(`\n⚠️  5/30 RUNNING 상태로 멈춘 잡: ${runningOn530.length}건`);

  // 3. 5/30 FAILED
  const failedOn530 = jobs.filter(j =>
    j.startedAt.toISOString().slice(0, 10) === '2026-05-30' &&
    j.status === 'FAILED'
  );
  console.log(`❌ 5/30 FAILED 잡: ${failedOn530.length}건`);

  // 4. 5/30 CrawlJob 시간 분포 (실제 배치 실행시각)
  const jobs530 = jobs.filter(j => j.startedAt.toISOString().slice(0, 10) === '2026-05-30');
  console.log(`\n📅 5/30 CrawlJob 시간 분포 (총 ${jobs530.length}건):`);
  const hourMap = new Map<string, number>();
  for (const j of jobs530) {
    const hour = j.startedAt.toISOString().slice(0, 13);
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  }
  Array.from(hourMap.entries()).sort().forEach(([h, c]) => {
    console.log(`  ${h}:00 UTC │ ${c}건`);
  });

  // 5. 5/30 첫 CrawlJob → 마지막 CrawlJob 시간 차
  if (jobs530.length > 0) {
    const sorted = [...jobs530].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const first = sorted[0].startedAt;
    const last = sorted[sorted.length - 1].startedAt;
    const elapsed = (last.getTime() - first.getTime()) / 60000;
    console.log(`\n첫 잡: ${first.toISOString()}`);
    console.log(`마지막 잡: ${last.toISOString()}`);
    console.log(`소요: ${elapsed.toFixed(1)}분`);
  }

  // 6. 5/30에 잡 자체가 안 만들어진 병원 = 스케줄러 루프에서 빠진 곳
  const hospitalsWithJob530 = new Set(jobs530.map(j => j.hospitalId));
  const allActive = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true, name: true, planType: true, websiteUrl: true },
  });
  console.log(`\n📊 5/30 기준: ACTIVE/TRIAL 병원 ${allActive.length}곳`);
  console.log(`  - CrawlJob 만들어진 곳: ${hospitalsWithJob530.size}`);
  console.log(`  - CrawlJob 아예 안 만들어진 곳: ${allActive.length - hospitalsWithJob530.size}`);

  // 잡이 아예 안 만들어진 병원의 프롬프트 보유 여부
  const noJobHospitals = allActive.filter(h => !hospitalsWithJob530.has(h.id));
  const promptCounts = await prisma.prompt.groupBy({
    by: ['hospitalId'],
    where: {
      hospitalId: { in: noJobHospitals.map(h => h.id) },
      isActive: true,
    },
    _count: { _all: true },
  });
  const promptMap = new Map(promptCounts.map(p => [p.hospitalId, p._count._all]));

  console.log(`\n  - 그 중 활성 프롬프트 0개 = 스케줄러가 정상 스킵: ${noJobHospitals.filter(h => !promptMap.has(h.id)).length}`);
  console.log(`  - 그 중 활성 프롬프트 있음 = 진짜 누락: ${noJobHospitals.filter(h => promptMap.has(h.id)).length}`);

  // 진짜 누락된 곳 디테일
  const realMissed = noJobHospitals.filter(h => promptMap.has(h.id));
  if (realMissed.length > 0) {
    console.log(`\n🚨 5/30 CrawlJob 안 만들어졌는데 프롬프트는 있는 병원 (= 진짜 누락):`);
    console.log('Plan      │ Prompts │ Website │ 병원명');
    console.log('──────────┼─────────┼─────────┼' + '─'.repeat(40));
    realMissed.slice(0, 30).forEach(h => {
      const prompts = (promptMap.get(h.id) || 0).toString().padStart(7);
      const web = h.websiteUrl ? '✅' : '❌';
      console.log(`${(h.planType || '?').padEnd(8)} │ ${prompts} │   ${web}    │ ${h.name}`);
    });
    if (realMissed.length > 30) console.log(`... 외 ${realMissed.length - 30}건`);
  }

  // 7. 5/27까지 잘 돌던 곳들 — 그 중 5/30에 안 돈 곳들 = 어제까지 정상이었던 곳들이 사라진 것
  console.log(`\n📌 5/27에는 잡 있었는데 5/30엔 없는 병원 (= 회귀):`);
  const jobs527 = await prisma.crawlJob.findMany({
    where: {
      startedAt: {
        gte: new Date('2026-05-27T00:00:00Z'),
        lt: new Date('2026-05-28T00:00:00Z'),
      },
    },
    select: { hospitalId: true },
  });
  const hospitals527 = new Set(jobs527.map(j => j.hospitalId));
  const lostHospitals = Array.from(hospitals527).filter(id => !hospitalsWithJob530.has(id));
  console.log(`5/27 잡 있던 병원: ${hospitals527.size}곳, 5/30 사라진 곳: ${lostHospitals.length}곳`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
