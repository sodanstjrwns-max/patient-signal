/**
 * ═══════════════════════════════════════════════════════════
 *  Daily Prompt Matrix Engine v2.0
 *  - 모든 진료과 범용 5×5 매트릭스
 *  - 시즌 캘린더 + ABHS Golden Prompt 패턴 + 성과 기반 가중치
 * ═══════════════════════════════════════════════════════════
 *
 *  5축 구조:
 *    축1 (Intent)    : RESERVATION × COMPARISON × INFORMATION × REVIEW × FEAR
 *    축2 (Procedure) : 병원 핵심 시술 (최대 5개)
 *    축3 (Tone)      : 구어체 / 정중체 / 비교형 / 감성형 / 전문형
 *    축4 (Season)    : 월별 시즌 이벤트 + 요일 + 시사 트렌드
 *    축5 (Region)    : 시군구 / 동 / 타겟지역 / 약식 / 풀네임
 *
 *  이론상 조합 수: 5 × 5(시술) × 5(톤) × 4(시즌) × 4(지역) = 2,000개 후보
 *  매일 10개 비중복 선택 → DAU 리텐션 엔진
 */

import { SPECIALTY_PROCEDURES, SPECIALTY_NAMES } from '../query-templates/query-templates.service';

// ==================== 축1: 의도별 템플릿 ====================

export type IntentType = 'RESERVATION' | 'COMPARISON' | 'INFORMATION' | 'REVIEW' | 'FEAR';

interface IntentTemplate {
  intent: IntentType;
  templates: string[];  // {region}, {specialty}, {procedure}, {strength} 치환
  weight: number;       // 생성 확률 가중치 (ABHS 영향도)
}

export const INTENT_TEMPLATES: IntentTemplate[] = [
  {
    intent: 'RESERVATION',
    weight: 1.5,
    templates: [
      '{region} {procedure} 잘하는 {specialty} 추천해줘',
      '{region}에서 {procedure} 받으려면 어디가 좋아?',
      '{procedure} 전문 {specialty} {region} 근처에 있어?',
      '{region} {procedure} 예약하려는데 괜찮은 {specialty} 알려줘',
      '{procedure} 하고 싶은데 {region} 쪽에 좋은 {specialty} 추천',
      '{region} {specialty} 중에서 {procedure} 센터급으로 하는 곳 어디야?',
      '{procedure} 원데이로 하는 {region} {specialty} 있어?',
      '{region} {procedure} 전문의가 직접 하는 {specialty} 알려줘',
    ],
  },
  {
    intent: 'COMPARISON',
    weight: 1.1,
    templates: [
      '{region} {procedure} 비용 비교해줘. 어디가 가성비 좋아?',
      '{region} {specialty} 진료 잘하는 곳 Top 3 비교해줘',
      '{procedure} 잘하는 {region} {specialty} 장단점 분석해줘',
      '{region} {procedure} 대학병원 vs 개원의 어디가 나을까?',
      '{region} {procedure} 최신 장비 있는 {specialty} 비교해줘',
      '{region} {procedure} 경력 많은 의사 있는 {specialty} 비교',
      '{procedure} {region}에서 가격대별로 비교해줘',
    ],
  },
  {
    intent: 'INFORMATION',
    weight: 1.0,
    templates: [
      '{procedure} 시술 과정이 궁금한데, {region}에 유명한 {specialty} 있어?',
      '{region} {specialty}에서 {procedure} 받으려면 어떤 준비가 필요해?',
      '{procedure} 평균 비용이 얼마야? {region} 기준으로',
      '{procedure} 최신 트렌드가 뭐야? {region}에서 받을 수 있어?',
      '{region} {specialty} 의료보험 적용되는 {procedure} 있어?',
      '{procedure} 회복 기간은 얼마야? {region} {specialty} 기준',
      '{region} {procedure} 전문의가 있는 {specialty} 어디야?',
    ],
  },
  {
    intent: 'REVIEW',
    weight: 1.3,
    templates: [
      '{region} {procedure} 후기 좋은 {specialty} 어디야?',
      '{region} {procedure} 네이버 평점 높은 {specialty}',
      '{region} {procedure} 리뷰가 많은 {specialty} 알려줘',
      '{region} {procedure} 재방문율 높은 {specialty} 어디야?',
      '{region} {specialty} 실제 다녀본 사람들 평가 좋은 곳 어디야?',
      '{region} {procedure} 솔직한 후기 알려줘. 장단점 포함해서',
    ],
  },
  {
    intent: 'FEAR',
    weight: 1.2,
    templates: [
      '{procedure} 아프다는데 {region}에서 안전하게 받을 수 있는 곳은?',
      '{procedure} 부작용이 걱정되는데, {region} {specialty} 중 실력 좋은 곳은?',
      '{procedure} 재수술 위험은? {region}에서 안전한 {specialty} 추천',
      '{procedure} 마취가 걱정되는데, {region} {specialty} 중 안전한 곳',
      '{procedure} 실패 사례가 있어서 두려운데, {region} 전문 {specialty} 추천',
      '{procedure} 처음인데 {region} {specialty} 어디가 안심되게 해주는 곳이야?',
    ],
  },
];

