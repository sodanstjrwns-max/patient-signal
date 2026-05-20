// 원장님용 종합 브리핑: 전체 병원 순위 + 알고리즘 변경 후 점수 변화
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function badge(rank: number, total: number) {
  const pct = Math.max(1, Math.round((rank / total) * 100));
  if (pct <= 1) return { emoji: '💎', label: 'Diamond', pct };
  if (pct <= 5) return { emoji: '👑', label: 'Platinum', pct };
  if (pct <= 15) return { emoji: '🥇', label: 'Gold', pct };
  if (pct <= 30) return { emoji: '🥈', label: 'Silver', pct };
  if (pct <= 50) return { emoji: '🥉', label: 'Bronze', pct };
  return { emoji: '🌱', label: 'Starter', pct };
}

async function main() {
  console.log('\n' + '═'.repeat(78));
  console.log('  📊  Patient Signal V2 — 종합 브리핑');
  console.log('  📅  ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
  console.log('═'.repeat(78));

  // ============ PART 1: 전체 병원 순위 ============
  console.log('\n\n🏆 PART 1: 전체 병원 순위 (최신 DailyScore 기준)\n');
  console.log('━'.repeat(78));

  const allHospitals = await prisma.hospital.findMany({
    where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    select: {
      id: true,
      name: true,
      specialtyType: true,
      regionSido: true,
      regionSigungu: true,
      planType: true,
    },
  });

  const latestScores = await prisma.$queryRaw<
    Array<{ hospital_id: string; overall_score: number; score_date: Date }>
  >`
    SELECT ds.hospital_id, ds.overall_score, ds.score_date
    FROM daily_scores ds
    INNER JOIN (
      SELECT hospital_id, MAX(score_date) as max_date
      FROM daily_scores
      GROUP BY hospital_id
    ) latest ON ds.hospital_id = latest.hospital_id AND ds.score_date = latest.max_date
    ORDER BY ds.overall_score DESC
  `;

  const scoreMap = new Map<string, { score: number; date: Date }>();
  for (const r of latestScores) {
    scoreMap.set(r.hospital_id, { score: r.overall_score, date: r.score_date });
  }

  const rankedList = allHospitals
    .map(h => ({
      ...h,
      score: scoreMap.get(h.id)?.score ?? 0,
      scoreDate: scoreMap.get(h.id)?.date ?? null,
    }))
    .sort((a, b) => b.score - a.score);

  let currentRank = 1;
  const rankings = rankedList.map((h, i, arr) => {
    if (i > 0 && h.score < arr[i - 1].score) currentRank = i + 1;
    return { ...h, rank: currentRank };
  });

  const total = rankings.length;
  console.log(`총 ${total}개 병원 (ACTIVE + TRIAL 구독 기준)\n`);
  console.log('순위 | 등급         | 점수 | 진료과         | 지역             | 병원명');
  console.log('-'.repeat(78));

  for (const h of rankings) {
    const b = badge(h.rank, total);
    const isViewer = h.name.includes('서울비디');
    const star = isViewer ? ' ⭐' : '';
    const rankStr = `${String(h.rank).padStart(2)}위`.padEnd(5);
    const tierStr = `${b.emoji} ${b.label.padEnd(9)}`;
    const scoreStr = String(h.score).padStart(3);
    const specStr = (h.specialtyType || '-').padEnd(14).substring(0, 14);
    const regionStr = `${h.regionSido || '-'} ${h.regionSigungu || ''}`.trim().padEnd(16).substring(0, 16);
    const nameStr = h.name.padEnd(22).substring(0, 22);
    console.log(`${rankStr}| ${tierStr} | ${scoreStr}  | ${specStr} | ${regionStr} | ${nameStr}${star}`);
  }

  // 서울비디 강조
  const seoulBD = rankings.find(h => h.name.includes('서울비디'));
  if (seoulBD) {
    const b = badge(seoulBD.rank, total);
    console.log('\n' + '─'.repeat(78));
    console.log(`⭐ 원장님 병원: ${seoulBD.name}`);
    console.log(`   ${b.emoji} ${b.label} 등급 · ${seoulBD.rank}위 / ${total}개 · 상위 ${b.pct}% · ${seoulBD.score}점`);
  }

  // 등급 분포
  const tierDist: Record<string, number> = {};
  for (const h of rankings) {
    const b = badge(h.rank, total);
    tierDist[b.label] = (tierDist[b.label] || 0) + 1;
  }
  console.log('\n📊 등급 분포:');
  for (const tier of ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Starter']) {
    const count = tierDist[tier] || 0;
    if (count > 0) {
      const bar = '█'.repeat(Math.round((count / total) * 30));
      console.log(`   ${tier.padEnd(10)}: ${String(count).padStart(2)}개 ${bar} ${Math.round(count/total*100)}%`);
    }
  }

  // ============ PART 2: 알고리즘 변경 전후 점수 변화 ============
  console.log('\n\n📈 PART 2: 알고리즘 변경 전후 점수 변화\n');
  console.log('━'.repeat(78));

  const activeRun = await prisma.weightCalibrationRun.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeRun?.activatedAt) {
    console.log('⚠️  활성 RUN 없음');
    await prisma.$disconnect();
    return;
  }

  const activatedAt = activeRun.activatedAt;
  console.log(`📅 가중치 활성화: ${activatedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`📊 적용 RUN: ${activeRun.id.slice(0, 8)}... (${activeRun.responsesAnalyzed.toLocaleString()}건 분석)`);

  // 전체 모집단 변화
  const before = await prisma.dailyScore.aggregate({
    where: { createdAt: { lt: activatedAt } },
    _avg: { overallScore: true, abhsScore: true, sovPercent: true, avgSentimentV2: true },
    _count: true,
    _min: { overallScore: true },
    _max: { overallScore: true },
  });

  const after = await prisma.dailyScore.aggregate({
    where: { createdAt: { gte: activatedAt } },
    _avg: { overallScore: true, abhsScore: true, sovPercent: true, avgSentimentV2: true },
    _count: true,
    _min: { overallScore: true },
    _max: { overallScore: true },
  });

  // ABHS는 null 많을 수 있어 별도 필터링 평균
  const beforeAbhsNonNull = await prisma.dailyScore.aggregate({
    where: { createdAt: { lt: activatedAt }, abhsScore: { not: null } },
    _avg: { abhsScore: true },
    _count: true,
  });
  const afterAbhsNonNull = await prisma.dailyScore.aggregate({
    where: { createdAt: { gte: activatedAt }, abhsScore: { not: null } },
    _avg: { abhsScore: true },
    _count: true,
  });

  const formatRow = (label: string, b: number | null, a: number | null) => {
    const bv = b == null ? 0 : Math.round(b * 10) / 10;
    const av = a == null ? 0 : Math.round(a * 10) / 10;
    const delta = Math.round((av - bv) * 10) / 10;
    const sign = delta > 0 ? '+' : '';
    const arrow = delta > 0.5 ? '⬆' : delta < -0.5 ? '⬇' : '➡';
    console.log(`${label.padEnd(20)} | ${String(bv).padStart(6)}  | ${String(av).padStart(6)}  | ${sign}${delta} ${arrow}`);
  };

  console.log('\n[전체 모집단 평균]\n');
  console.log(`지표                 | 활성화 전 | 활성화 후 | Δ`);
  console.log(`(샘플 수)            | n=${String(before._count).padStart(4)}   | n=${String(after._count).padStart(4)}   |`);
  console.log('-'.repeat(60));
  formatRow('Overall Score', before._avg.overallScore, after._avg.overallScore);
  formatRow('ABHS Score', beforeAbhsNonNull._avg.abhsScore, afterAbhsNonNull._avg.abhsScore);
  console.log(`  └─ (ABHS 유효샘플: 전 n=${beforeAbhsNonNull._count} / 후 n=${afterAbhsNonNull._count})`);
  formatRow('SoV %', before._avg.sovPercent, after._avg.sovPercent);
  formatRow('Sentiment V2 (-2~+2)', before._avg.avgSentimentV2, after._avg.avgSentimentV2);

  console.log(`\nOverall 점수 범위:     활성화 전: ${before._min.overallScore}~${before._max.overallScore}점   |   활성화 후: ${after._min.overallScore ?? '-'}~${after._max.overallScore ?? '-'}점`);

  // 병원별 변화
  console.log('\n\n[병원별 변화 — 활성화 전 마지막 점수 vs 활성화 후 점수]\n');

  const afterScores = await prisma.dailyScore.findMany({
    where: { createdAt: { gte: activatedAt } },
    select: { hospitalId: true, overallScore: true, scoreDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const afterScoreMap = new Map<string, { score: number; date: Date }>();
  for (const s of afterScores) {
    if (!afterScoreMap.has(s.hospitalId)) {
      afterScoreMap.set(s.hospitalId, { score: s.overallScore, date: s.scoreDate });
    }
  }

  // 일괄 쿼리: 활성화 직전 각 병원의 마지막 점수
  const targetHospitalIds = Array.from(afterScoreMap.keys());
  const beforeRows = await prisma.$queryRaw<
    Array<{ hospital_id: string; overall_score: number }>
  >`
    SELECT ds.hospital_id, ds.overall_score
    FROM daily_scores ds
    INNER JOIN (
      SELECT hospital_id, MAX(created_at) as max_created
      FROM daily_scores
      WHERE created_at < ${activatedAt}
        AND hospital_id = ANY(${targetHospitalIds}::text[])
      GROUP BY hospital_id
    ) latest ON ds.hospital_id = latest.hospital_id AND ds.created_at = latest.max_created
  `;
  const beforeScoreMap = new Map<string, number>();
  for (const r of beforeRows) beforeScoreMap.set(r.hospital_id, r.overall_score);

  const changes: Array<{
    name: string;
    specialty: string;
    before: number;
    after: number;
    delta: number;
  }> = [];

  for (const [hospitalId, afterData] of afterScoreMap.entries()) {
    const beforeScore = beforeScoreMap.get(hospitalId);
    if (beforeScore === undefined) continue;
    const h = allHospitals.find(x => x.id === hospitalId);
    if (!h) continue;

    changes.push({
      name: h.name,
      specialty: h.specialtyType || '-',
      before: beforeScore,
      after: afterData.score,
      delta: afterData.score - beforeScore,
    });
  }

  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log(`활성화 후 새 점수가 계산된 병원: ${changes.length}개\n`);
  if (changes.length > 0) {
    console.log('변화 | 병원명               | 진료과    | Before → After');
    console.log('-'.repeat(70));
    for (const c of changes) {
      const isViewer = c.name.includes('서울비디');
      const star = isViewer ? ' ⭐' : '';
      const arrow = c.delta > 2 ? '📈' : c.delta < -2 ? '📉' : '➡ ';
      const sign = c.delta > 0 ? '+' : '';
      const nameStr = c.name.padEnd(20).substring(0, 20);
      const specStr = c.specialty.padEnd(8).substring(0, 8);
      console.log(`${arrow}${String(sign + c.delta).padStart(4)} | ${nameStr} | ${specStr} | ${String(c.before).padStart(3)} → ${String(c.after).padStart(3)}${star}`);
    }

    const positives = changes.filter(c => c.delta > 0);
    const negatives = changes.filter(c => c.delta < 0);
    const unchanged = changes.filter(c => c.delta === 0);

    console.log('\n📊 변화 분포:');
    if (positives.length > 0) {
      const avg = positives.reduce((s, c) => s + c.delta, 0) / positives.length;
      console.log(`   📈 상승: ${positives.length}개 (평균 +${avg.toFixed(1)}점)`);
    }
    if (negatives.length > 0) {
      const avg = negatives.reduce((s, c) => s + c.delta, 0) / negatives.length;
      console.log(`   📉 하락: ${negatives.length}개 (평균 ${avg.toFixed(1)}점)`);
    }
    if (unchanged.length > 0) {
      console.log(`   ➡  유지: ${unchanged.length}개`);
    }
  }

  // ============ PART 3: 핵심 인사이트 ============
  console.log('\n\n💡 PART 3: 직관이 데이터에 진 5가지 인사이트\n');
  console.log('━'.repeat(78));

  const insights = [
    {
      icon: '🤯',
      title: '"예약 의도가 최고 가치"라는 직관이 완전 뒤집힘',
      data: 'RESERVATION 배율  1.5 → 1.02  (-32%)',
      reason: 'AI가 "예약하고 싶다" 쿼리엔 추천 거의 안 함 (멘션률 3.3%, 25,067건 中)\n      → 비즈니스 가치 가장 낮은 의도로 재산정됨',
    },
    {
      icon: '🚀',
      title: '"비교"가 진짜 황금 의도였다',
      data: 'COMPARISON 배율   1.1 → 1.5   (+36%)',
      reason: '"A vs B 비교해줘" 쿼리에서 멘션률 67.8% (4개 의도 중 압도적 1위)\n      → R2+R3 깊이 추천 비율 90% — 진짜 추천이 박힘',
    },
    {
      icon: '🌟',
      title: 'Gemini가 다크호스로 부상',
      data: 'GEMINI 가중치     1.2 → 1.4   (+17%)',
      reason: 'SoV 35.5%로 4개 플랫폼 중 최고 멘션률\n      → ChatGPT(1.31)를 추월해서 1위 차지',
    },
    {
      icon: '💔',
      title: 'Perplexity의 권위 신화 붕괴',
      data: 'PERPLEXITY 가중치 1.4 → 1.18  (-16%)',
      reason: '"검색기반 AI라 가장 권위 있다"는 가설이 데이터에선 SoV 18%\n      → 가중치 1위 → 3위로 강등',
    },
    {
      icon: '📚',
      title: 'INFORMATION 의도의 숨겨진 가치',
      data: 'INFORMATION 배율  1.0 → 1.33  (+33%)',
      reason: '"단순 정보 조회"에서 멘션률 42.5%, R2+R3 94%\n      → 정보성 콘텐츠가 의외로 강력한 추천 트리거',
    },
  ];

  for (const i of insights) {
    console.log(`\n${i.icon} ${i.title}`);
    console.log(`      ${i.data}`);
    console.log(`      ${i.reason}`);
  }

  console.log('\n\n' + '═'.repeat(78));
  console.log('  ⏳  자연 반영 진행 중 — 약 3~7일 내 전체 트렌드에 새 가중치 효과 반영');
  console.log('  📅  다음 자동 재캘리브레이션: 2026-05-17 (일) 새벽 3시 KST');
  console.log('  🎯  Tier 1 캘리브레이션 시스템: production-ready');
  console.log('═'.repeat(78) + '\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
