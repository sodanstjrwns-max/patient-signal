/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  데모 데이터를 강의록 실측 분포로 교정
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 【왜 필요한가】
 *  기존 데모 1,701건은 아래 3가지가 비현실적이라 Batch A 지표가 전부 무의미하게 나온다:
 *    ① citedSources 도메인이 example.com 1종 → 채널 효율/포트폴리오 계산 불가
 *    ② isWebSearch 전부 false → AEO/GEO 분리 불가
 *    ③ 부정 감성 407건(24%) → 강의록 실측 0.1%와 240배 차이. 부정 경보가 노이즈가 됨
 *
 * 【강의록 실측 기준】
 *  - 채널 분포: 25번 60일 42만건 (인스타 61,827 / 네이버블로그 5,561 / 틱톡 4,187 /
 *               유튜브 3,420 / 나무위키 2,918 / 티스토리 2,319 / 카페 310 ...)
 *  - 의료 플랫폼: 23번 (모두닥 2,841 / 마이닥터 1,374 / 굿닥 883 / 강남언니 290)
 *  - 감성: 29번 긍정 88.9 / 중립 11.0 / 부정 0.1
 *  - 동반율: 26번 (카페 82% / 강남언니 61% / PBN 9%)
 *  - PBN: 31번 (expertguidetoday.org 395회 동반율 9% — Perplexity 몰빵)
 *
 * 사용: node scripts/reseed-lecture-realistic.js [hospitalId]
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HOSPITAL_ID = process.argv[2] || '407323e8-9e64-4a0f-a620-1925bd84fba8';

/**
 * 채널 풀 — [도메인, 상대 가중치, 동반율(0~1), 인용될 수 있는 플랫폼]
 * 가중치는 강의록 42만건 분포의 상대 비율을 반영
 */
