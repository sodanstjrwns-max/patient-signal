/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Breadth-B 도메인 분류 + 권위도 점수 매핑
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 25 카테고리 × 권위도 점수 (1~10):
 *  - 10: 정부/대학/공공 의료기관
 *  - 9:  대형 의료 포털 (modoodoc, hidoc, goodoc, doctornow)
 *  - 8:  종합 포털 (naver, daum, kakao, google)
 *  - 7:  치과 공식 사이트, 영상 매체 (YouTube)
 *  - 6:  지식 백과 (위키, 나무위키), 주요 뉴스
 *  - 5:  대형 SNS (Instagram, 페이스북)
 *  - 4:  네이버 카페/지식인/플레이스 등 UGC
 *  - 3:  중간 블로그 (네이버 블로그, 티스토리)
 *  - 2:  광고성 랭킹 사이트, 어필리에이트
 *  - 1:  미분류/저신뢰 도메인
 *
 *  ⚠️ 실제 prod 데이터(불당본점 8,659 응답, 754 도메인) 기반으로 설계
 */

export interface CategoryInfo {
  category: string;        // 25 카테고리 중 하나
  subCategory?: string;    // 하위 분류
  authority: number;       // 1~10
  type: 'hospital' | 'platform' | 'portal' | 'sns' | 'review' | 'blog' | 'news' | 'wiki' | 'public' | 'misc';
}

/**
 * 카테고리 코드 → 한글 라벨
 */
export const CATEGORY_LABELS: Record<string, string> = {
  // ━━━ 의료 플랫폼 (Tier S) ━━━
  MEDICAL_PORTAL: '대형 의료 포털',
  REVIEW_PLATFORM: '의료 리뷰 플랫폼',
  HOSPITAL_RANKING: '병원 랭킹 사이트',
  
  // ━━━ 병원 직접 채널 (Tier A) ━━━
  HOSPITAL_OFFICIAL: '병원 공식 사이트',
  HOSPITAL_BLOG: '병원 블로그',
  
  // ━━━ 공공/학술 (Tier S) ━━━
  GOV_PUBLIC: '정부/공공기관',
  UNIVERSITY_HOSPITAL: '대학/대학병원',
  ACADEMIC: '학술/논문',
  
  // ━━━ 종합 포털 (Tier B) ━━━
  NAVER_SEARCH: '네이버 검색',
  NAVER_BLOG: '네이버 블로그',
  NAVER_CAFE: '네이버 카페',
  NAVER_KIN: '네이버 지식인',
  NAVER_PLACE: '네이버 플레이스',
  NAVER_PREMIUM: '네이버 프리미엄',
  KAKAO_DAUM: '카카오/다음',
  GOOGLE_GENERAL: '구글 일반',
  
  // ━━━ 콘텐츠/UGC (Tier B/C) ━━━
  YOUTUBE: '유튜브',
  INSTAGRAM: '인스타그램',
  TISTORY: '티스토리',
  BRUNCH: '브런치',
  
  // ━━━ 지식/뉴스 (Tier B) ━━━
  WIKI: '백과/위키',
  NEWS: '뉴스',
  
  // ━━━ 광고/저신뢰 (Tier D) ━━━
  AD_AFFILIATE: '광고/어필리에이트',
  
  // ━━━ 기타 ━━━
  MISC: '기타',
};

/**
 * 정확 매칭 카테고리 (도메인 → 카테고리)
 */
