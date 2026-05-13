-- ABHS Weight Calibration (Phase A / Tier 1)
-- 직관 기반 하드코딩 가중치를 실데이터 캘리브레이션 결과로 대체하는 인프라
-- 스코프: GLOBAL > SPECIALTY > HOSPITAL (구체적인 것이 우선)

-- CreateEnum
CREATE TYPE "WeightScope" AS ENUM ('GLOBAL', 'SPECIALTY', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "WeightKind" AS ENUM ('PLATFORM', 'DEPTH', 'INTENT', 'SENTIMENT');

-- CreateTable: 캘리브레이션 실행 이력
CREATE TABLE "weight_calibration_runs" (
    "id"                  TEXT NOT NULL,
    "triggered_by"        TEXT NOT NULL DEFAULT 'SYSTEM',
    "scope"               "WeightScope" NOT NULL DEFAULT 'GLOBAL',
    "scope_key"           TEXT NOT NULL DEFAULT 'GLOBAL',
    "data_range_days"     INTEGER NOT NULL,
    "responses_analyzed"  INTEGER NOT NULL,
    "hospitals_analyzed"  INTEGER NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'COMPLETED',
    "insights_json"       JSONB,
    "weight_diffs"        JSONB,
    "score_impact_json"   JSONB,
    "error_message"       TEXT,
    "is_active"           BOOLEAN NOT NULL DEFAULT false,
    "activated_at"        TIMESTAMP(3),
    "activated_by"        TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_calibration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 가중치 프로파일 (실제 사용되는 가중치 값)
CREATE TABLE "weight_profiles" (
    "id"                  TEXT NOT NULL,
    "scope"               "WeightScope" NOT NULL DEFAULT 'GLOBAL',
    "kind"                "WeightKind" NOT NULL,
    "scope_key"           TEXT NOT NULL DEFAULT 'GLOBAL',
    "weight_key"          TEXT NOT NULL,
    "weight_value"        DOUBLE PRECISION NOT NULL,
    "is_active"           BOOLEAN NOT NULL DEFAULT true,
    "source"              TEXT NOT NULL DEFAULT 'CALIBRATED',
    "calibration_run_id"  TEXT,
    "evidence"            JSONB,
    "notes"               TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_profiles_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "weight_profiles_scope_scope_key_kind_weight_key_key"
  ON "weight_profiles"("scope", "scope_key", "kind", "weight_key");

CREATE INDEX "weight_profiles_scope_kind_is_active_idx"
  ON "weight_profiles"("scope", "kind", "is_active");

CREATE INDEX "weight_profiles_scope_key_idx" ON "weight_profiles"("scope_key");

CREATE INDEX "weight_calibration_runs_scope_scope_key_is_active_idx"
  ON "weight_calibration_runs"("scope", "scope_key", "is_active");

CREATE INDEX "weight_calibration_runs_status_idx" ON "weight_calibration_runs"("status");

CREATE INDEX "weight_calibration_runs_created_at_idx" ON "weight_calibration_runs"("created_at");

-- ForeignKey
ALTER TABLE "weight_profiles"
  ADD CONSTRAINT "weight_profiles_calibration_run_id_fkey"
  FOREIGN KEY ("calibration_run_id") REFERENCES "weight_calibration_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ 시드: 기존 하드코딩 가중치를 DEFAULT 프로파일로 등록 ============
-- 이렇게 하면 fallback이 항상 보장되고, 캘리브레이션 안 돌아간 시점도 안전함

-- PLATFORM (기존 하드코딩 값)
INSERT INTO "weight_profiles" (id, scope, scope_key, kind, weight_key, weight_value, source, notes, updated_at) VALUES
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'PLATFORM', 'CHATGPT',    1.30, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'PLATFORM', 'PERPLEXITY', 1.40, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'PLATFORM', 'GEMINI',     1.20, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'PLATFORM', 'CLAUDE',     1.00, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP);

-- DEPTH
INSERT INTO "weight_profiles" (id, scope, scope_key, kind, weight_key, weight_value, source, notes, updated_at) VALUES
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'DEPTH', 'R0', 0.0, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'DEPTH', 'R1', 1.5, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'DEPTH', 'R2', 3.0, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'DEPTH', 'R3', 4.0, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP);

-- INTENT
INSERT INTO "weight_profiles" (id, scope, scope_key, kind, weight_key, weight_value, source, notes, updated_at) VALUES
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'INTENT', 'RESERVATION', 1.5, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'INTENT', 'REVIEW',      1.3, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'INTENT', 'FEAR',        1.2, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'INTENT', 'COMPARISON',  1.1, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'INTENT', 'INFORMATION', 1.0, 'DEFAULT', '초기 하드코딩 값', CURRENT_TIMESTAMP);

-- SENTIMENT (V2 매핑값)
INSERT INTO "weight_profiles" (id, scope, scope_key, kind, weight_key, weight_value, source, notes, updated_at) VALUES
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'SENTIMENT', '-2', 0.00, 'DEFAULT', '강한 부정', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'SENTIMENT', '-1', 0.25, 'DEFAULT', '부정',      CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'SENTIMENT',  '0', 0.50, 'DEFAULT', '중립',      CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'SENTIMENT',  '1', 1.00, 'DEFAULT', '긍정',      CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GLOBAL', 'GLOBAL', 'SENTIMENT',  '2', 1.50, 'DEFAULT', '강한 긍정', CURRENT_TIMESTAMP);