// ==================== 축3: 톤 변형 ====================

export type ToneType = 'casual' | 'polite' | 'comparison' | 'emotional' | 'professional';

interface ToneVariation {
  tone: ToneType;
  templates: string[];
  weight: number;
}

export const TONE_VARIATIONS: ToneVariation[] = [
  {
    tone: 'casual',
    weight: 1.3,
    templates: [
      '{region} {procedure} 좀 알아보는데 괜찮은 데 있어?',
      '{region}에서 믿고 갈 수 있는 {specialty} 추천 좀',
      '{specialty} 가야 하는데 {region} 쪽에 어디가 좋을까?',
      '{region} 근처 {procedure} 진짜 잘하는 곳 알려줘',
      '{procedure} 고민인데 {region}에서 상담 잘 해주는 {specialty} 있나?',
    ],
  },
  {
    tone: 'polite',
    weight: 0.8,
    templates: [
      '{region}에서 {procedure} 전문으로 하는 {specialty}를 찾고 있습니다',
      '{procedure} 상담을 받고 싶은데 {region} 지역에서 추천해주실 수 있나요?',
      '{region} {specialty} 중 {procedure} 경험이 풍부한 곳을 알고 싶습니다',
    ],
  },
  {
    tone: 'comparison',
    weight: 1.0,
    templates: [
      '{region} {procedure} 맛집 {specialty} 어디야?',
      '{procedure} 실력파 {specialty} {region} 추천',
      '{procedure} 최신 기술 쓰는 {region} {specialty} 알려줘',
    ],
  },
  {
    tone: 'emotional',
    weight: 1.1,
    templates: [
      '{procedure} 때문에 스트레스받는데 {region}에서 편하게 갈 수 있는 {specialty} 있어?',
      '오래 미루던 {procedure} 드디어 하려는데 {region} {specialty} 어디가 좋을까',
      '{region} {procedure} 받고 인생 바뀌었다는 {specialty} 어디야?',
    ],
  },
  {
    tone: 'professional',
    weight: 0.7,
    templates: [
      '{region} {procedure} {specialty} 추천. 출처와 근거도 함께 알려줘.',
      '{region} {procedure} {specialty} 검색하면 어디가 나와?',
      '{region} {procedure} 전문가 관점에서 {specialty} 분석해줘',
    ],
  },
];

// ==================== 축4: 시즌 캘린더 ====================

export interface SeasonalEvent {
  month: number[];         // 적용 월
  dayOfWeek?: number[];    // 적용 요일 (0=일, 6=토) — 없으면 매일
  label: string;
  templates: string[];     // {region}, {specialty}, {procedure} 치환
  weight: number;
}

