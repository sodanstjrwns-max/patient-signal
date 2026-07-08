/**
 * 티스토리 심층 분석 — 어떤 블로그가, 어떤 질문에서, 어떤 AI에 인용되는가
 * → 불당본점 티스토리 콘텐츠 전략 도출용
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

async function main() {
  // 1) 인용된 티스토리 블로그(서브도메인) 순위 + 샘플 URL
  const blogs: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, r.ai_platform::text AS platform, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src LIKE '%tistory.com%'
    )
    SELECT
      split_part(lower(regexp_replace(regexp_replace(src, '^https?://', ''), '^www\\.', '')), '/', 1) AS blog,
      COUNT(*)::int AS cnt,
      COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned_cnt,
      array_agg(DISTINCT platform) AS platforms,
      (array_agg(src))[1] AS sample_url
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC LIMIT 20
  `);
  console.log(`=== 🏠 인용된 티스토리 블로그 TOP 20 ===`);
  for (const b of blogs) {
    console.log(`  ${String(b.blog).padEnd(40)} ${String(b.cnt).padStart(4)}회  언급동반 ${String(b.mentioned_cnt).padStart(3)}  [${b.platforms.join(',')}]`);
    console.log(`      ${String(b.sample_url).slice(0, 110)}`);
  }

  // 2) 티스토리가 인용된 응답의 질문 카테고리/의도 분포
  const promptCats: any[] = await prisma.$queryRawUnsafe(`
    SELECT p.specialty_category AS cat, r.query_intent::text AS intent, COUNT(*)::int AS cnt
    FROM ai_responses r
    JOIN prompts p ON p.id = r.prompt_id
    WHERE r.hospital_id = '${HOSPITAL_ID}'
      AND EXISTS (SELECT 1 FROM unnest(r.cited_sources) u WHERE u LIKE '%tistory.com%')
    GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 20
  `);
  console.log(`\n=== ❓ 티스토리가 인용되는 질문 카테고리 × 의도 TOP 20 ===`);
  for (const c of promptCats) {
    console.log(`  ${String(c.cat ?? '?').padEnd(20)} ${String(c.intent ?? '?').padEnd(18)} ${String(c.cnt).padStart(4)}회`);
  }

  // 3) 티스토리가 인용된 질문 원문 샘플 (자주 인용되는 것)
  const promptSamples: any[] = await prisma.$queryRawUnsafe(`
    SELECT LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 80) AS q, COUNT(*)::int AS cnt,
           BOOL_OR(r.is_mentioned) AS ever_mentioned
    FROM ai_responses r
    LEFT JOIN prompts p ON p.id = r.prompt_id
    WHERE r.hospital_id = '${HOSPITAL_ID}'
      AND EXISTS (SELECT 1 FROM unnest(r.cited_sources) u WHERE u LIKE '%tistory.com%')
    GROUP BY 1 ORDER BY cnt DESC LIMIT 15
  `);
  console.log(`\n=== 📝 티스토리가 인용되는 질문 원문 TOP 15 ===`);
  for (const s of promptSamples) {
    console.log(`  [${String(s.cnt).padStart(3)}회${s.ever_mentioned ? ' ✅언급' : ' ❌미언급'}] ${s.q}`);
  }

  // 4) ❌ 우리 병원 미언급 응답에서 인용된 티스토리 = "경쟁자가 선점한 자리"
  const gapBlogs: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.id, src, LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 70) AS q
      FROM ai_responses r
      LEFT JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (SELECT unnest(r.cited_sources) AS src) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND r.is_mentioned = false
        AND src LIKE '%tistory.com%'
    )
    SELECT split_part(lower(regexp_replace(regexp_replace(src, '^https?://', ''), '^www\\.', '')), '/', 1) AS blog,
           COUNT(*)::int AS cnt,
           array_agg(DISTINCT q) FILTER (WHERE q IS NOT NULL) AS questions
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC LIMIT 10
  `);
  console.log(`\n=== ⚠️ 우리 미언급 응답에서 인용된 티스토리 (경쟁 선점 지대) TOP 10 ===`);
  for (const g of gapBlogs) {
    console.log(`  ${String(g.blog).padEnd(40)} ${String(g.cnt).padStart(4)}회`);
    (g.questions ?? []).slice(0, 3).forEach((q: string) => console.log(`      Q: ${q}`));
  }

  // 5) 참고: 브런치 인용 세부 (어떤 글이길래 42.7% 언급동반인지)
  const brunchUrls: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src LIKE '%brunch.co.kr%'
    )
    SELECT LEFT(src, 90) AS url, COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned_cnt
    FROM all_src GROUP BY 1 ORDER BY cnt DESC LIMIT 8
  `);
  console.log(`\n=== 📖 (참고) 인용된 브런치 URL TOP 8 ===`);
  for (const b of brunchUrls) {
    console.log(`  [${String(b.cnt).padStart(3)}회/언급 ${b.mentioned_cnt}] ${b.url}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
