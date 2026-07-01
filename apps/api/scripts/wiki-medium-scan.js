// ============================================================
// 위키백과/위키피디아/나무위키/미디엄 등 '백과·지식 플랫폼' 출처 전수 스캔
//   - 전체 / 비디 / 일반 구분
//   - 플랫폼(AI)별 분포
//   - 응답수(중복제거) 기준 + 누적 인용 기준
// 결과: scripts/wiki-medium.json
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const BIDI_IDS = new Set([
  '72c4af8e-6d9e-4cc7-82f7-bce0e4de26a4',
  '14f79d64-70a5-4ee1-9c48-8690b6b0e9d9',
  '2a6776fd-a4ae-4022-9331-7a62810988aa',
  '7f7ca2d7-f9dd-41ce-a85a-ef3e5730f6f9',
  'a4d45d24-d798-42d9-aebf-44ebfa032f6b',
]);

// 백과/지식 플랫폼 분류 패턴 (도메인 소문자 기준)
function classifyKnowledge(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();
  if (d === 'namu.wiki' || d.endsWith('.namu.wiki')) return 'namu.wiki(나무위키)';
  if (d.includes('wikipedia.org')) {
    if (d.startsWith('ko.')) return 'ko.wikipedia.org(한국어 위키백과)';
    if (d.startsWith('en.')) return 'en.wikipedia.org(영어 위키백과)';
    return 'wikipedia.org(기타 언어 위키백과)';
  }
  if (d.includes('wikimedia.org')) return 'wikimedia.org';
  if (d === 'wiki.namu.moe' || d.includes('liberty.wiki') || d.includes('fandom.com') || d.includes('wikidok')) return 'wiki(기타 위키)';
  if (d === 'medium.com' || d.endsWith('.medium.com')) return 'medium.com(미디엄)';
  if (d.includes('brunch.co.kr')) return 'brunch.co.kr(브런치-참고)';
  // 그 외에 'wiki' 들어간 도메인은 따로 모아 점검
  if (d.includes('wiki')) return 'OTHER_wiki:' + d;
  return null;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    let u = String(url).trim();
    if (u.includes('vertexaisearch.cloud.google.com')) return null;
    if (!u.startsWith('http')) u = 'https://' + u;
    return new URL(u).hostname.replace(/^www\./, '') || null;
  } catch { return null; }
}

function collectUrls(r) {
  const urls = [];
  if (r.citedUrl) urls.push(r.citedUrl);
  for (const u of (r.citedSources || [])) urls.push(u);
  const sh = r.sourceHints;
  if (sh && typeof sh === 'object') {
    for (const s of (sh.sources || [])) {
      if (s.url) urls.push(s.url);
      if (s.title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s.title).trim())) urls.push('https://' + String(s.title).trim());
      if (s.domain && !String(s.domain).includes('vertexaisearch')) urls.push('https://' + String(s.domain).trim());
    }
  }
  return urls;
}

const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

(async () => {
  const BATCH = 2000;
  let cursor = null, processed = 0;

  // 누적 인용 (URL 단위)
  const allCum = {}, bidiCum = {}, restCum = {};
  // 응답 단위 (한 응답에 같은 분류 여러번 나와도 1)
  const allResp = {}, bidiResp = {}, restResp = {};
  // 플랫폼(AI)별 응답 단위
  const byPlatform = {}; // platform -> {category -> respCount}
  // 기타 wiki 도메인 샘플
  const otherWikiSamples = {};

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { id: true, hospitalId: true, aiPlatform: true, citedSources: true, citedUrl: true, sourceHints: true },
      orderBy: { id: 'asc' }, take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      const isBidi = BIDI_IDS.has(r.hospitalId);
      const urls = collectUrls(r);
      const respCats = new Set();
      for (const u of urls) {
        const dom = extractDomain(u);
        const cat = classifyKnowledge(dom);
        if (!cat) continue;
        // 누적
        inc(allCum, cat);
        inc(isBidi ? bidiCum : restCum, cat);
        respCats.add(cat);
        if (cat.startsWith('OTHER_wiki:')) {
          otherWikiSamples[dom] = (otherWikiSamples[dom] || 0) + 1;
        }
      }
      for (const cat of respCats) {
        inc(allResp, cat);
        inc(isBidi ? bidiResp : restResp, cat);
        const p = r.aiPlatform || 'UNKNOWN';
        byPlatform[p] = byPlatform[p] || {};
        inc(byPlatform[p], cat);
      }
    }

    processed += rows.length;
    if (processed % 20000 === 0) console.error('processed', processed);
  }

  const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  const out = {
    generatedAt: new Date().toISOString(),
    totalProcessed: processed,
    note: 'cum=누적 URL 인용 횟수, resp=등장한 고유 응답 수(중복제거)',
    knowledgePlatforms_resp: sortObj(allResp),
    knowledgePlatforms_cum: sortObj(allCum),
    bidi_resp: sortObj(bidiResp),
    rest_resp: sortObj(restResp),
    byPlatform_resp: Object.fromEntries(
      Object.entries(byPlatform).map(([p, o]) => [p, sortObj(o)])
    ),
    otherWikiDomains: sortObj(otherWikiSamples).slice(0, 40),
  };

  fs.writeFileSync(__dirname + '/wiki-medium.json', JSON.stringify(out, null, 2));
  console.error('DONE processed', processed);
  console.log(JSON.stringify({
    total: processed,
    knowledge_resp: out.knowledgePlatforms_resp,
    bidi_resp: out.bidi_resp,
    rest_resp: out.rest_resp,
  }, null, 2));
  await prisma.$disconnect();
})();
