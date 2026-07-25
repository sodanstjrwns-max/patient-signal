/**
 * 【P2-1】데모 인용 소스 풀
 *
 * 문제: 기존 시드는 인용 URL이 전부 `https://example.com/...` (또는 seoulbd.co.kr 단일 도메인)이라
 *       인용 분석(Citation Analysis) / 소스 인텔 화면이 "example.com 100%"로 표시되어
 *       데모/영업 시연 시 제품이 고장난 것처럼 보였음.
 *
 * 해결: 실제 한국 치과 AEO 환경에서 관측되는 도메인 분포를 근사한 가중치 풀로 교체.
 *       (비율은 실측 크롤링 로그의 대략적 분포를 참고한 데모용 근사치)
 */

export interface CitationSource {
  domain: string;
  weight: number; // 상대 가중치 (합계로 정규화)
  sourceType: string;
  category: string;
  authorityScore: number; // 1-10
  /** 경로 생성기 — 주제 슬러그를 받아 그럴듯한 URL path를 만든다 */
  path: (slug: string, n: number) => string;
}

export const CITATION_SOURCES: CitationSource[] = [
  {
    domain: 'blog.naver.com',
    weight: 34,
    sourceType: 'naver_blog',
    category: 'BLOG',
    authorityScore: 6,
    path: (slug, n) => `/seoul_bd_dental/${223000000 + n}`,
  },
  {
    domain: 'm.blog.naver.com',
    weight: 12,
    sourceType: 'naver_blog',
    category: 'BLOG',
    authorityScore: 5,
    path: (slug, n) => `/dental_review_kr/${222000000 + n}`,
  },
  {
    domain: 'cafe.naver.com',
    weight: 9,
    sourceType: 'naver_cafe',
    category: 'COMMUNITY',
    authorityScore: 5,
    path: (slug, n) => `/dentalcafe/${1200000 + n}`,
  },
  {
    domain: 'seoulbd.co.kr',
    weight: 8,
    sourceType: 'owned_site',
    category: 'HOSPITAL_SITE',
    authorityScore: 8,
    path: (slug) => `/treatment/${slug}`,
  },
  {
    domain: 'www.instagram.com',
    weight: 7,
    sourceType: 'instagram_post',
    category: 'SOCIAL',
    authorityScore: 4,
    path: (slug, n) => `/p/C${slug.slice(0, 3)}${n}Xq/`,
  },
  {
    domain: 'www.youtube.com',
    weight: 6,
    sourceType: 'youtube',
    category: 'VIDEO',
    authorityScore: 6,
    path: (slug, n) => `/watch?v=dnt${slug.slice(0, 4)}${n}`,
  },
  {
    domain: 'www.modoodoc.com',
    weight: 6,
    sourceType: 'medical_portal',
    category: 'MEDICAL_PORTAL',
    authorityScore: 8,
    path: (slug, n) => `/hospitals/${40000 + n}`,
  },
  {
    domain: 'namu.wiki',
    weight: 4,
    sourceType: 'wiki',
    category: 'REFERENCE',
    authorityScore: 5,
    path: (slug) => `/w/${encodeURIComponent(slug)}`,
  },
  {
    domain: 'www.kda.or.kr',
    weight: 4,
    sourceType: 'association',
    category: 'AUTHORITY',
    authorityScore: 10,
    path: (slug, n) => `/board/view/${5000 + n}`,
  },
  {
    domain: 'health.chosun.com',
    weight: 3,
    sourceType: 'news',
    category: 'NEWS',
    authorityScore: 8,
    path: (slug, n) => `/site/data/html_dir/2026/0${(n % 9) + 1}/${10 + (n % 18)}/article_${n}.html`,
  },
  {
    domain: 'www.hidoc.co.kr',
    weight: 3,
    sourceType: 'medical_portal',
    category: 'MEDICAL_PORTAL',
    authorityScore: 7,
    path: (slug, n) => `/healthstory/news/C${100000 + n}`,
  },
  {
    domain: 'kin.naver.com',
    weight: 2,
    sourceType: 'qna',
    category: 'COMMUNITY',
    authorityScore: 3,
    path: (slug, n) => `/qna/detail.naver?d1id=7&docId=4${500000 + n}`,
  },
  {
    domain: 'www.dailydental.co.kr',
    weight: 2,
    sourceType: 'trade_press',
    category: 'NEWS',
    authorityScore: 7,
    path: (slug, n) => `/news/article.html?no=${130000 + n}`,
  },
];

const TOTAL_WEIGHT = CITATION_SOURCES.reduce((s, x) => s + x.weight, 0);

/** 가중치 기반 랜덤 소스 1개 선택 */
export function pickCitationSource(rand: number = Math.random()): CitationSource {
  let acc = rand * TOTAL_WEIGHT;
  for (const src of CITATION_SOURCES) {
    acc -= src.weight;
    if (acc <= 0) return src;
  }
  return CITATION_SOURCES[0];
}

/** 진료과목/주제 → URL 슬러그 */
const SLUG_MAP: Record<string, string> = {
  IMPLANT: 'implant',
  ORTHODONTICS: 'ortho',
  ORTHO: 'ortho',
  AESTHETIC: 'veneer',
  PEDIATRIC: 'kids',
  PERIODONTAL: 'perio',
  ENDODONTIC: 'endo',
  PROSTHODONTIC: 'crown',
  GENERAL: 'general',
};

export function toSlug(specialty?: string | null): string {
  if (!specialty) return 'general';
  return SLUG_MAP[specialty.toUpperCase()] || specialty.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * 그럴듯한 인용 URL 1~3개 생성
 * @param specialty 진료과목 (슬러그 생성용)
 * @param seed      URL을 결정적으로 만들기 위한 정수 (중복 URL 감소)
 * @param count     생성 개수
 */
export function buildCitedUrls(
  specialty: string | null | undefined,
  seed: number,
  count = 1,
): string[] {
  const slug = toSlug(specialty);
  const urls = new Set<string>();
  for (let i = 0; i < count; i++) {
    const src = pickCitationSource();
    urls.add(`https://${src.domain}${src.path(slug, seed * 7 + i * 13)}`);
  }
  return [...urls];
}
