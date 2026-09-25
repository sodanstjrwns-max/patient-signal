import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AIPlatform } from '@prisma/client';
import { AdminController } from './admin.controller';
import { NaverSourceAnalysisService, NaverSourceRow } from './naver-source-analysis.service';

type Fixture = NaverSourceRow & { hospitalId: string };
const NOW = new Date('2026-09-25T03:00:00.000Z');
const row = (overrides: Partial<Fixture> = {}): Fixture => ({
  id: 'r1', hospitalId: 'hospital-a', aiPlatform: AIPlatform.CHATGPT,
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  citedSources: [], citedUrl: null, sourceHints: null, ...overrides,
});

function setup(fixtures: Fixture[]) {
  const stored = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => stored.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => { stored.set(key, value); }),
  };
  const prisma = {
    hospital: { findUnique: jest.fn(async ({ where }: any) =>
      ['hospital-a', 'hospital-b'].includes(where.id) ? { id: where.id, name: where.id } : null) },
    aIResponse: { findMany: jest.fn(async ({ where, take, cursor }: any) => {
      const eligible = fixtures.filter((r) => r.hospitalId === where.hospitalId &&
        where.aiPlatform.in.includes(r.aiPlatform) &&
        r.createdAt >= where.createdAt.gte && r.createdAt < where.createdAt.lt)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      const start = cursor ? eligible.findIndex((r) => r.id === cursor.id) + 1 : 0;
      return eligible.slice(start, start + take);
    }) },
  };
  return { service: new NaverSourceAnalysisService(prisma as any, cache as any), prisma, cache };
}

