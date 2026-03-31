import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PlanType, SubscriptionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HospitalsService } from '../hospitals/hospitals.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private hospitalsService: HospitalsService,
    private emailService: EmailService,
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
   * 
   * STARTER 트라이얼 만료 시:
   *   - 빌링키(자동결제)가 있으면 → ACTIVE 유지
   *   - 빌링키가 없으면 → FREE로 자동 다운그레이드
   * 
   * 쿠폰/결제 기반 트라이얼: → ACTIVE로 전환 (기존 동작)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkTrialExpirations() {
    this.logger.log('체험 기간 종료 체크 시작...');

    const now = new Date();

    // 트라이얼 기간이 만료된 구독 찾기 (currentPeriodEnd 기준)
    // ⚠️ ENTERPRISE 플랜은 절대 만료/다운그레이드하지 않음
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        planType: { not: 'ENTERPRISE' },
        currentPeriodEnd: {
          lte: now,
        },
      },
      include: {
        hospital: true,
      },
    });

    let downgraded = 0;
    let activated = 0;

    for (const subscription of expiredTrials) {
      // 자동결제(빌링키)가 있으면 → ACTIVE 유지 (유료 전환 성공)
      if (subscription.billingKey) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'ACTIVE' },
        });
        await this.prisma.hospital.update({
          where: { id: subscription.hospitalId },
          data: { subscriptionStatus: 'ACTIVE' },
        });
        activated++;
        this.logger.log(`트라이얼 → ACTIVE (빌링키 존재): hospitalId=${subscription.hospitalId}`);
        continue;
      }

      // 빌링키 없음 → FREE로 다운그레이드
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'EXPIRED',
          planType: 'FREE',
        },
      });

      await this.prisma.hospital.update({
        where: { id: subscription.hospitalId },
        data: {
          subscriptionStatus: 'EXPIRED',
          planType: 'FREE',
        },
      });

      // 경쟁사 비활성화 (FREE는 경쟁사 0개)
      await this.prisma.competitor.updateMany({
        where: { hospitalId: subscription.hospitalId },
        data: { isActive: false },
      });

      downgraded++;
      this.logger.log(`트라이얼 만료 → FREE 다운그레이드: hospitalId=${subscription.hospitalId}, 병원=${subscription.hospital?.name}`);
    }

    this.logger.log(`체험 기간 체크 완료: 총 ${expiredTrials.length}건 (활성화 ${activated}, 다운그레이드 ${downgraded})`);
  }

  /**
   * 구독 만료 체크 (매일 실행)
   * 쿠폰/결제 기반 구독이 만료되면 FREE로 다운그레이드
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkSubscriptionExpirations() {
    this.logger.log('구독 만료 체크 시작...');

    const now = new Date();

    // 만료된 구독 찾기 (TRIAL은 checkTrialExpirations에서 처리)
    // ⚠️ ENTERPRISE 플랜은 절대 만료/다운그레이드하지 않음
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        planType: { not: 'ENTERPRISE' },
        currentPeriodEnd: {
          lte: now,
        },
      },
    });

    for (const subscription of expiredSubscriptions) {
      // 자동갱신(빌링키) 있는 경우 → payments.service에서 자동결제 처리
      if (subscription.billingKey && subscription.autoRenewal) {
        this.logger.log(`자동갱신 대상 (빌링키 존재): hospitalId=${subscription.hospitalId}`);
        continue;
      }

      // 취소 예약 또는 빌링키 없는 경우 → 만료 처리
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'EXPIRED',
          planType: 'FREE',
        },
      });

      await this.prisma.hospital.update({
        where: { id: subscription.hospitalId },
        data: {
          subscriptionStatus: 'EXPIRED',
          planType: 'FREE',
        },
      });

      // 경쟁사 비활성화 (FREE는 경쟁사 0개)
      await this.prisma.competitor.updateMany({
        where: { hospitalId: subscription.hospitalId },
        data: { isActive: false },
      });

      this.logger.log(`구독 만료 → FREE 다운그레이드: hospitalId=${subscription.hospitalId}`);
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

  // ==================== A1: 트라이얼 만료 전 전환 유도 (D-3, D-1, D-day) ====================

  /**
   * 매일 오전 9시(KST=00:00 UTC) 실행
   * 트라이얼 만료 3일 전, 1일 전, 당일에 전환 유도 이메일 발송
   */
  @Cron('0 0 * * *') // 매일 00:00 UTC = 09:00 KST
  async sendTrialConversionReminders() {
    this.logger.log('[A1] 트라이얼 전환 유도 알림 크론 시작...');
    const now = new Date();

    // TRIAL 상태 + ENTERPRISE 제외 + 빌링키 없는 구독 조회
    const trialSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        planType: { not: 'ENTERPRISE' },
        billingKey: null,
      },
      include: {
        hospital: {
          include: {
            users: { where: { role: 'OWNER' }, select: { email: true, name: true } },
          },
        },
      },
    });

    let sent = 0;
    for (const sub of trialSubs) {
      const daysRemaining = Math.ceil(
        (sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // D-3, D-1, D-0만 발송
      if (![3, 1, 0].includes(daysRemaining)) continue;

      const owner = sub.hospital?.users?.[0];
      if (!owner?.email) continue;

      // 이 병원의 성과 데이터 수집 (있으면)
      let mentionRate: number | undefined;
      let abhsScore: number | undefined;
      try {
        const recentScore = await this.prisma.dailyScore.findFirst({
          where: { hospitalId: sub.hospitalId },
          orderBy: { scoreDate: 'desc' },
        });
        if (recentScore) {
          abhsScore = recentScore.abhsScore ?? undefined;
          mentionRate = recentScore.overallScore ?? undefined;
        }
      } catch {}

      await this.emailService.sendTrialConversionEmail(
        owner.email,
        owner.name || '원장님',
        {
          hospitalName: sub.hospital?.name || '',
          daysRemaining,
          mentionRate,
          abhsScore,
        },
      );
      sent++;
    }
    this.logger.log(`[A1] 트라이얼 전환 유도 알림 완료: ${sent}건 발송`);
  }

  // ==================== A3: 이탈 위험 자동 감지 & 리마인드 ====================

  /**
   * 매일 오전 10시(KST=01:00 UTC) 실행
   * 3일, 7일 미접속 유저에게 리마인드 이메일 발송
   */
  @Cron('0 1 * * *') // 매일 01:00 UTC = 10:00 KST
  async sendInactivityReminders() {
    this.logger.log('[A3] 이탈 위험 리마인드 크론 시작...');

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 3일 또는 7일 미접속 + 유료 구독 활성 상태인 유저
    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        role: 'OWNER',
        hospital: {
          subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
          planType: { not: 'FREE' },
        },
        OR: [
          { lastLoginAt: { lte: threeDaysAgo, gte: sevenDaysAgo } }, // 3~7일 미접속
          { lastLoginAt: { lte: sevenDaysAgo } },                     // 7일+ 미접속
          { lastLoginAt: null },                                       // 한번도 접속 안함
        ],
      },
      select: {
        email: true,
        name: true,
        lastLoginAt: true,
        hospital: {
          select: { id: true, name: true },
        },
      },
    });

    let sent = 0;
    for (const user of inactiveUsers) {
      if (!user.email || !user.hospital) continue;

      const daysSinceLogin = user.lastLoginAt
        ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // 정확히 3일 또는 7일인 경우만 발송 (매일 보내지 않도록)
      if (daysSinceLogin !== 3 && daysSinceLogin !== 7) continue;

      // 최근 점수 데이터
      let recentMentionRate: number | undefined;
      try {
        const score = await this.prisma.dailyScore.findFirst({
          where: { hospitalId: user.hospital.id },
          orderBy: { scoreDate: 'desc' },
        });
        recentMentionRate = score?.overallScore ?? undefined;
      } catch {}

      await this.emailService.sendInactivityReminderEmail(
        user.email,
        user.name || '원장님',
        {
          hospitalName: user.hospital.name,
          daysSinceLogin,
          recentMentionRate,
        },
      );
      sent++;
    }
    this.logger.log(`[A3] 이탈 리마인드 완료: ${sent}건 발송`);
  }

  // ==================== B1: 주간 AI 리포트 자동 발송 ====================

  /**
   * 매주 월요일 오전 9시(KST=00:00 UTC) 실행
   * 활성 구독 병원 원장님에게 주간 리포트 이메일 발송
   */
  @Cron('0 0 * * 1') // 매주 월요일 00:00 UTC = 09:00 KST
  async sendWeeklyReportEmails() {
    this.logger.log('[B1] 주간 리포트 이메일 발송 크론 시작...');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 활성 구독 병원 (FREE 제외)
    const hospitals = await this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
        planType: { not: 'FREE' },
      },
      include: {
        users: { where: { role: 'OWNER' }, select: { email: true, name: true } },
      },
    });

    let sent = 0;
    for (const hospital of hospitals) {
      const owner = hospital.users?.[0];
      if (!owner?.email) continue;

      try {
        // 이번 주 점수
        const thisWeekScores = await this.prisma.dailyScore.findMany({
          where: { hospitalId: hospital.id, scoreDate: { gte: weekAgo } },
          orderBy: { scoreDate: 'desc' },
        });

        // 지난 주 점수 (비교용)
        const lastWeekScores = await this.prisma.dailyScore.findMany({
          where: { hospitalId: hospital.id, scoreDate: { gte: twoWeeksAgo, lt: weekAgo } },
        });

        if (thisWeekScores.length === 0) continue;

        const avgAbhs = Math.round(thisWeekScores.reduce((s, d) => s + (d.abhsScore || 0), 0) / thisWeekScores.length);
        const avgMention = Math.round(thisWeekScores.reduce((s, d) => s + (d.overallScore || 0), 0) / thisWeekScores.length);

        const lastAvgAbhs = lastWeekScores.length > 0
          ? Math.round(lastWeekScores.reduce((s, d) => s + (d.abhsScore || 0), 0) / lastWeekScores.length)
          : avgAbhs;
        const lastAvgMention = lastWeekScores.length > 0
          ? Math.round(lastWeekScores.reduce((s, d) => s + (d.overallScore || 0), 0) / lastWeekScores.length)
          : avgMention;

        // 플랫폼별 성과 (최신 점수 기준)
        const latest = thisWeekScores[0];
        const platformData: Record<string, number> = {};
        try {
          const latestResponses = await this.prisma.aIResponse.findMany({
            where: { hospitalId: hospital.id, createdAt: { gte: weekAgo } },
            select: { aiPlatform: true, isMentioned: true },
          });
          const platformGroups = new Map<string, { total: number; mentioned: number }>();
          for (const r of latestResponses) {
            if (!platformGroups.has(r.aiPlatform)) platformGroups.set(r.aiPlatform, { total: 0, mentioned: 0 });
            const g = platformGroups.get(r.aiPlatform)!;
            g.total++;
            if (r.isMentioned) g.mentioned++;
          }
          for (const [p, g] of platformGroups) {
            platformData[p] = g.total > 0 ? Math.round((g.mentioned / g.total) * 100) : 0;
          }
        } catch {}

        const platformEntries = Object.entries(platformData).sort((a, b) => b[1] - a[1]);
        const platformNames: Record<string, string> = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', PERPLEXITY: 'Perplexity', GEMINI: 'Gemini' };

        // 크롤링 횟수
        const totalCrawls = await this.prisma.crawlJob.count({
          where: { hospitalId: hospital.id, startedAt: { gte: weekAgo }, status: 'COMPLETED' },
        });

        await this.emailService.sendWeeklyReportEmail(
          owner.email,
          owner.name || '원장님',
          {
            hospitalName: hospital.name,
            abhsScore: avgAbhs,
            abhsChange: avgAbhs - lastAvgAbhs,
            mentionRate: avgMention,
            mentionRateChange: avgMention - lastAvgMention,
            topPlatform: platformNames[platformEntries[0]?.[0]] || 'N/A',
            topPlatformRate: platformEntries[0]?.[1] || 0,
            weakPlatform: platformNames[platformEntries[platformEntries.length - 1]?.[0]] || 'N/A',
            weakPlatformRate: platformEntries[platformEntries.length - 1]?.[1] || 0,
            totalCrawls,
            periodStart: weekAgo.toLocaleDateString('ko-KR'),
            periodEnd: now.toLocaleDateString('ko-KR'),
          },
        );
        sent++;
      } catch (err) {
        this.logger.error(`[B1] ${hospital.name} 주간 리포트 실패: ${err.message}`);
      }
    }
    this.logger.log(`[B1] 주간 리포트 발송 완료: ${sent}건`);
  }

  // ==================== B2: 경쟁사 변동 알림 ====================

  /**
   * 매일 오후 6시(KST=09:00 UTC) 실행
   * 일일 크롤링 후 경쟁사 점수 5점 이상 변동 감지 → 이메일 알림
   */
  @Cron('0 9 * * *') // 매일 09:00 UTC = 18:00 KST
  async checkCompetitorChanges() {
    this.logger.log('[B2] 경쟁사 변동 감지 크론 시작...');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // 경쟁사가 있는 활성 병원 조회
    const hospitals = await this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
        planType: { notIn: ['FREE', 'STARTER'] }, // STANDARD 이상만
        competitors: { some: { isActive: true } },
      },
      include: {
        users: { where: { role: 'OWNER' }, select: { email: true, name: true } },
        competitors: { where: { isActive: true }, select: { id: true, competitorName: true } },
      },
    });

    let alertsSent = 0;
    for (const hospital of hospitals) {
      const owner = hospital.users?.[0];
      if (!owner?.email || hospital.competitors.length === 0) continue;

      const significantChanges: Array<{
        competitorName: string;
        oldScore: number;
        newScore: number;
        change: number;
      }> = [];

      for (const comp of hospital.competitors) {
        try {
          // 최근 점수 (오늘/어제)
          const recentScore = await this.prisma.competitorScore.findFirst({
            where: { competitorId: comp.id, createdAt: { gte: yesterday } },
            orderBy: { createdAt: 'desc' },
          });
          // 이전 점수 (어제/그저께)
          const prevScore = await this.prisma.competitorScore.findFirst({
            where: { competitorId: comp.id, createdAt: { gte: twoDaysAgo, lt: yesterday } },
            orderBy: { createdAt: 'desc' },
          });

          if (recentScore && prevScore) {
            const recentVal = recentScore.overallScore ?? 0;
            const prevVal = prevScore.overallScore ?? 0;
            const change = recentVal - prevVal;

            if (Math.abs(change) >= 5) {
              significantChanges.push({
                competitorName: comp.competitorName,
                oldScore: prevVal,
                newScore: recentVal,
                change,
              });
            }
          }
        } catch {}
      }

      if (significantChanges.length > 0) {
        await this.emailService.sendCompetitorChangeEmail(
          owner.email,
          owner.name || '원장님',
          {
            hospitalName: hospital.name,
            changes: significantChanges,
          },
        );
        alertsSent++;
      }
    }
    this.logger.log(`[B2] 경쟁사 변동 알림 완료: ${alertsSent}건 발송`);
  }
}
