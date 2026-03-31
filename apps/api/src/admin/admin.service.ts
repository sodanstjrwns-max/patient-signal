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
   * 회원 활동 현황 (로그인 추적 + 사용량)
   */
  async getUserActivity(sort: string = 'lastLogin') {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        hospital: {
          select: {
            id: true,
            name: true,
            planType: true,
            _count: {
              select: {
                aiResponses: true,
                prompts: true,
                crawlJobs: true,
              },
            },
          },
        },
      },
    });

    // 각 유저의 실시간 질문 사용 횟수 조회
    const enriched = await Promise.all(
      users.map(async (u) => {
        let liveQueryCount = 0;
        if (u.hospital?.id) {
          liveQueryCount = await this.prisma.liveQueryUsage.count({
            where: { hospitalId: u.hospital.id },
          }).catch(() => 0);
        }

        const now = new Date();
        const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt) : null;
        const daysSinceLogin = lastLogin
          ? Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const daysSinceSignup = Math.floor((now.getTime() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        let activityLevel: string;
        if (!lastLogin || daysSinceLogin === null) activityLevel = '미접속';
        else if (daysSinceLogin <= 1) activityLevel = '🔥 활발';
        else if (daysSinceLogin <= 3) activityLevel = '👍 보통';
        else if (daysSinceLogin <= 7) activityLevel = '😐 저조';
        else activityLevel = '😴 이탈위험';

        return {
          name: u.name,
          email: u.email,
          hospital: u.hospital?.name || '미등록',
          plan: u.hospital?.planType || 'FREE',
          lastLoginAt: u.lastLoginAt,
          loginCount: u.loginCount,
          daysSinceLogin,
          daysSinceSignup,
          activityLevel,
          responses: u.hospital?._count?.aiResponses || 0,
          prompts: u.hospital?._count?.prompts || 0,
          crawls: u.hospital?._count?.crawlJobs || 0,
          liveQueries: liveQueryCount,
          signupDate: u.createdAt,
        };
      }),
    );

    // 정렬
    if (sort === 'loginCount') {
      enriched.sort((a, b) => b.loginCount - a.loginCount);
    } else if (sort === 'responses') {
      enriched.sort((a, b) => b.responses - a.responses);
    } else {
      // lastLogin 기준 (최근 접속순, null은 맨 뒤)
      enriched.sort((a, b) => {
        if (!a.lastLoginAt && !b.lastLoginAt) return 0;
        if (!a.lastLoginAt) return 1;
        if (!b.lastLoginAt) return -1;
        return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
      });
    }

    // 요약 통계
    const summary = {
      total: enriched.length,
      active: enriched.filter(e => e.activityLevel === '🔥 활발').length,
      normal: enriched.filter(e => e.activityLevel === '👍 보통').length,
      low: enriched.filter(e => e.activityLevel === '😐 저조').length,
      churnRisk: enriched.filter(e => e.activityLevel === '😴 이탈위험').length,
      neverLoggedIn: enriched.filter(e => e.activityLevel === '미접속').length,
      avgLoginCount: enriched.length > 0
        ? Math.round(enriched.reduce((sum, e) => sum + e.loginCount, 0) / enriched.length * 10) / 10
        : 0,
    };

    return { summary, users: enriched };
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

  /**
   * 기존 FREE 유저들에게 STARTER 7일 트라이얼 소급 적용
   * 
   * 대상: planType='FREE'이고, 구독이 없거나 FREE 구독만 있는 병원
   * 동작: subscription을 STARTER/TRIAL/7일로 변경, hospital.planType도 STARTER로
   */
  async grantStarterTrialToFreeUsers() {
    this.logger.log('=== FREE 유저 STARTER 트라이얼 소급 적용 시작 ===');

    // FREE 플랜인 병원 중 쿠폰으로 이미 유료 구독 중인 병원 제외
    const freeHospitals = await this.prisma.hospital.findMany({
      where: { planType: 'FREE' },
      include: {
        subscriptions: true,
      },
    });

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const results: any[] = [];

    for (const hospital of freeHospitals) {
      // 이미 ACTIVE/TRIAL 상태의 유료 구독이 있으면 스킵
      const hasActivePaidSub = hospital.subscriptions?.some(
        (s: any) => ['ACTIVE', 'TRIAL'].includes(s.status) && s.planType !== 'FREE'
      );
      if (hasActivePaidSub) {
        results.push({ hospital: hospital.name, status: 'skipped', reason: '이미 유료 구독 중' });
        continue;
      }

      try {
        // 구독 upsert (기존 FREE 구독이 있으면 업데이트, 없으면 생성)
        await this.prisma.subscription.upsert({
          where: { hospitalId: hospital.id },
          create: {
            hospitalId: hospital.id,
            planType: 'STARTER',
            status: 'TRIAL',
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
          },
          update: {
            planType: 'STARTER',
            status: 'TRIAL',
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
          },
        });

        // 병원 planType 업데이트
        await this.prisma.hospital.update({
          where: { id: hospital.id },
          data: {
            planType: 'STARTER',
            subscriptionStatus: 'TRIAL',
          },
        });

        // 경쟁사 1개 활성화 (STARTER 기준)
        const competitors = await this.prisma.competitor.findMany({
          where: { hospitalId: hospital.id },
          orderBy: { createdAt: 'asc' },
        });
        if (competitors.length > 0) {
          await this.prisma.competitor.update({
            where: { id: competitors[0].id },
            data: { isActive: true },
          });
        }

        results.push({
          hospital: hospital.name,
          hospitalId: hospital.id,
          status: 'granted',
          trialEnd: trialEnd.toISOString(),
        });

        this.logger.log(`[소급적용] ${hospital.name} → STARTER 7일 트라이얼 부여`);
      } catch (err) {
        results.push({ hospital: hospital.name, status: 'error', error: err?.message });
        this.logger.error(`[소급적용 실패] ${hospital.name}: ${err?.message}`);
      }
    }

    this.logger.log(`=== 소급 적용 완료: ${results.filter(r => r.status === 'granted').length}건 성공 ===`);

    return {
      total: freeHospitals.length,
      granted: results.filter(r => r.status === 'granted').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      details: results,
    };
  }
}
