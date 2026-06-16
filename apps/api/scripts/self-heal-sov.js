// ============================================================
// SoV 자기치유(self-healing) 스캐너 — 재발 방지 (task ③)
//
// 무엇을: "SoV가 낮거나 0%인데, 저장된 AI 응답 텍스트에 병원명이
//         명백히 등장하는" 케이스를 자동 탐지한다.
//         (정원한의원처럼 매칭 누락으로 isMentioned=false로 잘못 저장된 경우)
//
// 사용법:
//   node scripts/self-heal-sov.js                 (탐지만 — 리포트 출력, DB 미수정)
//   node scripts/self-heal-sov.js --apply         (탐지 + 자동 백필 실행)
//   node scripts/self-heal-sov.js --hospital=정원   (특정 병원만)
//
// 안전장치:
//   - 기본은 dry-run. --apply 없으면 절대 DB 안 건드림
//   - isMentioned=false → true 로 바꾸는 "복구"만 함 (true→false 안 함)
//   - 변경 시 DailyScore.sovPercent / mentionCount 도 함께 재계산
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const HOSPITAL_FILTER = (process.argv.find(a => a.startsWith('--hospital=')) || '').split('=')[1] || null;

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 현행 ai-crawler generateHospitalNameVariants 로직 복제 (한방 패턴 포함)
function genVariants(hospitalName, nameAliases = []) {
  const variants = new Set();
  for (const alias of (nameAliases || [])) {
    const t = (alias || '').trim();
    if (t.length >= 2) {
      variants.add(t); variants.add(t.toLowerCase()); variants.add(t.replace(/\s+/g, ''));
    }
  }
  variants.add(hospitalName); variants.add(hospitalName.toLowerCase());
  const ns = hospitalName.replace(/\s+/g, ''); variants.add(ns); variants.add(ns.toLowerCase());

  const corePatterns = [
    /([가-힣a-zA-Z]+치과의원)/g, /([가-힣a-zA-Z]+치과병원)/g, /([가-힣a-zA-Z]+치과)/g,
    /([가-힣a-zA-Z]+한방병원)/g, /([가-힣a-zA-Z]+한의원)/g, /([가-힣a-zA-Z]+한방)/g,
    /([가-힣a-zA-Z]+병원)/g, /([가-힣a-zA-Z]+의원)/g, /([가-힣a-zA-Z]+클리닉)/g,
    /([가-힣a-zA-Z]+메디컬)/g, /([가-힣a-zA-Z]+덴탈)/g,
  ];
  for (const p of corePatterns) {
    const m = hospitalName.match(p);
    if (m) for (const x of m) { variants.add(x); variants.add(x.toLowerCase()); }
  }

  const suffixes = ['치과', '치과의원', '치과병원', '한방병원', '한의원', '한방', '병원', '의원', '클리닉', '메디컬', '덴탈'];
  const regionPrefixes = ['서울', '강남', '분당', '판교', '일산', '천안', '수원', '부산', '대구', '인천', '불당', '역삼', '논현', '잠실', '송파', '마포', '영등포', '광주', '대전', '울산', '제주', '오산'];
  const commonWords = new Set(['대학교', '대학', '종합', '연합', '센터', '메디', '종합병원']);

  let coreName = hospitalName.replace(/\s+/g, '').replace(/[()（）\[\]【】]/g, '')
    .replace(/(본점|지점|본원|분원)$/, '')
    .replace(/(치과의원|치과병원|치과|한방병원|한의원|한방|병원|의원|클리닉|메디컬|덴탈)([가-힣]{2,3}점)?$/, '');
  let brandName = coreName;
  for (const prefix of regionPrefixes) {
    if (brandName.startsWith(prefix) && brandName.length > prefix.length) { brandName = brandName.slice(prefix.length); break; }
  }
  if (brandName.length >= 1 && !commonWords.has(brandName)) {
    for (const s of suffixes) variants.add(brandName + s);
  }
  return [...variants].filter(v => v && v.length >= 2);
}

