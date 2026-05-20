import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('  📊  Patient Signal V2 — 데이터 적재량 현황');
  console.log(`  📅  ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const [
    hospitals,
    activeHospitals,
    prompts,
    aiResponses,
    mentionsCount,
    dailyScores,
    weightRuns,
    weightProfiles,
    subscriptions,
    users,
    liveQueryUsage,
    liveQueryResponses,
    crawlJobs,
    citationAnalyses,
  ] = await Promise.all([
    prisma.hospital.count(),
    prisma.hospital.count({ where: { subscriptions: { some: { status: { in: ['ACTIVE', 'TRIAL'] } } } } }).catch(() => 0),
    prisma.prompt.count(),
    prisma.aIResponse.count(),
    prisma.aIResponse.count({ where: { isMentioned: true } }),
    prisma.dailyScore.count(),
    prisma.weightCalibrationRun.count(),
    prisma.weightProfile.count(),
    prisma.subscription.count(),
    prisma.user.count(),
    prisma.liveQueryUsage.count().catch(() => 0),
    prisma.liveQueryResponse.count().catch(() => 0),
    prisma.crawlJob.count().catch(() => 0),
    prisma.citationAnalysis.count().catch(() => 0),
  ]);

  // 플랫폼별 응답
  const responsesByPlatform = await prisma.aIResponse.groupBy({
    by: ['aiPlatform'],
    _count: true,
  });
  responsesByPlatform.sort((a, b) => b._count - a._count);

  // 멘션 비율
  const mentionRate = aiResponses > 0 ? (mentionsCount / aiResponses) * 100 : 0;

  // 최근 7일
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [recentResponses, recentMentions, recentScores] = await Promise.all([
    prisma.aIResponse.count({ where: { createdAt: { gte: sevenDaysAgo } } }).catch(async () =>
      prisma.aIResponse.count({ where: { responseDate: { gte: sevenDaysAgo } } })
    ),
    prisma.aIResponse.count({ where: { createdAt: { gte: sevenDaysAgo }, isMentioned: true } }).catch(async () =>
      prisma.aIResponse.count({ where: { responseDate: { gte: sevenDaysAgo }, isMentioned: true } })
    ),
    prisma.dailyScore.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  // 기간
  const oldestResponse = await prisma.aIResponse.findFirst({
    orderBy: { responseDate: 'asc' },
    select: { responseDate: true },
  });
  const newestResponse = await prisma.aIResponse.findFirst({
    orderBy: { responseDate: 'desc' },
    select: { responseDate: true },
  });

  // 텍스트 총량
  const charSample = await prisma.$queryRaw<Array<{ total_chars: bigint | null; avg_chars: number | null }>>`
    SELECT
      SUM(LENGTH(response_text))::bigint as total_chars,
      AVG(LENGTH(response_text))::float as avg_chars
    FROM ai_responses
  `;
  const totalChars = Number(charSample[0]?.total_chars ?? 0);
  const avgChars = Math.round(charSample[0]?.avg_chars ?? 0);

  // 추천 깊이 분포 (DailyScore.depthDistribution JSON 합산은 비싸니, AIResponse mentionPosition으로 근사)
  const depthFromMentions = await prisma.$queryRaw<Array<{ depth: number; cnt: bigint }>>`
    SELECT
      CASE
        WHEN total_recommendations IS NULL OR total_recommendations = 0 THEN 0
        WHEN mention_position = 1 THEN 3
        WHEN mention_position <= 3 THEN 2
        ELSE 1
      END AS depth,
      COUNT(*)::bigint as cnt
    FROM ai_responses
    WHERE is_mentioned = true
    GROUP BY depth
    ORDER BY depth
  `;

  // 출력
  console.log('🏥 [병원 / 유저 / 구독]');
  console.log(`   총 등록 병원              : ${hospitals.toLocaleString()}개`);
  console.log(`   활성 구독 (ACTIVE+TRIAL)  : ${activeHospitals.toLocaleString()}개`);
  console.log(`   구독 레코드               : ${subscriptions.toLocaleString()}건`);
  console.log(`   유저                       : ${users.toLocaleString()}명`);

  console.log('\n🔍 [프롬프트 / AI 응답]');
  console.log(`   등록된 Prompt             : ${prompts.toLocaleString()}건`);
  console.log(`   수집된 AI 응답 (총)       : ${aiResponses.toLocaleString()}건`);
  console.log(`   └─ 멘션 포함              : ${mentionsCount.toLocaleString()}건 (${mentionRate.toFixed(1)}%)`);
  console.log(`   └─ 미멘션                  : ${(aiResponses - mentionsCount).toLocaleString()}건 (${(100 - mentionRate).toFixed(1)}%)`);
  console.log(`   총 응답 텍스트 길이       : ${totalChars.toLocaleString()} chars (${(totalChars / 1_000_000).toFixed(1)}M)`);
  console.log(`   응답당 평균 길이          : ${avgChars.toLocaleString()} chars`);
  console.log('\n   플랫폼별 응답 분포:');
  for (const r of responsesByPlatform) {
    const pct = ((r._count / aiResponses) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((r._count / aiResponses) * 30));
    console.log(`     ${String(r.aiPlatform).padEnd(12)} ${String(r._count).padStart(7)} (${pct.padStart(5)}%) ${bar}`);
  }

  console.log('\n💬 [멘션 / 추천 깊이 분포]');
  const depthLabel: Record<number, string> = {
    0: 'R0 (단순 언급)    ',
    1: 'R1 (목록 포함)    ',
    2: 'R2 (구체 추천 Top3)',
    3: 'R3 (1순위 추천)   ',
  };
  for (const m of depthFromMentions) {
    const cnt = Number(m.cnt);
    const pct = ((cnt / mentionsCount) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((cnt / mentionsCount) * 30));
    console.log(`     ${(depthLabel[m.depth] || `R${m.depth}            `).padEnd(20)} ${String(cnt).padStart(7)} (${pct.padStart(5)}%) ${bar}`);
  }

  console.log('\n📈 [점수 / 분석]');
  console.log(`   DailyScore                : ${dailyScores.toLocaleString()}건`);
  console.log(`   CitationAnalysis          : ${citationAnalyses.toLocaleString()}건`);

  console.log('\n⚖️  [가중치 캘리브레이션]');
  console.log(`   캘리브레이션 RUN          : ${weightRuns.toLocaleString()}회`);
  console.log(`   WeightProfile             : ${weightProfiles.toLocaleString()}개`);

  console.log('\n🔧 [부가 시스템]');
  console.log(`   LiveQueryUsage            : ${liveQueryUsage.toLocaleString()}건`);
  console.log(`   LiveQueryResponse         : ${liveQueryResponses.toLocaleString()}건`);
  console.log(`   CrawlJob                  : ${crawlJobs.toLocaleString()}건`);

  console.log('\n📅 [수집 기간]');
  console.log(`   첫 응답 날짜              : ${oldestResponse?.responseDate.toISOString().split('T')[0] ?? '-'}`);
  console.log(`   마지막 응답 날짜          : ${newestResponse?.responseDate.toISOString().split('T')[0] ?? '-'}`);
  if (oldestResponse && newestResponse) {
    const days = Math.max(1, Math.round((newestResponse.responseDate.getTime() - oldestResponse.responseDate.getTime()) / (1000 * 60 * 60 * 24)));
    console.log(`   운영 기간                 : ${days}일`);
    console.log(`   일평균 응답 수집           : ${Math.round(aiResponses / days).toLocaleString()}건/일`);
    console.log(`   일평균 멘션 수집           : ${Math.round(mentionsCount / days).toLocaleString()}건/일`);
  }

  console.log('\n🚀 [최근 7일 활동]');
  console.log(`   신규 AI 응답              : ${recentResponses.toLocaleString()}건`);
  console.log(`   신규 멘션                 : ${recentMentions.toLocaleString()}건`);
  console.log(`   신규 DailyScore           : ${recentScores.toLocaleString()}건`);

  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('  💾  요약');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log(`  • 병원 ${activeHospitals}개 × 약 ${Math.round(aiResponses / Math.max(activeHospitals, 1))}건 응답/병원`);
  console.log(`  • 전체 멘션률 ${mentionRate.toFixed(1)}% (업계 평균 대비 ${mentionRate > 30 ? '높음' : mentionRate > 15 ? '중간' : '낮음'})`);
  console.log(`  • LLM 분석 대상 텍스트 ${(totalChars / 1_000_000).toFixed(1)}M chars`);
  console.log(`  • 캘리브레이션 학습 풀: ${aiResponses.toLocaleString()}건 응답 / ${mentionsCount.toLocaleString()}건 멘션`);
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
