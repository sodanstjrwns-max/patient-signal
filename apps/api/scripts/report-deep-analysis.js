// ============================================================
// 2만자 보고서용 심층 재분석
//  1) 전체 출처 RAW 도메인 TOP 50 + 카테고리
//  2) AI 플랫폼별 출처 상세
//  3) AI 별 차이점(언급률/출처성향)
//  4) 초기~현재 출처 변화 시계열(주별)
//  5) [핵심] 홈페이지(공식 웹사이트/병원 자체 도메인) 중요성 재집계
// 결과: scripts/report-deep.json
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

// ---- 도메인 추출 (Gemini redirect 제외, title 도메인 활용) ----
function extractDomain(url) {
  if (!url) return null;
  try {
    let u = String(url).trim();
    if (u.includes('vertexaisearch.cloud.google.com')) return null;
    if (!u.startsWith('http')) u = 'https://' + u;
    const host = new URL(u).hostname.replace(/^www\./, '');
    return host || null;
  } catch { return null; }
}

// ---- 홈페이지(병원 자체 사이트) 판별 ----
// 플랫폼/포털/블로그/공공 등 "제3자 도메인"을 제외한 나머지를 병원 홈페이지 후보로 본다
const THIRD_PARTY = [
  'naver.com','blog.naver.com','m.blog.naver.com','cafe.naver.com','post.naver.com','in.naver.com',
  'modoodoc.com','goodoc.co.kr','goodoc.kr','ddoctor.co.kr','gangnamunni.com','babitalk.com','yeoshin.co.kr',
  'kakao.com','daum.net','tistory.com','youtube.com','youtu.be','instagram.com','facebook.com','threads.net',
  'medium.com','wikipedia.org','namu.wiki','google.com','bing.com','my-doctor.io','cashdoc.me','doctornow.co.kr',
  'hidoc.co.kr','goodhosrank.com','hira.or.kr','mohw.go.kr','kdca.go.kr','nhis.or.kr','health.kr',
  'bdbddc.com','ca365dental.com','dailymotion.com','tiktok.com','x.com','twitter.com','brunch.co.kr',
];
function isThirdParty(dom) {
  if (!dom) return true;
  const d = dom.toLowerCase();
  if (THIRD_PARTY.some(t => d === t || d.endsWith('.' + t))) return true;
  if (/\.go\.kr$|\.or\.kr$|\.re\.kr$/.test(d)) return true; // 공공
  return false;
}
// 병원 자체 홈페이지로 강하게 추정되는 패턴
function looksLikeClinicSite(dom) {
  if (!dom || isThirdParty(dom)) return false;
  const d = dom.toLowerCase();
  return /dental|denti|implant|ortho|tooth|teeth|smile|clinic|hospital|치과|덴탈|메디|medi|seoul|dent|care|plant|prime|skin|derma|plus|well|good|best/.test(d)
      || /\.co\.kr$|\.com$|\.kr$|\.net$/.test(d);
}