const EXACT_DOMAIN_MAP: Record<string, CategoryInfo> = {
  // 의료 플랫폼
  'modoodoc.com': { category: 'MEDICAL_PORTAL', subCategory: '모두닥', authority: 9, type: 'platform' },
  'goodoc.co.kr': { category: 'MEDICAL_PORTAL', subCategory: '굿닥', authority: 9, type: 'platform' },
  'doctornow.co.kr': { category: 'MEDICAL_PORTAL', subCategory: '닥터나우', authority: 9, type: 'platform' },
  'my-doctor.io': { category: 'MEDICAL_PORTAL', subCategory: '마이닥터', authority: 8, type: 'platform' },
  'hidoc.co.kr': { category: 'MEDICAL_PORTAL', subCategory: '하이닥', authority: 9, type: 'platform' },
  'cashdoc.me': { category: 'MEDICAL_PORTAL', subCategory: '캐시닥', authority: 7, type: 'platform' },
  'gangnamunni.com': { category: 'REVIEW_PLATFORM', subCategory: '강남언니', authority: 8, type: 'review' },
  'medi-hi.com': { category: 'MEDICAL_PORTAL', subCategory: '메디하이', authority: 7, type: 'platform' },
  'banksalad.com': { category: 'MEDICAL_PORTAL', subCategory: '뱅크샐러드 의료', authority: 7, type: 'platform' },

  // 병원 랭킹 / 어필리에이트 (광고성 의심)
  'baruntop25.com': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'buldangtop.co.kr': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'seoultop.co.kr': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'seoulbest.co.kr': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'goodhosrank.com': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'chmore.com': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'bbmt24.com': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },
  'bbmt365.com': { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' },

  // 종합 포털
  'naver.com': { category: 'NAVER_SEARCH', authority: 8, type: 'portal' },
  'm.naver.com': { category: 'NAVER_SEARCH', authority: 8, type: 'portal' },
  'search.naver.com': { category: 'NAVER_SEARCH', authority: 8, type: 'portal' },
  'site.naver.com': { category: 'NAVER_PLACE', authority: 7, type: 'portal' },
  'blog.naver.com': { category: 'NAVER_BLOG', authority: 5, type: 'blog' },
  'm.blog.naver.com': { category: 'NAVER_BLOG', authority: 5, type: 'blog' },
  'cafe.naver.com': { category: 'NAVER_CAFE', authority: 4, type: 'review' },
  'kin.naver.com': { category: 'NAVER_KIN', authority: 4, type: 'review' },
  'map.naver.com': { category: 'NAVER_PLACE', authority: 7, type: 'portal' },
  'place.naver.com': { category: 'NAVER_PLACE', authority: 7, type: 'portal' },
  'm.place.naver.com': { category: 'NAVER_PLACE', authority: 7, type: 'portal' },
  'contents.premium.naver.com': { category: 'NAVER_PREMIUM', authority: 6, type: 'blog' },
  'modoo.at': { category: 'NAVER_PLACE', subCategory: '모두', authority: 5, type: 'portal' },

  'google.com': { category: 'GOOGLE_GENERAL', authority: 8, type: 'portal' },
  'maps.google.com': { category: 'GOOGLE_GENERAL', subCategory: '구글 맵', authority: 8, type: 'portal' },
  'kakao.com': { category: 'KAKAO_DAUM', authority: 7, type: 'portal' },
  'pf.kakao.com': { category: 'KAKAO_DAUM', subCategory: '카카오톡 채널', authority: 6, type: 'portal' },
  'map.kakao.com': { category: 'KAKAO_DAUM', subCategory: '카카오맵', authority: 7, type: 'portal' },
  'daum.net': { category: 'KAKAO_DAUM', authority: 7, type: 'portal' },
  'v.daum.net': { category: 'KAKAO_DAUM', subCategory: '다음 뉴스', authority: 7, type: 'news' },

  // SNS / 영상
  'instagram.com': { category: 'INSTAGRAM', authority: 5, type: 'sns' },
  'youtube.com': { category: 'YOUTUBE', authority: 7, type: 'sns' },
  'm.youtube.com': { category: 'YOUTUBE', authority: 7, type: 'sns' },

  // 블로그 플랫폼
  'tistory.com': { category: 'TISTORY', authority: 4, type: 'blog' },
  'brunch.co.kr': { category: 'BRUNCH', authority: 5, type: 'blog' },

  // 백과
  'namu.wiki': { category: 'WIKI', subCategory: '나무위키', authority: 6, type: 'wiki' },
  'wikipedia.org': { category: 'WIKI', subCategory: '위키피디아', authority: 7, type: 'wiki' },
  'ko.wikipedia.org': { category: 'WIKI', subCategory: '위키피디아', authority: 7, type: 'wiki' },

  // 뉴스
  'chosun.com': { category: 'NEWS', authority: 7, type: 'news' },
  'donga.com': { category: 'NEWS', authority: 7, type: 'news' },
  'with.donga.co.kr': { category: 'NEWS', subCategory: '동아닷컴', authority: 6, type: 'news' },

  // 공공/학술
  'hira.or.kr': { category: 'GOV_PUBLIC', subCategory: '심평원', authority: 10, type: 'public' },
  'cheonan.go.kr': { category: 'GOV_PUBLIC', authority: 9, type: 'public' },
  'schmc.ac.kr': { category: 'UNIVERSITY_HOSPITAL', subCategory: '순천향대학교병원', authority: 10, type: 'public' },
  'cnuh.co.kr': { category: 'UNIVERSITY_HOSPITAL', subCategory: '충남대학교병원', authority: 10, type: 'public' },
  'dankook.ac.kr': { category: 'UNIVERSITY_HOSPITAL', subCategory: '단국대', authority: 10, type: 'public' },

  // AI/지식
  'huggingface.co': { category: 'ACADEMIC', authority: 6, type: 'misc' },
};

