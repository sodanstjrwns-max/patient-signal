import { BadRequestException } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';
import type { AICrawlerService } from './ai-crawler.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { CacheService } from '../common/cache/cache.service';

const activePlatforms = [
  'CHATGPT',
  'CLAUDE',
  'PERPLEXITY',
  'GEMINI',
  'GROK',
  'CLOVA_X',
  'NAVER_AI_BRIEFING',
] as const;

const geminiRedirect = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/gemini';
const rows = [
  ...activePlatforms.map((aiPlatform) => ({
    id: `response-${aiPlatform}`,
    aiPlatform,
    citedSources: [aiPlatform === 'GEMINI'
      ? geminiRedirect
      : aiPlatform === 'CHATGPT'
        ? 'https://blog.naver.com/example/post'
        : `https://${aiPlatform.toLowerCase().replace(/_/g, '-')}.example.org/post`],
    citedUrl: null,
    isMentioned: false,
    sourceHints: aiPlatform === 'GEMINI'
      ? { sources: [{ title: 'gemini-source.example.org', domain: 'vertexaisearch.cloud.google.com' }] }
      : null,
  })),
  {
    id: 'response-CHATGPT-empty',
    aiPlatform: 'CHATGPT',
    citedSources: [] as string[],
    citedUrl: null,
    isMentioned: false,
    sourceHints: null,
  },
  {
    id: 'response-legacy',
    aiPlatform: 'GOOGLE_AI_OVERVIEW',
    citedSources: ['https://legacy.example.org/post'],
    citedUrl: null,
    isMentioned: false,
    sourceHints: null,
  },
];

function makeController() {
  const prisma = {
    aIResponse: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { aiPlatform?: string } }) =>
        rows.filter((row) => !where.aiPlatform || row.aiPlatform === where.aiPlatform)),
    },
  };
  const controller = new AICrawlerController(
    {} as AICrawlerService,
    prisma as unknown as PrismaService,
    {} as CacheService,
  );
  return { controller, findMany: prisma.aIResponse.findMany };
}

describe('AICrawlerController source platform filters', () => {
  it('ALL preserves the full population, including legacy responses', async () => {
    const { controller, findMany } = makeController();

    const result = await controller.getSourceAnalysis('hospital-1', '30');

    expect(findMany.mock.calls[0][0].where).toMatchObject({ hospitalId: 'hospital-1' });
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('aiPlatform');
    expect(result).toMatchObject({
      platform: 'ALL',
      totalResponses: 9,
      totalResponsesWithSources: 8,
      totalUrls: 8,
    });
    expect(result.platformSources.GOOGLE_AI_OVERVIEW).toMatchObject({ total: 1, totalSources: 1 });
    expect(result.topDomains).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'legacy.example.org' }),
    ]));
  });

  it.each(activePlatforms)('%s filters the DB query and every source aggregate', async (platform) => {
    const { controller, findMany } = makeController();

    const result = await controller.getSourceAnalysis('hospital-1', '30', platform);

    expect(findMany.mock.calls[0][0].where.aiPlatform).toBe(platform);
    expect(result.platform).toBe(platform);
    expect(result.totalResponses).toBe(platform === 'CHATGPT' ? 2 : 1);
    expect(result.totalResponsesWithSources).toBe(1);
    expect(result.totalUrls).toBe(1);
    expect(Object.keys(result.platformSources)).toEqual([platform]);
    expect(result.categories.reduce((sum, category) => sum + category.count, 0)).toBe(1);
    expect(result.topDomains).toHaveLength(1);
    expect(result.topDomains[0].platforms).toEqual([platform]);
    expect(result.topDomains[0].domain).toBe(
      platform === 'GEMINI'
        ? 'gemini-source.example.org'
        : platform === 'CHATGPT'
          ? 'blog.naver.com'
        : `${platform.toLowerCase().replace(/_/g, '-')}.example.org`,
    );
    expect(result.missingChannels.some((channel) => channel.channel === '네이버 블로그'))
      .toBe(platform !== 'CHATGPT');
  });

  it('diagnostic uses the same DB platform filter and decoded Gemini domain', async () => {
    const { controller, findMany } = makeController();

    const result = await controller.getSourceDiagnostic('hospital-1', '30', 'GEMINI');

    expect(findMany.mock.calls[0][0].where.aiPlatform).toBe('GEMINI');
    expect(result.platform).toBe('GEMINI');
    expect(result.summary).toMatchObject({ totalUrls: 1, decodedCount: 1 });
    expect(result.before).toEqual([
      expect.objectContaining({ domain: 'vertexaisearch.cloud.google.com' }),
    ]);
    expect(result.after).toEqual([
      expect.objectContaining({ domain: 'gemini-source.example.org' }),
    ]);
  });

  it('diagnostic ALL includes every platform without an aiPlatform WHERE clause', async () => {
    const { controller, findMany } = makeController();

    const result = await controller.getSourceDiagnostic('hospital-1', '30', 'ALL');

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('aiPlatform');
    expect(result.platform).toBe('ALL');
    expect(result.summary.totalUrls).toBe(8);
    expect(result.before).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'legacy.example.org' }),
    ]));
  });

  it('rejects unsupported and legacy platform selections before querying', async () => {
    const { controller, findMany } = makeController();

    await expect(controller.getSourceAnalysis('hospital-1', '30', 'GOOGLE_AI_OVERVIEW'))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getSourceDiagnostic('hospital-1', '30', 'UNKNOWN'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
