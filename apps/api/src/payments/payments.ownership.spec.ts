import { ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

function createService() {
  const prisma: any = {
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new PaymentsService(
    prisma,
    { get: jest.fn() } as any,
    { sendEmail: jest.fn() } as any,
    { validateCoupon: jest.fn() } as any,
  );
  return { service, prisma };
}

describe('PaymentsService — 결제 주문번호 소유권', () => {
  it('타 병원 주문번호는 Toss 결제 승인 전에 거부한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'payment-2', hospitalId: 'hospital-2', status: 'PENDING' });
    const fetchSpy = jest.spyOn(global, 'fetch');

    try {
      await expect(service.confirmPayment({
        paymentKey: 'pay', orderId: 'order', amount: 100, hospitalId: 'hospital-1', userId: 'user-1',
      })).rejects.toThrow(ForbiddenException);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('병원 ID가 없는 과거 결제도 다른 사용자에게는 Toss 승인 전에 거부한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'old-payment', hospitalId: null, userId: 'user-2', status: 'PENDING' });
    const fetchSpy = jest.spyOn(global, 'fetch');

    try {
      await expect(service.confirmPayment({
        paymentKey: 'pay', orderId: 'order', amount: 100, hospitalId: 'hospital-1', userId: 'user-1',
      })).rejects.toThrow(ForbiddenException);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('본인의 과거 결제는 승인하고 병원 ID를 연결한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'old-payment', hospitalId: null, userId: 'user-1', status: 'PENDING' });
    prisma.payment.update.mockResolvedValue({ id: 'old-payment', hospitalId: 'hospital-1', status: 'PENDING' });
    jest.spyOn(service as any, 'assertValidPaymentAmount').mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ paymentKey: 'pay', status: 'READY', totalAmount: 100 }),
    } as Response);

    try {
      await expect(service.confirmPayment({
        paymentKey: 'pay', orderId: 'order', amount: 100, hospitalId: 'hospital-1', userId: 'user-1',
      })).resolves.toMatchObject({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'old-payment', hospitalId: null, userId: 'user-1' },
        data: expect.objectContaining({ hospitalId: 'hospital-1', userId: 'user-1' }),
      }));
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('타 병원 주문번호로 기존 결제를 저장하거나 수정하지 못한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'payment-2', hospitalId: 'hospital-2' });

    await expect(service.savePaymentFromFrontend(
      { paymentKey: 'pay', orderId: 'order', status: 'READY' }, 'hospital-1', 'user-1',
    )).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('병원 ID가 없는 과거 결제라도 사용자 ID가 다르면 저장하지 못한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'old-payment', hospitalId: null, userId: 'user-2' });

    await expect(service.savePaymentFromFrontend(
      { paymentKey: 'pay', orderId: 'order', status: 'READY' }, 'hospital-1', 'user-1',
    )).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('본인의 과거 결제 저장 시 병원 ID를 연결한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'old-payment', hospitalId: null, userId: 'user-1' });
    prisma.payment.update.mockResolvedValue({ id: 'old-payment', hospitalId: 'hospital-1', status: 'PENDING' });

    await service.savePaymentFromFrontend(
      { paymentKey: 'pay', orderId: 'order', status: 'READY' }, 'hospital-1', 'user-1',
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-payment', hospitalId: null, userId: 'user-1' },
      data: expect.objectContaining({ hospitalId: 'hospital-1', userId: 'user-1' }),
    }));
  });

  it('승인 중 재조회에서 다른 사용자의 과거 주문번호가 발견되어도 덮어쓰지 않는다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'old-payment', hospitalId: null, userId: 'user-2' });

    await expect((service as any).savePaymentResult(
      'order', 'pay', { status: 'READY', totalAmount: 100 }, 'hospital-1', 'user-1',
    )).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('자기 병원 주문번호는 병원 조건을 건 수정만 허용한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue({ id: 'payment-1', hospitalId: 'hospital-1' });
    prisma.payment.update.mockResolvedValue({ id: 'payment-1', status: 'PENDING' });

    await service.savePaymentFromFrontend(
      { paymentKey: 'pay', orderId: 'order', status: 'READY' }, 'hospital-1', 'user-1',
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-1', hospitalId: 'hospital-1' },
    }));
  });

  it('새 결제는 인증된 병원과 사용자에게 귀속한다', async () => {
    const { service, prisma } = createService();
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'payment-1', status: 'PENDING' });

    await service.savePaymentFromFrontend(
      { paymentKey: 'pay', orderId: 'order', status: 'READY' }, 'hospital-1', 'user-1',
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hospitalId: 'hospital-1', userId: 'user-1' }),
    }));
  });
});
