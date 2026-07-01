// 정원한의원 변형(variants) 실측 — checkMention 재현
const name = '정원한의원';
const aliases = ['오산정원한의원', '정원한의원오산'];

// generateHospitalNameVariants 로직 그대로 복제
function gen(hospitalName, nameAliases = []) {
  const variants = new Set();
  for (const alias of nameAliases) {
    const trimmed = alias.trim();
    if (trimmed.length >= 2) {
      variants.add(trimmed); variants.add(trimmed.toLowerCase()); variants.add(trimmed.replace(/\s+/g, ''));
      const aliasSuffixes = ['치과','치과의원','치과병원','병원','의원','클리닉'];
      for (const s of aliasSuffixes) if (!trimmed.endsWith(s)) variants.add(trimmed + s);
      const aliasCore = trimmed.replace(/(치과의원|치과병원|치과|병원|의원|클리닉|메디컬|덴탈)$/, '').trim();
      if (aliasCore.length >= 2 && aliasCore !== trimmed) {
        variants.add(aliasCore);
        for (const s of aliasSuffixes) variants.add(aliasCore + s);
      }
    }
  }
  variants.add(hospitalName); variants.add(hospitalName.toLowerCase());
  const noSpace = hospitalName.replace(/\s+/g, ''); variants.add(noSpace); variants.add(noSpace.toLowerCase());
  const noParens = hospitalName.replace(/[()（）\[\]【】]/g, ' ').replace(/\s+/g, ' ').trim();
  variants.add(noParens); variants.add(noParens.replace(/\s+/g, ''));
  const corePatterns = [
    /([가-힣a-zA-Z]+치과의원)/g, /([가-힣a-zA-Z]+치과병원)/g, /([가-힣a-zA-Z]+치과)/g,
    /([가-힣a-zA-Z]+병원)/g, /([가-힣a-zA-Z]+의원)/g, /([가-힣a-zA-Z]+클리닉)/g,
    /([가-힣a-zA-Z]+메디컬)/g, /([가-힣a-zA-Z]+덴탈)/g,
  ];
  for (const p of corePatterns) { const m = hospitalName.match(p); if (m) for (const x of m){variants.add(x);variants.add(x.toLowerCase());} }
  return [...variants];
}

const v = gen(name, aliases);
console.log('=== 생성된 변형 목록 ===');
console.log(JSON.stringify(v, null, 0));
console.log(`\n총 ${v.length}개`);

// 실제 응답 발췌로 매칭 테스트
const sample = '오산동 쪽에서 **한방다이어트**를 고려한다면, 검색 결과상 **정원한의원**이 다이어트 한약과 체질 개선을 안내합니다.';
const low = sample.toLowerCase();
console.log('\n=== 매칭 테스트 ===');
console.log('샘플:', sample);
const hit = v.find(x => low.includes(x.toLowerCase()));
console.log('매칭 결과:', hit || '❌ 매칭 실패');
console.log("'정원한의원' 포함 여부:", low.includes('정원한의원'));
console.log("변형에 '정원한의원' 존재?:", v.includes('정원한의원'));
