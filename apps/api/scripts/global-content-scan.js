// ============================================================
// 글로벌 콘텐츠/Q&A 플랫폼이 한국 치과 AI 답변에 잡히는지 전수 검증
//   가설: "미디엄/큐오라는 지금 안 써서 안 잡히는 것 아니냐?"
//   → DB 전체에서 단 한 건이라도 인용되는지, 어떤 도메인이 잡히는지 확인
// 결과: scripts/global-content.json
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

// 글로벌/국내 콘텐츠·Q&A·전문지식 플랫폼 후보 (소문자 substring 매칭)
const TARGETS = {
  'quora.com': 'Quora(글로벌 Q&A)',
  'reddit.com': 'Reddit',
  'medium.com': 'Medium',
  'substack.com': 'Substack',
  'linkedin.com': 'LinkedIn',
  'stackexchange.com': 'StackExchange',
  'stackoverflow.com': 'StackOverflow',
  'tumblr.com': 'Tumblr',
  'pinterest.': 'Pinterest',
  'kin.naver.com': '네이버 지식인(국내 Q&A)',
  'velog.io': 'velog',
  'vingle.net': 'Vingle',
  'steemit.com': 'Steemit',
  'wordpress.com': 'WordPress',
  'wikihow': 'wikiHow',
  'healthline.com': 'Healthline(해외 의료콘텐츠)',
  'webmd.com': 'WebMD(해외 의료콘텐츠)',
  'mayoclinic.org': 'MayoClinic',
  'colgate.com': 'Colgate(해외 치과콘텐츠)',
  'ada.org': 'ADA(미국치과협회)',
  'nih.gov': 'NIH(미국국립보건원)',
  'pubmed': 'PubMed(논문DB)',
};

function matchTarget(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();
  for (const [key, label] of Object.entries(TARGETS)) {
    if (d.includes(key)) return label + ' [' + d + ']';
  }
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
  const cum = {}, resp = {};
  const byPlatform = {};
  const sampleUrls = {}; // 라벨 -> 예시 풀 URL

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { id: true, hospitalId: true, aiPlatform: true, citedSources: true, citedUrl: true, sourceHints: true },
      orderBy: { id: 'asc' }, take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      const urls = collectUrls(r);
      const respLabels = new Set();
      for (const u of urls) {
        const dom = extractDomain(u);
        const label = matchTarget(dom);
        if (!label) continue;
        inc(cum, label);
        respLabels.add(label);
        if (!sampleUrls[label]) sampleUrls[label] = String(u).slice(0, 120);
      }
      for (const label of respLabels) {
        inc(resp, label);
        const p = r.aiPlatform || 'UNKNOWN';
        byPlatform[p] = byPlatform[p] || {};
        inc(byPlatform[p], label);
      }
    }
    processed += rows.length;
    if (processed % 20000 === 0) console.error('processed', processed);
  }

  const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const out = {
    generatedAt: new Date().toISOString(),
    totalProcessed: processed,
    global_content_resp: sortObj(resp),
    global_content_cum: sortObj(cum),
    byPlatform: Object.fromEntries(Object.entries(byPlatform).map(([p, o]) => [p, sortObj(o)])),
    sampleUrls,
  };
  fs.writeFileSync(__dirname + '/global-content.json', JSON.stringify(out, null, 2));
  console.error('DONE', processed);
  console.log(JSON.stringify(out.global_content_resp, null, 2));
  await prisma.$disconnect();
})();
