/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  강의록 12·24·28-②번 — 질문 분류기
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ① 지역 단위 분류 (12번 · 24번)
 *    강의록 실측: 동 단위 46.6%(3,177건) vs 시 단위 27.3%(22,451건) = 1.7배
 *    Gemini는 동 68.6% vs 시 22.8% = 3.0배 (GBP가 교과서라서)
 *    → "잠실 임플란트"가 "서울 임플란트"보다 1.7배 유리하다는 걸 화면에 띄워야 한다.
 *
 * ② 질문 난이도 분류 (28-② 쉬운 질문의 착시)
 *    강의록 원문: "지역+시술 롱테일 질문만 잔뜩 넣고 SoV 90% 나왔다고 기뻐하면
 *                 그건 경쟁이 없는 질문에서 이긴 것. 뜨내기 업체가 이 착시를 판다."
 *    → 난이도별로 SoV를 쪼개서 보여줘야 자기 실력을 안다.
 *
 * ③ 언어 분류 (13번 다국어 무주공산)
 */

// ─────────────────────────────────────────────────────────────
// ① 지역 단위
// ─────────────────────────────────────────────────────────────

export type RegionLevel = 'DONG' | 'SIGUNGU' | 'SIDO' | 'NATIONWIDE' | 'NONE';

export const REGION_LEVEL_LABELS: Record<RegionLevel, string> = {
  DONG: '동/읍/면 단위',
  SIGUNGU: '시/군/구 단위',
  SIDO: '시/도 단위',
  NATIONWIDE: '전국 단위',
  NONE: '지역 없음',
};

/** 광역시/도 — 최상위 행정단위 */
const SIDO_TOKENS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '강원도', '경기도', '제주도',
];

/** 전국/광범위 표현 */
const NATIONWIDE_TOKENS = ['전국', '한국', '국내', '대한민국', 'korea', 'nationwide'];

/**
 * 【외국어 지역 토큰】강의록 13번(다국어) × 12번(지역 단위) 교차 지점.
 * 영/중/일 질문의 지역명은 한글 접미사 규칙으로 잡히지 않으므로 별도 매핑이 필요하다.
 * (미적용 시 외국어 질문이 전부 'NONE'으로 떨어져 지역 배율 분석에서 통째로 누락됨)
 */
const FOREIGN_SIDO = [
  // 영문
  'seoul', 'busan', 'incheon', 'daegu', 'daejeon', 'gwangju', 'ulsan', 'sejong',
  'gyeonggi', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
  // 중문
  '首尔', '釜山', '仁川', '大邱', '大田', '光州', '蔚山', '济州',
  // 일문
  'ソウル', 'プサン', '釜山', 'インチョン', 'テグ', 'チェジュ',
];

/** 시/군/구·상권 단위 외국어 표기 (동 단위에 준하는 좁은 범위) */
const FOREIGN_LOCAL = [
  // 영문 (서울 주요 구/상권)
  'gangnam', 'seocho', 'songpa', 'jamsil', 'yeoksam', 'apgujeong', 'cheongdam', 'sinsa',
  'hongdae', 'itaewon', 'myeongdong', 'jongno', 'yeouido', 'mapo', 'seongsu', 'bundang',
  'pangyo', 'ilsan', 'dongtan', 'suwon', 'gwanghwamun', 'sinchon', 'nowon', 'gangseo',
  // 중문
  '江南', '瑞草', '松坡', '蚕室', '驿三', '狎鸥亭', '清潭', '弘大', '明洞',
  // 일문
  'カンナム', '江南', 'ソチョ', 'ソンパ', 'チャムシル', 'ホンデ', 'ミョンドン', 'アックジョン',
];

/**
 * 【구 단위 축약명】'강남구'를 '강남'으로 줄여 쓰는 게 실제 검색 행태다.
 * 접미사가 없으면 상권명(DONG)으로 떨어지는데, 그러면 강의록 12번 배율표
 * (동 46.6% vs 시/구 27.3% = 1.7배)의 분모·분자가 뒤섞여 배율이 뭉개진다.
 * → 자치구/시 이름의 축약형은 명시적으로 SIGUNGU로 못 박는다.
 */
