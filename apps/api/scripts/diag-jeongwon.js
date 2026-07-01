// 정원한의원(오산) 진단 스크립트 — SoV 0% 원인 분석
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1) 병원 찾기 (정원 + 한의원 키워드)
  const hospitals = await prisma.hospital.findMany({
    where: {
      OR: [
        { name: { contains: '정원', mode: 'insensitive' } },
      ],
    },
  });

  console.log('=== 후보 병원 ===');
  for (const h of hospitals) {
    console.log(`- ${h.name} | id=${h.id} | ${h.regionSido} ${h.regionSigungu} ${h.regionDong || ''} | plan=${h.planType} | aliases=${JSON.stringify(h.nameAliases)} | created=${h.createdAt.toISOString()}`);
  }

  // 정원한의원 추정: 한의원 + 오산
  const target = hospitals.find(h => h.name.includes('정원')) || hospitals[0];
  if (!target) { console.log('병원 없음'); return; }

  console.log('\n========================================');
  console.log(`>>> 타깃: ${target.name} (id=${target.id})`);
  console.log(`    별칭(aliases): ${JSON.stringify(target.nameAliases)}`);
  console.log(`    진료과: ${target.specialtyType} | 지역: ${target.regionSido} ${target.regionSigungu}`);
  console.log(`    주력진료: ${JSON.stringify(target.keyProcedures)}`);
  console.log(`    생성일: ${target.createdAt.toISOString()}`);
  console.log('========================================\n');

  // 2) 등록된 질문
  const prompts = await prisma.prompt.findMany({
    where: { hospitalId: target.id },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`=== 등록 질문: ${prompts.length}개 (active=${prompts.filter(p=>p.isActive).length}) ===`);
  prompts.slice(0, 15).forEach((p, i) => {
    console.log(`  ${i+1}. [${p.promptType}${p.isActive?'':' /비활성'}] ${p.promptText}`);
  });
  if (prompts.length > 15) console.log(`  ... 외 ${prompts.length - 15}개`);

  // 3) AI 응답 총계
  const totalResp = await prisma.aIResponse.count({ where: { hospitalId: target.id } });
  const mentionedResp = await prisma.aIResponse.count({ where: { hospitalId: target.id, isMentioned: true } });
  console.log(`\n=== AI 응답 데이터 ===`);
  console.log(`  전체 응답 수: ${totalResp}`);
  console.log(`  언급됨(isMentioned=true): ${mentionedResp}`);
  console.log(`  >>> SoV = ${totalResp > 0 ? ((mentionedResp/totalResp)*100).toFixed(1) : '0 (데이터 없음)'}%`);

  if (totalResp === 0) {
    console.log('\n  ⚠️ 결론: 크롤링 데이터가 0건 → 아직 측정이 한 번도 안 돌았음 (원인①)');
    await prisma.$disconnect();
    return;
  }

  // 플랫폼별 / 날짜별 분포
  const byPlatform = await prisma.aIResponse.groupBy({
    by: ['aiPlatform'],
    where: { hospitalId: target.id },
    _count: { _all: true },
  });
  console.log(`\n  --- 플랫폼별 ---`);
  for (const p of byPlatform) {
    const m = await prisma.aIResponse.count({ where: { hospitalId: target.id, aiPlatform: p.aiPlatform, isMentioned: true } });
    console.log(`    ${p.aiPlatform}: 총 ${p._count._all}건, 언급 ${m}건`);
  }

  // 최근 응답 날짜
  const latest = await prisma.aIResponse.findFirst({
    where: { hospitalId: target.id },
    orderBy: { responseDate: 'desc' },
    select: { responseDate: true, createdAt: true },
  });
  console.log(`\n  최근 응답 날짜: ${latest?.responseDate} (생성 ${latest?.createdAt?.toISOString()})`);

  // 4) 핵심: 응답 원문에 병원명이 들어있는데 isMentioned=false인 케이스 찾기 (매칭 버그 검증)
  console.log(`\n=== 매칭 버그 검증 (원문엔 이름 있는데 미언급 처리된 케이스) ===`);
  const samples = await prisma.aIResponse.findMany({
    where: { hospitalId: target.id },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { aiPlatform: true, isMentioned: true, responseText: true, responseDate: true },
  });

  // 간이 변형: 이름/공백제거/한의원제거 코어
  const name = target.name;
  const core = name.replace(/\s+/g, '').replace(/(한의원|한방병원|병원|의원|클리닉|치과)$/,'');
  const checks = [name, name.replace(/\s+/g,''), core, ...target.nameAliases].filter(Boolean);
  console.log(`  검사 키워드: ${JSON.stringify([...new Set(checks)])}\n`);

  let falseNeg = 0;
  samples.forEach((r, i) => {
    const txt = (r.responseText || '');
    const low = txt.toLowerCase();
    const hit = checks.find(c => low.includes(c.toLowerCase()));
    const flag = hit && !r.isMentioned ? '🔴FALSE-NEG' : (r.isMentioned ? '✅언급' : '⚪미언급');
    console.log(`  [${i}] ${r.aiPlatform} ${r.responseDate} | DB:isMentioned=${r.isMentioned} | 원문매칭=${hit||'없음'} | ${flag} | len=${txt.length}`);
    if (hit && !r.isMentioned) {
      falseNeg++;
      const idx = low.indexOf(hit.toLowerCase());
      console.log(`       발췌: ...${txt.slice(Math.max(0,idx-40), idx+60).replace(/\n/g,' ')}...`);
    }
  });
  console.log(`\n  >>> 최근 40건 중 매칭 누락(false-negative) 의심: ${falseNeg}건`);

  // 5) 응답 원문 1~2개 통째로 출력 (미언급 케이스)
  const oneNotMentioned = samples.find(r => !r.isMentioned);
  if (oneNotMentioned) {
    console.log(`\n=== 미언급 응답 원문 샘플 (${oneNotMentioned.aiPlatform}) ===`);
    console.log(oneNotMentioned.responseText.slice(0, 1200));
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
