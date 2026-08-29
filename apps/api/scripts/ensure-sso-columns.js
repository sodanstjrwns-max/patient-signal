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
    console.log('[ensure-sso-columns] OK — hospitals.ps_hospital_id, users.pending_ps_hospital_id ready')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[ensure-sso-columns] FAILED:', e.message)
  process.exit(1)
})
