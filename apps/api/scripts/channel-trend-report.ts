/**
 * 채널별 인용 트렌드 리포트용 데이터 추출
 * - 최근 30일 vs 이전 기간 채널 점유율 변화
 * - 채널 분류 확장 (유튜브/인스타/틱톡/커뮤니티/의료플랫폼/병원홈페이지 등)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

const CHANNEL_CASE = `
  CASE
    WHEN src ILIKE '%vertexaisearch.cloud.google.com%' THEN 'google_grounding'
    WHEN src ILIKE '%google.com/maps%' OR src ILIKE '%google.com/search%' OR (src ILIKE '%google.com%') THEN 'google_maps_search'
    WHEN src ILIKE '%blog.naver.com%' THEN 'naver_blog'
    WHEN src ILIKE '%cafe.naver.com%' THEN 'naver_cafe'
    WHEN src ILIKE '%m.place.naver.com%' OR src ILIKE '%place.naver.com%' OR src ILIKE '%site.naver.com%' OR src ILIKE '%map.naver.com%' THEN 'naver_place'
    WHEN src ILIKE '%contents.premium.naver.com%' OR src ILIKE '%post.naver.com%' OR src ILIKE '%in.naver.com%' THEN 'naver_etc'
    WHEN src ILIKE '%tistory.com%' THEN 'tistory'
    WHEN src ILIKE '%brunch.co.kr%' THEN 'brunch'
    WHEN src ILIKE '%instagram.com%' THEN 'instagram'
    WHEN src ILIKE '%tiktok.com%' THEN 'tiktok'
    WHEN src ILIKE '%youtube.com%' OR src ILIKE '%youtu.be%' THEN 'youtube'
    WHEN src ILIKE '%facebook.com%' THEN 'facebook'
    WHEN src ILIKE '%my-doctor.io%' OR src ILIKE '%modoodoc%' OR src ILIKE '%cashdoc%' OR src ILIKE '%goodhosrank%' OR src ILIKE '%gangnamunni%' OR src ILIKE '%babitalk%' THEN 'medical_platform'
    WHEN src ILIKE '%hira.or.kr%' OR src ILIKE '%nhis.or.kr%' OR src ILIKE '%mohw.go.kr%' THEN 'gov_public'
    WHEN src ILIKE '%namu.wiki%' OR src ILIKE '%wikipedia.org%' THEN 'wiki'
    WHEN src ILIKE '%daangn.com%' THEN 'daangn'
    WHEN src ILIKE '%reddit.com%' OR src ILIKE '%dcinside%' OR src ILIKE '%fmkorea%' OR src ILIKE '%clien%' THEN 'community'
    WHEN src ILIKE '%news.naver.com%' OR src ILIKE '%v.daum.net%' OR src ILIKE '%chosun%' OR src ILIKE '%joongang%' OR src ILIKE '%donga%' OR src ILIKE '%hani.co.kr%' OR src ILIKE '%khan.co.kr%' OR src ILIKE '%news%' THEN 'news_media'
    WHEN src ILIKE '%bdbddc.com%' THEN 'our_website'
    ELSE 'hospital_web_etc'
  END
`;

async function main() {
  // 1) 최근 30일 vs 이전: 채널 점유율
  const trend: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.created_at, r.is_mentioned, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
    ),
    tagged AS (
      SELECT ${CHANNEL_CASE} AS channel,
             (created_at >= NOW() - INTERVAL '30 days') AS recent,
             is_mentioned
      FROM all_src
    )
    SELECT channel,
           COUNT(*) FILTER (WHERE NOT recent)::int AS before_cnt,
           COUNT(*) FILTER (WHERE recent)::int AS recent_cnt,
           COUNT(*) FILTER (WHERE recent AND is_mentioned)::int AS recent_mentioned
    FROM tagged
    GROUP BY channel
    ORDER BY recent_cnt DESC
  `);

  const totalBefore = trend.reduce((s, t) => s + t.before_cnt, 0);
  const totalRecent = trend.reduce((s, t) => s + t.recent_cnt, 0);
  console.log(`총 인용: 이전 ${totalBefore} / 최근30일 ${totalRecent}`);
  console.log('\n=== 채널별: 이전 점유율 → 최근 30일 점유율 (변화) ===');
  for (const t of trend) {
    const pb = totalBefore ? (100 * t.before_cnt / totalBefore) : 0;
    const pr = totalRecent ? (100 * t.recent_cnt / totalRecent) : 0;
    const diff = pr - pb;
    const rate = t.recent_cnt ? Math.round(100 * t.recent_mentioned / t.recent_cnt) : 0;
    console.log(`  ${t.channel.padEnd(20)} ${pb.toFixed(1).padStart(5)}% → ${pr.toFixed(1).padStart(5)}%  (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%p)  최근언급률 ${rate}%  [${t.before_cnt}→${t.recent_cnt}]`);
  }

  // 2) 최근 30일 급상승 도메인 (이전 대비)
  const rising: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.created_at, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
    ),
    d AS (
      SELECT split_part(lower(regexp_replace(regexp_replace(src, '^https?://', ''), '^www\\.', '')), '/', 1) AS domain,
             (created_at >= NOW() - INTERVAL '30 days') AS recent
      FROM all_src
    )
    SELECT domain,
           COUNT(*) FILTER (WHERE NOT recent)::int AS before_cnt,
           COUNT(*) FILTER (WHERE recent)::int AS recent_cnt
    FROM d
    GROUP BY domain
    HAVING COUNT(*) FILTER (WHERE recent) >= 5
    ORDER BY (COUNT(*) FILTER (WHERE recent)::float / GREATEST(COUNT(*) FILTER (WHERE NOT recent), 1)) DESC
    LIMIT 20
  `);
  console.log('\n=== 최근 30일 급상승 도메인 (최근 5회 이상) ===');
  for (const r of rising) {
    console.log(`  ${String(r.domain).padEnd(45)} 이전 ${String(r.before_cnt).padStart(5)} → 최근 ${String(r.recent_cnt).padStart(4)}`);
  }

  // 3) AI 플랫폼별 최근 30일 채널 선호도
  const pref: any[] = await prisma.$queryRawUnsafe(`
    WITH all_src AS (
      SELECT r.ai_platform::text AS platform, src
      FROM ai_responses r,
      LATERAL (
        SELECT unnest(r.cited_sources) AS src
        UNION ALL
        SELECT r.cited_url WHERE r.cited_url IS NOT NULL
      ) s
      WHERE r.hospital_id = '${HOSPITAL_ID}' AND src IS NOT NULL AND src <> ''
        AND r.created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT platform, ${CHANNEL_CASE} AS channel, COUNT(*)::int AS cnt
    FROM all_src
    GROUP BY 1, 2
    HAVING COUNT(*) >= 10
    ORDER BY platform, cnt DESC
  `);
  console.log('\n=== 최근 30일: AI 플랫폼별 채널 선호 (10회 이상) ===');
  let cur = '';
  for (const p of pref) {
    if (p.platform !== cur) { cur = p.platform; console.log(`  [${cur}]`); }
    console.log(`    ${p.channel.padEnd(20)} ${String(p.cnt).padStart(5)}회`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