const GU_SHORT_TOKENS = [
  // 서울 25개 자치구
  '강남', '강동', '강북', '강서', '관악', '광진', '구로', '금천', '노원', '도봉',
  '동대문', '동작', '마포', '서대문', '서초', '성동', '성북', '송파', '양천',
  '영등포', '용산', '은평', '종로', '중랑',
  // 경기 주요 시
  '수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택',
  '의정부', '시흥', '파주', '광명', '김포', '군포', '하남', '오산', '구리', '안성',
  // 부산·대구·인천 주요 구
  '해운대', '수영', '동래', '연제', '남포', '서면', '달서', '수성', '송도', '청라',
  // 기타 광역 주요 시
  '천안', '청주', '전주', '창원', '포항', '김해', '진주', '원주', '춘천', '강릉',
];

/**
 * 【접미사 없는 상권명】'잠실', '홍대', '판교'처럼 행정 접미사가 없는 동/상권 단위.
 * 자유 텍스트 본문 스캔에서 임의의 2~4글자를 상권으로 추측하면 오탐이 폭발하므로
 * 명시적 화이트리스트만 인정한다. (regionKeywords에 등록된 토큰은 별도로 관대하게 처리)
 */
const DONG_SHORT_TOKENS = [
  '잠실', '역삼', '삼성', '대치', '논현', '신사', '압구정', '청담', '개포', '도곡',
  '반포', '방배', '잠원', '내곡', '문정', '가락', '석촌', '방이', '오금', '위례',
  '홍대', '합정', '연남', '상수', '망원', '연희', '이태원', '한남', '성수', '왕십리',
  '건대', '구의', '자양', '신촌', '아현', '공덕', '상암', '목동', '여의도', '노량진',
  '사당', '서울대', '신림', '봉천', '가산', '구로디지털', '문래', '영등포', '당산',
  '판교', '정자', '서현', '수내', '미금', '야탑', '분당', '광교', '동탄', '평촌',
  '일산', '화정', '중동', '위브', '송도', '청라', '검단', '해운대', '센텀', '서면',
  '광안리', '동성로', '수성', '둔산', '유성', '상무', '전대', '봉명', '불당',
];

/**
 * 지역 토큰의 행정 단위 레벨 판정
 *
 * 판정 규칙 (한국 행정구역 접미사 기반):
 *   '~동' '~읍' '~면' '~가' + 알려진 상권명 → DONG
 *   '~시' '~군' '~구'                      → SIGUNGU
 *   광역시/도 이름                          → SIDO
 */
export function classifyRegionToken(raw: string): RegionLevel {
  const t = (raw || '').trim();
  if (!t) return 'NONE';
  const lower = t.toLowerCase();

  if (NATIONWIDE_TOKENS.some((n) => lower.includes(n.toLowerCase()))) return 'NATIONWIDE';

  // 【외국어】좁은 단위 먼저 — 'Gangnam, Seoul'처럼 함께 오면 좁은 쪽을 취해야 맞다
  if (FOREIGN_LOCAL.some((f) => lower === f.toLowerCase() || t === f)) return 'SIGUNGU';
  if (FOREIGN_SIDO.some((f) => lower === f.toLowerCase() || t === f)) return 'SIDO';

  // 시/도 정확 매칭 우선 (서울, 경기 등은 그 자체로 SIDO)
  if (SIDO_TOKENS.includes(t)) return 'SIDO';

  // '서울특별시' '경기도' 같은 형태
  if (/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시)$/.test(t)) return 'SIDO';
  if (/도$/.test(t) && SIDO_TOKENS.some((s) => t.startsWith(s))) return 'SIDO';

  // 동/읍/면 — 2글자 이상 + 접미사
  if (/[가-힣]{1,4}(동|읍|면)$/.test(t)) return 'DONG';
  // '~1가' '~2가' (종로3가 등)
  if (/[가-힣]{1,4}\d?가$/.test(t)) return 'DONG';
  // 역세권 ('강남역', '잠실역') — 동 단위에 준하는 좁은 상권
  if (/[가-힣]{2,4}역$/.test(t)) return 'DONG';

  // 시/군/구
  if (/[가-힣]{1,5}(시|군|구)$/.test(t)) return 'SIGUNGU';

  // 접미사 없는 자치구/시 축약명 ('강남', '서초', '마포', '수원')
  if (GU_SHORT_TOKENS.includes(t)) return 'SIGUNGU';

  // 접미사 없는 상권명 (잠실, 역삼, 홍대, 판교 등)
  // → 동/상권 단위로 본다. 시/도·자치구 목록에 없고 접미사도 없으면 상권명일 확률이 높음
  if (/^[가-힣]{2,4}$/.test(t)) return 'DONG';

  return 'NONE';
}

