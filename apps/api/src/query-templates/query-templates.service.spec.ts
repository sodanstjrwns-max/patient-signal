import { QueryTemplatesService, parseLlmSuggestions } from './query-templates.service';
import { isDongConsistentWithSigungu, normalizeDong } from '../common/utils/region-consistency';

/**
 * 질문 제안 로직 유닛 테스트
 * - 지역 일관성: 옛 동(당산동)이 현재 시군구(송파구) 제안에 섞이지 않는지
 * - LLM 경로: 파싱/검증/폴백 동작
 */

const makeHospital = (overrides: Record<string, any> = {}) => ({
  id: 'h-1',
  name: '테스트치과의원',
  specialtyType: 'DENTAL',
  regionSido: '서울특별시',
  regionSigungu: '송파구',
  regionDong: '당산동', // 이전 전 옛 주소의 동이 남은 상황
  keyProcedures: ['임플란트', '교정'],
  coreTreatments: [],
  hospitalStrengths: ['수면치료'],
  targetRegions: ['당산동', '문래동'], // 옛 지역이 캐시로 남은 상황
  psHospitalId: null,
  planType: 'FREE',
  ...overrides,
});

const makeService = (hospital: any, existingPrompts: string[] = []) => {
  const prisma: any = {
    hospital: { findUnique: jest.fn().mockResolvedValue(hospital) },
    prompt: {
      findMany: jest.fn().mockResolvedValue(existingPrompts.map((promptText) => ({ promptText }))),
      count: jest.fn().mockResolvedValue(0),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const hub: any = {
    isEnabled: jest.fn().mockReturnValue(false),
    fetchProfile: jest.fn().mockResolvedValue(null),
    buildQuestionMaterials: jest.fn().mockReturnValue({
      mission: null,
      keyTreatments: [],
      painPoints: [],
      targetPatients: [],
    }),
  };
  return new QueryTemplatesService(prisma, hub);
};

describe('지역 일관성 (region-consistency)', () => {
  it('다른 구 소속 동은 불일치로 판정한다 (송파구 + 당산동)', () => {
    expect(isDongConsistentWithSigungu('서울특별시', '송파구', '당산동')).toBe(false);
  });

  it('자기 구 소속 동은 일관으로 판정한다', () => {
    expect(isDongConsistentWithSigungu('서울특별시', '송파구', '잠실동')).toBe(true);
    expect(isDongConsistentWithSigungu('서울특별시', '영등포구', '당산동')).toBe(true);
  });

  it('행정동 표기(당산1동)도 정규화하여 판정한다', () => {
    expect(normalizeDong('당산1동')).toBe('당산동');
    expect(normalizeDong('성수동2가')).toBe('성수동');
    expect(isDongConsistentWithSigungu('서울특별시', '송파구', '당산1동')).toBe(false);
  });

  it('동명이동(신사동)은 소속 구가 맞으면 모두 일관으로 판정한다', () => {
    expect(isDongConsistentWithSigungu('서울특별시', '강남구', '신사동')).toBe(true);
    expect(isDongConsistentWithSigungu('서울특별시', '은평구', '신사동')).toBe(true);
  });

  it('판단 불가(비서울/미수록 동)는 유지한다', () => {
    expect(isDongConsistentWithSigungu('경기도', '성남시 분당구', '정자동')).toBe(true);
    expect(isDongConsistentWithSigungu('서울특별시', '송파구', '없는동네동')).toBe(true);
    expect(isDongConsistentWithSigungu('서울특별시', '송파구', null)).toBe(true);
  });
});

describe('parseLlmSuggestions', () => {
  const valid = JSON.stringify({
    suggestions: [
      { query: '임플란트 하려는데 비용이 병원마다 왜 이렇게 달라? 송파 쪽에서 설명 잘해주는 곳 있어?', category: '가격', intent: 'INFORMATION' },
      { query: '70대 어머니가 임플란트를 무서워하시는데 안 아프게 하는 치과 송파에 있을까', category: '불안해소', intent: 'FEAR' },
      { query: '교정 시작하면 얼마나 자주 병원 가야 해? 직장인도 다닐 만한 곳 송파에 있어?', category: '추천', intent: 'RESERVATION' },
    ],
  });

  it('정상 JSON을 제안 목록으로 파싱한다', () => {
    const result = parseLlmSuggestions(valid);
    expect(result).toHaveLength(3);
    expect(result[0].category).toBe('가격');
    expect(result[1].intent).toBe('FEAR');
  });

  it('허용 밖 카테고리/인텐트는 기본값으로 보정한다', () => {
    const result = parseLlmSuggestions(
      JSON.stringify({ suggestions: [{ query: '송파에서 잇몸 아플 때 바로 가볼 만한 치과 있어?', category: '이상한값', intent: 'WRONG' }] }),
    );
    expect(result[0].category).toBe('추천');
    expect(result[0].intent).toBe('RESERVATION');
  });

  it('병원 이름이 들어간 질문과 중복·초단문은 제거한다', () => {
    const result = parseLlmSuggestions(
      JSON.stringify({
        suggestions: [
          { query: '테스트치과의원 임플란트 잘해?', category: '추천', intent: 'RESERVATION' },
          { query: '송파 임플란트 후기 좋은 데 어디야?', category: '후기', intent: 'REVIEW' },
          { query: '송파 임플란트 후기 좋은 데 어디야?', category: '후기', intent: 'REVIEW' },
          { query: '짧다', category: '추천', intent: 'RESERVATION' },
        ],
      }),
      { hospitalName: '테스트치과의원' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].query).toContain('후기');
  });

  it('잘못된 JSON은 빈 배열을 반환한다 (폴백 트리거)', () => {
    expect(parseLlmSuggestions('not-json')).toEqual([]);
    expect(parseLlmSuggestions('{"foo": 1}')).toEqual([]);
  });
});

describe('suggestQuestionsForHospital — 템플릿 폴백 (지역 버그 수정)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.OPENAI_API_KEY; // LLM 비활성 → 템플릿 폴백 경로 강제
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('옛 동(당산동)·옛 타겟지역(문래동)이 제안에 섞이지 않는다', async () => {
    const service = makeService(makeHospital());
    const result = await service.suggestQuestionsForHospital('h-1');

    expect(result.suggestions.length).toBeGreaterThan(0);
    for (const s of result.suggestions) {
      expect(s.query).not.toContain('당산');
      expect(s.query).not.toContain('문래');
    }
    // 현재 지역(송파)은 쓰인다
    expect(result.suggestions.some((s) => s.query.includes('송파'))).toBe(true);
  });

  it('현재 시군구 소속 동(잠실동)은 유지된다', async () => {
    const service = makeService(makeHospital({ regionDong: '잠실동', targetRegions: [] }));
    const result = await service.suggestQuestionsForHospital('h-1');
    expect(result.suggestions.some((s) => s.query.includes('잠실동'))).toBe(true);
  });

  it('카테고리가 다양하게 분포한다 (문형 다양성 최소 보장)', async () => {
    const service = makeService(makeHospital());
    const result = await service.suggestQuestionsForHospital('h-1');
    const categories = new Set(result.suggestions.map((s) => s.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it('이미 등록된 질문은 제안에서 제외한다', async () => {
    const existing = '송파에서 임플란트 잘하는 치과 추천해줘';
    const service = makeService(makeHospital(), [existing]);
    const result = await service.suggestQuestionsForHospital('h-1');
    expect(result.suggestions.some((s) => s.query === existing)).toBe(false);
  });
});

describe('suggestQuestionsForHospital — LLM 경로', () => {
  const llmPayload = {
    suggestions: [
      '임플란트 하려는데 비용이 병원마다 왜 이렇게 달라? 송파 쪽에서 설명 잘해주는 곳 있어?',
      '70대 어머니가 임플란트를 무서워하시는데 안 아프게 하는 치과 송파에 있을까',
      '교정 상담만 먼저 받아보고 싶은데 송파에 부담 없이 가볼 만한 치과 있어?',
      '어금니 빠진 지 오래됐는데 지금 임플란트 해도 늦은 건 아니야?',
      '송파 잠실 쪽에서 교정 잘한다고 소문난 데 어디야?',
      '임플란트랑 브릿지 중에 뭐가 나아? 송파에서 상담 잘해주는 곳도 알려줘',
      '치과 가는 게 너무 무서운데 수면치료 해주는 데가 송파에 있을까',
      '송파 치과 후기 보고 고르고 싶은데 평가 좋은 곳 정리해줘',
      '임플란트 가격이 100만원대인 데도 있던데 너무 싸면 문제 있는 거야?',
      '아이 교정 시기 언제가 좋아? 송파에서 소아 교정 잘 보는 치과도 궁금해',
    ].map((query, i) => ({
      query,
      category: ['가격', '불안해소', '추천', '증상', '추천', '비교', '강점', '후기', '가격', '추천'][i],
      intent: ['INFORMATION', 'FEAR', 'RESERVATION', 'INFORMATION', 'RESERVATION', 'COMPARISON', 'RESERVATION', 'REVIEW', 'INFORMATION', 'RESERVATION'][i],
    })),
  };

  it('LLM 성공 시 LLM 제안을 반환하고, 문형이 템플릿 복붙이 아니다', async () => {
    const service = makeService(makeHospital());
    (service as any).openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(llmPayload) } }],
          }),
        },
      },
    };

    const result = await service.suggestQuestionsForHospital('h-1');
    expect(result.source).toBe('llm');
    expect(result.suggestions).toHaveLength(10);
    // 문형 다양성: 같은 어미 복붙("추천해줘")이 과반이 아님
    const same = result.suggestions.filter((s) => s.query.endsWith('추천해줘')).length;
    expect(same).toBeLessThan(result.suggestions.length / 2);
  });

  it('LLM에 전달되는 프롬프트에 옛 지역(당산동)이 포함되지 않는다', async () => {
    const service = makeService(makeHospital());
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(llmPayload) } }],
    });
    (service as any).openai = { chat: { completions: { create } } };

    await service.suggestQuestionsForHospital('h-1');
    const sentMessages = JSON.stringify(create.mock.calls[0][0].messages);
    expect(sentMessages).not.toContain('당산');
    expect(sentMessages).not.toContain('문래');
    expect(sentMessages).toContain('송파');
  });

  it('LLM 실패 시 템플릿 폴백으로 동작한다', async () => {
    const service = makeService(makeHospital());
    (service as any).openai = {
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('rate limit')) } },
    };

    const result = await service.suggestQuestionsForHospital('h-1');
    expect(result.source).toBe('template');
    expect(result.suggestions.length).toBeGreaterThan(0);
    for (const s of result.suggestions) {
      expect(s.query).not.toContain('당산');
    }
  });
});
