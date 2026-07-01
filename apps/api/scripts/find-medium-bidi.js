const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const h = await prisma.hospital.findFirst({
    where: { name: { contains: '비디' } },
    select: { id: true, name: true },
  });
  if (!h) { console.log('서울비디치과 못 찾음'); return prisma.$disconnect(); }
  console.log(`병원: ${h.name} (${h.id})\n`);

  const responses = await prisma.aIResponse.findMany({
    where: { hospitalId: h.id },
    select: { id: true, aiPlatform: true, responseDate: true, citedSources: true, citedUrl: true, sourceHints: true, responseText: true },
    orderBy: { responseDate: 'desc' },
  });
  console.log(`총 응답 ${responses.length}건 검사\n`);

  const KW = 'medium.com';
  const hits = [];
  for (const r of responses) {
    const found = new Set();
    // 1) citedSources 배열
    for (const s of (r.citedSources || [])) if (String(s).toLowerCase().includes(KW)) found.add('citedSources: ' + s);
    // 2) citedUrl
    if (r.citedUrl && r.citedUrl.toLowerCase().includes(KW)) found.add('citedUrl: ' + r.citedUrl);
    // 3) sourceHints JSON
    if (r.sourceHints) {
      const j = JSON.stringify(r.sourceHints).toLowerCase();
      if (j.includes(KW)) {
        // 구체 URL 추출
        const sources = (r.sourceHints.sources || []);
        for (const src of sources) {
          if (src.url && String(src.url).toLowerCase().includes(KW)) found.add('sourceHints.url: ' + src.url);
        }
        if (found.size === 0) found.add('sourceHints(JSON 내 medium 언급)');
      }
    }
    // 4) 응답 본문에 medium.com URL이 그대로 박힌 경우
    if (r.responseText && r.responseText.toLowerCase().includes(KW)) {
      const m = r.responseText.match(/https?:\/\/[^\s)\]"']*medium\.com[^\s)\]"']*/i);
      found.add('본문: ' + (m ? m[0] : 'medium.com 언급'));
    }
    if (found.size > 0) hits.push({ platform: r.aiPlatform, date: r.responseDate.toISOString().slice(0,10), found: [...found] });
  }

  if (hits.length === 0) {
    console.log('❌ medium.com 출처 없음 — 서울비디치과 응답 어디에도 medium.com 인용/언급 없습니다.');
  } else {
    console.log(`✅ medium.com 발견: ${hits.length}건\n`);
    hits.forEach((x, i) => {
      console.log(`${i+1}. [${x.platform}] ${x.date}`);
      x.found.forEach(f => console.log(`   - ${f}`));
    });
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