export const SEASONAL_CALENDAR: SeasonalEvent[] = [
  // ── 봄 (3-5월) ──
  {
    month: [3, 4, 5],
    label: '봄',
    weight: 1.0,
    templates: [
      '봄에 {procedure} 받기 좋은 시기야? {region} 추천해줘',
      '{region} {specialty} 봄 시즌 이벤트 하는 곳 있어?',
      '새학기 전에 {procedure} 하려면 {region} 어디가 좋아?',
      '환절기에 {procedure} 받아도 괜찮을까? {region} {specialty} 추천',
    ],
  },
  // ── 여름 (6-8월) ──
  {
    month: [6, 7, 8],
    label: '여름',
    weight: 1.0,
    templates: [
      '여름에 {procedure} 받아도 괜찮을까? {region} 추천해줘',
      '여름 방학 때 {procedure} 받으려면 {region} 어디가 좋아?',
      '휴가 전에 {procedure} 빨리 할 수 있는 {region} {specialty} 있어?',
      '여름에 회복 빠른 {procedure} 방법 있어? {region} {specialty}',
    ],
  },
  // ── 가을 (9-11월) ──
  {
    month: [9, 10, 11],
    label: '가을',
    weight: 1.0,
    templates: [
      '{region} {specialty} 가을에 받기 좋은 {procedure} 추천해줘',
      '추석 연휴에 {procedure} 받고 회복할 수 있는 {region} {specialty}',
      '연말 전에 {procedure} 미리 해두려면 {region} 어디가 좋아?',
    ],
  },
  // ── 겨울 (12, 1, 2월) ──
  {
    month: [12, 1, 2],
    label: '겨울',
    weight: 1.0,
    templates: [
      '연말 전에 {procedure} 받으려면 {region} 어디가 좋을까?',
      '새해 첫 {specialty} 진료, {region}에서 추천',
      '겨울 방학에 {procedure} 받으려는데 {region} {specialty} 어디야?',
      '설 연휴 전에 {procedure} 할 수 있는 {region} {specialty}',
    ],
  },
  // ── 주말 ──
  {
    month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    dayOfWeek: [0, 6],
    label: '주말',
    weight: 1.1,
    templates: [
      '주말에 갈 수 있는 {region} {specialty} 알려줘',
      '토요일 진료하는 {region} {procedure} {specialty} 추천',
    ],
  },
  // ── 연초 (1-2월: 연말정산·건강검진 시즌) ──
  {
    month: [1, 2],
    label: '연초건강',
    weight: 0.9,
    templates: [
      '새해 건강 관리 시작하려는데 {region} {specialty} 추천해줘',
      '올해는 미루지 않고 {procedure} 하려는데 {region} 어디가 좋아?',
    ],
  },
  // ── 입학/개학 (3, 9월) ──
  {
    month: [3, 9],
    label: '개학시즌',
    weight: 0.9,
    templates: [
      '개학 전에 아이 {procedure} 하려면 {region} {specialty} 어디야?',
      '학기 시작 전에 빨리 {procedure} 할 수 있는 {region} {specialty}',
    ],
  },
  // ── 명절 (1-2월 설, 9-10월 추석) ──
  {
    month: [1, 2, 9, 10],
    label: '명절',
    weight: 0.8,
    templates: [
      '명절 연휴 동안 {procedure} 받고 회복 가능한 {region} {specialty}',
      '명절 때 문 여는 {region} {specialty} 있어? {procedure} 급한데',
    ],
  },
];

// ==================== 축5: 지역 변형 함수 ====================

export function getRegionVariations(hospital: {
  regionSido: string;
  regionSigungu: string;
  regionDong?: string | null;
  targetRegions?: string[];
}): string[] {
  const regions: string[] = [];
  const { regionSido, regionSigungu, regionDong, targetRegions } = hospital;

  // 1. 풀네임
  regions.push(`${regionSido} ${regionSigungu}`);

  // 2. 시군구만 (약식)
  const shortRegion = regionSigungu?.replace(/[시군구]$/, '') || regionSigungu;
  if (shortRegion && shortRegion !== regionSigungu) {
    regions.push(shortRegion);
  }

  // 3. 동 추가
  if (regionDong) {
    regions.push(`${regionSigungu} ${regionDong}`);
    regions.push(regionDong);
  }

  // 4. 타겟 지역
  if (targetRegions) {
    for (const r of targetRegions.slice(0, 3)) {
      if (!regions.includes(r)) regions.push(r);
    }
  }

  return [...new Set(regions)];
}

// ==================== 강점 기반 보너스 템플릿 ====================

