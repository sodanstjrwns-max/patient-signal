/**
 * Breadth-B 분류 체계 설계용 — 디코딩된 도메인 Top 100 분포 분석
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function extractRealDomain(s: any): string | null {
  if (!s || typeof s !== 'object') return null;
  const title = (s.title || '').toString().trim().toLowerCase();
  const domain = (s.domain || '').toString().trim().toLowerCase();
  const ok = (x: string) => x.length > 0 && x.includes('.') && !x.includes(' ') && !x.includes('vertexaisearch');
  if (ok(title)) return title.replace(/^www\./, '');
  if (ok(domain)) return domain.replace(/^www\./, '');
  return null;
}

async function main() {
  const since = new Date(); since.setDate(since.getDate() - 30);
  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: '2a6776fd-a4ae-4022-9331-7a62810988aa', createdAt: { gte: since } },
    select: { citedSources: true, citedUrl: true, aiPlatform: true, sourceHints: true },
  });

  const domainCount: Record<string, number> = {};
  for (const r of responses) {
    const rawUrls = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
    const hints: string[] = [];
    if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
      try {
        const sources = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
        for (const s of sources) { const real = extractRealDomain(s); if (real) hints.push(real); }
      } catch {}
    }
    let hi = 0;
    for (const url of rawUrls) {
      let d = 'invalid';
      try { d = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      if (r.aiPlatform === 'GEMINI' && url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
        const real = hints[hi] || hints[0];
        if (real) d = real;
        hi++;
      }
      domainCount[d] = (domainCount[d] || 0) + 1;
    }
  }

  const sorted = Object.entries(domainCount).sort((a,b) => b[1]-a[1]);
  console.log(`총 고유 도메인: ${sorted.length}`);
  console.log(`\n📊 Top 50 도메인 (디코딩 후):`);
  sorted.slice(0, 50).forEach(([d, c], i) => {
    console.log(`  ${(i+1).toString().padStart(3)}. ${d.padEnd(45)} ${c.toString().padStart(6)}`);
  });
  console.log(`\n📊 Top 51~100:`);
  sorted.slice(50, 100).forEach(([d, c], i) => {
    console.log(`  ${(i+51).toString().padStart(3)}. ${d.padEnd(45)} ${c.toString().padStart(6)}`);
  });
  
  // TLD 분포
  const tldCount: Record<string, number> = {};
  for (const [d, c] of sorted) {
    const tld = d.split('.').slice(-2).join('.');
    tldCount[tld] = (tldCount[tld] || 0) + c;
  }
  console.log(`\n📊 TLD Top 15:`);
  Object.entries(tldCount).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([t,c]) => {
    console.log(`  ${t.padEnd(35)} ${c}`);
  });
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
