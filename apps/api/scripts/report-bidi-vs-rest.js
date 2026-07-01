// ============================================================
// 서울비디치과(실험군) vs 그 외 병원(대조군) 출처 분리 분석
//  - 비디: 멀티플랫폼 공격적 콘텐츠 운영 (실험적)
//  - 그 외: 일반적인 원장님 활동 대표 (대조군)
// 결과: scripts/report-bidi.json
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

// 비디 그룹 hospitalId (이름에 '비디' 포함 전부)
const BIDI_IDS = new Set([
  '72c4af8e-6d9e-4cc7-82f7-bce0e4de26a4', // 서울비디치과의원
  '14f79d64-70a5-4ee1-9c48-8690b6b0e9d9', // 서울비디치과 (데모)
  '2a6776fd-a4ae-4022-9331-7a62810988aa', // 불당본점 서울비디치과의원 (메인)
  '7f7ca2d7-f9dd-41ce-a85a-ef3e5730f6f9', // 서울비디치과의원
  'a4d45d24-d798-42d9-aebf-44ebfa032f6b', // 서울비디치과 불당본점
]);

function extractDomain(url) {
  if (!url) return null;
  try {
    let u = String(url).trim();
    if (u.includes('vertexaisearch.cloud.google.com')) return null;
    if (!u.startsWith('http')) u = 'https://' + u;
    return new URL(u).hostname.replace(/^www\./, '') || null;
  } catch { return null; }
}

const THIRD_PARTY = [
  'naver.com','blog.naver.com','m.blog.naver.com','cafe.naver.com','post.naver.com','in.naver.com',
  'modoodoc.com','goodoc.co.kr','goodoc.kr','ddoctor.co.kr','gangnamunni.com','babitalk.com','yeoshin.co.kr',
  'kakao.com','daum.net','tistory.com','youtube.com','youtu.be','instagram.com','facebook.com','threads.net',
  'medium.com','wikipedia.org','namu.wiki','google.com','bing.com','my-doctor.io','cashdoc.me','doctornow.co.kr',
  'hidoc.co.kr','goodhosrank.com','hira.or.kr','mohw.go.kr','kdca.go.kr','nhis.or.kr','health.kr',
  'bdbddc.com','ca365dental.com','dailymotion.com','tiktok.com','x.com','twitter.com','brunch.co.kr',
  'daangn.com','sungyesa.com','teamblind.com','ddocdoc.com',
];
function isThirdParty(dom) {
  if (!dom) return true;
  const d = dom.toLowerCase();
  if (THIRD_PARTY.some(t => d === t || d.endsWith('.' + t))) return true;
  if (/\.go\.kr$|\.or\.kr$|\.re\.kr$/.test(d)) return true;
  return false;
}
function looksLikeClinicSite(dom) {
  if (!dom || isThirdParty(dom)) return false;
  const d = dom.toLowerCase();
  return /\.co\.kr$|\.com$|\.kr$|\.net$/.test(d);
}
function categorize(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();
  const map = [
    [/blog\.naver|m\.blog\.naver/, '네이버 블로그'],
    [/cafe\.naver/, '네이버 카페'],
    [/(^|\.)naver\.com/, '네이버(플레이스/지식인 등)'],
    [/(^|\.)modoodoc\.com/, '모두닥(modoodoc)'],
    [/(^|\.)kakao|(^|\.)daum\.net/, '카카오/다음'],
    [/youtube\.com|youtu\.be/, '유튜브'],
    [/instagram\.com/, '인스타그램'],
    [/goodoc|ddoctor|gangnamunni|babitalk|yeoshin/, '의료 플랫폼(굿닥/강남언니 등)'],
    [/tistory\.com/, '티스토리 블로그'],
    [/brunch\.co\.kr/, '브런치'],
    [/medium\.com/, 'Medium'],
    [/wikipedia\.org/, '위키피디아'],
    [/namu\.wiki/, '나무위키'],
    [/google\.com|bing\.com/, '글로벌 검색(구글/빙)'],
    [/hira\.or\.kr|mohw\.go\.kr|kdca|nhis|\.go\.kr$|\.or\.kr$/, '정부/공공기관'],
    [/my-doctor\.io|cashdoc\.me|doctornow|hidoc|goodhosrank/, '의료정보 포털(기타)'],
  ];
  for (const [re, label] of map) if (re.test(d)) return label;
  if (looksLikeClinicSite(d)) return '병원 자체 홈페이지';
  return '기타 웹사이트';
}

const HOMEPAGE_HINTS = ['공식 웹사이트','공식 홈페이지','홈페이지','공식사이트','병원 홈페이지','official website','웹사이트'];

function newAgg() {
  return {
    total: 0, mentioned: 0,
    cat: {}, rawDomain: {}, hint: {},
    platformTotal: {}, platformMentioned: {},
    homepageUrl: 0, homepageHint: 0, anyHomepage: 0,
    srcSumMent: 0, nMent: 0, srcSumNot: 0, nNot: 0,
    clinicDomains: {},
  };
}

