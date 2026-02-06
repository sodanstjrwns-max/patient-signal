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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('결제')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private paymentsService: PaymentsService) {}

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
  @HttpCode(200)
  @ApiOperation({ summary: '웹훅 수신', description: '토스페이먼츠 웹훅을 처리합니다' })
  async handleWebhook(
    @Body() body: any,
    @Headers('toss-signature') signature: string,
  ) {
    this.logger.log(`웹훅 수신: ${body.eventType || 'unknown'}`);

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
}
