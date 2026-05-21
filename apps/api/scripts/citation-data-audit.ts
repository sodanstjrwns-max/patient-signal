/**
 * 인용 출처 데이터 감사 — 지금 DB에 뭐가 있고 뭐가 없는지 정밀 진단
 * 목적: 출처 분석 화면을 "더 자세하게" 만들기 위해 어디까지 데이터가 받쳐주는지 파악
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('\n🔍 인용 출처 데이터 정밀 감사\n');
  console.log('='.repeat(70));

  // [1] cited_sources 컬럼 활용 현황
  const sourceCoverage: any[] = await prisma.$queryRaw`
    SELECT
      ai_platform::text as platform,
      COUNT(*)::int as total_responses,
      COUNT(*) FILTER (WHERE cardinality(cited_sources) > 0)::int as with_sources,
      ROUND(AVG(cardinality(cited_sources))::numeric, 2)::float as avg_sources_per_response,
      MAX(cardinality(cited_sources))::int as max_sources_in_one_response,
      SUM(cardinality(cited_sources))::int as total_citations
    FROM ai_responses
    GROUP BY ai_platform
    ORDER BY total_citations DESC
  `;
  console.log('\n[1] 플랫폼별 cited_sources 활용도');
  console.log('-'.repeat(70));
  sourceCoverage.forEach(r => {
    const coverage = r.total_responses ? ((r.with_sources / r.total_responses) * 100).toFixed(1) : '0';
    console.log(`  ${r.platform.padEnd(20)} | 응답=${String(r.total_responses).padStart(6)} | 출처有=${String(r.with_sources).padStart(5)} (${coverage}%) | 평균=${r.avg_sources_per_response} | 최대=${r.max_sources_in_one_response}`);
  });

  // [2] source_hints 컬럼 (구조화 출처) 활용 현황
  const hintsCoverage: any[] = await prisma.$queryRaw`
    SELECT
      ai_platform::text as platform,
      COUNT(*) FILTER (WHERE source_hints IS NOT NULL)::int as with_hints,
      COUNT(*)::int as total
    FROM ai_responses
    GROUP BY ai_platform
    ORDER BY with_hints DESC
  `;
  console.log('\n[2] source_hints (구조화 출처) 컬럼 활용도');
  console.log('-'.repeat(70));
  hintsCoverage.forEach(r => {
    const pct = r.total ? ((r.with_hints / r.total) * 100).toFixed(1) : '0';
    console.log(`  ${r.platform.padEnd(20)} | hints有=${String(r.with_hints).padStart(5)} / ${String(r.total).padStart(6)} (${pct}%)`);
  });

  // [3] source_hints 샘플 — 어떤 구조인지
  const hintsSample: any[] = await prisma.$queryRaw`
    SELECT ai_platform::text as platform, source_hints, created_at
    FROM ai_responses
    WHERE source_hints IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 3
  `;
  console.log('\n[3] source_hints JSON 샘플 (최근 3건)');
  console.log('-'.repeat(70));
  hintsSample.forEach((r, i) => {
    console.log(`\n  [${i+1}] ${r.platform} @ ${r.created_at}`);
    const hints = typeof r.source_hints === 'string' ? JSON.parse(r.source_hints) : r.source_hints;
    console.log('  ' + JSON.stringify(hints, null, 2).split('\n').slice(0, 12).join('\n  '));
  });

  // [4] cited_url 컬럼 (대표 URL)
  const citedUrlCoverage: any[] = await prisma.$queryRaw`
    SELECT
      ai_platform::text as platform,
      COUNT(*) FILTER (WHERE cited_url IS NOT NULL AND cited_url != '')::int as with_url,
      COUNT(*)::int as total
    FROM ai_responses
    GROUP BY ai_platform
    ORDER BY with_url DESC
  `;
  console.log('\n[4] cited_url (대표 URL) 활용도');
  console.log('-'.repeat(70));
  citedUrlCoverage.forEach(r => {
    const pct = r.total ? ((r.with_url / r.total) * 100).toFixed(1) : '0';
    console.log(`  ${r.platform.padEnd(20)} | URL有=${String(r.with_url).padStart(5)} / ${String(r.total).padStart(6)} (${pct}%)`);
  });

  // [5] 전체 도메인 다양성
  const uniqueDomains: any[] = await prisma.$queryRaw`
    WITH all_sources AS (
      SELECT unnest(cited_sources) as src FROM ai_responses
    ),
    domains AS (
      SELECT
        CASE
          WHEN src ~ '^https?://' THEN regexp_replace(regexp_replace(src, '^https?://(www\\.)?', ''), '/.*$', '')
          ELSE src
        END as domain
      FROM all_sources
      WHERE src IS NOT NULL AND src != ''
    )
    SELECT COUNT(DISTINCT domain)::int as unique_domains
    FROM domains
  `;
  console.log('\n[5] cited_sources 전체 고유 도메인 수');
  console.log('-'.repeat(70));
  console.log(`  고유 도메인: ${uniqueDomains[0]?.unique_domains}개`);

  // [6] cited_sources 샘플 — 실제 어떻게 저장되어 있나
  const rawSamples: any[] = await prisma.$queryRaw`
    SELECT cited_sources, ai_platform::text as platform
    FROM ai_responses
    WHERE cardinality(cited_sources) > 0
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log('\n[6] cited_sources 원본 샘플 — URL인가 도메인인가?');
  console.log('-'.repeat(70));
  rawSamples.forEach((r, i) => {
    console.log(`\n  [${i+1}] ${r.platform}`);
    (r.cited_sources || []).slice(0, 5).forEach((s: string) => {
      console.log(`      - ${s}`);
    });
  });

  await prisma.$disconnect();
  console.log('\n' + '='.repeat(70));
  console.log('✅ 감사 완료\n');
}

main().catch(e => { console.error(e); process.exit(1); });
