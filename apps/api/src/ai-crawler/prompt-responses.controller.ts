import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AIPlatform, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { fillArchivedTexts } from '../common/stats/response-archive';

function boundedInteger(
  value: string | undefined,
  fallback: number,
  max: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value))
    throw new BadRequestException(`${name}은 0 이상의 정수여야 합니다.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) {
    throw new BadRequestException(`${name}은 ${max} 이하여야 합니다.`);
  }
  return number;
}

/**
 * A monitored question's actual measured answers. The prompt and its responses are
 * both scoped to the URL hospital, and only explicit public fields are selected.
 */
@ApiTags('질문별 AI 답변')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
@Controller('ai-crawler/prompt-responses')
export class PromptResponsesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':hospitalId/:promptId')
  @ApiOperation({ summary: '질문별 실제 AI 답변과 플랫폼별 언급 집계 조회' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: '최근 N일. 생략 시 전체 이력',
  })
  @ApiQuery({ name: 'platform', required: false, enum: AIPlatform })
  @ApiQuery({ name: 'mentioned', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'limit', required: false, description: '기본 20, 최대 50' })
  @ApiQuery({ name: 'offset', required: false, description: '기본 0' })
  async getPromptResponses(
    @Param('hospitalId') hospitalId: string,
    @Param('promptId') promptId: string,
    @Query('days') days?: string,
    @Query('platform') platform?: string,
    @Query('mentioned') mentioned?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = boundedInteger(limit, 20, 50, 'limit');
    const skip = boundedInteger(offset, 0, 100_000, 'offset');
    if (take === 0)
      throw new BadRequestException('limit은 1 이상이어야 합니다.');
    const daysNumber =
      days === undefined ? undefined : boundedInteger(days, 0, 3650, 'days');
    if (daysNumber === 0)
      throw new BadRequestException('days는 1 이상이어야 합니다.');
    if (
      platform &&
      !Object.values(AIPlatform).includes(platform as AIPlatform)
    ) {
      throw new BadRequestException('지원하지 않는 AI 플랫폼입니다.');
    }
    if (
      mentioned !== undefined &&
      mentioned !== 'true' &&
      mentioned !== 'false'
    ) {
      throw new BadRequestException('mentioned는 true 또는 false여야 합니다.');
    }

    const prompt = await this.prisma.prompt.findFirst({
      where: { id: promptId, hospitalId },
      select: { id: true, promptText: true, isActive: true },
    });
    if (!prompt) throw new NotFoundException('질문을 찾을 수 없습니다.');

    const since =
      daysNumber === undefined
        ? undefined
        : new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000);
    since?.setUTCHours(0, 0, 0, 0);
    const baseWhere: Prisma.AIResponseWhereInput = {
      hospitalId,
      promptId,
      ...(since && { responseDate: { gte: since } }),
      ...(platform && { aiPlatform: platform as AIPlatform }),
    };
    const listWhere: Prisma.AIResponseWhereInput = {
      ...baseWhere,
      ...(mentioned !== undefined && { isMentioned: mentioned === 'true' }),
    };

    const [grouped, rows] = await Promise.all([
      this.prisma.aIResponse.groupBy({
        by: ['aiPlatform', 'isMentioned'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.aIResponse.findMany({
        where: listWhere,
        orderBy: [
          { responseDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take,
        skip,
        select: {
          id: true,
          promptId: true,
          archivedPromptText: true,
          aiPlatform: true,
          aiModelVersion: true,
          responseText: true,
          responseDate: true,
          createdAt: true,
          isMentioned: true,
          mentionPosition: true,
          totalRecommendations: true,
          sentimentLabel: true,
          recommendationDepth: true,
          citedSources: true,
          competitorsMentioned: true,
          repeatIndex: true,
          isWebSearch: true,
          isVerified: true,
        },
      }),
    ]);

    const byPlatform = new Map<
      string,
      { platform: string; total: number; mentioned: number }
    >();
    let total = 0;
    let mentionedTotal = 0;
    for (const row of grouped) {
      const count = row._count._all;
      total += count;
      if (row.isMentioned) mentionedTotal += count;
      const aggregate = byPlatform.get(row.aiPlatform) ?? {
        platform: row.aiPlatform,
        total: 0,
        mentioned: 0,
      };
      aggregate.total += count;
      if (row.isMentioned) aggregate.mentioned += count;
      byPlatform.set(row.aiPlatform, aggregate);
    }

    const filteredTotal =
      mentioned === 'true'
        ? mentionedTotal
        : mentioned === 'false'
          ? total - mentionedTotal
          : total;
    const filled = await fillArchivedTexts(this.prisma, rows);
    const data = filled.map(({ archivedPromptText, ...row }) => ({
      ...row,
      measuredQuestion: archivedPromptText ?? prompt.promptText,
      questionSnapshotAvailable: archivedPromptText !== null,
    }));

    return {
      prompt,
      summary: {
        total,
        mentioned: mentionedTotal,
        mentionRate: total > 0 ? Math.round((mentionedTotal / total) * 100) : 0,
        byPlatform: Array.from(byPlatform.values()).sort(
          (a, b) => b.total - a.total,
        ),
      },
      data,
      total: filteredTotal,
      hasMore: skip + data.length < filteredTotal,
    };
  }
}
