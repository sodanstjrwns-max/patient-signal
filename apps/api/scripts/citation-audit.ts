/**
 * 출처(Citation) 감사 — DB 사이드 집계 버전 (메모리 안전)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

async function main() {
  // 0) 외국어 프롬프트 기준 시각
  const first = await prisma.prompt.findFirst({
    where: { hospitalId: HOSPITAL_ID, specialtyCategory: { startsWith: '외국인' } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  if (!first) { console.log('외국어 프롬프트 없음'); return; }
  const cutoff = first.createdAt.toISOString();
  console.log(`기준 시각(첫 외국어 프롬프트): ${cutoff}`);

  // 응답 수 개요
  const counts: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r.created_at >= '${cutoff}')::int AS after_cnt,
      COUNT(*) FILTER (WHERE p.specialty_category LIKE '외국인%')::int AS foreign_cnt
    FROM ai_responses r
    LEFT JOIN prompts p ON p.id = r.prompt_id
    WHERE r.hospital_id = '${HOSPITAL_ID}'
  `);
  console.log(`전체 응답: ${counts[0].total} / 기준 이후: ${counts[0].after_cnt} / 외국어질문 응답: ${counts[0].foreign_cnt}`);

  // 도메인 추출 함수 (SQL): cited_sources unnest + cited_url
  const domainExpr = `
    lower(regexp_replace(regexp_replace(src, '^https?://', ''), '^www\\.', ''))
  `;
  const domainOnly = `split_part(${domainExpr}, '/', 1)`;

  // 1) BEFORE 도메인 집합 vs AFTER 도메인 집합 → 신규 도메인
  const newDomains: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.id, r.created_at, r.ai_platform::text AS platform, r.is_mentioned,
             (p.specialty_category LIKE '외국인%') AS is_foreign,
             src
      FROM ai_responses r
      LEFT JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
    ),
    domains AS (
      SELECT ${domainOnly} AS domain, created_at, platform, is_foreign
      FROM all_src
    ),
    before_d AS (SELECT DISTINCT domain FROM domains WHERE created_at < '${cutoff}'),
    after_d AS (
      SELECT domain, COUNT(*)::int AS cnt,
             BOOL_OR(COALESCE(is_foreign,false)) AS from_foreign,
             array_agg(DISTINCT platform) AS platforms
      FROM domains WHERE created_at >= '${cutoff}'
      GROUP BY domain
    )
    SELECT a.domain, a.cnt, a.from_foreign, a.platforms
    FROM after_d a
    WHERE a.domain NOT IN (SELECT domain FROM before_d)
    ORDER BY a.cnt DESC
    LIMIT 50
  `);
  console.log(`\n=== 🆕 외국어 질문 추가 이후 신규 출처 도메인: ${newDomains.length}개 ===`);
  for (const d of newDomains) {
    console.log(`  ${String(d.domain).padEnd(45)} ${String(d.cnt).padStart(4)}회 ${d.from_foreign ? '← 외국어질문 인용' : ''} [${d.platforms.join(',')}]`);
  }

  // 2) 외국어 프롬프트 응답에서 인용된 출처
  const foreignSources: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.ai_platform::text AS platform, src
      FROM ai_responses r
      JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}'
        AND p.specialty_category LIKE '외국인%'
        AND src IS NOT NULL AND src <> ''
    )
    SELECT ${domainOnly} AS domain, COUNT(*)::int AS cnt,
           array_agg(DISTINCT platform) AS platforms,
           (array_agg(src))[1] AS sample_url
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC LIMIT 30
  `);
  console.log(`\n=== 🌍 외국어 질문 응답에서 인용된 출처 도메인 ===`);
  for (const d of foreignSources) {
    console.log(`  ${String(d.domain).padEnd(45)} ${String(d.cnt).padStart(4)}회 [${d.platforms.join(',')}]`);
    console.log(`      예: ${String(d.sample_url).slice(0, 100)}`);
  }

  // 3) 전체 도메인 TOP 40
  const topAll: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, r.ai_platform::text AS platform, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
    )
    SELECT ${domainOnly} AS domain, COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned_cnt,
           array_agg(DISTINCT platform) AS platforms
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC LIMIT 40
  `);
  console.log(`\n=== 📊 전체 출처 도메인 TOP 40 ===`);
  for (const d of topAll) {
    console.log(`  ${String(d.domain).padEnd(45)} ${String(d.cnt).padStart(5)}회  언급동반 ${String(d.mentioned_cnt).padStart(4)}  [${d.platforms.join(',')}]`);
  }

  // 4) 티스토리 vs 브런치 vs 네이버블로그
  const channels: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
    )
    SELECT
      CASE
        WHEN src LIKE '%tistory.com%' THEN 'tistory'
        WHEN src LIKE '%brunch.co.kr%' THEN 'brunch'
        WHEN src LIKE '%blog.naver.com%' THEN 'naver_blog'
        WHEN src LIKE '%cafe.naver.com%' THEN 'naver_cafe'
        WHEN src LIKE '%youtube.com%' OR src LIKE '%youtu.be%' THEN 'youtube'
        WHEN src LIKE '%instagram.com%' THEN 'instagram'
        ELSE 'other'
      END AS channel,
      COUNT(*)::int AS cnt,
      COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned_cnt
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC
  `);
  console.log(`\n=== ⚔️ 채널별 인용 비교 ===`);
  for (const c of channels) {
    console.log(`  ${String(c.channel).padEnd(15)} ${String(c.cnt).padStart(6)}회  언급동반 ${String(c.mentioned_cnt).padStart(5)}`);
  }

  // 5) 전체 병원(전 고객) 기준 채널 비교 — 시장 전체 시그널
  const marketChannels: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE src IS NOT NULL AND src <> ''
    )
    SELECT
      CASE
        WHEN src LIKE '%tistory.com%' THEN 'tistory'
        WHEN src LIKE '%brunch.co.kr%' THEN 'brunch'
        WHEN src LIKE '%blog.naver.com%' THEN 'naver_blog'
        ELSE 'other'
      END AS channel,
      COUNT(*)::int AS cnt
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC
  `);
  console.log(`\n=== 🌐 (참고) 전체 DB — 모든 병원 응답 기준 채널 비교 ===`);
  for (const c of marketChannels) {
    console.log(`  ${String(c.channel).padEnd(15)} ${String(c.cnt).padStart(7)}회`);
  }

  // 6) CitedSourceSnapshot 도메인 순위
  const snapCount = await prisma.citedSourceSnapshot.count();
  if (snapCount > 0) {
    const snaps: any[] = await prisma.$queryRawUnsafe(`
      SELECT domain, COUNT(*)::int AS pages, SUM(total_citations)::int AS total_cit
      FROM cited_source_snapshots
      GROUP BY domain ORDER BY total_cit DESC NULLS LAST LIMIT 25
    `);
    console.log(`\n=== 📸 CitedSourceSnapshot (전체 ${snapCount}건) TOP 25 ===`);
    for (const s of snaps) {
      console.log(`  ${String(s.domain).padEnd(45)} 페이지 ${String(s.pages).padStart(3)} / 총인용 ${s.total_cit ?? 0}`);
    }
    const newSnaps: any[] = await prisma.$queryRawUnsafe(`
      SELECT domain, language, LEFT(COALESCE(title, url), 70) AS title, created_at
      FROM cited_source_snapshots
      WHERE created_at >= '${cutoff}'
      ORDER BY created_at DESC LIMIT 30
    `);
    console.log(`\n=== 📸 기준 이후 신규 스냅샷: ${newSnaps.length}건 (최근 30) ===`);
    for (const s of newSnaps) {
      console.log(`  [${s.language ?? '?'}] ${s.domain} — ${s.title}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
