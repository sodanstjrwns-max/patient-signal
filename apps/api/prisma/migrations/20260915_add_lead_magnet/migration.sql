-- 해외판 무료 프리뷰 리드 — 기존 테이블과 관계 없음, 비파괴 추가
CREATE TABLE IF NOT EXISTS "lead_magnets" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "source" TEXT,
  "ip_hash" TEXT,
  "token" TEXT NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 0,
  "last_sent_at" TIMESTAMP(3),
  "unsubscribed_at" TIMESTAMP(3),

  CONSTRAINT "lead_magnets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_magnets_token_key" ON "lead_magnets"("token");
CREATE INDEX IF NOT EXISTS "lead_magnets_email_language_idx" ON "lead_magnets"("email", "language");
CREATE INDEX IF NOT EXISTS "lead_magnets_created_at_idx" ON "lead_magnets"("created_at");
CREATE INDEX IF NOT EXISTS "lead_magnets_ip_hash_created_at_idx" ON "lead_magnets"("ip_hash", "created_at");
