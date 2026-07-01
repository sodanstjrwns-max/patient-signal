const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const h=await p.hospital.findFirst({where:{name:{contains:'바른얼굴'}}});
  console.log(`${h.name} | aliases=${JSON.stringify(h.nameAliases)}`);
  // 명백누락: 본문에 통째이름 있는데 false
  const rows=await p.aIResponse.findMany({where:{hospitalId:h.id, isMentioned:false}, select:{responseText:true}, take:1000});
  const full=h.name.replace(/\s+/g,'').toLowerCase();
  let n=0; const samp=[];
  for(const r of rows){const low=(r.responseText||'').toLowerCase(); if(low.includes(full)){n++; if(samp.length<3){const i=low.indexOf(full);samp.push(r.responseText.slice(Math.max(0,i-25),i+35).replace(/\n/g,' '));}}}
  console.log(`미언급 ${rows.length}건 중 통째이름 포함: ${n}건`);
  samp.forEach(s=>console.log(`  ...${s}...`));
  await p.$disconnect();
})();