/**
 * 질문 텍스트 전체에서 가장 **좁은** 지역 레벨을 뽑는다.
 * 좁을수록(DONG) AI 언급률이 높다는 게 강의록 12번 결론이므로,
 * "서울 잠실 임플란트"는 DONG으로 잡아야 맞다.
 */
export function detectRegionLevel(promptText: string, regionKeywords: string[] = []): RegionLevel {
  const PRIORITY: RegionLevel[] = ['DONG', 'SIGUNGU', 'SIDO', 'NATIONWIDE'];
  let best: RegionLevel = 'NONE';

  const consider = (level: RegionLevel) => {
    if (level === 'NONE') return;
    if (best === 'NONE') { best = level; return; }
    if (PRIORITY.indexOf(level) < PRIORITY.indexOf(best)) best = level;
  };

  // ① 등록된 regionKeywords 우선 (구조화 데이터라 정확도 높음)
  for (const kw of regionKeywords || []) {
    consider(classifyRegionToken(kw));
  }

  // ② 질문 본문 토큰 스캔 (regionKeywords가 비어있는 커스텀 질문 대비)
  const text = promptText || '';
  const lower = text.toLowerCase();

  // ⚠️ 한글에는 \b(단어 경계)가 먹지 않는다. JS의 \w는 ASCII만 인정하므로
  //    /역삼동\b/ 는 '역삼동 치과'에서 매칭되지 않는다(양쪽 모두 non-\w).
  //    → 뒤에 한글이 더 붙지 않는지 확인하는 부정 전방탐색으로 대체한다.
  const NOT_HANGUL = '(?![가-힣])';
  const hangulBoundary = (body: string) => new RegExp(body + NOT_HANGUL).test(text);

  // 동/읍/면 · 역세권
  // ⚠️ '면'은 연결어미('알려주면', '하려면'), '동'은 일반명사('운동', '활동')와 충돌한다.
  //    본문 스캔은 구조화되지 않은 자유 텍스트라 오탐이 곧 지표 왜곡이므로 블랙리스트로 막는다.
  const DONG_FALSE_POSITIVE =
    /(운동|활동|이동|자동|수동|아동|행동|작동|공동|합동|충동|감동|변동|출동|가동|협동|부동|중동|노동|욕구충족|화면|측면|표면|단면|반면|장면|국면|지면|수면|전면|양면|이면|측면|어렵다면|으면|려면|주면|하면|되면|보면|받으면|같으면|있으면|없으면)$/;
  const dongHits = text.match(/[가-힣]{1,4}(동|읍|면)(?![가-힣])/g) || [];
  if (dongHits.some((h) => !DONG_FALSE_POSITIVE.test(h))) consider('DONG');
  if (hangulBoundary('[가-힣]{1,4}\\d?가')) consider('DONG');
  if (hangulBoundary('[가-힣]{2,4}역')) consider('DONG');
  // 시/군/구
  if (hangulBoundary('[가-힣]{1,5}(시|군|구)')) consider('SIGUNGU');
  // 자치구/시 축약명 ('강남 임플란트' → 구 단위)
  if (GU_SHORT_TOKENS.some((g) => text.includes(g))) consider('SIGUNGU');
  // 접미사 없는 상권명 ('잠실 임플란트' → 동 단위)
  if (DONG_SHORT_TOKENS.some((d) => text.includes(d))) consider('DONG');
  // 【외국어】좁은 상권 → SIGUNGU, 광역 → SIDO
  if (FOREIGN_LOCAL.some((f) => (/^[a-z]+$/.test(f) ? lower.includes(f) : text.includes(f))))
    consider('SIGUNGU');
  if (FOREIGN_SIDO.some((f) => (/^[a-z]+$/.test(f) ? lower.includes(f) : text.includes(f))))
    consider('SIDO');
  // 시도
  if (SIDO_TOKENS.some((s) => text.includes(s))) consider('SIDO');
  // 전국
  if (NATIONWIDE_TOKENS.some((n) => lower.includes(n.toLowerCase()))) consider('NATIONWIDE');

  return best;
}

