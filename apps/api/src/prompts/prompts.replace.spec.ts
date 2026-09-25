import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromptsService } from './prompts.service';

function setup(options: { owner?: string; active?: Array<{ id: string; promptText: string }>; planType?: string } = {}) {
  const active = options.active || [
    { id: 'old-1', promptText: '기존 질문' },
    { id: 'old-2', promptText: '다른 질문' },
  ];
  const tx = {
    hospital: { findUnique: jest.fn().mockResolvedValue({ planType: options.planType || 'STARTER' }) },
    prompt: {
      findFirst: jest.fn().mockResolvedValue(options.owner === 'other' ? null : {
        id: 'old-1', specialtyCategory: 'DENTAL', regionKeywords: ['강남구'],
      }),
      findMany: jest.fn().mockResolvedValue(active),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'new-1', promptText: '새 핵심 질문', isActive: true }),
    },
  };
  const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
  return { service: new PromptsService(prisma as any), tx, prisma };
}

describe('PromptsService.replace', () => {
  it('기존 ID와 답변 연결을 유지한 채 기존 질문만 중단하고 새 질문을 만든다', async () => {
    const { service, tx, prisma } = setup();
    const result = await service.replace('hospital-1', {
      replacePromptId: 'old-1', promptText: '  새 핵심 질문  ',
    });

    expect(tx.prompt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-1', hospitalId: 'hospital-1', isActive: true },
    }));
    expect(tx.prompt.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-1', hospitalId: 'hospital-1', isActive: true },
      data: { isActive: false },
    });
    expect(tx.prompt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      hospitalId: 'hospital-1', promptText: '새 핵심 질문', isActive: true,
    }) });
    expect(result.retiredPromptId).toBe('old-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.prompt).not.toHaveProperty('delete');
  });

  it('타 병원 질문은 교체하지 않는다', async () => {
    const { service, tx } = setup({ owner: 'other' });
    await expect(service.replace('hospital-1', { replacePromptId: 'other-1', promptText: '새 질문' })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.prompt.updateMany).not.toHaveBeenCalled();
  });

  it('이미 측정 중인 질문과 같은 문장은 거절한다', async () => {
    const { service, tx } = setup();
    await expect(service.replace('hospital-1', { replacePromptId: 'old-1', promptText: ' 다른  질문 ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.prompt.updateMany).not.toHaveBeenCalled();
  });

  it('플랜 한도를 이미 초과한 병원에서 교체로 초과 상태를 유지하지 않는다', async () => {
    const active = Array.from({ length: 6 }, (_, index) => ({ id: `old-${index}`, promptText: `질문 ${index}` }));
    const { service, tx } = setup({ active });
    await expect(service.replace('hospital-1', { replacePromptId: 'old-1', promptText: '새 질문' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.prompt.updateMany).not.toHaveBeenCalled();
  });
});

describe('PromptsService activation and text edits', () => {
  it('가득 찬 플랜에서 보관 질문을 다시 활성화하지 않는다', async () => {
    const prisma = {
      prompt: {
        findUnique: jest.fn().mockResolvedValue({ id: 'old-1', hospitalId: 'hospital-1', isActive: false }),
        count: jest.fn().mockResolvedValue(5),
        update: jest.fn(),
      },
      hospital: { findUnique: jest.fn().mockResolvedValue({ planType: 'STARTER' }) },
    };
    const service = new PromptsService(prisma as any);
    await expect(service.toggleActive('old-1', 'hospital-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.prompt.update).not.toHaveBeenCalled();
  });

  it('문장 수정 API의 isActive 입력으로는 보관 질문을 재활성화하지 않는다', async () => {
    const prisma = {
      prompt: {
        findUnique: jest.fn().mockResolvedValue({ id: 'old-1', hospitalId: 'hospital-1', isActive: true }),
        update: jest.fn().mockResolvedValue({ id: 'old-1', promptText: '수정 문장', isActive: true }),
      },
    };
    const service = new PromptsService(prisma as any);
    await service.update('old-1', 'hospital-1', { promptText: ' 수정 문장 ', isActive: false } as any);
    expect(prisma.prompt.update).toHaveBeenCalledWith({ where: { id: 'old-1' }, data: { promptText: '수정 문장' } });
  });
});
