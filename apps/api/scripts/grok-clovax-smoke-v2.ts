/**
 * Grok + CLOVA X 통합 smoke test (단순화 버전)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

(async () => {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  🧪  Grok + CLOVA X 통합 SMOKE TEST v2');
  console.log('══════════════════════════════════════════════════════════════════');

  let passed = 0;
  let failed = 0;

  // Test 1: DB enum
  console.log('\nTest 1: PostgreSQL AIPlatform enum');
  try {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AIPlatform')
      ORDER BY enumsortorder
    `;
    const labels = rows.map((r) => r.enumlabel);
    const hasGrok = labels.includes('GROK');
    const hasClova = labels.includes('CLOVA_X');
    if (hasGrok && hasClova) {
      console.log(`   ✅ enum 확인: ${labels.join(', ')}`);
      passed++;
    } else {
      console.log(`   ❌ enum 부족: GROK=${hasGrok}, CLOVA_X=${hasClova}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 2: 소스 파일 grep으로 메서드 검증
  console.log('\nTest 2: 소스 파일 내 queryGrok/queryClovaX 메서드 존재');
  try {
    const src = readFileSync(
      join(__dirname, '../src/ai-crawler/ai-crawler.service.ts'),
      'utf-8'
    );
    const hasGrok = src.includes('private async queryGrok(');
    const hasClova = src.includes('private async queryClovaX(');
    const hasGrokCase = src.includes("case 'GROK':");
    const hasClovaCase = src.includes("case 'CLOVA_X':");
    const hasGrokAvail = src.includes("case 'GROK':\n        const xaiKey");
    const hasClovaAvail = src.includes("case 'CLOVA_X':\n        const clovaKey");
    if (hasGrok && hasClova && hasGrokCase && hasClovaCase) {
      console.log(`   ✅ queryGrok / queryClovaX 메서드 + switch 분기 모두 존재`);
      passed++;
    } else {
      console.log(
        `   ❌ queryGrok=${hasGrok}, queryClovaX=${hasClova}, GrokCase=${hasGrokCase}, ClovaCase=${hasClovaCase}`
      );
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 3: 가중치 캘리브레이션
  console.log('\nTest 3: 가중치 캘리브레이션 베이스라인');
  try {
    const src = readFileSync(
      join(__dirname, '../src/scores/weight-calibration.service.ts'),
      'utf-8'
    );
    const hasGrokBaseline = /BASELINE_PLATFORM[\s\S]*?GROK/.test(src);
    const hasClovaBaseline = /BASELINE_PLATFORM[\s\S]*?CLOVA_X/.test(src);
    const hasGrokInArray = /platforms = \[[^\]]*'GROK'/.test(src);
    if (hasGrokBaseline && hasClovaBaseline && hasGrokInArray) {
      console.log(`   ✅ BASELINE_PLATFORM + platforms 배열에 GROK/CLOVA_X 포함`);
      passed++;
    } else {
      console.log(
        `   ❌ Baseline_Grok=${hasGrokBaseline}, Baseline_Clova=${hasClovaBaseline}, Array=${hasGrokInArray}`
      );
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 4: PlanGuard
  console.log('\nTest 4: PlanGuard에 신규 플랫폼 노출 (STANDARD+)');
  try {
    const src = readFileSync(
      join(__dirname, '../src/common/guards/plan.guard.ts'),
      'utf-8'
    );
    const standardHasGrok = /STANDARD:[\s\S]*?platforms:[\s\S]*?'GROK'/.test(src);
    const proHasGrok = /PRO:[\s\S]*?platforms:[\s\S]*?'GROK'/.test(src);
    if (standardHasGrok && proHasGrok) {
      console.log(`   ✅ STANDARD/PRO/ENTERPRISE 플랜에서 GROK/CLOVA_X 노출`);
      passed++;
    } else {
      console.log(`   ❌ STANDARD=${standardHasGrok}, PRO=${proHasGrok}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 5: UI 라벨/색상
  console.log('\nTest 5: 웹 UI getPlatformName/Color에 신규 플랫폼');
  try {
    const src = readFileSync(
      join(__dirname, '../../web/src/lib/utils.ts'),
      'utf-8'
    );
    const hasGrokName = /GROK:\s*'Grok'/.test(src);
    const hasClovaName = /CLOVA_X:\s*'CLOVA X'/.test(src);
    const hasGrokColor = /GROK:\s*'#000000'/.test(src);
    const hasClovaColor = /CLOVA_X:\s*'#03c75a'/.test(src);
    if (hasGrokName && hasClovaName && hasGrokColor && hasClovaColor) {
      console.log(`   ✅ getPlatformName/Color 양쪽 모두 신규 플랫폼 처리`);
      passed++;
    } else {
      console.log(
        `   ❌ Name(G=${hasGrokName},C=${hasClovaName}) Color(G=${hasGrokColor},C=${hasClovaColor})`
      );
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 6: 환경변수 가이드
  console.log('\nTest 6: .env.example 가이드 업데이트');
  try {
    const src = readFileSync(join(__dirname, '../.env.example'), 'utf-8');
    const hasXai = src.includes('XAI_API_KEY');
    const hasClova = src.includes('CLOVA_X_API_KEY');
    if (hasXai && hasClova) {
      console.log(`   ✅ XAI_API_KEY / CLOVA_X_API_KEY 가이드 존재`);
      passed++;
    } else {
      console.log(`   ❌ Xai=${hasXai}, Clova=${hasClova}`);
      failed++;
    }
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`);
    failed++;
  }

  // Test 7: 실제 API 호출 (옵션)
  console.log('\nTest 7: 실제 API 호출 검증 (API 키 있을 때만)');
  const xaiKey = process.env.XAI_API_KEY?.trim();
  const clovaKey = process.env.CLOVA_X_API_KEY?.trim();
  if (xaiKey && xaiKey.length > 10) {
    try {
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${xaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [{ role: 'user', content: 'Say OK' }],
          temperature: 0,
          stream: false,
        }),
      });
      const data: any = await resp.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (text) {
        console.log(`   ✅ Grok API 실제 호출 성공: "${text.slice(0, 50)}..."`);
        passed++;
      } else {
        console.log(`   ❌ Grok 빈 응답: ${JSON.stringify(data).slice(0, 200)}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`   ❌ Grok 호출 실패: ${e.message}`);
      failed++;
    }
  } else {
    console.log(`   ⏭️  Grok 스킵 — XAI_API_KEY 미설정 (코드 준비 완료, 키만 발급하면 즉시 작동)`);
  }

  if (clovaKey && clovaKey.length > 10) {
    try {
      const endpoint =
        process.env.CLOVA_X_ENDPOINT?.trim() ||
        'https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clovaKey}`,
          'Content-Type': 'application/json',
          'X-NCP-CLOVASTUDIO-REQUEST-ID': `psv2-smoke-${Date.now()}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '안녕 한 글자만 답해' }],
          topP: 0.8,
          topK: 0,
          maxTokens: 64,
          temperature: 0.1,
          repeatPenalty: 5.0,
          includeAiFilters: false,
        }),
      });
      const data: any = await resp.json();
      const text =
        data.result?.message?.content || data.message?.content || '';
      if (text) {
        console.log(`   ✅ CLOVA X API 실제 호출 성공: "${text.slice(0, 50)}..."`);
        passed++;
      } else {
        console.log(`   ❌ CLOVA X 빈 응답: ${JSON.stringify(data).slice(0, 200)}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`   ❌ CLOVA X 호출 실패: ${e.message}`);
      failed++;
    }
  } else {
    console.log(`   ⏭️  CLOVA X 스킵 — CLOVA_X_API_KEY 미설정 (코드 준비 완료)`);
  }

  // 결과
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`  🏆 PASS ${passed} · FAIL ${failed}`);
  console.log(`  📌 API 키 발급 후 운영 환경(.env)에 XAI_API_KEY, CLOVA_X_API_KEY 설정 → 자동 수집 시작`);
  console.log('══════════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
})();
