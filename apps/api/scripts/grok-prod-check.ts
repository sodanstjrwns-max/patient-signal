/**
 * 운영 DB에서 그록 응답이 실제로 들어왔는지 확인
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 운영 DB — GROK 응답 데이터 확인\n');

  // 1. 전체 AI 플랫폼별 응답 수 (지난 24시간)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const allRecent = await prisma.aIResponse.groupBy({
    by: ['aiPlatform'],
    where: { createdAt: { gte: cutoff } },
    _count: true,
  });

  console.log('📊 지난 24시간 플랫폼별 응답 수:');
  allRecent.sort((a, b) => (b._count as any) - (a._count as any));
  for (const r of allRecent) {
    const marker = r.aiPlatform === 'GROK' ? '🟢' : '  ';
    console.log(`  ${marker} ${r.aiPlatform.padEnd(20)}: ${r._count}건`);
  }

  // 2. GROK 응답 카운트 + 최근 5건
  const grokTotal = await prisma.aIResponse.count({ where: { aiPlatform: 'GROK' } });
  console.log(`\n🟢 GROK 전체 응답 수: ${grokTotal}건`);

  if (grokTotal === 0) {
    console.log('  (아직 GROK 응답 데이터 없음 — 운영 크롤이 그록을 호출하지 않았음)');
    console.log('  → 다음 cron 사이클(매일 1회) 또는 수동 트리거 필요');
  } else {
    const recent = await prisma.aIResponse.findMany({
      where: { aiPlatform: 'GROK' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`\n🟢 GROK 최근 응답 ${recent.length}건:`);
    for (const r of recent) {
      // 별도 조회로 prompt + hospital 가져오기 (promptId가 끊긴 응답은 스킵)
      const p = r.promptId
        ? await prisma.prompt.findUnique({
            where: { id: r.promptId },
            select: { promptText: true, hospitalId: true },
          })
        : null;
      const h = p?.hospitalId
        ? await prisma.hospital.findUnique({ where: { id: p.hospitalId }, select: { name: true } })
        : null;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Hospital:  ${h?.name || '(unknown)'}`);
      console.log(`  Prompt:    "${(p?.promptText || '').substring(0, 70)}..."`);
      console.log(`  Mentioned: ${r.isMentioned ? '✅' : '❌'} (pos: ${r.mentionPosition})`);
      console.log(`  Sentiment: ${r.sentimentLabel} (score: ${r.sentimentScore})`);
      console.log(`  Model:     ${r.aiModelVersion}`);
      console.log(`  Response:  "${(r.responseText || '').substring(0, 200)}..."`);
      console.log(`  Created:   ${r.createdAt.toISOString()}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