export const STRENGTH_TEMPLATES: string[] = [
  '{strength} 잘하는 {region} {specialty} 추천해줘',
  '{strength} {specialty} {region}에서 어디가 유명해?',
  '{procedure} 할 건데 {strength} {specialty} {region}에 있어?',
  '{region} {specialty} 중에서 {strength}인 곳 알려줘',
];

// ==================== 경쟁사 비교 템플릿 ====================

export const COMPETITOR_TEMPLATES: string[] = [
  '{region} {procedure} {specialty} 비교해서 알려줘. 장단점 포함해서',
  '{region} {procedure} 잘하는 {specialty} 여러 곳 비교 분석해줘',
  '{region} {specialty} 중에서 {procedure} 가장 평판 좋은 곳은?',
];

// ==================== 진료과별 증상 기반 템플릿 ====================

export const SYMPTOM_TEMPLATES: Record<string, string[]> = {
  DENTAL: [
    '이가 너무 아픈데 {region} {specialty} 어디 가면 좋을까?',
    '앞니가 부러졌는데 {region}에서 급하게 볼 수 있는 {specialty} 있어?',
    '잇몸에서 피가 나는데 {region} {specialty} 추천해줘',
    '충치가 심해졌는데 {region} {specialty} 어디가 좋아?',
    '이가 시린데 {region} {specialty} 추천해줘',
  ],
  DERMATOLOGY: [
    '얼굴에 여드름이 계속 나는데 {region} {specialty} 추천해줘',
    '기미가 갑자기 심해졌는데 {region} {specialty} 어디가 좋아?',
    '피부가 너무 건조하고 가려운데 {region} {specialty} 알려줘',
    '두드러기가 자꾸 나는데 {region} {specialty} 추천',
  ],
  PLASTIC_SURGERY: [
    '{region}에서 자연스러운 {procedure} 잘하는 {specialty} 있어?',
    '{procedure} 상담 여러 곳 다니는데 {region} 추천해줘',
  ],
  ORTHOPEDICS: [
    '허리가 너무 아픈데 {region} {specialty} 추천해줘',
    '무릎이 시큰거리는데 {region} {specialty} 어디가 좋아?',
    '어깨가 안 올라가는데 {region} {specialty} 알려줘',
    '목이 뻣뻣한데 {region} {specialty} 추천',
  ],
  KOREAN_MEDICINE: [
    '만성 허리통증에 {region} {specialty} 추천해줘',
    '교통사고 후유증으로 {region} {specialty} 가려는데 어디가 좋아?',
    '체질 개선하고 싶은데 {region} {specialty} 추천',
  ],
  OPHTHALMOLOGY: [
    '시력이 많이 떨어졌는데 {region} {specialty} 추천해줘',
    '눈이 자주 충혈되는데 {region} {specialty} 어디가 좋아?',
    '눈이 침침한데 {region} {specialty} 검진 받고 싶어',
  ],
  INTERNAL_MEDICINE: [
    '건강검진 받고 싶은데 {region} {specialty} 추천해줘',
    '속이 자주 더부룩한데 {region} {specialty} 위내시경 잘하는 곳 알려줘',
    '혈압이 높다는데 {region}에서 잘 관리해주는 {specialty} 있어?',
    '만성피로가 심한데 {region} {specialty} 추천',
  ],
  UROLOGY: [
    '소변을 자주 보는데 {region} {specialty} 추천해줘',
    '전립선 검사 받고 싶은데 {region} {specialty} 어디가 좋아?',
  ],
  ENT: [
    '코가 항상 막혀서 {region} {specialty} 추천해줘',
    '코골이가 심한데 {region} {specialty} 어디가 좋아?',
    '귀가 잘 안 들리는데 {region} {specialty} 알려줘',
    '목이 자주 쉬는데 {region} {specialty} 추천',
  ],
  PSYCHIATRY: [
    '우울감이 심한데 {region} {specialty} 추천해줘',
    '잠을 잘 못 자는데 {region} {specialty} 어디가 좋아?',
    '불안감이 심해서 {region} {specialty} 상담 받고 싶어',
    '집중력이 떨어지는데 {region} {specialty} 알려줘',
  ],
  OBSTETRICS: [
    '임신 초기인데 {region} {specialty} 산전검사 잘하는 곳 추천해줘',
    '부인과 검진 받고 싶은데 {region} {specialty} 어디가 좋아?',
    '갱년기 증상이 심한데 {region} {specialty} 추천',
  ],
  PEDIATRICS: [
    '아이 감기가 안 낫는데 {region} {specialty} 추천해줘',
    '영유아 예방접종 잘하는 {region} {specialty} 어디야?',
    '아이 피부 트러블이 심한데 {region} {specialty} 추천',
  ],
  OTHER: [
    '{region} {specialty} 처음 가보려는데 추천해줘',
    '{region}에서 {specialty} 잘 보는 곳 어디야?',
    '{region} {specialty} 예약하려는데 괜찮은 곳 알려줘',
    '친절한 {region} {specialty} 추천해줘',
  ],
};

