// 한방 매칭 패턴 검증 — generateHospitalNameVariants 로직을 재현해서 테스트
// (실제 서비스 코드의 corePatterns/suffixes/coreName 추출과 동일한 규칙)

function generateVariants(hospitalName) {
  const variants = new Set();
  variants.add(hospitalName);
  variants.add(hospitalName.replace(/\s+/g, ''));

  const corePatterns = [
    /([가-힣a-zA-Z]+치과의원)/g,
    /([가-힣a-zA-Z]+치과병원)/g,
    /([가-힣a-zA-Z]+치과)/g,
    /([가-힣a-zA-Z]+한방병원)/g,
    /([가-힣a-zA-Z]+한의원)/g,
    /([가-힣a-zA-Z]+한방)/g,
    /([가-힣a-zA-Z]+병원)/g,
    /([가-힣a-zA-Z]+의원)/g,
    /([가-힣a-zA-Z]+클리닉)/g,
    /([가-힣a-zA-Z]+메디컬)/g,
    /([가-힣a-zA-Z]+덴탈)/g,
  ];
  for (const pattern of corePatterns) {
    const matches = hospitalName.match(pattern);
    if (matches) for (const m of matches) { variants.add(m); variants.add(m.toLowerCase()); }
  }

  const suffixes = ['치과','치과의원','치과병원','한방병원','한의원','한방','병원','의원','클리닉','메디컬','덴탈'];
  const regionPrefixes = ['서울','강남','분당','판교','일산','천안','수원','부산','대구','인천','불당','역삼','논현','잠실','송파','마포','영등포','광주','대전','울산','제주','오산'];

  let coreName = hospitalName
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]【】]/g, '')
    .replace(/(본점|지점|본원|분원)$/, '')
    .replace(/^[가-힣]+(본점|지점)\s*/g, '')
    .replace(/(치과의원|치과병원|치과|한방병원|한의원|한방|병원|의원|클리닉|메디컬|덴탈)([가-힣]{2,3}점)?$/, '');

  let brandName = coreName;
  for (const prefix of regionPrefixes) {
    if (brandName.startsWith(prefix) && brandName.length > prefix.length) { brandName = brandName.slice(prefix.length); break; }
  }

  if (brandName.length >= 1) {
    for (const suffix of suffixes) variants.add(brandName + suffix);
  }
  return { variants: [...variants], coreName, brandName };
}

const tests = ['정원한의원', '오산정원한의원', '경희숨한의원', '자생한방병원', '강남자생한방병원', '서울비디치과'];
for (const t of tests) {
  const { variants, coreName, brandName } = generateVariants(t);
  console.log(`\n[${t}]  core="${coreName}" brand="${brandName}"`);
  console.log('  variants:', variants.join(' | '));
}
