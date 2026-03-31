import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('관리자')
@Controller('admin')
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 관리자 API: 1분에 30회
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  /**
   * 관리자 대시보드 통계
   * GET /api/admin/dashboard?secret=xxx
   */
  @Public()
  @Get('dashboard')
  async getDashboard(@Query('secret') secret: string) {
    this.validateSecret(secret);
    return this.adminService.getDashboard();
  }

  /**
   * 전체 유저 목록
   * GET /api/admin/users?secret=xxx
   */
  @Public()
  @Get('users')
  async getUsers(@Query('secret') secret: string) {
    this.validateSecret(secret);
    return this.adminService.getUsers();
  }

  /**
   * 전체 병원 목록
   * GET /api/admin/hospitals?secret=xxx
   */
  @Public()
  @Get('hospitals')
  async getHospitals(@Query('secret') secret: string) {
    this.validateSecret(secret);
    return this.adminService.getHospitals();
  }

  /**
   * 쿠폰 사용 현황
   * GET /api/admin/coupons?secret=xxx
   */
  @Public()
  @Get('coupons')
  async getCoupons(@Query('secret') secret: string) {
    this.validateSecret(secret);
    return this.adminService.getCoupons();
  }

  /**
   * 회원 활동 현황 (로그인 추적)
   * GET /api/admin/activity?secret=xxx&sort=lastLogin|loginCount|responses
   */
  @Public()
  @Get('activity')
  async getActivity(
    @Query('secret') secret: string,
    @Query('sort') sort: string = 'lastLogin',
  ) {
    this.validateSecret(secret);
    return this.adminService.getUserActivity(sort);
  }

  /**
   * 기존 FREE 유저들에게 STARTER 7일 트라이얼 소급 적용
   * POST /api/admin/grant-trials?secret=xxx
   */
  @Public()
  @Post('grant-trials')
  async grantTrialsToFreeUsers(@Query('secret') secret: string) {
    this.validateSecret(secret);
    return this.adminService.grantStarterTrialToFreeUsers();
  }

  // ==================== 실시간 질문 인사이트 ====================

  /**
   * 전체 실시간 질문 인사이트 대시보드
   * GET /api/admin/live-query/insights?secret=xxx&days=30
   *
   * 전체 통계, 카테고리 분포, 인기 질문, 트렌드, 병원별 랭킹,
   * 플랫폼별 성과, 경쟁사 빈출 랭킹, 시간대별 패턴 등
   */
  @Public()
  @Get('live-query/insights')
  async getLiveQueryInsights(
    @Query('secret') secret: string,
    @Query('days') days?: string,
  ) {
    this.validateSecret(secret);
    const daysNum = parseInt(days || '30', 10);
    this.logger.log(`[Admin] 실시간 질문 인사이트 조회 (최근 ${daysNum}일)`);
    return this.adminService.getLiveQueryInsights(daysNum);
  }

  /**
   * 전체 실시간 질문 로그 조회 (페이지네이션 + 필터)
   * GET /api/admin/live-query/logs?secret=xxx&page=1&limit=50&category=PROCEDURE&hospitalId=xxx&search=임플란트&days=30
   */
  @Public()
  @Get('live-query/logs')
  async getLiveQueryLogs(
    @Query('secret') secret: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('category') category?: string,
    @Query('days') days?: string,
    @Query('search') search?: string,
  ) {
    this.validateSecret(secret);
    this.logger.log(`[Admin] 실시간 질문 로그 조회`);
    return this.adminService.getLiveQueryLogs({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10),
      hospitalId: hospitalId || undefined,
      category: category || undefined,
      days: parseInt(days || '30', 10),
      search: search || undefined,
    });
  }

  private validateSecret(secret: string) {
    const validSecret = process.env.ADMIN_SECRET || 'pf-admin-2026';
    if (secret !== validSecret) {
      throw new Error('Unauthorized');
    }
  }
}
