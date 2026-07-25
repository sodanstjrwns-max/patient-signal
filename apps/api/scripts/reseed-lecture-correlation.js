/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  데모 시드 2단계 — 강의록 상관관계 주입
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 1단계(reseed-lecture-realistic.js)는 인용 도메인/검색모드/감성 분포를 맞췄다.
 * 그런데 isMentioned가 지역·언어·검색모드와 무관한 난수라서
 * 강의록의 핵심 주장들이 데모에서 전부 배율 1.0으로 납작하게 나온다.
 *
 * 강의록 실측 배율을 데모에 심는다:
 *   12·24번  동 46.6% vs 시 27.3% = 1.7배 / Gemini 3.0배
 *   13번     외국어 무주공산 (경쟁 적어 언급률 높음)
 *   28-②번   빅키워드(HARD) 질문에서는 SoV가 급락
 *   AEO/GEO  사전학습(GEO) 진입은 검색(AEO)보다 어렵다
 *   20번     '원장' 25.8% vs 실명 0.7%
 */
const { PrismaClient } = require('@prisma/client');
const {
  detectRegionLevel,
  classifyDifficulty,
  detectLanguage,
} = require('../dist/src/lecture-metrics/query-classifier');

const prisma = new PrismaClient();
const HOSPITAL_ID = process.argv[2] || '407323e8-9e64-4a0f-a620-1925bd84fba8';
const BATCH = 200;

// ── 강의록 실측 기반 기준 언급률 ──
// 지역 단위별 (동이 가장 높고 전국이 가장 낮다 = 강의록 12번)
const REGION_BASE = {
  DONG: 0.62,
  SIGUNGU: 0.365, // 0.62 / 1.7 ≒ 강의록 배율 재현
  SIDO: 0.27,
  NATIONWIDE: 0.11,
  NONE: 0.30,
};

// 플랫폼 보정 — Gemini는 GBP를 교과서로 쓰므로 동 단위 편애가 심하다(3.0배)
const PLATFORM_REGION_TWEAK = {
  GEMINI: { DONG: 1.18, SIGUNGU: 0.66, SIDO: 0.55, NATIONWIDE: 0.5, NONE: 1 },
  PERPLEXITY: { DONG: 1.05, SIGUNGU: 1.0, SIDO: 1.0, NATIONWIDE: 1.0, NONE: 1 },
  CHATGPT: { DONG: 1.0, SIGUNGU: 1.02, SIDO: 1.05, NATIONWIDE: 1.0, NONE: 1 },
  CLAUDE: { DONG: 0.92, SIGUNGU: 0.95, SIDO: 1.0, NATIONWIDE: 1.0, NONE: 1 },
};

// 난이도 보정 — 빅키워드에서 점유율이 급락해야 강의록 28-② 착시가 드러난다
const DIFFICULTY_MULT = { EASY: 1.28, MEDIUM: 1.0, HARD: 0.42 };

// 언어 보정 — 강의록 13번 다국어 무주공산 (경쟁자가 안 하니 우리가 먹는다)
const LANGUAGE_MULT = { KO: 1.0, EN: 1.42, ZH: 1.55, JA: 1.5, OTHER: 1.2 };

