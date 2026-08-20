import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
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
   * 【P1-6】LLM 비용 대시보드 — 병원별/플랫폼별/모델별 크롤링 원가 집계
   * 주의: estimatedCostUsd는 벤더 단가표 기반 "추정치" (근사 토큰 포함)
   */
  async getLlmCosts(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [byPlatform, byModel, byHospital, totals] = await Promise.all([
      // 플랫폼별 집계
      this.prisma.aIResponse.groupBy({
        by: ['aiPlatform'],
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      // 모델별 집계
      this.prisma.aIResponse.groupBy({
        by: ['aiModelVersion'],
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostUsd: true },
        _count: { id: true },
      }),
      // 병원별 집계 (상위 100)
      this.prisma.aIResponse.groupBy({
        by: ['hospitalId'],
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostUsd: true },
        _count: { id: true },
      }),
      // 전체 합계
      this.prisma.aIResponse.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
    ]);

    // 병원 이름/플랜 매핑
    const hospitalIds = byHospital.map((h) => h.hospitalId);
    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true, planType: true },
    });
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

    const hospitalCosts = byHospital
      .map((h) => ({
        hospitalId: h.hospitalId,
        name: hospitalMap.get(h.hospitalId)?.name || '(삭제된 병원)',
        planType: hospitalMap.get(h.hospitalId)?.planType || 'UNKNOWN',
        responses: h._count.id,
        estimatedCostUsd: Math.round((h._sum.estimatedCostUsd || 0) * 10000) / 10000,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
      .slice(0, 100);

    const totalCost = totals._sum.estimatedCostUsd || 0;
    const activeHospitalCount = byHospital.length;

    return {
      periodDays: days,
      note: '추정치 — 벤더 단가표 기반, usage 미제공 응답은 문자수 근사',
      summary: {
        totalResponses: totals._count.id,
        totalEstimatedCostUsd: Math.round(totalCost * 100) / 100,
        totalInputTokens: totals._sum.inputTokens || 0,
        totalOutputTokens: totals._sum.outputTokens || 0,
        activeHospitals: activeHospitalCount,
        avgCostPerHospitalUsd:
          activeHospitalCount > 0 ? Math.round((totalCost / activeHospitalCount) * 100) / 100 : 0,
        avgCostPerResponseUsd:
          totals._count.id > 0 ? Math.round((totalCost / totals._count.id) * 10000) / 10000 : 0,
      },
      byPlatform: byPlatform.map((p) => ({
        platform: p.aiPlatform,
        responses: p._count.id,
        estimatedCostUsd: Math.round((p._sum.estimatedCostUsd || 0) * 100) / 100,
        inputTokens: p._sum.inputTokens || 0,
        outputTokens: p._sum.outputTokens || 0,
      })),
      byModel: byModel
        .map((m) => ({
          model: m.aiModelVersion || '(unknown)',
          responses: m._count.id,
          estimatedCostUsd: Math.round((m._sum.estimatedCostUsd || 0) * 100) / 100,
        }))
        .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      byHospital: hospitalCosts,
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

  /**
   * 무결제 구독을 TRIAL 7일로 리셋 (체험 → 과금 전환 마이그레이션)
   * 
   * 대상: ACTIVE 상태 + billingKey 없음 + 쿠폰 미사용 (= 순수 무료 체험 사용자)
   * 제외: ENTERPRISE, PRO, FREE, 쿠폰 사용자 (12개월 무료 등)
   * 
   * 동작:
   *   1. status → TRIAL
   *   2. currentPeriodEnd → 오늘 + trialDays일 (기본 7일)
   *   3. hospital.subscriptionStatus → TRIAL
   * 
   * 쿠폰 사용자는 별도로 쿠폰 만료일 기준으로 유지됨
   */
  async migrateUnpaidSubscriptionsToTrial(trialDays: number = 7): Promise<any> {
    this.logger.log(`=== 무결제 구독 → TRIAL ${trialDays}일 마이그레이션 시작 ===`);

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    // 쿠폰 사용한 hospitalId 목록 조회 (이 병원들은 건드리지 않음)
    const couponRedemptions = await this.prisma.couponRedemption.findMany({
      select: { hospitalId: true, freeMonths: true, coupon: { select: { code: true } } },
    });
    const couponHospitalIds = new Set(couponRedemptions.map(r => r.hospitalId));
    this.logger.log(`쿠폰 사용 병원: ${couponHospitalIds.size}개 (마이그레이션 제외)`);

    // 대상: ACTIVE + billingKey 없음 + ENTERPRISE/PRO/FREE 제외
    const unpaidSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        billingKey: null,
        planType: { notIn: ['ENTERPRISE', 'PRO', 'FREE'] },
      },
      include: {
        hospital: { select: { id: true, name: true, planType: true } },
      },
    });

    this.logger.log(`마이그레이션 대상: ${unpaidSubs.length}개 구독`);

    const results: any[] = [];

    for (const sub of unpaidSubs) {
      try {
        // 쿠폰 사용 병원은 건드리지 않음 (12개월 무료 쿠폰 등)
        if (couponHospitalIds.has(sub.hospitalId)) {
          results.push({
            hospital: sub.hospital?.name,
            hospitalId: sub.hospitalId,
            plan: sub.planType,
            status: 'skipped',
            reason: '쿠폰 사용자 (만료일 유지)',
            currentEnd: sub.currentPeriodEnd.toISOString(),
          });
          this.logger.log(`⏭️ ${sub.hospital?.name}: 쿠폰 사용자 → 스킵`);
          continue;
        }

        // 구독을 TRIAL로 리셋
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'TRIAL',
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
          },
        });

        // 병원 상태도 TRIAL로 업데이트
        await this.prisma.hospital.update({
          where: { id: sub.hospitalId },
          data: {
            subscriptionStatus: 'TRIAL',
          },
        });

        results.push({
          hospital: sub.hospital?.name,
          hospitalId: sub.hospitalId,
          plan: sub.planType,
          previousEnd: sub.currentPeriodEnd.toISOString(),
          newEnd: trialEnd.toISOString(),
          status: 'migrated',
        });

        this.logger.log(`✅ ${sub.hospital?.name}: ACTIVE → TRIAL (D-${trialDays})`);
      } catch (error) {
        results.push({
          hospital: sub.hospital?.name,
          hospitalId: sub.hospitalId,
          status: 'error',
          error: error.message,
        });
        this.logger.error(`❌ ${sub.hospital?.name}: 마이그레이션 실패 - ${error.message}`);
      }
    }

    // FREE 구독 중 D=26938 같은 비정상 데이터도 정리
    const freeSubs = await this.prisma.subscription.findMany({
      where: {
        planType: 'FREE',
        status: 'ACTIVE',
        billingKey: null,
        currentPeriodEnd: {
          gt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000), // 400일 이상 남은 비정상 데이터
        },
      },
      include: {
        hospital: { select: { name: true } },
      },
    });

    for (const sub of freeSubs) {
      try {
        // FREE는 만료 기간을 현실적으로 조정 (무료이므로 만료 개념 없지만 정리)
        const freeEnd = new Date(now);
        freeEnd.setFullYear(freeEnd.getFullYear() + 1); // 1년
        
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodEnd: freeEnd,
          },
        });
        
        results.push({
          hospital: sub.hospital?.name,
          plan: 'FREE',
          status: 'cleaned',
          note: '비정상 만료일 → 1년으로 정리',
        });
      } catch (error) {
        // 무시
      }
    }

    const migrated = results.filter(r => r.status === 'migrated').length;
    const skippedCoupon = results.filter(r => r.status === 'skipped').length;
    const cleaned = results.filter(r => r.status === 'cleaned').length;
    const errors = results.filter(r => r.status === 'error').length;

    this.logger.log(`=== 마이그레이션 완료: ${migrated}건 전환, ${skippedCoupon}건 쿠폰스킵, ${cleaned}건 정리, ${errors}건 오류 ===`);

    return {
      summary: {
        totalTargets: unpaidSubs.length,
        migrated,
        skippedCoupon,
        cleaned,
        errors,
        trialDays,
        trialEnd: trialEnd.toISOString(),
      },
      details: results,
    };
  }

  // ==================== 외국인 환자 GEO 질문 세트 시딩 ====================

  /**
   * 【외국인 GEO 실험】영어 질문 세트 + 영문 별칭을 특정 병원에 시딩
   *
   * 배경: 한국어 질문에서는 Quora/Medium 인용이 0건 (실측) —
   * 영어 질문에서만 해당 채널이 AI 인용 코퍼스에 등판함.
   * Quora 답변 축적 → AI 인용 전환을 주 단위로 추적하기 위한 트래킹 세트.
   *
   * - 중복 방지: 동일 promptText 존재 시 스킵 (재실행 안전 / idempotent)
   * - 플랜 질문 수 제한과 무관하게 admin 권한으로 추가 (실험 목적)
   */
  async seedForeignerGeoPrompts(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true, nameAliases: true, websiteUrl: true },
    });

    if (!hospital) {
      return { success: false, error: `병원을 찾을 수 없습니다: ${hospitalId}` };
    }

    // 1. 영문 별칭 추가 (AI 응답 내 영문 표기 언급 감지용)
    const englishAliases = [
      'Seoul BD Dental',
      'Seoul BD Dental Clinic',
      'BD Dental Clinic',
      'Seoul BD',
    ];
    const mergedAliases = [...new Set([...(hospital.nameAliases || []), ...englishAliases])];
    const aliasesAdded = mergedAliases.length - (hospital.nameAliases || []).length;

    await this.prisma.hospital.update({
      where: { id: hospital.id },
      data: { nameAliases: mergedAliases },
    });

    // 2. 외국인 환자 GEO 질문 세트 (영어 — Quora/Medium 인용 트래킹용)
    const foreignerPrompts: { text: string; category: string; keywords: string[] }[] = [
      {
        text: 'Best dental implant clinic in Seoul, South Korea for foreigners',
        category: '외국인-임플란트',
        keywords: ['Seoul', 'Korea'],
      },
      {
        text: 'English speaking dentist near Camp Humphreys, South Korea',
        category: '외국인-일반',
        keywords: ['Camp Humphreys', 'Pyeongtaek'],
      },
      {
        text: 'How much do dental implants cost in South Korea? Recommend a trusted clinic for international patients',
        category: '외국인-임플란트',
        keywords: ['Korea'],
      },
      {
        text: 'Best dental clinic in Cheonan or Pyeongtaek for US military families',
        category: '외국인-일반',
        keywords: ['Cheonan', 'Pyeongtaek'],
      },
      {
        text: 'Is it worth traveling to Korea for dental implants? Which clinic should I choose?',
        category: '외국인-임플란트',
        keywords: ['Korea'],
      },
      {
        text: 'Where do expats in Korea recommend getting dental implants without broker fees?',
        category: '외국인-임플란트',
        keywords: ['Korea'],
      },
    ];

    const results: { text: string; status: 'created' | 'skipped' }[] = [];

    for (const p of foreignerPrompts) {
      const existing = await this.prisma.prompt.findFirst({
        where: { hospitalId: hospital.id, promptText: p.text },
        select: { id: true },
      });

      if (existing) {
        results.push({ text: p.text, status: 'skipped' });
        continue;
      }

      await this.prisma.prompt.create({
        data: {
          hospitalId: hospital.id,
          promptText: p.text,
          promptType: 'CUSTOM',
          specialtyCategory: p.category,
          regionKeywords: p.keywords,
          isActive: true,
        },
      });
      results.push({ text: p.text, status: 'created' });
    }

    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    const activeCount = await this.prisma.prompt.count({
      where: { hospitalId: hospital.id, isActive: true },
    });

    this.logger.log(
      `[외국인 GEO 시딩] ${hospital.name}: 질문 ${created}건 생성, ${skipped}건 스킵, 별칭 ${aliasesAdded}건 추가 (활성 질문 총 ${activeCount}건)`,
    );

    return {
      success: true,
      hospital: { id: hospital.id, name: hospital.name },
      prompts: { created, skipped, details: results },
      aliases: { added: aliasesAdded, total: mergedAliases.length },
      activePromptCount: activeCount,
      note: '다음 크롤링 사이클부터 영어 질문이 4개 플랫폼에 포함됩니다. Quora/Medium 인용 여부는 인용 역분석 메뉴에서 추적하세요.',
    };
  }

  // ==================== 전체 고객사 SoV 랭킹 ====================

  /**
   * 【어드민】전체 고객 병원 SoV 랭킹
   *
   * 각 병원의 최근 N일 AI 응답에서 언급률(SoV %)을 계산해 내림차순 정렬.
   * SoV = 언급된 응답 수 / 전체 응답 수 × 100 (출석률 개념 — 순위 아님)
   *
   * 신뢰도: 응답 8건 미만 병원은 lowConfidence=true 플래그
   * (calculateDailyScore와 동일한 최소 표본 기준)
   */
  async getSovRanking(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 이전 기간 (순위 변동 계산용): since 직전 같은 길이 구간
    const prevSince = new Date(since);
    prevSince.setDate(prevSince.getDate() - days);

    // 병원별 총 응답/언급 수 — groupBy 두 번으로 집계 (raw SQL 없이 Prisma로)
    const totals = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId'],
      where: { responseDate: { gte: since } },
      _count: { _all: true },
    });

    const mentioned = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId'],
      where: { responseDate: { gte: since }, isMentioned: true },
      _count: { _all: true },
      _avg: { mentionPosition: true, sentimentScore: true },
    });

    // 1위로 호명된 횟수 (등판 중 mention_position = 1)
    const firstPlace = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId'],
      where: { responseDate: { gte: since }, isMentioned: true, mentionPosition: 1 },
      _count: { _all: true },
    });
    const firstPlaceMap = new Map(firstPlace.map(f => [f.hospitalId, f._count._all]));

    // 플랫폼별 총/언급 (병원×플랫폼)
    const platTotals = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId', 'aiPlatform'],
      where: { responseDate: { gte: since } },
      _count: { _all: true },
    });
    const platMentioned = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId', 'aiPlatform'],
      where: { responseDate: { gte: since }, isMentioned: true },
      _count: { _all: true },
    });
    const platMentionedMap = new Map(
      platMentioned.map(p => [`${p.hospitalId}|${p.aiPlatform}`, p._count._all]),
    );
    const platformsByHospital = new Map<string, Record<string, { total: number; mentioned: number; sov: number }>>();
    for (const p of platTotals) {
      const m = platMentionedMap.get(`${p.hospitalId}|${p.aiPlatform}`) ?? 0;
      if (!platformsByHospital.has(p.hospitalId)) platformsByHospital.set(p.hospitalId, {});
      platformsByHospital.get(p.hospitalId)![p.aiPlatform] = {
        total: p._count._all,
        mentioned: m,
        sov: p._count._all > 0 ? Math.round((m / p._count._all) * 1000) / 10 : 0,
      };
    }

    // 이전 기간 집계 (순위 변동)
    const prevTotals = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId'],
      where: { responseDate: { gte: prevSince, lt: since } },
      _count: { _all: true },
    });
    const prevMentioned = await this.prisma.aIResponse.groupBy({
      by: ['hospitalId'],
      where: { responseDate: { gte: prevSince, lt: since }, isMentioned: true },
      _count: { _all: true },
    });
    const prevMentionMap = new Map(prevMentioned.map(m => [m.hospitalId, m._count._all]));
    const prevRankMap = new Map<string, { rank: number; sov: number }>();
    prevTotals
      .map(t => ({
        hospitalId: t.hospitalId,
        sov: t._count._all > 0 ? ((prevMentionMap.get(t.hospitalId) ?? 0) / t._count._all) * 100 : 0,
        total: t._count._all,
      }))
      .sort((a, b) => b.sov - a.sov || b.total - a.total)
      .forEach((r, i) => prevRankMap.set(r.hospitalId, { rank: i + 1, sov: Math.round(r.sov * 10) / 10 }));

    const mentionMap = new Map(
      mentioned.map(m => [
        m.hospitalId,
        {
          count: m._count._all,
          avgPosition: m._avg.mentionPosition,
          avgSentiment: m._avg.sentimentScore,
        },
      ]),
    );

    const hospitalIds = totals.map(t => t.hospitalId);
    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: {
        id: true,
        name: true,
        regionSido: true,
        regionSigungu: true,
        specialtyType: true,
        planType: true,
      },
    });
    const hospitalMap = new Map(hospitals.map(h => [h.id, h]));

    const MIN_SAMPLE = 8;

    const ranking = totals
      .map(t => {
        const h = hospitalMap.get(t.hospitalId);
        const m = mentionMap.get(t.hospitalId);
        const total = t._count._all;
        const ours = m?.count ?? 0;
        const sov = total > 0 ? (ours / total) * 100 : 0;
        return {
          hospitalId: t.hospitalId,
          name: h?.name ?? '(삭제된 병원)',
          region: h ? `${h.regionSido} ${h.regionSigungu}` : null,
          specialtyType: h?.specialtyType ?? null,
          planType: h?.planType ?? null,
          totalResponses: total,
          mentionedResponses: ours,
          sovPercent: Math.round(sov * 10) / 10,
          avgMentionPosition: m?.avgPosition
            ? Math.round(m.avgPosition * 100) / 100
            : null,
          // 등판 중 1위로 호명된 비율 (주연 비율)
          firstPlaceCount: firstPlaceMap.get(t.hospitalId) ?? 0,
          firstPlaceRate:
            ours > 0
              ? Math.round(((firstPlaceMap.get(t.hospitalId) ?? 0) / ours) * 1000) / 10
              : null,
          // 언급 응답 평균 감성 (-1~1)
          avgSentiment:
            m?.avgSentiment !== null && m?.avgSentiment !== undefined
              ? Math.round(m.avgSentiment * 100) / 100
              : null,
          // 플랫폼별 SoV
          platforms: platformsByHospital.get(t.hospitalId) ?? {},
          lowConfidence: total < MIN_SAMPLE,
        };
      })
      .sort((a, b) => b.sovPercent - a.sovPercent || b.totalResponses - a.totalResponses)
      .map((r, i) => {
        const prev = prevRankMap.get(r.hospitalId);
        return {
          rank: i + 1,
          ...r,
          // 순위 변동: 이전 기간 순위 - 현재 순위 (+ = 상승, - = 하락, null = 신규)
          prevRank: prev?.rank ?? null,
          rankChange: prev ? prev.rank - (i + 1) : null,
          prevSovPercent: prev?.sov ?? null,
          sovChange: prev ? Math.round((r.sovPercent - prev.sov) * 10) / 10 : null,
        };
      });

    this.logger.log(`[Admin] SoV 랭킹 조회: ${ranking.length}개 병원 (최근 ${days}일)`);

    return {
      success: true,
      periodDays: days,
      hospitalCount: ranking.length,
      note: 'SoV = 언급률(%) — 순위 지표가 아닌 등판 빈도. 응답 8건 미만은 lowConfidence.',
      ranking,
    };
  }

  /**
   * 【어드민】날짜별 SoV 순위 추이
   *
   * 최근 N일 각 날짜에 대해 병원별 SoV를 계산하고 그날의 순위를 매김.
   * 특정 hospitalId 지정 시 그 병원의 일별 순위/SoV만 반환 (추이 그래프용).
   */
  async getSovDaily(days = 30, hospitalId?: string) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 날짜×병원 단위 집계 (raw: Prisma groupBy는 날짜 절단 미지원)
    const rows: Array<{
      day: Date;
      hospital_id: string;
      total: number;
      ours: number;
      avg_pos: number | null;
    }> = await this.prisma.$queryRaw`
      SELECT DATE(response_date) AS day,
             hospital_id,
             COUNT(*)::int AS total,
             SUM(CASE WHEN is_mentioned THEN 1 ELSE 0 END)::int AS ours,
             AVG(CASE WHEN is_mentioned THEN mention_position END)::float AS avg_pos
      FROM ai_responses
      WHERE response_date >= ${since}
      GROUP BY DATE(response_date), hospital_id
    `;

    // 병원 이름 매핑
    const ids = [...new Set(rows.map(r => r.hospital_id))];
    const hospitals = await this.prisma.hospital.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(hospitals.map(h => [h.id, h.name]));

    // 날짜별로 묶어 그날의 순위 계산
    const byDay = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(r);
    }

    const dailyRankings = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayRows]) => {
        const ranked = dayRows
          .map(r => ({
            hospitalId: r.hospital_id,
            name: nameMap.get(r.hospital_id) ?? '(삭제된 병원)',
            totalResponses: r.total,
            mentionedResponses: r.ours,
            sovPercent: r.total > 0 ? Math.round((r.ours / r.total) * 1000) / 10 : 0,
            avgMentionPosition: r.avg_pos ? Math.round(r.avg_pos * 100) / 100 : null,
          }))
          .sort((a, b) => b.sovPercent - a.sovPercent || b.totalResponses - a.totalResponses)
          .map((r, i) => ({ rank: i + 1, ...r }));
        return { date, hospitalCount: ranked.length, ranking: ranked };
      });

    // 특정 병원 추이만 요청한 경우: 날짜별 그 병원의 순위/SoV 시계열로 축약
    if (hospitalId) {
      const series = dailyRankings.map(d => {
        const me = d.ranking.find(r => r.hospitalId === hospitalId);
        return {
          date: d.date,
          rank: me?.rank ?? null,
          hospitalCount: d.hospitalCount,
          sovPercent: me?.sovPercent ?? null,
          avgMentionPosition: me?.avgMentionPosition ?? null,
          totalResponses: me?.totalResponses ?? 0,
        };
      });
      return {
        success: true,
        periodDays: days,
        hospitalId,
        hospitalName: nameMap.get(hospitalId) ?? null,
        series,
      };
    }

    return { success: true, periodDays: days, days: dailyRankings };
  }

  // ==================== 인용 출처 도메인 인텔리전스 ====================

  /**
   * 【어드민】전체 AI 응답의 인용 출처 도메인 집계 + 신규 등장 탐지
   *
   * cited_sources 배열을 unnest해 도메인 단위로 정규화(프로토콜/www/경로 제거).
   * firstSeen이 최근 N일 이내면 "신규 등장" — 어떤 출처가 새로 AI 인용 풀에 진입했는지 추적.
   */
  async getCitationDomains(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows: Array<{
      domain: string;
      first_seen: Date;
      last_seen: Date;
      total_citations: number;
      recent_citations: number;
      platform_count: number;
      platforms: string[];
    }> = await this.prisma.$queryRaw`
      WITH src AS (
        SELECT response_date, ai_platform,
               lower(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(unnest(cited_sources), '^https?://', ''),
                     '^www\\.', ''),
                   '/.*$', '')
               ) AS domain
        FROM ai_responses
        WHERE cited_sources IS NOT NULL
          AND array_length(cited_sources, 1) > 0
      )
      SELECT domain,
             MIN(response_date)                                            AS first_seen,
             MAX(response_date)                                            AS last_seen,
             COUNT(*)::int                                                 AS total_citations,
             (COUNT(*) FILTER (WHERE response_date >= ${since}))::int      AS recent_citations,
             COUNT(DISTINCT ai_platform)::int                              AS platform_count,
             array_agg(DISTINCT ai_platform::text)                         AS platforms
      FROM src
      WHERE domain <> '' AND length(domain) > 2
      GROUP BY domain
    `;

    const mapped = rows.map(r => ({
      domain: r.domain,
      firstSeen: new Date(r.first_seen).toISOString().slice(0, 10),
      lastSeen: new Date(r.last_seen).toISOString().slice(0, 10),
      totalCitations: r.total_citations,
      recentCitations: r.recent_citations,
      platformCount: r.platform_count,
      platforms: r.platforms,
      isNew: new Date(r.first_seen) >= since,
    }));

    // 신규 등장 (최근 N일 내 첫 인용) — 최근 인용 수 내림차순
    const newDomains = mapped
      .filter(d => d.isNew)
      .sort((a, b) => b.recentCitations - a.recentCitations);

    // 전체 TOP 30 (기존 강자 파악용)
    const topDomains = [...mapped]
      .sort((a, b) => b.totalCitations - a.totalCitations)
      .slice(0, 30);

    this.logger.log(
      `[Admin] 인용 도메인 집계: 전체 ${mapped.length}종, 최근 ${days}일 신규 ${newDomains.length}종`,
    );

    return {
      success: true,
      periodDays: days,
      totalDomains: mapped.length,
      newDomainCount: newDomains.length,
      newDomains,
      topDomains,
    };
  }

  // ==================== 신뢰검증(TRUST) 단계 심층 진단 ====================

  /**
   * 【어드민】특정 병원의 신뢰검증 단계(REVIEW+FEAR 의도) 심층 진단
   *
   * - 이 단계 질문에서 병원 SoV / 언급 실패 시 대신 언급된 경쟁사
   * - AI가 이 단계 답변에서 실제 인용한 출처 도메인 (어디를 공략해야 하는지)
   * - 질문별 성적 (어떤 후기 질문에서 지고 있는지)
   */
  async getTrustDiagnosis(hospitalId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true, regionSido: true, regionSigungu: true },
    });
    if (!hospital) return { success: false, error: '병원을 찾을 수 없습니다' };

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: since },
        queryIntent: { in: ['REVIEW', 'FEAR'] },
      },
      select: {
        aiPlatform: true,
        queryIntent: true,
        isMentioned: true,
        mentionPosition: true,
        sentimentScore: true,
        competitorsMentioned: true,
        citedSources: true,
        archivedPromptText: true,
        prompt: { select: { promptText: true } },
      },
    });

    const total = responses.length;
    const mentioned = responses.filter(r => r.isMentioned).length;

    // 경쟁사 언급 집계 (미언급 응답에서 누가 대신 등판했나)
    const compWhenAbsent = new Map<string, number>();
    const compOverall = new Map<string, number>();
    for (const r of responses) {
      for (const c of r.competitorsMentioned ?? []) {
        compOverall.set(c, (compOverall.get(c) ?? 0) + 1);
        if (!r.isMentioned) compWhenAbsent.set(c, (compWhenAbsent.get(c) ?? 0) + 1);
      }
    }
    const toSorted = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([name, count]) => ({ name, count }));

    // 이 단계 답변에서 AI가 인용한 출처 도메인
    const domainCount = new Map<string, number>();
    for (const r of responses) {
      for (const s of r.citedSources ?? []) {
        const domain = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        if (domain.length > 2) domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
      }
    }

    // 질문별 성적
    const byPrompt = new Map<string, { total: number; mentioned: number; intent: string }>();
    for (const r of responses) {
      const text = r.prompt?.promptText ?? r.archivedPromptText ?? '(질문 유실)';
      if (!byPrompt.has(text)) byPrompt.set(text, { total: 0, mentioned: 0, intent: r.queryIntent as string });
      const p = byPrompt.get(text)!;
      p.total += 1;
      if (r.isMentioned) p.mentioned += 1;
    }

    // 플랫폼별
    const byPlatform = new Map<string, { total: number; mentioned: number }>();
    for (const r of responses) {
      if (!byPlatform.has(r.aiPlatform)) byPlatform.set(r.aiPlatform, { total: 0, mentioned: 0 });
      const p = byPlatform.get(r.aiPlatform)!;
      p.total += 1;
      if (r.isMentioned) p.mentioned += 1;
    }

    const sentiments = responses.filter(r => r.isMentioned && r.sentimentScore !== null);

    return {
      success: true,
      hospital: { ...hospital },
      periodDays: days,
      trustStage: {
        totalResponses: total,
        mentionedResponses: mentioned,
        sovPercent: total > 0 ? Math.round((mentioned / total) * 1000) / 10 : 0,
        avgSentiment: sentiments.length > 0
          ? Math.round((sentiments.reduce((s, r) => s + (r.sentimentScore ?? 0), 0) / sentiments.length) * 100) / 100
          : null,
      },
      competitorsWhenAbsent: toSorted(compWhenAbsent),
      competitorsOverall: toSorted(compOverall),
      citedDomains: [...domainCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([domain, count]) => ({ domain, count })),
      prompts: [...byPrompt.entries()].map(([text, p]) => ({
        promptText: text,
        intent: p.intent,
        total: p.total,
        mentioned: p.mentioned,
        sovPercent: p.total > 0 ? Math.round((p.mentioned / p.total) * 1000) / 10 : 0,
      })).sort((a, b) => a.sovPercent - b.sovPercent),
      platforms: [...byPlatform.entries()].map(([platform, p]) => ({
        platform,
        total: p.total,
        mentioned: p.mentioned,
        sovPercent: p.total > 0 ? Math.round((p.mentioned / p.total) * 1000) / 10 : 0,
      })).sort((a, b) => b.sovPercent - a.sovPercent),
    };
  }

  // ==================== 병원 원장용 대시보드 (접근코드 게이트) ====================

  /**
   * 병원별 접근코드 산출 — HMAC-SHA256(ADMIN_SECRET, hospitalId) 앞 12자
   *
   * DB 스키마 변경 없이 병원마다 고유한 코드가 결정론적으로 나온다.
   * 이 코드로는 해당 병원 스코프 데이터만 열람 가능 (ADMIN_SECRET 자체는 노출 안 됨).
   * ADMIN_SECRET 미설정 환경에서는 null → 무조건 차단.
   */
  boardCodeFor(hospitalId: string): string | null {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || !hospitalId) return null;
    return createHmac('sha256', secret)
      .update(`board:${hospitalId}`)
      .digest('hex')
      .slice(0, 12);
  }

  /**
   * 【원장용】병원 스코프 대시보드 데이터
   *
   * 전체 랭킹을 집계하되 본인 병원 지표 + 익명화된 주변 경쟁(±3위)만 반환.
   * 다른 고객 병원의 실명/ID는 절대 노출하지 않는다.
   */
  async getHospitalBoard(hospitalId: string, days = 30) {
    const [rankingRes, dailyRes] = await Promise.all([
      this.getSovRanking(days),
      this.getSovDaily(Math.min(days, 90), hospitalId),
    ]);

    const idx = rankingRes.ranking.findIndex(r => r.hospitalId === hospitalId);
    if (idx === -1) {
      return {
        success: false,
        error: '해당 기간에 수집된 데이터가 없습니다',
      };
    }
    const me = rankingRes.ranking[idx];

    // 주변 경쟁 병원 (±3위) — 본인만 실명, 나머지는 지역+익명 라벨 (고객사 보호)
    const windowStart = Math.max(0, idx - 3);
    const windowRows = rankingRes.ranking.slice(windowStart, idx + 4);
    let anonSeq = 0;
    const nearby = windowRows.map(r => {
      const isMe = r.hospitalId === hospitalId;
      const label = isMe
        ? r.name
        : `${r.region?.split(' ')[0] ?? '전국'} 소재 병원 ${String.fromCharCode(65 + anonSeq++)}`;
      return {
        rank: r.rank,
        name: label,
        isMe,
        sovPercent: r.sovPercent,
        avgMentionPosition: r.avgMentionPosition,
        firstPlaceRate: isMe ? r.firstPlaceRate : null,
        rankChange: r.rankChange,
      };
    });

    const percentile = Math.max(
      1,
      Math.round((me.rank / rankingRes.hospitalCount) * 100),
    );

    this.logger.log(
      `[Board] 원장용 보드 조회: ${me.name} (${me.rank}위/${rankingRes.hospitalCount})`,
    );

    return {
      success: true,
      periodDays: days,
      hospital: { id: hospitalId, name: me.name, region: me.region },
      rank: me.rank,
      hospitalCount: rankingRes.hospitalCount,
      percentile, // 상위 N%
      prevRank: me.prevRank,
      rankChange: me.rankChange,
      sovPercent: me.sovPercent,
      prevSovPercent: me.prevSovPercent,
      sovChange: me.sovChange,
      totalResponses: me.totalResponses,
      mentionedResponses: me.mentionedResponses,
      avgMentionPosition: me.avgMentionPosition,
      firstPlaceCount: me.firstPlaceCount,
      firstPlaceRate: me.firstPlaceRate,
      avgSentiment: me.avgSentiment,
      platforms: me.platforms,
      lowConfidence: me.lowConfidence,
      daily: 'series' in dailyRes ? dailyRes.series : [],
      nearby,
    };
  }
  /**
   * 【크롤 전수 점검】병원별 크롤 상태 감사
   * - 오늘/최근 7일 잡 상태 분포 (COMPLETED/FAILED/RUNNING/PENDING)
   * - FAILED 사유 분류: [SKIP] 주기 미도래 / [SKIP] 월 한도 / [ZOMBIE] / 실제 실패
   * - 병원별 마지막 성공 크롤 경과일 → 대상인데 안 도는 병원 탐지
   * - 오늘 DailyScore 커버리지
   */
  async getCrawlHealth(days = 7) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    // 1) 크롤 대상 병원 (스케줄러와 동일 조건)
    const hospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      select: {
        id: true, name: true, planType: true, subscriptionStatus: true, createdAt: true,
        _count: { select: { prompts: { where: { isActive: true } } } },
      },
    });

    // 2) 최근 N일 잡 전체
    const jobs = await this.prisma.crawlJob.findMany({
      where: { createdAt: { gte: since } },
      select: {
        hospitalId: true, status: true, errorMessage: true,
        totalPrompts: true, completed: true, failed: true,
        createdAt: true, completedAt: true, startedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3) 병원별 마지막 성공 크롤
    const lastCompleted = await this.prisma.crawlJob.groupBy({
      by: ['hospitalId'],
      where: { status: 'COMPLETED' },
      _max: { completedAt: true },
    });
    const lastMap = new Map(lastCompleted.map((r) => [r.hospitalId, r._max.completedAt]));

    // 4) 오늘 점수 커버리지
    const scoredToday = await this.prisma.dailyScore.findMany({
      where: { scoreDate: { gte: todayUTC } },
      select: { hospitalId: true },
    });
    const scoredSet = new Set(scoredToday.map((s) => s.hospitalId));

    // 잡 분류기
    const classify = (j: { status: string; errorMessage: string | null }) => {
      if (j.status === 'COMPLETED') return 'completed';
      if (j.status === 'RUNNING') return 'running';
      if (j.status === 'PENDING') return 'pending';
      const msg = j.errorMessage || '';
      if (msg.includes('크롤 주기 미도래')) return 'skip_interval';
      if (msg.includes('월간 크롤링 한도')) return 'skip_monthly_limit';
      if (msg.includes('[ZOMBIE]')) return 'zombie';
      return 'failed_real';
    };

    // 오늘 잡 / 기간 잡 분리 집계
    const todayJobs = jobs.filter((j) => j.createdAt >= todayUTC);
    const agg = (list: typeof jobs) => {
      const out: Record<string, number> = {};
      for (const j of list) out[classify(j)] = (out[classify(j)] || 0) + 1;
      return out;
    };

    // 실제 실패 사유 상위
    const realFailures = jobs.filter((j) => classify(j) === 'failed_real');
    const failureReasons: Record<string, number> = {};
    for (const j of realFailures) {
      const key = (j.errorMessage || '(사유 없음)').slice(0, 80);
      failureReasons[key] = (failureReasons[key] || 0) + 1;
    }

    // 병원별 상태표
    const cutoffEnv = process.env.GRANDFATHER_CUTOFF;
    const gfCutoff = cutoffEnv === '' ? null : new Date(cutoffEnv || '2026-08-20T12:00:00+09:00');
    const perHospital = hospitals.map((h) => {
      const last = lastMap.get(h.id) || null;
      const daysSince = last ? (now.getTime() - new Date(last).getTime()) / 86400000 : null;
      const hJobs = jobs.filter((j) => j.hospitalId === h.id);
      const isGf = h.planType === 'STARTER' && gfCutoff !== null && h.createdAt < gfCutoff;
      // 기대 주기: 유예/M+ = 매일(1일), 신규 STARTER = 3일, FREE = 7일
      const expectedDays = isGf ? 1 : h.planType === 'FREE' ? 7 : h.planType === 'STARTER' ? 3 : 1;
      const overdue = daysSince === null ? true : daysSince > expectedDays + 1.5;
      return {
        name: h.name,
        plan: h.planType,
        status: h.subscriptionStatus,
        activePrompts: h._count.prompts,
        grandfathered: isGf,
        lastCompletedAt: last,
        daysSinceLastCrawl: daysSince !== null ? Math.round(daysSince * 10) / 10 : null,
        scoredToday: scoredSet.has(h.id),
        jobsInPeriod: hJobs.length,
        overdue,
      };
    });

    const overdueList = perHospital.filter((h) => h.overdue);
    const noPrompts = perHospital.filter((h) => h.activePrompts === 0);

    return {
      generatedAt: now.toISOString(),
      periodDays: days,
      eligibleHospitals: hospitals.length,
      grandfathered: perHospital.filter((h) => h.grandfathered).length,
      today: { jobs: todayJobs.length, byResult: agg(todayJobs), scoredHospitals: scoredSet.size },
      period: { jobs: jobs.length, byResult: agg(jobs) },
      topFailureReasons: Object.entries(failureReasons)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([reason, count]) => ({ reason, count })),
      overdueCount: overdueList.length,
      overdueHospitals: overdueList.slice(0, 30),
      noPromptHospitals: noPrompts.map((h) => ({ name: h.name, plan: h.plan })),
      perHospital,
    };
  }

}
