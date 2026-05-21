import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const grokTotal = await prisma.aIResponse.count({ where: { aiPlatform: 'GROK' } });
  
  // 최근 1시간 플랫폼별
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.aIResponse.groupBy({
    by: ['aiPlatform'],
    where: { createdAt: { gte: cutoff } },
    _count: true,
  });
  
  console.log('\n=== 최근 1시간 플랫폼별 응답 ===');
  recent.sort((a,b) => (b._count as any) - (a._count as any));
  for (const r of recent) {
    const marker = r.aiPlatform === 'GROK' ? '🟢' : '  ';
    console.log(`  ${marker} ${r.aiPlatform.padEnd(15)}: ${r._count}건`);
  }
  
  // GROK 만 디테일
  const grokMentioned = await prisma.aIResponse.count({ 
    where: { aiPlatform: 'GROK', isMentioned: true }
  });
  const grokSentiments = await prisma.aIResponse.groupBy({
    by: ['sentimentLabel'],
    where: { aiPlatform: 'GROK' },
    _count: true,
  });
  
  console.log(`\n=== GROK 누적 통계 ===`);
  console.log(`  총 응답:   ${grokTotal}건`);
  console.log(`  언급 비율: ${grokMentioned}/${grokTotal} (${(grokMentioned/grokTotal*100).toFixed(1)}%)`);
  console.log(`  Sentiment 분포:`);
  for (const s of grokSentiments) {
    console.log(`    - ${s.sentimentLabel}: ${s._count}건`);
  }
  
  // 4대 AI vs Grok 언급률 비교 (같은 기간)
  const grokFirstAt = (await prisma.aIResponse.findFirst({
    where: { aiPlatform: 'GROK' },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  }))?.createdAt;
  
  if (grokFirstAt) {
    console.log(`\n=== Grok 데뷔 이후 (${grokFirstAt.toISOString()}) 5개 AI 비교 ===`);
    const platforms = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK'];
    for (const p of platforms) {
      const total = await prisma.aIResponse.count({
        where: { aiPlatform: p as any, createdAt: { gte: grokFirstAt } }
      });
      const mentioned = await prisma.aIResponse.count({
        where: { aiPlatform: p as any, isMentioned: true, createdAt: { gte: grokFirstAt } }
      });
      const rate = total > 0 ? (mentioned/total*100).toFixed(1) : '0.0';
      const marker = p === 'GROK' ? '🟢' : '  ';
      console.log(`  ${marker} ${p.padEnd(15)}: ${total}건 / 언급 ${mentioned}건 (${rate}%)`);
    }
  }
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
