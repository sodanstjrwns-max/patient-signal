import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('\n조회 시작...');

  // 모든 dailyScore를 한방에 가져온다음 메모리에서 최신만 추림
  const all = await prisma.dailyScore.findMany({
    orderBy: { scoreDate: 'desc' },
    select: {
      hospitalId: true,
      scoreDate: true,
      overallScore: true,
      mentionCount: true,
      positiveRatio: true,
    },
  });
  console.log(`전체 점수 row: ${all.length}`);

  // hospitalId별 최신 1개만
  const latestByHospital = new Map<string, typeof all[0]>();
  for (const s of all) {
    if (!latestByHospital.has(s.hospitalId)) {
      latestByHospital.set(s.hospitalId, s);
    }
  }
  console.log(`병원 수: ${latestByHospital.size}`);

  // 이름 한방 조회
  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: Array.from(latestByHospital.keys()) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(hospitals.map(h => [h.id, h.name]));

  // 점수순 정렬
  const rows = Array.from(latestByHospital.values())
    .map(s => ({
      ...s,
      name: nameMap.get(s.hospitalId) || '(이름없음)',
    }))
    .sort((a, b) => b.overallScore - a.overallScore);

  const now = new Date();
  console.log(`\n📊 점수 기준 TOP 20 (각 병원 최신 점수)\n`);
  console.log('순위 │ 점수 │ 멘션 │ 긍정% │ 점수일자   │ 병원명');
  console.log('─────┼──────┼──────┼───────┼────────────┼' + '─'.repeat(45));

  rows.slice(0, 20).forEach((r, i) => {
    const rank = (i + 1).toString().padStart(3);
    const sc = r.overallScore.toFixed(0).padStart(4);
    const mc = (r.mentionCount || 0).toString().padStart(4);
    const pos = ((r.positiveRatio || 0) * 100).toFixed(0).padStart(5) + '%';
    const dateStr = r.scoreDate.toISOString().slice(0, 10);
    const daysAgo = Math.floor((now.getTime() - r.scoreDate.getTime()) / (1000 * 60 * 60 * 24));
    const stale = daysAgo > 1 ? ` ⚠️${daysAgo}일전` : '';
    console.log(`${rank}  │ ${sc} │ ${mc} │ ${pos} │ ${dateStr} │ ${r.name}${stale}`);
  });

  // 서울365 위치
  const idx = rows.findIndex(r => r.name.includes('서울365'));
  if (idx >= 0) {
    const r = rows[idx];
    console.log(`\n🔍 서울365치과의원: ${idx + 1}위 / ${rows.length} (${r.overallScore}pt, ${r.scoreDate.toISOString().slice(0,10)})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