// ==================== 메인 매트릭스 엔진 ====================

export interface MatrixCandidate {
  text: string;
  intent: IntentType;
  tone: ToneType | 'seasonal' | 'symptom' | 'strength' | 'competitor';
  season?: string;
  weight: number;        // 최종 가중치 (의도×톤×시즌 종합)
  procedure?: string;
  region: string;
}

/**
 * 병원 정보 기반으로 전체 매트릭스 후보를 생성합니다.
 * 모든 진료과에서 범용으로 동작합니다.
 */
export function generateMatrixCandidates(hospital: {
  name: string;
  specialtyType: string;
  regionSido: string;
  regionSigungu: string;
  regionDong?: string | null;
  coreTreatments?: string[];
  keyProcedures?: string[];
  targetRegions?: string[];
  hospitalStrengths?: string[];
}): MatrixCandidate[] {
  const candidates: MatrixCandidate[] = [];
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay();

  const specialty = SPECIALTY_NAMES[hospital.specialtyType] || '병원';
  const regions = getRegionVariations(hospital);
  const primaryRegion = regions[0] || hospital.regionSigungu;

  // 시술 결정 (keyProcedures → coreTreatments → 진료과 인기 시술)
  const procedures = hospital.keyProcedures?.length
    ? hospital.keyProcedures
    : hospital.coreTreatments?.length
      ? hospital.coreTreatments
      : (SPECIALTY_PROCEDURES[hospital.specialtyType] || [])
          .filter((p: any) => p.isPopular)
          .slice(0, 5)
          .map((p: any) => p.name);

  const strengths = hospital.hospitalStrengths || [];

  // ── 축1×축2×축5: 의도 × 시술 × 지역 ──
  for (const intentGroup of INTENT_TEMPLATES) {
    for (const proc of procedures.slice(0, 5)) {
      for (const region of regions.slice(0, 3)) {
        // 각 의도별로 랜덤 2개 템플릿만 선택 (폭발 방지)
        const shuffled = [...intentGroup.templates].sort(() => Math.random() - 0.5);
        for (const tmpl of shuffled.slice(0, 2)) {
          const text = tmpl
            .replace(/{region}/g, region)
            .replace(/{specialty}/g, specialty)
            .replace(/{procedure}/g, proc)
            .replace(/{strength}/g, strengths[0] || '전문');

          candidates.push({
            text,
            intent: intentGroup.intent,
            tone: 'casual',
            weight: intentGroup.weight,
            procedure: proc,
            region,
          });
        }
      }
    }
  }

  // ── 축3: 톤 변형 ──
  for (const toneGroup of TONE_VARIATIONS) {
    for (const proc of procedures.slice(0, 3)) {
      const region = regions[Math.floor(Math.random() * Math.min(regions.length, 3))];
      const shuffled = [...toneGroup.templates].sort(() => Math.random() - 0.5);
      for (const tmpl of shuffled.slice(0, 2)) {
        const text = tmpl
          .replace(/{region}/g, region)
          .replace(/{specialty}/g, specialty)
          .replace(/{procedure}/g, proc);

        candidates.push({
          text,
          intent: 'RESERVATION',
          tone: toneGroup.tone,
          weight: toneGroup.weight,
          procedure: proc,
          region,
        });
      }
    }
  }

  // ── 축4: 시즌 캘린더 ──
  const activeSeasons = SEASONAL_CALENDAR.filter(s => {
    if (!s.month.includes(month)) return false;
    if (s.dayOfWeek && !s.dayOfWeek.includes(dayOfWeek)) return false;
    return true;
  });

  for (const season of activeSeasons) {
    for (const proc of procedures.slice(0, 3)) {
      const region = regions[0];
      for (const tmpl of season.templates) {
        const text = tmpl
          .replace(/{region}/g, region)
          .replace(/{specialty}/g, specialty)
          .replace(/{procedure}/g, proc);

        candidates.push({
          text,
          intent: 'RESERVATION',
          tone: 'seasonal',
          season: season.label,
          weight: season.weight,
          procedure: proc,
          region,
        });
      }
    }
  }

  // ── 증상 기반 (진료과별) ──
  const symptomTemplates = SYMPTOM_TEMPLATES[hospital.specialtyType] || SYMPTOM_TEMPLATES['OTHER'] || [];
  for (const tmpl of symptomTemplates) {
    const region = regions[0];
    const text = tmpl
      .replace(/{region}/g, region)
      .replace(/{specialty}/g, specialty)
      .replace(/{procedure}/g, procedures[0] || '진료');

    candidates.push({
      text,
      intent: 'INFORMATION',
      tone: 'symptom',
      weight: 1.1,
      region,
    });
  }

  // ── 강점 기반 ──
  for (const strength of strengths.slice(0, 3)) {
    const region = regions[0];
    for (const tmpl of STRENGTH_TEMPLATES.slice(0, 2)) {
      const text = tmpl
        .replace(/{region}/g, region)
        .replace(/{specialty}/g, specialty)
        .replace(/{procedure}/g, procedures[0] || '진료')
        .replace(/{strength}/g, strength);

      candidates.push({
        text,
        intent: 'RESERVATION',
        tone: 'strength',
        weight: 1.2,
        region,
      });
    }
  }

  // ── 경쟁사 비교 ──
  for (const tmpl of COMPETITOR_TEMPLATES) {
    const region = regions[0];
    const text = tmpl
      .replace(/{region}/g, region)
      .replace(/{specialty}/g, specialty)
      .replace(/{procedure}/g, procedures[0] || '진료');

    candidates.push({
      text,
      intent: 'COMPARISON',
      tone: 'competitor',
      weight: 1.0,
      region,
    });
  }

  return candidates;
}

