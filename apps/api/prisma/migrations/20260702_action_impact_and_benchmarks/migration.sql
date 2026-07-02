-- 【본질 강화 1】액션 임팩트 트래킹 — ImprovementAction 스냅샷/성과 컬럼
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "funnel_stage" TEXT;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "expected_effect" TEXT;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "priority" TEXT;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "effort" TEXT;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "baseline_sov" DOUBLE PRECISION;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "baseline_sentiment" DOUBLE PRECISION;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "baseline_r3_rate" DOUBLE PRECISION;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "baseline_responses" INTEGER;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "baseline_window_days" INTEGER;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "outcome_sov" DOUBLE PRECISION;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "outcome_delta_sov" DOUBLE PRECISION;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "outcome_status" TEXT;
ALTER TABLE "improvement_actions" ADD COLUMN IF NOT EXISTS "last_measured_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "improvement_actions_hospital_id_status_idx"
  ON "improvement_actions"("hospital_id", "status");

-- 【본질 강화 2】실측 퍼널 벤치마크 — 진료과 × 단계별 SoV 분포 집계 테이블
CREATE TABLE IF NOT EXISTS "funnel_benchmarks" (
  "id" TEXT NOT NULL,
  "specialty_type" "SpecialtyType" NOT NULL,
  "stage" TEXT NOT NULL,
  "window_days" INTEGER NOT NULL DEFAULT 30,
  "sample_hospitals" INTEGER NOT NULL,
  "sample_responses" INTEGER NOT NULL,
  "avg_sov" DOUBLE PRECISION NOT NULL,
  "p25_sov" DOUBLE PRECISION NOT NULL,
  "p50_sov" DOUBLE PRECISION NOT NULL,
  "p75_sov" DOUBLE PRECISION NOT NULL,
  "benchmark_sov" DOUBLE PRECISION NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "funnel_benchmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "funnel_benchmarks_specialty_type_stage_key"
  ON "funnel_benchmarks"("specialty_type", "stage");
