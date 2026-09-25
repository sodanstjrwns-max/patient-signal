import { CompetitorsService } from './competitors.service';

const oldDate = new Date('2026-01-01T00:00:00.000Z');

function setup(competitors: Array<Record<string, any>>, responses: Array<Record<string, any>>) {
  const prisma = {
    hospital: { findUnique: jest.fn().mockResolvedValue({ id: 'hospital-a', name: '우리치과' }) },
    competitor: { findMany: jest.fn().mockResolvedValue(competitors) },
    aIResponse: { findMany: jest.fn().mockResolvedValue(responses) },
  };
  const cache = { invalidateHospital: jest.fn().mockResolvedValue(undefined) };
  return { service: new CompetitorsService(prisma as any, cache as any), prisma, cache };
}

describe('경쟁 병원 AI 답변 등장 순위', () => {
  it('같은 답변 속 별칭을 한 번만 세고 등장 횟수 동률은 공동 순위로 표시한다', async () => {
    const competitors = [
      { id: 'a', competitorName: '서울좋은치과', competitorRegion: null, createdAt: oldDate, updatedAt: oldDate },
      { id: 'b', competitorName: '바른치과', competitorRegion: null, createdAt: oldDate, updatedAt: oldDate },
    ];
    const responses = [
      { isMentioned: true, competitorsMentioned: ['좋은치과', '서울 좋은치과의원'] },
      { isMentioned: true, competitorsMentioned: ['바른치과'] },
      { isMentioned: false, competitorsMentioned: [] },
      ...Array.from({ length: 27 }, () => ({ isMentioned: false, competitorsMentioned: [] })),
    ];
    const { service, prisma } = setup(competitors, responses);

    const result = await service.getAnswerRanking('hospital-a');

    expect(result).toMatchObject({ status: 'READY', totalResponses: 30, rank: 1, totalClinics: 3 });
    expect(result.myHospital).toMatchObject({ mentionCount: 2, mentionRate: 6.7, rank: 1 });
    expect(result.competitors.find((c) => c.id === 'a')).toMatchObject({ mentionCount: 1, rank: 2 });
    expect(result.competitors.find((c) => c.id === 'b')).toMatchObject({ mentionCount: 1, rank: 2 });
    expect(prisma.aIResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ hospitalId: 'hospital-a', isVerified: true }),
      select: { isMentioned: true, competitorsMentioned: true },
    }));
  });

  it('새로 등록한 경쟁 병원은 등록 이후 공통 응답이 생기기 전까지 순위를 주지 않는다', async () => {
    const recent = new Date();
    const { service, prisma } = setup([
      { id: 'new', competitorName: '새치과', competitorRegion: null, createdAt: recent, updatedAt: recent },
    ], []);

    const result = await service.getAnswerRanking('hospital-a');

    expect(result).toMatchObject({ status: 'NO_DATA', rank: null, pendingMeasurement: true, totalResponses: 0 });
    expect(result.competitors[0].rank).toBeNull();
    expect(prisma.aIResponse.findMany.mock.calls[0][0].where.createdAt.gte).toEqual(recent);
  });

  it('AI가 지역 접두사를 붙여 부른 병원도 같은 경쟁 병원으로 센다', async () => {
    const { service } = setup([
      { id: 'a', competitorName: '좋은치과', competitorRegion: '강남', createdAt: oldDate, updatedAt: oldDate },
    ], [{ isMentioned: false, competitorsMentioned: ['강남좋은치과'] }]);

    const result = await service.getAnswerRanking('hospital-a');

    expect(result.competitors[0]).toMatchObject({ mentionCount: 1, mentionRate: 100, rank: 1 });
  });

  it('측정은 했지만 모든 병원 등장 수가 0이면 1등을 만들지 않는다', async () => {
    const { service } = setup([
      { id: 'a', competitorName: '좋은치과', competitorRegion: null, createdAt: oldDate, updatedAt: oldDate },
    ], [{ isMentioned: false, competitorsMentioned: [] }]);

    const result = await service.getAnswerRanking('hospital-a');

    expect(result.status).toBe('NO_MENTIONS');
    expect(result.rank).toBeNull();
    expect(result.competitors[0].rank).toBeNull();
  });

  it('복구 전체는 현재 플랜의 남은 슬롯까지만 활성화한다', async () => {
    const { service, prisma } = setup([], []);
    prisma.hospital.findUnique.mockResolvedValue({ planType: 'STARTER', _count: { competitors: 2 } });
    prisma.competitor.findMany.mockResolvedValue([{ id: 'first' }]);
    (prisma.competitor as any).updateMany = jest.fn().mockResolvedValue({ count: 1 });

    await expect(service.restoreAll('hospital-a')).resolves.toEqual({ restored: 1 });
    expect(prisma.competitor.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    expect((prisma.competitor as any).updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['first'] } }),
    }));
  });
});
