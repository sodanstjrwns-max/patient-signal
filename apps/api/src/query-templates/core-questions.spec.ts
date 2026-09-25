import { buildCoreQuestions } from './core-questions';

const base = {
  name: '서울비디치과',
  specialty: '치과',
  region: '불당동',
  localTreatments: [] as string[],
  introduction: null as string | null,
  hubMaterials: {
    mission: null,
    keyTreatments: ['임플란트'],
    painPoints: [
      { treatment: '임플란트', points: ['비용이 얼마나 들지 걱정'] },
    ],
    targetPatients: [],
  },
  knownProcedures: [
    { name: '임플란트', alias: ['인공치아'] },
    { name: '교정', alias: ['치아교정'] },
  ],
  trackedPrompts: [] as Array<{ id: string; promptText: string }>,
};

describe('핵심 질문 추천', () => {
  it('허브의 주력 진료와 환자 고민을 질문과 추천 근거에 반영한다', () => {
    const result = buildCoreQuestions(base);
    expect(result[0].source).toBe('hub');
    expect(result[0].reason).toContain('임플란트');
    expect(
      result.some((q) => q.reason.includes('허브의 환자 고민: 비용')),
    ).toBe(true);
    expect(result.every((q) => !q.query.includes(base.name))).toBe(true);
  });

  it('시그널에서 수정한 진료를 허브 진료보다 먼저 추천하고 기존 질문을 식별한다', () => {
    const initial = buildCoreQuestions({ ...base, localTreatments: ['교정'] });
    const first = initial[0].query;
    const result = buildCoreQuestions({
      ...base,
      localTreatments: ['교정'],
      trackedPrompts: [{ id: 'prompt-1', promptText: first }],
    });
    expect(result[0]).toMatchObject({
      source: 'signal',
      alreadyTracked: true,
      promptId: 'prompt-1',
    });
    expect(result[0].query).toContain('교정');
  });

  it('허브가 없어도 로컬 소개에 명시된 진료를 우선한다', () => {
    const result = buildCoreQuestions({
      ...base,
      introduction: '치아교정 상담과 치료 계획 설명을 중심으로 진료합니다.',
      hubMaterials: {
        mission: null,
        keyTreatments: [],
        painPoints: [],
        targetPatients: [],
      },
    });
    expect(result[0]).toMatchObject({ source: 'signal' });
    expect(result[0].query).toContain('교정');
  });
});
