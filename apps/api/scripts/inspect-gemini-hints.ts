import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sample = await prisma.aIResponse.findMany({
    where: {
      hospitalId: '2a6776fd-a4ae-4022-9331-7a62810988aa',
      aiPlatform: 'GEMINI',
      sourceHints: { not: undefined as any },
    },
    select: { id: true, citedSources: true, sourceHints: true, createdAt: true },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });

  for (const r of sample) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID:', r.id, 'at', r.createdAt.toISOString());
    console.log('citedSources count:', r.citedSources.length);
    console.log('citedSources[0]:', r.citedSources[0]?.substring(0, 100));
    console.log('sourceHints type:', typeof r.sourceHints);
    if (r.sourceHints) {
      const hints = r.sourceHints as any;
      console.log('hints keys:', Object.keys(hints));
      console.log('hints.sources?:', Array.isArray(hints.sources) ? `array len=${hints.sources.length}` : typeof hints.sources);
      if (Array.isArray(hints.sources) && hints.sources.length > 0) {
        console.log('First source:', JSON.stringify(hints.sources[0], null, 2).substring(0, 500));
      } else {
        console.log('full hints JSON:', JSON.stringify(hints).substring(0, 600));
      }
    }
    console.log();
  }

  // 통계: source_hints 가 어떤 키/구조를 가지는지
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 sourceHints 패턴 분석 (Gemini, hospital limit 200)');
  const all = await prisma.aIResponse.findMany({
    where: { hospitalId: '2a6776fd-a4ae-4022-9331-7a62810988aa', aiPlatform: 'GEMINI' },
    select: { sourceHints: true, citedSources: true },
    take: 200,
  });
  let withSourcesArr = 0, withoutSources = 0, totalHintDomains = 0, totalCitedUrls = 0;
  const keysSet = new Set<string>();
  const sampleSourceKeys = new Set<string>();
  for (const r of all) {
    totalCitedUrls += r.citedSources.length;
    if (r.sourceHints) {
      const h = r.sourceHints as any;
      Object.keys(h).forEach(k => keysSet.add(k));
      const srcs = h.sources;
      if (Array.isArray(srcs) && srcs.length > 0) {
        withSourcesArr++;
        totalHintDomains += srcs.length;
        srcs.forEach((s: any) => {
          if (s && typeof s === 'object') Object.keys(s).forEach(k => sampleSourceKeys.add(k));
        });
      } else {
        withoutSources++;
      }
    }
  }
  console.log(`sample size: ${all.length}`);
  console.log(`with sources[] array: ${withSourcesArr}`);
  console.log(`without sources[]: ${withoutSources}`);
  console.log(`total hint domains: ${totalHintDomains}`);
  console.log(`total cited URLs: ${totalCitedUrls}`);
  console.log(`top-level keys observed: ${Array.from(keysSet).join(', ')}`);
  console.log(`source[].keys observed: ${Array.from(sampleSourceKeys).join(', ')}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
