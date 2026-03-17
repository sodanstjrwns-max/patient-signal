import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanType } from '@prisma/client';

// 플랜별 가격 (Single Source of Truth)
export const PLAN_PRICES: Record<string, number> = {
  STARTER: 120000,     // 12만원/월
  STANDARD: 290000,    // 29만원/월
  PRO: 590000,         // 59만원/월
  ENTERPRISE: 0,       // 문의
};

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 쿠폰 코드 검증 (적용 전 미리보기)
   */
  async validateCoupon(code: string, planType: string, hospitalId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        redemptions: {
          where: { hospitalId },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('유효하지 않은 쿠폰 코드입니다.');
    }

    // 활성 여부
    if (!coupon.isActive) {
      throw new BadRequestException('사용 중지된 쿠폰입니다.');
    }

    // 유효 기간
    const now = new Date();
    if (coupon.startsAt > now) {
      throw new BadRequestException('아직 사용 기간이 아닌 쿠폰입니다.');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('만료된 쿠폰입니다.');
    }

    // 사용 횟수 제한
    if (coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) {
      throw new BadRequestException('모든 쿠폰이 소진되었습니다.');
    }

    // 유저당 사용 제한
    if (coupon.redemptions.length >= coupon.maxUsesPerUser) {
      throw new BadRequestException('이미 이 쿠폰을 사용하셨습니다.');
    }

    // 적용 가능 플랜 확인
    if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planType as PlanType)) {
      throw new BadRequestException(`이 쿠폰은 ${coupon.applicablePlans.join(', ')} 플랜에만 적용 가능합니다.`);
    }

    // 할인 금액 계산
    const originalPrice = PLAN_PRICES[planType] || 0;
    let discountAmount = 0;
    let freeMonths = 0;
    let finalPrice = originalPrice;

    switch (coupon.couponType) {
      case 'PERCENT_OFF':
        discountAmount = Math.floor(originalPrice * (coupon.discountPercent || 0) / 100);
        finalPrice = originalPrice - discountAmount;
        break;
      case 'AMOUNT_OFF':
        discountAmount = coupon.discountAmount || 0;
        finalPrice = Math.max(0, originalPrice - discountAmount);
        break;
      case 'FREE_PERIOD':
        freeMonths = coupon.freeMonths || 0;
        discountAmount = originalPrice * freeMonths; // 총 할인 금액 (표시용)
        finalPrice = 0; // 무료 기간 동안은 0원
        break;
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        couponType: coupon.couponType,
      },
      pricing: {
        originalPrice,
        discountAmount,
        freeMonths,
        finalPrice,
        planType,
      },
    };
  }

  /**
   * 쿠폰 적용 (구독 활성화)
   */
  async applyCoupon(data: {
    code: string;
    planType: string;
    userId: string;
    hospitalId: string;
  }) {
    // 검증
    const validation = await this.validateCoupon(data.code, data.planType, data.hospitalId);
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase().trim() },
    });

    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');

    const now = new Date();
    const freeMonths = validation.pricing.freeMonths;
    const periodEnd = new Date(now);

    if (freeMonths > 0) {
      // 무료 기간 설정
      periodEnd.setMonth(periodEnd.getMonth() + freeMonths);
    } else {
      // 일반 할인: 1개월 구독
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 트랜잭션으로 원자적 처리
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 쿠폰 사용 이력 기록
      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: data.userId,
          hospitalId: data.hospitalId,
          appliedPlan: data.planType as PlanType,
          discountAmount: validation.pricing.discountAmount,
          freeMonths,
        },
      });

      // 2. 쿠폰 사용 횟수 증가
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { currentUses: { increment: 1 } },
      });

      // 3. 구독 생성/업데이트
      const subscription = await tx.subscription.upsert({
        where: { hospitalId: data.hospitalId },
        create: {
          hospitalId: data.hospitalId,
          planType: data.planType as PlanType,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planType: data.planType as PlanType,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      // 4. 병원 플랜 업데이트
      await tx.hospital.update({
        where: { id: data.hospitalId },
        data: {
          planType: data.planType as PlanType,
          subscriptionStatus: 'ACTIVE',
        },
      });

      return { redemption, subscription };
    });

    this.logger.log(
      `쿠폰 적용 완료: ${coupon.code} → ${data.hospitalId} (${data.planType}, ${freeMonths}개월 무료)`,
    );

    return {
      success: true,
      message: freeMonths > 0
        ? `🎉 ${coupon.name} 적용! ${data.planType} 플랜 ${freeMonths}개월 무료 활성화`
        : `🎉 ${coupon.name} 적용! ${validation.pricing.discountAmount.toLocaleString()}원 할인`,
      subscription: {
        planType: data.planType,
        status: 'ACTIVE',
        periodEnd: result.subscription.currentPeriodEnd,
        freeMonths,
      },
    };
  }

  /**
   * 기본 쿠폰 시드 데이터
   */
  async seedCoupons() {
    const coupons = [
      {
        code: 'PF2026-ALLINONE',
        name: '올인원 수강생 쿠폰',
        description: '페이션트 퍼널 올인원 수강생 전용 - Starter 플랜 12개월 무료',
        couponType: 'FREE_PERIOD' as const,
        freeMonths: 12,
        applicablePlans: ['STARTER' as PlanType],
        maxUses: 500,     // 최대 500명
        maxUsesPerUser: 1,
        expiresAt: new Date('2027-03-31'),
      },
      {
        code: 'PF2026-VIP',
        name: 'VIP 원장 쿠폰',
        description: 'VIP 원장 전용 - Standard 플랜 3개월 무료',
        couponType: 'FREE_PERIOD' as const,
        freeMonths: 3,
        applicablePlans: ['STANDARD' as PlanType],
        maxUses: 50,
        maxUsesPerUser: 1,
        expiresAt: new Date('2026-12-31'),
      },
      {
        code: 'PF2026-EARLY',
        name: '얼리버드 할인',
        description: '얼리버드 50% 할인 - 모든 플랜',
        couponType: 'PERCENT_OFF' as const,
        discountPercent: 50,
        applicablePlans: [],  // 모든 플랜
        maxUses: 100,
        maxUsesPerUser: 1,
        expiresAt: new Date('2026-06-30'),
      },
    ];

    const results = [];
    for (const coupon of coupons) {
      const result = await this.prisma.coupon.upsert({
        where: { code: coupon.code },
        create: coupon,
        update: {
          name: coupon.name,
          description: coupon.description,
          maxUses: coupon.maxUses,
          expiresAt: coupon.expiresAt,
        },
      });
      results.push(result);
    }

    return {
      created: results.length,
      coupons: results.map((c) => ({ code: c.code, name: c.name })),
    };
  }

  /**
   * 쿠폰 목록 조회 (관리자)
   */
  async listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });
  }

  /**
   * 쿠폰 생성 (관리자)
   */
  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }
}