// 오탐 방지: 너무 짧거나 일반적인 변형은 단독 매칭 제외
function checkMention(text, variants) {
  if (!text) return { isMentioned: false, matched: null, count: 0 };
  const low = text.toLowerCase();
  const sorted = [...variants].sort((a, b) => b.length - a.length);
  let matched = null, count = 0;
  for (const v of sorted) {
    const lv = v.toLowerCase();
    if (!low.includes(lv)) continue;
    const m = text.match(new RegExp(escapeRegex(lv), 'gi'));
    if (m && m.length) { count += m.length; if (!matched) matched = v; }
  }
  return { isMentioned: count > 0, matched, count };
}

(async () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SoV 자기치유 스캐너 ${APPLY ? '【APPLY 모드 — DB 수정함】' : '【DRY-RUN — 탐지만】'}`);
  if (HOSPITAL_FILTER) console.log(`필터: 병원명 contains "${HOSPITAL_FILTER}"`);
  console.log(`${'='.repeat(60)}\n`);

  const where = { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } };
  if (HOSPITAL_FILTER) where.name = { contains: HOSPITAL_FILTER };
  const hospitals = await prisma.hospital.findMany({
    where, select: { id: true, name: true, nameAliases: true },
  });

  let totalFlagged = 0, totalFixedResponses = 0, totalFixedScores = 0;
  const report = [];

  for (const h of hospitals) {
    const variants = genVariants(h.name, h.nameAliases);
    // isMentioned=false 인 응답만 후보 (이미 true면 정상)
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId: h.id, isMentioned: false },
      select: { id: true, responseText: true, aiPlatform: true, responseDate: true },
    });
    if (responses.length === 0) continue;

    const falseNegatives = [];
    for (const r of responses) {
      const { isMentioned, matched } = checkMention(r.responseText, variants);
      if (isMentioned) falseNegatives.push({ id: r.id, matched, responseDate: r.responseDate });
    }
    if (falseNegatives.length === 0) continue;

    totalFlagged++;
    report.push({ hospital: h.name, falseNegatives: falseNegatives.length });
    console.log(`⚠️  [${h.name}] 매칭 누락(false-negative) ${falseNegatives.length}건 발견 (예: "${falseNegatives[0].matched}")`);

    if (APPLY) {
      // 1) AIResponse 복구
      const ids = falseNegatives.map(f => f.id);
      const upd = await prisma.aIResponse.updateMany({
        where: { id: { in: ids } }, data: { isMentioned: true },
      });
      totalFixedResponses += upd.count;

      // 2) 영향받은 날짜의 DailyScore 재계산
      const days = new Set(falseNegatives.map(f => f.responseDate.toISOString().slice(0, 10)));
      for (const day of days) {
        const dayStart = new Date(day + 'T00:00:00.000Z');
        const dayEnd = new Date(day + 'T23:59:59.999Z');
        const dayResponses = await prisma.aIResponse.findMany({
          where: { hospitalId: h.id, responseDate: { gte: dayStart, lte: dayEnd } },
          select: { isMentioned: true },
        });
        const total = dayResponses.length;
        const mentioned = dayResponses.filter(x => x.isMentioned).length;
        const sov = total > 0 ? (mentioned / total) * 100 : 0;
        const ds = await prisma.dailyScore.findFirst({
          where: { hospitalId: h.id, scoreDate: { gte: dayStart, lte: dayEnd } },
        });
        if (ds) {
          await prisma.dailyScore.update({
            where: { id: ds.id },
            data: { sovPercent: sov, mentionCount: mentioned },
          });
          totalFixedScores++;
        }
      }
      console.log(`    ✅ 복구: 응답 ${upd.count}건, DailyScore ${days.size}일치 재계산`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`스캔 완료: 활성 병원 ${hospitals.length}곳 중 매칭누락 병원 ${totalFlagged}곳`);
  if (APPLY) {
    console.log(`복구된 응답: ${totalFixedResponses}건 / 재계산된 DailyScore: ${totalFixedScores}건`);
  } else if (totalFlagged > 0) {
    console.log(`→ 실제 복구하려면: node scripts/self-heal-sov.js --apply`);
  } else {
    console.log(`🎉 매칭 누락 케이스 없음 — 데이터 건강함`);
  }
  console.log(`${'─'.repeat(60)}\n`);

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
