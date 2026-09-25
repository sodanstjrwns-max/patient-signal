import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AIPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebsiteAnalysisController } from './website-analysis.controller';
import {
  aggregateWebsiteResponse,
  kstPeriod,
  normalizeCitationUrl,
  normalizeWebsiteDomain,
  normalizeWebsiteScope,
  WebsiteAnalysisService,
  WebsiteResponseRow,
} from './website-analysis.service';

const row = (overrides: Partial<WebsiteResponseRow> = {}): WebsiteResponseRow => ({
  id: 'answer-1',
  aiPlatform: AIPlatform.CHATGPT,
  createdAt: new Date('2026-09-24T16:00:00.000Z'),
  isMentioned: false,
  archivedPromptText: '당시 질문',
  citedSources: [],
  citedUrl: null,
  sourceHints: null,
  prompt: { promptText: '현재 질문' },
  ...overrides,
});

describe('WebsiteAnalysisService', () => {
  it('www만 같은 호스트로 묶고 유사 도메인과 다른 하위 도메인은 제외한다', () => {
    expect(normalizeWebsiteDomain('https://www.bdbddc.com/clinic')).toBe('bdbddc.com');
    expect(normalizeCitationUrl('https://www.bdbddc.com/implant?utm_source=ai&topic=cost#section'))
      .toMatchObject({
        key: 'bdbddc.com/implant?topic=cost',
        path: '/implant?topic=cost',
      });
    expect(normalizeCitationUrl('http://bdbddc.com/implant?topic=cost')?.key)
      .toBe('bdbddc.com/implant?topic=cost');
    const pages = new Map();
    const result = aggregateWebsiteResponse(row({
      citedSources: [
        'https://bdbddc.com/implant',
        'https://bdbddc.com.evil.com/implant',
        'https://blog.bdbddc.com/implant',
      ],
    }), 'bdbddc.com', pages);
    expect(result.matched).toBe(true);
    expect(pages.size).toBe(1);
    expect(() => normalizeWebsiteDomain('https://user:secret@bdbddc.com'))
      .toThrow(BadRequestException);
    expect(() => normalizeWebsiteDomain('localhost')).toThrow(BadRequestException);
  });

  it('같은 답변의 출처 배열·대표 URL·힌트가 반복돼도 페이지별 한 번만 센다', () => {
    const pages = new Map();
    aggregateWebsiteResponse(row({
      citedSources: [
        'https://www.bdbddc.com/news?topic=one&utm_medium=ai#top',
        'https://bdbddc.com/news?topic=one',
      ],
      citedUrl: 'http://bdbddc.com/news?topic=one',
      sourceHints: { sources: [{ url: 'https://bdbddc.com/news?topic=one' }] },
    }), 'bdbddc.com', pages);
    aggregateWebsiteResponse(row({
      id: 'answer-2',
      aiPlatform: AIPlatform.GEMINI,
      isMentioned: true,
      archivedPromptText: '두 번째 질문',
      citedSources: ['https://bdbddc.com/news?topic=one'],
    }), 'bdbddc.com', pages);
    expect(pages.size).toBe(1);
    expect(pages.get('bdbddc.com/news?topic=one')).toMatchObject({
      citationResponses: 2,
      mentionedResponses: 1,
      examples: [
        { responseId: 'answer-1', question: '당시 질문' },
        { responseId: 'answer-2', question: '두 번째 질문' },
      ],
    });
  });

  it('공유 호스트의 등록 URL 경로 및 하위 경로만 해당 병원 사이트로 센다', () => {
    const scope = normalizeWebsiteScope('https://blog.naver.com/ourclinic');
    expect(scope).toMatchObject({
      domain: 'blog.naver.com', scopePath: '/ourclinic', scopeMode: 'PATH_SUBTREE',
    });
    const pages = new Map();
    aggregateWebsiteResponse(row({
      citedSources: [
        'https://blog.naver.com/ourclinic',
        'https://blog.naver.com/ourclinic/implant',
        'https://blog.naver.com/otherclinic/implant',
        'https://blog.naver.com/ourclinicevil/implant',
      ],
    }), scope.domain, pages, scope.scopePath, scope.scopeSearch);
    expect([...pages.keys()]).toEqual([
      'blog.naver.com/ourclinic',
      'blog.naver.com/ourclinic/implant',
    ]);
    const exact = normalizeWebsiteScope('https://blog.naver.com/ourclinic?post=12');
    expect(exact.scopeMode).toBe('EXACT_URL');
    const exactPages = new Map();
    aggregateWebsiteResponse(row({
      citedSources: [
        'https://blog.naver.com/ourclinic?post=12',
        'https://blog.naver.com/ourclinic?post=13',
        'https://blog.naver.com/ourclinic/sub?post=12',
      ],
    }), exact.domain, exactPages, exact.scopePath, exact.scopeSearch);
    expect([...exactPages.keys()]).toEqual(['blog.naver.com/ourclinic?post=12']);
  });

  it('Gemini 마스킹 URL은 실제 페이지 URL 단서가 있을 때만 반영한다', () => {
    const pages = new Map();
    const masked = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz';
    const unresolved = aggregateWebsiteResponse(row({
      aiPlatform: AIPlatform.GEMINI,
      citedSources: [masked],
      sourceHints: { sources: [{ title: 'bdbddc.com', domain: 'vertexaisearch.cloud.google.com' }] },
    }), 'bdbddc.com', pages);
    expect(unresolved).toEqual({ matched: false, unresolvedGemini: true });
    expect(pages.size).toBe(0);
    const resolved = aggregateWebsiteResponse(row({
      id: 'answer-2',
      aiPlatform: AIPlatform.GEMINI,
      citedSources: [masked],
      sourceHints: { sources: [{ url: 'https://bdbddc.com/faq/implant' }] },
    }), 'bdbddc.com', pages);
    expect(resolved).toEqual({ matched: true, unresolvedGemini: false });
    expect(pages.get('bdbddc.com/faq/implant')?.citationResponses).toBe(1);
    const partial = aggregateWebsiteResponse(row({
      id: 'answer-3',
      aiPlatform: AIPlatform.GEMINI,
      citedSources: [masked, `${masked}-second`],
      sourceHints: { sources: [{ url: 'https://bdbddc.com/faq/one' }] },
    }), 'bdbddc.com', pages);
    expect(partial).toEqual({ matched: true, unresolvedGemini: true });
  });

  it('KST 최근 30일을 createdAt 시각 경계로 만든다', () => {
    const period = kstPeriod(30, new Date('2026-09-24T16:00:00.000Z'));
    expect(period.fromDate).toBe('2026-08-27');
    expect(period.toDate).toBe('2026-09-25');
    expect(period.from.toISOString()).toBe('2026-08-26T15:00:00.000Z');
    expect(period.before.toISOString()).toBe('2026-09-25T15:00:00.000Z');
  });

  it('병원 ID·기간·AI 필터를 DB에 적용하고 내부 비용 필드는 선택하지 않는다', async () => {
    const prisma = {
      hospital: { findUnique: jest.fn().mockResolvedValue({ websiteUrl: 'https://www.bdbddc.com' }) },
      aIResponse: { findMany: jest.fn().mockResolvedValue([
        row({ citedSources: ['https://bdbddc.com/a'] }),
      ]) },
    };
    const service = new WebsiteAnalysisService(prisma as unknown as PrismaService);
    const result = await service.getAnalysis('my-hospital', {
      days: 30,
      platform: AIPlatform.CHATGPT,
      page: 1,
      pageSize: 25,
      now: new Date('2026-09-24T16:00:00.000Z'),
    });
    expect(prisma.hospital.findUnique).toHaveBeenCalledWith({
      where: { id: 'my-hospital' }, select: { websiteUrl: true },
    });
    expect(prisma.aIResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        hospitalId: 'my-hospital',
        aiPlatform: AIPlatform.CHATGPT,
        createdAt: {
          gte: new Date('2026-08-26T15:00:00.000Z'),
          lt: new Date('2026-09-25T15:00:00.000Z'),
        },
      },
      take: 400,
    }));
    const selected = prisma.aIResponse.findMany.mock.calls[0][0].select;
    expect(selected.estimatedCostUsd).toBeUndefined();
    expect(selected.responseText).toBeUndefined();
    expect(result).toMatchObject({
      status: 'READY',
      domain: 'bdbddc.com',
      registeredWebsiteUrl: 'https://www.bdbddc.com',
      totalResponses: 1,
      citedResponseCount: 1,
      pageCount: 1,
      dateBasis: 'CREATED_AT_KST',
      pages: [{ lastCitedAt: '2026-09-25' }],
    });
  });

  it('등록 주소가 공유 호스트의 경로라면 동일 호스트 다른 병원 페이지를 제외한다', async () => {
    const prisma = {
      hospital: { findUnique: jest.fn().mockResolvedValue({ websiteUrl: 'https://blog.naver.com/ourclinic' }) },
      aIResponse: { findMany: jest.fn().mockResolvedValue([row({
        citedSources: [
          'https://blog.naver.com/ourclinic/one',
          'https://blog.naver.com/otherclinic/two',
        ],
      })]) },
    };
    const result = await new WebsiteAnalysisService(prisma as unknown as PrismaService)
      .getAnalysis('my-hospital', {
        days: 30,
        platform: 'ALL',
        page: 1,
        pageSize: 25,
        now: new Date('2026-09-24T16:00:00.000Z'),
      });
    expect(result).toMatchObject({
      domain: 'blog.naver.com',
      scopePath: '/ourclinic',
      pageCount: 1,
      citedResponseCount: 1,
      pages: [{ path: '/ourclinic/one' }],
    });
  });

  it('컨트롤러에 JWT와 병원 소유권 검사가 걸리고 다른 병원 접근은 거부된다', async () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, WebsiteAnalysisController);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(HospitalOwnershipGuard);
    const guard = new HospitalOwnershipGuard(new Reflector());
    const context = {
      getHandler: () => WebsiteAnalysisController.prototype.getAnalysis,
      getClass: () => WebsiteAnalysisController,
      switchToHttp: () => ({
        getRequest: () => ({
          params: { hospitalId: 'other-hospital' },
          user: { hospitalId: 'my-hospital', email: 'owner@example.com' },
        }),
      }),
    };
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });
});
