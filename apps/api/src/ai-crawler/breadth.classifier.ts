/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Breadth-B 도메인 분류 + 권위도 점수 매핑 (B안: 25 → 12 카테고리 통합)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 【B안 변경 사유】
 *  - 기존 25 카테고리: 가짓수가 너무 많아 Breadth-B 잡 처리 시간 증가
 *  - 유사 권위도/유사 도메인은 묶어서 12 카테고리로 압축
 *  - 권위도가 높거나 점수 변별력이 큰 카테고리는 분리 유지
 *
 * 【12 카테고리 (권위도 1~10)】
 *   ① GOV_PUBLIC          (10) 정부/공공기관 (.go.kr, .or.kr)
 *   ② UNIVERSITY_HOSPITAL (10) 대학/대학병원 (.ac.kr)
 *   ③ MEDICAL_PORTAL      (9)  의료 전문 포털 + 의료 리뷰 (modoodoc, hidoc, 강남언니 등)
 *   ④ MAJOR_PORTAL        (8)  종합 검색 포털 (naver/google/daum 검색)
 *   ⑤ HOSPITAL_OFFICIAL   (7)  병원 공식 + 병원 블로그
 *   ⑥ LOCAL_PLACE         (7)  로컬 플레이스 (naver place, kakao map, google maps)
 *   ⑦ VIDEO_SNS           (7)  영상 (YouTube)
 *   ⑧ WIKI_NEWS           (6)  백과·뉴스·프리미엄 콘텐츠
 *   ⑨ BLOG_PLATFORM       (5)  블로그 플랫폼 (naver blog, tistory, brunch)
 *   ⑩ SOCIAL_SNS          (5)  소셜 SNS (Instagram)
 *   ⑪ UGC_REVIEW          (4)  UGC 리뷰 (naver cafe/kin)
 *   ⑫ LOW_TRUST           (2)  광고/랭킹/미분류 (저신뢰)
 *
 *  ⚠️ 실제 prod 데이터(불당본점 8,659 응답, 754 도메인) 기반으로 설계
 */

export interface CategoryInfo {
  category: string;        // 12 카테고리 중 하나
  subCategory?: string;    // 하위 분류 (UI 표시용)
  authority: number;       // 1~10
  type: 'hospital' | 'platform' | 'portal' | 'sns' | 'review' | 'blog' | 'news' | 'wiki' | 'public' | 'misc';
}

/**
 * 카테고리 코드 → 한글 라벨 (12 카테고리)
 */
export const CATEGORY_LABELS: Record<string, string> = {
  GOV_PUBLIC: '정부/공공',
  UNIVERSITY_HOSPITAL: '대학/대학병원',
  MEDICAL_PORTAL: '의료 포털',
  MAJOR_PORTAL: '종합 검색 포털',
  HOSPITAL_OFFICIAL: '병원 공식/블로그',
  LOCAL_PLACE: '로컬 플레이스',
  VIDEO_SNS: '영상(유튜브)',
  WIKI_NEWS: '백과/뉴스',
  BLOG_PLATFORM: '블로그',
  SOCIAL_SNS: 'SNS',
  UGC_REVIEW: 'UGC 리뷰',
  LOW_TRUST: '광고/저신뢰',
};

