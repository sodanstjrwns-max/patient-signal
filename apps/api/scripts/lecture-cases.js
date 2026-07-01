const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // 케이스 1: 우리 병원이 1위로 추천된 실제 응답
  const top1 = await prisma.aIResponse.findFirst({
    where: { isMentioned: true, mentionPosition: 1, responseText: { not: '' } },
    include: { hospital: { select: { name: true } }, prompt: { select: { promptText: true } } },
    orderBy: { responseDate: 'desc' },
  });
  console.log('### 케이스1: 1위 추천 실사례');
  console.log('병원:', top1?.hospital?.name, '| 플랫폼:', top1?.aiPlatform);
  console.log('질문:', top1?.prompt?.promptText);
  console.log('답변발췌:', (top1?.responseText||'').slice(0, 600));
  console.log('\n' + '='.repeat(60) + '\n');

  // 케이스 2: 실제 인용 URL이 풍부한 응답 (출처 보여주기용)
  const withSrc = await prisma.aIResponse.findFirst({
    where: { isMentioned: true, aiPlatform: 'PERPLEXITY' },
    include: { hospital: { select: { name: true } }, prompt: { select: { promptText: true } } },
    orderBy: { responseDate: 'desc' },
  });
  console.log('### 케이스2: 출처 인용 실사례 (Perplexity)');
  console.log('병원:', withSrc?.hospital?.name);
  console.log('질문:', withSrc?.prompt?.promptText);
  console.log('인용출처:', JSON.stringify(withSrc?.citedSources||[]).slice(0,400));
  console.log('답변발췌:', (withSrc?.responseText||'').slice(0, 400));
  console.log('\n' + '='.repeat(60) + '\n');

  // 케이스 3: 같은 질문, 플랫폼별 답변이 다른 경우 (병원 한 곳 골라 플랫폼 비교)
  const sample = await prisma.aIResponse.findFirst({ where: { isMentioned: true }, select: { promptId: true } });
  if (sample) {
    const sameQ = await prisma.aIResponse.findMany({
      where: { promptId: sample.promptId },
      include: { prompt: { select: { promptText: true } } },
      orderBy: { responseDate: 'desc' }, take: 8,
    });
    console.log('### 케이스3: 같은 질문, 플랫폼별 결과 차이');
    console.log('질문:', sameQ[0]?.prompt?.promptText);
    const seen = new Set();
    for (const r of sameQ) {
      if (seen.has(r.aiPlatform)) continue; seen.add(r.aiPlatform);
      console.log(`  [${r.aiPlatform}] 언급=${r.isMentioned} 순위=${r.mentionPosition||'-'} → ${(r.responseText||'').slice(0,120).replace(/\n/g,' ')}`);
    }
  }
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
