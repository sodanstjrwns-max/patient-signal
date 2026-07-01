// ============================================================
// 전체 병원 순위 리스트업
//   - 병원별 AI 응답 수, 언급(isMentioned) 건수, 언급률
//   - 플랫폼별 분포
// 결과: scripts/hospital-ranking.json
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

(async () => {
  // 1) 병원 마스터
  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true, websiteUrl: true, subscriptionStatus: true },
  });
  const hMap = {};
  for (const h of hospitals) hMap[h.id] = h;
  console.error('hospitals:', hospitals.length);

  // 2) 응답 전수 집계
  const BATCH = 2000;
  let cursor = null, processed = 0;
  const agg = {}; // hospitalId -> {resp, mention, byPlat:{}, byPlatMention:{}}

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      select: { id: true, hospitalId: true, aiPlatform: true, isMentioned: true },
      orderBy: { id: 'asc' }, take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      const id = r.hospitalId;
      if (!agg[id]) agg[id] = { resp: 0, mention: 0, byPlat: {}, byPlatMention: {} };
      const a = agg[id];
      a.resp++;
      if (r.isMentioned) a.mention++;
      const p = r.aiPlatform || 'UNKNOWN';
      a.byPlat[p] = (a.byPlat[p] || 0) + 1;
      if (r.isMentioned) a.byPlatMention[p] = (a.byPlatMention[p] || 0) + 1;
    }
    processed += rows.length;
    if (processed % 20000 === 0) console.error('processed', processed);
  }

  // 3) 리스트 구성
  const list = Object.entries(agg).map(([id, a]) => {
    const h = hMap[id] || {};
    return {
      id,
      name: h.name || '(이름없음)',
      status: h.subscriptionStatus || '-',
      website: h.websiteUrl || '',
      resp: a.resp,
      mention: a.mention,
      mentionRate: a.resp ? +(a.mention / a.resp * 100).toFixed(1) : 0,
      byPlat: a.byPlat,
      byPlatMention: a.byPlatMention,
    };
  });

  // 언급률 순위 (최소 응답수 100 이상만 신뢰)
  const byRate = [...list].filter(x => x.resp >= 100).sort((a, b) => b.mentionRate - a.mentionRate);
  const byMention = [...list].sort((a, b) => b.mention - a.mention);
  const byResp = [...list].sort((a, b) => b.resp - a.resp);

  const out = {
    generatedAt: new Date().toISOString(),
    totalHospitals: list.length,
    totalResponses: processed,
    rankByMentionRate_min100: byRate,
    rankByMentionCount: byMention,
    rankByResponseCount: byResp,
  };
  fs.writeFileSync(__dirname + '/hospital-ranking.json', JSON.stringify(out, null, 2));
  console.error('DONE hospitals=', list.length, 'responses=', processed);
  await prisma.$disconnect();
})();
