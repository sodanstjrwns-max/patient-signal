const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const targets=['서울온한의원','의정부투게더한의원','경희리브한의원','온미소치과','센텀하모니재활의학과'];
(async()=>{
  for(const name of targets){
    const h=await p.hospital.findFirst({where:{name:{contains:name.slice(0,4)}}});
    if(!h){console.log(`\n[${name}] 못찾음`);continue;}
    // 미언급으로 저장된 응답 중, 본문에 코어이름(핵심 2~4글자)이 들어간 것 카운트
    const core=h.name.replace(/\s+/g,'').replace(/(한의원|한방병원|재활의학과의원|재활의학과|치과의원|치과병원|치과|병원|의원|클리닉|점|본점|지점).*$/,'');
    const rows=await p.aIResponse.findMany({where:{hospitalId:h.id, isMentioned:false}, select:{responseText:true, aiPlatform:true}, take:300});
    let nameInText=0, coreInText=0; const samples=[];
    for(const r of rows){
      const low=(r.responseText||'').toLowerCase();
      const full=h.name.replace(/\s+/g,'').toLowerCase();
      if(low.includes(full)){nameInText++; if(samples.length<2){const i=low.indexOf(full);samples.push(r.responseText.slice(Math.max(0,i-30),i+40).replace(/\n/g,' '));}}
      else if(core.length>=2 && low.includes(core.toLowerCase())) coreInText++;
    }
    console.log(`\n[${h.name}] (core="${core}") 미언급응답 ${rows.length}건 중`);
    console.log(`   전체이름 포함(=명백누락): ${nameInText}건 | 코어만 포함(=변형누락 의심): ${coreInText}건`);
    samples.forEach(s=>console.log(`   발췌: ...${s}...`));
  }
  await p.$disconnect();
})();
