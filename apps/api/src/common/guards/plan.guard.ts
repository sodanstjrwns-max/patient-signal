import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS_KEY, PlanLimitOptions } from '../decorators/plan-limit.decorator';

/**
 * PlanGuard - 플랜별 기능 제한을 강제하는 Guard
 * 
 * 사용법:
 *   @PlanLimit({ feature: 'maxPrompts', countField: 'prompts' })
 *   @PlanLimit({ feature: 'maxCompetitors', countField: 'competitors' })
 *   @PlanLimit({ feature: 'platforms', requiredPlatform: true })
 *   @PlanLimit({ minPlan: 'STANDARD' })
 */
@Injectable()
export class PlanGuard implements CanActivate {
  private readonly logger = new Logger(PlanGuard.name);

  // 플랜별 기능 제한 정의 (Single Source of Truth)
  static readonly PLAN_LIMITS = {
    STARTER: {
      maxPrompts: 5,
      maxCompetitors: 1,           // 경쟁사 1개 맛보기
      platforms: ['PERPLEXITY', 'GEMINI'],  // API 저렴한 2개
      crawlsPerMonth: 4,           // 월 4회 (주 1회)
      exportEnabled: false,
      aiRecommendations: false,
      contentGap: false,
      competitorAEO: false,
    },
    STANDARD: {
      maxPrompts: 15,
      maxCompetitors: 5,
      platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
      crawlsPerMonth: 8,           // 월 8회 (주 2회)
      exportEnabled: true,
      aiRecommendations: true,
      contentGap: false,
      competitorAEO: true,
    },
    PRO: {
      maxPrompts: 35,
      maxCompetitors: 10,
      platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
      crawlsPerMonth: 30,          // 매일
      exportEnabled: true,
      aiRecommendations: true,
      contentGap: true,
      competitorAEO: true,
    },
    ENTERPRISE: {
      maxPrompts: -1,              // unlimited
      maxCompetitors: -1,
      platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
      crawlsPerMonth: -1,
      exportEnabled: true,
      aiRecommendations: true,
      contentGap: true,
      competitorAEO: true,
    },
  };

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<PlanLimitOptions>(
      PLAN_LIMITS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @PlanLimit 데코레이터가 없으면 통과
    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const hospitalId = request.params?.hospitalId || request.user?.hospitalId;

    if (!hospitalId) {
      throw new ForbiddenException('병원 정보가 필요합니다.');
    }

    // 병원의 현재 플랜 조회
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        planType: true,
        subscriptionStatus: true,
        name: true,
        _count: {
          select: {
            prompts: true,
            competitors: true,
          },
        },
      },
    });

    if (!hospital) {
      throw new ForbiddenException('병원을 찾을 수 없습니다.');
    }

    const planType = hospital.planType || 'STARTER';
    const limits = PlanGuard.PLAN_LIMITS[planType] || PlanGuard.PLAN_LIMITS.STARTER;

    this.logger.debug(
      `[PlanGuard] ${hospital.name} | 플랜: ${planType} | 기능: ${options.feature || options.minPlan || 'check'}`,
    );

    // 1. 최소 플랜 체크
    if (options.minPlan) {
      const planOrder = { STARTER: 1, STANDARD: 2, PRO: 3, ENTERPRISE: 4 };
      if ((planOrder[planType] || 1) < (planOrder[options.minPlan] || 1)) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'PLAN_UPGRADE_REQUIRED',
          message: `이 기능은 ${options.minPlan} 플랜 이상에서 사용 가능합니다.`,
          currentPlan: planType,
          requiredPlan: options.minPlan,
          upgradeUrl: '/dashboard/settings',
        });
      }
    }

    // 2. 수량 제한 체크 (질문 수, 경쟁사 수 등)
    if (options.feature && options.countField) {
      const limit = (limits as any)[options.feature];
      if (limit !== undefined && limit !== -1) {
        const currentCount = (hospital._count as any)[options.countField] || 0;
        if (currentCount >= limit) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'PLAN_LIMIT_REACHED',
            message: `${planType} 플랜의 ${this.getFeatureName(options.feature)} 한도(${limit}개)에 도달했습니다. 업그레이드하세요.`,
            currentPlan: planType,
            feature: options.feature,
            currentCount,
            limit,
            upgradeUrl: '/dashboard/settings',
          });
        }
      }
    }

    // 3. Boolean 기능 체크
    if (options.feature && !options.countField && !options.requiredPlatform) {
      const allowed = (limits as any)[options.feature];
      if (allowed === false) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'FEATURE_NOT_AVAILABLE',
          message: `${this.getFeatureName(options.feature)} 기능은 ${planType} 플랜에서 사용할 수 없습니다.`,
          currentPlan: planType,
          feature: options.feature,
          upgradeUrl: '/dashboard/settings',
        });
      }
    }

    // 4. 크롤링 월간 횟수 체크
    if (options.feature === 'crawlsPerMonth') {
      const limit = limits.crawlsPerMonth;
      if (limit !== -1) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const crawlCount = await this.prisma.crawlJob.count({
          where: {
            hospitalId,
            startedAt: { gte: monthStart },
            status: { in: ['COMPLETED', 'RUNNING'] },
          },
        });

        if (crawlCount >= limit) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'MONTHLY_CRAWL_LIMIT',
            message: `이번 달 크롤링 횟수(${limit}회)를 모두 사용했습니다. 다음 달 1일에 초기화됩니다.`,
            currentPlan: planType,
            crawlsUsed: crawlCount,
            crawlsLimit: limit,
            upgradeUrl: '/dashboard/settings',
          });
        }

        // request에 남은 횟수 정보 추가 (응답에서 활용)
        request.planInfo = {
          planType,
          crawlsUsed: crawlCount,
          crawlsRemaining: limit - crawlCount,
        };
      }
    }

    // request에 플랜 정보 첨부 (다른 로직에서 활용)
    request.planLimits = limits;
    request.planType = planType;

    return true;
  }

  private getFeatureName(feature: string): string {
    const names: Record<string, string> = {
      maxPrompts: '모니터링 질문',
      maxCompetitors: '경쟁사',
      crawlsPerMonth: '월간 크롤링',
      exportEnabled: '데이터 내보내기',
      aiRecommendations: 'AI 추천',
      contentGap: 'Content Gap 분석',
      competitorAEO: '경쟁사 AEO 측정',
      platforms: 'AI 플랫폼',
    };
    return names[feature] || feature;
  }
}
