/**
 * 비디치과 vs 상위그룹(비디보다 점수 높은 병원) 약점 총분석
 * - 최신 DailyScore 기준 비디보다 높은 병원 = 상위그룹
 * - 플랫폼별 / 의도별 / 프롬프트 유형별 격차 + 약한 질문 원문 추출
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DAYS = 30;

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000);

  // 1) 병원별 최신 점수
  const hospitals = await prisma.hospital.findMany({
    select: { id: true, name: true },
  });
  const latestScores = [];
  for (const h of hospitals) {
    const s = await prisma.dailyScore.findFirst({
      where: { hospitalId: h.id },
      orderBy: { scoreDate: 'desc' },
      select: { overallScore: true, platformScores: true, intentScores: true, scoreDate: true, sovPercent: true },
    });
    if (s) latestScores.push({ ...h, ...s });
  }

  const vd = latestScores.find(h => h.name.includes('불당본점')) ||
             latestScores.filter(h => h.name.includes('비디')).sort((a,b)=>b.overallScore-a.overallScore)[0];
  if (!vd) { console.log('비디 not found'); return; }
  console.log('=== 기준 병원:', vd.name, '| 점수:', vd.overallScore, '| 날짜:', vd.scoreDate.toISOString().slice(0,10));

  const top = latestScores.filter(h => h.overallScore > vd.overallScore && !h.name.includes('비디') && !h.name.includes('데모'));
  top.sort((a,b)=>b.overallScore-a.overallScore);
  console.log('\n=== 비디보다 높은 병원 (' + top.length + '개) ===');
  top.forEach((h,i)=>console.log(`${i+1}. ${h.name} — ${h.overallScore}점 (SoV ${h.sovPercent?.toFixed?.(1) ?? '-'}%)`));

  // 2) 플랫폼별 점수 비교
  const platKeys = new Set();
  [vd, ...top].forEach(h => Object.keys(h.platformScores || {}).forEach(k => platKeys.add(k)));
  console.log('\n=== 플랫폼별: 비디 vs 상위그룹 평균 ===');
  for (const k of platKeys) {
    const vdScore = (vd.platformScores || {})[k] ?? null;
    const vals = top.map(h => (h.platformScores||{})[k]).filter(v => typeof v === 'number');
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    console.log(`${k}: 비디 ${vdScore} | 상위평균 ${avg?.toFixed(1)} | 격차 ${(vdScore!=null&&avg!=null)?(vdScore-avg).toFixed(1):'-'}`);
  }

  // 3) 의도별 점수 비교
  const intentKeys = new Set();
  [vd, ...top].forEach(h => Object.keys(h.intentScores || {}).forEach(k => intentKeys.add(k)));
  console.log('\n=== 질문 의도별: 비디 vs 상위그룹 평균 ===');
  for (const k of intentKeys) {
    const vdScore = (vd.intentScores || {})[k] ?? null;
    const vals = top.map(h => (h.intentScores||{})[k]).filter(v => typeof v === 'number');
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    console.log(`${k}: 비디 ${typeof vdScore==='number'?vdScore.toFixed(1):vdScore} | 상위평균 ${avg?.toFixed(1)} | 격차 ${(typeof vdScore==='number'&&avg!=null)?(vdScore-avg).toFixed(1):'-'}`);
  }

  // 4) 응답 레벨: 의도 × 플랫폼 언급률 (비디 vs 상위그룹, 최근 30일)
  const topIds = top.map(h=>h.id);
  const grp = async (ids) => prisma.aIResponse.groupBy({
    by: ['queryIntent', 'aiPlatform'],
    where: { hospitalId: { in: ids }, responseDate: { gte: since } },
    _count: { _all: true },
  });
  const mentionGrp = async (ids) => prisma.aIResponse.groupBy({
    by: ['queryIntent', 'aiPlatform'],
    where: { hospitalId: { in: ids }, responseDate: { gte: since }, isMentioned: true },
    _count: { _all: true },
  });

  const [vdAll, vdMent, topAll, topMent] = await Promise.all([
    grp([vd.id]), mentionGrp([vd.id]), grp(topIds), mentionGrp(topIds),
  ]);
  const toMap = (rows) => { const m={}; rows.forEach(r=>{ m[`${r.queryIntent}|${r.aiPlatform}`]=r._count._all; }); return m; };
  const vdA = toMap(vdAll), vdM = toMap(vdMent), tA = toMap(topAll), tM = toMap(topMent);

  console.log('\n=== 최근 30일 언급률: 의도 × 플랫폼 (비디 vs 상위그룹) ===');
  console.log('intent | platform | 비디(언급/전체=율) | 상위그룹(율) | 격차pp');
  const keys = new Set([...Object.keys(vdA), ...Object.keys(tA)]);
  const rows = [];
  for (const k of keys) {
    const [intent, plat] = k.split('|');
    const va = vdA[k]||0, vm = vdM[k]||0, ta = tA[k]||0, tm = tM[k]||0;
    const vr = va ? vm/va*100 : null, tr = ta ? tm/ta*100 : null;
    rows.push({ intent, plat, va, vm, vr, tr, gap: (vr!=null&&tr!=null)?vr-tr:null });
  }
  rows.sort((a,b)=>(a.gap??99)-(b.gap??99));
  rows.forEach(r=>console.log(`${r.intent} | ${r.plat} | ${r.vm}/${r.va}=${r.vr?.toFixed(1)??'-'}% | ${r.tr?.toFixed(1)??'-'}% | ${r.gap?.toFixed(1)??'-'}`));

  // 5) 의도별 합계 (플랫폼 통합)
  console.log('\n=== 최근 30일 언급률: 의도별 통합 ===');
  const intentAgg = {};
  rows.forEach(r=>{
    if(!intentAgg[r.intent]) intentAgg[r.intent]={va:0,vm:0,ta:0,tm:0};
    intentAgg[r.intent].va+=r.va; intentAgg[r.intent].vm+=r.vm;
  });
  const topIntentAll = await prisma.aIResponse.groupBy({ by:['queryIntent'], where:{hospitalId:{in:topIds},responseDate:{gte:since}}, _count:{_all:true} });
  const topIntentMent = await prisma.aIResponse.groupBy({ by:['queryIntent'], where:{hospitalId:{in:topIds},responseDate:{gte:since},isMentioned:true}, _count:{_all:true} });
  const tia={},tim={};
  topIntentAll.forEach(r=>tia[r.queryIntent]=r._count._all);
  topIntentMent.forEach(r=>tim[r.queryIntent]=r._count._all);
  for (const [intent,v] of Object.entries(intentAgg)) {
    const vr = v.va? v.vm/v.va*100:null;
    const tr = tia[intent]? (tim[intent]||0)/tia[intent]*100:null;
    console.log(`${intent}: 비디 ${v.vm}/${v.va}=${vr?.toFixed(1)}% | 상위그룹 ${tr?.toFixed(1)}% | 격차 ${(vr!=null&&tr!=null)?(vr-tr).toFixed(1):'-'}pp`);
  }

  // 6) 비디의 "전멸 질문" — 최근 30일 언급률 최하위 프롬프트
  console.log('\n=== 비디 최약체 질문 TOP 25 (최근 30일, 응답 5건 이상 & 언급률 낮은 순) ===');
  const vdResp = await prisma.aIResponse.findMany({
    where: { hospitalId: vd.id, responseDate: { gte: since } },
    select: { promptId: true, archivedPromptText: true, isMentioned: true, aiPlatform: true, queryIntent: true,
              prompt: { select: { promptText: true, promptType: true } } },
  });
  const byPrompt = {};
  vdResp.forEach(r=>{
    const text = r.prompt?.promptText || r.archivedPromptText || '(unknown)';
    if(!byPrompt[text]) byPrompt[text]={total:0,ment:0,intents:new Set(),type:r.prompt?.promptType};
    byPrompt[text].total++; if(r.isMentioned) byPrompt[text].ment++;
    if(r.queryIntent) byPrompt[text].intents.add(r.queryIntent);
  });
  const weak = Object.entries(byPrompt).filter(([,v])=>v.total>=5)
    .map(([t,v])=>({t,...v,rate:v.ment/v.total*100}))
    .sort((a,b)=>a.rate-b.rate).slice(0,25);
  weak.forEach((w,i)=>console.log(`${i+1}. [${w.rate.toFixed(0)}% | ${w.ment}/${w.total} | ${[...w.intents].join(',')||w.type||''}] ${w.t}`));

  // 7) 비디 강점 질문 TOP 10 (대조용)
  console.log('\n=== (대조) 비디 강점 질문 TOP 10 ===');
  const strong = Object.entries(byPrompt).filter(([,v])=>v.total>=5)
    .map(([t,v])=>({t,...v,rate:v.ment/v.total*100}))
    .sort((a,b)=>b.rate-a.rate).slice(0,10);
  strong.forEach((w,i)=>console.log(`${i+1}. [${w.rate.toFixed(0)}% | ${w.ment}/${w.total}] ${w.t}`));

  // 8) 플랫폼별 언급률 총괄
  console.log('\n=== 플랫폼별 언급률 총괄 (최근 30일) ===');
  const platAgg = {};
  vdResp.forEach(r=>{ if(!platAgg[r.aiPlatform])platAgg[r.aiPlatform]={t:0,m:0}; platAgg[r.aiPlatform].t++; if(r.isMentioned)platAgg[r.aiPlatform].m++; });
  const topPlatAll = await prisma.aIResponse.groupBy({ by:['aiPlatform'], where:{hospitalId:{in:topIds},responseDate:{gte:since}}, _count:{_all:true} });
  const topPlatMent = await prisma.aIResponse.groupBy({ by:['aiPlatform'], where:{hospitalId:{in:topIds},responseDate:{gte:since},isMentioned:true}, _count:{_all:true} });
  const tpa={},tpm={};
  topPlatAll.forEach(r=>tpa[r.aiPlatform]=r._count._all);
  topPlatMent.forEach(r=>tpm[r.aiPlatform]=r._count._all);
  const plats = new Set([...Object.keys(platAgg),...Object.keys(tpa)]);
  for (const p of plats) {
    const v = platAgg[p]||{t:0,m:0};
    const vr = v.t? v.m/v.t*100:null;
    const tr = tpa[p]? (tpm[p]||0)/tpa[p]*100:null;
    console.log(`${p}: 비디 ${v.m}/${v.t}=${vr?.toFixed(1)??'-'}% | 상위그룹 ${tr?.toFixed(1)??'-'}% | 격차 ${(vr!=null&&tr!=null)?(vr-tr).toFixed(1):'-'}pp`);
  }

  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
