ALTER TABLE "lead_magnets" ADD COLUMN IF NOT EXISTS "consent_version" TEXT;
ALTER TABLE "lead_magnets" ADD COLUMN IF NOT EXISTS "consent_at" TIMESTAMP(3);
ALTER TABLE "lead_magnets" ADD COLUMN IF NOT EXISTS "attribution" JSONB;
ALTER TABLE "book_purchases" ADD COLUMN IF NOT EXISTS "attribution" JSONB;
