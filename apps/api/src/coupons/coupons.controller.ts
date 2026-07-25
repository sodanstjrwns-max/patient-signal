import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminEmailGuard } from '../common/guards/admin-email.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';

@ApiTags('쿠폰')
@Controller('coupons')
export class CouponsController {
  private readonly logger = new Logger(CouponsController.name);

  constructor(private couponsService: CouponsService) {}

  /**
   * 쿠폰 코드 검증 (미리보기)
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '쿠폰 검증', description: '쿠폰 코드의 유효성을 확인하고 할인 정보를 반환합니다' })
  async validateCoupon(
    @CurrentUser() user: any,
    @Body() body: { code: string; planType: string },
  ) {
    if (!user.hospitalId) {
      return { valid: false, message: '병원 정보가 등록되지 않았습니다.' };
    }

    return this.couponsService.validateCoupon(
      body.code,
      body.planType,
      user.hospitalId,
    );
  }

  /**
   * 쿠폰 적용 (구독 활성화)
   */
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '쿠폰 적용', description: '쿠폰을 적용하여 구독을 활성화합니다' })
  async applyCoupon(
    @CurrentUser() user: any,
    @Body() body: { code: string; planType: string },
  ) {
    if (!user.hospitalId) {
      return { success: false, message: '병원 정보가 등록되지 않았습니다.' };
    }

    return this.couponsService.applyCoupon({
      code: body.code,
      planType: body.planType,
      userId: user.id,
      hospitalId: user.hospitalId,
    });
  }

  /**
   * 기본 쿠폰 시드
   */
  @Post('seed')
  @ApiOperation({ summary: '기본 쿠폰 생성', description: '기본 쿠폰 데이터를 시드합니다' })
  async seedCoupons(@Query('secret') secret: string) {
    // 보안: 하드코딩 시크릿 제거 — CRON_SECRET 미설정 시 무조건 차단
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return { error: 'Unauthorized' };
    }
    return this.couponsService.seedCoupons();
  }

  /**
   * 쿠폰 목록 (관리자)
   * 【P0-2】 AdminEmailGuard 추가 — 기존에는 로그인한 아무 유저나 전체 쿠폰을 열람 가능했음
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '쿠폰 목록', description: '전체 쿠폰 목록을 조회합니다 (관리자 전용)' })
  @ApiResponse({ status: 403, description: '관리자 권한 없음' })
  async listCoupons() {
    return this.couponsService.listCoupons();
  }

  /**
   * 쿠폰 생성 (관리자)
   * 【P0-2】 AdminEmailGuard + CreateCouponDto — 기존에는 일반 유저가
   *          freeMonths:120 같은 쿠폰을 직접 발급할 수 있었음
   */
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '쿠폰 생성', description: '새로운 쿠폰을 생성합니다 (관리자 전용)' })
  @ApiResponse({ status: 403, description: '관리자 권한 없음' })
  async createCoupon(@CurrentUser() user: any, @Body() dto: CreateCouponDto) {
    this.logger.log(`[쿠폰 생성] admin=${user?.email} code=${dto.code}`);
    return this.couponsService.createCoupon(dto);
  }
}
