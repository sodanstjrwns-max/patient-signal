/**
 * 네이버 블로그 vs 티스토리 — 정면 비교 분석
 * 불당본점 기준: 플랫폼별 인용, 언급동반율, 질문 유형, 인용 블로그 정체, 시간 추이
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

const CHANNEL_CASE = `
  CASE
    WHEN src ILIKE '%blog.naver.com%' OR src ILIKE '%m.blog.naver.com%' THEN 'naver_blog'
    WHEN src ILIKE '%tistory.com%' THEN 'tistory'
  END
`;

async function main() {
  // 1) 채널 × AI 플랫폼 매트릭스
  const matrix: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, r.ai_platform::text AS platform, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}'
        AND (src ILIKE '%blog.naver.com%' OR src ILIKE '%tistory.com%')
    )
    SELECT ${CHANNEL_CASE} AS channel, platform, COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned
    FROM all_src GROUP BY 1, 2 ORDER BY 1, cnt DESC
  `);
  console.log('=== 1) 채널 × AI 플랫폼 ===');
  for (const m of matrix) {
    const rate = m.cnt ? Math.round(100 * m.mentioned / m.cnt) : 0;
    console.log(`  ${String(m.channel).padEnd(12)} ${String(m.platform).padEnd(12)} ${String(m.cnt).padStart(5)}회  언급 ${String(m.mentioned).padStart(4)} (${rate}%)`);
  }

  // 2) 질문 의도별 비교
  const intents: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.query_intent::text AS intent, r.is_mentioned, src
      FROM ai_responses r,
      LATERAL (SELECT unnest(r.cited_sources) AS src) s
      WHERE r.hospital_id = '${HOSPITAL_ID}'
        AND (src ILIKE '%blog.naver.com%' OR src ILIKE '%tistory.com%')
    )
    SELECT ${CHANNEL_CASE} AS channel, COALESCE(intent,'?') AS intent, COUNT(*)::int AS cnt
    FROM all_src GROUP BY 1, 2 ORDER BY 1, cnt DESC
  `);
  console.log('\n=== 2) 채널 × 질문 의도 ===');
  for (const i of intents) {
    console.log(`  ${String(i.channel).padEnd(12)} ${String(i.intent).padEnd(15)} ${String(i.cnt).padStart(5)}회`);
  }

  // 3) 네이버 블로그: 어떤 블로그들이 인용되는가 (블로그 ID 추출)
  const naverBlogs: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, r.ai_platform::text AS platform, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src ILIKE '%blog.naver.com%'
    )
    SELECT split_part(split_part(regexp_replace(src, '^https?://(m\\.)?blog\\.naver\\.com/', ''), '?', 1), '/', 1) AS blog_id,
           COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned,
           array_agg(DISTINCT platform) AS platforms,
           (array_agg(src))[1] AS sample
    FROM all_src GROUP BY 1 ORDER BY cnt DESC LIMIT 20
  `);
  console.log('\n=== 3) 인용된 네이버 블로그 TOP 20 ===');
  for (const b of naverBlogs) {
    const rate = b.cnt ? Math.round(100 * b.mentioned / b.cnt) : 0;
    console.log(`  ${String(b.blog_id).padEnd(30)} ${String(b.cnt).padStart(4)}회  언급 ${String(b.mentioned).padStart(3)} (${rate}%)  [${b.platforms.join(',')}]`);
  }

  // 4) 네이버 블로그가 인용되는 질문 TOP 12
  const naverQs: any[] = await prisma.$queryRawUnsafe(`
    SELECT LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 70) AS q, COUNT(*)::int AS cnt,
           BOOL_OR(r.is_mentioned) AS ever_mentioned
    FROM ai_responses r
    LEFT JOIN prompts p ON p.id = r.prompt_id
    WHERE r.hospital_id = '${HOSPITAL_ID}'
      AND EXISTS (SELECT 1 FROM unnest(r.cited_sources) u WHERE u ILIKE '%blog.naver.com%')
    GROUP BY 1 ORDER BY cnt DESC LIMIT 12
  `);
  console.log('\n=== 4) 네이버 블로그가 인용되는 질문 TOP 12 ===');
  for (const s of naverQs) {
    console.log(`  [${String(s.cnt).padStart(3)}회${s.ever_mentioned ? ' ✅' : ' ❌'}] ${s.q}`);
  }

  // 5) 월별 추이 (채널별)
  const trend: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.created_at, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}'
        AND (src ILIKE '%blog.naver.com%' OR src ILIKE '%tistory.com%')
    )
    SELECT to_char(created_at, 'YYYY-MM') AS ym, ${CHANNEL_CASE} AS channel, COUNT(*)::int AS cnt
    FROM all_src GROUP BY 1, 2 ORDER BY 1, 2
  `);
  console.log('\n=== 5) 월별 인용 추이 ===');
  const byMonth: Record<string, Record<string, number>> = {};
  for (const t of trend) {
    byMonth[t.ym] = byMonth[t.ym] ?? {};
    byMonth[t.ym][t.channel] = t.cnt;
  }
  console.log('  월        naver_blog  tistory');
  for (const [ym, v] of Object.entries(byMonth)) {
    console.log(`  ${ym}   ${String(v['naver_blog'] ?? 0).padStart(8)}  ${String(v['tistory'] ?? 0).padStart(7)}`);
  }

  // 6) '서울비디' 관련 네이버 블로그 (자사/우호 콘텐츠 존재 여부)
  const bdNaver: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, src
      FROM ai_responses r,
      LATERAL (SELECT unnest(r.cited_sources) AS src) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src ILIKE '%blog.naver.com%'
        AND r.is_mentioned = true
    )
    SELECT LEFT(src, 90) AS url, COUNT(*)::int AS cnt
    FROM all_src GROUP BY 1 ORDER BY cnt DESC LIMIT 10
  `);
  console.log('\n=== 6) 우리 언급 동반한 네이버 블로그 URL TOP 10 ===');
  for (const b of bdNaver) console.log(`  [${String(b.cnt).padStart(3)}회] ${b.url}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
