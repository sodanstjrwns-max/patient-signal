import { ForbiddenException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';

const owner = { id: 'user-1', hospitalId: 'hospital-1' };

function createController() {
  const service = {
    issueBillingKey: jest.fn().mockResolvedValue({ success: true }),
    deleteBillingKey: jest.fn().mockResolvedValue({ success: true }),
    confirmPayment: jest.fn().mockResolvedValue({ success: true }),
    savePaymentFromFrontend: jest.fn().mockResolvedValue({ success: true }),
    getPayment: jest.fn(),
  };
  return { controller: new PaymentsController(service as any), service };
}

describe('PaymentsController — 병원별 결제 접근 권한', () => {
  it('타 병원 빌링키 발급은 서비스 호출 전에 차단한다', async () => {
    const { controller, service } = createController();
    await expect(controller.issueBillingKey({ authKey: 'auth', customerKey: 'customer', hospitalId: 'hospital-2' }, owner))
      .rejects.toThrow(ForbiddenException);
    expect(service.issueBillingKey).not.toHaveBeenCalled();
  });

  it('자기 병원 빌링키 발급은 허용한다', async () => {
    const { controller, service } = createController();
    const body = { authKey: 'auth', customerKey: 'customer', hospitalId: owner.hospitalId };
    await controller.issueBillingKey(body, owner);
    expect(service.issueBillingKey).toHaveBeenCalledWith(body);
  });

  it('타 병원 빌링키 삭제는 서비스 호출 전에 차단한다', async () => {
    const { controller, service } = createController();
    await expect(controller.deleteBillingKey({ hospitalId: 'hospital-2' }, owner))
      .rejects.toThrow(ForbiddenException);
    expect(service.deleteBillingKey).not.toHaveBeenCalled();
  });

  it('자기 병원 빌링키 삭제는 허용한다', async () => {
    const { controller, service } = createController();
    await controller.deleteBillingKey({ hospitalId: owner.hospitalId }, owner);
    expect(service.deleteBillingKey).toHaveBeenCalledWith(owner.hospitalId);
  });

  it('타 병원 결제 승인은 Toss 호출 전에 차단하고 JWT 사용자 ID만 전달한다', async () => {
    const { controller, service } = createController();
    const body = { paymentKey: 'pay', orderId: 'order', amount: 100, hospitalId: 'hospital-2', userId: 'forged' };
    await expect(controller.confirmPayment(body, owner)).rejects.toThrow(ForbiddenException);
    expect(service.confirmPayment).not.toHaveBeenCalled();

    await controller.confirmPayment({ ...body, hospitalId: owner.hospitalId }, owner);
    expect(service.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      hospitalId: owner.hospitalId,
      userId: owner.id,
    }));
  });

  it('병원 ID를 생략한 결제 승인은 로그인 병원으로 묶는다', async () => {
    const { controller, service } = createController();
    await controller.confirmPayment({ paymentKey: 'pay', orderId: 'order', amount: 100 }, owner);
    expect(service.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ hospitalId: owner.hospitalId }));
  });

  it('타 병원 결제 저장은 차단하고 자기 병원 저장은 서버의 사용자 ID를 전달한다', async () => {
    const { controller, service } = createController();
    const body = { paymentKey: 'pay', orderId: 'order', hospitalId: 'hospital-2', userId: 'forged' };
    await expect(controller.savePayment(body, owner)).rejects.toThrow(ForbiddenException);
    expect(service.savePaymentFromFrontend).not.toHaveBeenCalled();

    await controller.savePayment({ ...body, hospitalId: owner.hospitalId }, owner);
    expect(service.savePaymentFromFrontend).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalId: owner.hospitalId }), owner.hospitalId, owner.id,
    );
  });

  it('주문번호를 통한 타 병원 결제 조회도 차단한다', async () => {
    const { controller, service } = createController();
    service.getPayment.mockResolvedValue({ id: 'payment-2', hospitalId: 'hospital-2' });
    await expect(controller.getPayment('order-2', owner)).rejects.toThrow(ForbiddenException);

    service.getPayment.mockResolvedValue({ id: 'payment-1', hospitalId: owner.hospitalId });
    await expect(controller.getPayment('order-1', owner)).resolves.toMatchObject({ id: 'payment-1' });
  });
});
