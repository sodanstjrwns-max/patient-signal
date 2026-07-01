// 전체 병원 stale-data 스캔 (읽기 전용)
// DB:isMentioned=false 인데 현행 매칭 로직으로는 true 인 false-negative 집계
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function gen(hospitalName, nameAliases = []) {
  const variants = new Set();
  for (const alias of (nameAliases||[])) {
    const t=(alias||'').trim();
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
  // 너무 짧은(2글자 미만) 변형 제거하여 오탐 방지
  return [...variants].filter(v=>v && v.length>=2);
}
function isMatch(low, variants){
  for(const v of variants){ if(low.includes(v.toLowerCase())) return true; }
  return false;
}

async function main(){
  const hospitals = await prisma.hospital.findMany({
    select:{id:true, name:true, nameAliases:true, specialtyType:true, regionSigungu:true, planType:true},
  });
  console.log(`병원 ${hospitals.length}개 스캔 시작...\n`);

  const report=[];
  let grandTotal=0, grandDbTrue=0, grandReTrue=0, grandFN=0;

  for(const h of hospitals){
    const variants = gen(h.name, h.nameAliases);
    let total=0, dbTrue=0, reTrue=0, fn=0;  // fn = false negative (db false → real true)
    let lastId=null;
    // 페이징(병원당 응답)
    while(true){
      const batch = await prisma.aIResponse.findMany({
        where:{hospitalId:h.id, ...(lastId?{id:{gt:lastId}}:{})},
        select:{id:true, isMentioned:true, responseText:true},
        orderBy:{id:'asc'}, take:500,
      });
      if(!batch.length) break;
      for(const r of batch){
        total++;
        const real = isMatch((r.responseText||'').toLowerCase(), variants);
        if(r.isMentioned) dbTrue++;
        if(real) reTrue++;
        if(real && !r.isMentioned) fn++;
      }
      lastId = batch[batch.length-1].id;
      if(batch.length<500) break;
    }
    grandTotal+=total; grandDbTrue+=dbTrue; grandReTrue+=reTrue; grandFN+=fn;
    if(total>0){
      report.push({
        name:h.name, specialty:h.specialtyType, region:h.regionSigungu, plan:h.planType,
        total, dbTrue, reTrue, fn,
        dbSov:+(dbTrue/total*100).toFixed(1),
        realSov:+(reTrue/total*100).toFixed(1),
        gap:+((reTrue-dbTrue)/total*100).toFixed(1),
      });
    }
  }

  // 영향도 순 정렬 (gap 큰 순)
  report.sort((a,b)=>b.fn-a.fn);

  console.log('='.repeat(95));
  console.log('병원명'.padEnd(22)+'진료과'.padEnd(16)+'응답'.padStart(6)+'DB언급'.padStart(7)+'실제'.padStart(6)+'FN'.padStart(6)+'  DBSoV→실SoV');
  console.log('='.repeat(95));
  for(const r of report){
    if(r.fn===0) continue;
    console.log(
      r.name.slice(0,20).padEnd(22)+
      String(r.specialty).slice(0,14).padEnd(16)+
      String(r.total).padStart(6)+
      String(r.dbTrue).padStart(7)+
      String(r.reTrue).padStart(6)+
      String(r.fn).padStart(6)+
      `   ${r.dbSov}% → ${r.realSov}%`
    );
  }

  const affected = report.filter(r=>r.fn>0);
  const zeroButReal = report.filter(r=>r.dbTrue===0 && r.reTrue>0); // 정원처럼 0인데 실제 노출
  console.log('\n'+'='.repeat(60));
  console.log('📊 전체 요약');
  console.log('='.repeat(60));
  console.log(`  응답 보유 병원: ${report.length}개`);
  console.log(`  영향받은 병원(FN>0): ${affected.length}개`);
  console.log(`  ⚠️ DB상 0% 인데 실제 노출됨(정원형): ${zeroButReal.length}개`);
  console.log(`\n  전체 응답: ${grandTotal.toLocaleString()}건`);
  console.log(`  DB 언급: ${grandDbTrue.toLocaleString()}건 (SoV ${(grandDbTrue/grandTotal*100).toFixed(1)}%)`);
  console.log(`  실제 언급: ${grandReTrue.toLocaleString()}건 (SoV ${(grandReTrue/grandTotal*100).toFixed(1)}%)`);
  console.log(`  🔴 누락(false-negative): ${grandFN.toLocaleString()}건`);

  console.log(`\n  ── DB상 0% 인데 실제 노출된 병원 (최우선 백필 대상) ──`);
  zeroButReal.sort((a,b)=>b.realSov-a.realSov);
  zeroButReal.forEach(r=>console.log(`    ${r.name.slice(0,20).padEnd(22)} 실SoV ${r.realSov}% (${r.reTrue}/${r.total}) [${r.plan}]`));

  fs.writeFileSync('scripts/scan-report.json', JSON.stringify({summary:{grandTotal,grandDbTrue,grandReTrue,grandFN,affected:affected.length,zeroButReal:zeroButReal.length}, report}, null, 2));
  console.log('\n  📄 상세 리포트 저장: scripts/scan-report.json');
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
