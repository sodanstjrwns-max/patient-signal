import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('관리자')
@Controller('admin')
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

  private validateSecret(secret: string) {
    const validSecret = process.env.ADMIN_SECRET || 'pf-admin-2026';
    if (secret !== validSecret) {
      throw new Error('Unauthorized');
    }
  }
}
