// ============================================================
// 서울비디치과 출처 전수조사 + 특이 출처 발굴
//  - 비디 5개 레코드의 모든 응답에서 출처 도메인 전체 집계
//  - 일반 병원 대비 비디에서만/유독 많이 나오는 '특이 출처' 추출
// 결과: scripts/bidi-census.json
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

// 흔한 메이저 도메인 (특이 출처에서 제외할 후보)
const COMMON = new Set([
  'google.com','instagram.com','youtube.com','youtu.be','blog.naver.com','m.blog.naver.com',
  'naver.com','cafe.naver.com','modoodoc.com','tistory.com','daum.net','v.daum.net','kakao.com',
  'pf.kakao.com','namu.wiki','wikipedia.org','facebook.com','x.com','twitter.com','bing.com',
  'goodoc.co.kr','gangnamunni.com','babitalk.com','my-doctor.io','cashdoc.me','hidoc.co.kr',
  'doctornow.co.kr','goodhosrank.com','bdbddc.com','ca365dental.com','brunch.co.kr','daangn.com',
  'threads.net','tiktok.com','linktr.ee',
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

// 한 응답에서 모든 출처 URL 추출
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

(async () => {
  const BATCH = 2000;
  let cursor = null, processed = 0;

  const bidiDomain = {};       // 비디 도메인 누적 인용
  const bidiDomainResp = {};   // 비디 도메인 등장 '응답 수' (중복제거)
  const restDomain = {};       // 일반 도메인 누적
  const bidiHint = {};         // 비디 힌트 키워드
  const bidiFullUrlSample = {}; // 도메인별 예시 풀 URL (특이출처 확인용)
  let bidiTotal = 0, restTotal = 0;
  let bidiNoSource = 0;        // 비디 중 출처 0개 응답

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { id: true, hospitalId: true, citedSources: true, citedUrl: true, sourceHints: true },
      orderBy: { id: 'asc' }, take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      processed++;
      const isBidi = BIDI_IDS.has(r.hospitalId);
      if (isBidi) bidiTotal++; else restTotal++;

      const urls = collectUrls(r);
      const domsThisResp = new Set();
      for (const url of urls) {
        const dom = extractDomain(url);
        if (!dom) continue;
        domsThisResp.add(dom);
        if (isBidi) {
          bidiDomain[dom] = (bidiDomain[dom] || 0) + 1;
          if (!bidiFullUrlSample[dom] && /^https?:\/\//.test(String(url))) {
            bidiFullUrlSample[dom] = String(url).slice(0, 160);
          }
        } else {
          restDomain[dom] = (restDomain[dom] || 0) + 1;
        }
      }
      if (isBidi) {
        if (domsThisResp.size === 0) bidiNoSource++;
        for (const d of domsThisResp) bidiDomainResp[d] = (bidiDomainResp[d] || 0) + 1;
        const sh = r.sourceHints;
        if (sh && typeof sh === 'object') {
          for (const kw of [...(sh.hintKeywords || []), ...(sh.estimatedSources || [])]) {
            bidiHint[kw] = (bidiHint[kw] || 0) + 1;
          }
        }
      }
    }
    if (processed % 20000 === 0) console.log(`...${processed}`);
  }

  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

  // --- 특이 출처 발굴 ---
  // (1) 비디에만 나타나는 도메인 (일반엔 0)
  const onlyInBidi = [];
  for (const [dom, cnt] of Object.entries(bidiDomain)) {
    if (!(dom in restDomain) && cnt >= 3) onlyInBidi.push([dom, cnt, bidiFullUrlSample[dom] || '']);
  }
  onlyInBidi.sort((a, b) => b[1] - a[1]);

  // (2) 비디 편중 도메인: 비디 비율이 일반 대비 압도적 (정규화 비교)
  // 비디 1건당 인용율 vs 일반 1건당 인용율
  const skew = [];
  for (const [dom, cnt] of Object.entries(bidiDomain)) {
    if (cnt < 10) continue;
    const bidiRate = cnt / bidiTotal;
    const restCnt = restDomain[dom] || 0;
    const restRate = restCnt / restTotal;
    const ratio = restRate > 0 ? bidiRate / restRate : Infinity;
    if (ratio >= 3) skew.push([dom, cnt, restCnt, ratio === Infinity ? '∞' : ratio.toFixed(1)]);
  }
  skew.sort((a, b) => (b[3] === '∞' ? 1e9 : Number(b[3])) - (a[3] === '∞' ? 1e9 : Number(a[3])));

  // (3) 흔한 메이저 제외하고 비디 TOP 특이 도메인
  const uncommonTop = top(
    Object.fromEntries(Object.entries(bidiDomain).filter(([d]) => !COMMON.has(d))), 40
  ).map(([d, c]) => [d, c, bidiFullUrlSample[d] || '']);

  const report = {
    generatedAt: new Date().toISOString(),
    bidiTotal, restTotal,
    bidiNoSource,
    bidiUniqueDomainCount: Object.keys(bidiDomain).length,
    bidiDomainTop60: top(bidiDomain, 60),
    bidiDomainByRespTop40: top(bidiDomainResp, 40),
    bidiHintTop20: top(bidiHint, 20),
    peculiar_onlyInBidi: onlyInBidi.slice(0, 60),
    peculiar_skewed: skew.slice(0, 50),
    peculiar_uncommonTop: uncommonTop,
  };
  fs.writeFileSync('scripts/bidi-census.json', JSON.stringify(report, null, 2));

  console.log(`\n${'='.repeat(64)}`);
  console.log(`서울비디치과 출처 전수조사 완료`);
  console.log(`${'='.repeat(64)}`);
  console.log(`비디 응답: ${bidiTotal.toLocaleString()}건 | 고유 도메인: ${report.bidiUniqueDomainCount.toLocaleString()}개 | 출처없음: ${bidiNoSource}건`);
  console.log(`\n[비디 전체 도메인 TOP 25 (누적 인용)]`);
  top(bidiDomain, 25).forEach(([k, v], i) => console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(34)} ${v.toLocaleString()}`));
  console.log(`\n[★ 비디에만 나타나는 특이 도메인 TOP 25 (일반엔 0건)]`);
  onlyInBidi.slice(0, 25).forEach(([d, c], i) => console.log(`  ${String(i+1).padStart(2)}. ${d.padEnd(38)} ${c}회`));
  console.log(`\n[★ 비디 편중 도메인 (일반 대비 3배+ 쏠림)]`);
  skew.slice(0, 20).forEach(([d, bc, rc, ratio], i) => console.log(`  ${String(i+1).padStart(2)}. ${d.padEnd(34)} 비디 ${bc} / 일반 ${rc} (${ratio}배)`));
  console.log(`\n→ 상세: scripts/bidi-census.json`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
