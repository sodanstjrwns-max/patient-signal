/**
 * Grok + CLOVA X 통합 스모크 테스트 (경량 버전)
 *
 * 목적: NestJS 전체 부트 없이 핵심 통합만 빠르게 검증
 *  1. AIPlatform enum에 GROK/CLOVA_X 존재 확인
 *  2. Prisma TypeScript enum 동기화
 *  3. DB INSERT 호환 (트랜잭션 롤백)
 *  4. AICrawlerService 소스 코드에 GROK/CLOVA_X 케이스 포함되는지 (정적 검증)
 *  5. WeightCalibrationService 소스 코드에 GROK/CLOVA_X 포함되는지
 *  6. .env.example에 가이드 명시되어 있는지
 */

import { PrismaClient, AIPlatform } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════════════');
  console.log('  🧪  Grok + CLOVA X 통합 스모크 테스트 (경량)');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }> = [];
  const ROOT = path.resolve(__dirname, '..');

  // === 1. DB enum 확인 ===
  try {
    const enumRows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AIPlatform')
    `;
    const labels = enumRows.map((r) => r.enumlabel);
    const hasGrok = labels.includes('GROK');
    const hasClovaX = labels.includes('CLOVA_X');
    results.push({
      name: '1. DB AIPlatform enum 확장',
      status: hasGrok && hasClovaX ? 'PASS' : 'FAIL',
      detail: `현재 enum: [${labels.join(', ')}]`,
    });
  } catch (e: any) {
    results.push({ name: '1. DB AIPlatform enum 확장', status: 'FAIL', detail: e.message });
  }

  // === 2. Prisma TypeScript enum ===
  try {
    const grokVal = AIPlatform.GROK;
    const clovaVal = AIPlatform.CLOVA_X;
    results.push({
      name: '2. Prisma TypeScript enum 동기화',
      status: grokVal === 'GROK' && clovaVal === 'CLOVA_X' ? 'PASS' : 'FAIL',
      detail: `AIPlatform.GROK="${grokVal}", AIPlatform.CLOVA_X="${clovaVal}"`,
    });
  } catch (e: any) {
    results.push({ name: '2. Prisma TypeScript enum 동기화', status: 'FAIL', detail: e.message });
  }

  // === 3. DB INSERT 호환 (트랜잭션 롤백) ===
  try {
    const hospital = await prisma.hospital.findFirst({ select: { id: true } });
    const prompt = await prisma.prompt.findFirst({ select: { id: true } });
    if (!hospital || !prompt) throw new Error('테스트 hospital/prompt 없음');

    let grokOK = false;
    let clovaOK = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.aIResponse.create({
          data: {
            promptId: prompt.id,
            hospitalId: hospital.id,
            aiPlatform: 'GROK',
            responseText: '[SMOKE] Grok integration check',
            responseDate: new Date(),
            isMentioned: false,
          },
        });
        grokOK = true;

        await tx.aIResponse.create({
          data: {
            promptId: prompt.id,
            hospitalId: hospital.id,
            aiPlatform: 'CLOVA_X',
            responseText: '[SMOKE] CLOVA X integration check',
            responseDate: new Date(),
            isMentioned: false,
          },
        });
        clovaOK = true;

        throw new Error('__ROLLBACK__');
      });
    } catch (e: any) {
      if (e.message !== '__ROLLBACK__') throw e;
    }

    results.push({
      name: '3. DB INSERT 호환 (롤백)',
      status: grokOK && clovaOK ? 'PASS' : 'FAIL',
      detail: `GROK=${grokOK}, CLOVA_X=${clovaOK}, 데이터 오염 없음`,
    });
  } catch (e: any) {
    results.push({ name: '3. DB INSERT 호환', status: 'FAIL', detail: e.message });
  }

  // === 4. AICrawlerService 소스 검증 ===
  try {
    const src = fs.readFileSync(path.join(ROOT, 'src/ai-crawler/ai-crawler.service.ts'), 'utf-8');
    const checks = [
      { name: "case 'GROK': switch 분기", regex: /case 'GROK':\s*\n\s*return this\.withRetry/m },
      { name: "case 'CLOVA_X': switch 분기", regex: /case 'CLOVA_X':\s*\n\s*return this\.withRetry/m },
      { name: 'queryGrok 메서드', regex: /private async queryGrok\(/m },
      { name: 'queryClovaX 메서드', regex: /private async queryClovaX\(/m },
      { name: "isPlatformAvailable GROK", regex: /case 'GROK':\s*\n\s*const xaiKey/m },
      { name: "isPlatformAvailable CLOVA_X", regex: /case 'CLOVA_X':\s*\n\s*const clovaKey/m },
      { name: 'PlatformWeight GROK', regex: /GROK:\s*[\d.]+,/m },
      { name: 'PlatformWeight CLOVA_X', regex: /CLOVA_X:\s*[\d.]+,/m },
      { name: 'PlatformReliability GROK', regex: /GROK:\s*0\.\d+/m },
      { name: 'PlatformReliability CLOVA_X', regex: /CLOVA_X:\s*0\.\d+/m },
    ];
    const failed = checks.filter((c) => !c.regex.test(src));
    results.push({
      name: '4. AICrawlerService 통합 (정적)',
      status: failed.length === 0 ? 'PASS' : 'FAIL',
      detail:
        failed.length === 0
          ? `${checks.length}개 통합점 모두 확인`
          : `누락: ${failed.map((f) => f.name).join(', ')}`,
    });
  } catch (e: any) {
    results.push({ name: '4. AICrawlerService 통합', status: 'FAIL', detail: e.message });
  }

  // === 5. WeightCalibrationService 통합 ===
  try {
    const src = fs.readFileSync(path.join(ROOT, 'src/scores/weight-calibration.service.ts'), 'utf-8');
    const hasGrok = /GROK['"]?\s*[,:]/m.test(src);
    const hasClova = /CLOVA_X['"]?\s*[,:]/m.test(src);
    const hasPlatformArray = /platforms\s*=\s*\[[^\]]*'GROK'[^\]]*'CLOVA_X'[^\]]*\]/m.test(src);
    results.push({
      name: '5. WeightCalibration 통합',
      status: hasGrok && hasClova && hasPlatformArray ? 'PASS' : 'FAIL',
      detail: `BASELINE_PLATFORM=${hasGrok && hasClova}, platforms 배열 확장=${hasPlatformArray}`,
    });
  } catch (e: any) {
    results.push({ name: '5. WeightCalibration 통합', status: 'FAIL', detail: e.message });
  }

  // === 6. .env.example 가이드 ===
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf-8');
    const hasXAI = /XAI_API_KEY/.test(env);
    const hasClova = /CLOVA_X_API_KEY/.test(env);
    const hasGuide = /xAI|Grok/i.test(env) && /CLOVA|Naver/i.test(env);
    results.push({
      name: '6. .env.example 가이드',
      status: hasXAI && hasClova && hasGuide ? 'PASS' : 'FAIL',
      detail: `XAI_API_KEY=${hasXAI}, CLOVA_X_API_KEY=${hasClova}, 가이드 코멘트=${hasGuide}`,
    });
  } catch (e: any) {
    results.push({ name: '6. .env.example 가이드', status: 'FAIL', detail: e.message });
  }

  // === 7. 마이그레이션 파일 존재 ===
  try {
    const migPath = path.join(ROOT, 'prisma/migrations/20260520_add_grok_clovax_platforms/migration.sql');
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      const hasGrok = /ADD VALUE.*GROK/i.test(sql);
      const hasClova = /ADD VALUE.*CLOVA_X/i.test(sql);
      results.push({
        name: '7. 마이그레이션 파일',
        status: hasGrok && hasClova ? 'PASS' : 'FAIL',
        detail: `migration.sql 존재, ADD VALUE GROK=${hasGrok}, CLOVA_X=${hasClova}`,
      });
    } else {
      results.push({
        name: '7. 마이그레이션 파일',
        status: 'FAIL',
        detail: '파일 없음',
      });
    }
  } catch (e: any) {
    results.push({ name: '7. 마이그레이션 파일', status: 'FAIL', detail: e.message });
  }

  // === 결과 출력 ===
  console.log(`총 ${results.length}개 테스트\n`);
  let passCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    if (r.status === 'PASS') passCount++;
    console.log(`   ${icon} ${r.name}`);
    console.log(`      └─ ${r.detail}\n`);
  }

  console.log('══════════════════════════════════════════════════════════════════════════════');
  if (passCount === results.length) {
    console.log(`  🏆 전체 ${results.length}/${results.length} PASS — Grok + CLOVA X 통합 완료`);
    console.log(`  📋 다음 단계: XAI_API_KEY + CLOVA_X_API_KEY 발급 후 .env에 설정 → 자동 수집 가동`);
  } else {
    console.log(`  ⚠️  ${passCount}/${results.length} PASS`);
  }
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error('❌ 실패:', e);
  await prisma.$disconnect();
  process.exit(1);
});
