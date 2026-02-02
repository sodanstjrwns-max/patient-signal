import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePromptDto, BulkCreatePromptsDto } from './dto/create-prompt.dto';

@Injectable()
export class PromptsService {
  constructor(private prisma: PrismaService) {}

  async create(hospitalId: string, dto: CreatePromptDto) {
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
    const prompts = await this.prisma.prompt.createMany({
      data: dto.prompts.map((p) => ({
        hospitalId,
        promptText: p.promptText,
        promptType: p.promptType || 'CUSTOM',
        specialtyCategory: p.specialtyCategory,
        regionKeywords: p.regionKeywords || [],
        isActive: p.isActive ?? true,
      })),
    });

    return { created: prompts.count };
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

    if (prompts.length > 0) {
      await this.prisma.prompt.createMany({ data: prompts });
    }

    return { created: prompts.length };
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

    const created = await this.prisma.prompt.createMany({
      data: uniqueVariations.slice(0, 5).map((text) => ({
        hospitalId: prompt.hospitalId,
        promptText: text,
        promptType: 'AUTO_GENERATED',
        specialtyCategory: prompt.specialtyCategory,
        regionKeywords: prompt.regionKeywords,
        isActive: true,
      })),
    });

    return { created: created.count, variations: uniqueVariations.slice(0, 5) };
  }
}
