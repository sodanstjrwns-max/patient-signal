-- 【P1-6】LLM 비용 추적 컬럼 추가
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER;
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER;
ALTER TABLE "ai_responses" ADD COLUMN IF NOT EXISTS "estimated_cost_usd" DOUBLE PRECISION;

-- 비용 집계 쿼리 최적화 (병원별/기간별 원가 조회)
CREATE INDEX IF NOT EXISTS "ai_responses_hospital_id_created_at_idx" ON "ai_responses"("hospital_id", "created_at");
