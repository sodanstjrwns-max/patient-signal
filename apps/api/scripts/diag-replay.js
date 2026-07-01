// DB에 저장된 실제 응답을, 현재 매칭 로직으로 재판정(replay)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// checkMentionWithVariants + generateHospitalNameVariants 현행 로직 복제
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
function check(response, variants){
  const low=response.toLowerCase();
  const sorted=[...variants].sort((a,b)=>b.length-a.length);
  for(const v of sorted){ if(low.includes(v.toLowerCase())) return {isMentioned:true, matched:v}; }
  return {isMentioned:false, matched:null};
}

async function main(){
  const h = await prisma.hospital.findFirst({ where:{ name:{contains:'정원'} }});
  const variants = gen(h.name, h.nameAliases);

  const rows = await prisma.aIResponse.findMany({
    where:{ hospitalId:h.id },
    select:{ id:true, aiPlatform:true, isMentioned:true, responseText:true,
             confidenceScore:true, isVerified:true, isLowConfidence:true, repeatIndex:true },
  });

  let dbTrue=0, replayTrue=0, fixGain=0;
  const platStat={};
  for(const r of rows){
    const res = check(r.responseText||'', variants);
    if(r.isMentioned) dbTrue++;
    if(res.isMentioned) replayTrue++;
    if(res.isMentioned && !r.isMentioned) fixGain++;
    platStat[r.aiPlatform]=platStat[r.aiPlatform]||{n:0,dbT:0,reT:0};
    platStat[r.aiPlatform].n++;
    if(r.isMentioned)platStat[r.aiPlatform].dbT++;
    if(res.isMentioned)platStat[r.aiPlatform].reT++;
  }

  console.log(`병원: ${h.name} | aliases=${JSON.stringify(h.nameAliases)}`);
  console.log(`총 응답: ${rows.length}건`);
  console.log(`\n[DB 저장값]   isMentioned=true: ${dbTrue}건 → SoV ${(dbTrue/rows.length*100).toFixed(1)}%`);
  console.log(`[현행코드 재판정] isMentioned=true: ${replayTrue}건 → SoV ${(replayTrue/rows.length*100).toFixed(1)}%`);
  console.log(`\n>>> 같은 코드로 다시 돌리면 살아나는 언급: ${fixGain}건`);
  console.log('\n--- 플랫폼별 (총 / DB언급 / 재판정언급) ---');
  for(const [k,v] of Object.entries(platStat)){
    console.log(`  ${k}: ${v.n} / DB ${v.dbT} / 재판정 ${v.reT}`);
  }

  // 신뢰도/검증 필터가 원인이었는지
  const lowConf = rows.filter(r=>r.isLowConfidence).length;
  const notVerified = rows.filter(r=>r.isVerified===false).length;
  console.log(`\n--- 부가 플래그 ---`);
  console.log(`  isLowConfidence=true: ${lowConf}건`);
  console.log(`  isVerified=false: ${notVerified}건`);
  const confs = rows.map(r=>r.confidenceScore).filter(x=>x!=null);
  if(confs.length) console.log(`  confidenceScore 평균: ${(confs.reduce((a,b)=>a+b,0)/confs.length).toFixed(2)} (min ${Math.min(...confs)}, max ${Math.max(...confs)})`);

  await prisma.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
