import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePromptDto, BulkCreatePromptsDto } from './dto/create-prompt.dto';
import { PlanGuard } from '../common/guards/plan.guard';

@Injectable()
export class PromptsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 병원의 플랜별 질문 한도 조회
   */
  private async getPromptLimit(hospitalId: string): Promise<number> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { planType: true },
    });
    const planType = hospital?.planType || 'FREE';
    const limits = PlanGuard.PLAN_LIMITS[planType] || PlanGuard.PLAN_LIMITS.FREE;
    return limits.maxPrompts === -1 ? 999 : limits.maxPrompts;
  }

  async create(hospitalId: string, dto: CreatePromptDto) {
    const maxPrompts = await this.getPromptLimit(hospitalId);

    // 질문 개수 제한 체크 (플랜별)
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId },
    });

    if (currentCount >= maxPrompts) {
      throw new ForbiddenException(
        `현재 플랜에서는 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다. 플랜을 업그레이드하거나 기존 질문을 삭제해주세요.`
      );
    }

    return this.prisma.prompt.create({
      data: {
        hospitalId,
        promptText: dto.promptText,
        promptType: dto.promptType || 'CUSTOM',
        specialtyCategory: dto.specialtyCategory,
        regionKeywords: dto.regionKeywords || [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async bulkCreate(hospitalId: string, dto: BulkCreatePromptsDto) {
    const maxPrompts = await this.getPromptLimit(hospitalId);

    // 질문 개수 제한 체크 (플랜별)
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId },
    });

    const remainingSlots = maxPrompts - currentCount;
    if (remainingSlots <= 0) {
      throw new ForbiddenException(
        `현재 플랜에서는 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다.`
      );
    }

    // 남은 슬롯만큼만 생성
    const promptsToCreate = dto.prompts.slice(0, remainingSlots);

    const prompts = await this.prisma.prompt.createMany({
      data: promptsToCreate.map((p) => ({
        hospitalId,
        promptText: p.promptText,
        promptType: p.promptType || 'CUSTOM',
        specialtyCategory: p.specialtyCategory,
        regionKeywords: p.regionKeywords || [],
        isActive: p.isActive ?? true,
      })),
    });

    return {
      created: prompts.count,
      maxPrompts,
      remaining: maxPrompts - currentCount - prompts.count,
    };
  }

  async findAll(hospitalId: string, onlyActive: boolean = true) {
    return this.prisma.prompt.findMany({
      where: {
        hospitalId,
        ...(onlyActive && { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { aiResponses: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
      include: {
        aiResponses: {
          orderBy: { responseDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    return prompt;
  }

  async update(id: string, hospitalId: string, dto: Partial<CreatePromptDto>) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    if (prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('수정 권한이 없습니다');
    }

    return this.prisma.prompt.update({
      where: { id },
      data: {
        promptText: dto.promptText,
        promptType: dto.promptType,
        specialtyCategory: dto.specialtyCategory,
        regionKeywords: dto.regionKeywords,
        isActive: dto.isActive,
      },
    });
  }

  async delete(id: string, hospitalId: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    if (prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('삭제 권한이 없습니다');
    }

    await this.prisma.prompt.delete({
      where: { id },
    });

    return { success: true };
  }

  async toggleActive(id: string, hospitalId: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    if (prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('수정 권한이 없습니다');
    }

    return this.prisma.prompt.update({
      where: { id },
      data: { isActive: !prompt.isActive },
    });
  }

  /**
   * 프리셋 질문 템플릿에서 병원 맞춤 질문 생성
   */
  async generateFromPresets(hospitalId: string, specialtyType: string, region: string) {
    const maxPrompts = await this.getPromptLimit(hospitalId);

    const presets = await this.prisma.presetPrompt.findMany({
      where: {
        specialtyType: specialtyType as any,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    const prompts = presets.map((preset) => ({
      hospitalId,
      promptText: preset.promptTemplate.replace('{지역}', region),
      promptType: 'PRESET' as const,
      specialtyCategory: preset.category,
      regionKeywords: region.split(' '),
      isActive: true,
    }));

    // 질문 개수 제한 체크
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId },
    });

    const remainingSlots = maxPrompts - currentCount;
    const promptsToCreate = prompts.slice(0, Math.max(0, remainingSlots));

    if (promptsToCreate.length > 0) {
      await this.prisma.prompt.createMany({ data: promptsToCreate });
    }

    return {
      created: promptsToCreate.length,
      maxPrompts,
      remaining: remainingSlots - promptsToCreate.length,
    };
  }

  /**
   * Query Fanouts - 질문 변형 생성
   */
  async generateFanouts(promptId: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    const baseText = prompt.promptText;
    const variations = [
      baseText.replace('추천해줘', '알려줘'),
      baseText.replace('추천해줘', '어디가 좋아?'),
      baseText.replace('잘하는', '유명한'),
      baseText.replace('잘하는', '전문'),
      `${baseText} 비용은?`,
      `${baseText} 후기 알려줘`,
    ];

    const uniqueVariations = [...new Set(variations)].filter(
      (v) => v !== baseText,
    );

    // 질문 개수 제한 체크 (플랜별)
    const maxPrompts = await this.getPromptLimit(prompt.hospitalId);
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId: prompt.hospitalId },
    });

    const remainingSlots = maxPrompts - currentCount;
    if (remainingSlots <= 0) {
      throw new ForbiddenException(
        `현재 플랜에서는 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다. 플랜을 업그레이드하거나 기존 질문을 삭제해주세요.`
      );
    }

    const variationsToCreate = uniqueVariations.slice(0, Math.min(5, remainingSlots));

    const created = await this.prisma.prompt.createMany({
      data: variationsToCreate.map((text) => ({
        hospitalId: prompt.hospitalId,
        promptText: text,
        promptType: 'AUTO_GENERATED',
        specialtyCategory: prompt.specialtyCategory,
        regionKeywords: prompt.regionKeywords,
        isActive: true,
      })),
    });

    return { created: created.count, variations: variationsToCreate };
  }
}
