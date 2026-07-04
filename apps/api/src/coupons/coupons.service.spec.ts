/**
 * CouponsService — 동시성 안전(한도 초과 발급 방지) 유닛 테스트
 *
 * 배경: validateCoupon의 사전 체크는 read-then-write라 동시 요청이 겹치면
 * maxUses를 넘겨 발급될 수 있음. applyCoupon 트랜잭션 내부의
 * 조건부 updateMany(count=0 → 소진 롤백)가 이를 DB 레벨에서 차단하는지 검증.
 */
import { BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

function buildCoupon(overrides: any = {}) {
  return {
    id: 'c1',
    code: 'TEST50',
    name: '테스트쿠폰',
    description: null,
    couponType: 'PERCENT_OFF',
    discountPercent: 50,
    discountAmount: null,
    freeMonths: null,
    maxUses: 5,
    maxUsesPerUser: 1,
    currentUses: 0,
    isActive: true,
    startsAt: new Date(Date.now() - 1000),
    expiresAt: null,
    applicablePlans: [],
    redemptions: [],
    ...overrides,
  };
}

function createService(couponOverrides: any = {}, txOverrides: any = {}) {
  const coupon = buildCoupon(couponOverrides);
  const tx: any = {
    couponRedemption: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
    coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    subscription: { upsert: jest.fn().mockResolvedValue({ id: 's1', currentPeriodEnd: new Date() }) },
    hospital: { update: jest.fn().mockResolvedValue({}) },
    ...txOverrides,
  };
  const prisma: any = {
    coupon: {
      findUnique: jest.fn().mockResolvedValue(coupon),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
  };
  const service = new CouponsService(prisma);
  return { service, prisma, tx, coupon };
}

describe('CouponsService — 쿠폰 한도 동시성 안전', () => {
  const applyData = { code: 'TEST50', planType: 'STANDARD', userId: 'u1', hospitalId: 'h1' };

  it('정상 적용: 조건부 updateMany가 한도 조건을 포함해 호출됨', async () => {
    const { service, tx } = createService();

    const result = await service.applyCoupon(applyData);

    expect(result.success).toBe(true);
    const where = tx.coupon.updateMany.mock.calls[0][0].where;
    // WHERE에 한도 조건(currentUses < maxUses)이 반드시 포함 — DB 레벨 초과 차단의 핵심
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentUses: expect.objectContaining({ lt: 5 }) }),
      ]),
    );
  });

  it('동시 요청으로 한도 소진(updateMany count=0) 시 롤백 예외 발생', async () => {
    const { service, tx } = createService({}, {
      coupon: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    });

    await expect(service.applyCoupon(applyData)).rejects.toThrow(BadRequestException);
    // 트랜잭션 내부에서 던졌으므로 redemption create는 호출됐어도 롤백됨 (Prisma 시맨틱)
    expect(tx.coupon.updateMany).toHaveBeenCalled();
  });

  it('무제한 쿠폰(maxUses=0)은 한도 조건 없이 통과 (OR에 lte:0 조건 포함)', async () => {
    const { service, tx } = createService({ maxUses: 0 });

    const result = await service.applyCoupon(applyData);

    expect(result.success).toBe(true);
    const where = tx.coupon.updateMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ maxUses: expect.objectContaining({ lte: 0 }) }),
      ]),
    );
  });

  it('사전 검증 단계에서 이미 소진된 쿠폰은 즉시 거부', async () => {
    const { service } = createService({ maxUses: 5, currentUses: 5 });

    await expect(service.applyCoupon(applyData)).rejects.toThrow('모든 쿠폰이 소진되었습니다.');
  });

  it('같은 병원 재사용은 사전 검증에서 거부 (maxUsesPerUser)', async () => {
    const { service } = createService({ redemptions: [{ id: 'prev' }] });

    await expect(service.applyCoupon(applyData)).rejects.toThrow('이미 이 쿠폰을 사용하셨습니다.');
  });
});
