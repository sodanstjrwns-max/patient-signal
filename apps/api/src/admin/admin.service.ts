import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 대시보드 통계
   */
  async getDashboard() {
    const [
      totalUsers,
      totalHospitals,
      totalCouponsUsed,
      planCounts,
      recentUsers,
      recentHospitals,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.hospital.count(),
      this.prisma.couponRedemption.count(),
      this.prisma.hospital.groupBy({
        by: ['planType'],
        _count: true,
      }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      this.prisma.hospital.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, specialtyType: true, planType: true, createdAt: true },
      }),
    ]);

    const planDistribution: Record<string, number> = {};
    for (const p of planCounts) {
      planDistribution[p.planType] = p._count;
    }

    return {
      stats: {
        totalUsers,
        totalHospitals,
        totalCouponsUsed,
        planDistribution,
      },
      recentUsers,
      recentHospitals,
    };
  }

  /**
   * 전체 유저 목록
   */
  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isPfMember: true,
        createdAt: true,
        hospital: {
          select: {
            id: true,
            name: true,
            planType: true,
            specialtyType: true,
            regionSido: true,
            regionSigungu: true,
          },
        },
      },
    });

    return { total: users.length, users };
  }

  /**
   * 전체 병원 목록
   */
  async getHospitals() {
    const hospitals = await this.prisma.hospital.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        specialtyType: true,
        planType: true,
        subscriptionStatus: true,
        regionSido: true,
        regionSigungu: true,
        regionDong: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            prompts: true,
            competitors: true,
            crawlJobs: true,
          },
        },
      },
    });

    return { total: hospitals.length, hospitals };
  }

  /**
   * 쿠폰 사용 현황
   */
  async getCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
        },
      },
    });

    // 각 redemption에 user/hospital 정보 조회
    const enrichedCoupons = await Promise.all(
      coupons.map(async (c) => {
        const enrichedRedemptions = await Promise.all(
          c.redemptions.map(async (r: any) => {
            const [user, hospital] = await Promise.all([
              this.prisma.user.findUnique({ where: { id: r.userId }, select: { name: true, email: true } }).catch(() => null),
              this.prisma.hospital.findUnique({ where: { id: r.hospitalId }, select: { name: true } }).catch(() => null),
            ]);
            return {
              user: user?.name || '알 수 없음',
              email: user?.email || '-',
              hospital: hospital?.name || '-',
              date: r.redeemedAt,
            };
          }),
        );
        return {
          code: c.code,
          name: c.name,
          type: c.couponType,
          maxUses: c.maxUses,
          currentUses: c.currentUses,
          remaining: c.maxUses > 0 ? c.maxUses - c.currentUses : '무제한',
          expiresAt: c.expiresAt,
          redemptions: enrichedRedemptions,
        };
      }),
    );

    return {
      total: enrichedCoupons.length,
      coupons: enrichedCoupons,
    };
  }
}
