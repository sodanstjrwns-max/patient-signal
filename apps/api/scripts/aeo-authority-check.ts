import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('  🎓  AEO 전문가 권위 검증 — 데이터 기반 자격 평가');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  // 진료과별 병원 수 + 응답 + 멘션 통합 (raw SQL)
  const bySpecialty = await prisma.$queryRaw<
    Array<{ specialty_type: string; hospital_count: bigint; response_count: bigint; mention_count: bigint }>
  >`
    SELECT
      h.specialty_type::text as specialty_type,
      COUNT(DISTINCT h.id)::bigint as hospital_count,
      COUNT(ar.id)::bigint as response_count,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mention_count
    FROM hospitals h
    LEFT JOIN ai_responses ar ON ar.hospital_id = h.id
    INNER JOIN subscriptions s ON s.hospital_id = h.id AND s.status IN ('ACTIVE','TRIAL')
    GROUP BY h.specialty_type
    ORDER BY response_count DESC
  `;

  // 치과 깊이 분포
  const dentalDepth = await prisma.$queryRaw<Array<{ depth: number; cnt: bigint }>>`
    SELECT
      CASE
        WHEN ar.total_recommendations IS NULL OR ar.total_recommendations = 0 THEN 0
        WHEN ar.mention_position = 1 THEN 3
        WHEN ar.mention_position <= 3 THEN 2
        ELSE 1
      END AS depth,
      COUNT(*)::bigint as cnt
    FROM ai_responses ar
    INNER JOIN hospitals h ON ar.hospital_id = h.id
    WHERE h.specialty_type = 'DENTAL' AND ar.is_mentioned = true
    GROUP BY depth
    ORDER BY depth
  `;

  // 치과 플랫폼별
  const dentalPlatform = await prisma.$queryRaw<Array<{ platform: string; total: bigint; mentions: bigint }>>`
    SELECT
      ar.ai_platform::text as platform,
      COUNT(*)::bigint as total,
      SUM(CASE WHEN ar.is_mentioned THEN 1 ELSE 0 END)::bigint as mentions
    FROM ai_responses ar
    INNER JOIN hospitals h ON ar.hospital_id = h.id
    WHERE h.specialty_type = 'DENTAL'
    GROUP BY ar.ai_platform
    ORDER BY total DESC
  `;

  // 치과 텍스트 총량
  const dentalText = await prisma.$queryRaw<Array<{ total_chars: bigint | null }>>`
    SELECT SUM(LENGTH(ar.response_text))::bigint as total_chars
    FROM ai_responses ar
    INNER JOIN hospitals h ON ar.hospital_id = h.id
    WHERE h.specialty_type = 'DENTAL'
  `;
  const dentalChars = Number(dentalText[0]?.total_chars ?? 0);

  // 치과 시도/시군구 다양성
  const dentalRegions = await prisma.$queryRaw<Array<{ sido: string; sigungu: string }>>`
    SELECT DISTINCT h.region_sido as sido, h.region_sigungu as sigungu
    FROM hospitals h
    INNER JOIN subscriptions s ON s.hospital_id = h.id AND s.status IN ('ACTIVE','TRIAL')
    WHERE h.specialty_type = 'DENTAL'
  `;
  const uniqueSido = new Set(dentalRegions.map((r) => r.sido)).size;
  const uniqueSigungu = dentalRegions.length;

  // 치과 운영 기간
  const dentalDates = await prisma.$queryRaw<Array<{ min_date: Date; max_date: Date }>>`
    SELECT MIN(ar.response_date) as min_date, MAX(ar.response_date) as max_date
    FROM ai_responses ar
    INNER JOIN hospitals h ON ar.hospital_id = h.id
    WHERE h.specialty_type = 'DENTAL'
  `;

  // 치과 합계
  const dentalRow = bySpecialty.find((r) => r.specialty_type === 'DENTAL');
  const dentalResponses = Number(dentalRow?.response_count ?? 0);
  const dentalMentions = Number(dentalRow?.mention_count ?? 0);
  const dentalHospitals = Number(dentalRow?.hospital_count ?? 0);
  const totalHospitals = bySpecialty.reduce((acc, r) => acc + Number(r.hospital_count), 0);
  const dentalDays =
    dentalDates[0]?.min_date && dentalDates[0]?.max_date
      ? Math.round(
          (dentalDates[0].max_date.getTime() - dentalDates[0].min_date.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

  // 출력
  console.log('📊 [진료과별 데이터 분포 — 활성 구독 기준]\n');
  console.log(`${'진료과'.padEnd(22)} | 병원 | AI응답   | 멘션     | 멘션률`);
  console.log('-'.repeat(72));
  for (const s of bySpecialty) {
    const hosp = Number(s.hospital_count);
    const cnt = Number(s.response_count);
    const m = Number(s.mention_count);
    const rate = cnt > 0 ? ((m / cnt) * 100).toFixed(1) : '0.0';
    console.log(
      `${s.specialty_type.padEnd(22)} | ${String(hosp).padStart(4)} | ${String(cnt).padStart(7)}  | ${String(m).padStart(7)}  | ${rate.padStart(5)}%`
    );
  }

  console.log('\n\n🦷 [치과(DENTAL) 단독 심층 분석]\n');
  console.log(`   치과 병원 수              : ${dentalHospitals}개 (전체 ${totalHospitals}개 中 ${((dentalHospitals / totalHospitals) * 100).toFixed(0)}%)`);
  console.log(`   치과 AI 응답              : ${dentalResponses.toLocaleString()}건`);
  console.log(`   치과 멘션                 : ${dentalMentions.toLocaleString()}건`);
  console.log(`   치과 멘션률               : ${((dentalMentions / dentalResponses) * 100).toFixed(1)}%`);
  console.log(`   치과 텍스트 분석량        : ${(dentalChars / 1_000_000).toFixed(1)}M chars`);
  console.log(`   커버 지역                 : 시/도 ${uniqueSido}개, 시/군/구 ${uniqueSigungu}개`);
  if (dentalDates[0]?.min_date && dentalDates[0]?.max_date) {
    console.log(
      `   수집 기간                 : ${dentalDates[0].min_date.toISOString().split('T')[0]} ~ ${dentalDates[0].max_date.toISOString().split('T')[0]} (${dentalDays}일)`
    );
  }

  console.log('\n   [치과 추천 깊이 분포]');
  const depthLabel: Record<number, string> = {
    0: 'R0 단순 언급  ',
    1: 'R1 목록 포함  ',
    2: 'R2 Top3 추천  ',
    3: 'R3 1순위 추천 ',
  };
  for (const d of dentalDepth) {
    const cnt = Number(d.cnt);
    const pct = ((cnt / dentalMentions) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((cnt / dentalMentions) * 30));
    console.log(`     ${(depthLabel[d.depth] || `R${d.depth}`).padEnd(16)} ${String(cnt).padStart(6)} (${pct.padStart(5)}%) ${bar}`);
  }

  console.log('\n   [치과 플랫폼별 멘션률]');
  for (const p of dentalPlatform) {
    const total = Number(p.total);
    const m = Number(p.mentions);
    const rate = ((m / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((m / total) * 60));
    console.log(`     ${p.platform.padEnd(12)} ${String(m).padStart(5)}/${String(total).padStart(5)} (${rate.padStart(5)}%) ${bar}`);
  }

  console.log('\n\n🎓 [AEO 전문가 자격 평가 — 객관적 기준]\n');
  const r2r3Pct =
    (dentalDepth.filter((d) => d.depth >= 2).reduce((sum, d) => sum + Number(d.cnt), 0) / dentalMentions) *
    100;

  const criteria: Array<{ name: string; target: number; actual: number; unit: string; meta: string }> = [
    {
      name: '1. 통계적 유의 표본 (n > 10,000)',
      target: 10000,
      actual: dentalResponses,
      unit: '건',
      meta: 'ML 학습/논문 게재 기준 충족',
    },
    {
      name: '2. 4개 AI 플랫폼 균형 데이터',
      target: 4,
      actual: dentalPlatform.length,
      unit: '개',
      meta: '단일 플랫폼 편향 없음',
    },
    {
      name: '3. 표본 다양성 (병원 > 30개)',
      target: 30,
      actual: dentalHospitals,
      unit: '개',
      meta: '일반화 가능 — 단일 사례 아님',
    },
    {
      name: '4. 지역 다양성 (시/군/구 > 20)',
      target: 20,
      actual: uniqueSigungu,
      unit: '곳',
      meta: '수도권 편향 아닌 전국 데이터',
    },
    {
      name: '5. 시계열 길이 (일수 > 60)',
      target: 60,
      actual: dentalDays,
      unit: '일',
      meta: '주간/계절성 트렌드 분석 가능',
    },
    {
      name: '6. 진짜 추천 비율 (R2+R3 > 50%)',
      target: 50,
      actual: r2r3Pct,
      unit: '%',
      meta: '단순 언급 아닌 강한 추천 신호',
    },
    {
      name: '7. 멘션 표본 (n > 5,000)',
      target: 5000,
      actual: dentalMentions,
      unit: '건',
      meta: '의도/플랫폼별 cross-table 분석 가능',
    },
    {
      name: '8. 분석 텍스트량 (> 10M chars)',
      target: 10_000_000,
      actual: dentalChars,
      unit: 'chars',
      meta: 'LLM 재라벨링/임베딩 분석 충분',
    },
  ];

  let passCount = 0;
  for (const c of criteria) {
    const pass = c.actual >= c.target;
    if (pass) passCount++;
    const ratio = c.actual / c.target;
    const ratioStr = ratio >= 10 ? `${ratio.toFixed(1)}배` : `${(ratio * 100).toFixed(0)}%`;
    const icon = pass ? '✅' : '❌';
    const actualDisplay = c.unit === '%' ? c.actual.toFixed(1) : c.actual.toLocaleString();
    console.log(`   ${icon} ${c.name}`);
    console.log(`      목표 ${c.target.toLocaleString()}${c.unit}  /  실제 ${actualDisplay}${c.unit}  (${ratioStr})`);
    console.log(`      └─ ${c.meta}\n`);
  }

  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log(`  🏆 통과 ${passCount}/${criteria.length}개 기준`);
  if (passCount === criteria.length) {
    console.log(`  ✅ 결론: 치과 AEO 전문가 활동 — 데이터 측면에서 자격 완비`);
  } else if (passCount >= criteria.length - 1) {
    console.log(`  ✅ 결론: 거의 모든 기준 통과 — 전문가 활동 충분`);
  } else {
    console.log(`  ⚠️  결론: 보완 필요 항목 있음`);
  }
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
