/**
 * Grok 라이브 통합 검증
 * - queryGrok() 직접 호출
 * - 실제 BIDI치과 프롬프트로 응답 수신 + analyzeResponse() 동작 확인
 *
 * 실행: XAI_API_KEY=xai-... npx ts-node scripts/grok-live-test.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.XAI_API_KEY) {
  console.error('❌ XAI_API_KEY 환경변수가 필요합니다.');
  console.error('   예: XAI_API_KEY=xai-xxxx npx ts-node scripts/grok-live-test.ts');
  process.exit(1);
}

import { AICrawlerService } from '../src/ai-crawler/ai-crawler.service';

async function main() {
  console.log('\n🚀 Grok 라이브 검증 — queryGrok() 직접 호출\n');

  const svc = new (AICrawlerService as any)(null, null, null, null);

  const prompt = '서울에서 임플란트 잘하는 치과 추천해줘. 5곳 정도 알려주면 좋겠어.';
  const hospitalName = '서울비디치과';

  console.log(`📝 Prompt: "${prompt}"`);
  console.log(`🎯 Target hospital: ${hospitalName}\n`);

  const t0 = Date.now();
  try {
    const result = await (svc as any).queryGrok(prompt, hospitalName);
    const dt = Date.now() - t0;

    console.log(`✅ Grok 응답 수신 (${dt}ms)\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Response Text]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(result.response?.substring(0, 1500) || '(empty)');
    if (result.response && result.response.length > 1500) {
      console.log(`\n... (총 ${result.response.length}자, 일부 생략)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('[Analysis Result]');
    console.log(JSON.stringify({
      platform: result.platform,
      model: result.model,
      isMentioned: result.isMentioned,
      mentionPosition: result.mentionPosition,
      totalRecommendations: result.totalRecommendations,
      sentimentScore: result.sentimentScore,
      sentimentLabel: result.sentimentLabel,
      competitorsMentioned: result.competitorsMentioned?.length || 0,
      citedSources: result.citedSources?.length || 0,
      isWebSearch: result.isWebSearch,
      responseLength: result.response?.length || 0,
    }, null, 2));

    if (result.competitorsMentioned?.length) {
      console.log('\n[Competitors Mentioned]');
      console.log(result.competitorsMentioned.slice(0, 10).join(', '));
    }

    console.log('\n🟢 SUCCESS: Grok 통합 검증 완료');
  } catch (e: any) {
    console.error(`❌ FAIL (${Date.now() - t0}ms):`, e.message);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
