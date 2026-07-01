const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const q=(s)=>prisma.$queryRawUnsafe(s);
(async()=>{
  // DB 종류/버전
  const ver = await q(`SELECT version()`);
  console.log('DB version:', ver[0].version.slice(0,80));
  // 현재 DB명, 호스트 단서
  const db = await q(`SELECT current_database() db, current_user usr`);
  console.log('DB:', JSON.stringify(db[0]));
  // ai_responses 가장 오래된/최근 (전체 보존범위)
  const range = await q(`SELECT MIN(created_at) mn, MAX(created_at) mx, COUNT(*)::int c FROM ai_responses`);
  console.log('ai_responses 보존범위:', JSON.stringify(range[0]));
  // 으뜸 응답이 사라진 시점 추정: 5/27 이전 응답이 전체에 얼마나 남아있나
  const before528 = await q(`SELECT COUNT(*)::int c FROM ai_responses WHERE created_at < '2026-05-28'`);
  console.log('5/28 이전 생성 응답 (전체):', before528[0].c);
  await prisma.$disconnect();
})();
