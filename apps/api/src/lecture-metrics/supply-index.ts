/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  【강의록 25번】역인과 오류 방지 — 채널 공급량 지수
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 강의록 원문 논리:
 *   "인용수 = 선호도 × 공급량"
 *   인스타 61,827회 인용 / 나무위키 2,918회 인용
 *   → 인스타가 24배 좋은 채널? ❌ 아니다.
 *   → 병원 인스타 게시물은 수십만 건, 병원 나무위키 문서는 수백 건.
 *     문서 1개당 인용 효율로 보면 나무위키가 압도적이다.
 *
 * 인용수 랭킹만 보여주면 유저는 반드시 "인스타 많으니 인스타 해야겠네"로 오독한다.
 * → 제품이 강의록이 경고한 오류를 유발하게 된다.
 *
 * 【공급량 지수 산정 근거】
 *   강의록 60일 실측 42만 건 인용 분포 + 각 채널의 국내 병원 콘텐츠 모집단 추정
 *   상대 지수(인스타 = 1000 기준)로 정규화. 절대 문서 수가 아니라 **상대 크기**만 쓴다.
 *   (절대 수치는 검증 불가 → 상대 배율만으로 "문서당 효율" 서열이 성립하면 충분)
 *
 *   지수가 클수록 = 병원 콘텐츠가 흔한 채널 = 인용 1회의 가치가 낮음
 */

export interface SupplyInfo {
  /** 상대 공급량 지수 (인스타=1000) — 클수록 콘텐츠가 흔함 */
  index: number;
  /** 사람이 읽는 라벨 */
  label: string;
  /** 채널 성격: 축적(영구 자산) vs 소모(수명 2~6주) */
  durability: 'ACCUMULATIVE' | 'CONSUMABLE' | 'OWNED';
  /** 강의록 32번 포트폴리오 4구역 */
  zone: 'HOME_BASE' | 'SNIPER' | 'VOLUME' | 'AVOID';
}

/**
 * 도메인 패턴 → 공급량/성격/구역
 * 강의록 32번 배치표를 그대로 코드화:
 *   본진(HOME_BASE)  : 홈페이지 · GBP
 *   저격수(SNIPER)   : 의료 플랫폼 · 위키형 · 해외 디렉토리  ← 저공급 고효율
 *   물량파도(VOLUME) : 인스타 · 틱톡 · 스레드 · 페북 · 유튜브 ← 고공급 저효율
 *   하지마(AVOID)    : 지식iN · 네이버블로그(신규) · 티스토리(신규) · PBN
 */
