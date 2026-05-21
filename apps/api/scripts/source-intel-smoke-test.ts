/**
 * Source Intel Smoke Test — 작은 샘플로 파이프라인 전체 검증
 * 1) Top 5 인용 URL을 enrich
 * 2) Snapshot 확인
 * 3) 인스타 1개 별도 확인
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { SourceCrawlerService } from '../src/source-intel/source-crawler.service';
import { SourceAnalyzerService } from '../src/source-intel/source-analyzer.service';
import { SourcePipelineService } from '../src/source-intel/source-pipeline.service';

const prisma = new PrismaClient();

async function main() {
  const HID = '2a6776fd-a4ae-4022-9331-7a62810988aa'; // 불당본점

  const crawler = new SourceCrawlerService();
  const analyzer = new SourceAnalyzerService();
  const pipeline = new SourcePipelineService(crawler, analyzer);

  console.log('🔥 Source Intel Smoke Test — limit=5\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 기존 캐시 클리어해서 isOwn 재처리
  await prisma.citedSourceSnapshot.deleteMany({});
  console.log('(기존 snapshot 모두 삭제 후 신규 enrich)\n');

  const result = await pipeline.enrichHospital(HID, {
    days: 30,
    limit: 5,
    concurrency: 2,
    analyzeWithAI: false, // sandbox엔 진짜 OpenAI 키 없음 — 운영에서 동작 검증
    onProgress: (p) => {
      console.log(`  [${p.done}/${p.total}] ${p.current?.substring(0, 80)}`);
    },
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Enrich 결과');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 URL: ${result.totalUrls}`);
  console.log(`처리: ${result.processed}`);
  console.log(`신규 스냅샷: ${result.newSnapshots}`);
  console.log(`AI 분석 완료: ${result.aiAnalyzed}`);
  console.log(`실패: ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('\n에러:');
    result.errors.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 저장된 Snapshot 확인');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const snaps = await prisma.citedSourceSnapshot.findMany({
    orderBy: { influenceScore: 'desc' },
    take: 10,
  });
  for (const s of snaps) {
    const a = (s.hospitalAnalysis as any)?.[HID];
    console.log(`\n📍 ${s.domain} [${s.sourceType}] - Authority ${s.authorityScore}, Influence ${s.influenceScore?.toFixed(2)}`);
    console.log(`   URL: ${s.url.substring(0, 80)}`);
    console.log(`   Status: ${s.fetchStatus} (${s.fetchDurationMs}ms) - HTTP ${s.httpStatus}`);
    if (s.title) console.log(`   Title: ${s.title.substring(0, 80)}`);
    if (s.publisher) console.log(`   Publisher: ${s.publisher}`);
    if (s.bodyLength) console.log(`   Body: ${s.bodyLength} chars, ${s.wordCount} words`);
    if (s.igHandle) console.log(`   IG: ${s.igHandle} (${s.igMediaType})`);
    if (a) {
      console.log(`   🧠 분석: ${a.mentionsUs ? '우리병원 언급✓' : '언급 없음'} - Tone: ${a.ourTone}`);
      if (a.extractedQuote) console.log(`      💬 "${a.extractedQuote}"`);
      if (a.claimAccuracy && a.claimAccuracy !== 'ACCURATE') console.log(`      ⚠️ 정확성: ${a.claimAccuracy}`);
      if (a.recommendedAction) console.log(`      🎯 액션: ${a.recommendedAction}`);
      if (a.mentionedCompetitors?.length) console.log(`      🥊 경쟁사: ${a.mentionedCompetitors.slice(0, 3).join(', ')}`);
    } else {
      console.log(`   (분석 없음)`);
    }
  }

  await prisma.$disconnect();
  console.log('\n✅ Smoke test 완료');
}

main().catch(e => { console.error(e); process.exit(1); });