/**
 * 【B안】구→신 카테고리 매핑 (마이그레이션용, 통계/리포트 호환)
 * 이전 25 카테고리로 저장된 데이터를 12 카테고리로 표현할 때 사용
 */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  // Tier S 유지
  GOV_PUBLIC: 'GOV_PUBLIC',
  UNIVERSITY_HOSPITAL: 'UNIVERSITY_HOSPITAL',
  ACADEMIC: 'LOW_TRUST',           // huggingface 같은 잡지식은 신뢰도 낮춤
  // 의료 포털·리뷰 통합
  MEDICAL_PORTAL: 'MEDICAL_PORTAL',
  REVIEW_PLATFORM: 'MEDICAL_PORTAL',
  HOSPITAL_RANKING: 'LOW_TRUST',   // 광고성 랭킹 사이트 → 저신뢰
  // 병원 직접 채널
  HOSPITAL_OFFICIAL: 'HOSPITAL_OFFICIAL',
  HOSPITAL_BLOG: 'HOSPITAL_OFFICIAL',
  // 종합 포털 통합
  NAVER_SEARCH: 'MAJOR_PORTAL',
  KAKAO_DAUM: 'MAJOR_PORTAL',
  GOOGLE_GENERAL: 'MAJOR_PORTAL',
  // 로컬 플레이스 (지도/플레이스만 분리)
  NAVER_PLACE: 'LOCAL_PLACE',
  // 영상
  YOUTUBE: 'VIDEO_SNS',
  // 백과/뉴스/프리미엄
  WIKI: 'WIKI_NEWS',
  NEWS: 'WIKI_NEWS',
  NAVER_PREMIUM: 'WIKI_NEWS',
  // 블로그 플랫폼
  NAVER_BLOG: 'BLOG_PLATFORM',
  TISTORY: 'BLOG_PLATFORM',
  BRUNCH: 'BLOG_PLATFORM',
  // SNS
  INSTAGRAM: 'SOCIAL_SNS',
  // UGC
  NAVER_CAFE: 'UGC_REVIEW',
  NAVER_KIN: 'UGC_REVIEW',
  // 광고/기타
  AD_AFFILIATE: 'LOW_TRUST',
  MISC: 'LOW_TRUST',
};

/**
 * 정확 매칭 카테고리 (도메인 → 12 카테고리)
 */
