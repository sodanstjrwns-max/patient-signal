import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentStatus, PlanType } from '@prisma/client';

interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  approvedAt: string;
  receipt: { url: string };
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
  };
  virtualAccount?: {
    bank: string;
    accountNumber: string;
    dueDate: string;
    customerName: string;
  };
  easyPay?: {
    provider: string;
  };
  transfer?: {
    bank: string;
  };
}

interface TossBillingResponse {
  billingKey: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  card: {
    company: string;
    number: string;
    cardType: string;
    ownerType: string;
    issuerCode: string;
    acquirerCode: string;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string;
  private readonly tossApiUrl = 'https://api.tosspayments.com/v1';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.secretKey = process.env.TOSS_SECRET_KEY || '';
  }

  /**
   * 결제 승인 요청
   */
  async confirmPayment(data: TossPaymentConfirmRequest): Promise<any> {
    this.logger.log(`결제 승인 요청: orderId=${data.orderId}, amount=${data.amount}`);

    // 1. 기존 결제 정보 확인
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId: data.orderId },
    });

    if (existingPayment && existingPayment.status === 'DONE') {
      throw new BadRequestException('이미 처리된 결제입니다.');
    }

    // 2. 토스페이먼츠 결제 승인 API 호출
    const authHeader = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await fetch(`${this.tossApiUrl}/payments/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey: data.paymentKey,
          orderId: data.orderId,
          amount: data.amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`토스 결제 승인 실패: ${JSON.stringify(result)}`);
        
        // 실패 시 DB에 기록
        await this.savePaymentResult(data.orderId, data.paymentKey, {
          status: 'FAILED',
          failReason: result.message || '결제 승인 실패',
        });

        throw new BadRequestException(result.message || '결제 승인에 실패했습니다.');
      }

      this.logger.log(`토스 결제 승인 성공: paymentKey=${result.paymentKey}`);

      // 3. 결제 정보 DB 저장
      const payment = await this.savePaymentResult(data.orderId, data.paymentKey, result);

      // 4. 구독 정보 업데이트 (결제 완료 시)
      if (result.status === 'DONE') {
        await this.activateSubscription(payment);
      }

      return {
        success: true,
        payment,
        receiptUrl: result.receipt?.url,
      };
    } catch (error) {
      this.logger.error(`결제 승인 에러: ${error.message}`);
      throw error;
    }
  }

  /**
   * 결제 결과 DB 저장
   */
  private async savePaymentResult(
    orderId: string,
    paymentKey: string,
    result: any,
  ) {
    // orderId에서 플랜 정보 추출 (metadata로 처리 권장)
    const planType = this.extractPlanFromOrderId(orderId);
    const billingType = 'monthly'; // 기본값

    const paymentData = {
      paymentKey,
      amount: result.totalAmount || 0,
      status: this.mapTossStatus(result.status),
      method: this.mapTossMethod(result.method),
      planType,
      billingType,
      approvedAt: result.approvedAt ? new Date(result.approvedAt) : null,
      receiptUrl: result.receipt?.url,
      transactionKey: result.transactionKey,
      virtualAccount: result.virtualAccount || null,
      cardInfo: result.card || null,
      easyPayInfo: result.easyPay || null,
      failReason: result.failReason || null,
    };

    return this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        ...paymentData,
      },
      update: paymentData,
    });
  }

  /**
   * 구독 활성화
   */
  private async activateSubscription(payment: any) {
    if (!payment.hospitalId) {
      this.logger.warn('hospitalId가 없어서 구독 활성화를 건너뜁니다.');
      return;
    }

    const now = new Date();
    const periodEnd = new Date();
    
    // 7일 무료 체험 + 구독 기간
    if (payment.billingType === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    
    // 7일 무료 체험 추가
    periodEnd.setDate(periodEnd.getDate() + 7);

    await this.prisma.subscription.upsert({
      where: {
        hospitalId: payment.hospitalId,
      },
      create: {
        hospitalId: payment.hospitalId,
        planType: payment.planType,
        status: 'TRIAL', // 7일 체험 시작
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethodId: payment.id,
      },
      update: {
        planType: payment.planType,
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethodId: payment.id,
      },
    });

    // 병원 플랜 업데이트
    await this.prisma.hospital.update({
      where: { id: payment.hospitalId },
      data: {
        planType: payment.planType,
        subscriptionStatus: 'TRIAL',
      },
    });

    this.logger.log(`구독 활성화 완료: hospitalId=${payment.hospitalId}, plan=${payment.planType}`);
  }

  /**
   * 웹훅 처리 (가상계좌 입금 등)
   */
  async handleWebhook(eventType: string, data: any): Promise<void> {
    this.logger.log(`웹훅 수신: ${eventType}`);
    this.logger.log(`웹훅 데이터: ${JSON.stringify(data)}`);

    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await this.handlePaymentStatusChanged(data);
        break;
      case 'DEPOSIT_CALLBACK':
        await this.handleVirtualAccountDeposit(data);
        break;
      case 'VIRTUAL_ACCOUNT_DEPOSIT':
        // 프론트엔드에서 전달받은 가상계좌 입금 완료
        await this.handleVirtualAccountDeposit(data);
        break;
      case 'PAYMENT_CANCELED':
        // 결제 취소 처리
        await this.handlePaymentCanceled(data);
        break;
      default:
        this.logger.warn(`알 수 없는 웹훅 이벤트: ${eventType}`);
    }
  }

  /**
   * 결제 취소 처리
   */
  private async handlePaymentCanceled(data: any) {
    this.logger.log(`결제 취소 처리: orderId=${data.orderId}`);

    const payment = await this.prisma.payment.findUnique({
      where: { orderId: data.orderId },
    });

    if (!payment) {
      this.logger.warn(`결제를 찾을 수 없음: orderId=${data.orderId}`);
      return;
    }

    // 결제 상태 업데이트
    await this.prisma.payment.update({
      where: { orderId: data.orderId },
      data: {
        status: data.status === 'PARTIAL_CANCELED' ? 'PARTIAL_CANCELED' : 'CANCELED',
        failReason: data.cancelReason || '사용자 취소',
      },
    });

    // 구독 상태 업데이트 (있는 경우)
    if (payment.hospitalId) {
      await this.prisma.subscription.updateMany({
        where: { hospitalId: payment.hospitalId },
        data: {
          status: 'CANCELLED',
        },
      });

      await this.prisma.hospital.update({
        where: { id: payment.hospitalId },
        data: {
          subscriptionStatus: 'CANCELLED',
        },
      });
    }

    this.logger.log(`결제 취소 처리 완료: orderId=${data.orderId}`);
  }

  /**
   * 결제 상태 변경 처리
   */
  private async handlePaymentStatusChanged(data: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: data.orderId },
    });

    if (!payment) {
      this.logger.warn(`결제를 찾을 수 없음: orderId=${data.orderId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { orderId: data.orderId },
      data: {
        status: this.mapTossStatus(data.status),
      },
    });

    // 결제 완료 시 구독 활성화
    if (data.status === 'DONE') {
      await this.activateSubscription(payment);
    }
  }

  /**
   * 가상계좌 입금 처리
   */
  private async handleVirtualAccountDeposit(data: any) {
    this.logger.log(`가상계좌 입금 확인: orderId=${data.orderId}`);

    const payment = await this.prisma.payment.findUnique({
      where: { orderId: data.orderId },
    });

    if (!payment) {
      this.logger.warn(`결제를 찾을 수 없음: orderId=${data.orderId}`);
      return;
    }

    // 결제 상태 업데이트
    const updatedPayment = await this.prisma.payment.update({
      where: { orderId: data.orderId },
      data: {
        status: 'DONE',
        approvedAt: new Date(),
      },
    });

    // 구독 활성화
    await this.activateSubscription(updatedPayment);

    this.logger.log(`가상계좌 입금 완료 처리: orderId=${data.orderId}`);
  }

  /**
   * 프론트엔드에서 결제 승인 후 저장
   * (토스페이먼츠 API 응답 데이터를 그대로 저장)
   */
  async savePaymentFromFrontend(data: any): Promise<any> {
    this.logger.log(`프론트엔드 결제 저장: orderId=${data.orderId}, status=${data.status}`);

    const planType = this.extractPlanFromOrderId(data.orderId);
    const billingType = 'monthly'; // 기본값, metadata에서 추출 가능

    const paymentData = {
      paymentKey: data.paymentKey,
      amount: data.amount || 0,
      status: this.mapTossStatus(data.status),
      method: this.mapTossMethod(data.method),
      planType,
      billingType,
      approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
      receiptUrl: data.receipt?.url,
      virtualAccount: data.virtualAccount || null,
      cardInfo: data.card || null,
      easyPayInfo: data.easyPay || null,
      metadata: data.metadata || null,
    };

    const payment = await this.prisma.payment.upsert({
      where: { orderId: data.orderId },
      create: {
        orderId: data.orderId,
        ...paymentData,
      },
      update: paymentData,
    });

    this.logger.log(`결제 저장 완료: id=${payment.id}, status=${payment.status}`);

    // 결제 완료 시 알림 (가상계좌 입금 대기는 제외)
    if (data.status === 'DONE') {
      this.logger.log(`결제 완료! orderId=${data.orderId}`);
      // TODO: 결제 완료 이메일/카카오 알림 발송
    }

    return { success: true, payment };
  }

  /**
   * 결제 조회
   */
  async getPayment(orderId: string) {
    return this.prisma.payment.findUnique({
      where: { orderId },
    });
  }

  /**
   * 사용자 결제 목록 조회
   */
  async getPaymentsByUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 구독 상태 조회
   */
  async getSubscriptionStatus(hospitalId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { hospitalId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { hasSubscription: false };
    }

    const now = new Date();
    const isActive = subscription.currentPeriodEnd > now && 
                     ['TRIAL', 'ACTIVE'].includes(subscription.status);

    return {
      hasSubscription: true,
      subscription,
      isActive,
      daysRemaining: Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    };
  }

  // ==================== Helper Methods ====================

  private mapTossStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'READY': 'PENDING',
      'IN_PROGRESS': 'PENDING',
      'WAITING_FOR_DEPOSIT': 'PENDING',
      'DONE': 'DONE',
      'CANCELED': 'CANCELED',
      'PARTIAL_CANCELED': 'PARTIAL_CANCELED',
      'EXPIRED': 'EXPIRED',
      'ABORTED': 'FAILED',
    };
    return statusMap[status] || 'PENDING';
  }

  private mapTossMethod(method: string): any {
    const methodMap: Record<string, string> = {
      '카드': 'CARD',
      '가상계좌': 'VIRTUAL_ACCOUNT',
      '계좌이체': 'TRANSFER',
      '휴대폰': 'MOBILE_PHONE',
      '간편결제': 'EASY_PAY',
    };
    return methodMap[method] || null;
  }

  private extractPlanFromOrderId(orderId: string): PlanType {
    // orderId 형식: PS_{timestamp}_{random}
    // 기본값 STARTER 반환, 실제로는 메타데이터나 세션에서 가져오는 것이 좋음
    return 'STARTER';
  }

  // ==================== 빌링키 자동결제 ====================

  /**
   * 빌링키 발급 (카드 등록)
   * 프론트엔드에서 토스 빌링 위젯으로 인증 후 호출
   */
  async issueBillingKey(data: {
    authKey: string;
    customerKey: string;
    hospitalId: string;
  }): Promise<any> {
    this.logger.log(`빌링키 발급 요청: customerKey=${data.customerKey}`);

    const authHeader = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      // 토스페이먼츠 빌링키 발급 API
      const response = await fetch(`${this.tossApiUrl}/billing/authorizations/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authKey: data.authKey,
          customerKey: data.customerKey,
        }),
      });

      const result: TossBillingResponse = await response.json();

      if (!response.ok) {
        this.logger.error(`빌링키 발급 실패: ${JSON.stringify(result)}`);
        throw new BadRequestException((result as any).message || '빌링키 발급에 실패했습니다.');
      }

      this.logger.log(`빌링키 발급 성공: billingKey=${result.billingKey}`);

      // 구독 정보 업데이트 (빌링키 저장)
      await this.prisma.subscription.upsert({
        where: { hospitalId: data.hospitalId },
        create: {
          hospitalId: data.hospitalId,
          planType: 'STARTER',
          status: 'TRIAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 트라이얼
          billingKey: result.billingKey,
          customerKey: result.customerKey,
          cardLast4: result.card?.number?.slice(-4) || null,
          cardBrand: result.card?.company || null,
          autoRenewal: true,
          nextBillingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
        },
        update: {
          billingKey: result.billingKey,
          customerKey: result.customerKey,
          cardLast4: result.card?.number?.slice(-4) || null,
          cardBrand: result.card?.company || null,
          autoRenewal: true,
        },
      });

      return {
        success: true,
        billingKey: result.billingKey,
        card: {
          company: result.card?.company,
          last4: result.card?.number?.slice(-4),
        },
      };
    } catch (error) {
      this.logger.error(`빌링키 발급 에러: ${error.message}`);
      throw error;
    }
  }

  /**
   * 빌링키로 자동결제 실행
   */
  async chargeBillingKey(data: {
    billingKey: string;
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
    hospitalId: string;
  }): Promise<any> {
    this.logger.log(`빌링키 결제 요청: orderId=${data.orderId}, amount=${data.amount}`);

    const authHeader = Buffer.from(`${this.secretKey}:`).toString('base64');

    try {
      const response = await fetch(`${this.tossApiUrl}/billing/${data.billingKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': data.orderId, // 중복 결제 방지
        },
        body: JSON.stringify({
          customerKey: data.customerKey,
          amount: data.amount,
          orderId: data.orderId,
          orderName: data.orderName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`빌링키 결제 실패: ${JSON.stringify(result)}`);
        
        // 결제 실패 횟수 증가
        await this.prisma.subscription.update({
          where: { hospitalId: data.hospitalId },
          data: {
            failedBillingCount: { increment: 1 },
          },
        });

        // 결제 실패 기록
        await this.prisma.payment.create({
          data: {
            orderId: data.orderId,
            hospitalId: data.hospitalId,
            amount: data.amount,
            status: 'FAILED',
            planType: 'STARTER',
            billingType: 'monthly',
            failReason: result.message || '자동결제 실패',
          },
        });

        throw new BadRequestException(result.message || '자동결제에 실패했습니다.');
      }

      this.logger.log(`빌링키 결제 성공: paymentKey=${result.paymentKey}`);

      // 결제 정보 저장
      const payment = await this.prisma.payment.create({
        data: {
          orderId: data.orderId,
          paymentKey: result.paymentKey,
          hospitalId: data.hospitalId,
          amount: result.totalAmount,
          status: 'DONE',
          method: 'CARD',
          planType: 'STARTER',
          billingType: 'monthly',
          approvedAt: new Date(result.approvedAt),
          receiptUrl: result.receipt?.url,
          cardInfo: result.card,
        },
      });

      // 구독 갱신
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await this.prisma.subscription.update({
        where: { hospitalId: data.hospitalId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
          lastBillingDate: now,
          nextBillingDate: nextMonth,
          failedBillingCount: 0, // 성공하면 리셋
        },
      });

      return {
        success: true,
        payment,
        receiptUrl: result.receipt?.url,
      };
    } catch (error) {
      this.logger.error(`빌링키 결제 에러: ${error.message}`);
      throw error;
    }
  }

  /**
   * 구독 자동 갱신 처리 (Cron에서 호출)
   */
  async processAutoRenewals(): Promise<any> {
    this.logger.log('구독 자동 갱신 처리 시작');

    const now = new Date();
    
    // 오늘 결제 예정인 구독 조회
    const subscriptionsToRenew = await this.prisma.subscription.findMany({
      where: {
        autoRenewal: true,
        billingKey: { not: null },
        nextBillingDate: {
          lte: now,
        },
        status: { in: ['TRIAL', 'ACTIVE'] },
        failedBillingCount: { lt: 3 }, // 3번 이상 실패하면 중단
      },
      include: {
        hospital: true,
      },
    });

    this.logger.log(`갱신 대상 구독: ${subscriptionsToRenew.length}개`);

    const results = [];

    for (const subscription of subscriptionsToRenew) {
      try {
        // 플랜별 금액
        const planPrices: Record<string, number> = {
          STARTER: 49000,
          STANDARD: 99000,
          PRO: 199000,
          ENTERPRISE: 299000,
        };

        const amount = planPrices[subscription.planType] || 49000;
        const orderId = `PS_AUTO_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        await this.chargeBillingKey({
          billingKey: subscription.billingKey!,
          customerKey: subscription.customerKey!,
          amount,
          orderId,
          orderName: `Patient Signal ${subscription.planType} 월간 구독`,
          hospitalId: subscription.hospitalId,
        });

        results.push({
          hospitalId: subscription.hospitalId,
          hospitalName: subscription.hospital.name,
          status: 'success',
          amount,
        });

        this.logger.log(`구독 갱신 성공: ${subscription.hospital.name}`);

      } catch (error) {
        results.push({
          hospitalId: subscription.hospitalId,
          hospitalName: subscription.hospital.name,
          status: 'failed',
          error: error.message,
        });

        this.logger.error(`구독 갱신 실패: ${subscription.hospital.name} - ${error.message}`);
      }
    }

    this.logger.log(`구독 자동 갱신 완료: ${results.filter(r => r.status === 'success').length}/${results.length} 성공`);

    return {
      processed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };
  }

  /**
   * 빌링키 삭제 (카드 등록 해제)
   */
  async deleteBillingKey(hospitalId: string): Promise<any> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { hospitalId },
    });

    if (!subscription?.billingKey) {
      throw new BadRequestException('등록된 결제 수단이 없습니다.');
    }

    // 빌링키 정보 삭제 (구독은 유지하되 자동갱신 중단)
    await this.prisma.subscription.update({
      where: { hospitalId },
      data: {
        billingKey: null,
        customerKey: null,
        cardLast4: null,
        cardBrand: null,
        autoRenewal: false,
        cancelAtPeriodEnd: true,
      },
    });

    this.logger.log(`빌링키 삭제 완료: hospitalId=${hospitalId}`);

    return {
      success: true,
      message: '결제 수단이 삭제되었습니다. 현재 구독 기간 종료 후 자동 갱신되지 않습니다.',
    };
  }

  /**
   * 만료 예정 구독 조회 (알림용)
   */
  async getExpiringSubscriptions(daysBeforeExpiry: number = 3): Promise<any> {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        currentPeriodEnd: {
          gte: now,
          lte: targetDate,
        },
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
      include: {
        hospital: {
          include: {
            users: true,
          },
        },
      },
    });

    return subscriptions;
  }
}
