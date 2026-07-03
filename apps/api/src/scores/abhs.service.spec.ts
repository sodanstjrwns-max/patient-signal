/**
 * ABHSService 핵심 유닛 테스트 — SoV/ABHS 5축 점수 계산
 *
 * 범위:
 *  - calculateABHS: SoV%, ABHS 정규화 점수, 플랫폼 기여도
 *  - sentimentToFactor: 감성 → 팩터 변환 (정수 lookup + 선형 보간)
 *  - legacySentimentToV2: 구버전 감성 → V2 매핑
 *  - inferRecommendationDepthFromData: R0~R3 깊이 추론
 *  - classifyQueryIntent: 질문 의도 분류
 */
import { ABHSService } from './abhs.service';
import { FALLBACK_WEIGHTS } from './weight.service';

const WEIGHT_BUNDLE = {
  platform: { ...FALLBACK_WEIGHTS.PLATFORM, GROK: 1.0, CLOVA_X: 1.0 },
  depth: { ...FALLBACK_WEIGHTS.DEPTH },
  intent: { ...FALLBACK_WEIGHTS.INTENT },
  sentiment: { ...FALLBACK_WEIGHTS.SENTIMENT },
};

function createService(responses: any[] = []) {
  const prisma: any = {
    hospital: { findUnique: jest.fn().mockResolvedValue({ specialtyType: 'DENTAL' }) },
    aIResponse: { findMany: jest.fn().mockResolvedValue(responses) },
  };
  const weightService: any = {
    getWeightBundle: jest.fn().mockResolvedValue(WEIGHT_BUNDLE),
  };
  const service = new ABHSService(prisma, weightService);
  return { service, prisma };
}

// 응답 mock 빌더
function resp(overrides: any = {}) {
  return {
    id: 'r1',
    aiPlatform: 'CHATGPT',
    isMentioned: false,
    mentionPosition: null,
    totalRecommendations: null,
    sentimentScore: null,
    sentimentLabel: null,
    citedSources: [],
    competitorsMentioned: [],
    responseText: '',
    responseDate: new Date(),
    sentimentScoreV2: null,
    recommendationDepth: null,
    queryIntent: null,
    platformWeight: null,
    abhsContribution: null,
    citedUrl: null,
    prompt: { id: 'p1', promptText: '강남 치과 추천', specialtyCategory: 'DENTAL' },
    ...overrides,
  };
}