function process(agg, r) {
  agg.total++;
  const p = r.aiPlatform;
  agg.platformTotal[p] = (agg.platformTotal[p] || 0) + 1;
  if (r.isMentioned) { agg.mentioned++; agg.platformMentioned[p] = (agg.platformMentioned[p] || 0) + 1; }

  const cats = new Set();
  const domains = [];
  let hadHomeUrl = false;

  const allUrls = [];
  if (r.citedUrl) allUrls.push(r.citedUrl);
  for (const u of (r.citedSources || [])) allUrls.push(u);
  const sh = r.sourceHints;
  if (sh && typeof sh === 'object') {
    for (const s of (sh.sources || [])) {
      if (s.url) allUrls.push(s.url);
      if (s.title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s.title).trim())) allUrls.push('https://' + String(s.title).trim());
      if (s.domain && !String(s.domain).includes('vertexaisearch')) allUrls.push('https://' + String(s.domain).trim());
    }
  }
  for (const url of allUrls) {
    const dom = extractDomain(url);
    if (!dom) continue;
    domains.push(dom);
    agg.rawDomain[dom] = (agg.rawDomain[dom] || 0) + 1;
    const cat = categorize(dom);
    if (cat) cats.add(cat);
    if (looksLikeClinicSite(dom)) { hadHomeUrl = true; agg.clinicDomains[dom] = (agg.clinicDomains[dom] || 0) + 1; }
  }
  let hadHomeHint = false;
  if (sh && typeof sh === 'object') {
    for (const kw of [...(sh.hintKeywords || []), ...(sh.estimatedSources || [])]) {
      agg.hint[kw] = (agg.hint[kw] || 0) + 1;
      if (HOMEPAGE_HINTS.some(h => String(kw).includes(h))) hadHomeHint = true;
    }
  }
  for (const c of cats) agg.cat[c] = (agg.cat[c] || 0) + 1;
  if (hadHomeUrl) agg.homepageUrl++;
  if (hadHomeHint) agg.homepageHint++;
  if (hadHomeUrl || hadHomeHint) agg.anyHomepage++;

  const uniq = new Set(domains).size;
  if (r.isMentioned) { agg.srcSumMent += uniq; agg.nMent++; } else { agg.srcSumNot += uniq; agg.nNot++; }
}

(async () => {
  const BATCH = 2000;
  let cursor = null, processed = 0;
  const bidi = newAgg();
  const rest = newAgg();

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { id: true, hospitalId: true, aiPlatform: true, isMentioned: true,
        citedSources: true, citedUrl: true, sourceHints: true },
      orderBy: { id: 'asc' }, take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    for (const r of rows) {
      processed++;
      process(BIDI_IDS.has(r.hospitalId) ? bidi : rest, r);
    }
    if (processed % 20000 === 0) console.log(`...${processed}`);
  }

  const top = (o, n = 30) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) : '0.0';

  function summarize(a) {
    return {
      total: a.total,
      mentioned: a.mentioned,
      mentionRate: pct(a.mentioned, a.total),
      anyHomepagePct: pct(a.anyHomepage, a.total),
      homepageUrlPct: pct(a.homepageUrl, a.total),
      homepageHintPct: pct(a.homepageHint, a.total),
      avgUniqDomainsMentioned: (a.srcSumMent / (a.nMent || 1)).toFixed(2),
      avgUniqDomainsNot: (a.srcSumNot / (a.nNot || 1)).toFixed(2),
      categoryTop: top(a.cat, 18).map(([k, v]) => [k, v, pct(v, a.total) + '%']),
      rawDomainTop: top(a.rawDomain, 30),
      hintTop: top(a.hint, 15),
      clinicDomainTop: top(a.clinicDomains, 15),
      platform: Object.fromEntries(Object.keys(a.platformTotal).map(p => [p, {
        total: a.platformTotal[p], mentioned: a.platformMentioned[p] || 0,
        mentionRate: pct(a.platformMentioned[p] || 0, a.platformTotal[p]),
      }])),
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalProcessed: processed,
    bidi: summarize(bidi),
    rest: summarize(rest),
  };
  fs.writeFileSync('scripts/report-bidi.json', JSON.stringify(report, null, 2));

  // 콘솔
  console.log(`\n${'='.repeat(64)}`);
  console.log(`비디 vs 그외 분리 완료 — 총 ${processed.toLocaleString()}건`);
  console.log(`${'='.repeat(64)}`);
  console.log(`\n[규모]`);
  console.log(`  비디(실험군): ${bidi.total.toLocaleString()}건  |  그외(대조군): ${rest.total.toLocaleString()}건`);
  console.log(`\n[언급률]`);
  console.log(`  비디: ${pct(bidi.mentioned, bidi.total)}%  |  그외: ${pct(rest.mentioned, rest.total)}%`);
  console.log(`\n[홈페이지 근거율]`);
  console.log(`  비디: ${pct(bidi.anyHomepage, bidi.total)}%  |  그외: ${pct(rest.anyHomepage, rest.total)}%`);
  console.log(`\n[응답당 평균 출처 수(언급된 응답)]`);
  console.log(`  비디: ${(bidi.srcSumMent/(bidi.nMent||1)).toFixed(2)}개  |  그외: ${(rest.srcSumNot/(rest.nNot||1)).toFixed(2)}(미언급)`);
  console.log(`\n[비디 카테고리 TOP 10]`);
  top(bidi.cat, 10).forEach(([k,v],i)=>console.log(`  ${i+1}. ${k.padEnd(26)} ${v} (${pct(v,bidi.total)}%)`));
  console.log(`\n[그외 카테고리 TOP 10]`);
  top(rest.cat, 10).forEach(([k,v],i)=>console.log(`  ${i+1}. ${k.padEnd(26)} ${v} (${pct(v,rest.total)}%)`));
  console.log(`\n[비디 RAW 도메인 TOP 15]`);
  top(bidi.rawDomain, 15).forEach(([k,v],i)=>console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(28)} ${v.toLocaleString()}`));
  console.log(`\n→ 상세: scripts/report-bidi.json`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
