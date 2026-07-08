/**
 * 리건치과(dental-doctor) + 바노바기(dlgkssk195) 역설계
 * - 인용된 개별 포스트 URL과 그 포스트가 먹은 질문 목록
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

async function analyzeBlog(blogId: string, label: string) {
  const posts: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.is_mentioned, r.ai_platform::text AS platform,
             LEFT(COALESCE(p.prompt_text, r.archived_prompt_text), 60) AS q,
             src
      FROM ai_responses r
      LEFT JOIN prompts p ON p.id = r.prompt_id,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}'
        AND src ILIKE '%blog.naver.com/${blogId}%'
    )
    SELECT split_part(split_part(src, '?', 1), '#', 1) AS post_url,
           COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE is_mentioned)::int AS mentioned,
           array_agg(DISTINCT platform) AS platforms,
           array_agg(DISTINCT q) FILTER (WHERE q IS NOT NULL) AS questions
    FROM all_src
    GROUP BY 1 ORDER BY cnt DESC LIMIT 12
  `);
  console.log(`\n========== ${label} (${blogId}) ==========`);
  for (const p of posts) {
    console.log(`\n  [${String(p.cnt).padStart(3)}회 / 언급동반 ${p.mentioned}] ${p.post_url}`);
    console.log(`    플랫폼: ${p.platforms.join(',')}`);
    (p.questions ?? []).slice(0, 6).forEach((q: string) => console.log(`    Q: ${q}`));
  }
}

async function main() {
  await analyzeBlog('dental-doctor', '리건치과 (천안 불당동 직접 경쟁)');
  await analyzeBlog('dlgkssk195', '바노바기 일레븐 (역삼, 교정 정보 장악)');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
