/**
 * SubscriptionsService 핵심 유닛 테스트 — 구독 생성/갱신/업그레이드
 *
 * 범위:
 *  - createSubscription: 7일 트라이얼 기간 계산
 *  - getSubscription: 트라이얼 남은 일수 / 결제 필요 여부 판정
 *  - upgradePlan: 플랜 순서 검증 (다운그레이드 차단)
 */
import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

function createService(prismaOverrides: any = {}) {
  const prisma: any = {
    subscription: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    hospital: { update: jest.fn(), findUnique: jest.fn() },
    couponRedemption: { findFirst: jest.fn().mockResolvedValue(null) },
    ...prismaOverrides,
  };
  const hospitalsService: any = { handlePlanUpgrade: jest.fn().mockResolvedValue({ addedPrompts: 0, newFeatures: [] }) };
  const emailService: any = { sendEmail: jest.fn() };
  const cacheService: any = { acquireLock: jest.fn().mockResolvedValue(true), getOrSet: jest.fn(), invalidateHospital: jest.fn() };
  const service = new SubscriptionsService(prisma, hospitalsService, emailService, cacheService);
  return { service, prisma, hospitalsService };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SubscriptionsService — 구독 갱신/트라이얼 핵심 로직', () => {
  // ─────────────────────────────────────────────
  // createSubscription — 7일 트라이얼
  // ─────────────────────────────────────────────
  describe('createSubscription (트라이얼 기간 계산)', () => {
    it('생성 시 TRIAL 상태로 정확히 7일 기간 설정', async () => {
      const { service, prisma } = createService();
      prisma.subscription.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: 's1', ...create }));

      const before = Date.now();
      await service.createSubscription({ hospitalId: 'h1', planType: 'STARTER', billingType: 'monthly' });
      const after = Date.now();

      const args = prisma.subscription.upsert.mock.calls[0][0];
      expect(args.create.status).toBe('TRIAL');
      const periodMs = args.create.currentPeriodEnd.getTime() - args.create.currentPeriodStart.getTime();
      // 7일 ±(호출 시간 오차)
      expect(periodMs).toBeGreaterThanOrEqual(7 * DAY_MS - (after - before) - 1000);
      expect(periodMs).toBeLessThanOrEqual(7 * DAY_MS + 1000);
    });

    it('병원 planType/subscriptionStatus도 동기화 업데이트', async () => {
      const { service, prisma } = createService();
      prisma.subscription.upsert.mockResolvedValue({ id: 's1' });
      await service.createSubscription({ hospitalId: 'h1', planType: 'STANDARD', billingType: 'monthly' });
      expect(prisma.hospital.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { planType: 'STANDARD', subscriptionStatus: 'TRIAL' },
      });
    });
  });

  // ─────────────────────────────────────────────
  // getSubscription — 트라이얼/결제 필요 판정
  // ─────────────────────────────────────────────
  describe('getSubscription (상태 판정)', () => {
    it('구독 없으면 FREE/NONE 기본값', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue(null);
      const result = await service.getSubscription('h1');
      expect(result).toEqual({ hasSubscription: false, status: 'NONE', planType: 'FREE' });
    });

    it('트라이얼 3일차: isInTrial=true, trialDaysRemaining 계산', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'TRIAL',
        planType: 'STARTER',
        currentPeriodStart: new Date(Date.now() - 3 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() + 4 * DAY_MS),
        cancelAtPeriodEnd: false,
        billingKey: null,
      });
      const result: any = await service.getSubscription('h1');
      expect(result.isInTrial).toBe(true);
      expect(result.needsPayment).toBe(true);
      expect(result.trialDaysRemaining).toBeGreaterThanOrEqual(3);
      expect(result.trialDaysRemaining).toBeLessThanOrEqual(4);
    });

    it('빌링키 없는 ACTIVE = 미결제 사용자 → needsPayment=true', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        planType: 'STARTER',
        currentPeriodStart: new Date(Date.now() - 30 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() + 5 * DAY_MS),
        cancelAtPeriodEnd: false,
        billingKey: null,
      });
      const result: any = await service.getSubscription('h1');
      expect(result.isUnpaidActive).toBe(true);
      expect(result.needsPayment).toBe(true);
    });

    it('빌링키 있는 ACTIVE는 결제 불필요', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        planType: 'PRO',
        currentPeriodStart: new Date(Date.now() - 40 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS),
        cancelAtPeriodEnd: false,
        billingKey: 'bk_live',
      });
      const result: any = await service.getSubscription('h1');
      expect(result.needsPayment).toBe(false);
      expect(result.hasBillingKey).toBe(true);
    });

    it('만료된 구독: isExpired=true, daysRemaining=0 (음수 방지)', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        planType: 'STARTER',
        currentPeriodStart: new Date(Date.now() - 60 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - 5 * DAY_MS),
        cancelAtPeriodEnd: false,
        billingKey: 'bk',
      });
      const result: any = await service.getSubscription('h1');
      expect(result.isExpired).toBe(true);
      expect(result.isActive).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // upgradePlan — 플랜 순서 검증
  // ─────────────────────────────────────────────
  describe('upgradePlan (다운그레이드 차단)', () => {
    it('상위 플랜으로는 업그레이드 성공 (STARTER → PRO)', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({ id: 's1', planType: 'STARTER' });
      const result = await service.upgradePlan('h1', 'PRO');
      expect(result.success).toBe(true);
      expect(result.previousPlan).toBe('STARTER');
      expect(result.newPlan).toBe('PRO');
    });

    it('같은 플랜으로 변경은 거부', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({ id: 's1', planType: 'STANDARD' });
      await expect(service.upgradePlan('h1', 'STANDARD')).rejects.toThrow(BadRequestException);
    });

    it('다운그레이드는 거부 (PRO → STARTER)', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({ id: 's1', planType: 'PRO' });
      await expect(service.upgradePlan('h1', 'STARTER')).rejects.toThrow(BadRequestException);
    });
  });
});