// ─────────────────────────────────────────────────────────────
// ② 질문 난이도 (강의록 28-② 쉬운 질문의 착시)
// ─────────────────────────────────────────────────────────────

export type QueryDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DIFFICULTY_LABELS: Record<QueryDifficulty, string> = {
  EASY: '쉬움 (롱테일·저경쟁)',
  MEDIUM: '보통',
  HARD: '어려움 (빅키워드·고경쟁)',
};

export const DIFFICULTY_GUIDE: Record<QueryDifficulty, string> = {
  EASY: '지역+시술이 좁게 박힌 롱테일. 여기 SoV는 높게 나오는 게 정상이라 실력 증명이 안 됩니다.',
  MEDIUM: '지역 또는 시술 하나가 특정된 질문. 실전 체급.',
  HARD: '넓은 지역·비교·추천 요구가 겹친 빅키워드. 여기 점유율이 진짜 실력입니다.',
};

/** 비교/추천을 요구하는 = 경쟁이 붙는 표현 */
const COMPETITIVE_MARKERS = /(잘하는|유명한|추천|best|top|순위|비교|어디가|어느 병원|괜찮은|명의|1위|가장)/i;
/** 브랜드/고유명 지목 = 경쟁 없음 */
const BRANDED_MARKERS = /(어때|후기|위치|주소|전화|영업시간|예약|주차)/i;

/**
 * 난이도 판정
 *  - 지역이 좁을수록(DONG) 경쟁 모집단이 작아 쉬움
 *  - 지역이 넓을수록(SIDO/전국) 어려움
 *  - 비교/추천 요구가 있으면 한 단계 어려움
 *  - 질문이 길고 조건이 많으면(롱테일) 쉬움
 */
export function classifyDifficulty(promptText: string, regionKeywords: string[] = []): QueryDifficulty {
  const text = promptText || '';
  const level = detectRegionLevel(text, regionKeywords);
  const isCompetitive = COMPETITIVE_MARKERS.test(text);
  const isBranded = BRANDED_MARKERS.test(text);

  // 점수제: 높을수록 어려움
  let score = 0;
  if (level === 'NATIONWIDE') score += 3;
  else if (level === 'SIDO') score += 2;
  else if (level === 'SIGUNGU') score += 1;
  else if (level === 'DONG') score += 0;
  else score += 2; // 지역 없음 = 모집단 전국 = 어려움

  if (isCompetitive) score += 1;
  if (isBranded) score -= 1;

  // 롱테일 판정: 조건이 많이 붙은 긴 질문은 경쟁이 옅다
  const conditionCount = (text.match(/(비용|가격|기간|통증|부작용|보험|야간|주말|일요일|아동|소아|노인|당일|무통|수면)/g) || []).length;
  if (conditionCount >= 2) score -= 1;
  if (text.length >= 40) score -= 1;

  if (score >= 3) return 'HARD';
  if (score >= 1) return 'MEDIUM';
  return 'EASY';
}

