import { BadRequestException, Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { withResponseCounts } from '../common/stats/prompt-response-count';
import { CreatePromptDto, BulkCreatePromptsDto, ReplacePromptDto, UpdatePromptTextDto } from './dto/create-prompt.dto';
import { PlanGuard } from '../common/guards/plan.guard';
import { HubEntitlementService } from '../common/hub-entitlement/hub-entitlement.service';

@Injectable()
export class PromptsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private hubEntitlement?: HubEntitlementService,
  ) {}

  /**
   * 병원의 플랜별 질문 한도 조회
   */
  private async getPromptLimit(hospitalId: string): Promise<number> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, planType: true, psHospitalId: true },
    });
    // 【허브 올패스】유효 플랜으로 한도 판정(올려주기만)
    const eff = hospital && this.hubEntitlement ? await this.hubEntitlement.apply(hospital) : hospital;
    const planType = eff?.planType || 'FREE';
    const limits = PlanGuard.PLAN_LIMITS[planType] || PlanGuard.PLAN_LIMITS.FREE;
    return limits.maxPrompts === -1 ? 999 : limits.maxPrompts;
  }

  async create(hospitalId: string, dto: CreatePromptDto) {
    const maxPrompts = await this.getPromptLimit(hospitalId);

    // 질문 개수 제한 체크 (활성 질문만 카운트)
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId, isActive: true },
    });

    if (currentCount >= maxPrompts) {
      throw new ForbiddenException(
        `현재 플랜에서는 활성 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다. 플랜을 업그레이드하거나 기존 질문을 비활성화/삭제해주세요.`
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

    // 질문 개수 제한 체크 (활성 질문만 카운트)
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId, isActive: true },
    });

    const remainingSlots = maxPrompts - currentCount;
    if (remainingSlots <= 0) {
      throw new ForbiddenException(
        `현재 플랜에서는 활성 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다.`
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

  /** 질문 ID를 새로 만들어 이전 AI 답변이 기존 질문에 연결된 채 남도록 교체한다. */
  async replace(hospitalId: string, dto: ReplacePromptDto) {
    const promptText = dto.promptText?.trim();
    if (!promptText || promptText.length > 500) {
      throw new BadRequestException('새 질문은 1~500자로 입력해 주세요.');
    }

    // 【허브 올패스】트랜잭션 밖에서 유효 플랜을 미리 구한다(허브 호출을 트랜잭션 안에 두지 않음)
    const effPlan = this.hubEntitlement ? await this.hubEntitlement.effectivePlanType(hospitalId) : null;
    return this.prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.findUnique({
        where: { id: hospitalId },
        select: { planType: true },
      });
      if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다.');

      const current = await tx.prompt.findFirst({
        where: { id: dto.replacePromptId, hospitalId, isActive: true },
        select: { id: true, specialtyCategory: true, regionKeywords: true },
      });
      if (!current) throw new NotFoundException('교체할 활성 질문을 찾을 수 없습니다.');

      const planLimits = PlanGuard.PLAN_LIMITS[(effPlan || hospital.planType || 'FREE') as keyof typeof PlanGuard.PLAN_LIMITS] || PlanGuard.PLAN_LIMITS.FREE;
      const maxPrompts = planLimits.maxPrompts === -1 ? 999 : planLimits.maxPrompts;
      const active = await tx.prompt.findMany({
        where: { hospitalId, isActive: true },
        select: { id: true, promptText: true },
      });
      if (active.length > maxPrompts) {
        throw new ForbiddenException(`현재 플랜의 활성 질문 한도(${maxPrompts}개)를 초과했습니다.`);
      }
      const normalized = (text: string) => text.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');
      if (active.some((prompt) => normalized(prompt.promptText) === normalized(promptText))) {
        throw new BadRequestException('이미 모니터링 중인 질문입니다.');
      }

      const retired = await tx.prompt.updateMany({
        where: { id: current.id, hospitalId, isActive: true },
        data: { isActive: false },
      });
      if (retired.count !== 1) throw new BadRequestException('질문 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
      const prompt = await tx.prompt.create({
        data: {
          hospitalId,
          promptText,
          promptType: 'CUSTOM',
          specialtyCategory: current.specialtyCategory,
          regionKeywords: current.regionKeywords,
          isActive: true,
        },
      });
      return { retiredPromptId: current.id, prompt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findAll(hospitalId: string, onlyActive: boolean = true) {
    // 【2026-09-26 확장 대비】relation _count 는 전 병원 ai_responses 를 집계하므로(평균 7초) 이 병원 질문 id 로만 센다.
    //  응답 모양(_count.aiResponses)은 종전과 같다.
    const prompts = await this.prisma.prompt.findMany({
      where: {
        hospitalId,
        ...(onlyActive && { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return withResponseCounts(this.prisma, prompts);
  }

  async findOne(id: string, hospitalId?: string) {
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

    // 【멀티테넌트】타 병원 질문 열람 차단 (IDOR 방어)
    if (hospitalId && prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('해당 질문에 대한 접근 권한이 없습니다');
    }

    return prompt;
  }

  async update(id: string, hospitalId: string, dto: UpdatePromptTextDto) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    if (prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('수정 권한이 없습니다');
    }

    if (!prompt.isActive) {
      throw new ForbiddenException('측정이 중단된 질문의 문장은 수정할 수 없습니다.');
    }

    const promptText = dto.promptText?.trim();
    if (!promptText || promptText.length > 500) {
      throw new BadRequestException('질문은 1~500자로 입력해 주세요.');
    }

    return this.prisma.prompt.update({
      where: { id },
      data: { promptText },
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

    if (!prompt.isActive) {
      const maxPrompts = await this.getPromptLimit(hospitalId);
      const activeCount = await this.prisma.prompt.count({ where: { hospitalId, isActive: true } });
      if (activeCount >= maxPrompts) {
        throw new ForbiddenException(`현재 플랜에서는 활성 질문을 최대 ${maxPrompts}개까지 등록할 수 있습니다.`);
      }
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

    // 【P1-2】 DTO가 1차 방어선이지만, 내부 호출(온보딩/업그레이드 자동생성)에서도
    //          region이 비어 들어올 수 있으므로 서비스 레벨에서도 안전값 처리
    const safeRegion = typeof region === 'string' ? region.trim() : '';

    const presets = await this.prisma.presetPrompt.findMany({
      where: {
        specialtyType: specialtyType as any,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    const prompts = presets.map((preset) => ({
      hospitalId,
      promptText: preset.promptTemplate.replace('{지역}', safeRegion).trim(),
      promptType: 'PRESET' as const,
      specialtyCategory: preset.category,
      regionKeywords: safeRegion ? safeRegion.split(/\s+/).filter(Boolean) : [],
      isActive: true,
    }));

    // 질문 개수 제한 체크 (활성 질문만 카운트)
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId, isActive: true },
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
  async generateFanouts(promptId: string, hospitalId?: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new NotFoundException('질문을 찾을 수 없습니다');
    }

    // 【멀티테넌트】타 병원 질문으로 변형 생성 차단 (비용 도용 + IDOR 방어)
    if (hospitalId && prompt.hospitalId !== hospitalId) {
      throw new ForbiddenException('해당 질문에 대한 접근 권한이 없습니다');
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

    // 질문 개수 제한 체크 (활성 질문만 카운트)
    const maxPrompts = await this.getPromptLimit(prompt.hospitalId);
    const currentCount = await this.prisma.prompt.count({
      where: { hospitalId: prompt.hospitalId, isActive: true },
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