// ==================== ABHS 성과 기반 가중치 부스터 ====================

export interface PerformanceData {
  topIntents: IntentType[];              // SoV 높은 의도 상위 2개
  topProcedures: string[];               // 언급률 높은 시술 상위 3개
  goldenPatterns: string[];              // Golden Prompt 패턴 키워드
  lowPerformanceIntents: IntentType[];   // SoV 낮은 의도 (개선 기회)
}

/**
 * ABHS 성과 데이터를 기반으로 후보 가중치를 부스팅합니다.
 * - 기존 고성과 패턴 → 가중치 UP (성공 패턴 확대)
 * - 저성과 의도 → 가중치 UP (약점 보완 기회)
 */
export function applyPerformanceBoost(
  candidates: MatrixCandidate[],
  performance: PerformanceData,
): MatrixCandidate[] {
  return candidates.map(c => {
    let boost = 1.0;

    // 고성과 의도 부스트
    if (performance.topIntents.includes(c.intent)) {
      boost *= 1.3;
    }

    // 저성과 의도도 부스트 (약점 보완)
    if (performance.lowPerformanceIntents.includes(c.intent)) {
      boost *= 1.2;
    }

    // 고성과 시술 부스트
    if (c.procedure && performance.topProcedures.includes(c.procedure)) {
      boost *= 1.2;
    }

    // Golden Prompt 패턴 키워드 매칭
    for (const pattern of performance.goldenPatterns) {
      if (c.text.includes(pattern)) {
        boost *= 1.15;
        break;
      }
    }

    return { ...c, weight: c.weight * boost };
  });
}

// ==================== 중복 제거 + 최종 선택 ====================

/**
 * 텍스트 유사도 (Jaccard, 문자 단위)
 */
