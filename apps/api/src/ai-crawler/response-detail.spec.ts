import { NotFoundException } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';

jest.mock('./ai-crawler.service', () => ({ AICrawlerService: class {} }));
const original = '보관된 실제 AI 답변입니다. '.repeat(100);
function setup() {
  const row = { id: 'answer-1', hospitalId: 'clinic-1', responseText: '', archivedPromptText: '측정 당시 질문', prompt: { promptText: '수정된 현재 질문' } };
  const prisma = {
    aIResponse: { findFirst: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]), count: jest.fn().mockResolvedValue(1) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: row.id, response_text: original }]),
  };
  return { prisma, row, controller: new AICrawlerController({} as never, prisma as never, {} as never) };
}

describe('AI response archive reader', () => {
  it('returns archived full text and the measured question within the requested hospital', async () => {
    const { prisma, controller } = setup();
    const result = await controller.getResponseDetail('clinic-1', 'answer-1');
    expect(prisma.aIResponse.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'answer-1', hospitalId: 'clinic-1' } }));
    expect(result.responseText).toBe(original);
    expect(result.measuredQuestion).toBe('측정 당시 질문');
    expect(result.questionSnapshotAvailable).toBe(true);
  });
  it('does not look in the archive when the response is not owned by the requested hospital', async () => {
    const { prisma, controller } = setup();
    prisma.aIResponse.findFirst.mockResolvedValue(null);
    await expect(controller.getResponseDetail('clinic-2', 'answer-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('labels the current question as a fallback when no measured snapshot was stored', async () => {
    const { prisma, row, controller } = setup();
    prisma.aIResponse.findFirst.mockResolvedValue({ ...row, responseText: original, archivedPromptText: null });
    const result = await controller.getResponseDetail('clinic-1', 'answer-1');
    expect(result.measuredQuestion).toBe('수정된 현재 질문');
    expect(result.questionSnapshotAvailable).toBe(false);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('keeps the measured question in previews and marks text that requires the full reader', async () => {
    const { controller } = setup();
    const result = await controller.getResponses('clinic-1');
    expect(result.data[0]).toMatchObject({ measuredQuestion: '측정 당시 질문', questionSnapshotAvailable: true, responseTextFull: true });
    expect(result.data[0].responseText.length).toBe(803);
  });
});
