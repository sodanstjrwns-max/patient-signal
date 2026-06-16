// 정원한의원 SoV 백필 — 저장된 응답을 현행 매칭 로직으로 재판정
// 사용법:
//   node scripts/backfill-jeongwon.js          (dry-run: 변경 예정만 출력, DB 미수정)
//   node scripts/backfill-jeongwon.js --apply   (실제 DB 업데이트)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ── 현행 ai-crawler 매칭 로직 복제 ──
function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function gen(hospitalName, nameAliases = []) {
  const variants = new Set();
  for (const alias of nameAliases) {
    const t = alias.trim();
    if (t.length >= 2) {
      variants.add(t); variants.add(t.toLowerCase()); variants.add(t.replace(/\s+/g,''));
      const sfx=['치과','치과의원','치과병원','병원','의원','클리닉'];
      for(const s of sfx) if(!t.endsWith(s)) variants.add(t+s);
      const core=t.replace(/(치과의원|치과병원|치과|병원|의원|클리닉|메디컬|덴탈)$/,'').trim();
      if(core.length>=2&&core!==t){variants.add(core);for(const s of sfx)variants.add(core+s);}
    }
  }
  variants.add(hospitalName); variants.add(hospitalName.toLowerCase());
  const ns=hospitalName.replace(/\s+/g,''); variants.add(ns); variants.add(ns.toLowerCase());
  const np=hospitalName.replace(/[()（）\[\]【】]/g,' ').replace(/\s+/g,' ').trim();
  variants.add(np); variants.add(np.replace(/\s+/g,''));
  const cp=[/([가-힣a-zA-Z]+치과의원)/g,/([가-힣a-zA-Z]+치과병원)/g,/([가-힣a-zA-Z]+치과)/g,/([가-힣a-zA-Z]+병원)/g,/([가-힣a-zA-Z]+의원)/g,/([가-힣a-zA-Z]+클리닉)/g,/([가-힣a-zA-Z]+메디컬)/g,/([가-힣a-zA-Z]+덴탈)/g];
  for(const p of cp){const m=hospitalName.match(p);if(m)for(const x of m){variants.add(x);variants.add(x.toLowerCase());}}
  return [...variants];
}
function checkMention(response, variants){
  const low=response.toLowerCase();
  const sorted=[...variants].sort((a,b)=>b.length-a.length);
  let matched=null, count=0;
  for(const v of sorted){
    const lv=v.toLowerCase();
    if(!low.includes(lv)) continue;
    const m=response.match(new RegExp(escapeRegex(lv),'gi'));
    if(m&&m.length){count+=m.length; if(!matched)matched=v;}
  }
  return {isMentioned:count>0, matched, count};
}
// 순위(mentionPosition) 추정 — 번호리스트/볼드 패턴
function detectPosition(response, variants){
  const numbered=[...response.matchAll(/(\d+)[.\)\.]\s*\**([^\n]+)/g)];
  const bold=[...response.matchAll(/\*\*([^*]+(?:치과|병원|의원|클리닉|덴탈)[^*]*)\*\*/g)];
  const list = numbered.length>0 ? numbered.map(m=>m[2]) : bold.map(m=>m[1]);
  if(!list.length) return {pos:null,total:null};
  for(let i=0;i<list.length;i++){
    const item=(list[i]||'').toLowerCase();
    if(variants.some(v=>item.includes(v.toLowerCase()))) return {pos:i+1,total:list.length};
  }
  return {pos:null,total:list.length};
}

async function main(){
  console.log(`\n${'='.repeat(60)}`);
  console.log(`정원한의원 SoV 백필  [${APPLY?'🔴 APPLY 모드 (DB 수정)':'🟡 DRY-RUN (미수정)'}]`);
  console.log('='.repeat(60));

  const h = await prisma.hospital.findFirst({where:{name:{contains:'정원'}}});
  const variants = gen(h.name, h.nameAliases);
  console.log(`병원: ${h.name} (id=${h.id})`);

  const rows = await prisma.aIResponse.findMany({
    where:{hospitalId:h.id},
    select:{id:true, aiPlatform:true, responseText:true, isMentioned:true,
            mentionPosition:true, totalRecommendations:true, responseDate:true},
  });

  // 1) 응답 재판정
  const updates=[];
  for(const r of rows){
    const res=checkMention(r.responseText||'', variants);
    if(res.isMentioned !== r.isMentioned){
      const {pos,total}=res.isMentioned?detectPosition(r.responseText, variants):{pos:null,total:null};
      updates.push({id:r.id, platform:r.aiPlatform, from:r.isMentioned, to:res.isMentioned, pos, total, date:r.responseDate});
    }
  }
  console.log(`\n[1단계] 응답 재판정: 총 ${rows.length}건 중 ${updates.length}건 변경 예정 (false→true)`);

  // 2) 날짜별 재집계 미리보기
  const byDate={};
  for(const r of rows){
    const d=r.responseDate.toISOString().slice(0,10);
    byDate[d]=byDate[d]||{total:0, newMentioned:0};
    byDate[d].total++;
    const res=checkMention(r.responseText||'', variants);
    if(res.isMentioned) byDate[d].newMentioned++;
  }
  console.log(`\n[2단계] 날짜별 DailyScore 재집계 미리보기:`);
  for(const [d,s] of Object.entries(byDate).sort()){
    console.log(`  ${d}: ${s.newMentioned}/${s.total} 언급 → SoV ${(s.newMentioned/s.total*100).toFixed(1)}%`);
  }

  if(!APPLY){
    console.log(`\n🟡 DRY-RUN 종료. 실제 적용하려면 --apply 플래그를 붙이세요.`);
    await prisma.$disconnect(); return;
  }

  // ── 실제 적용 ──
  console.log(`\n🔴 적용 시작...`);
  let cnt=0;
  for(const u of updates){
    await prisma.aIResponse.update({
      where:{id:u.id},
      data:{ isMentioned:u.to, mentionPosition:u.pos, totalRecommendations:u.total },
    });
    cnt++;
  }
  console.log(`  ✅ AIResponse ${cnt}건 업데이트 완료`);

  // DailyScore 재집계 (sovPercent, mentionCount)
  for(const [d,s] of Object.entries(byDate)){
    const sov=Math.round(s.newMentioned/s.total*1000)/10;
    const updated=await prisma.dailyScore.updateMany({
      where:{hospitalId:h.id, scoreDate:new Date(d)},
      data:{ sovPercent:sov, mentionCount:s.newMentioned },
    });
    console.log(`  ✅ DailyScore ${d}: sov=${sov}%, mentionCount=${s.newMentioned} (rows=${updated.count})`);
  }
  console.log(`\n✅ 백필 완료!`);
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