describe('ABHSService — SoV/ABHS 계산 핵심 로직', () => {
  // ─────────────────────────────────────────────
  // calculateABHS — SoV
  // ─────────────────────────────────────────────
  describe('calculateABHS (SoV/종합점수)', () => {
    it('응답이 없으면 emptyResult (0점)', async () => {
      const { service } = createService([]);
      const result = await service.calculateABHS('h1');
      expect(result.abhsScore).toBe(0);
      expect(result.sovPercent).toBe(0);
      expect(result.depthDistribution).toEqual({ R0: 0, R1: 0, R2: 0, R3: 0 });
    });

    it('SoV = 언급 응답 / 전체 응답 × 100 (4개 중 1개 → 25%)', async () => {
      const { service } = createService([
        resp({ isMentioned: true, sentimentScoreV2: 1, recommendationDepth: 'R1', queryIntent: 'INFORMATION' }),
        resp({ id: 'r2' }),
        resp({ id: 'r3' }),
        resp({ id: 'r4' }),
      ]);
      const result = await service.calculateABHS('h1');
      expect(result.sovPercent).toBe(25);
    });

    it('전부 최고 조건(R3+긍정+예약의도)이면 ABHS 100점', async () => {
      const { service } = createService([
        resp({ isMentioned: true, sentimentScoreV2: 2, recommendationDepth: 'R3', queryIntent: 'RESERVATION' }),
        resp({ id: 'r2', isMentioned: true, sentimentScoreV2: 2, recommendationDepth: 'R3', queryIntent: 'RESERVATION' }),
      ]);
      const result = await service.calculateABHS('h1');
      expect(result.abhsScore).toBe(100);
      expect(result.sovPercent).toBe(100);
    });

    it('언급 0건이면 ABHS 0점 (기여분 없음)', async () => {
      const { service } = createService([resp(), resp({ id: 'r2' })]);
      const result = await service.calculateABHS('h1');
      expect(result.abhsScore).toBe(0);
      expect(result.sovPercent).toBe(0);
    });

    it('플랫폼 기여도: 응답 있는 플랫폼만 포함, 가중치 반영', async () => {
      const { service } = createService([
        resp({ aiPlatform: 'PERPLEXITY', isMentioned: true, sentimentScoreV2: 1, recommendationDepth: 'R2', queryIntent: 'INFORMATION' }),
        resp({ id: 'r2', aiPlatform: 'CHATGPT' }),
      ]);
      const result = await service.calculateABHS('h1');
      expect(result.platformContributions.PERPLEXITY).toBeDefined();
      expect(result.platformContributions.PERPLEXITY.weight).toBe(1.4);
      expect(result.platformContributions.PERPLEXITY.sovPercent).toBe(100);
      expect(result.platformContributions.CHATGPT.sovPercent).toBe(0);
      expect(result.platformContributions.CLAUDE).toBeUndefined();
    });

    it('Depth 분포는 언급된 응답만 집계', async () => {
      const { service } = createService([
        resp({ isMentioned: true, recommendationDepth: 'R3', sentimentScoreV2: 1, queryIntent: 'INFORMATION' }),
        resp({ id: 'r2', isMentioned: true, recommendationDepth: 'R1', sentimentScoreV2: 0, queryIntent: 'INFORMATION' }),
        resp({ id: 'r3' }), // 미언급 → 분포 제외
      ]);
      const result = await service.calculateABHS('h1');
      expect(result.depthDistribution.R3).toBe(1);
      expect(result.depthDistribution.R1).toBe(1);
      expect(result.depthDistribution.R0 + result.depthDistribution.R2).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // sentimentToFactor
  // ─────────────────────────────────────────────
  describe('sentimentToFactor (감성 → 팩터)', () => {
    const { service } = createService();
    const factor = (v: number) => (service as any).sentimentToFactor(v, WEIGHT_BUNDLE.sentiment);

    it('정수 감성값은 가중치 테이블 직접 lookup', () => {
      expect(factor(-2)).toBe(0.0);
      expect(factor(-1)).toBe(0.25);
      expect(factor(0)).toBe(0.5);
      expect(factor(1)).toBe(1.0);
      expect(factor(2)).toBe(1.5);
    });

    it('연속값은 -2~+2 선형 보간, 범위 밖은 클램프', () => {
      expect(factor(0.5)).toBeCloseTo(0.0 + ((0.5 + 2) / 4) * 1.5, 5); // 0.9375
      expect(factor(-3)).toBe(0.0); // 하한 클램프
      expect(factor(3)).toBe(1.5); // 상한 클램프
    });
  });

  // ─────────────────────────────────────────────
  // legacySentimentToV2
  // ─────────────────────────────────────────────
  describe('legacySentimentToV2 (구버전 감성 매핑)', () => {
    const { service } = createService();
    const toV2 = (s: number | null, l: string | null) => (service as any).legacySentimentToV2(s, l);

    it('점수 기반 매핑 (-1~1 → -2~+2)', () => {
      expect(toV2(0.9, null)).toBe(2);
      expect(toV2(0.5, null)).toBe(1);
      expect(toV2(0, null)).toBe(0);
      expect(toV2(-0.5, null)).toBe(-1);
      expect(toV2(-0.9, null)).toBe(-2);
    });

    it('점수 없으면 라벨 기반, 둘 다 없으면 0', () => {
      expect(toV2(null, 'POSITIVE')).toBe(1);
      expect(toV2(null, 'NEGATIVE')).toBe(-1);
      expect(toV2(null, 'NEUTRAL')).toBe(0);
      expect(toV2(null, null)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // inferRecommendationDepthFromData
  // ─────────────────────────────────────────────
  describe('inferRecommendationDepthFromData (R0~R3 추론)', () => {
    const { service } = createService();
    const infer = (m: boolean, pos: number | null, total: number | null, label: string | null = null) =>
      (service as any).inferRecommendationDepthFromData(m, pos, total, label);

    it('미언급 → R0', () => {
      expect(infer(false, null, null)).toBe('R0');
    });

    it('단독 추천 (1위, 전체 1개 또는 미상) → R3', () => {
      expect(infer(true, 1, 1)).toBe('R3');
      expect(infer(true, 1, null)).toBe('R3');
    });

    it('복수 추천 중 상위 1~2위 → R2', () => {
      expect(infer(true, 1, 5)).toBe('R2');
      expect(infer(true, 2, 3)).toBe('R2');
    });

    it('하위 언급 → R1', () => {
      expect(infer(true, 3, 5)).toBe('R1');
      expect(infer(true, null, null) === 'R3' || infer(true, null, null) === 'R1').toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // classifyQueryIntent
  // ─────────────────────────────────────────────
  describe('classifyQueryIntent (의도 분류)', () => {
    const { service } = createService();
    const classify = (t: string) => (service as any).classifyQueryIntent(t);

    it('예약/비교/후기/공포/정보 의도 분류', () => {
      expect(classify('강남에서 임플란트 잘하는 치과 추천해줘')).toBe('RESERVATION');
      expect(classify('A치과 vs B치과 비교해줘')).toBe('COMPARISON');
      expect(classify('서울비디치과 후기 어때?')).toBe('REVIEW');
      expect(classify('임플란트 수술 부작용 있나요')).toBe('FEAR');
      expect(classify('임플란트란 무엇인가요')).toBe('INFORMATION');
    });
  });
});
