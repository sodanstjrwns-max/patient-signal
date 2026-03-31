import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 실시간 질문 인사이트 분석 ====================

  /**
   * 전체 실시간 질문 로그 조회 (페이지네이션 + 필터링)
   */
  async getLiveQueryLogs(options: {
    page?: number;
    limit?: number;
    hospitalId?: string;
    category?: string;
    days?: number;
    search?: string;
  }) {
    const { page = 1, limit = 50, hospitalId, category, days = 30, search } = options;
    const skip = (page - 1) * limit;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = { usedAt: { gte: since } };
    if (hospitalId) where.hospitalId = hospitalId;
    if (category) where.category = category;
    if (search) where.queryText = { contains: search, mode: 'insensitive' };

    const [total, queries] = await Promise.all([
      this.prisma.liveQueryUsage.count({ where }),
      this.prisma.liveQueryUsage.findMany({
        where,
        orderBy: { usedAt: 'desc' },
        skip,
        take: limit,
        include: {
          responses: {
            select: {
              platform: true,
              success: true,
              isMentioned: true,
              mentionPosition: true,
              sentimentLabel: true,
              responseTimeMs: true,
            },
          },
        },
      }),
    ]);

    // 병원명 매핑
    const hospitalIds = [...new Set(queries.map(q => q.hospitalId))];
    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true, planType: true },
    });
    const hospitalMap = new Map(hospitals.map(h => [h.id, h]));

    // 유저명 매핑
    const userIds = [...new Set(queries.filter(q => q.userId).map(q => q.userId!))];
    const users = userIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const enrichedQueries = queries.map(q => ({
      id: q.id,
      hospitalName: hospitalMap.get(q.hospitalId)?.name || '알 수 없음',
      hospitalPlan: hospitalMap.get(q.hospitalId)?.planType || 'FREE',
      userName: q.userId ? (userMap.get(q.userId)?.name || '알 수 없음') : '미확인',
      userEmail: q.userId ? (userMap.get(q.userId)?.email || '-') : '-',
      queryText: q.queryText,
      category: q.category,
      categoryTag: q.categoryTag,
      platforms: q.platforms,
      successCount: q.successCount,
      mentionedCount: q.mentionedCount,
      mentionRate: q.mentionRate,
      avgPosition: q.avgPosition,
      sentimentSummary: q.sentimentSummary,
      competitorsMentioned: q.competitorsMentioned,
      responses: q.responses,
      usedAt: q.usedAt,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      queries: enrichedQueries,
    };
  }

  /**
   * 전체 실시간 질문 인사이트 대시보드
   * - 전체 통계, 카테고리 분포, 인기 질문, 트렌드, 병원별 랭킹
   */
  async getLiveQueryInsights(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const queries = await this.prisma.liveQueryUsage.findMany({
      where: { usedAt: { gte: since } },
      orderBy: { usedAt: 'desc' },
    });

    if (queries.length === 0) {
      return {
        period: `최근 ${days}일`,
        totalQueries: 0,
        message: '아직 실시간 질문 데이터가 없습니다.',
      };
    }

    // ── 1. 전체 통계 ──
    const totalQueries = queries.length;
    const avgMentionRate = Math.round(queries.reduce((sum, q) => sum + q.mentionRate, 0) / totalQueries);
    const totalMentioned = queries.filter(q => q.mentionRate > 0).length;
    const avgSuccessCount = Math.round((queries.reduce((sum, q) => sum + q.successCount, 0) / totalQueries) * 10) / 10;

    // ── 2. 카테고리별 분포 ──
    const categoryDisplayNames: Record<string, string> = {
      PROCEDURE: '🔧 시술/진료',
      EMOTION: '💛 감성/경험',
      COST: '💰 비용/가격',
      REGION: '📍 지역 기반',
      REVIEW: '⭐ 후기/평판',
      COMPARISON: '⚖️ 비교',
      GENERAL: '📋 기타',
    };

    const categoryStats = new Map<string, { count: number; totalMentionRate: number; mentionedCount: number }>();
    for (const q of queries) {
      const cat = q.category || 'GENERAL';
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { count: 0, totalMentionRate: 0, mentionedCount: 0 });
      }
      const data = categoryStats.get(cat)!;
      data.count++;
      data.totalMentionRate += q.mentionRate;
      if (q.mentionRate > 0) data.mentionedCount++;
    }

    const categories = Array.from(categoryStats.entries())
      .map(([cat, data]) => ({
        category: cat,
        categoryName: categoryDisplayNames[cat] || cat,
        queryCount: data.count,
        percentage: Math.round((data.count / totalQueries) * 100),
        avgMentionRate: Math.round(data.totalMentionRate / data.count),
        mentionedCount: data.mentionedCount,
      }))
      .sort((a, b) => b.queryCount - a.queryCount);

    // ── 3. 인기 태그/키워드 TOP 20 ──
    const tagCounts = new Map<string, { count: number; category: string; totalMentionRate: number }>();
    for (const q of queries) {
      const tag = q.categoryTag || '기타';
      if (!tagCounts.has(tag)) {
        tagCounts.set(tag, { count: 0, category: q.category || 'GENERAL', totalMentionRate: 0 });
      }
      const data = tagCounts.get(tag)!;
      data.count++;
      data.totalMentionRate += q.mentionRate;
    }

    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, data]) => ({
        tag,
        category: data.category,
        categoryName: categoryDisplayNames[data.category] || data.category,
        queryCount: data.count,
        avgMentionRate: Math.round(data.totalMentionRate / data.count),
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 20);

    // ── 4. 인기 질문 문구 TOP 20 (동일 질문 그룹화) ──
    const questionCounts = new Map<string, { count: number; category: string; avgMentionRate: number; hospitals: Set<string> }>();
    for (const q of queries) {
      const text = q.queryText.trim().toLowerCase();
      if (!questionCounts.has(text)) {
        questionCounts.set(text, { count: 0, category: q.category || 'GENERAL', avgMentionRate: 0, hospitals: new Set() });
      }
      const data = questionCounts.get(text)!;
      data.count++;
      data.avgMentionRate += q.mentionRate;
      data.hospitals.add(q.hospitalId);
    }

    const popularQuestions = Array.from(questionCounts.entries())
      .map(([text, data]) => ({
        queryText: text,
        count: data.count,
        category: data.category,
        categoryName: categoryDisplayNames[data.category] || data.category,
        avgMentionRate: Math.round(data.avgMentionRate / data.count),
        uniqueHospitals: data.hospitals.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── 5. 일별 트렌드 ──
    const dailyMap = new Map<string, { count: number; mentionSum: number }>();
    for (const q of queries) {
      const dateKey = q.usedAt.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { count: 0, mentionSum: 0 });
      }
      const data = dailyMap.get(dateKey)!;
      data.count++;
      data.mentionSum += q.mentionRate;
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        queryCount: data.count,
        avgMentionRate: Math.round(data.mentionSum / data.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── 6. 병원별 사용 랭킹 TOP 20 ──
    const hospitalUsage = new Map<string, { count: number; totalMentionRate: number }>();
    for (const q of queries) {
      if (!hospitalUsage.has(q.hospitalId)) {
        hospitalUsage.set(q.hospitalId, { count: 0, totalMentionRate: 0 });
      }
      const data = hospitalUsage.get(q.hospitalId)!;
      data.count++;
      data.totalMentionRate += q.mentionRate;
    }

    const hospitalIds = [...hospitalUsage.keys()];
    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true, planType: true },
    });
    const hospitalMap = new Map(hospitals.map(h => [h.id, h]));

    const hospitalRanking = Array.from(hospitalUsage.entries())
      .map(([hid, data]) => ({
        hospitalId: hid,
        hospitalName: hospitalMap.get(hid)?.name || '알 수 없음',
        planType: hospitalMap.get(hid)?.planType || 'FREE',
        queryCount: data.count,
        avgMentionRate: Math.round(data.totalMentionRate / data.count),
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 20);

    // ── 7. 플랫폼별 성과 ──
    const platformStats = new Map<string, { total: number; mentioned: number }>();
    // responses를 별도 쿼리로 집계
    const platformAgg = await this.prisma.liveQueryResponse.groupBy({
      by: ['platform'],
      where: {
        createdAt: { gte: since },
        success: true,
      },
      _count: true,
    });
    const platformMentioned = await this.prisma.liveQueryResponse.groupBy({
      by: ['platform'],
      where: {
        createdAt: { gte: since },
        success: true,
        isMentioned: true,
      },
      _count: true,
    });
    const mentionedMap = new Map(platformMentioned.map(p => [p.platform, p._count]));

    const platformNames: Record<string, string> = {
      CHATGPT: 'ChatGPT',
      CLAUDE: 'Claude',
      PERPLEXITY: 'Perplexity',
      GEMINI: 'Gemini',
    };

    const platformPerformance = platformAgg.map(p => ({
      platform: p.platform,
      platformName: platformNames[p.platform] || p.platform,
      totalResponses: p._count,
      mentionedCount: mentionedMap.get(p.platform) || 0,
      mentionRate: p._count > 0
        ? Math.round(((mentionedMap.get(p.platform) || 0) / p._count) * 100)
        : 0,
    })).sort((a, b) => b.mentionRate - a.mentionRate);

    // ── 8. 경쟁사 빈출 랭킹 TOP 15 ──
    const competitorCounts = new Map<string, number>();
    for (const q of queries) {
      if (q.competitorsMentioned && q.competitorsMentioned.length > 0) {
        for (const comp of q.competitorsMentioned) {
          competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
        }
      }
    }
    const competitorRanking = Array.from(competitorCounts.entries())
      .map(([name, count]) => ({ competitorName: name, mentionCount: count }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 15);

    // ── 9. 시간대별 질문 패턴 (0~23시) ──
    const hourlyPattern = new Array(24).fill(0);
    for (const q of queries) {
      const hour = q.usedAt.getHours();
      hourlyPattern[hour]++;
    }
    const hourlyStats = hourlyPattern.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      queryCount: count,
    }));

    return {
      period: `최근 ${days}일`,
      totalQueries,
      avgMentionRate,
      totalMentioned,
      avgSuccessCount,
      summary: {
        uniqueHospitals: hospitalUsage.size,
        uniqueQuestions: questionCounts.size,
        avgQueriesPerDay: Math.round((totalQueries / days) * 10) / 10,
        peakHour: hourlyStats.reduce((max, h) => h.queryCount > max.queryCount ? h : max, hourlyStats[0]),
      },
      categories,
      popularTags,
      popularQuestions,
      dailyTrend,
      hospitalRanking,
      platformPerformance,
      competitorRanking,
      hourlyStats,
    };
  }

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
