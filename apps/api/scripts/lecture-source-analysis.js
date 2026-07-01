// ============================================================
// 강의용 출처 분석 — "AI가 한국 병원을 추천할 때 어디서 정보를 긁어오는가"
// 96,000+ 응답을 전수 분석해서 출처 도메인 / 플랫폼별 차이 / 키워드 집계
// 결과를 lecture-source-report.json 으로 저장
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

// URL → 깨끗한 도메인 추출
function extractDomain(url) {
  if (!url) return null;
  try {
    let u = url.trim();
    // Gemini redirect는 실제 도메인이 title에 있으므로 여기선 redirect 제외
    if (u.includes('vertexaisearch.cloud.google.com')) return null;
    if (!u.startsWith('http')) u = 'https://' + u;
    const host = new URL(u).hostname.replace(/^www\./, '');
    return host || null;
  } catch { return null; }
}

// 도메인을 사람이 읽는 출처 카테고리로 정규화
function categorize(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();
  const map = [
    [/(^|\.)blog\.naver|m\.blog\.naver|naver\.com\/.*blog/, '네이버 블로그'],
    [/(^|\.)naver\.com/, '네이버 (플레이스/지식인 등)'],
    [/(^|\.)modoodoc\.com/, '모두닥(modoodoc)'],
    [/(^|\.)kakao|daum\.net/, '카카오/다음'],
    [/(^|\.)youtube\.com|youtu\.be/, '유튜브'],
    [/(^|\.)instagram\.com/, '인스타그램'],
    [/(^|\.)goodoc|ddoctor|gangnamunni|babitalk|여신티켓|yeoshin/, '의료 플랫폼(굿닥/강남언니 등)'],
    [/(^|\.)tistory\.com/, '티스토리 블로그'],
    [/(^|\.)medium\.com/, 'Medium'],
    [/(^|\.)wikipedia\.org/, '위키피디아'],
    [/(^|\.)hira\.or\.kr|mohw\.go\.kr|kdca|go\.kr/, '정부/공공기관'],
    [/(^|\.)dental|치과|덴탈|clinic|hospital|병원|.*\.com$/, null], // 병원자체홈페이지는 도메인 그대로
  ];
  for (const [re, label] of map) if (re.test(d)) return label || domain;
  return domain;
}

(async () => {
  const BATCH = 5000;
  let skip = 0;
  const domainCount = {};        // 정규화된 도메인 카운트
  const categoryCount = {};      // 카테고리 카운트
  const platformDomain = {};     // 플랫폼별 카테고리 카운트
  const hintKeywordCount = {};   // ChatGPT 등 추정 출처 키워드
  let processed = 0, withRealSource = 0, withHintOnly = 0;

  // 플랫폼별 응답수
  const platforms = ['CHATGPT', 'CLAUDE', 'GEMINI', 'PERPLEXITY', 'GROK', 'CLOVAX'];
  const platformTotal = {};

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { aiPlatform: true, citedSources: true, sourceHints: true },
      orderBy: { id: 'asc' },
      skip, take: BATCH,
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      processed++;
      const p = r.aiPlatform;
      platformTotal[p] = (platformTotal[p] || 0) + 1;
      platformDomain[p] = platformDomain[p] || {};

      const cats = new Set();   // 이 응답에서 등장한 카테고리(중복 방지)
      let hadReal = false;

      // 1) citedSources (Perplexity 등 직접 URL)
      for (const url of (r.citedSources || [])) {
        const dom = extractDomain(url);
        const cat = categorize(dom);
        if (cat) { cats.add(cat); hadReal = true; }
      }
      // 2) sourceHints.sources[].title/domain (Gemini 실제 도메인은 title에)
      const sh = r.sourceHints;
      if (sh && typeof sh === 'object') {
        for (const s of (sh.sources || [])) {
          // title이 도메인 형태면 그것을, 아니면 domain 필드
          let dom = extractDomain(s.url);
          if (!dom && s.title && /\./.test(s.title)) dom = s.title.replace(/^www\./, '');
          if (!dom && s.domain && !s.domain.includes('vertexaisearch')) dom = s.domain;
          const cat = categorize(dom);
          if (cat) { cats.add(cat); hadReal = true; }
        }
        // 3) 추정 출처 키워드 (ChatGPT 등 URL 없이 힌트만)
        for (const kw of (sh.hintKeywords || sh.estimatedSources || [])) {
          hintKeywordCount[kw] = (hintKeywordCount[kw] || 0) + 1;
        }
      }

      for (const c of cats) {
        categoryCount[c] = (categoryCount[c] || 0) + 1;
        platformDomain[p][c] = (platformDomain[p][c] || 0) + 1;
      }
      if (hadReal) withRealSource++; else withHintOnly++;
    }
    skip += BATCH;
    if (processed % 20000 === 0) console.log(`...${processed}건 처리`);
  }

  // 정렬 헬퍼
  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

  const report = {
    generatedAt: new Date().toISOString(),
    totalResponses: processed,
    withRealSourceUrl: withRealSource,
    withHintKeywordsOnly: withHintOnly,
    platformTotal,
    topSourceCategories: top(categoryCount, 20),
    topHintKeywords: top(hintKeywordCount, 20),
    byPlatform: Object.fromEntries(Object.entries(platformDomain).map(([p, obj]) => [p, top(obj, 10)])),
  };
  fs.writeFileSync('scripts/lecture-source-report.json', JSON.stringify(report, null, 2));

  // 콘솔 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log(`강의용 출처 분석 완료 — 총 ${processed.toLocaleString()}건`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n실제 출처 URL 보유: ${withRealSource.toLocaleString()} / 추정 힌트만: ${withHintOnly.toLocaleString()}\n`);
  console.log('■ AI가 가장 많이 참조하는 출처 TOP 15');
  top(categoryCount, 15).forEach(([k, v], i) => console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(28)} ${v.toLocaleString()}건 (${(v/processed*100).toFixed(1)}%)`));
  console.log('\n■ ChatGPT 등 추정 출처 키워드 TOP 12');
  top(hintKeywordCount, 12).forEach(([k, v], i) => console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(20)} ${v.toLocaleString()}건`));
  console.log('\n■ 플랫폼별 응답수');
  Object.entries(platformTotal).sort((a,b)=>b[1]-a[1]).forEach(([p, v]) => console.log(`  ${p.padEnd(12)} ${v.toLocaleString()}건`));
  console.log(`\n→ 상세: scripts/lecture-source-report.json`);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
