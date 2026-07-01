const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // 1) 으뜸 prompt가 언제 재생성됐는지 (cascade 발생 시점 추정)
  const h = 'c7dbe500-78a2-4e07-a80e-8d1d7c4f313d';
  const prompts = await prisma.$queryRawUnsafe(
    `SELECT id, prompt_type, is_active, created_at, updated_at FROM prompts WHERE hospital_id = $1 ORDER BY created_at`, h);
  console.log('=== 으뜸 현재 prompts (재생성 시점) ===');
  prompts.forEach(p => console.log(`  ${p.prompt_type.padEnd(16)} active=${p.is_active} created=${p.created_at?.toISOString?.() ?? p.created_at}`));

  // 2) 전체 DB 가장 오래된/최근 응답 (백업 시점 판단용)
  const span = await prisma.$queryRawUnsafe(
    `SELECT min(created_at) AS first, max(created_at) AS last, count(*)::int AS c FROM ai_responses`);
  console.log('\n=== 전체 ai_responses 범위 ===');
  console.log(`  ${span[0].first?.toISOString?.()} ~ ${span[0].last?.toISOString?.()}  총 ${span[0].c}건`);

  // 3) Supabase PITR 여부 확인용 — soft delete 흔적 없는지(deleted_at 컬럼 존재?)
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_responses' ORDER BY ordinal_position`);
  console.log('\n=== ai_responses 컬럼 (soft-delete 가능성 체크) ===');
  console.log('  ' + cols.map(c => c.column_name).join(', '));

  await prisma.$disconnect();
})();
