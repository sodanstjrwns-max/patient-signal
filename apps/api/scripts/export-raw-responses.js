// ============================================================
// 로데이터 전량 추출 — AI가 실제로 뱉은 응답 원문 96,000+건
// 출력: CSV(엑셀용) + JSONL(가공용) 둘 다, 스트리밍으로 메모리 안전
//   - raw-responses.csv   : 엑셀에서 바로 열람
//   - raw-responses.jsonl : 한 줄에 한 응답(JSON), 후처리/분석용
// ============================================================
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const CSV_PATH = 'scripts/raw-responses.csv';
const JSONL_PATH = 'scripts/raw-responses.jsonl';
const BATCH = 2000;

// CSV 셀 이스케이프
function csv(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // 줄바꿈/쉼표/따옴표 있으면 따옴표로 감싸고 내부 따옴표 이스케이프
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

(async () => {
  const csvStream = fs.createWriteStream(CSV_PATH, { encoding: 'utf8' });
  const jsonlStream = fs.createWriteStream(JSONL_PATH, { encoding: 'utf8' });

  // 엑셀 한글 깨짐 방지 BOM
  csvStream.write('\uFEFF');
  // CSV 헤더
  const header = [
    'no', 'hospital', 'specialty', 'platform', 'model', 'date',
    'promptText', 'isMentioned', 'mentionPosition', 'totalRecommendations',
    'sentimentScoreV2', 'recommendationDepth', 'queryIntent',
    'citedSources', 'citedUrl', 'sourceHints', 'responseText',
  ];
  csvStream.write(header.join(',') + '\n');

  let cursor = null, n = 0;
  const t0 = Date.now();

  while (true) {
    const rows = await prisma.aIResponse.findMany({
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        aiPlatform: true, aiModelVersion: true, responseDate: true,
        isMentioned: true, mentionPosition: true, totalRecommendations: true,
        sentimentScoreV2: true, recommendationDepth: true, queryIntent: true,
        citedSources: true, citedUrl: true, sourceHints: true, responseText: true,
        hospital: { select: { name: true } },
        prompt: { select: { promptText: true, specialtyCategory: true } },
      },
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      n++;
      const date = r.responseDate ? r.responseDate.toISOString().slice(0, 10) : '';
      const sources = (r.citedSources || []).join(' | ');
      const hints = r.sourceHints ? JSON.stringify(r.sourceHints) : '';

      // CSV 행
      csvStream.write([
        csv(n), csv(r.hospital?.name), csv(r.prompt?.specialtyCategory),
        csv(r.aiPlatform), csv(r.aiModelVersion), csv(date),
        csv(r.prompt?.promptText), csv(r.isMentioned), csv(r.mentionPosition), csv(r.totalRecommendations),
        csv(r.sentimentScoreV2), csv(r.recommendationDepth), csv(r.queryIntent),
        csv(sources), csv(r.citedUrl), csv(hints), csv(r.responseText),
      ].join(',') + '\n');

      // JSONL 행 (원본 그대로)
      jsonlStream.write(JSON.stringify({
        no: n,
        hospital: r.hospital?.name,
        specialty: r.prompt?.specialtyCategory,
        platform: r.aiPlatform,
        model: r.aiModelVersion,
        date,
        promptText: r.prompt?.promptText,
        isMentioned: r.isMentioned,
        mentionPosition: r.mentionPosition,
        totalRecommendations: r.totalRecommendations,
        sentimentScoreV2: r.sentimentScoreV2,
        recommendationDepth: r.recommendationDepth,
        queryIntent: r.queryIntent,
        citedSources: r.citedSources,
        citedUrl: r.citedUrl,
        sourceHints: r.sourceHints,
        responseText: r.responseText,
      }) + '\n');
    }

    cursor = rows[rows.length - 1].id;
    if (n % 20000 === 0) console.log(`...${n.toLocaleString()}건 (${((Date.now()-t0)/1000).toFixed(0)}s)`);
  }

  await new Promise(res => csvStream.end(res));
  await new Promise(res => jsonlStream.end(res));

  const csvSize = (fs.statSync(CSV_PATH).size / 1024 / 1024).toFixed(1);
  const jsonlSize = (fs.statSync(JSONL_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ 완료: 총 ${n.toLocaleString()}건`);
  console.log(`   CSV  : ${CSV_PATH} (${csvSize} MB)`);
  console.log(`   JSONL: ${JSONL_PATH} (${jsonlSize} MB)`);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
