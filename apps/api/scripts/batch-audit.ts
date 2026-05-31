import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 일일 배치 누락 추적 시작\n');
  console.log('='.repeat(80));

  // 1. 전체 점수 로우 한방에 가져와서 메모리 분석
  const all = await prisma.dailyScore.findMany({
    select: {
      hospitalId: true,
      scoreDate: true,
      overallScore: true,
      mentionCount: true,
      createdAt: true,
    },
    orderBy: { scoreDate: 'desc' },
  });

  // 2. 전체 병원 (필수 정보 포함)
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      naverPlaceId: true,
      planType: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });
  const hMap = new Map(hospitals.map(h => [h.id, h]));

  // 3. 날짜별 스코어링된 병원 수 카운트
  const byDate = new Map<string, Set<string>>();
  for (const s of all) {
    const d = s.scoreDate.toISOString().slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, new Set());
    byDate.get(d)!.add(s.hospitalId);
  }

  const sortedDates = Array.from(byDate.keys()).sort().reverse();
  console.log('\n📅 최근 15일 일일 배치 처리량:\n');
  console.log('날짜       │ 처리 병원수 │ 전일대비');
  console.log('───────────┼─────────────┼─────────');
  let prevCount: number | null = null;
  for (const d of sortedDates.slice(0, 15)) {
    const cnt = byDate.get(d)!.size;
    const delta = prevCount !== null ? cnt - prevCount : 0;
    const arrow = delta === 0 ? '' : delta > 0 ? `📈 +${delta}` : `📉 ${delta}`;
    // 전일대비는 "전일=어제, 즉 sortedDates의 다음 인덱스"로 계산해야 정확
    const idx = sortedDates.indexOf(d);
    const prev = idx + 1 < sortedDates.length ? byDate.get(sortedDates[idx + 1])!.size : null;
    const realDelta = prev !== null ? cnt - prev : 0;
    const realArrow = prev === null ? '' : realDelta === 0 ? '0' : realDelta > 0 ? `📈 +${realDelta}` : `📉 ${realDelta}`;
    console.log(`${d} │ ${cnt.toString().padStart(11)} │ ${realArrow}`);
    prevCount = cnt;
  }

  // 4. 5/30에 누락된 병원 식별
  const target = '2026-05-30';
  const processedOn530 = byDate.get(target) || new Set();
  const allHospitalIds = new Set(hospitals.map(h => h.id));

  // 단, "스코어 데이터가 한 번이라도 있는" 병원만 누락으로 간주 (신규는 따로 처리)
  const eligibleIds = new Set(all.map(s => s.hospitalId));
  const missingOn530 = Array.from(eligibleIds).filter(id => !processedOn530.has(id));

  console.log(`\n\n🚨 ${target} 누락 병원: ${missingOn530.length}개 (스코어 이력 있는 곳 기준)\n`);

  // 각 누락 병원의 마지막 스코어 날짜
  const lastScoreByHospital = new Map<string, Date>();
  for (const s of all) {
    if (!lastScoreByHospital.has(s.hospitalId)) {
      lastScoreByHospital.set(s.hospitalId, s.scoreDate);
    }
  }

  // 누락 병원들을 마지막 스코어 일자 기준으로 정렬
  const missingDetails = missingOn530
    .map(id => {
      const h = hMap.get(id);
      const last = lastScoreByHospital.get(id);
      const daysAgo = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : 999;
      return { id, h, last, daysAgo };
    })
    .sort((a, b) => a.daysAgo - b.daysAgo);

  console.log('마지막   │ 일전 │ Plan     │ 상태    │ Place   │ Website │ 병원명');
  console.log('점수일자  │      │          │         │         │         │');
  console.log('─────────┼──────┼──────────┼─────────┼─────────┼─────────┼' + '─'.repeat(40));
  for (const m of missingDetails) {
    if (!m.h) continue;
    const date = m.last ? m.last.toISOString().slice(0, 10) : '(없음)';
    const days = m.daysAgo.toString().padStart(3);
    const plan = (m.h.planType || '?').padEnd(8);
    const status = (m.h.subscriptionStatus || '?').padEnd(7);
    const place = m.h.naverPlaceId ? '✅' : '❌';
    const web = m.h.websiteUrl ? '✅' : '❌';
    console.log(`${date} │ ${days}일 │ ${plan} │ ${status} │   ${place}    │   ${web}    │ ${m.h.name}`);
  }

  // 5. 5/30에 처리된 18곳 vs 누락 N곳 — 공통 패턴 찾기
  console.log('\n\n🔬 5/30 처리 vs 누락 — 공통 패턴 분석\n');

  const processedHospitals = Array.from(processedOn530).map(id => hMap.get(id)).filter(Boolean);
  const missingHospitals = missingDetails.map(m => m.h).filter(Boolean);

  // Plan/Status별 카운트
  function tabulate(list: any[], key: string) {
    const m = new Map<string, number>();
    for (const h of list) {
      const v = h[key] || '(null)';
      m.set(v, (m.get(v) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }

  console.log('▼ planType:');
  console.log('  처리됨:', tabulate(processedHospitals, 'planType'));
  console.log('  누락됨:', tabulate(missingHospitals, 'planType'));

  console.log('\n▼ subscriptionStatus:');
  console.log('  처리됨:', tabulate(processedHospitals, 'subscriptionStatus'));
  console.log('  누락됨:', tabulate(missingHospitals, 'subscriptionStatus'));

  // Place ID 보유 여부
  const procWithPlace = processedHospitals.filter((h: any) => h?.naverPlaceId).length;
  const missWithPlace = missingHospitals.filter((h: any) => h?.naverPlaceId).length;
  console.log('\n▼ naverPlaceId 보유율:');
  console.log(`  처리됨: ${procWithPlace}/${processedHospitals.length} (${((procWithPlace/processedHospitals.length)*100).toFixed(0)}%)`);
  console.log(`  누락됨: ${missWithPlace}/${missingHospitals.length} (${((missWithPlace/missingHospitals.length)*100).toFixed(0)}%)`);

  const procWithWeb = processedHospitals.filter((h: any) => h?.websiteUrl).length;
  const missWithWeb = missingHospitals.filter((h: any) => h?.websiteUrl).length;
  console.log('\n▼ websiteUrl 보유율:');
  console.log(`  처리됨: ${procWithWeb}/${processedHospitals.length} (${((procWithWeb/processedHospitals.length)*100).toFixed(0)}%)`);
  console.log(`  누락됨: ${missWithWeb}/${missingHospitals.length} (${((missWithWeb/missingHospitals.length)*100).toFixed(0)}%)`);

  // 6. 5/30 처리된 18곳의 createdAt 패턴 (가입일)
  console.log('\n▼ 5/30 처리된 18곳의 가입일 분포:');
  processedHospitals
    .filter(Boolean)
    .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .forEach((h: any) => {
      console.log(`  ${h.createdAt.toISOString().slice(0, 10)} │ ${h.name}`);
    });

  // 7. 5/30에 스코어링된 raw 레코드 (createdAt 확인)
  console.log('\n▼ 5/30 스코어링 레코드의 createdAt 시각 (실제 배치 실행 시각):');
  const scores530 = all.filter(s => s.scoreDate.toISOString().slice(0, 10) === target);
  const createdAtCounts = new Map<string, number>();
  for (const s of scores530) {
    const hourKey = s.createdAt.toISOString().slice(0, 13); // "2026-05-30T08"
    createdAtCounts.set(hourKey, (createdAtCounts.get(hourKey) || 0) + 1);
  }
  Array.from(createdAtCounts.entries())
    .sort()
    .forEach(([k, v]) => console.log(`  ${k}시 │ ${v}건`));

  console.log('\n' + '='.repeat(80));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
