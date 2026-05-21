/**
 * 운영 환경 그록 응답 모니터링
 * - 운영 DB(Supabase)에 직접 연결
 * - 환경변수 등록 시점 이후 GROK 응답이 실제로 쌓이고 있는지 확인
 * - 가장 최근 5개 GROK 응답 샘플 출력
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('\n🔍 운영 DB Grok 응답 모니터링\n');
  console.log('=' .repeat(60));

  // 1. 전체 플랫폼별 응답 카운트 (전체 기간)
  const platformCounts: Array<{ platform: string; count: bigint }> = await prisma.$queryRaw`
    SELECT ai_platform::text as platform, COUNT(*)::bigint as count
    FROM ai_responses
    GROUP BY ai_platform
    ORDER BY count DESC
  `;
  console.log('\n[전체 기간 플랫폼별 응답 카운트]');
  platformCounts.forEach(p => {
    const marker = p.platform === 'GROK' ? ' ⭐ NEW' : '';
    console.log(`  ${p.platform.padEnd(20)} : ${Number(p.count).toLocaleString().padStart(8)} 개${marker}`);
  });

  // 2. 최근 24시간 GROK 응답
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentGrok: any[] = await prisma.$queryRaw`
    SELECT
      ar.id,
      ar.ai_platform::text as platform,
      ar.ai_model_version as model,
      ar.is_mentioned as is_mentioned,
      ar.sentiment_label::text as sentiment,
      LENGTH(ar.response_text) as text_length,
      ar.created_at as created_at,
      h.name as hospital_name
    FROM ai_responses ar
    LEFT JOIN hospitals h ON h.id = ar.hospital_id
    WHERE ar.ai_platform = 'GROK'
      AND ar.created_at >= ${yesterday}
    ORDER BY ar.created_at DESC
    LIMIT 5
  `;

  console.log(`\n[최근 24시간 GROK 응답: ${recentGrok.length}건]`);
  if (recentGrok.length === 0) {
    console.log('  ⏳ 아직 없음 — 다음 크론 사이클(매일 09:00 KST) 또는 수동 트리거 대기 중');
  } else {
    recentGrok.forEach((r, i) => {
      console.log(`\n  [${i+1}] ${r.created_at}`);
      console.log(`      병원: ${r.hospital_name}`);
      console.log(`      모델: ${r.model}`);
      console.log(`      언급: ${r.is_mentioned ? '✅' : '❌'} | 감정: ${r.sentiment} | 길이: ${r.text_length}자`);
    });
  }

  // 3. 7개 플랫폼 모두 채워졌나? (백서 v2.0 진행 상황)
  console.log('\n[7대 AI 플랫폼 적용 현황]');
  const allPlatforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'GOOGLE_AI_OVERVIEW', 'GROK', 'CLOVA_X'];
  for (const p of allPlatforms) {
    const found = platformCounts.find(pc => pc.platform === p);
    const cnt = found ? Number(found.count) : 0;
    const status = cnt > 0 ? `✅ ${cnt.toLocaleString().padStart(8)}개` : '⏳   대기 중';
    console.log(`  ${p.padEnd(20)} : ${status}`);
  }

  // 4. 가장 최근 응답 시간 — 시스템이 살아있는지 sanity check
  const latestAny: any[] = await prisma.$queryRaw`
    SELECT ai_platform::text as platform, MAX(created_at) as latest
    FROM ai_responses
    WHERE created_at >= ${yesterday}
    GROUP BY ai_platform
    ORDER BY latest DESC
    LIMIT 10
  `;
  console.log('\n[지난 24시간 플랫폼별 마지막 응답 시각]');
  latestAny.forEach(r => {
    console.log(`  ${r.platform.padEnd(20)} : ${r.latest}`);
  });

  await prisma.$disconnect();
  console.log('\n' + '='.repeat(60));
  console.log('✅ 모니터링 완료\n');
}

main().catch(e => { console.error(e); process.exit(1); });
