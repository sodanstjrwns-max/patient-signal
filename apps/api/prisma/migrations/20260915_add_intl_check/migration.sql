-- 해외판 AI 가시성 체크(리드 마그넷) 결과 테이블 — 기존 테이블과 관계 없음, 비파괴 추가
CREATE TABLE IF NOT EXISTS "intl_checks" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email" TEXT NOT NULL,
  "clinic_name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "website" TEXT,
  "specialty" TEXT NOT NULL DEFAULT 'dental',
  "ip_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "result_json" JSONB,
  "emailed_at" TIMESTAMP(3),
  "waitlist" BOOLEAN NOT NULL DEFAULT false,
  "error_message" TEXT,

  CONSTRAINT "intl_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intl_checks_email_created_at_idx" ON "intl_checks"("email", "created_at");
CREATE INDEX IF NOT EXISTS "intl_checks_ip_hash_created_at_idx" ON "intl_checks"("ip_hash", "created_at");
CREATE INDEX IF NOT EXISTS "intl_checks_created_at_idx" ON "intl_checks"("created_at");