// 검색모드 보정 — GEO(사전학습) 진입이 AEO(검색)보다 훨씬 어렵다
const SEARCH_MULT = { AEO: 1.0, GEO: 0.42 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── 빅키워드(HARD) 질문 — 강의록 28-② 검증용 ──
// 데모에 HARD가 0건이라 "우리 실력이 진짜인가"를 물을 수 없었다.
const HARD_PROMPTS = [
  ['전국 임플란트 잘하는 치과 순위 알려줘', ['전국'], '임플란트', 'AUTO_GENERATED'],
  ['서울 임플란트 잘하는 치과 추천해줘', ['서울'], '임플란트', 'AUTO_GENERATED'],
  ['서울에서 치아교정 가장 유명한 치과 비교해줘', ['서울'], '교정', 'AUTO_GENERATED'],
  ['국내 치과 중 임플란트 성공률 높은 곳 비교 추천', ['국내'], '임플란트', 'AUTO_GENERATED'],
  ['서울 치과 중 시설 좋은 대형 치과 어디가 제일 나은지 비교해줘', ['서울'], '일반', 'AUTO_GENERATED'],
  ['Best dental implant clinics in Korea — compare top hospitals', ['Korea'], '외국인-임플란트', 'AUTO_GENERATED'],
];

const PLATFORMS = [
  ['CHATGPT', 'gpt-4o', 1.3],
  ['PERPLEXITY', 'sonar-pro', 1.2],
  ['CLAUDE', 'claude-sonnet-4', 1.1],
  ['GEMINI', 'gemini-2.5-pro', 1.4],
];

const COMPETITORS = [
  '강남 A치과', '역삼 B치과', 'C치과의원', '서울 D치과', 'E덴탈클리닉',
  '삼성동 F치과', '논현 G치과', 'H치과병원',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildResponseText(mentioned, position, hospitalName) {
  if (!mentioned) {
    const others = [pick(COMPETITORS), pick(COMPETITORS)];
    return `해당 지역에서는 ${others[0]}, ${others[1]} 등이 자주 언급됩니다. 상담 후 결정하시길 권합니다.`;
  }
  const others = [pick(COMPETITORS), pick(COMPETITORS)];
  if (position === 1) {
    return `${hospitalName}을(를) 먼저 추천합니다. 그 외 ${others[0]}, ${others[1]}도 후보로 볼 수 있습니다.`;
  }
  return `${others[0]}, ${hospitalName}, ${others[1]} 순으로 언급되는 편입니다. 각각 강점이 다릅니다.`;
}

async function main() {
  console.log('━'.repeat(60));
  console.log('데모 시드 2단계 — 강의록 상관관계 주입');
  console.log('━'.repeat(60));

  const hospital = await prisma.hospital.findUnique({ where: { id: HOSPITAL_ID } });
  if (!hospital) throw new Error(`병원을 찾을 수 없습니다: ${HOSPITAL_ID}`);
  console.log(`대상 병원: ${hospital.name}\n`);

  const dateRange = await prisma.aIResponse.aggregate({
    where: { hospitalId: HOSPITAL_ID },
    _min: { responseDate: true },
    _max: { responseDate: true },
  });
  const minDate = dateRange._min.responseDate;
  const maxDate = dateRange._max.responseDate;
  const dayCount = Math.max(
    1,
    Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1,
  );

  // ── ① 빅키워드 질문 + 응답 생성 (강의록 28-② 검증용) ──
  let createdPrompts = 0;
  let createdResponses = 0;

  for (const [text, kws, specialty, ptype] of HARD_PROMPTS) {
    const exists = await prisma.prompt.findFirst({
      where: { hospitalId: HOSPITAL_ID, promptText: text },
      select: { id: true },
    });
    if (exists) continue;

    const prompt = await prisma.prompt.create({
      data: {
        hospitalId: HOSPITAL_ID,
        promptText: text,
        promptType: ptype,
        specialtyCategory: specialty,
        regionKeywords: kws,
        isActive: true,
      },
    });
    createdPrompts++;

    // 각 플랫폼 × 기간에 걸쳐 응답 생성 (기존 밀도와 유사하게 프롬프트당 ~70건)
    const rows = [];
    const perPlatform = 18;
    for (const [platform, model, weight] of PLATFORMS) {
      for (let i = 0; i < perPlatform; i++) {
        const d = new Date(minDate.getTime() + Math.floor(Math.random() * dayCount) * 86400000);
        rows.push({ prompt, text, kws, platform, model, weight, date: d });
      }
    }

    const data = rows.map((r) => {
      const region = detectRegionLevel(r.text, r.kws);
      const diff = classifyDifficulty(r.text, r.kws);
      const lang = detectLanguage(r.text);
      const isWebSearch = Math.random() < 0.75;

      let rate = REGION_BASE[region] ?? 0.3;
      rate *= (PLATFORM_REGION_TWEAK[r.platform] || {})[region] ?? 1;
      rate *= DIFFICULTY_MULT[diff] ?? 1;
      rate *= LANGUAGE_MULT[lang] ?? 1;
      rate *= isWebSearch ? SEARCH_MULT.AEO : SEARCH_MULT.GEO;
      rate = clamp(rate, 0.02, 0.95);

      const isMentioned = Math.random() < rate;
      const totalRecommendations = isMentioned ? 3 + Math.floor(Math.random() * 3) : null;
      // 빅키워드에서는 1위를 잡기 어렵다 — 잡혀도 중하위권
      const mentionPosition = isMentioned
        ? Math.random() < 0.18
          ? 1
          : 2 + Math.floor(Math.random() * (totalRecommendations - 1))
        : null;

      let sentimentLabel = null,
        sentimentScoreV2 = null,
        sentimentScore = null,
        recommendationDepth = null,
        answerPositionType = null;
      if (isMentioned) {
        const roll = Math.random();
        if (roll < 0.11) {
          sentimentLabel = 'NEUTRAL';
          sentimentScoreV2 = 0;
          sentimentScore = 0.05;
          recommendationDepth = 'R1';
          answerPositionType = 'INFORMATION_CITE';
        } else {
          sentimentLabel = 'POSITIVE';
          const strong = mentionPosition === 1;
          sentimentScoreV2 = strong ? 2 : 1;
          sentimentScore = strong ? 0.82 : 0.52;
          recommendationDepth = strong ? 'R3' : 'R2';
          answerPositionType = strong ? 'PRIMARY_RECOMMEND' : 'COMPARISON_WINNER';
        }
      }

      return {
        promptId: r.prompt.id,
        archivedPromptText: r.text,
        hospitalId: HOSPITAL_ID,
        aiPlatform: r.platform,
        aiModelVersion: r.model,
        responseText: buildResponseText(isMentioned, mentionPosition, hospital.name),
        responseDate: r.date,
        isMentioned,
        mentionPosition,
        totalRecommendations,
        sentimentScore,
        sentimentLabel,
        sentimentScoreV2,
        recommendationDepth,
        answerPositionType,
        queryIntent: 'COMPARISON',
        platformWeight: r.weight,
        citedSources: [],
        competitorsMentioned: [pick(COMPETITORS), pick(COMPETITORS)],
        isWebSearch,
        isVerified: true,
      };
    });

    for (let i = 0; i < data.length; i += BATCH) {
      await prisma.aIResponse.createMany({ data: data.slice(i, i + BATCH) });
    }
    createdResponses += data.length;
  }
  console.log(`✅ 빅키워드 질문 ${createdPrompts}개 / 응답 ${createdResponses}건 생성\n`);

  // ── ② 기존 응답 전체의 isMentioned를 강의록 상관에 맞춰 재배분 ──
  const prompts = await prisma.prompt.findMany({
    where: { hospitalId: HOSPITAL_ID },
    select: { id: true, promptText: true, regionKeywords: true },
  });
  const meta = new Map(
    prompts.map((p) => [
      p.id,
      {
        region: detectRegionLevel(p.promptText, p.regionKeywords),
        diff: classifyDifficulty(p.promptText, p.regionKeywords),
        lang: detectLanguage(p.promptText),
      },
    ]),
  );

  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: HOSPITAL_ID },
    select: {
      id: true,
      promptId: true,
      archivedPromptText: true,
      aiPlatform: true,
      isWebSearch: true,
      totalRecommendations: true,
    },
  });
  console.log(`재배분 대상: ${responses.length} 건`);

  let batch = [];
  let updated = 0;
  const flush = async () => {
    if (!batch.length) return;
    await prisma.$transaction(batch);
    updated += batch.length;
    batch = [];
  };

  const tally = {};

  for (const r of responses) {
    const m = meta.get(r.promptId) || {
      region: detectRegionLevel(r.archivedPromptText || '', []),
      diff: classifyDifficulty(r.archivedPromptText || '', []),
      lang: detectLanguage(r.archivedPromptText || ''),
    };

    let rate = REGION_BASE[m.region] ?? 0.3;
    rate *= (PLATFORM_REGION_TWEAK[r.aiPlatform] || {})[m.region] ?? 1;
    rate *= DIFFICULTY_MULT[m.diff] ?? 1;
    rate *= LANGUAGE_MULT[m.lang] ?? 1;
    rate *= r.isWebSearch ? SEARCH_MULT.AEO : SEARCH_MULT.GEO;
    rate = clamp(rate, 0.02, 0.95);

    const isMentioned = Math.random() < rate;
    const key = `${m.region}/${m.diff}/${m.lang}`;
    tally[key] = tally[key] || { n: 0, hit: 0 };
    tally[key].n++;
    if (isMentioned) tally[key].hit++;

    const total = isMentioned ? r.totalRecommendations || 3 + Math.floor(Math.random() * 3) : null;
    // 좁은 지역(DONG)일수록 1위를 잡기 쉽다 — 강의록 12번의 연장
    const firstOdds = m.region === 'DONG' ? 0.52 : m.region === 'SIGUNGU' ? 0.4 : 0.22;
    const mentionPosition = isMentioned
      ? Math.random() < firstOdds
        ? 1
        : 2 + Math.floor(Math.random() * Math.max(1, total - 1))
      : null;

    batch.push(
      prisma.aIResponse.update({
        where: { id: r.id },
        data: { isMentioned, mentionPosition, totalRecommendations: total },
      }),
    );
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`✅ 언급 여부 재배분: ${updated}건\n`);

  // ── ③ 감성 정합성 재보정 (언급 여부가 바뀌었으므로) ──
  const mentioned = await prisma.aIResponse.findMany({
    where: { hospitalId: HOSPITAL_ID, isMentioned: true },
    select: { id: true, mentionPosition: true },
    orderBy: { id: 'asc' },
  });
  const negTarget = Math.max(1, Math.round(mentioned.length * 0.001));
  const neuTarget = Math.round(mentioned.length * 0.11);
  console.log(
    `감성 목표: 언급 ${mentioned.length}건 중 부정 ${negTarget}(0.1%) / 중립 ${neuTarget}(11%)`,
  );

  batch = [];
  updated = 0;
  for (let i = 0; i < mentioned.length; i++) {
    const m = mentioned[i];
    let d;
    if (i < negTarget) {
      d = {
        sentimentLabel: 'NEGATIVE',
        sentimentScoreV2: -2,
        sentimentScore: -0.7,
        recommendationDepth: 'R0',
        answerPositionType: 'NEGATIVE',
      };
    } else if (i < negTarget + neuTarget) {
      d = {
        sentimentLabel: 'NEUTRAL',
        sentimentScoreV2: 0,
        sentimentScore: 0.05,
        recommendationDepth: 'R1',
        answerPositionType: 'INFORMATION_CITE',
      };
    } else {
      const strong = m.mentionPosition === 1;
      d = {
        sentimentLabel: 'POSITIVE',
        sentimentScoreV2: strong ? 2 : 1,
        sentimentScore: strong ? 0.85 : 0.55,
        recommendationDepth: strong ? 'R3' : 'R2',
        answerPositionType: strong ? 'PRIMARY_RECOMMEND' : 'COMPARISON_WINNER',
      };
    }
    batch.push(prisma.aIResponse.update({ where: { id: m.id }, data: d }));
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`✅ 감성 재배분: ${updated}건\n`);

  // 미언급은 감성 없음
  const cleared = await prisma.aIResponse.updateMany({
    where: { hospitalId: HOSPITAL_ID, isMentioned: false },
    data: {
      sentimentLabel: null,
      sentimentScoreV2: null,
      sentimentScore: null,
      recommendationDepth: null,
      answerPositionType: null,
    },
  });
  console.log(`✅ 미언급 ${cleared.count}건 감성 초기화\n`);

  // ── ④ 원장 실명/직함 언급 주입 (강의록 20번: 직함 25.8% / 실명 0.7%) ──
  const strengths = hospital.hospitalStrengths || [];
  const nameMatch = strengths
    .join(' ')
    .match(/([가-힣]{2,4})\s*(대표원장|병원장|원장)/);
  const doctorName = nameMatch ? nameMatch[1] : '문석준';

  const pos = await prisma.aIResponse.findMany({
    where: { hospitalId: HOSPITAL_ID, isMentioned: true },
    select: { id: true, responseText: true },
    orderBy: { id: 'asc' },
  });
  const titleTarget = Math.round(pos.length * 0.258);
  const nameTarget = Math.max(1, Math.round(pos.length * 0.007));

  batch = [];
  updated = 0;
  for (let i = 0; i < pos.length; i++) {
    const r = pos[i];
    let text = r.responseText
      .replace(new RegExp(`\\s*${doctorName}\\s*(대표원장|원장)[^.]*\\.`, 'g'), '')
      .replace(/\s*원장님?이 직접[^.]*\./g, '');
    if (i < nameTarget) {
      // 실명 + 직함 (가장 귀한 케이스)
      text += ` ${doctorName} 대표원장이 직접 진료한다는 후기가 있습니다.`;
    } else if (i < titleTarget) {
      // 직함만 (일반명사)
      text += ' 원장님이 직접 상담한다는 언급이 있습니다.';
    }
    if (text !== r.responseText) {
      batch.push(prisma.aIResponse.update({ where: { id: r.id }, data: { responseText: text } }));
    }
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log(`✅ 원장 언급 주입: ${updated}건 (직함 ${titleTarget} / 실명 ${nameTarget})\n`);

  // ── 검증 ──
  console.log('━'.repeat(60));
  console.log('검증 결과');
  console.log('━'.repeat(60));

  const byRegion = {};
  for (const [key, v] of Object.entries(tally)) {
    const region = key.split('/')[0];
    byRegion[region] = byRegion[region] || { n: 0, hit: 0 };
    byRegion[region].n += v.n;
    byRegion[region].hit += v.hit;
  }
  console.log('지역 단위별 언급률 (강의록 12번):');
  for (const [k, v] of Object.entries(byRegion)) {
    console.log(`  ${k.padEnd(11)} n=${String(v.n).padStart(5)}  ${((v.hit / v.n) * 100).toFixed(1)}%`);
  }
  if (byRegion.DONG && byRegion.SIGUNGU) {
    const ratio =
      byRegion.DONG.hit / byRegion.DONG.n / (byRegion.SIGUNGU.hit / byRegion.SIGUNGU.n);
    console.log(`  → 동/구 배율 ${ratio.toFixed(2)}배 (강의록 실측 1.7배)`);
  }

  const total = await prisma.aIResponse.count({ where: { hospitalId: HOSPITAL_ID } });
  const men = await prisma.aIResponse.count({
    where: { hospitalId: HOSPITAL_ID, isMentioned: true },
  });
  console.log(`\n전체 ${total}건 / 언급 ${men}건 (${((men / total) * 100).toFixed(1)}%)`);

  const sent = await prisma.aIResponse.groupBy({
    by: ['sentimentLabel'],
    where: { hospitalId: HOSPITAL_ID },
    _count: { _all: true },
  });
  console.log('감성:', JSON.stringify(Object.fromEntries(sent.map((s) => [s.sentimentLabel, s._count._all]))));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌', e);
  await prisma.$disconnect();
  process.exit(1);
});
