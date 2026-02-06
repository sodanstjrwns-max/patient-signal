import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanType, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

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
        planType: 'STARTER',
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
   * 플랜 업그레이드
   */
  async upgradePlan(hospitalId: string, newPlan: PlanType) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
    });

    if (!subscription) {
      throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
    }

    // 플랜 순서 확인
    const planOrder = { STARTER: 1, STANDARD: 2, PRO: 3, ENTERPRISE: 4 };
    if (planOrder[newPlan] <= planOrder[subscription.planType]) {
      throw new BadRequestException('현재 플랜보다 높은 플랜만 선택할 수 있습니다.');
    }

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

    this.logger.log(`플랜 업그레이드: hospitalId=${hospitalId}, ${subscription.planType} -> ${newPlan}`);

    return {
      success: true,
      previousPlan: subscription.planType,
      newPlan,
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
            planType: 'STARTER', // 기본 플랜으로 다운그레이드
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
   * 플랜별 기능 제한 확인
   */
  getPlanLimits(planType: PlanType) {
    const limits = {
      STARTER: {
        maxPrompts: 5,
        maxCompetitors: 2,
        platforms: ['CHATGPT', 'PERPLEXITY'],
        crawlFrequency: 'weekly',
        exportEnabled: false,
        aiRecommendations: false,
      },
      STANDARD: {
        maxPrompts: 20,
        maxCompetitors: 5,
        platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'],
        crawlFrequency: 'daily',
        exportEnabled: true,
        aiRecommendations: false,
      },
      PRO: {
        maxPrompts: 100,
        maxCompetitors: 20,
        platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'NAVER_CUE', 'GOOGLE_AI_OVERVIEW'],
        crawlFrequency: 'daily',
        exportEnabled: true,
        aiRecommendations: true,
      },
      ENTERPRISE: {
        maxPrompts: -1, // unlimited
        maxCompetitors: -1,
        platforms: ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'NAVER_CUE', 'GOOGLE_AI_OVERVIEW'],
        crawlFrequency: 'realtime',
        exportEnabled: true,
        aiRecommendations: true,
      },
    };

    return limits[planType] || limits.STARTER;
  }
}