describe('NaverSourceAnalysisService', () => {
  it('canonical URL을 응답별로 중복 제거하고 네이버 하위 도메인만 분류한다', async () => {
    const { service } = setup([row({ citedSources: [
      'https://m.blog.naver.com/clinic/123?utm_source=ai',
      'https://blog.naver.com/clinic/123',
      'https://cafe.naver.com/club/123',
      'https://m.place.naver.com/place/123',
      'https://search.naver.com/search.naver?query=test',
      'https://kin.naver.com/qna/123',
      'https://naver.me/short',
      'https://img.pstatic.net/image.png',
      'https://naver.com.evil.example/fake',
      'https://notnaver.com/fake',
    ], citedUrl: 'https://blog.naver.com/clinic/123' })]);
    const result = await service.analyze('hospital-a', 30, NOW);
    const chatgpt = result.platforms.find((p) => p.platform === 'CHATGPT')!;
    expect(chatgpt).toMatchObject({
      totalResponses: 1, responsesWithCitations: 1, totalCitations: 9,
      naverResponseCount: 1, naverCitations: 5, naverShortCitations: 1,
      naverAssetCitations: 1,
      naverChannels: { blog: 1, cafe: 1, place: 1, search: 1, other: 1 },
    });
  });

  it('Gemini mask와 bare domain 단서를 실제 URL 인용과 분리한다', async () => {
    const mask = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';
    const { service } = setup([row({ aiPlatform: AIPlatform.GEMINI,
      citedSources: [mask, mask, 'https://naver.com.evil.example/page'],
      sourceHints: { sources: [
        { url: 'blog.naver.com', title: 'blog.naver.com', domain: 'vertexaisearch.cloud.google.com' },
        { url: 'https://cafe.naver.com/clinic/post', title: 'cafe.naver.com' },
        { url: 'https://naver.me/short' },
        { url: 'https://img.pstatic.net/asset.png' },
        { title: 'naver.com.evil.example' },
      ] },
    })]);
    const gemini = (await service.analyze('hospital-a', 30, NOW)).platforms.find((p) => p.platform === 'GEMINI')!;
    expect(gemini).toMatchObject({
      totalResponses: 1, totalCitations: 4, naverCitations: 1,
      naverChannels: { blog: 0, cafe: 1, place: 0, search: 0, other: 0 },
      naverShortCitations: 1, naverAssetCitations: 1,
      geminiMaskedResponses: 1, geminiMaskedReferences: 1,
      geminiDomainEvidence: { naverDomains: 1, naverResponses: 1,
        naverChannels: { blog: 1, cafe: 0, place: 0, search: 0, other: 0 } },
    });
  });

  it('병원별로 격리하고 KST 달력일 경계를 createdAt에 적용한다', async () => {
    const { service, prisma } = setup([
      row({ id: 'outside-before', createdAt: new Date('2026-08-26T14:59:59.999Z'), citedSources: ['https://blog.naver.com/old'] }),
      row({ id: 'first', createdAt: new Date('2026-08-26T15:00:00.000Z'), citedSources: ['https://blog.naver.com/first'] }),
      row({ id: 'last', createdAt: new Date('2026-09-25T14:59:59.999Z'), citedSources: ['https://cafe.naver.com/last'] }),
      row({ id: 'outside-after', createdAt: new Date('2026-09-25T15:00:00.000Z'), citedSources: ['https://place.naver.com/late'] }),
      row({ id: 'other-hospital', hospitalId: 'hospital-b', citedSources: ['https://blog.naver.com/other'] }),
    ]);
    const a = await service.analyze('hospital-a', 30, NOW);
    const b = await service.analyze('hospital-b', 30, NOW);
    expect(a).toMatchObject({ fromDate: '2026-08-27', toDate: '2026-09-25', dateBasis: 'CREATED_AT_KST' });
    expect(a.platforms[0]).toMatchObject({ totalResponses: 2, naverCitations: 2 });
    expect(b.platforms[0]).toMatchObject({ totalResponses: 1, naverCitations: 1 });
    expect(prisma.aIResponse.findMany.mock.calls[0][0].where).toMatchObject({
      hospitalId: 'hospital-a', createdAt: {
        gte: new Date('2026-08-26T15:00:00.000Z'), lt: new Date('2026-09-25T15:00:00.000Z'),
      },
    });
  });

  it('400행씩 제한해 순회하고 인증 뒤 서비스 캐시로 반복 읽기를 막는다', async () => {
    const fixtures = Array.from({ length: 401 }, (_, i) => row({ id: `r${String(i).padStart(4, '0')}` }));
    const { service, prisma, cache } = setup(fixtures);
    const first = await service.analyze('hospital-a', 30, NOW);
    expect(first.platforms[0].totalResponses).toBe(401);
    expect(prisma.aIResponse.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.aIResponse.findMany.mock.calls[0][0].take).toBe(400);
    expect(prisma.aIResponse.findMany.mock.calls[1][0].cursor).toEqual({ id: 'r0399' });
    await service.analyze('hospital-a', 30, NOW);
    expect(prisma.aIResponse.findMany).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), first, 300);
  });
});

describe('AdminController naver-sources validation', () => {
  const previousSecret = process.env.ADMIN_SECRET;
  afterAll(() => { if (previousSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = previousSecret; });
  it('헤더 인증을 먼저 검증하고 days 7~90만 허용한다', async () => {
    process.env.ADMIN_SECRET = 'test-only-secret';
    const analyze = jest.fn().mockResolvedValue({});
    const controller = new AdminController({} as any, {} as any, {} as any, { analyze } as any);
    await expect(controller.getNaverSources('wrong', 'hospital-a', '30')).rejects.toThrow(UnauthorizedException);
    await expect(controller.getNaverSources('test-only-secret', 'hospital-a', '6')).rejects.toThrow(BadRequestException);
    await expect(controller.getNaverSources('test-only-secret', 'hospital-a', '30.5')).rejects.toThrow(BadRequestException);
    await expect(controller.getNaverSources('test-only-secret', '', '30')).rejects.toThrow(BadRequestException);
    await controller.getNaverSources('test-only-secret', ' hospital-a ');
    expect(analyze).toHaveBeenCalledWith('hospital-a', 30);
  });
});
