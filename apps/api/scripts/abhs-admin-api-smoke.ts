// Patient Signal - Admin Weights API 스모크 테스트
// 목적: WeightsController가 호출하는 서비스 메서드 체인 검증 (HTTP 없이 직접 호출)
// 사용법: cd apps/api && npx ts-node scripts/abhs-admin-api-smoke.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WeightService } from '../src/scores/weight.service';
import { WeightCalibrationService } from '../src/scores/weight-calibration.service';

async function main() {
  console.log('🧪 Admin Weights API 스모크 테스트 시작\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  let passed = 0;
  let failed = 0;
  const log = (name: string, ok: boolean, detail?: string) => {
    if (ok) { passed++; console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`); }
    else    { failed++; console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`); }
  };

  try {
    const weightService = app.get(WeightService);
    const calibService = app.get(WeightCalibrationService);

    // ── Test 1: GET /admin/weights/active 로직 (dumpActiveWeights + getActiveRun) ──
    console.log('━'.repeat(72));
    console.log('Test 1: GET /admin/weights/active 로직');
    console.log('━'.repeat(72));
    const [weights, activeRun] = await Promise.all([
      weightService.dumpActiveWeights('GLOBAL', 'GLOBAL'),
      weightService.getActiveRun('GLOBAL', 'GLOBAL'),
    ]);
    log('dumpActiveWeights 호출', !!weights);
    log('PLATFORM 키 존재', Array.isArray(weights.PLATFORM) && weights.PLATFORM.length > 0,
        `${weights.PLATFORM?.length ?? 0}개`);
    log('DEPTH 키 존재', Array.isArray(weights.DEPTH) && weights.DEPTH.length > 0,
        `${weights.DEPTH?.length ?? 0}개`);
    log('INTENT 키 존재', Array.isArray(weights.INTENT) && weights.INTENT.length > 0,
        `${weights.INTENT?.length ?? 0}개`);
    log('활성 RUN 존재', !!activeRun, activeRun ? `RUN=${activeRun.id.slice(0, 8)}, by=${activeRun.triggeredBy}` : 'none');

    console.log('\n   📦 현재 활성 PLATFORM 가중치:');
    weights.PLATFORM?.forEach((p: any) => console.log(`      ${p.key.padEnd(12)} = ${p.value}  (${p.source})`));
    console.log('   📦 현재 활성 INTENT 배율:');
    weights.INTENT?.forEach((p: any) => console.log(`      ${p.key.padEnd(14)} = ${p.value}  (${p.source})`));

    // ── Test 2: GET /admin/weights/runs 로직 (getRunHistory) ──
    console.log('\n' + '━'.repeat(72));
    console.log('Test 2: GET /admin/weights/runs 로직');
    console.log('━'.repeat(72));
    const runs = await weightService.getRunHistory('GLOBAL', 'GLOBAL', 20);
    log('getRunHistory 호출', Array.isArray(runs), `${runs.length}개 RUN`);
    if (runs.length > 0) {
      const r = runs[0];
      log('첫 RUN id 존재', !!r.id);
      log('첫 RUN createdAt 존재', !!r.createdAt);
      console.log(`   📅 최신 RUN: ${r.id.slice(0, 8)} | active=${r.isActive} | by=${r.triggeredBy} | ${r.responsesAnalyzed}건`);
    }

    // ── Test 3: GET /admin/weights/runs/:runId 로직 (getRunDetail) ──
    console.log('\n' + '━'.repeat(72));
    console.log('Test 3: GET /admin/weights/runs/:runId 로직');
    console.log('━'.repeat(72));
    if (runs.length > 0) {
      const detail = await weightService.getRunDetail(runs[0].id);
      log('getRunDetail 호출 성공', !!detail);
      log('detail.run 존재', !!detail?.run);
      log('detail.profiles 존재', !!detail?.profiles);
      log('profileCount > 0', (detail?.profileCount ?? 0) > 0, `${detail?.profileCount}개 프로파일`);

      // 없는 runId 케이스
      const notFound = await weightService.getRunDetail('00000000-0000-0000-0000-000000000000');
      log('존재하지 않는 runId → null 반환', notFound === null);
    } else {
      console.log('   ⚠️  RUN이 없어 스킵');
    }

    // ── Test 4: scope validation (BadRequest 시뮬레이션) ──
    console.log('\n' + '━'.repeat(72));
    console.log('Test 4: scope 파싱 로직 (컨트롤러 동작 모방)');
    console.log('━'.repeat(72));
    const parseScope = (scope?: string): string => {
      const upper = (scope || 'GLOBAL').toUpperCase();
      if (upper !== 'GLOBAL' && upper !== 'SPECIALTY' && upper !== 'HOSPITAL') {
        throw new Error(`Invalid scope: ${scope}`);
      }
      return upper;
    };
    log('parseScope(undefined) → GLOBAL', parseScope() === 'GLOBAL');
    log('parseScope("specialty") → SPECIALTY', parseScope('specialty') === 'SPECIALTY');
    log('parseScope("hospital") → HOSPITAL', parseScope('hospital') === 'HOSPITAL');
    try {
      parseScope('FOO');
      log('parseScope("FOO") → throw', false);
    } catch {
      log('parseScope("FOO") → throw', true);
    }

    // ── Test 5: 즉시 캘리브레이션 (DRY_RUN) ──
    console.log('\n' + '━'.repeat(72));
    console.log('Test 5: POST /admin/weights/calibrate-now (DRY_RUN) 로직');
    console.log('━'.repeat(72));
    console.log('   ⏳ 캘리브레이션 중... (~50초 소요)');
    const t0 = Date.now();
    const dryRunResult = await calibService.runCalibration({
      save: false,
      activate: false,
      triggeredBy: 'SMOKE_TEST:admin',
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`calibration DRY_RUN 완료 (${elapsed}s)`, !!dryRunResult);
    log('saved 필드 없음 (dry-run 정상)', dryRunResult.saved === undefined);
    log('insights 생성됨', dryRunResult.insights.length > 0, `${dryRunResult.insights.length}건`);
    log('platformWeights.calibrated 존재', Object.keys(dryRunResult.platformWeights.calibrated).length === 4);

    // ── Test 6: 활성화 RUN 재활성화 멱등성 검증 ──
    // 현재 활성 RUN을 다시 activateRun() 호출 → 에러 없이 동일 상태 유지되어야 함
    console.log('\n' + '━'.repeat(72));
    console.log('Test 6: 활성 RUN 재활성화 멱등성 (현재 active를 다시 activate)');
    console.log('━'.repeat(72));
    if (activeRun) {
      try {
        await weightService.activateRun(activeRun.id, 'SMOKE_TEST:idempotent');
        const reCheck = await weightService.getActiveRun('GLOBAL', 'GLOBAL');
        log('재활성화 후에도 동일 RUN active', reCheck?.id === activeRun.id);
        log('activatedBy 업데이트됨', reCheck?.activatedBy === 'SMOKE_TEST:idempotent');
      } catch (e: any) {
        log('재활성화 에러 없음', false, e.message);
      }
    } else {
      console.log('   ⚠️  활성 RUN 없어 스킵');
    }

    console.log('\n' + '━'.repeat(72));
    console.log(`결과: ✅ ${passed} passed / ❌ ${failed} failed`);
    console.log('━'.repeat(72));
    process.exit(failed === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('❌ 스모크 테스트 예외:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
