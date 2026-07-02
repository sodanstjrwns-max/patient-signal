/**
 * 비디치과(불당본점) 프롬프트 101 → 200개 확장
 * 약점 분석 기반: 가격/후기/서브지역/상황·대상별 질문 집중 보강
 * 중복(동일 promptText) 자동 스킵
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HOSPITAL_ID = '2a6776fd-a4ae-4022-9331-7a62810988aa';

const NEW_PROMPTS = [
  // ═══ PRICE (18) — 최대 약점: 가격 질문 전멸 구간 정밀 커버 ═══
  ['price', '천안 임플란트 뼈이식 포함하면 비용 얼마나 해?'],
  ['price', '천안 앞니 임플란트 가격 알려줘'],
  ['price', '천안 전악 임플란트 풀아치 비용 어느 정도야'],
  ['price', '천안 어금니 크라운 가격 얼마야'],
  ['price', '천안 신경치료 비용 얼마 정도 해?'],
  ['price', '천안 치아미백 가격 알려줘'],
  ['price', '천안 틀니 가격 어느 정도야'],
  ['price', '천안 인비절라인 비용 얼마야'],
  ['price', '천안 부분교정 가격 알려줘'],
  ['price', '천안 소아 치아교정 비용 얼마나 들어?'],
  ['price', '천안 인레이 치료 가격 얼마야'],
  ['price', '천안 치과 정기검진 비용 얼마야'],
  ['price', '65세 이상인데 천안 임플란트 보험 적용하면 얼마야'],
  ['price', '천안 교정 유지장치 비용 알려줘'],
  ['price', '국산이랑 수입 임플란트 가격 차이 천안 기준으로 알려줘'],
  ['price', '천안 치과 비용 투명하게 공개하는 곳 어디야'],
  ['price', '천안 라미네이트 4개 하면 총 얼마야'],
  ['price', '천안 치아교정 카드 할부 되는 치과'],

  // ═══ REVIEW (12) — 두 번째 약점: 후기 질문 -77.7pp ═══
  ['review', '천안 치과 구글 리뷰 좋은 곳 어디야'],
  ['review', '천안 임플란트 재수술 후기 좋은 치과'],
  ['review', '천안 인비절라인 후기 많은 치과'],
  ['review', '천안 치과 별점 높은 곳 알려줘'],
  ['review', '천안 소아치과 엄마들 후기 좋은 곳'],
  ['review', '천안 치과 내돈내산 후기 많은 곳'],
  ['review', '불당동 임플란트 후기 진짜 좋은 곳'],
  ['review', '천안 교정치과 맘카페 후기 좋은 곳'],
  ['review', '천안 치아미백 후기 좋은 치과'],
  ['review', '천안 사랑니 발치 후기 안 아팠다는 곳'],
  ['review', '천안 재방문 환자 많은 치과'],
  ['review', '천안 틀니 후기 좋은 치과 어디야'],

  // ═══ COMPARISON (12) ═══
  ['comparison', '천안 인비절라인 vs 메탈교정 어디서 상담받는 게 좋아'],
  ['comparison', '천안 치과 임플란트 브랜드별로 비교해줘'],
  ['comparison', '천안 교정과 전문의 있는 치과 비교해줘'],
  ['comparison', '불당동 치과 3곳만 골라서 비교해줘'],
  ['comparison', '라미네이트 vs 크라운 뭐가 나아? 천안에서 잘하는 곳은?'],
  ['comparison', '천안 대학병원급 시설 갖춘 치과 비교'],
  ['comparison', '천안이랑 아산 임플란트 치과 어디가 더 나아'],
  ['comparison', '천안 치과 상담 잘해주는 곳 비교해줘'],
  ['comparison', '천안 오스템 임플란트 쓰는 치과 비교'],
  ['comparison', '천안 치과 위생·소독 잘하는 곳 비교'],
  ['comparison', '천안 소아치과 어디가 나은지 비교해줘'],
  ['comparison', '천안 치아교정 기간 짧은 치과 비교'],

  // ═══ REGIONAL (15) — 서브지역 공백 (백석동 4%, 천안역 3%, 충남대 0%) ═══
  ['regional', '천안 두정동 치과 추천'],
  ['regional', '천안 성정동 치과 추천해줘'],
  ['regional', '천안 쌍용동 치과 어디가 좋아'],
  ['regional', '천안 신방동 치과 추천'],
  ['regional', '천안 청당동 근처 치과 알려줘'],
  ['regional', '아산 배방 근처 치과 추천'],
  ['regional', '아산에서 천안으로 치과 다닐만한 곳'],
  ['regional', '세종에서 갈만한 천안 치과 있어?'],
  ['regional', '평택에서 가까운 천안 치과 추천'],
  ['regional', '천안 신불당 치과 추천'],
  ['regional', '천안터미널 근처 치과 어디 있어'],
  ['regional', '천안 서북구 임플란트 치과 추천'],
  ['regional', '천안 동남구 치과 추천해줘'],
  ['regional', '천안 갤러리아백화점 근처 치과'],
  ['regional', '천안 불당동 카페거리 근처 치과'],

  // ═══ SYMPTOM (14) — 증상 기반 롱테일 ═══
  ['symptom', '어금니로 씹을 때 아픈데 천안 치과 어디 가야 해'],
  ['symptom', '잇몸이 부었는데 천안 치과 추천해줘'],
  ['symptom', '임플란트 한 지 오래됐는데 천안에서 점검받을 곳'],
  ['symptom', '치아 변색이 심한데 천안 미백 잘하는 곳'],
  ['symptom', '아이 유치가 안 빠지는데 천안 소아치과 가야 해?'],
  ['symptom', '사랑니가 누워있다는데 천안 발치 잘하는 곳'],
  ['symptom', '턱에서 딱딱 소리 나는데 천안 턱관절 치과'],
  ['symptom', '찬물 마시면 이가 시린데 천안 치과 추천'],
  ['symptom', '치아가 부러졌어 천안에서 바로 치료되는 치과'],
  ['symptom', '밤에 이가 아픈데 천안 야간 치과 있어?'],
  ['symptom', '임신 중인데 천안에서 치과 치료 가능한 곳'],
  ['symptom', '당뇨 있는데 천안 임플란트 가능한 치과'],
  ['symptom', '부모님 틀니가 불편하시대 천안 치과 추천'],
  ['symptom', '교정 중에 이사 왔는데 천안에서 이어서 할 치과'],

  // ═══ FEAR (10) — FEAR 유형 언급률 0% 대응 ═══
  ['fear', '천안 치과 안 아프게 치료하는 곳'],
  ['fear', '주사 공포증 있는데 천안 치과 추천'],
  ['fear', '천안 웃음가스 진정치료 되는 치과'],
  ['fear', '치과 트라우마 있는데 천안 친절한 치과 어디야'],
  ['fear', '천안 임플란트 실패 걱정 없이 할 수 있는 치과'],
  ['fear', '아이가 치과를 너무 무서워하는데 천안 어린이 치과'],
  ['fear', '천안 수면 임플란트 하는 치과 어디야'],
  ['fear', '발치 후 통증 관리 잘해주는 천안 치과'],
  ['fear', '천안 과잉진료 안 하는 치과 추천'],
  ['fear', '천안 정직하게 진료하는 치과 어디야'],

  // ═══ STRENGTH (10) — 시설·운영 강점 (비디 실제 강점 어필 구간) ═══
  ['strength', '천안 3D CT 있는 치과'],
  ['strength', '천안 구강스캐너로 본뜨는 치과'],
  ['strength', '천안 네비게이션 임플란트 하는 치과'],
  ['strength', '천안 일요일 진료하는 치과'],
  ['strength', '천안 공휴일에도 하는 치과'],
  ['strength', '천안 진료과목별로 전문의 있는 치과'],
  ['strength', '천안 독립 수술실 있는 치과'],
  ['strength', '천안 멸균 소독 시스템 좋은 치과'],
  ['strength', '천안 대기시간 짧은 치과'],
  ['strength', '천안 365일 진료하는 치과 있어?'],

  // ═══ RECOMMENDATION (8) — 대상·상황별 ═══
  ['recommendation', '천안 20대 치아교정 추천 치과'],
  ['recommendation', '천안 40대 임플란트 잘하는 치과 추천'],
  ['recommendation', '천안 직장인 퇴근 후 갈 수 있는 치과'],
  ['recommendation', '천안 중고등학생 교정 잘하는 치과'],
  ['recommendation', '결혼 앞두고 라미네이트 하려는데 천안 어디가 좋아'],
  ['recommendation', '천안 온가족 같이 다니기 좋은 치과'],
  ['recommendation', '천안 치과 처음 가보는데 어디가 좋아?'],
  ['recommendation', '천안 어르신 임플란트 잘하는 치과 추천'],
];

async function main() {
  const existing = await prisma.prompt.findMany({
    where: { hospitalId: HOSPITAL_ID },
    select: { promptText: true },
  });
  const existingSet = new Set(existing.map(p => p.promptText.trim()));
  console.log('기존 프롬프트:', existing.length);

  const toInsert = NEW_PROMPTS.filter(([, text]) => !existingSet.has(text.trim()));
  const dup = NEW_PROMPTS.length - toInsert.length;
  if (dup > 0) console.log('중복 스킵:', dup);

  const result = await prisma.prompt.createMany({
    data: toInsert.map(([cat, text]) => ({
      hospitalId: HOSPITAL_ID,
      promptText: text,
      promptType: 'CUSTOM',
      specialtyCategory: cat,
      regionKeywords: [],
      isActive: true,
    })),
  });
  console.log('신규 추가:', result.count);

  const total = await prisma.prompt.count({ where: { hospitalId: HOSPITAL_ID, isActive: true } });
  console.log('최종 활성 프롬프트:', total);

  const byCat = await prisma.prompt.groupBy({
    by: ['specialtyCategory'],
    where: { hospitalId: HOSPITAL_ID, isActive: true },
    _count: { _all: true },
  });
  console.log('\n카테고리별 분포:');
  byCat.sort((a,b)=>b._count._all-a._count._all).forEach(c => console.log(`  ${c.specialtyCategory || '(없음)'}: ${c._count._all}개`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
