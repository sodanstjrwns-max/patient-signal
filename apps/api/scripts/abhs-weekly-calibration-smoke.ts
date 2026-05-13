// Patient Signal - Weekly Calibration 스모크 테스트
// 목적: NestJS 컨텍스트에서 WeightCalibrationService DI + 호출 체인 검증 (dry-run)
// 사용법: cd apps/api && npx ts-node scripts/abhs-weekly-calibration-smoke.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { WeightCalibrationService } from '../src/scores/weight-calibration.service';

async function main() {
  console.log('🧪 Weekly Calibration 스모크 테스트 시작\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    // ── Test 1: DI 체인 확인 ──
    console.log('━'.repeat(72));
    console.log('Test 1: DI 체인 확인');
    console.log('━'.repeat(72));
    const calibService = app.get(WeightCalibrationService);
    const schedulerService = app.get(SchedulerService);
    console.log(`✅ WeightCalibrationService 주입 OK: ${calibService.constructor.name}`);
    console.log(`✅ SchedulerService 주입 OK: ${schedulerService.constructor.name}`);

    // ── Test 2: Dry-run 캘리브레이션 (DB 저장 없이) ──
    console.log('\n' + '━'.repeat(72));
    console.log('Test 2: Dry-run 캘리브레이션 (save=false)');
    console.log('━'.repeat(72));
    const t0 = Date.now();
    const result = await calibService.runCalibration({
      save: false,
      activate: false,
      triggeredBy: 'SMOKE_TEST',
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`\n⏱️  소요시간: ${elapsed}s`);
    console.log(`📊 데이터 스코프: ${result.dataScope.totalResponses}건 / ${result.dataScope.rangeDays}일 / ${result.dataScope.activeHospitals}병원`);
    console.log(`\n🌐 플랫폼 가중치 (calibrated):`);
    Object.entries(result.platformWeights.calibrated).forEach(([k, v]) => console.log(`     ${k.padEnd(12)} = ${v}`));
    console.log(`\n🎯 추천깊이 점수 (calibrated):`);
    Object.entries(result.depthScores.calibrated).forEach(([k, v]) => console.log(`     ${k.padEnd(12)} = ${v}`));
    console.log(`\n💭 의도 배율 (calibrated):`);
    Object.entries(result.intentMultipliers.calibrated).forEach(([k, v]) => console.log(`     ${k.padEnd(12)} = ${v}`));
    console.log(`\n💡 Insights: ${result.insights.length}건`);
    result.insights.forEach(i => console.log(`     ${i}`));

    if (result.saved) {
      console.error('❌ 예상 외: saved 필드가 존재 (dry-run인데 저장됨!)');
      process.exit(1);
    } else {
      console.log(`\n✅ saved 필드 없음 (dry-run 정상)`);
    }

    // ── Test 3: SchedulerService.runWeeklyWeightCalibration() 직접 호출 ──
    // ⚠️ 이건 실제로 DB에 RUN을 생성하므로 스킵 (--full 플래그 시에만 실행)
    if (process.argv.includes('--full')) {
      console.log('\n' + '━'.repeat(72));
      console.log('Test 3: SchedulerService.runWeeklyWeightCalibration() FULL (실제 DB 저장)');
      console.log('━'.repeat(72));
      const t1 = Date.now();
      const weekly = await schedulerService.runWeeklyWeightCalibration();
      const elapsed2 = ((Date.now() - t1) / 1000).toFixed(1);
      console.log(`\n⏱️  소요시간: ${elapsed2}s`);
      console.log(`📦 결과:`, JSON.stringify({
        success: weekly.success,
        runId: weekly.runId,
        profilesUpserted: weekly.profilesUpserted,
        activated: weekly.activated,
        bigDeltaCount: weekly.bigDeltaCount,
        insightCount: weekly.insights.length,
      }, null, 2));

      if (weekly.activated) {
        console.error('❌ 위험: activated=true! 자동 활성화는 금지되어야 합니다.');
        process.exit(1);
      } else {
        console.log(`\n✅ activated=false 확인 (안전 정책 작동)`);
      }
    } else {
      console.log('\n💡 Test 3 (FULL 모드) 스킵 — 실제 DB 저장 테스트는 --full 플래그 필요');
    }

    console.log('\n' + '━'.repeat(72));
    console.log('✅ 스모크 테스트 전체 통과');
    console.log('━'.repeat(72));
  } catch (error: any) {
    console.error('❌ 스모크 테스트 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