// ─────────────────────────────────────────────────────────────
// ③ 언어 분류 (강의록 13번)
// ─────────────────────────────────────────────────────────────

export type QueryLanguage = 'KO' | 'EN' | 'ZH' | 'JA' | 'OTHER';

export const LANGUAGE_LABELS: Record<QueryLanguage, string> = {
  KO: '한국어',
  EN: '영어',
  ZH: '중국어',
  JA: '일본어',
  OTHER: '기타',
};

export function detectLanguage(text: string): QueryLanguage {
  const t = text || '';
  if (!t.trim()) return 'OTHER';

  // 일본어 가나가 있으면 일본어 (한자만으로는 중국어와 구분 불가)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(t)) return 'JA';
  // 한글
  const hangul = (t.match(/[\uAC00-\uD7AF]/g) || []).length;
  // CJK 통합 한자
  const han = (t.match(/[\u4E00-\u9FFF]/g) || []).length;
  // 라틴 알파벳
  const latin = (t.match(/[A-Za-z]/g) || []).length;

  if (hangul > 0 && hangul >= han) return 'KO';
  if (han > 0 && han > hangul) return 'ZH';
  if (latin >= 3 && hangul === 0 && han === 0) return 'EN';
  if (hangul > 0) return 'KO';
  return 'OTHER';
}

// ─────────────────────────────────────────────────────────────
// ④ 원장 실명 브랜딩 (강의록 20번)
// ─────────────────────────────────────────────────────────────

/**
 * 응답 본문에서 '원장' 일반명사 언급 / 실명+원장 언급을 판정
 *
 * 강의록 실측: '원장' 포함 응답 25.8% vs **실명 0.7%**
 * → AI는 "원장님이 친절하다"까지는 말하는데 "문석준 원장"이라고는 안 한다.
 *   실명이 엔티티로 안 잡혀 있기 때문. 나무위키·인물정보가 처방.
 *
 * @param responseText AI 응답 원문
 * @param doctorNames 원장 실명 후보 (예: ['문석준'])
 */
export function analyzeDirectorBranding(
  responseText: string,
  doctorNames: string[],
): { hasTitle: boolean; hasRealName: boolean; matchedNames: string[] } {
  const text = responseText || '';
  const hasTitle = /(원장|대표원장|병원장|의료진|주치의|닥터|doctor|dr\.)/i.test(text);

  const matched: string[] = [];
  for (const raw of doctorNames || []) {
    const name = (raw || '').trim();
    if (name.length < 2) continue;
    if (text.includes(name)) matched.push(name);
  }

  return { hasTitle, hasRealName: matched.length > 0, matchedNames: matched };
}

/**
 * 병원 등록 정보에서 원장 실명 후보를 추출한다.
 * 전용 필드가 없으므로 nameAliases / hospitalStrengths에서 "XXX 원장" 패턴을 긁는다.
 * (Batch C에서 전용 필드 추가 예정 — 지금은 있는 데이터로만)
 */
export function extractDoctorNameCandidates(hospital: {
  nameAliases?: string[];
  hospitalStrengths?: string[];
  name?: string;
}): string[] {
  const pool = [
    ...(hospital.nameAliases || []),
    ...(hospital.hospitalStrengths || []),
  ];
  const names = new Set<string>();
  for (const s of pool) {
    // "문석준 원장", "문석준원장", "대표원장 문석준"
    const m1 = (s || '').match(/([가-힣]{2,4})\s*(대표원장|병원장|원장)/);
    if (m1?.[1]) names.add(m1[1]);
    const m2 = (s || '').match(/(대표원장|병원장|원장)\s*([가-힣]{2,4})/);
    if (m2?.[2]) names.add(m2[2]);
  }
  return [...names];
}
