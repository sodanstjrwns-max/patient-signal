import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanType } from '@prisma/client';

@ApiTags('구독')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private subscriptionsService: SubscriptionsService) {}

  /**
   * 내 구독 상태 조회
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 구독 상태', description: '현재 로그인한 사용자의 구독 상태를 조회합니다' })
  @ApiResponse({ status: 200, description: '구독 상태 조회 성공' })
  async getMySubscription(@CurrentUser() user: any) {
    if (!user.hospitalId) {
      return {
        hasSubscription: false,
        status: 'NONE',
        message: '병원 정보가 등록되지 않았습니다.',
      };
    }

    return this.subscriptionsService.getSubscription(user.hospitalId);
  }

  /**
   * 병원 구독 상태 조회
   */
  @Get('hospital/:hospitalId')
  @ApiOperation({ summary: '병원 구독 상태', description: '특정 병원의 구독 상태를 조회합니다' })
  async getHospitalSubscription(@Param('hospitalId') hospitalId: string) {
    return this.subscriptionsService.getSubscription(hospitalId);
  }

  /**
   * 구독 취소 예약
   */
  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 취소', description: '구독을 기간 종료 시 취소 예약합니다' })
  async cancelSubscription(@CurrentUser() user: any) {
    if (!user.hospitalId) {
      return { success: false, message: '병원 정보가 등록되지 않았습니다.' };
    }

    return this.subscriptionsService.cancelSubscription(user.hospitalId);
  }

  /**
   * 구독 취소 철회
   */
  @Post('reactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '구독 취소 철회', description: '구독 취소 예약을 철회합니다' })
  async reactivateSubscription(@CurrentUser() user: any) {
    if (!user.hospitalId) {
      return { success: false, message: '병원 정보가 등록되지 않았습니다.' };
    }

    return this.subscriptionsService.reactivateSubscription(user.hospitalId);
  }

  /**
   * 플랜 업그레이드
   */
  @Patch('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '플랜 업그레이드', description: '더 높은 플랜으로 업그레이드합니다' })
  async upgradePlan(
    @CurrentUser() user: any,
    @Body() body: { planType: PlanType },
  ) {
    if (!user.hospitalId) {
      return { success: false, message: '병원 정보가 등록되지 않았습니다.' };
    }

    return this.subscriptionsService.upgradePlan(user.hospitalId, body.planType);
  }

  /**
   * 플랜 기능 제한 조회
   */
  @Get('plans/:planType/limits')
  @ApiOperation({ summary: '플랜 기능 제한', description: '특정 플랜의 기능 제한을 조회합니다' })
  getPlanLimits(@Param('planType') planType: PlanType) {
    return this.subscriptionsService.getPlanLimits(planType);
  }

  /**
   * 전체 플랜 기능 비교
   */
  @Get('plans/compare')
  @ApiOperation({ summary: '플랜 비교', description: '모든 플랜의 기능을 비교합니다' })
  comparePlans() {
    return {
      STARTER: this.subscriptionsService.getPlanLimits('STARTER'),
      STANDARD: this.subscriptionsService.getPlanLimits('STANDARD'),
      PRO: this.subscriptionsService.getPlanLimits('PRO'),
      ENTERPRISE: this.subscriptionsService.getPlanLimits('ENTERPRISE'),
    };
  }

  /**
   * 전체 구독 목록 (관리자용)
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전체 구독 목록', description: '모든 구독 목록을 조회합니다 (관리자용)' })
  async getAllSubscriptions(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    // TODO: 관리자 권한 체크 추가
    return this.subscriptionsService.getAllSubscriptions(+page, +limit);
  }
}
