import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanType, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HospitalsService } from '../hospitals/hospitals.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private hospitalsService: HospitalsService,
  ) {}

  /**
   * 구독 생성/활성화
   */
  async createSubscription(data: {
    hospitalId: string;
    planType: PlanType;
    billingType: 'monthly' | 'yearly';
    paymentId?: string;
  }) {
    this.logger.log(`구독 생성: hospitalId=${data.hospitalId}, plan=${data.planType}`);

    const now = new Date();
    const periodEnd = new Date(now);

    // 구독 기간 설정
    if (data.billingType === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 7일 무료 체험 추가
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const subscription = await this.prisma.subscription.upsert({
      where: { hospitalId: data.hospitalId },
      create: {
        hospitalId: data.hospitalId,
        planType: data.planType,
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethodId: data.paymentId,
      },
      update: {
        planType: data.planType,
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethodId: data.paymentId,
        cancelAtPeriodEnd: false,
      },
    });

    // 병원 정보 업데이트
    await this.prisma.hospital.update({
      where: { id: data.hospitalId },
      data: {
        planType: data.planType,
        subscriptionStatus: 'TRIAL',
      },
    });

    this.logger.log(`구독 생성 완료: subscriptionId=${subscription.id}`);

    return subscription;
  }

  /**
   * 구독 상태 조회
   */
  async getSubscription(hospitalId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        status: 'NONE',
        planType: 'FREE',
      };
    }

    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;
    const isActive = !isExpired && ['TRIAL', 'ACTIVE'].includes(subscription.status);
    const daysRemaining = Math.max(0, Math.ceil(
      (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // 체험 기간 남은 일수 계산
    const trialDaysUsed = Math.ceil(
      (now.getTime() - subscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isInTrial = subscription.status === 'TRIAL' && trialDaysUsed <= 7;

    return {
      hasSubscription: true,
      subscription,
      isActive,
      isExpired,
      isInTrial,
      trialDaysRemaining: isInTrial ? Math.max(0, 7 - trialDaysUsed) : 0,
      daysRemaining,
      planType: subscription.planType,
      status: subscription.status,
      willCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /**
   * 구독 취소 예약 (기간 종료 시 취소)
   */
  async cancelSubscription(hospitalId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
    });

    if (!subscription) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    this.logger.log(`구독 취소 예약: hospitalId=${hospitalId}`);

    return {
      success: true,
      message: `구독이 ${subscription.currentPeriodEnd.toLocaleDateString('ko-KR')}에 종료됩니다.`,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /**
   * 구독 취소 예약 철회
   */
  async reactivateSubscription(hospitalId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
    });

    if (!subscription) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
      },
    });

    this.logger.log(`구독 취소 철회: hospitalId=${hospitalId}`);

    return {
      success: true,
      message: '구독이 계속 유지됩니다.',
    };
  }

  /**
   * 플랜 업그레이드 - 추가 질문 자동 생성 + 경쟁사 조사 트리거
   */
  async upgradePlan(hospitalId: string, newPlan: PlanType) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
    });

    if (!subscription) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }

    // 플랜 순서 확인
    const planOrder = { FREE: 0, STARTER: 1, STANDARD: 2, PRO: 3, ENTERPRISE: 4 };
    if (planOrder[newPlan] <= planOrder[subscription.planType]) {
      throw new BadRequestException('현재 플랜보다 높은 플랜만 선택할 수 있습니다.');
    }

    const previousPlan = subscription.planType;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planType: newPlan,
      },
    });

    await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        planType: newPlan,
      },
    });

    this.logger.log(`플랜 업그레이드: hospitalId=${hospitalId}, ${previousPlan} -> ${newPlan}`);

    // ── 핵심: 업그레이드 후 추가 질문 생성 + 경쟁사 조사 트리거 ──
    let upgradeResult = null;
    try {
      upgradeResult = await this.hospitalsService.handlePlanUpgrade(
        hospitalId,
        previousPlan,
        newPlan,
      );
      this.logger.log(`[업그레이드 처리] 질문 +${upgradeResult.addedPrompts}, 신규기능 ${upgradeResult.newFeatures.length}개`);
    } catch (error) {
      this.logger.error(`[업그레이드 처리] 실패 (플랜 변경은 완료됨): ${error.message}`);
    }

    return {
      success: true,
      previousPlan,
      newPlan,
      upgrade: upgradeResult,
    };
  }

  /**
   * 체험 기간 종료 체크 (매일 실행)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkTrialExpirations() {
    this.logger.log('체험 기간 종료 체크 시작...');

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 체험 기간이 지난 구독 찾기
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        currentPeriodStart: {
          lte: sevenDaysAgo,
        },
      },
      include: {
        hospital: true,
      },
    });

    for (const subscription of expiredTrials) {
      // 체험 -> 활성 상태로 변경
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
        },
      });

      await this.prisma.hospital.update({
        where: { id: subscription.hospitalId },
        data: {
          subscriptionStatus: 'ACTIVE',
        },
      });

      this.logger.log(`체험 종료 -> 활성: hospitalId=${subscription.hospitalId}`);
    }

    this.logger.log(`체험 기간 체크 완료: ${expiredTrials.length}건 처리`);
  }

  /**
   * 구독 만료 체크 (매일 실행)
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkSubscriptionExpirations() {
    this.logger.log('구독 만료 체크 시작...');

    const now = new Date();

    // 만료된 구독 찾기
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: ['TRIAL', 'ACTIVE'],
        },
        currentPeriodEnd: {
          lte: now,
        },
      },
    });

    for (const subscription of expiredSubscriptions) {
      // 취소 예약된 경우 -> 만료 처리
      if (subscription.cancelAtPeriodEnd) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'EXPIRED',
          },
        });

        await this.prisma.hospital.update({
          where: { id: subscription.hospitalId },
          data: {
            subscriptionStatus: 'EXPIRED',
            planType: 'FREE', // 무료 플랜으로 다운그레이드
          },
        });

        this.logger.log(`구독 만료: hospitalId=${subscription.hospitalId}`);
      }
      // 자동 갱신인 경우 -> 결제 시도 필요 (현재는 수동 갱신)
    }

    this.logger.log(`구독 만료 체크 완료: ${expiredSubscriptions.length}건 처리`);
  }

  /**
   * 모든 구독 목록 조회 (관리자용)
   */
  async getAllSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hospital: {
            select: {
              id: true,
              name: true,
              specialtyType: true,
              regionSido: true,
              regionSigungu: true,
            },
          },
        },
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 플랜별 기능 제한 확인 (PlanGuard.PLAN_LIMITS와 동기화)
   */
  getPlanLimits(planType: PlanType) {
    // PlanGuard의 PLAN_LIMITS를 사용
    const { PlanGuard } = require('../common/guards/plan.guard');
    return PlanGuard.PLAN_LIMITS[planType] || PlanGuard.PLAN_LIMITS.FREE;
  }

  /**
   * 사용량 현황 조회 (프론트엔드 대시보드용)
   */
  async getUsage(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        planType: true,
        _count: {
          select: {
            prompts: true,
            competitors: true,
          },
        },
      },
    });

    if (!hospital) {
      return null;
    }

    const { PlanGuard } = require('../common/guards/plan.guard');
    const limits = PlanGuard.PLAN_LIMITS[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;

    // 이번 달 크롤링 횟수
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const crawlCount = await this.prisma.crawlJob.count({
      where: {
        hospitalId,
        startedAt: { gte: monthStart },
        status: { in: ['COMPLETED', 'RUNNING'] },
      },
    });

    // 오늘 실시간 질문 사용량
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const liveQueryCount = await this.prisma.liveQueryUsage.count({
      where: {
        hospitalId,
        usedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const maxDailyLiveQueries = (limits as any).maxDailyLiveQueries ?? 3;

    return {
      planType: hospital.planType,
      usage: {
        prompts: {
          used: hospital._count.prompts,
          limit: limits.maxPrompts,
          remaining: limits.maxPrompts === -1 ? -1 : Math.max(0, limits.maxPrompts - hospital._count.prompts),
        },
        competitors: {
          used: hospital._count.competitors,
          limit: limits.maxCompetitors,
          remaining: limits.maxCompetitors === -1 ? -1 : Math.max(0, limits.maxCompetitors - hospital._count.competitors),
        },
        crawls: {
          used: crawlCount,
          limit: limits.crawlsPerMonth,
          remaining: limits.crawlsPerMonth === -1 ? -1 : Math.max(0, limits.crawlsPerMonth - crawlCount),
        },
        liveQueries: {
          used: liveQueryCount,
          limit: maxDailyLiveQueries,
          remaining: maxDailyLiveQueries === -1 ? -1 : Math.max(0, maxDailyLiveQueries - liveQueryCount),
          isDaily: true,
        },
      },
      features: {
        platforms: limits.platforms,
        exportEnabled: limits.exportEnabled,
        aiRecommendations: limits.aiRecommendations,
        contentGap: limits.contentGap,
        competitorAEO: limits.competitorAEO,
      },
    };
  }
}