const CHANNEL_POOL = [
  // ── 물량 파도 (강의록 25번 상위) ──
  ['instagram.com',        620, 0.34, ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI']],
  ['blog.naver.com',        56, 0.41, ['PERPLEXITY', 'CHATGPT']], // 해외 3강은 네이버 거의 못 긁음
  ['tiktok.com',            42, 0.28, ['CHATGPT', 'PERPLEXITY', 'GEMINI']],
  ['youtube.com',           34, 0.37, ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI']],
  ['tistory.com',           23, 0.30, ['PERPLEXITY', 'CHATGPT']],
  ['facebook.com',          12, 0.25, ['CHATGPT', 'GEMINI']],
  ['threads.net',            5, 0.22, ['CHATGPT']],

  // ── 고효율 저격수: 위키형 (강의록 25번 반전 사례) ──
  ['namu.wiki',             29, 0.58, ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI']],
  ['ko.wikipedia.org',       6, 0.44, ['CHATGPT', 'CLAUDE', 'GEMINI']],

  // ── 고효율 저격수: 의료 플랫폼 (강의록 23번 "의료 플랫폼이 왕") ──
  ['modoodoc.com',          52, 0.72, ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI']],
  ['my-doctor.io',          25, 0.66, ['CHATGPT', 'PERPLEXITY', 'GEMINI']],
  ['goodoc.co.kr',          16, 0.63, ['CHATGPT', 'PERPLEXITY', 'GEMINI']],
  ['gangnamunni.com',        9, 0.61, ['CHATGPT', 'PERPLEXITY']], // 강의록 실측 동반율 61%
  ['hidoc.co.kr',            8, 0.55, ['CHATGPT', 'CLAUDE']],
  ['114.co.kr',             10, 0.69, ['GEMINI', 'CHATGPT']],

  // ── 본진 (자사 홈페이지 · 강의록 2번) ──
  ['seoulbd.co.kr',         38, 0.94, ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI']],

  // ── 로컬 플레이스 (강의록 24번 GBP=Gemini 교과서) ──
  ['maps.google.com',       22, 0.78, ['GEMINI']],           // Gemini 전용
  ['map.naver.com',          7, 0.52, ['PERPLEXITY']],

  // ── 카페 (강의록 26번 동반율 82%) ──
  ['cafe.naver.com',         6, 0.82, ['PERPLEXITY']],

  // ── 공공/학회 ──
  ['hira.or.kr',             5, 0.31, ['CHATGPT', 'CLAUDE']],
  ['kda.or.kr',              4, 0.35, ['CLAUDE', 'CHATGPT']],

  // ── 뉴스 ──
  ['dailymedi.com',          7, 0.42, ['CHATGPT', 'PERPLEXITY']],
  ['chosun.com',             5, 0.29, ['CHATGPT', 'CLAUDE']],

  // ── 해외 디렉토리 (강의록 13번 무주공산) ──
  ['konest.com',             3, 0.71, ['CHATGPT', 'GEMINI']],
  ['bookimed.com',           3, 0.68, ['CHATGPT', 'PERPLEXITY']],

  // ── PBN 위성사이트 (강의록 31번 — Perplexity 몰빵 + 동반율 9%) ──
  ['expertguidetoday.org',  40, 0.09, ['PERPLEXITY']],
  ['openlearningjournal.org', 28, 0.13, ['PERPLEXITY']],
  ['openinsightcenter.xyz',  17, 0.11, ['PERPLEXITY']],

  // ── 경쟁 병원 홈페이지 ──
  ['gangnam-smile-dental.co.kr', 9, 0.12, ['CHATGPT', 'PERPLEXITY', 'GEMINI']],
  ['yeoksam-white.com',      6, 0.10, ['CHATGPT', 'PERPLEXITY']],
];

/** 플랫폼별 인용 가능 채널 인덱스 사전 계산 */
function buildPlatformPools() {
  const pools = {};
  for (const [domain, weight, companion, platforms] of CHANNEL_POOL) {
    for (const p of platforms) {
      if (!pools[p]) pools[p] = [];
      pools[p].push({ domain, weight, companion });
    }
  }
  // 누적 가중치
  for (const p of Object.keys(pools)) {
    let acc = 0;
    for (const c of pools[p]) {
      acc += c.weight;
      c.cum = acc;
    }
    pools[p].total = acc;
  }
  return pools;
}

function pickChannel(pool) {
  const r = Math.random() * pool.total;
  for (const c of pool) {
    if (r <= c.cum) return c;
  }
  return pool[pool.length - 1];
}

/** URL 경로 생성 — 채널 성격에 맞게 */
function makeUrl(domain) {
  const rid = Math.random().toString(36).slice(2, 10);
  if (domain === 'instagram.com') return `https://instagram.com/p/${rid}/`;
  if (domain === 'tiktok.com') return `https://tiktok.com/@user${rid.slice(0, 4)}/video/${Date.now() % 1e10}`;
  if (domain === 'youtube.com') return `https://youtube.com/watch?v=${rid}`;
  if (domain === 'blog.naver.com') return `https://blog.naver.com/user${rid.slice(0, 5)}/${220000000 + Math.floor(Math.random() * 9999999)}`;
  if (domain === 'cafe.naver.com') return `https://cafe.naver.com/momcafe/${Math.floor(Math.random() * 900000)}`;
  if (domain === 'namu.wiki') return `https://namu.wiki/w/${encodeURIComponent('임플란트')}`;
  if (domain === 'ko.wikipedia.org') return `https://ko.wikipedia.org/wiki/${encodeURIComponent('치과')}`;
  if (domain === 'maps.google.com') return `https://maps.google.com/maps/place/?q=place_id:${rid}`;
  if (domain === 'map.naver.com') return `https://map.naver.com/p/entry/place/${Math.floor(Math.random() * 9e8)}`;
  if (domain === 'modoodoc.com') return `https://modoodoc.com/hospitals/${Math.floor(Math.random() * 90000)}`;
  if (domain === 'seoulbd.co.kr') {
    const paths = ['/implant', '/ortho', '/faq', '/price', '/doctors', '/reviews', '/whitening'];
    return `https://seoulbd.co.kr${paths[Math.floor(Math.random() * paths.length)]}`;
  }
  return `https://${domain}/${rid}`;
}

async function main() {
  console.log('━'.repeat(60));
  console.log('데모 데이터 → 강의록 실측 분포 교정');
  console.log('━'.repeat(60));

  const hospital = await prisma.hospital.findUnique({
    where: { id: HOSPITAL_ID },
    select: { id: true, name: true, websiteUrl: true, hospitalStrengths: true },
  });
  if (!hospital) {
    console.error('❌ 병원을 찾을 수 없습니다:', HOSPITAL_ID);
    process.exit(1);
  }
  console.log('대상 병원:', hospital.name);

  const pools = buildPlatformPools();

  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: HOSPITAL_ID },
    select: {
      id: true,
      aiPlatform: true,
      isMentioned: true,
      sentimentLabel: true,
      sentimentScoreV2: true,
      recommendationDepth: true,
    },
    take: 20000,
  });
  console.log('교정 대상 응답:', responses.length, '건\n');

  // ── ① 감성 재배분 (강의록 29번: 긍정 88.9 / 중립 11.0 / 부정 0.1) ──
  // 언급된 응답만 감성 의미가 있음
  const mentioned = responses.filter((r) => r.isMentioned);
  const negativeTarget = Math.max(1, Math.round(mentioned.length * 0.001)); // 0.1%
  const neutralTarget = Math.round(mentioned.length * 0.11);
  console.log(
    `감성 목표: 언급 ${mentioned.length}건 중 부정 ${negativeTarget}건(0.1%) / 중립 ${neutralTarget}건(11%) / 나머지 긍정`,
  );

  // 결정적 셔플 (재현 가능하게 id 정렬 후 인덱스로 배분)
  const sortedMentioned = [...mentioned].sort((a, b) => a.id.localeCompare(b.id));

  let updates = 0;
  const BATCH = 200;
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(batch);
    updates += batch.length;
    batch = [];
  };

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const pool = pools[r.aiPlatform];

    // ── ② 인용 출처 재생성 ──
    let citedSources = [];
    let citedUrl = null;
    let sourceHints = undefined;

    if (pool) {
      // 응답당 인용 0~4개 (Perplexity는 더 많이)
      const maxCites = r.aiPlatform === 'PERPLEXITY' ? 5 : r.aiPlatform === 'GEMINI' ? 4 : 3;
      const n = Math.floor(Math.random() * (maxCites + 1));
      const chosen = new Set();
      for (let k = 0; k < n; k++) {
        const c = pickChannel(pool);
        // 동반율 반영: 우리 병원이 언급된 응답일수록 동반율 높은 채널이 뽑히게 편향
        // (언급 X 응답에서 동반율 높은 채널이 뽑히면 부자연스러움)
        if (r.isMentioned) {
          if (Math.random() > c.companion * 0.9 + 0.1) continue;
        } else {
          if (Math.random() < c.companion * 0.75) continue;
        }
        chosen.add(c.domain);
      }
      citedSources = [...chosen].map(makeUrl);

      // Gemini는 리다이렉트 URL + sourceHints 구조를 씀 (실제 동작 재현)
      if (r.aiPlatform === 'GEMINI' && citedSources.length > 0) {
        const realDomains = [...chosen];
        sourceHints = {
          sources: realDomains.map((d) => ({
            url: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${Math.random()
              .toString(36)
              .slice(2, 14)}`,
            title: d, // ⚠️ Gemini는 title 필드에 실도메인이 들어옴 (extractRealDomain이 여기서 복원)
            domain: 'vertexaisearch.cloud.google.com',
            type: 'web',
          })),
        };
        citedSources = realDomains.map(
          () =>
            `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${Math.random()
              .toString(36)
              .slice(2, 14)}`,
        );
      }

      if (r.aiPlatform === 'PERPLEXITY' && citedSources.length > 0) {
        citedUrl = citedSources[0];
      }
    }

    // ── ③ isWebSearch 재배분 ──
    // 강의록: AEO(실시간 검색)가 주력이지만 GEO(사전학습) 진입 자산도 일부 존재해야
    // 두 축을 비교할 수 있다. 검색 모드 75% / 비검색 25%.
    // 비검색 모드에서는 언급률이 낮아야 현실적 (모델이 아직 우리를 잘 모름)
    const isWebSearch = Math.random() < 0.75;

    // ── ④ 감성 재배분 ──
    const data = { citedSources, citedUrl, isWebSearch };
    if (sourceHints) data.sourceHints = sourceHints;

    batch.push(prisma.aIResponse.update({ where: { id: r.id }, data }));
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`✅ 인용/검색모드 교정: ${updates}건\n`);

  // ── 감성은 별도 패스로 처리 (인덱스 맵 사용) ──
  const rankMap = new Map(sortedMentioned.map((m, i) => [m.id, i]));
  let sentBatch = [];
  let sentUpdates = 0;
  const flushSent = async () => {
    if (sentBatch.length === 0) return;
    await prisma.$transaction(sentBatch);
    sentUpdates += sentBatch.length;
    sentBatch = [];
  };

  for (const m of sortedMentioned) {
    const rank = rankMap.get(m.id);
    let sentimentLabel, sentimentScoreV2, sentimentScore, recommendationDepth, answerPositionType;

    if (rank < negativeTarget) {
      // 부정 (0.1%) — 강의록 29번: 드물지만 치명적
      sentimentLabel = 'NEGATIVE';
      sentimentScoreV2 = -2;
      sentimentScore = -0.7;
      recommendationDepth = 'R0';
      answerPositionType = 'NEGATIVE';
    } else if (rank < negativeTarget + neutralTarget) {
      // 중립 (11%)
      sentimentLabel = 'NEUTRAL';
      sentimentScoreV2 = 0;
      sentimentScore = 0.05;
      recommendationDepth = 'R1';
      answerPositionType = 'INFORMATION_CITE';
    } else {
      // 긍정 (88.9%)
      sentimentLabel = 'POSITIVE';
      const strong = Math.random() < 0.35;
      sentimentScoreV2 = strong ? 2 : 1;
      sentimentScore = strong ? 0.85 : 0.55;
      recommendationDepth = strong ? 'R3' : 'R2';
      answerPositionType = strong ? 'PRIMARY_RECOMMEND' : 'COMPARISON_WINNER';
    }

    sentBatch.push(
      prisma.aIResponse.update({
        where: { id: m.id },
        data: {
          sentimentLabel,
          sentimentScoreV2,
          sentimentScore,
          recommendationDepth,
          answerPositionType,
        },
      }),
    );
    if (sentBatch.length >= BATCH) await flushSent();
  }
  await flushSent();
  console.log(`✅ 감성 재배분: ${sentUpdates}건 (부정 ${negativeTarget} / 중립 ${neutralTarget})\n`);

  // ── ⑤ 미언급 응답의 감성 정리 ──
  const notMentioned = responses.filter((r) => !r.isMentioned).map((r) => r.id);
  if (notMentioned.length > 0) {
    await prisma.aIResponse.updateMany({
      where: { id: { in: notMentioned } },
      data: {
        sentimentLabel: null,
        sentimentScoreV2: null,
        sentimentScore: null,
        recommendationDepth: 'R0',
        answerPositionType: null,
      },
    });
    console.log(`✅ 미언급 ${notMentioned.length}건 감성 초기화\n`);
  }

  // ── ⑥ 원장 실명 등록 (강의록 20번 측정 가능하게) ──
  if (!hospital.hospitalStrengths?.some((s) => /원장/.test(s))) {
    await prisma.hospital.update({
      where: { id: HOSPITAL_ID },
      data: {
        hospitalStrengths: [
          ...(hospital.hospitalStrengths || []),
          '문석준 대표원장 (서울대 치의학 석사, 통합치의학과 전문의)',
        ],
      },
    });
    console.log('✅ 원장 실명 등록 (강의록 20번 측정용)\n');
  }

  // ── 검증 ──
  const verify = await prisma.aIResponse.findMany({
    where: { hospitalId: HOSPITAL_ID },
    select: { citedSources: true, sourceHints: true, aiPlatform: true, isWebSearch: true, sentimentLabel: true },
    take: 20000,
  });
  const dom = new Map();
  let ws = 0;
  for (const r of verify) {
    if (r.isWebSearch) ws++;
    if (r.aiPlatform === 'GEMINI' && r.sourceHints?.sources) {
      for (const s of r.sourceHints.sources) dom.set(s.title, (dom.get(s.title) || 0) + 1);
    } else {
      for (const u of r.citedSources || []) {
        try {
          const h = new URL(u).hostname.replace(/^www\./, '');
          dom.set(h, (dom.get(h) || 0) + 1);
        } catch {}
      }
    }
  }
  console.log('━'.repeat(60));
  console.log('검증 결과');
  console.log('━'.repeat(60));
  console.log('도메인 종류:', dom.size);
  console.log('Top 12:', [...dom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
  console.log(`isWebSearch: ${ws} / ${verify.length} (${Math.round((ws / verify.length) * 100)}%)`);
  const sc = {};
  for (const r of verify) sc[r.sentimentLabel || 'null'] = (sc[r.sentimentLabel || 'null'] || 0) + 1;
  console.log('감성:', sc);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
