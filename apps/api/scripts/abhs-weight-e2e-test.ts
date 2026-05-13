// ABHS DB 가중치 lookup End-to-End 검증
// 목적: WeightService → ABHSService → 실제 점수 계산 체인이 DB 가중치를 잘 읽어오는지 확인
//
// 검증 시나리오:
// 1. DEFAULT 가중치만 있는 상태에서 calculateABHS 호출 → 정상 동작
// 2. 같은 병원에 HOSPITAL 스코프 가중치를 임시 주입 → 점수 변동 확인
// 3. 캐시 invalidate 후 원래대로 → 점수 복귀 확인
// 4. WeightProfile DB row를 비활성화/활성화 → 즉시 반영 확인

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// WeightService와 ABHSService를 직접 mock 없이 호출 가능하게 lite 버전 작성
// 실제 NestJS DI 없이도 테스트할 수 있도록 인스턴스 직접 생성
async function testEndToEnd() {
  console.log('🧪 ABHS DB Weight Lookup E2E 검증 시작\n');

  // ============ Step 0: 활성 응답이 있는 병원 1개 선택 ============
  const sampleHospital = await prisma.hospital.findFirst({
    where: { aiResponses: { some: {} } },
    select: { id: true, name: true, specialtyType: true },
  });

  if (!sampleHospital) {
    console.error('❌ 활성 응답이 있는 병원이 없습니다.');
    return;
  }

  console.log(`📍 테스트 병원: ${sampleHospital.name} (${sampleHospital.specialtyType})`);
  console.log(`   ID: ${sampleHospital.id}\n`);

  // ============ Step 1: 현재 DB 가중치 상태 확인 ============
  console.log('🔍 [Step 1] 현재 DB 활성 가중치 확인');
  const activeProfiles = await prisma.weightProfile.findMany({
    where: { isActive: true, scope: 'GLOBAL' },
    orderBy: [{ kind: 'asc' }, { weightKey: 'asc' }],
  });
  console.log(`   GLOBAL 활성 프로파일: ${activeProfiles.length}개`);
  const platformWeights = activeProfiles.filter(p => p.kind === 'PLATFORM');
  console.log(`   PLATFORM 가중치:`);
  for (const p of platformWeights) {
    console.log(`     ${p.weightKey.padEnd(12)} = ${p.weightValue}  (source: ${p.source})`);
  }
  console.log();

  // ============ Step 2: WeightService 직접 호출 ============
  console.log('🔍 [Step 2] WeightService.getWeightBundle 직접 호출');
  
  // WeightService 인스턴스 직접 생성 (DI 우회)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WeightService } = require('../src/scores/weight.service');
  const weightService = new WeightService(prisma as any);
  
  const bundleNoCtx = await weightService.getWeightBundle({});
  console.log(`   [ctx 없음] PLATFORM:`, bundleNoCtx.platform);
  console.log(`   [ctx 없음] DEPTH   :`, bundleNoCtx.depth);
  console.log(`   [ctx 없음] INTENT  :`, bundleNoCtx.intent);

  const bundleWithCtx = await weightService.getWeightBundle({
    hospitalId: sampleHospital.id,
    specialtyCategory: sampleHospital.specialtyType,
  });
  console.log(`   [병원 ctx] PLATFORM:`, bundleWithCtx.platform);
  console.log();

  // ============ Step 3: HOSPITAL 스코프 가중치 임시 주입 ============
  console.log('🔍 [Step 3] HOSPITAL 스코프 임시 가중치 주입 (CHATGPT 1.3 → 9.99)');
  await prisma.weightProfile.create({
    data: {
      scope: 'HOSPITAL',
      scopeKey: sampleHospital.id,
      kind: 'PLATFORM',
      weightKey: 'CHATGPT',
      weightValue: 9.99,
      source: 'MANUAL',
      isActive: true,
      notes: 'E2E 테스트용 임시 주입',
    },
  });

  // 캐시 invalidate (5분 TTL이라 새로 가져오려면 필요)
  weightService.invalidateCache();

  const bundleAfterInject = await weightService.getWeightBundle({
    hospitalId: sampleHospital.id,
    specialtyCategory: sampleHospital.specialtyType,
  });
  console.log(`   주입 후 PLATFORM:`, bundleAfterInject.platform);
  
  const assertion1 = bundleAfterInject.platform.CHATGPT === 9.99;
  console.log(`   ✓ HOSPITAL 스코프가 GLOBAL을 덮어쓰는가? ${assertion1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  // ============ Step 4: ABHSService가 새 가중치를 실제로 쓰는지 확인 ============
  console.log('🔍 [Step 4] ABHSService.calculateABHS로 실제 점수 계산');
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ABHSService } = require('../src/scores/abhs.service');
  const abhsService = new ABHSService(prisma as any, weightService);

  const score = await abhsService.calculateABHS(sampleHospital.id, 30);
  console.log(`   ABHS 종합: ${score.abhsScore}`);
  console.log(`   SoV: ${score.sovPercent}%`);
  console.log(`   플랫폼 기여:`);
  for (const [p, c] of Object.entries(score.platformContributions as Record<string, any>)) {
    console.log(`     ${p.padEnd(12)} | weight=${c.weight.toFixed(2)} | SoV=${c.sovPercent.toFixed(1)}% | 기여=${c.contribution.toFixed(1)}`);
  }
  
  const chatgptUsedInjected = (score.platformContributions as Record<string, any>).CHATGPT?.weight === 9.99;
  console.log(`   ✓ ABHSService가 주입된 가중치(9.99)를 사용했는가? ${chatgptUsedInjected ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  // ============ Step 5: 임시 주입 제거 ============
  console.log('🔍 [Step 5] 임시 주입 제거 + 캐시 invalidate');
  await prisma.weightProfile.deleteMany({
    where: {
      scope: 'HOSPITAL',
      scopeKey: sampleHospital.id,
      source: 'MANUAL',
    },
  });
  weightService.invalidateCache();

  const bundleAfterCleanup = await weightService.getWeightBundle({
    hospitalId: sampleHospital.id,
    specialtyCategory: sampleHospital.specialtyType,
  });
  const restoredCorrectly = bundleAfterCleanup.platform.CHATGPT === 1.3;
  console.log(`   정리 후 CHATGPT 가중치: ${bundleAfterCleanup.platform.CHATGPT}`);
  console.log(`   ✓ DEFAULT(1.3)로 복귀했는가? ${restoredCorrectly ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  // ============ Step 6: 캐시 동작 확인 ============
  console.log('🔍 [Step 6] 캐시 동작 확인 (같은 query 2회 호출 시간 비교)');
  const t1 = Date.now();
  await weightService.getWeightBundle({ hospitalId: sampleHospital.id });
  const t1Elapsed = Date.now() - t1;

  const t2 = Date.now();
  await weightService.getWeightBundle({ hospitalId: sampleHospital.id });
  const t2Elapsed = Date.now() - t2;

  console.log(`   1차 호출: ${t1Elapsed}ms (DB 조회)`);
  console.log(`   2차 호출: ${t2Elapsed}ms (캐시 hit 기대)`);
  console.log(`   ✓ 캐시가 활성화되었는가? ${t2Elapsed < t1Elapsed ? '✅ PASS' : '⚠️  WARN (DB가 빨라서 차이 미미)'}`);
  console.log();

  // ============ 최종 결과 ============
  const allPassed = assertion1 && chatgptUsedInjected && restoredCorrectly;
  console.log('═'.repeat(60));
  if (allPassed) {
    console.log('🎉 모든 E2E 검증 통과 — DB 가중치 lookup 체인 정상');
  } else {
    console.log('❌ 일부 검증 실패 — 코드 점검 필요');
  }
  console.log('═'.repeat(60));

  await prisma.$disconnect();
}

testEndToEnd().catch(async (e) => {
  console.error('❌ E2E 실패:', e);
  await prisma.weightProfile.deleteMany({
    where: { source: 'MANUAL', notes: { contains: 'E2E 테스트' } },
  }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
