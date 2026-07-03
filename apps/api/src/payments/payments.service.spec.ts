/**
 * PaymentsService 핵심 유닛 테스트 — 돈 계산/매핑/자동갱신
 *
 * 범위 (외부 API 호출 없는 순수 로직만):
 *  - mapTossStatus: 토스 결제 상태 → 내부 PaymentStatus 매핑
 *  - extractPlanFromOrderId: orderId에서 플랜 추출
 *  - getSubscriptionStatus: 활성/만료 판정 + 남은 일수 계산
 *  - processAutoRenewals: 플랜별 갱신 금액 + 성공/실패 집계
 */
import { PaymentsService } from './payments.service';

// ── 헬퍼: private 의존성 최소 mock으로 인스턴스 생성 ──
function createService(prismaOverrides: any = {}) {
  const prisma: any = {
    subscription: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    payment: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    hospital: { update: jest.fn(), findUnique: jest.fn() },
    ...prismaOverrides,
  };
  const configService: any = { get: jest.fn() };
  const emailService: any = { sendEmail: jest.fn() };
  const couponsService: any = { validateCoupon: jest.fn() };
  const service = new PaymentsService(prisma, configService, emailService, couponsService);
  return { service, prisma, couponsService };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('PaymentsService — 돈 계산/매핑 핵심 로직', () => {
  // ─────────────────────────────────────────────
  // mapTossStatus
  // ─────────────────────────────────────────────
  describe('mapTossStatus (토스 상태 매핑)', () => {
    const { service } = createService();
    const map = (s: string) => (service as any).mapTossStatus(s);

    it('DONE → DONE (결제 완료)', () => {
      expect(map('DONE')).toBe('DONE');
    });

    it('READY/IN_PROGRESS/WAITING_FOR_DEPOSIT → PENDING', () => {
      expect(map('READY')).toBe('PENDING');
      expect(map('IN_PROGRESS')).toBe('PENDING');
      expect(map('WAITING_FOR_DEPOSIT')).toBe('PENDING');
    });

    it('CANCELED/PARTIAL_CANCELED/EXPIRED/ABORTED 매핑', () => {
      expect(map('CANCELED')).toBe('CANCELED');
      expect(map('PARTIAL_CANCELED')).toBe('PARTIAL_CANCELED');
      expect(map('EXPIRED')).toBe('EXPIRED');
      expect(map('ABORTED')).toBe('FAILED');
    });

    it('알 수 없는 상태는 PENDING으로 안전 처리', () => {
      expect(map('SOMETHING_NEW')).toBe('PENDING');
    });
  });

  // ─────────────────────────────────────────────
  // extractPlanFromOrderId
  // ─────────────────────────────────────────────
  describe('extractPlanFromOrderId (orderId → 플랜)', () => {
    const { service } = createService();
    const extract = (id: string) => (service as any).extractPlanFromOrderId(id);

    it('정상 orderId에서 플랜 추출 (PS_{PLAN}_{ts}_{rand})', () => {
      expect(extract('PS_STARTER_1711234567890_abc123')).toBe('STARTER');
      expect(extract('PS_STANDARD_1711234567890_xyz')).toBe('STANDARD');
      expect(extract('PS_PRO_1711234567890_q1w2')).toBe('PRO');
    });

    it('소문자 플랜도 대문자로 정규화하여 추출', () => {
      expect(extract('PS_standard_1711234567890_x')).toBe('STANDARD');
    });

    it('AUTO 결제 orderId는 STARTER 기본값', () => {
      expect(extract('PS_AUTO_1711234567890_r4nd')).toBe('STARTER');
    });

    it('형식이 깨진 orderId는 STARTER 기본값 (돈 사고 방지 안전망)', () => {
      expect(extract('random-garbage')).toBe('STARTER');
      expect(extract('PS_UNKNOWNPLAN_123_x')).toBe('STARTER');
    });
  });

  // ─────────────────────────────────────────────
  // getSubscriptionStatus — 활성 판정 + 남은 일수
  // ─────────────────────────────────────────────
  describe('getSubscriptionStatus (구독 활성 판정)', () => {
    it('구독이 없으면 hasSubscription=false', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue(null);
      const result = await service.getSubscriptionStatus('h1');
      expect(result).toEqual({ hasSubscription: false });
    });

    it('기간 내 ACTIVE 구독은 isActive=true, 남은 일수 올림 계산', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 10.5 * DAY_MS),
      });
      const result = await service.getSubscriptionStatus('h1');
      expect(result.isActive).toBe(true);
      expect(result.daysRemaining).toBe(11); // Math.ceil(10.5)
    });

    it('TRIAL 상태도 기간 내면 활성', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'TRIAL',
        currentPeriodEnd: new Date(Date.now() + 3 * DAY_MS),
      });
      const result = await service.getSubscriptionStatus('h1');
      expect(result.isActive).toBe(true);
    });

    it('기간이 지난 구독은 isActive=false', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 1 * DAY_MS),
      });
      const result = await service.getSubscriptionStatus('h1');
      expect(result.isActive).toBe(false);
    });

    it('CANCELED 상태는 기간이 남아도 비활성', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findFirst.mockResolvedValue({
        status: 'CANCELED',
        currentPeriodEnd: new Date(Date.now() + 10 * DAY_MS),
      });
      const result = await service.getSubscriptionStatus('h1');
      expect(result.isActive).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // processAutoRenewals — 플랜별 갱신 금액 (돈 계산의 핵심)
  // ─────────────────────────────────────────────
  describe('processAutoRenewals (자동 갱신 금액)', () => {
    function setupRenewal(planType: string) {
      const { service, prisma } = createService();
      prisma.subscription.findMany.mockResolvedValue([
        {
          hospitalId: 'h1',
          planType,
          billingKey: 'bk_test',
          customerKey: 'ck_test',
          hospital: { name: '테스트병원' },
        },
      ]);
      // 실제 결제 호출은 mock — 금액만 검증
      const chargeSpy = jest
        .spyOn(service, 'chargeBillingKey')
        .mockResolvedValue({ success: true } as any);
      return { service, chargeSpy };
    }

    it('STARTER 갱신 금액은 120,000원', async () => {
      const { service, chargeSpy } = setupRenewal('STARTER');
      const result = await service.processAutoRenewals();
      expect(chargeSpy).toHaveBeenCalledWith(expect.objectContaining({ amount: 120000 }));
      expect(result.successful).toBe(1);
    });

    it('STANDARD 갱신 금액은 290,000원', async () => {
      const { service, chargeSpy } = setupRenewal('STANDARD');
      await service.processAutoRenewals();
      expect(chargeSpy).toHaveBeenCalledWith(expect.objectContaining({ amount: 290000 }));
    });

    it('PRO 갱신 금액은 590,000원', async () => {
      const { service, chargeSpy } = setupRenewal('PRO');
      await service.processAutoRenewals();
      expect(chargeSpy).toHaveBeenCalledWith(expect.objectContaining({ amount: 590000 }));
    });

    it('결제 실패 시 failed로 집계되고 전체 프로세스는 계속됨', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findMany.mockResolvedValue([
        { hospitalId: 'h1', planType: 'STARTER', billingKey: 'bk1', customerKey: 'ck1', hospital: { name: 'A병원' } },
        { hospitalId: 'h2', planType: 'PRO', billingKey: 'bk2', customerKey: 'ck2', hospital: { name: 'B병원' } },
      ]);
      jest
        .spyOn(service, 'chargeBillingKey')
        .mockRejectedValueOnce(new Error('카드 한도 초과'))
        .mockResolvedValueOnce({ success: true } as any);

      const result = await service.processAutoRenewals();
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.successful).toBe(1);
    });

    it('갱신 대상이 없으면 processed=0', async () => {
      const { service, prisma } = createService();
      prisma.subscription.findMany.mockResolvedValue([]);
      const result = await service.processAutoRenewals();
      expect(result.processed).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // assertValidPaymentAmount — 【보안】 금액 ↔ 플랜 가격 검증
  // ─────────────────────────────────────────────
  describe('assertValidPaymentAmount (결제 금액 위조 방지)', () => {
    const call = (service: any, data: any) => (service as any).assertValidPaymentAmount(data);

    it('정가 결제는 통과 (STARTER 120,000원)', async () => {
      const { service } = createService();
      const result = await call(service, {
        orderId: 'PS_STARTER_123_abc',
        amount: 120000,
      });
      expect(result).toBeNull();
    });

    it('정가 결제는 통과 (PRO 590,000원)', async () => {
      const { service } = createService();
      const result = await call(service, {
        orderId: 'PS_PRO_123_abc',
        amount: 590000,
      });
      expect(result).toBeNull();
    });

    it('🔴 금액 조작 거부: 100원 내고 PRO 시도', async () => {
      const { service } = createService();
      await expect(
        call(service, { orderId: 'PS_PRO_123_abc', amount: 100 }),
      ).rejects.toThrow('결제 금액이 플랜 가격과 일치하지 않습니다');
    });

    it('🔴 쿠폰 없이 할인가 결제 거부', async () => {
      const { service } = createService();
      await expect(
        call(service, { orderId: 'PS_STANDARD_123_abc', amount: 200000 }),
      ).rejects.toThrow('결제 금액이 플랜 가격과 일치하지 않습니다');
    });

    it('유효한 쿠폰 할인가와 일치하면 통과', async () => {
      const { service, couponsService } = createService();
      couponsService.validateCoupon.mockResolvedValue({
        valid: true,
        coupon: { id: 'c1', code: 'LAUNCH50' },
        pricing: { finalPrice: 145000, discountAmount: 145000 },
      });

      const result = await call(service, {
        orderId: 'PS_STANDARD_123_abc',
        amount: 145000,
        couponCode: 'LAUNCH50',
        hospitalId: 'h1',
      });
      expect(result).not.toBeNull();
      expect(result.coupon.code).toBe('LAUNCH50');
      expect(couponsService.validateCoupon).toHaveBeenCalledWith('LAUNCH50', 'STANDARD', 'h1');
    });

    it('🔴 쿠폰 할인가와 불일치하면 거부', async () => {
      const { service, couponsService } = createService();
      couponsService.validateCoupon.mockResolvedValue({
        valid: true,
        coupon: { id: 'c1', code: 'LAUNCH50' },
        pricing: { finalPrice: 145000, discountAmount: 145000 },
      });

      await expect(
        call(service, {
          orderId: 'PS_STANDARD_123_abc',
          amount: 1000,
          couponCode: 'LAUNCH50',
          hospitalId: 'h1',
        }),
      ).rejects.toThrow('결제 금액이 쿠폰 할인가와 일치하지 않습니다');
    });

    it('🔴 FREE 플랜 orderId는 결제 자체 거부', async () => {
      const { service } = createService();
      await expect(
        call(service, { orderId: 'PS_FREE_123_abc', amount: 0 }),
      ).rejects.toThrow('결제할 수 없는 플랜');
    });
  });
});
