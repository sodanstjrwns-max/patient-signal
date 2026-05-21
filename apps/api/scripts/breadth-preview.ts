import { PrismaClient } from '@prisma/client';
import { classifyDomain, isOwnHospital, CATEGORY_LABELS } from '../src/ai-crawler/breadth.classifier';
const prisma = new PrismaClient();

function extractRealDomain(s: any): string | null {
  if (!s || typeof s !== 'object') return null;
  const t = (s.title || '').toString().trim().toLowerCase();
  const d = (s.domain || '').toString().trim().toLowerCase();
  const ok = (x: string) => x.length > 0 && x.includes('.') && !x.includes(' ') && !x.includes('vertexaisearch');
  if (ok(t)) return t.replace(/^www\./, '');
  if (ok(d)) return d.replace(/^www\./, '');
  return null;
}

async function main() {
  const hid = '2a6776fd-a4ae-4022-9331-7a62810988aa';
  const since = new Date(); since.setDate(since.getDate() - 30);
  const hospital = await prisma.hospital.findUnique({ where: { id: hid }, select: { name: true, websiteUrl: true } });
  console.log(`🏥 ${hospital?.name} | website: ${hospital?.websiteUrl}\n`);
  
  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: hid, createdAt: { gte: since } },
    select: { citedSources: true, citedUrl: true, aiPlatform: true, isMentioned: true, sentimentLabel: true, competitorsMentioned: true, sourceHints: true },
  });

  const catMap = new Map<string, any>();
  let totalUrls = 0, ownTotal = 0, compTotal = 0;
  let authSum = 0, authCount = 0;

  for (const r of responses) {
    const rawUrls = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
    const hints: string[] = [];
    if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
      try {
        const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
        for (const s of arr) { const x = extractRealDomain(s); if (x) hints.push(x); }
      } catch {}
    }
    const hasComp = (r.competitorsMentioned || []).length > 0;
    let hi = 0;
    for (const url of rawUrls) {
      let d = 'invalid';
      try { d = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch {}
      if (r.aiPlatform === 'GEMINI' && url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
        const real = hints[hi] || hints[0];
        if (real) d = real;
        hi++;
      }
      if (!d || d === 'invalid') continue;
      totalUrls++;
      const info = classifyDomain(d);
      const isOwn = isOwnHospital(d, hospital!.name, hospital!.websiteUrl);
      const cat = isOwn ? 'HOSPITAL_OFFICIAL' : info.category;
      const auth = isOwn ? Math.max(8, info.authority) : info.authority;
      authSum += auth; authCount++;
      if (isOwn) ownTotal++;
      if (hasComp && !isOwn) compTotal++;
      
      if (!catMap.has(cat)) catMap.set(cat, { count: 0, auth: 0, n: 0, own: 0, comp: 0, doms: new Map() });
      const s = catMap.get(cat);
      s.count++; s.auth += auth; s.n++;
      if (isOwn) s.own++;
      if (hasComp && !isOwn) s.comp++;
      s.doms.set(d, (s.doms.get(d) || 0) + 1);
    }
  }

  console.log(`📦 응답: ${responses.length}건 | 디코딩된 인용 URL: ${totalUrls}`);
  console.log(`🏛 종합 권위도: ${(authSum/authCount).toFixed(2)}/10`);
  console.log(`🏥 우리 도메인 인용: ${ownTotal}회 | 경쟁사 노출(우리 외): ${compTotal}회`);

  console.log('\n📊 25 카테고리 분포 (Top 15):');
  console.log('카테고리'.padEnd(28) + ' | ' + '인용'.padStart(6) + ' | ' + '권위도'.padStart(6) + ' | ' + '우리'.padStart(6) + ' | ' + '경쟁'.padStart(6));
  console.log('-'.repeat(75));
  const cats = Array.from(catMap.entries()).sort((a,b) => b[1].count - a[1].count);
  for (const [cat, s] of cats.slice(0, 15)) {
    const label = CATEGORY_LABELS[cat] || cat;
    const avgAuth = (s.auth/s.n).toFixed(1);
    console.log(
      `${label.padEnd(28)} | ${s.count.toString().padStart(6)} | ${avgAuth.padStart(6)} | ${s.own.toString().padStart(6)} | ${s.comp.toString().padStart(6)}`
    );
  }
  
  console.log('\n🎯 갭 분석 (경쟁사 노출 - 우리 노출, 큰 순):');
  const gaps = cats.map(([cat, s]) => ({
    cat,
    label: CATEGORY_LABELS[cat] || cat,
    gap: s.comp - s.own,
    our: s.own,
    comp: s.comp,
  })).filter(g => g.comp >= 10);
  
  for (const g of gaps.sort((a,b) => b.gap - a.gap).slice(0, 8)) {
    const opp = g.gap > 50 ? '🔥 즉시 진출' : g.gap > 20 ? '⚡ 진출 권장' : g.gap > 0 ? '📌 검토' : '✅ 우위';
    console.log(`  ${g.label.padEnd(28)} | 우리 ${g.our.toString().padStart(5)} | 경쟁 ${g.comp.toString().padStart(5)} | 갭 ${(g.gap > 0 ? '+'+g.gap : g.gap).toString().padStart(5)} | ${opp}`);
  }

  // 권위도 분포
  let s_=0, a_=0, b_=0, c_=0, d_=0;
  for (const [cat, s] of cats) {
    const avg = s.auth/s.n;
    if (avg >= 9) s_ += s.count;
    else if (avg >= 7) a_ += s.count;
    else if (avg >= 5) b_ += s.count;
    else if (avg >= 3) c_ += s.count;
    else d_ += s.count;
  }
  console.log('\n📊 권위도 Tier 분포:');
  console.log(`  Tier S (9-10) 공공/대학:  ${s_.toString().padStart(6)} (${(s_/totalUrls*100).toFixed(1)}%)`);
  console.log(`  Tier A (7-8)  주요 포털:  ${a_.toString().padStart(6)} (${(a_/totalUrls*100).toFixed(1)}%)`);
  console.log(`  Tier B (5-6)  SNS/위키:   ${b_.toString().padStart(6)} (${(b_/totalUrls*100).toFixed(1)}%)`);
  console.log(`  Tier C (3-4)  블로그/UGC: ${c_.toString().padStart(6)} (${(c_/totalUrls*100).toFixed(1)}%)`);
  console.log(`  Tier D (1-2)  광고/저신뢰:${d_.toString().padStart(6)} (${(d_/totalUrls*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
