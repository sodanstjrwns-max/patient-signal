const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // 4 피해 병원
  const names = ['서울으뜸치과의원','진심을 담은 치과교정과 치과의원','검단퍼스트치과','해운대함소아한의원'];
  for (const n of names) {
    const h = await prisma.hospital.findFirst({ where: { name: n }, select: { id: true, name: true } });
    if (!h) { console.log(`[NOT FOUND] ${n}`); continue; }
    const resp = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS c, min(created_at) AS first, max(created_at) AS last FROM ai_responses WHERE hospital_id = $1`, h.id);
    const scores = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS c, min(score_date) AS first, max(score_date) AS last FROM daily_scores WHERE hospital_id = $1`, h.id);
    const prompts = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS c FROM prompts WHERE hospital_id = $1`, h.id);
    console.log(`\n=== ${h.name} (${h.id}) ===`);
    console.log(`  ai_responses : ${resp[0].c}  (${resp[0].first ?? '-'} ~ ${resp[0].last ?? '-'})`);
    console.log(`  daily_scores : ${scores[0].c}  (${scores[0].first ?? '-'} ~ ${scores[0].last ?? '-'})`);
    console.log(`  prompts      : ${prompts[0].c}`);
  }
  await prisma.$disconnect();
})();