const EXACT_DOMAIN_MAP: Record<string, CategoryInfo> = {
  // ━━━ 의료 포털 (③ MEDICAL_PORTAL) ━━━
  'modoodoc.com':    { category: 'MEDICAL_PORTAL', subCategory: '모두닥',     authority: 9, type: 'platform' },
  'goodoc.co.kr':    { category: 'MEDICAL_PORTAL', subCategory: '굿닥',       authority: 9, type: 'platform' },
  'doctornow.co.kr': { category: 'MEDICAL_PORTAL', subCategory: '닥터나우',   authority: 9, type: 'platform' },
  'my-doctor.io':    { category: 'MEDICAL_PORTAL', subCategory: '마이닥터',   authority: 8, type: 'platform' },
  'hidoc.co.kr':     { category: 'MEDICAL_PORTAL', subCategory: '하이닥',     authority: 9, type: 'platform' },
  'cashdoc.me':      { category: 'MEDICAL_PORTAL', subCategory: '캐시닥',     authority: 7, type: 'platform' },
  'gangnamunni.com': { category: 'MEDICAL_PORTAL', subCategory: '강남언니',   authority: 8, type: 'review' },
  'medi-hi.com':     { category: 'MEDICAL_PORTAL', subCategory: '메디하이',   authority: 7, type: 'platform' },
  'banksalad.com':   { category: 'MEDICAL_PORTAL', subCategory: '뱅크샐러드', authority: 7, type: 'platform' },

  // ━━━ 광고성 병원 랭킹 (⑫ LOW_TRUST) ━━━
  'baruntop25.com':  { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'buldangtop.co.kr':{ category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'seoultop.co.kr':  { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'seoulbest.co.kr': { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'goodhosrank.com': { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'chmore.com':      { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'bbmt24.com':      { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },
  'bbmt365.com':     { category: 'LOW_TRUST', subCategory: '랭킹 사이트', authority: 3, type: 'misc' },

  // ━━━ 종합 검색 포털 (④ MAJOR_PORTAL) ━━━
  'naver.com':        { category: 'MAJOR_PORTAL', subCategory: '네이버 검색', authority: 8, type: 'portal' },
  'm.naver.com':      { category: 'MAJOR_PORTAL', subCategory: '네이버 검색', authority: 8, type: 'portal' },
  'search.naver.com': { category: 'MAJOR_PORTAL', subCategory: '네이버 검색', authority: 8, type: 'portal' },
  'google.com':       { category: 'MAJOR_PORTAL', subCategory: '구글 검색',   authority: 8, type: 'portal' },
  'kakao.com':        { category: 'MAJOR_PORTAL', subCategory: '카카오',       authority: 7, type: 'portal' },
  'daum.net':         { category: 'MAJOR_PORTAL', subCategory: '다음',         authority: 7, type: 'portal' },
  'pf.kakao.com':     { category: 'MAJOR_PORTAL', subCategory: '카카오톡 채널', authority: 6, type: 'portal' },

  // ━━━ 로컬 플레이스 (⑥ LOCAL_PLACE) ━━━
  'site.naver.com':   { category: 'LOCAL_PLACE', subCategory: '네이버 플레이스', authority: 7, type: 'portal' },
  'map.naver.com':    { category: 'LOCAL_PLACE', subCategory: '네이버 지도',     authority: 7, type: 'portal' },
  'place.naver.com':  { category: 'LOCAL_PLACE', subCategory: '네이버 플레이스', authority: 7, type: 'portal' },
  'm.place.naver.com':{ category: 'LOCAL_PLACE', subCategory: '네이버 플레이스', authority: 7, type: 'portal' },
  'modoo.at':         { category: 'LOCAL_PLACE', subCategory: '모두',             authority: 5, type: 'portal' },
  'map.kakao.com':    { category: 'LOCAL_PLACE', subCategory: '카카오맵',         authority: 7, type: 'portal' },
  'maps.google.com':  { category: 'LOCAL_PLACE', subCategory: '구글 맵',          authority: 8, type: 'portal' },

  // ━━━ 블로그 (⑨ BLOG_PLATFORM) ━━━
  'blog.naver.com':   { category: 'BLOG_PLATFORM', subCategory: '네이버 블로그', authority: 5, type: 'blog' },
  'm.blog.naver.com': { category: 'BLOG_PLATFORM', subCategory: '네이버 블로그', authority: 5, type: 'blog' },
  'tistory.com':      { category: 'BLOG_PLATFORM', subCategory: '티스토리',       authority: 4, type: 'blog' },
  'brunch.co.kr':     { category: 'BLOG_PLATFORM', subCategory: '브런치',         authority: 5, type: 'blog' },

  // ━━━ UGC 리뷰 (⑪ UGC_REVIEW) ━━━
  'cafe.naver.com':   { category: 'UGC_REVIEW', subCategory: '네이버 카페',    authority: 4, type: 'review' },
  'kin.naver.com':    { category: 'UGC_REVIEW', subCategory: '네이버 지식인',  authority: 4, type: 'review' },

  // ━━━ 백과/뉴스/프리미엄 (⑧ WIKI_NEWS) ━━━
  'contents.premium.naver.com': { category: 'WIKI_NEWS', subCategory: '네이버 프리미엄', authority: 6, type: 'blog' },
  'v.daum.net':       { category: 'WIKI_NEWS', subCategory: '다음 뉴스',  authority: 7, type: 'news' },
  'chosun.com':       { category: 'WIKI_NEWS', subCategory: '조선일보',   authority: 7, type: 'news' },
  'donga.com':        { category: 'WIKI_NEWS', subCategory: '동아일보',   authority: 7, type: 'news' },
  'with.donga.co.kr': { category: 'WIKI_NEWS', subCategory: '동아닷컴',   authority: 6, type: 'news' },
  'namu.wiki':        { category: 'WIKI_NEWS', subCategory: '나무위키',   authority: 6, type: 'wiki' },
  'wikipedia.org':    { category: 'WIKI_NEWS', subCategory: '위키피디아', authority: 7, type: 'wiki' },
  'ko.wikipedia.org': { category: 'WIKI_NEWS', subCategory: '위키피디아', authority: 7, type: 'wiki' },

  // ━━━ 영상 (⑦ VIDEO_SNS) ━━━
  'youtube.com':   { category: 'VIDEO_SNS', subCategory: '유튜브', authority: 7, type: 'sns' },
  'm.youtube.com': { category: 'VIDEO_SNS', subCategory: '유튜브', authority: 7, type: 'sns' },

  // ━━━ 소셜 SNS (⑩ SOCIAL_SNS) ━━━
  'instagram.com': { category: 'SOCIAL_SNS', subCategory: '인스타그램', authority: 5, type: 'sns' },

  // ━━━ 공공/학술 (① GOV_PUBLIC / ② UNIVERSITY_HOSPITAL) ━━━
  'hira.or.kr':    { category: 'GOV_PUBLIC',          subCategory: '심평원',           authority: 10, type: 'public' },
  'cheonan.go.kr': { category: 'GOV_PUBLIC',          subCategory: '천안시',           authority: 9,  type: 'public' },
  'schmc.ac.kr':   { category: 'UNIVERSITY_HOSPITAL', subCategory: '순천향대학교병원', authority: 10, type: 'public' },
  'cnuh.co.kr':    { category: 'UNIVERSITY_HOSPITAL', subCategory: '충남대학교병원',   authority: 10, type: 'public' },
  'dankook.ac.kr': { category: 'UNIVERSITY_HOSPITAL', subCategory: '단국대',           authority: 10, type: 'public' },

  // ━━━ 기타 (⑫ LOW_TRUST) ━━━
  'huggingface.co': { category: 'LOW_TRUST', subCategory: '잡지식', authority: 4, type: 'misc' },
};

/**
 * 패턴 매칭 (suffix/contains 기반) — 12 카테고리 기준
 */
function patternMatch(domain: string): CategoryInfo | null {
  // ━━━ 네이버 서브도메인 (블로그/카페/플레이스/지식인) ━━━
  if (domain.endsWith('.naver.com')) {
    if (domain.includes('blog.')) return { category: 'BLOG_PLATFORM', subCategory: '네이버 블로그', authority: 5, type: 'blog' };
    if (domain.includes('cafe.')) return { category: 'UGC_REVIEW',    subCategory: '네이버 카페',   authority: 4, type: 'review' };
    if (domain.includes('place.')) return { category: 'LOCAL_PLACE',  subCategory: '네이버 플레이스', authority: 7, type: 'portal' };
    if (domain.includes('kin.')) return { category: 'UGC_REVIEW',     subCategory: '네이버 지식인', authority: 4, type: 'review' };
    return { category: 'MAJOR_PORTAL', subCategory: '네이버', authority: 7, type: 'portal' };
  }

  // 티스토리 서브도메인
  if (domain.endsWith('.tistory.com')) {
    return { category: 'BLOG_PLATFORM', subCategory: '티스토리', authority: 4, type: 'blog' };
  }

  // 학교/병원/공공
  if (domain.endsWith('.ac.kr')) {
    return { category: 'UNIVERSITY_HOSPITAL', authority: 9, type: 'public' };
  }
  if (domain.endsWith('.go.kr')) {
    return { category: 'GOV_PUBLIC', authority: 10, type: 'public' };
  }
  if (domain.endsWith('.or.kr')) {
    return { category: 'GOV_PUBLIC', subCategory: '공공기관', authority: 8, type: 'public' };
  }

  // cafe24 등 호스팅 → 광고성 가능성 → 저신뢰
  if (domain.includes('cafe24.com')) {
    return { category: 'LOW_TRUST', subCategory: '호스팅', authority: 2, type: 'misc' };
  }

  // 뉴스 도메인 휴리스틱
  if (domain.includes('news') || (domain.endsWith('.com') && /(daily|times|tribune|herald|press|news)/.test(domain))) {
    return { category: 'WIKI_NEWS', subCategory: '뉴스', authority: 5, type: 'news' };
  }

  // 치과/병원 도메인 휴리스틱
  const dentalKeywords = ['dent', 'dental', '치과', 'tooth', 'teeth', 'implant', 'ortho', 'smile', 'plant', 'top', 'star'];
  const hospitalKeywords = ['hosp', 'clinic', 'medi', 'med', '병원', '의원'];
  const lower = domain.toLowerCase();

  if (dentalKeywords.some(k => lower.includes(k))) {
    // 광고 의심: top/best/rank/promise 등이 동반되면 저신뢰
    if (/top|best|rank|promise|hello|good[a-z]*rank/.test(lower)) {
      return { category: 'LOW_TRUST', subCategory: '랭킹 의심', authority: 3, type: 'misc' };
    }
    return { category: 'HOSPITAL_OFFICIAL', authority: 7, type: 'hospital' };
  }
  if (hospitalKeywords.some(k => lower.includes(k))) {
    return { category: 'HOSPITAL_OFFICIAL', authority: 6, type: 'hospital' };
  }

  // .kr / .co.kr 일반 → 저신뢰
  if (domain.endsWith('.kr')) {
    return { category: 'LOW_TRUST', subCategory: '미분류 KR', authority: 2, type: 'misc' };
  }

  return null;
}

/**
 * 메인 분류 함수
 */
export function classifyDomain(rawDomain: string): CategoryInfo {
  if (!rawDomain || rawDomain === 'invalid') {
    return { category: 'LOW_TRUST', subCategory: '미분류', authority: 1, type: 'misc' };
  }

  const domain = rawDomain.replace(/^www\./, '').toLowerCase();

  // 1) 정확 매칭
  if (EXACT_DOMAIN_MAP[domain]) return EXACT_DOMAIN_MAP[domain];

  // 2) 패턴 매칭
  const pattern = patternMatch(domain);
  if (pattern) return pattern;

  // 3) Fallback
  return { category: 'LOW_TRUST', subCategory: '미분류', authority: 1, type: 'misc' };
}

/**
 * 우리 병원의 자체 도메인 여부 판단
 *
 * 우선순위:
 *   1) 등록된 websiteUrl 정확 매칭 (또는 동일 root domain)
 *   2) nameAliases 에 등록된 영문 별칭이 도메인에 포함되는지
 *   3) 병원명에서 추출한 영문 슬러그가 도메인에 포함되는지
 */
export function isOwnHospital(
  domain: string,
  hospitalName: string,
  hospitalWebsite?: string | null,
  nameAliases?: string[] | null,
): boolean {
  if (!domain) return false;
  const d = domain.replace(/^www\./, '').toLowerCase();

  // 1) 등록된 웹사이트와 동일 또는 root domain 일치
  if (hospitalWebsite) {
    try {
      const ownHost = new URL(
        hospitalWebsite.startsWith('http') ? hospitalWebsite : `https://${hospitalWebsite}`,
      )
        .hostname.replace(/^www\./, '')
        .toLowerCase();
      if (d === ownHost) return true;
      // 서브도메인 관계 (예: blog.bdseoulbd.com vs bdseoulbd.com)
      if (d.endsWith('.' + ownHost) || ownHost.endsWith('.' + d)) return true;
    } catch {}
  }

  // 2) nameAliases 의 영문 토큰 매칭
  if (Array.isArray(nameAliases)) {
    for (const alias of nameAliases) {
      if (!alias) continue;
      const lat = alias.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lat.length >= 4 && d.includes(lat)) return true;
    }
  }

  // 3) 병원명에서 추출한 영문 슬러그
  const cleanName = hospitalName
    .replace(/(치과|의원|병원|클리닉|dental|clinic|hospital|본점|지점|점)/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (cleanName.length >= 2) {
    const lat = cleanName.replace(/[^a-z0-9]/g, '');
    if (lat.length >= 4 && d.includes(lat)) return true;
  }

  return false;
}