const SUPPLY_TABLE: Array<{ match: RegExp; info: SupplyInfo }> = [
  // ── 물량파도 (고공급) ──
  { match: /instagram\.com/i, info: { index: 1000, label: '인스타그램', durability: 'CONSUMABLE', zone: 'VOLUME' } },
  { match: /tiktok\.com/i, info: { index: 420, label: '틱톡', durability: 'CONSUMABLE', zone: 'VOLUME' } },
  { match: /facebook\.com|fb\.com/i, info: { index: 380, label: '페이스북', durability: 'CONSUMABLE', zone: 'VOLUME' } },
  { match: /threads\.(net|com)/i, info: { index: 200, label: '스레드', durability: 'CONSUMABLE', zone: 'VOLUME' } },
  { match: /youtube\.com|youtu\.be/i, info: { index: 260, label: '유튜브', durability: 'ACCUMULATIVE', zone: 'VOLUME' } },

  // ── 하지마 (강의록 8번 · 32번) ──
  { match: /blog\.naver\.com|m\.blog\.naver\.com/i, info: { index: 850, label: '네이버 블로그', durability: 'CONSUMABLE', zone: 'AVOID' } },
  { match: /tistory\.com/i, info: { index: 340, label: '티스토리', durability: 'CONSUMABLE', zone: 'AVOID' } },
  { match: /kin\.naver\.com/i, info: { index: 300, label: '지식iN', durability: 'CONSUMABLE', zone: 'AVOID' } },
  { match: /brunch\.co\.kr/i, info: { index: 90, label: '브런치', durability: 'CONSUMABLE', zone: 'AVOID' } },

  // ── 저격수 (저공급 고효율) ── 강의록 23번 "의료 플랫폼이 왕"
  { match: /modoodoc\.com/i, info: { index: 14, label: '모두닥', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /my-?doctor\.io|mydoctor/i, info: { index: 12, label: '마이닥터', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /goodoc\.co\.kr|goodoc\.com/i, info: { index: 10, label: '굿닥', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /gangnamunni\.com/i, info: { index: 9, label: '강남언니', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /hidoc\.co\.kr/i, info: { index: 10, label: '하이닥', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /114\.co\.kr/i, info: { index: 8, label: '전화번호부114', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /babitalk\.com|bobitalk/i, info: { index: 9, label: '바비톡', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },

  // 위키형 — 강의록 25번의 핵심 반전 사례
  { match: /namu\.wiki/i, info: { index: 5, label: '나무위키', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /wikipedia\.org/i, info: { index: 3, label: '위키백과', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },

  // 해외 디렉토리 — 강의록 13번 "다국어 = 무주공산"
  { match: /konest\.com/i, info: { index: 2, label: '코네스트(일본어)', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /bookimed\.com/i, info: { index: 2, label: 'Bookimed', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },

  // ── 본진 ── 강의록 2번 · 24번
  { match: /(^|\.)google\.com\/maps|maps\.google|business\.site|g\.page/i, info: { index: 6, label: 'Google 비즈니스', durability: 'OWNED', zone: 'HOME_BASE' } },
  { match: /map\.naver\.com|place\.naver\.com|m\.place\.naver\.com/i, info: { index: 20, label: '네이버 플레이스', durability: 'OWNED', zone: 'HOME_BASE' } },

  // ── 공공/학술 (저격수 최상위) ──
  { match: /\.go\.kr|hira\.or\.kr|nhis\.or\.kr/i, info: { index: 2, label: '공공기관', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /\.ac\.kr/i, info: { index: 3, label: '대학/대학병원', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },
  { match: /\.or\.kr/i, info: { index: 5, label: '협회/학회', durability: 'ACCUMULATIVE', zone: 'SNIPER' } },

  // ── 카페 (동반율 82% — 강의록 26번) ──
  { match: /cafe\.naver\.com|cafe\.daum\.net/i, info: { index: 120, label: '카페(맘카페/지역)', durability: 'CONSUMABLE', zone: 'SNIPER' } },

  // ── 커뮤니티 (해외) ──
  { match: /reddit\.com/i, info: { index: 40, label: '레딧', durability: 'ACCUMULATIVE', zone: 'VOLUME' } },
  { match: /medium\.com/i, info: { index: 60, label: '미디엄(인용 0)', durability: 'CONSUMABLE', zone: 'AVOID' } },
  { match: /quora\.com/i, info: { index: 60, label: '쿼라(인용 0)', durability: 'CONSUMABLE', zone: 'AVOID' } },
];

/** PBN(위성사이트) 의심 TLD — 강의록 31번 */
const PBN_TLDS = /\.(xyz|top|icu|site|online|shop|club|cyou|sbs)$/i;
/** PBN 전형 도메인 패턴: 범용 영단어 조합 + org/net */
const PBN_WORDS = /(expert|open|insight|learning|journal|center|guide|today|global|world|info|hub|zone|daily|report|review|network)/i;

/** 뉴스 매체 */
const NEWS_PATTERN = /(news|chosun|joongang|donga|hankyung|mk\.co\.kr|yna\.co\.kr|edaily|mt\.co\.kr|sedaily|newsis|nocutnews|ohmynews|pressian|kmib|segye|seoul\.co\.kr|khan\.co\.kr|hani\.co\.kr|dailymedi|medi|doctors)/i;

/**
 * 도메인 → 공급량 정보 해석
 * @param domain 정규화된 도메인 (www 제거)
 * @param ownDomains 자사 도메인 목록 (병원 홈페이지) — 최우선 본진 판정
 */
export function resolveSupply(domain: string, ownDomains: string[] = []): SupplyInfo {
  const d = (domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return { index: 100, label: '미분류', durability: 'CONSUMABLE', zone: 'AVOID' };

  // ① 자사 도메인 = 본진, 공급량 1 (내가 만드는 만큼만 존재)
  for (const own of ownDomains) {
    const o = (own || '').toLowerCase().replace(/^www\./, '');
    if (o && (d === o || d.endsWith(`.${o}`))) {
      return { index: 1, label: '자사 홈페이지', durability: 'OWNED', zone: 'HOME_BASE' };
    }
  }

  // ② 사전 매칭
  for (const { match, info } of SUPPLY_TABLE) {
    if (match.test(d)) return info;
  }

  // ③ PBN 의심 — 강의록 31번
  if (PBN_TLDS.test(d) || (/\.(org|net)$/i.test(d) && PBN_WORDS.test(d) && !/hospital|dental|clinic|medi|치과/i.test(d))) {
    return { index: 15, label: '위성사이트 의심(PBN)', durability: 'CONSUMABLE', zone: 'AVOID' };
  }

  // ④ 뉴스
  if (NEWS_PATTERN.test(d)) {
    return { index: 30, label: '뉴스/매체', durability: 'ACCUMULATIVE', zone: 'SNIPER' };
  }

  // ⑤ 병원 자체 사이트로 보이는 도메인 (경쟁사 홈페이지)
  if (/dental|clinic|hospital|치과|병원|medi|oral|smile|teeth|plastic|derma/i.test(d)) {
    return { index: 25, label: '타 병원 홈페이지', durability: 'OWNED', zone: 'SNIPER' };
  }

  // ⑥ 미분류
  return { index: 80, label: '기타 웹', durability: 'CONSUMABLE', zone: 'VOLUME' };
}

export const ZONE_LABELS: Record<SupplyInfo['zone'], string> = {
  HOME_BASE: '본진',
  SNIPER: '고효율 저격수',
  VOLUME: '물량 파도',
  AVOID: '하지마',
};

export const ZONE_GUIDE: Record<SupplyInfo['zone'], string> = {
  HOME_BASE: '홈페이지·GBP — 최상위 출처. 여기가 비면 나머지는 다 새는 물통입니다.',
  SNIPER: '의료 플랫폼·위키형·해외 디렉토리 — 문서 1개가 물량 100개를 이깁니다.',
  VOLUME: '인스타·틱톡·스레드·페북 — 수명 2~6주. 멈추면 사라지므로 계속 발행해야 합니다.',
  AVOID: '지식iN·네이버블로그 신규·티스토리 신규·PBN — 투입 대비 회수가 안 됩니다.',
};

export const DURABILITY_LABELS: Record<SupplyInfo['durability'], string> = {
  OWNED: '보유 자산',
  ACCUMULATIVE: '축적형(영구)',
  CONSUMABLE: '소모형(2~6주)',
};