/**
 * 패턴 매칭 (suffix/contains 기반)
 */
function patternMatch(domain: string): CategoryInfo | null {
  // 네이버 서브도메인
  if (domain.endsWith('.naver.com')) {
    if (domain.includes('blog.')) return { category: 'NAVER_BLOG', authority: 5, type: 'blog' };
    if (domain.includes('cafe.')) return { category: 'NAVER_CAFE', authority: 4, type: 'review' };
    if (domain.includes('place.')) return { category: 'NAVER_PLACE', authority: 7, type: 'portal' };
    if (domain.includes('kin.')) return { category: 'NAVER_KIN', authority: 4, type: 'review' };
    return { category: 'NAVER_SEARCH', authority: 7, type: 'portal' };
  }

  // 티스토리 서브도메인
  if (domain.endsWith('.tistory.com')) {
    return { category: 'TISTORY', authority: 4, type: 'blog' };
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

  // cafe24 등 호스팅 → 광고성 가능성
  if (domain.includes('cafe24.com')) {
    return { category: 'AD_AFFILIATE', authority: 2, type: 'misc' };
  }

  // 뉴스 도메인 휴리스틱
  if (domain.includes('news') || domain.endsWith('.com') && /(daily|times|tribune|herald|press|news)/.test(domain)) {
    return { category: 'NEWS', authority: 5, type: 'news' };
  }

  // 치과/병원 도메인 휴리스틱
  const dentalKeywords = ['dent', 'dental', '치과', 'tooth', 'teeth', 'implant', 'ortho', 'smile', 'plant', 'top', 'star'];
  const hospitalKeywords = ['hosp', 'clinic', 'medi', 'med', '병원', '의원'];
  const lower = domain.toLowerCase();
  
  if (dentalKeywords.some(k => lower.includes(k))) {
    // 광고 의심: top/best/rank/promise/24 등이 동반되면 랭킹 사이트로 분류
    if (/top|best|rank|promise|hello|good[a-z]*rank/.test(lower)) {
      return { category: 'HOSPITAL_RANKING', authority: 3, type: 'misc' };
    }
    return { category: 'HOSPITAL_OFFICIAL', authority: 7, type: 'hospital' };
  }
  if (hospitalKeywords.some(k => lower.includes(k))) {
    return { category: 'HOSPITAL_OFFICIAL', authority: 6, type: 'hospital' };
  }

  // .kr / .co.kr 일반 → 미분류 한국 도메인
  if (domain.endsWith('.kr')) {
    return { category: 'MISC', authority: 2, type: 'misc' };
  }

  return null;
}

/**
 * 메인 분류 함수
 */
export function classifyDomain(rawDomain: string): CategoryInfo {
  if (!rawDomain || rawDomain === 'invalid') {
    return { category: 'MISC', authority: 1, type: 'misc' };
  }

  const domain = rawDomain.replace(/^www\./, '').toLowerCase();

  // 1) 정확 매칭
  if (EXACT_DOMAIN_MAP[domain]) return EXACT_DOMAIN_MAP[domain];

  // 2) 패턴 매칭
  const pattern = patternMatch(domain);
  if (pattern) return pattern;

  // 3) Fallback
  return { category: 'MISC', authority: 1, type: 'misc' };
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
