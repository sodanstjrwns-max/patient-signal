import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PromptResponsesController } from './prompt-responses.controller';

type QueryCall = {
  where: Record<string, unknown>;
  select?: Record<string, unknown>;
  take?: number;
  skip?: number;
};

const makePrisma = () => ({
  prompt: {
    findFirst: jest.fn().mockResolvedValue({
      id: 'prompt-1',
      promptText: '현재 질문',
      isActive: true,
    }),
  },
  aIResponse: {
    groupBy: jest.fn().mockResolvedValue([
      { aiPlatform: 'CHATGPT', isMentioned: true, _count: { _all: 2 } },
      { aiPlatform: 'CHATGPT', isMentioned: false, _count: { _all: 1 } },
      { aiPlatform: 'GEMINI', isMentioned: false, _count: { _all: 1 } },
    ]),
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'answer-1',
        promptId: 'prompt-1',
        archivedPromptText: '측정 당시 질문',
        aiPlatform: 'CHATGPT',
        responseText: '측정된 답변 원문',
        isMentioned: true,
      },
    ]),
  },
});

describe('PromptResponsesController', () => {
  it('병원과 질문 ID를 함께 검증하고, 측정 당시 질문과 실제 답변을 연결한다', async () => {
    const prisma = makePrisma();
    const controller = new PromptResponsesController(
      prisma as unknown as PrismaService,
    );

    const result = await controller.getPromptResponses(
      'hospital-1',
      'prompt-1',
    );

    expect(prisma.prompt.findFirst).toHaveBeenCalledWith({
      where: { id: 'prompt-1', hospitalId: 'hospital-1' },
      select: { id: true, promptText: true, isActive: true },
    });
    const findManyCalls = prisma.aIResponse.findMany.mock.calls as unknown as [
      QueryCall,
    ][];
    expect(findManyCalls[0][0].where).toEqual({
      hospitalId: 'hospital-1',
      promptId: 'prompt-1',
    });
    expect(findManyCalls[0][0].select).not.toHaveProperty('estimatedCostUsd');
    expect(result.data[0]).toMatchObject({
      measuredQuestion: '측정 당시 질문',
      questionSnapshotAvailable: true,
      responseText: '측정된 답변 원문',
    });
    expect(result.summary).toEqual({
      total: 4,
      mentioned: 2,
      mentionRate: 50,
      byPlatform: [
        { platform: 'CHATGPT', total: 3, mentioned: 2 },
        { platform: 'GEMINI', total: 1, mentioned: 0 },
      ],
    });
    expect(result.total).toBe(4);
    expect(result.hasMore).toBe(true);
  });

  it('다른 병원 소유의 질문은 답변 조회 전에 거부한다', async () => {
    const prisma = makePrisma();
    prisma.prompt.findFirst.mockResolvedValue(null);
    const controller = new PromptResponsesController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.getPromptResponses('hospital-2', 'prompt-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aIResponse.findMany).not.toHaveBeenCalled();
  });

  it('언급 필터는 목록에만 적용하고 집계는 전체 측정치를 유지한다', async () => {
    const prisma = makePrisma();
    const controller = new PromptResponsesController(
      prisma as unknown as PrismaService,
    );

    const result = await controller.getPromptResponses(
      'hospital-1',
      'prompt-1',
      undefined,
      'CHATGPT',
      'true',
      '1',
      '1',
    );

    const groupByCalls = prisma.aIResponse.groupBy.mock.calls as unknown as [
      QueryCall,
    ][];
    const findManyCalls = prisma.aIResponse.findMany.mock.calls as unknown as [
      QueryCall,
    ][];
    expect(groupByCalls[0][0].where).toEqual({
      hospitalId: 'hospital-1',
      promptId: 'prompt-1',
      aiPlatform: 'CHATGPT',
    });
    expect(findManyCalls[0][0]).toMatchObject({
      where: {
        hospitalId: 'hospital-1',
        promptId: 'prompt-1',
        aiPlatform: 'CHATGPT',
        isMentioned: true,
      },
      take: 1,
      skip: 1,
    });
    expect(result.summary.total).toBe(4);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('잘못된 페이지와 플랫폼 필터를 거부한다', async () => {
    const controller = new PromptResponsesController(
      makePrisma() as unknown as PrismaService,
    );
    await expect(
      controller.getPromptResponses(
        'h',
        'p',
        undefined,
        undefined,
        undefined,
        '-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.getPromptResponses('h', 'p', undefined, 'INVALID'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