function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.replace(/\s+/g, '').split(''));
  const setB = new Set(b.replace(/\s+/g, '').split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * 최종 일일 프롬프트 선택
 * 
 * @param candidates 매트릭스 후보
 * @param existingTexts 기존 등록된 프롬프트 텍스트
 * @param dailyTarget 하루 목표 개수
 * @param diversityMode true면 의도/톤 다양성 보장
 */
export function selectDailyPrompts(
  candidates: MatrixCandidate[],
  existingTexts: Set<string>,
  dailyTarget: number = 10,
  diversityMode: boolean = true,
): MatrixCandidate[] {
  // 1단계: 기존 프롬프트와 중복 제거
  const unique = candidates.filter(c => {
    if (existingTexts.has(c.text)) return false;
    // 기존 프롬프트와 유사도 0.85 이상이면 제거
    for (const existing of existingTexts) {
      if (textSimilarity(c.text, existing) > 0.85) return false;
    }
    return true;
  });

  // 2단계: 자체 중복 제거
  const deduplicated: MatrixCandidate[] = [];
  const seen = new Set<string>();
  for (const c of unique) {
    if (seen.has(c.text)) continue;
    let isDuplicate = false;
    for (const existing of deduplicated) {
      if (textSimilarity(c.text, existing.text) > 0.80) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      deduplicated.push(c);
      seen.add(c.text);
    }
  }

  if (!diversityMode || deduplicated.length <= dailyTarget) {
    // 가중치 기반 정렬 후 상위 N개
    return deduplicated
      .sort((a, b) => b.weight - a.weight)
      .slice(0, dailyTarget);
  }

  // 3단계: 다양성 보장 선택 (의도별 최소 1개 + 나머지는 가중치 순)
  const selected: MatrixCandidate[] = [];
  const intentBuckets: Record<string, MatrixCandidate[]> = {};

  for (const c of deduplicated) {
    if (!intentBuckets[c.intent]) intentBuckets[c.intent] = [];
    intentBuckets[c.intent].push(c);
  }

  // 각 의도에서 최소 1개씩 (가중치 최고 선택)
  for (const [, bucket] of Object.entries(intentBuckets)) {
    bucket.sort((a, b) => b.weight - a.weight);
    if (bucket.length > 0 && selected.length < dailyTarget) {
      selected.push(bucket[0]);
    }
  }

  // 톤 다양성도 확보
  const toneBuckets: Record<string, MatrixCandidate[]> = {};
  for (const c of deduplicated) {
    if (!toneBuckets[c.tone]) toneBuckets[c.tone] = [];
    toneBuckets[c.tone].push(c);
  }

  for (const [, bucket] of Object.entries(toneBuckets)) {
    bucket.sort((a, b) => b.weight - a.weight);
    if (bucket.length > 0 && selected.length < dailyTarget) {
      const top = bucket[0];
      if (!selected.some(s => s.text === top.text)) {
        selected.push(top);
      }
    }
  }

  // 나머지 슬롯은 가중치 기반 랜덤 (이미 선택된 것 제외)
  const remaining = deduplicated
    .filter(c => !selected.some(s => s.text === c.text))
    .sort((a, b) => b.weight - a.weight);

  for (const c of remaining) {
    if (selected.length >= dailyTarget) break;
    selected.push(c);
  }

  return selected.slice(0, dailyTarget);
}

// ==================== 매트릭스 통계 ====================

export interface MatrixStats {
  totalCandidates: number;
  byIntent: Record<string, number>;
  byTone: Record<string, number>;
  bySeason: Record<string, number>;
  byProcedure: Record<string, number>;
}

export function getMatrixStats(candidates: MatrixCandidate[]): MatrixStats {
  const stats: MatrixStats = {
    totalCandidates: candidates.length,
    byIntent: {},
    byTone: {},
    bySeason: {},
    byProcedure: {},
  };

  for (const c of candidates) {
    stats.byIntent[c.intent] = (stats.byIntent[c.intent] || 0) + 1;
    stats.byTone[c.tone] = (stats.byTone[c.tone] || 0) + 1;
    if (c.season) stats.bySeason[c.season] = (stats.bySeason[c.season] || 0) + 1;
    if (c.procedure) stats.byProcedure[c.procedure] = (stats.byProcedure[c.procedure] || 0) + 1;
  }

  return stats;
}
