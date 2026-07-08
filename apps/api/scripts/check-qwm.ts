/**
 * Quora / Wikipedia / Medium 인용 여부 확인
 * - 불당본점 기준 + 전체 DB 기준
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

async function checkScope(label: string, hospitalFilter: string) {
  const rows: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.id, r.is_mentioned, r.ai_platform::text AS platform, r.created_at,
             LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 70) AS q,
             src
      FROM ai_responses r
      LEFT JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE ${hospitalFilter} src IS NOT NULL AND src <> ''
        AND (src ILIKE '%quora.com%' OR src ILIKE '%wikipedia.org%' OR src ILIKE '%medium.com%')
    )
    SELECT
      CASE
        WHEN src ILIKE '%quora.com%' THEN 'quora'
        WHEN src ILIKE '%wikipedia.org%' THEN 'wikipedia'
        WHEN src ILIKE '%medium.com%' THEN 'medium'
      END AS site,
      COUNT(*)::int AS cnt,
      COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned_cnt,
      array_agg(DISTINCT platform) AS platforms,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC
  `);
  console.log(`\n=== ${label} ===`);
  if (rows.length === 0) { console.log('  (없음)'); return; }
  for (const r of rows) {
    console.log(`  ${String(r.site).padEnd(12)} ${String(r.cnt).padStart(5)}회  언급동반 ${String(r.mentioned_cnt).padStart(4)}  [${r.platforms.join(',')}]  ${new Date(r.first_seen).toISOString().slice(0,10)} ~ ${new Date(r.last_seen).toISOString().slice(0,10)}`);
  }

  // URL + 질문 샘플
  const samples: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned,
             LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 60) AS q,
             src
      FROM ai_responses r
      LEFT JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE ${hospitalFilter} src IS NOT NULL
        AND (src ILIKE '%quora.com%' OR src ILIKE '%wikipedia.org%' OR src ILIKE '%medium.com%')
    )
    SELECT
      CASE
        WHEN src ILIKE '%quora.com%' THEN 'quora'
        WHEN src ILIKE '%wikipedia.org%' THEN 'wikipedia'
        WHEN src ILIKE '%medium.com%' THEN 'medium'
      END AS site,
      LEFT(src, 95) AS url, COUNT(*)::int AS cnt,
      array_agg(DISTINCT q) FILTER (WHERE q IS NOT NULL) AS questions
    FROM all_src
    GROUP BY 1, 2 ORDER BY 1, cnt DESC
  `);
  for (const s of samples.slice(0, 25)) {
    console.log(`    [${s.site}] ${String(s.cnt).padStart(3)}회  ${s.url}`);
    (s.questions ?? []).slice(0, 2).forEach((q: string) => console.log(`        Q: ${q}`));
  }
}

async function main() {
  await checkScope('🏥 불당본점 서울비디치과', `r.hospital_id = '${HOSPITAL_ID}' AND`);
  await checkScope('🌐 전체 DB (모든 병원)', ``);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
