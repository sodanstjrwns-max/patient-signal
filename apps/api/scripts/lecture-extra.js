const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function extractDomain(url){if(!url)return null;try{let u=url.trim();if(u.includes('vertexaisearch.cloud.google.com'))return null;if(!u.startsWith('http'))u='https://'+u;return new URL(u).hostname.replace(/^www\./,'')||null;}catch{return null;}}

(async () => {
  const out = {};

  // 1) 전체 SoV(언급률) — AI가 등록 병원을 언급한 비율
  const total = await prisma.aIResponse.count();
  const mentioned = await prisma.aIResponse.count({ where: { isMentioned: true } });
  out.overallMentionRate = { total, mentioned, rate: (mentioned/total*100).toFixed(1) };

  // 2) 플랫폼별 언급률
  out.mentionByPlatform = {};
  for (const p of ['CHATGPT','CLAUDE','GEMINI','PERPLEXITY','GROK']) {
    const t = await prisma.aIResponse.count({ where: { aiPlatform: p } });
    if (!t) continue;
    const m = await prisma.aIResponse.count({ where: { aiPlatform: p, isMentioned: true } });
    out.mentionByPlatform[p] = { total: t, mentioned: m, rate: (m/t*100).toFixed(1) };
  }

  // 3) 병원 수 / 활성 병원
  out.hospitals = {
    total: await prisma.hospital.count(),
    active: await prisma.hospital.count({ where: { subscriptionStatus: { in: ['ACTIVE','TRIAL'] } } }),
  };

  // 4) 데이터 기간
  const first = await prisma.aIResponse.findFirst({ orderBy: { responseDate: 'asc' }, select: { responseDate: true } });
  const last = await prisma.aIResponse.findFirst({ orderBy: { responseDate: 'desc' }, select: { responseDate: true } });
  out.period = { from: first?.responseDate?.toISOString().slice(0,10), to: last?.responseDate?.toISOString().slice(0,10) };

  // 5) 언급된 응답 vs 안 된 응답의 평균 출처 개수 (출처 많을수록 언급 잘되나?)
  let mSrc=0,mCnt=0,nSrc=0,nCnt=0, skip=0;
  while(true){
    const rows = await prisma.aIResponse.findMany({ select:{isMentioned:true,citedSources:true}, orderBy:{id:'asc'}, skip, take:10000 });
    if(!rows.length) break;
    for(const r of rows){ const n=(r.citedSources||[]).length; if(r.isMentioned){mSrc+=n;mCnt++;}else{nSrc+=n;nCnt++;} }
    skip+=10000;
  }
  out.sourceCountVsMention = {
    mentionedAvgSources: (mSrc/mCnt).toFixed(2),
    notMentionedAvgSources: (nSrc/nCnt).toFixed(2),
  };

  fs.writeFileSync('scripts/lecture-extra-report.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
  await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