function categorize(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase();
  const map = [
    [/blog\.naver|m\.blog\.naver/, '네이버 블로그'],
    [/cafe\.naver/, '네이버 카페'],
    [/(^|\.)naver\.com/, '네이버 (플레이스/지식인/포스트 등)'],
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

// 주차 키 (해당 날짜가 속한 주 월요일)
function weekKey(date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function monthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

(async () => {
  const BATCH = 2000;
  let cursor = null, processed = 0;

  const rawDomainCount = {};        // RAW 도메인 카운트(병원홈피 포함, redirect 제외)
  const categoryCount = {};         // 카테고리 카운트(응답당 중복제거)
  const hintKeywordCount = {};      // 추정 출처 키워드
  const platformCat = {};           // 플랫폼별 카테고리
  const platformHint = {};          // 플랫폼별 힌트키워드
  const platformTotal = {};
  const platformMentioned = {};

  // 홈페이지 관점
  let respWithHomepageUrl = 0;      // citedSources/sourceHints에 병원홈피 도메인 존재
  let respWithHomepageHint = 0;     // hintKeywords에 '공식 웹사이트' 류 존재
  let respWithAnyHomepage = 0;
  let homepageAndMentioned = 0;     // 홈피근거 있고 + 우리병원 언급
  let homepageTotalMentionable = 0; // 홈피근거 있는 응답 수(언급률 분모)
  const homepageDomainCount = {};   // 어떤 병원 홈피가 자주 인용됐나

  // 시계열
  const weekStats = {};   // week -> {total, mentioned, homepageRefs, catCount:{}}
  const monthStats = {};  // month -> {...}

  // 출처 수 vs 언급
  let mSrcSum = 0, mSrcN = 0, nSrcSum = 0, nSrcN = 0;

  const HOMEPAGE_HINTS = ['공식 웹사이트','공식 홈페이지','홈페이지','공식사이트','병원 홈페이지','official website','웹사이트'];

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: {
        id: true, aiPlatform: true, isMentioned: true, responseDate: true,
        citedSources: true, citedUrl: true, sourceHints: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      processed++;
      const p = r.aiPlatform;
      platformTotal[p] = (platformTotal[p] || 0) + 1;
      if (r.isMentioned) platformMentioned[p] = (platformMentioned[p] || 0) + 1;
      platformCat[p] = platformCat[p] || {};
      platformHint[p] = platformHint[p] || {};

      const wk = weekKey(r.responseDate);
      const mo = monthKey(r.responseDate);
      weekStats[wk] = weekStats[wk] || { total: 0, mentioned: 0, homepageRefs: 0, cat: {} };
      monthStats[mo] = monthStats[mo] || { total: 0, mentioned: 0, homepageRefs: 0, cat: {} };
      weekStats[wk].total++; monthStats[mo].total++;
      if (r.isMentioned) { weekStats[wk].mentioned++; monthStats[mo].mentioned++; }

      const cats = new Set();
      const domainsThisResp = [];
      let hadHomepageUrl = false;

      // citedUrl
      const allUrls = [];
      if (r.citedUrl) allUrls.push(r.citedUrl);
      for (const u of (r.citedSources || [])) allUrls.push(u);

      // sourceHints.sources
      const sh = r.sourceHints;
      if (sh && typeof sh === 'object') {
        for (const s of (sh.sources || [])) {
          if (s.url) allUrls.push(s.url);
          // Gemini는 redirect라 title에 실제 도메인
          if (s.title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(s.title).trim())) {
            allUrls.push('https://' + String(s.title).trim());
          }
          if (s.domain && !String(s.domain).includes('vertexaisearch')) {
            allUrls.push('https://' + String(s.domain).trim());
          }
        }
      }

      for (const url of allUrls) {
        const dom = extractDomain(url);
        if (!dom) continue;
        domainsThisResp.push(dom);
        rawDomainCount[dom] = (rawDomainCount[dom] || 0) + 1;
        const cat = categorize(dom);
        if (cat) cats.add(cat);
        if (looksLikeClinicSite(dom)) {
          hadHomepageUrl = true;
          homepageDomainCount[dom] = (homepageDomainCount[dom] || 0) + 1;
        }
      }

      // 힌트 키워드
      let hadHomepageHint = false;
      if (sh && typeof sh === 'object') {
        const kws = [...(sh.hintKeywords || []), ...(sh.estimatedSources || [])];
        for (const kw of kws) {
          hintKeywordCount[kw] = (hintKeywordCount[kw] || 0) + 1;
          platformHint[p][kw] = (platformHint[p][kw] || 0) + 1;
          if (HOMEPAGE_HINTS.some(h => String(kw).includes(h))) hadHomepageHint = true;
        }
      }

      for (const c of cats) {
        categoryCount[c] = (categoryCount[c] || 0) + 1;
        platformCat[p][c] = (platformCat[p][c] || 0) + 1;
        weekStats[wk].cat[c] = (weekStats[wk].cat[c] || 0) + 1;
        monthStats[mo].cat[c] = (monthStats[mo].cat[c] || 0) + 1;
      }

      // 홈페이지 관점 집계
      if (hadHomepageUrl) respWithHomepageUrl++;
      if (hadHomepageHint) respWithHomepageHint++;
      if (hadHomepageUrl || hadHomepageHint) {
        respWithAnyHomepage++;
        weekStats[wk].homepageRefs++; monthStats[mo].homepageRefs++;
        homepageTotalMentionable++;
        if (r.isMentioned) homepageAndMentioned++;
      }

      // 출처 수 vs 언급 (RAW 도메인 unique 개수 기준)
      const uniq = new Set(domainsThisResp).size;
      if (r.isMentioned) { mSrcSum += uniq; mSrcN++; } else { nSrcSum += uniq; nSrcN++; }
    }
    if (processed % 20000 === 0) console.log(`...${processed}건`);
  }

  const top = (obj, n = 50) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) : '0.0';

  // 언급 응답이 있는 홈피근거 응답 = 홈피있을때 언급률
  const homepageMentionRate = pct(homepageAndMentioned, homepageTotalMentionable);
  const overallMentionRate = pct(
    Object.values(platformMentioned).reduce((a,b)=>a+b,0), processed
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totalResponses: processed,
    platformTotal,
    platformMentioned,
    overallMentionRate,
    // 1) 전체 RAW 도메인 TOP 50
    rawDomainTop50: top(rawDomainCount, 50),
    // 1) 카테고리 TOP
    categoryTop: top(categoryCount, 25),
    hintKeywordTop: top(hintKeywordCount, 25),
    // 2) 플랫폼별
    byPlatformCategory: Object.fromEntries(Object.entries(platformCat).map(([p,o])=>[p, top(o, 12)])),
    byPlatformHint: Object.fromEntries(Object.entries(platformHint).map(([p,o])=>[p, top(o, 10)])),
    // 5) 홈페이지 관점
    homepage: {
      respWithHomepageUrl,
      respWithHomepageHint,
      respWithAnyHomepage,
      respWithAnyHomepagePct: pct(respWithAnyHomepage, processed),
      homepageMentionRate,             // 홈피근거 있을 때 우리병원 언급률
      overallMentionRate,              // 전체 언급률(비교용)
      topClinicHomepageDomains: top(homepageDomainCount, 30),
    },
    // 출처 수 vs 언급
    sourceCountVsMention: {
      mentionedAvgUniqueDomains: (mSrcSum / (mSrcN||1)).toFixed(2),
      notMentionedAvgUniqueDomains: (nSrcSum / (nSrcN||1)).toFixed(2),
    },
    // 4) 시계열
    weekly: Object.fromEntries(Object.entries(weekStats).sort().map(([w,s])=>[w, {
      total: s.total, mentioned: s.mentioned, mentionRate: pct(s.mentioned, s.total),
      homepageRefs: s.homepageRefs, homepageRefRate: pct(s.homepageRefs, s.total),
      topCats: top(s.cat, 6),
    }])),
    monthly: Object.fromEntries(Object.entries(monthStats).sort().map(([m,s])=>[m, {
      total: s.total, mentioned: s.mentioned, mentionRate: pct(s.mentioned, s.total),
      homepageRefs: s.homepageRefs, homepageRefRate: pct(s.homepageRefs, s.total),
      topCats: top(s.cat, 10),
    }])),
  };
  fs.writeFileSync('scripts/report-deep.json', JSON.stringify(report, null, 2));

  // 콘솔 요약
  console.log(`\n${'='.repeat(60)}\n심층 재분석 완료 — ${processed.toLocaleString()}건\n${'='.repeat(60)}`);
  console.log(`\n[홈페이지 관점]`);
  console.log(`  병원 홈페이지 URL 인용 응답: ${respWithHomepageUrl.toLocaleString()}`);
  console.log(`  '공식 웹사이트' 힌트 응답  : ${respWithHomepageHint.toLocaleString()}`);
  console.log(`  홈피 근거(URL+힌트) 합     : ${respWithAnyHomepage.toLocaleString()} (${report.homepage.respWithAnyHomepagePct}%)`);
  console.log(`  ▶ 홈피 근거 있을 때 우리병원 언급률: ${homepageMentionRate}%  (전체 ${overallMentionRate}%)`);
  console.log(`\n[RAW 도메인 TOP 15]`);
  top(rawDomainCount, 15).forEach(([k,v],i)=>console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(28)} ${v.toLocaleString()}`));
  console.log(`\n[병원 자체 홈페이지 도메인 TOP 10]`);
  top(homepageDomainCount, 10).forEach(([k,v],i)=>console.log(`  ${String(i+1).padStart(2)}. ${k.padEnd(28)} ${v.toLocaleString()}`));
  console.log(`\n[월별 추이]`);
  Object.entries(report.monthly).forEach(([m,s])=>console.log(`  ${m}: 총 ${s.total} / 언급률 ${s.mentionRate}% / 홈피근거율 ${s.homepageRefRate}%`));
  console.log(`\n→ 상세: scripts/report-deep.json`);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
