// Hub SSO 컬럼 보장 — prisma db push가 무관한 스키마 드리프트의 데이터 손실 경고로
// 거부되는 환경에서, 이번 변경분(비파괴 ADD COLUMN 2개 + 인덱스)만 정밀 적용한다.
// 멱등(IF NOT EXISTS)이라 매 빌드 실행해도 안전. DATABASE_URL은 빌드/런타임 env 사용.
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "hospitals" ADD COLUMN IF NOT EXISTS "ps_hospital_id" TEXT')
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "hospitals_ps_hospital_id_key" ON "hospitals"("ps_hospital_id")')
    await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_ps_hospital_id" TEXT')
    await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hub_user_id" TEXT')
    await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hub_email" TEXT')
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "users_hub_user_id_key" ON "users"("hub_user_id")')
    // 【2026-09-14】전국 리더보드(trending) — 병원 무관 기간 스캔용. CONCURRENTLY 로 크롤 쓰기 잠금 없이 생성(멱등)
    await prisma.$executeRawUnsafe('CREATE INDEX CONCURRENTLY IF NOT EXISTS "ai_responses_response_date_idx" ON "ai_responses"("response_date")')
    // 【2026-09-14】AI 답변 등장률 일별 집계 테이블 — 전국 합산을 매일 한 번 미리 계산해 두고 읽기만 한다 (name='*' 행 = 그 병원·플랫폼의 그날 전체 응답 수)
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "mention_daily" ("day" DATE NOT NULL, "hospital_id" TEXT NOT NULL, "name" TEXT NOT NULL, "platform" TEXT NOT NULL, "cnt" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY ("day","hospital_id","name","platform"))')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "mention_daily_day_idx" ON "mention_daily"("day")')
    console.log('[ensure-sso-columns] OK — hospitals.ps_hospital_id, users.pending_ps_hospital_id ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[ensure-sso-columns] FAILED:', e.message)
  process.exit(1)
})
