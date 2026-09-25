import { HospitalsService } from './hospitals.service';
import { buildCoreQuestions } from '../query-templates/core-questions';
import { SPECIALTY_NAMES, SPECIALTY_PROCEDURES } from '../query-templates/query-templates.service';

const dto = {
  name: '한결치과', specialtyType: 'DENTAL', regionSido: '서울특별시',
  regionSigungu: '강남구', regionDong: '역삼동',
  coreTreatments: ['임플란트', '교정'], clinicIntroduction: '진료 계획과 비용을 설명합니다.',
};

function setup(hubOverrides: Record<string, unknown> = {}) {
  const hospital = { id: 'hospital-1', name: dto.name };
  const prisma = {
    hospital: { create: jest.fn().mockResolvedValue(hospital), update: jest.fn().mockResolvedValue(hospital) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ pendingPsHospitalId: 'hub-hospital-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    subscription: { create: jest.fn().mockResolvedValue({}) },
    prompt: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
  };
  const scheduler = { crawlSingleHospital: jest.fn().mockResolvedValue({ completed: 0 }) };
  const hub = {
    isEnabled: jest.fn().mockReturnValue(false),
    fetchProfile: jest.fn(),
    buildQuestionMaterials: jest.fn(),
    ...hubOverrides,
  };
  return { service: new HospitalsService(prisma as any, scheduler as any, hub as any), prisma, hub };
}

describe('HospitalsService onboarding core prompts', () => {
  it('STARTER 5개 슬롯에 화면과 같은 병원 맞춤 핵심 질문을 먼저 저장한다', async () => {
    const { service, prisma } = setup();
    await service.create('user-1', dto as any);

    const expected = buildCoreQuestions({
      name: dto.name,
      specialty: SPECIALTY_NAMES.DENTAL,
      region: dto.regionDong,
      localTreatments: dto.coreTreatments,
      introduction: dto.clinicIntroduction,
      hubMaterials: { mission: null, keyTreatments: [], painPoints: [], targetPatients: [] },
      knownProcedures: SPECIALTY_PROCEDURES.DENTAL,
      trackedPrompts: [],
    }).map((question) => question.query);
    const saved = prisma.prompt.createMany.mock.calls[0][0].data;
    expect(saved).toHaveLength(5);
    expect(saved.map((prompt: { promptText: string }) => prompt.promptText)).toEqual(expected);
    expect(saved.every((prompt: { isActive: boolean }) => prompt.isActive)).toBe(true);
  });

  it('Hub 조회가 실패해도 Signal의 소개와 주력 진료로 추천 질문을 저장한다', async () => {
    const { service, prisma, hub } = setup({
      isEnabled: jest.fn().mockReturnValue(true),
      fetchProfile: jest.fn().mockRejectedValue(new Error('Hub timeout')),
    });
    await service.create('user-1', dto as any);

    expect(hub.fetchProfile).toHaveBeenCalledWith('hub-hospital-1');
    const texts = prisma.prompt.createMany.mock.calls[0][0].data.map((prompt: { promptText: string }) => prompt.promptText);
    expect(texts).toHaveLength(5);
    expect(texts[0]).toContain('임플란트');
    expect(texts).toContainEqual(expect.stringContaining('비용'));
  });
});
