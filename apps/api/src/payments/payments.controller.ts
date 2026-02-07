import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import * as crypto from 'crypto';

@ApiTags('결제')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  private readonly webhookSecretKey: string;

  constructor(private paymentsService: PaymentsService) {
    // 토스페이먼츠 웹훅 시크릿 키 (대시보드에서 확인)
    this.webhookSecretKey = process.env.TOSS_WEBHOOK_SECRET || '';
    if (!this.webhookSecretKey) {
      this.logger.warn('⚠️ TOSS_WEBHOOK_SECRET이 설정되지 않았습니다. 웹훅 서명 검증이 비활성화됩니다.');
    }
  }

  /**
   * 토스페이먼츠 웹훅 서명 검증
   * @see https://docs.tosspayments.com/reference/webhook
   */
  private verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecretKey) {
      this.logger.warn('웹훅 시크릿 키가 없어 서명 검증을 건너뜁니다.');
      return true; // 개발 환경에서는 통과
    }

    if (!signature) {
      this.logger.error('웹훅 서명이 없습니다.');
      return false;
    }

    try {
      // HMAC-SHA256으로 서명 생성
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecretKey)
        .update(body)
        .digest('base64');

      // 타이밍 공격 방지를 위해 timingSafeEqual 사용
      const signatureBuffer = Buffer.from(signature, 'base64');
      const expectedBuffer = Buffer.from(expectedSignature, 'base64');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      this.logger.error(`웹훅 서명 검증 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 결제 승인 (토스페이먼츠 결제 완료 후 호출)
   */
  @Post('confirm')
  @ApiOperation({ summary: '결제 승인', description: '토스페이먼츠 결제 승인을 처리합니다' })
  @ApiResponse({ status: 200, description: '결제 승인 성공' })
  @ApiResponse({ status: 400, description: '결제 승인 실패' })
  async confirmPayment(
    @Body() body: { paymentKey: string; orderId: string; amount: number },
  ) {
    this.logger.log(`결제 승인 요청: orderId=${body.orderId}`);

    if (!body.paymentKey || !body.orderId || !body.amount) {
      throw new BadRequestException('필수 파라미터가 누락되었습니다.');
    }

    return this.paymentsService.confirmPayment({
      paymentKey: body.paymentKey,
      orderId: body.orderId,
      amount: body.amount,
    });
  }

  /**
   * 결제 정보 저장 (프론트엔드에서 결제 승인 후 호출)
   */
  @Post('save')
  @HttpCode(200)
  @ApiOperation({ summary: '결제 정보 저장', description: '결제 승인 완료된 정보를 DB에 저장합니다' })
  @ApiResponse({ status: 200, description: '저장 성공' })
  async savePayment(@Body() body: any) {
    this.logger.log(`결제 정보 저장 요청: orderId=${body.orderId}, status=${body.status}`);

    if (!body.orderId || !body.paymentKey) {
      throw new BadRequestException('필수 파라미터가 누락되었습니다.');
    }

    return this.paymentsService.savePaymentFromFrontend(body);
  }

  /**
   * 토스페이먼츠 웹훅 수신
   */
  @Post('webhook')
  @SkipThrottle() // 웹훅은 Rate Limit 제외
  @HttpCode(200)
  @ApiOperation({ summary: '웹훅 수신', description: '토스페이먼츠 웹훅을 처리합니다' })
  async handleWebhook(
    @Body() body: any,
    @Headers('toss-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`웹훅 수신: ${body.eventType || 'unknown'}`);

    // 토스페이먼츠 직접 웹훅인 경우 서명 검증
    if (signature && this.webhookSecretKey) {
      const rawBody = req.rawBody?.toString() || JSON.stringify(body);
      const isValid = this.verifyWebhookSignature(rawBody, signature);
      
      if (!isValid) {
        this.logger.error('웹훅 서명 검증 실패');
        throw new UnauthorizedException('Invalid webhook signature');
      }
      this.logger.log('✅ 웹훅 서명 검증 성공');
    }

    // 프론트엔드에서 전달받은 이벤트 처리
    if (body.eventType) {
      await this.paymentsService.handleWebhook(body.eventType, body);
      return { success: true };
    }

    // 토스페이먼츠 직접 웹훅 처리
    if (body.data) {
      await this.paymentsService.handleWebhook(body.eventType, body.data);
    }

    return { success: true };
  }

  /**
   * 가상계좌 입금 콜백 (Deposit Callback)
   */
  @Post('webhook/deposit')
  @SkipThrottle() // 웹훅은 Rate Limit 제외
  @HttpCode(200)
  @ApiOperation({ summary: '가상계좌 입금 콜백', description: '가상계좌 입금 완료를 처리합니다' })
  async handleDepositCallback(@Body() body: any) {
    this.logger.log(`가상계좌 입금 콜백: orderId=${body.orderId}`);

    await this.paymentsService.handleWebhook('DEPOSIT_CALLBACK', body);

    return { success: true };
  }

  /**
   * 결제 상태 조회
   */
  @Get(':orderId')
  @ApiOperation({ summary: '결제 조회', description: '결제 정보를 조회합니다' })
  async getPayment(@Param('orderId') orderId: string) {
    const payment = await this.paymentsService.getPayment(orderId);
    
    if (!payment) {
      throw new BadRequestException('결제 정보를 찾을 수 없습니다.');
    }

    return payment;
  }

  /**
   * 구독 상태 조회
   */
  @Get('subscription/:hospitalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 상태 조회', description: '병원의 구독 상태를 조회합니다' })
  async getSubscriptionStatus(@Param('hospitalId') hospitalId: string) {
    return this.paymentsService.getSubscriptionStatus(hospitalId);
  }

  /**
   * 내 결제 목록 조회
   */
  @Get('user/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 내역 조회', description: '내 결제 내역을 조회합니다' })
  async getMyPayments(@CurrentUser() user: any) {
    return this.paymentsService.getPaymentsByUser(user.id);
  }

  /**
   * 웹훅 상태 확인
   */
  @Get('webhook/status')
  @ApiOperation({ summary: '웹훅 상태 확인', description: '웹훅 엔드포인트 활성화 상태를 확인합니다' })
  getWebhookStatus() {
    return {
      status: 'active',
      message: '토스페이먼츠 웹훅 엔드포인트가 활성화되어 있습니다.',
      endpoints: {
        webhook: '/api/payments/webhook',
        deposit: '/api/payments/webhook/deposit',
      },
      supportedEvents: [
        'PAYMENT_STATUS_CHANGED',
        'DEPOSIT_CALLBACK',
        'VIRTUAL_ACCOUNT_DEPOSIT',
        'PAYMENT_CANCELED',
      ],
    };
  }

  // ==================== 빌링키 자동결제 ====================

  /**
   * 빌링키 발급 (카드 등록)
   */
  @Post('billing/issue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '빌링키 발급', description: '자동결제를 위한 빌링키를 발급합니다' })
  @ApiResponse({ status: 200, description: '빌링키 발급 성공' })
  async issueBillingKey(
    @Body() body: { authKey: string; customerKey: string; hospitalId: string },
    @CurrentUser() user: any,
  ) {
    this.logger.log(`빌링키 발급 요청: hospitalId=${body.hospitalId}`);

    if (!body.authKey || !body.customerKey || !body.hospitalId) {
      throw new BadRequestException('필수 파라미터가 누락되었습니다.');
    }

    return this.paymentsService.issueBillingKey(body);
  }

  /**
   * 결제 수단 삭제 (자동결제 해지)
   */
  @Post('billing/delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 수단 삭제', description: '등록된 결제 수단을 삭제합니다' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteBillingKey(
    @Body() body: { hospitalId: string },
    @CurrentUser() user: any,
  ) {
    this.logger.log(`결제 수단 삭제 요청: hospitalId=${body.hospitalId}`);

    if (!body.hospitalId) {
      throw new BadRequestException('hospitalId가 필요합니다.');
    }

    return this.paymentsService.deleteBillingKey(body.hospitalId);
  }

  /**
   * 구독 자동 갱신 처리 (Cron 호출용)
   */
  @Post('billing/process-renewals')
  @HttpCode(200)
  @ApiOperation({ summary: '자동 갱신 처리', description: 'Cron에서 호출하여 만료 예정 구독을 자동 갱신합니다' })
  async processAutoRenewals(
    @Headers('x-cron-secret') cronSecret: string,
  ) {
    // Cron 인증
    const expectedSecret = process.env.CRON_SECRET || 'patient-signal-cron-secret-2024';
    if (cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return this.paymentsService.processAutoRenewals();
  }

  /**
   * 결제 수단 정보 조회
   */
  @Get('billing/:hospitalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 수단 조회', description: '등록된 결제 수단 정보를 조회합니다' })
  async getBillingInfo(@Param('hospitalId') hospitalId: string) {
    const subscription = await this.paymentsService.getSubscriptionStatus(hospitalId);
    
    if (!subscription.hasSubscription) {
      return { hasBillingKey: false };
    }

    return {
      hasBillingKey: !!subscription.subscription?.billingKey,
      card: subscription.subscription?.billingKey ? {
        brand: subscription.subscription.cardBrand,
        last4: subscription.subscription.cardLast4,
      } : null,
      autoRenewal: subscription.subscription?.autoRenewal || false,
      nextBillingDate: subscription.subscription?.nextBillingDate,
    };
  }
}
