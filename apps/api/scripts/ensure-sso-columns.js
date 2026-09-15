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
    // 【2026-09-14】전국 등장률(trending) — 병원 무관 기간 스캔용 인덱스. CONCURRENTLY 는 풀러(트랜잭션 모드)에서 거부될 수 있어
    //  실패하면 일반 CREATE INDEX 로 재시도하고, 그래도 실패해도 빌드는 막지 않는다(인덱스는 성능 문제일 뿐 기능 문제가 아님).
    try {
      await prisma.$executeRawUnsafe('CREATE INDEX CONCURRENTLY IF NOT EXISTS "ai_responses_response_date_idx" ON "ai_responses"("response_date")')
    } catch (e1) {
      console.warn('[ensure-sso-columns] CONCURRENTLY 인덱스 실패 → 일반 인덱스로 재시도:', e1.message)
      try {
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ai_responses_response_date_idx" ON "ai_responses"("response_date")')
      } catch (e2) {
        console.warn('[ensure-sso-columns] 인덱스 생성 건너뜀:', e2.message)
      }
    }
    // 【2026-09-14】AI 답변 등장률 일별 집계 테이블 — 전국 합산을 매일 한 번 미리 계산해 두고 읽기만 한다 (name='*' 행 = 그 병원·플랫폼의 그날 전체 응답 수)
    try {
      await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "mention_daily" ("day" DATE NOT NULL, "hospital_id" TEXT NOT NULL, "name" TEXT NOT NULL, "platform" TEXT NOT NULL, "cnt" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY ("day","hospital_id","name","platform"))')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "mention_daily_day_idx" ON "mention_daily"("day")')
    } catch (e3) {
      console.warn('[ensure-sso-columns] mention_daily 생성 실패(조회는 실시간 폴백):', e3.message)
    }
    // 【2026-09-15】해외판 AI 가시성 체크(intl_checks) — prisma db push 가 드리프트 경고로 거부되는 환경 대비, 마이그레이션 SQL 을 멱등 적용
    try {
      await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "intl_checks" ("id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "email" TEXT NOT NULL, "clinic_name" TEXT NOT NULL, "city" TEXT NOT NULL, "country" TEXT NOT NULL, "language" TEXT NOT NULL DEFAULT \'en\', "website" TEXT, "specialty" TEXT NOT NULL DEFAULT \'dental\', "ip_hash" TEXT, "status" TEXT NOT NULL DEFAULT \'PENDING\', "result_json" JSONB, "emailed_at" TIMESTAMP(3), "waitlist" BOOLEAN NOT NULL DEFAULT false, "error_message" TEXT, CONSTRAINT "intl_checks_pkey" PRIMARY KEY ("id"))')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "intl_checks_email_created_at_idx" ON "intl_checks"("email", "created_at")')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "intl_checks_ip_hash_created_at_idx" ON "intl_checks"("ip_hash", "created_at")')
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "intl_checks_created_at_idx" ON "intl_checks"("created_at")')
      console.log('[ensure-sso-columns] intl_checks ready')
    } catch (e4) {
      console.error('[ensure-sso-columns] intl_checks 생성 실패(해외판 체크 API 가 DATABASE_ERROR 를 냄):', e4.message)
    }
    console.log('[ensure-sso-columns] OK — hospitals.ps_hospital_id, users.pending_ps_hospital_id ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[ensure-sso-columns] FAILED:', e.message)
  process.exit(1)
})
