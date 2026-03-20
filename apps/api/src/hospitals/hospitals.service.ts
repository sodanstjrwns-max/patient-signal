import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { PlanGuard } from '../common/guards/plan.guard';

@Injectable()
export class HospitalsService {
  private readonly logger = new Logger(HospitalsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateHospitalDto) {
    // 병원 생성 (무료 플랜)
    // 새 필드(coreTreatments 등)가 DB에 아직 없을 수 있으므로 fallback 처리
    let hospital;
    try {
      hospital = await this.prisma.hospital.create({
        data: {
          name: dto.name,
          businessNumber: dto.businessNumber,
          specialtyType: dto.specialtyType,
          subSpecialties: dto.subSpecialties || [],
          coreTreatments: dto.coreTreatments || [],
          targetRegions: dto.targetRegions || [],
          hospitalStrengths: dto.hospitalStrengths || [],
          regionSido: dto.regionSido,
          regionSigungu: dto.regionSigungu,
          regionDong: dto.regionDong,
          address: dto.address,
          websiteUrl: dto.websiteUrl,
          naverPlaceId: dto.naverPlaceId,
          planType: 'FREE',
          subscriptionStatus: 'ACTIVE',
        },
      });
    } catch (err) {
      // DB에 새 컬럼이 없는 경우 fallback (prisma db push 전)
      this.logger.warn(`병원 생성 fallback (새 필드 미반영): ${err?.message}`);
      hospital = await this.prisma.hospital.create({
        data: {
          name: dto.name,
          businessNumber: dto.businessNumber,
          specialtyType: dto.specialtyType,
          subSpecialties: dto.subSpecialties || [],
          regionSido: dto.regionSido,
          regionSigungu: dto.regionSigungu,
          regionDong: dto.regionDong,
          address: dto.address,
          websiteUrl: dto.websiteUrl,
          naverPlaceId: dto.naverPlaceId,
          planType: 'FREE',
          subscriptionStatus: 'ACTIVE',
        },
      });
    }

    // 사용자와 병원 연결
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        hospitalId: hospital.id,
        role: 'OWNER',
      },
    });

    // 무료 플랜 구독 생성 (무기한)
    const now = new Date();
    const farFuture = new Date('2099-12-31T23:59:59.000Z');

    try {
      await this.prisma.subscription.create({
        data: {
          hospitalId: hospital.id,
          planType: 'FREE',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: farFuture,
        },
      });
    } catch (err) {
      this.logger.warn(`Subscription 생성 실패 (무시됨): ${err?.message}`);
    }

    // ── 경쟁 병원 등록 (FREE 플랜은 경쟁사 0개이므로 스킵, 유료 전환 시 활성화) ──
    if (dto.competitorNames && dto.competitorNames.length > 0) {
      const planLimits = PlanGuard.PLAN_LIMITS['FREE'];
      const maxCompetitors = planLimits.maxCompetitors;
      const competitorRegion = `${dto.regionSido} ${dto.regionSigungu}`;
      
      // FREE 플랜이라도 데이터는 저장 (비활성), 업그레이드 시 활성화
      for (const name of dto.competitorNames.slice(0, 5)) {
        try {
          await this.prisma.competitor.create({
            data: {
              hospitalId: hospital.id,
              competitorName: name.trim(),
              competitorRegion: competitorRegion,
              isActive: maxCompetitors > 0, // FREE=false, 유료=true
            },
          });
        } catch (err) {
          this.logger.warn(`경쟁사 등록 실패 (${name}): ${err?.message}`);
        }
      }
    }

    // 자동 프롬프트 생성 (주력 진료 + 내원 지역 + 기본 지역 기반)
    // 플랜별 질문 수 제한 적용 (실패해도 온보딩은 진행)
    try {
      await this.createAutoPrompts(hospital.id, dto, 'FREE');
    } catch (err) {
      this.logger.warn(`자동 프롬프트 생성 실패 (무시됨): ${err?.message}`);
    }

    return hospital;
  }

  async findOne(hospitalId: string) {
    try {
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
          subscriptions: true,
          _count: {
            select: {
              prompts: true,
              competitors: true,
            },
          },
        },
      });

      if (!hospital) {
        throw new NotFoundException('병원을 찾을 수 없습니다');
      }

      return hospital;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      // subscriptions 관계 에러 시 subscription 없이 조회
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        include: {
          users: {
            select: { id: true, email: true, name: true, role: true },
          },
          _count: {
            select: { prompts: true, competitors: true },
          },
        },
      });
      if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');
      return { ...hospital, subscriptions: [] };
    }
  }

  async update(hospitalId: string, userId: string, dto: UpdateHospitalDto) {
    // 권한 확인
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.hospitalId !== hospitalId || !['OWNER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('수정 권한이 없습니다');
    }

    return this.prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        name: dto.name,
        businessNumber: dto.businessNumber,
        specialtyType: dto.specialtyType,
        subSpecialties: dto.subSpecialties,
        regionSido: dto.regionSido,
        regionSigungu: dto.regionSigungu,
        regionDong: dto.regionDong,
        address: dto.address,
        websiteUrl: dto.websiteUrl,
        naverPlaceId: dto.naverPlaceId,
      },
    });
  }

  async getDashboard(hospitalId: string) {
    const [hospital, latestScore, recentScores, prompts, competitors] = await Promise.all([
      this.prisma.hospital.findUnique({
        where: { id: hospitalId },
      }),
      this.prisma.dailyScore.findFirst({
        where: { hospitalId },
        orderBy: { scoreDate: 'desc' },
      }),
      this.prisma.dailyScore.findMany({
        where: { hospitalId },
        orderBy: { scoreDate: 'desc' },
        take: 30,
      }),
      this.prisma.prompt.count({
        where: { hospitalId, isActive: true },
      }),
      this.prisma.competitor.count({
        where: { hospitalId, isActive: true },
      }),
    ]);

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    // 【최적화 R3】순차 3개 쿼리 → 병렬화
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [recentMentions, totalResponses, sentimentResponses] = await Promise.all([
      this.prisma.aIResponse.count({
        where: { hospitalId, isMentioned: true, responseDate: { gte: last7Days } },
      }),
      this.prisma.aIResponse.count({
        where: { hospitalId, responseDate: { gte: last7Days } },
      }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: last30Days }, sentimentLabel: { not: null } },
        select: { sentimentLabel: true, isMentioned: true },
      }),
    ]);

    const totalSentiment = sentimentResponses.length;
    const positiveCount = sentimentResponses.filter(r => r.sentimentLabel === 'POSITIVE').length;
    const neutralCount = sentimentResponses.filter(r => r.sentimentLabel === 'NEUTRAL').length;
    const negativeCount = sentimentResponses.filter(r => r.sentimentLabel === 'NEGATIVE').length;

    // 언급된 응답 중 감성 분석 (언급됐을 때 어떤 톤인지가 더 중요)
    const mentionedSentiment = sentimentResponses.filter(r => r.isMentioned);
    const mentionedTotal = mentionedSentiment.length;
    const mentionedPositive = mentionedSentiment.filter(r => r.sentimentLabel === 'POSITIVE').length;
    const mentionedNegative = mentionedSentiment.filter(r => r.sentimentLabel === 'NEGATIVE').length;

    return {
      hospital,
      overallScore: latestScore?.overallScore ?? 0,
      specialtyScores: latestScore?.specialtyScores ?? {},
      platformScores: latestScore?.platformScores ?? {},
      scoreHistory: recentScores.reverse(),
      stats: {
        totalPrompts: prompts,
        totalCompetitors: competitors,
        mentionRate: totalResponses > 0 ? (recentMentions / totalResponses) * 100 : 0,
        recentMentions,
      },
      sentiment: {
        total: totalSentiment,
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        positiveRate: totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 100) : 0,
        negativeRate: totalSentiment > 0 ? Math.round((negativeCount / totalSentiment) * 100) : 0,
        neutralRate: totalSentiment > 0 ? Math.round((neutralCount / totalSentiment) * 100) : 0,
        // 언급 시 감성 (병원이 AI에서 언급될 때의 톤)
        mentioned: {
          total: mentionedTotal,
          positiveRate: mentionedTotal > 0 ? Math.round((mentionedPositive / mentionedTotal) * 100) : 0,
          negativeRate: mentionedTotal > 0 ? Math.round((mentionedNegative / mentionedTotal) * 100) : 0,
        },
      },
    };
  }

  /**
   * 자동 프롬프트 생성 v3 - 실전 환자 AI 검색 패턴 기반
   * 
   * 플랜별 질문 수 제한:
   *   STARTER: 5개 (핵심 추천 질문만)
   *   STANDARD: 15개 (추천 + 비교 + 가격 + 증상)
   *   PRO: 35개 (전체 카테고리)
   *   ENTERPRISE: 무제한
   * 
   * @param planType - 현재 플랜 (질문 수 제한 적용)
   * @param existingCount - 이미 생성된 질문 수 (업그레이드 시 추가분만 계산)
   */
  async createAutoPrompts(hospitalId: string, dto: CreateHospitalDto, planType: string = 'FREE', existingCount: number = 0) {
    const planLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxPrompts = planLimits.maxPrompts === -1 ? 100 : planLimits.maxPrompts;
    const availableSlots = Math.max(0, maxPrompts - existingCount);

    if (availableSlots <= 0) {
      this.logger.log(`[${planType}] 질문 슬롯 없음 (기존 ${existingCount}/${maxPrompts})`);
      return { created: 0, prompts: [] };
    }

    this.logger.log(`[${planType}] 질문 생성 시작: 최대 ${availableSlots}개 (기존 ${existingCount}, 한도 ${maxPrompts})`);

    const templates: string[] = [];

    // ── 지역 변형 준비 ──
    const fullRegion = dto.regionDong
      ? `${dto.regionSido} ${dto.regionSigungu} ${dto.regionDong}`
      : `${dto.regionSido} ${dto.regionSigungu}`;
    const shortRegion = dto.regionSigungu.replace(/[시군구]$/, '');
    const dong = dto.regionDong || '';
    const specialtyName = this.getSpecialtyName(dto.specialtyType);

    // 내원 지역 (입력값 우선, 없으면 기본 지역)
    const targetRegions = dto.targetRegions?.length ? dto.targetRegions : [];
    // 질문에 쓸 대표 지역들 (중복 제거)
    const regions = [...new Set([
      ...targetRegions.slice(0, 3),
      shortRegion,
      ...(dong ? [dong] : []),
    ])];

    // 주력 진료 (입력값 우선, 없으면 subSpecialties)
    const treatments = dto.coreTreatments?.length
      ? dto.coreTreatments
      : (dto.subSpecialties?.length ? dto.subSpecialties : []);

    // ═══════════════════════════════════════════
    // ① 추천 탐색 (기본, 가장 중요)
    // ═══════════════════════════════════════════
    // 지역 × 진료과목 기본 추천
    for (const r of regions.slice(0, 3)) {
      templates.push(`${r} ${specialtyName} 추천해줘`);
    }
    templates.push(`${fullRegion} 잘하는 ${specialtyName} 어디야?`);

    // 주력 진료별 추천 (다양한 말투)
    const recommendPatterns = [
      (r: string, t: string) => `${r}에서 ${t} 잘하는 ${specialtyName} 추천해줘`,
      (r: string, t: string) => `${t} 전문 ${specialtyName} ${r} 근처에 있어?`,
      (r: string, t: string) => `${r} ${t} 잘한다고 소문난 ${specialtyName} 알려줘`,
      (r: string, t: string) => `${t} 하려는데 ${r} 쪽에 괜찮은 ${specialtyName} 있을까?`,
    ];
    for (const t of treatments.slice(0, 5)) {
      const r = regions[templates.length % regions.length] || shortRegion;
      const pattern = recommendPatterns[templates.length % recommendPatterns.length];
      templates.push(pattern(r, t));
    }

    // ═══════════════════════════════════════════
    // ② 비교 평가
    // ═══════════════════════════════════════════
    templates.push(`${shortRegion} ${specialtyName} 비교해서 알려줘`);
    if (treatments.length > 0) {
      templates.push(`${shortRegion} ${treatments[0]} ${specialtyName} 어디가 제일 잘해?`);
    }
    if (treatments.length >= 2) {
      templates.push(`${treatments[0]}이랑 ${treatments[1]} 같이 하려는데 ${shortRegion} ${specialtyName} 어디가 좋아?`);
    }

    // ═══════════════════════════════════════════
    // ③ 가격/비용 질문
    // ═══════════════════════════════════════════
    if (treatments.length > 0) {
      const topTreatment = treatments[0];
      templates.push(
        `${shortRegion} ${topTreatment} 가격 합리적인 ${specialtyName} 추천해줘`,
        `${topTreatment} 비용 보통 얼마야? ${shortRegion} 기준으로 알려줘`,
      );
    }
    templates.push(`${shortRegion} ${specialtyName} 가격 착한 곳 알려줘`);

    // ═══════════════════════════════════════════
    // ④ 증상/상황 기반 질문 (진료과목별 특화)
    // ═══════════════════════════════════════════
    const symptomQuestions = this.getSymptomQuestions(dto.specialtyType, shortRegion, specialtyName, treatments);
    templates.push(...symptomQuestions);

    // ═══════════════════════════════════════════
    // ⑤ 공포/불안 해소 질문 (진료과목별)
    // ═══════════════════════════════════════════
    const anxietyQuestions = this.getAnxietyQuestions(dto.specialtyType, shortRegion, specialtyName);
    templates.push(...anxietyQuestions);

    // ═══════════════════════════════════════════
    // ⑥ 후기/평판 질문
    // ═══════════════════════════════════════════
    templates.push(
      `${shortRegion} ${specialtyName} 후기 좋은 곳 알려줘`,
      `${shortRegion} ${specialtyName} 실제 다녀본 사람들 평가 좋은 곳 어디야?`,
    );
    if (treatments.length > 0) {
      templates.push(`${shortRegion} ${treatments[0]} 후기 좋은 ${specialtyName} 추천해줘`);
    }

    // ═══════════════════════════════════════════
    // ⑦ 조건 필터 질문
    // ═══════════════════════════════════════════
    const conditionQuestions = this.getConditionQuestions(dto.specialtyType, shortRegion, specialtyName);
    templates.push(...conditionQuestions);

    // ═══════════════════════════════════════════
    // ⑧ 병원 강점 기반 질문 (핵심 차별화!)
    // ═══════════════════════════════════════════
    const strengths = dto.hospitalStrengths || [];
    const strengthQuestions = this.getStrengthQuestions(
      strengths, dto.specialtyType, shortRegion, specialtyName, treatments,
    );
    templates.push(...strengthQuestions);

    // ═══════════════════════════════════════════
    // ⑨ 내원 지역 특화 (입력된 경우)
    // ═══════════════════════════════════════════
    if (targetRegions.length > 0) {
      for (const r of targetRegions.slice(0, 3)) {
        if (treatments.length > 0) {
          templates.push(`${r} 근처 ${treatments[0]} 잘하는 ${specialtyName} 있어?`);
        }
        templates.push(`${r}에서 가까운 ${specialtyName} 중에 잘하는 곳 알려줘`);
      }
    }

    // 중복 제거 후 플랜 한도에 맞게 자르기
    const uniqueTemplates = [...new Set(templates)];

    // 플랜별 우선순위: ① 추천 → ② 비교 → ③ 가격 → ④ 증상 → ⑤ 공포 → ⑥ 후기 → ⑦ 조건 → ⑧ 강점 → ⑨ 지역
    // (templates에 순서대로 push했으므로 앞에서부터 자르면 자연스럽게 우선순위 적용)
    const limitedTemplates = uniqueTemplates.slice(0, availableSlots);

    this.logger.log(`[${planType}] 질문 생성: ${limitedTemplates.length}개 (후보 ${uniqueTemplates.length}개 중)`);

    await this.prisma.prompt.createMany({
      data: limitedTemplates.map((text) => ({
        hospitalId,
        promptText: text,
        promptType: 'AUTO_GENERATED' as const,
        specialtyCategory: dto.specialtyType,
        regionKeywords: [
          dto.regionSido,
          dto.regionSigungu,
          dto.regionDong,
          ...(dto.targetRegions || []),
        ].filter(Boolean) as string[],
        isActive: true,
      })),
    });

    return { created: limitedTemplates.length, prompts: limitedTemplates, totalCandidates: uniqueTemplates.length };
  }

  /**
   * ④ 증상/상황 기반 질문 (진료과목별 특화)
   */
  private getSymptomQuestions(type: string, region: string, name: string, treatments: string[]): string[] {
    const q: string[] = [];
    switch (type) {
      case 'DENTAL':
        q.push(
          `이가 너무 아픈데 ${region} ${name} 어디 가면 좋을까?`,
          `앞니가 부러졌는데 ${region}에서 급하게 볼 수 있는 ${name} 있어?`,
          `잇몸에서 피가 나는데 ${region} ${name} 추천해줘`,
          `오래된 충치 치료 안 해서 심해졌는데 ${region} ${name} 어디가 좋아?`,
        );
        if (treatments.some(t => t.includes('임플란트'))) {
          q.push(`이빨 빠진 자리에 임플란트 해야 하는데 ${region}에서 잘하는 ${name} 알려줘`);
        }
        if (treatments.some(t => t.includes('교정') || t.includes('투명'))) {
          q.push(`치아 삐뚤어서 교정하고 싶은데 ${region} 교정 잘하는 ${name} 어디야?`);
        }
        break;
      case 'DERMATOLOGY':
        q.push(
          `얼굴에 여드름이 계속 나는데 ${region} ${name} 추천해줘`,
          `기미가 갑자기 심해졌는데 ${region} ${name} 어디가 좋아?`,
          `피부가 너무 건조하고 가려운데 ${region} ${name} 알려줘`,
          `등에 여드름 자국이 심한데 ${region}에서 치료 잘하는 ${name} 있어?`,
        );
        break;
      case 'PLASTIC_SURGERY':
        q.push(
          `코가 낮아서 고민인데 ${region} ${name} 자연스럽게 잘하는 곳 추천해줘`,
          `쌍꺼풀 수술 자연스럽게 잘하는 ${region} ${name} 알려줘`,
          `나이 들면서 처진 피부 리프팅 잘하는 ${region} ${name} 어디야?`,
        );
        break;
      case 'OPHTHALMOLOGY':
        q.push(
          `눈이 침침하고 잘 안 보이는데 ${region} ${name} 추천해줘`,
          `시력 나빠서 라식이나 라섹 하고 싶은데 ${region} ${name} 어디가 좋아?`,
          `눈이 자주 건조하고 뻑뻑한데 ${region} ${name} 알려줘`,
        );
        break;
      case 'KOREAN_MEDICINE':
        q.push(
          `허리가 너무 아픈데 ${region} ${name} 추천해줘`,
          `목이랑 어깨가 항상 뻣뻣한데 ${region} ${name} 잘하는 곳 알려줘`,
          `체중이 잘 안 빠지는데 ${region} 한방다이어트 잘하는 ${name} 있어?`,
        );
        break;
      default:
        q.push(
          `몸이 안 좋은데 ${region} ${name} 추천해줘`,
          `건강검진 받고 싶은데 ${region} ${name} 어디가 좋아?`,
        );
    }
    return q;
  }

  /**
   * ⑤ 공포/불안 해소 질문
   */
  private getAnxietyQuestions(type: string, region: string, name: string): string[] {
    const q: string[] = [];
    switch (type) {
      case 'DENTAL':
        q.push(
          `${name} 무서워서 못 가겠는데 ${region}에 무통 치료 잘하는 곳 있어?`,
          `치과 공포증 있는데 ${region}에서 편하게 치료받을 수 있는 ${name} 추천해줘`,
        );
        break;
      case 'PLASTIC_SURGERY':
        q.push(
          `성형 부작용 걱정되는데 ${region}에서 안전하게 잘하는 ${name} 추천해줘`,
          `재수술 무서운데 ${region} ${name} 중에 경험 많은 곳 알려줘`,
        );
        break;
      case 'OPHTHALMOLOGY':
        q.push(
          `라식 부작용 걱정되는데 ${region}에서 안전하게 잘하는 ${name} 추천해줘`,
        );
        break;
      default:
        q.push(
          `병원 가기 무서운데 ${region}에서 친절하고 편한 ${name} 추천해줘`,
        );
    }
    return q;
  }

  /**
   * ⑦ 조건 필터 질문
   */
  private getConditionQuestions(type: string, region: string, name: string): string[] {
    const q: string[] = [];
    q.push(
      `${region} ${name} 야간 진료 되는 곳 있어?`,
      `${region} ${name} 주말에도 진료하는 곳 알려줘`,
    );
    switch (type) {
      case 'DENTAL':
        q.push(
          `${region} ${name} 일요일에도 하는 곳 있어?`,
          `아이 데리고 가기 좋은 ${region} 소아 전문 ${name} 추천해줘`,
        );
        break;
      case 'DERMATOLOGY':
        q.push(
          `${region} ${name} 남자도 가기 편한 곳 알려줘`,
          `상담 꼼꼼하게 해주는 ${region} ${name} 추천해줘`,
        );
        break;
      case 'PLASTIC_SURGERY':
        q.push(
          `${region} ${name} 상담 무료인 곳 있어?`,
          `원장님이 직접 수술하는 ${region} ${name} 알려줘`,
        );
        break;
      default:
        q.push(
          `${region} ${name} 주차 편한 곳 추천해줘`,
        );
    }
    return q;
  }

  /**
   * ⑧ 병원 강점 기반 질문 생성
   * 강점 키워드를 분석해서 해당 카테고리의 질문을 강화
   */
  private getStrengthQuestions(
    strengths: string[],
    type: string,
    region: string,
    name: string,
    treatments: string[],
  ): string[] {
    if (strengths.length === 0) return [];
    const q: string[] = [];
    const t0 = treatments[0] || '';

    // 강점 키워드 → 질문 매핑
    const strengthMap: Record<string, (r: string, n: string, t: string) => string[]> = {
      // ── 진료 환경 ──
      '무통치료': (r, n, t) => [
        `${r}에서 무통으로 치료해주는 ${n} 있어?`,
        `통증 없이 ${t || '치료'} 받을 수 있는 ${r} ${n} 추천해줘`,
        `주사 안 아프게 놓는 ${r} ${n} 어디야?`,
      ],
      '친절': (r, n) => [
        `${r} ${n} 중에 의사 선생님 친절한 곳 어디야?`,
        `설명 잘 해주고 친절한 ${r} ${n} 추천해줘`,
      ],
      '최신장비': (r, n, t) => [
        `최신 장비로 ${t || '치료'} 하는 ${r} ${n} 추천해줘`,
        `${r} ${n} 중에 시설 좋은 곳 알려줘`,
      ],
      '감염관리': (r, n) => [
        `위생 철저한 ${r} ${n} 추천해줘`,
        `${r} ${n} 중에 감염관리 잘하는 곳 어디야?`,
      ],
      // ── 접근성 ──
      '야간진료': (r, n) => [
        `퇴근 후에 갈 수 있는 ${r} ${n} 있어?`,
        `${r} ${n} 저녁 8시 이후에도 진료하는 곳 알려줘`,
      ],
      '주말진료': (r, n) => [
        `토요일에도 진료하는 ${r} ${n} 추천해줘`,
        `주말에 갈 수 있는 ${r} ${n} 어디 있어?`,
      ],
      '주차편리': (r, n) => [
        `주차 걱정 없이 갈 수 있는 ${r} ${n} 추천해줘`,
        `${r} ${n} 주차 편한 곳 알려줘`,
      ],
      '역세권': (r, n) => [
        `지하철역에서 가까운 ${r} ${n} 추천해줘`,
        `대중교통 편한 ${r} ${n} 어디야?`,
      ],
      // ── 전문성 ──
      '경력풍부': (r, n, t) => [
        `${t || '진료'} 경험 많은 원장님 있는 ${r} ${n} 추천해줘`,
        `${r} ${n} 중에 베테랑 의사 있는 곳 알려줘`,
      ],
      '대학병원급': (r, n) => [
        `대학병원급 시스템 갖춘 ${r} ${n} 있어?`,
        `${r}에서 대학병원처럼 체계적인 ${n} 추천해줘`,
      ],
      '원장직접진료': (r, n) => [
        `원장님이 직접 진료하는 ${r} ${n} 추천해줘`,
        `담당의 바뀌지 않는 ${r} ${n} 어디야?`,
      ],
      '전문의': (r, n) => [
        `전문의가 있는 ${r} ${n} 추천해줘`,
        `${r} ${n} 전문의 직접 진료하는 곳 알려줘`,
      ],
      // ── 환자 경험 ──
      '가격합리적': (r, n, t) => [
        `${t || '진료'} 가격 양심적인 ${r} ${n} 추천해줘`,
        `${r} ${n} 비용 부담 없는 곳 알려줘`,
        `가성비 좋은 ${r} ${n} 어디야?`,
      ],
      '상담꼼꼼': (r, n) => [
        `상담 자세하게 해주는 ${r} ${n} 추천해줘`,
        `과잉진료 안 하고 꼼꼼하게 설명해주는 ${r} ${n} 있어?`,
      ],
      '대기시간짧음': (r, n) => [
        `대기 시간 짧은 ${r} ${n} 추천해줘`,
        `예약하면 바로 볼 수 있는 ${r} ${n} 있어?`,
      ],
      '소아전문': (r, n) => [
        `아이 데리고 가기 좋은 ${r} ${n} 추천해줘`,
        `${r} 소아 전문 ${n} 어디가 좋아?`,
        `아이가 무서워하지 않게 치료해주는 ${r} ${n} 있어?`,
      ],
      // ── 특수 강점 ──
      '수면치료': (r, n) => [
        `수면 치료 가능한 ${r} ${n} 있어?`,
        `잠자면서 치료받을 수 있는 ${r} ${n} 추천해줘`,
      ],
      '디지털진료': (r, n) => [
        `3D 스캔으로 정밀 진료하는 ${r} ${n} 추천해줘`,
        `디지털 장비 갖춘 ${r} ${n} 알려줘`,
      ],
      '자연스러운결과': (r, n, t) => [
        `${t || '시술'} 자연스럽게 잘하는 ${r} ${n} 추천해줘`,
        `티 안 나게 자연스러운 결과 보여주는 ${r} ${n} 어디야?`,
      ],
    };

    for (const strength of strengths) {
      // 정확히 일치하는 키가 있으면 사용
      if (strengthMap[strength]) {
        q.push(...strengthMap[strength](region, name, t0));
        continue;
      }
      // 부분 일치 검색 (예: "무통" → "무통치료" 매칭)
      for (const [key, fn] of Object.entries(strengthMap)) {
        if (key.includes(strength) || strength.includes(key)) {
          q.push(...fn(region, name, t0));
          break;
        }
      }
      // 매칭 안 되면 범용 질문 생성
      if (!Object.keys(strengthMap).some(k => k.includes(strength) || strength.includes(k))) {
        q.push(`${strength} 잘하는 ${region} ${name} 추천해줘`);
        if (t0) {
          q.push(`${t0} 하면서 ${strength}도 좋은 ${region} ${name} 있어?`);
        }
      }
    }

    return q;
  }

  private getSpecialtyName(type: string): string {
    const names: Record<string, string> = {
      DENTAL: '치과',
      DERMATOLOGY: '피부과',
      PLASTIC_SURGERY: '성형외과',
      OPHTHALMOLOGY: '안과',
      KOREAN_MEDICINE: '한의원',
      OTHER: '병원',
    };
    return names[type] || '병원';
  }

  /**
   * 진료과목별 세분화 프롬프트 템플릿
   * 
   * 구조:
   * - coreServices: 핵심 시술/진료 관련 질문
   * - patientNeeds: 환자 상황별 질문 (실제 AI 검색 패턴 반영)
   * - comparison: 비교/선택 기준 질문
   */
  private getSpecialtyPromptTemplates(type: string): {
    coreServices: string[];
    patientNeeds: string[];
    comparison: string[];
  } {
    const templates: Record<string, { coreServices: string[]; patientNeeds: string[]; comparison: string[] }> = {
      DENTAL: {
        coreServices: [
          '{지역} 임플란트 잘하는 {과} 추천해줘',
          '{지역} 치아교정 잘하는 {과} 어디가 좋아?',
          '{지역} 신경치료 잘하는 {과} 알려줘',
          '{지역} 라미네이트 잘하는 {과} 추천',
          '{지역} 사랑니 발치 잘하는 {과}',
          '{지역} 스케일링 잘하는 {과} 추천해줘',
        ],
        patientNeeds: [
          '{지역}에서 충치 치료 잘하는 {과} 어디야?',
          '{지역} 치아미백 할 수 있는 {과} 추천',
          '{지역} 소아치과 잘하는 곳 알려줘',
          '{지역} 잇몸 치료 잘하는 {과} 어디 있어?',
          '{지역} 무통 진료하는 {과} 있어?',
          '{지역} 야간 진료하는 {과} 알려줘',
          '{지역} 주말 진료 가능한 {과} 추천',
        ],
        comparison: [
          '{지역} {과} 추천 순위 알려줘',
          '{지역}에서 실력 좋은 {과} 비교해줘',
          '{지역} {과} 가격 합리적인 곳 추천',
        ],
      },
      DERMATOLOGY: {
        coreServices: [
          '{지역} 여드름 치료 잘하는 {과} 추천해줘',
          '{지역} 레이저 토닝 잘하는 {과} 어디가 좋아?',
          '{지역} 기미 잡티 치료 잘하는 {과}',
          '{지역} 피부관리 잘하는 {과} 추천',
          '{지역} 제모 잘하는 {과} 알려줘',
          '{지역} 보톡스 필러 잘하는 {과}',
        ],
        patientNeeds: [
          '{지역} 아토피 전문 {과} 추천해줘',
          '{지역} 탈모 치료 잘하는 {과} 어디야?',
          '{지역} 점 제거 잘하는 {과} 알려줘',
          '{지역} 흉터 치료 잘하는 {과} 있어?',
          '{지역} 피부 트러블 전문 {과} 추천',
          '{지역} 모공 치료 잘하는 {과}',
        ],
        comparison: [
          '{지역} {과} 추천 순위 알려줘',
          '{지역}에서 실력 좋은 {과} 비교해줘',
          '{지역} {과} 가격 합리적인 곳 추천',
        ],
      },
      PLASTIC_SURGERY: {
        coreServices: [
          '{지역} 코 성형 잘하는 {과} 추천해줘',
          '{지역} 눈 성형 잘하는 {과} 어디가 좋아?',
          '{지역} 안면윤곽 잘하는 {과}',
          '{지역} 지방흡입 잘하는 {과} 추천',
          '{지역} 리프팅 잘하는 {과} 알려줘',
          '{지역} 가슴 성형 잘하는 {과}',
        ],
        patientNeeds: [
          '{지역} 자연스러운 성형 잘하는 {과} 추천',
          '{지역} 재수술 잘하는 {과} 어디야?',
          '{지역} 남자 성형 잘하는 {과} 알려줘',
          '{지역} 쌍수 잘하는 {과} 추천해줘',
          '{지역} 보톡스 필러 잘하는 {과}',
          '{지역} 피부과 겸 {과} 추천',
        ],
        comparison: [
          '{지역} {과} 추천 순위 알려줘',
          '{지역}에서 실력 좋은 {과} 비교해줘',
          '{지역} {과} 후기 좋은 곳 추천',
        ],
      },
      OPHTHALMOLOGY: {
        coreServices: [
          '{지역} 라식 라섹 잘하는 {과} 추천해줘',
          '{지역} 스마일라식 잘하는 {과} 어디가 좋아?',
          '{지역} 백내장 수술 잘하는 {과}',
          '{지역} ICL 렌즈삽입술 잘하는 {과}',
          '{지역} 드림렌즈 잘 맞추는 {과}',
          '{지역} 노안 치료 잘하는 {과}',
        ],
        patientNeeds: [
          '{지역} 소아 시력교정 잘하는 {과} 추천',
          '{지역} 녹내장 전문 {과} 어디야?',
          '{지역} 안구건조증 치료 잘하는 {과}',
          '{지역} 콘택트렌즈 처방 잘하는 {과}',
          '{지역} 망막 전문 {과} 추천해줘',
          '{지역} 사시 치료 잘하는 {과}',
        ],
        comparison: [
          '{지역} {과} 추천 순위 알려줘',
          '{지역}에서 실력 좋은 {과} 비교해줘',
          '{지역} {과} 가격 합리적인 곳 추천',
        ],
      },
      KOREAN_MEDICINE: {
        coreServices: [
          '{지역} 추나요법 잘하는 {과} 추천해줘',
          '{지역} 침 잘 놓는 {과} 어디가 좋아?',
          '{지역} 한방 다이어트 잘하는 {과}',
          '{지역} 교통사고 치료 잘하는 {과}',
          '{지역} 한방 피부 치료 잘하는 {과}',
          '{지역} 체형교정 잘하는 {과}',
        ],
        patientNeeds: [
          '{지역} 허리 디스크 한방치료 잘하는 {과} 추천',
          '{지역} 불임 한방치료 잘하는 {과} 어디야?',
          '{지역} 만성피로 치료 잘하는 {과}',
          '{지역} 면역력 강화 한방치료 잘하는 {과}',
          '{지역} 갱년기 한방치료 추천',
          '{지역} 소화불량 한방치료 잘하는 {과}',
        ],
        comparison: [
          '{지역} {과} 추천 순위 알려줘',
          '{지역}에서 실력 좋은 {과} 비교해줘',
          '{지역} {과} 가격 합리적인 곳 추천',
        ],
      },
    };

    return templates[type] || {
      coreServices: [
        '{지역} 잘하는 {과} 추천해줘',
        '{지역} 실력 좋은 {과} 어디야?',
        '{지역} {과} 전문의 있는 곳 추천',
      ],
      patientNeeds: [
        '{지역} {과} 진료 잘 보는 곳 알려줘',
        '{지역} {과} 야간 진료 가능한 곳',
        '{지역} {과} 주말 진료 되는 곳',
      ],
      comparison: [
        '{지역} {과} 추천 순위 알려줘',
        '{지역}에서 실력 좋은 {과} 비교해줘',
        '{지역} {과} 가격 합리적인 곳 추천',
      ],
    };
  }

  /**
   * 기존 병원의 자동 프롬프트를 강화 버전으로 재생성
   */
  async regenerateAutoPrompts(hospitalId: string, userId: string) {
    // 권한 확인
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.hospitalId !== hospitalId || !['OWNER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('권한이 없습니다');
    }

    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    // 기존 AUTO_GENERATED 프롬프트 삭제
    const deleted = await this.prisma.prompt.deleteMany({
      where: { hospitalId, promptType: 'AUTO_GENERATED' },
    });

    // 강화된 프롬프트 재생성 (현재 플랜 기준)
    const dto: CreateHospitalDto = {
      name: hospital.name,
      specialtyType: hospital.specialtyType as any,
      subSpecialties: hospital.subSpecialties || [],
      regionSido: hospital.regionSido,
      regionSigungu: hospital.regionSigungu,
      regionDong: hospital.regionDong || undefined,
      coreTreatments: hospital.coreTreatments || [],
      targetRegions: hospital.targetRegions || [],
      hospitalStrengths: hospital.hospitalStrengths || [],
    };

    // CUSTOM 질문은 유지하므로, 그 수를 뺀 만큼만 자동 생성
    const customCount = await this.prisma.prompt.count({
      where: { hospitalId, promptType: 'CUSTOM' },
    });
    const result = await this.createAutoPrompts(hospitalId, dto, hospital.planType || 'FREE', customCount);

    return {
      deleted: deleted.count,
      created: result.created,
      prompts: result.prompts,
    };
  }

  /**
   * 활성 병원 목록 (Cron Job용)
   */
  async getActiveHospitals() {
    return this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: {
          in: ['TRIAL', 'ACTIVE'],
        },
      },
      select: {
        id: true,
        name: true,
        specialtyType: true,
        regionSido: true,
        regionSigungu: true,
      },
    });
  }

  /**
   * 플랜 업그레이드 시 추가 질문 자동 생성 + 경쟁사 조사 트리거
   * 
   * 흐름:
   * 1. 이전 플랜 → 새 플랜의 질문 한도 차이만큼 추가 생성
   * 2. 경쟁사 한도가 늘어나면 경쟁사 AEO 즉시 크롤링 트리거
   * 3. 결과를 반환하여 프론트에서 안내
   */
  async handlePlanUpgrade(hospitalId: string, previousPlan: string, newPlan: string): Promise<{
    addedPrompts: number;
    totalPrompts: number;
    maxPrompts: number;
    competitorSlots: { previous: number; new: number; added: number };
    newFeatures: string[];
    triggeredCompetitorCrawl: boolean;
  }> {
    this.logger.log(`=== 플랜 업그레이드 처리: ${previousPlan} → ${newPlan} ===`);

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        competitors: { where: { isActive: true } },
      },
    });

    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    const prevLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[previousPlan] || PlanGuard.PLAN_LIMITS.FREE;
    const newLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[newPlan] || PlanGuard.PLAN_LIMITS.FREE;

    // ── 1. 추가 질문 자동 생성 ──
    const currentPromptCount = await this.prisma.prompt.count({ where: { hospitalId } });
    const newMaxPrompts = newLimits.maxPrompts === -1 ? 100 : newLimits.maxPrompts;
    let addedPrompts = 0;

    if (currentPromptCount < newMaxPrompts) {
      // 병원 정보로 DTO 구성
      const dto: CreateHospitalDto = {
        name: hospital.name,
        specialtyType: hospital.specialtyType as any,
        subSpecialties: hospital.subSpecialties || [],
        regionSido: hospital.regionSido,
        regionSigungu: hospital.regionSigungu,
        regionDong: hospital.regionDong || undefined,
        coreTreatments: hospital.coreTreatments || [],
        targetRegions: hospital.targetRegions || [],
        hospitalStrengths: hospital.hospitalStrengths || [],
      };

      // 기존 질문 텍스트 가져오기 (중복 방지)
      const existingPrompts = await this.prisma.prompt.findMany({
        where: { hospitalId },
        select: { promptText: true },
      });
      const existingTexts = new Set(existingPrompts.map(p => p.promptText));

      // 전체 후보 생성 후, 기존에 없는 것만 추가
      const result = await this.generatePromptCandidates(dto);
      const newPrompts = result.filter(text => !existingTexts.has(text));
      const slotsAvailable = newMaxPrompts - currentPromptCount;
      const promptsToAdd = newPrompts.slice(0, slotsAvailable);

      if (promptsToAdd.length > 0) {
        await this.prisma.prompt.createMany({
          data: promptsToAdd.map(text => ({
            hospitalId,
            promptText: text,
            promptType: 'AUTO_GENERATED' as const,
            specialtyCategory: hospital.specialtyType,
            regionKeywords: [
              hospital.regionSido,
              hospital.regionSigungu,
              hospital.regionDong,
            ].filter(Boolean) as string[],
            isActive: true,
          })),
        });
        addedPrompts = promptsToAdd.length;
      }

      this.logger.log(`[업그레이드] 질문 추가: ${addedPrompts}개 (${currentPromptCount} → ${currentPromptCount + addedPrompts}/${newMaxPrompts})`);
    }

    // ── 2. 경쟁사 슬롯 확인 ──
    const prevMaxComp = prevLimits.maxCompetitors === -1 ? 999 : prevLimits.maxCompetitors;
    const newMaxComp = newLimits.maxCompetitors === -1 ? 999 : newLimits.maxCompetitors;
    const currentCompetitors = hospital.competitors.length;
    const addedCompSlots = Math.max(0, newMaxComp - prevMaxComp);

    // ── 3. 새로 열린 기능 확인 ──
    const newFeatures: string[] = [];
    if (!prevLimits.exportEnabled && newLimits.exportEnabled) newFeatures.push('데이터 내보내기');
    if (!prevLimits.aiRecommendations && newLimits.aiRecommendations) newFeatures.push('AI 개선 추천');
    if (!prevLimits.contentGap && newLimits.contentGap) newFeatures.push('Content Gap 분석');
    if (!prevLimits.competitorAEO && newLimits.competitorAEO) newFeatures.push('경쟁사 AEO 측정');

    // 새 플랫폼 추가 확인
    const newPlatforms = newLimits.platforms.filter((p: string) => !prevLimits.platforms.includes(p));
    if (newPlatforms.length > 0) {
      const platformNames: Record<string, string> = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', PERPLEXITY: 'Perplexity', GEMINI: 'Gemini' };
      newFeatures.push(`새 AI 플랫폼: ${newPlatforms.map((p: string) => platformNames[p] || p).join(', ')}`);
    }

    // ── 4. 경쟁사 AEO 즉시 크롤링 트리거 (기존 경쟁사가 있고, 경쟁사AEO가 새로 열렸을 때) ──
    let triggeredCompetitorCrawl = false;
    if (!prevLimits.competitorAEO && newLimits.competitorAEO && currentCompetitors > 0) {
      triggeredCompetitorCrawl = true;
      this.logger.log(`[업그레이드] 경쟁사 AEO 크롤링 트리거: ${currentCompetitors}개 경쟁사`);
      // 비동기로 실행 (응답은 즉시 반환)
      // 실제 크롤링은 스케줄러 또는 별도 작업큐에서 처리
    }

    const totalPrompts = currentPromptCount + addedPrompts;

    this.logger.log(`=== 업그레이드 처리 완료: 질문 +${addedPrompts}, 경쟁사 슬롯 +${addedCompSlots}, 신규기능 ${newFeatures.length}개 ===`);

    return {
      addedPrompts,
      totalPrompts,
      maxPrompts: newMaxPrompts,
      competitorSlots: {
        previous: prevMaxComp,
        new: newMaxComp,
        added: addedCompSlots,
      },
      newFeatures,
      triggeredCompetitorCrawl,
    };
  }

  /**
   * 질문 후보 전체 생성 (중복 체크용)
   * createAutoPrompts의 템플릿 로직을 재사용하되 DB 저장 없이 텍스트만 반환
   */
  private async generatePromptCandidates(dto: CreateHospitalDto): Promise<string[]> {
    const templates: string[] = [];

    const fullRegion = dto.regionDong
      ? `${dto.regionSido} ${dto.regionSigungu} ${dto.regionDong}`
      : `${dto.regionSido} ${dto.regionSigungu}`;
    const shortRegion = dto.regionSigungu.replace(/[시군구]$/, '');
    const dong = dto.regionDong || '';
    const specialtyName = this.getSpecialtyName(dto.specialtyType);

    const targetRegions = dto.targetRegions?.length ? dto.targetRegions : [];
    const regions = [...new Set([
      ...targetRegions.slice(0, 3),
      shortRegion,
      ...(dong ? [dong] : []),
    ])];

    const treatments = dto.coreTreatments?.length
      ? dto.coreTreatments
      : (dto.subSpecialties?.length ? dto.subSpecialties : []);

    // ① 추천 탐색
    for (const r of regions.slice(0, 3)) {
      templates.push(`${r} ${specialtyName} 추천해줘`);
    }
    templates.push(`${fullRegion} 잘하는 ${specialtyName} 어디야?`);

    const recommendPatterns = [
      (r: string, t: string) => `${r}에서 ${t} 잘하는 ${specialtyName} 추천해줘`,
      (r: string, t: string) => `${t} 전문 ${specialtyName} ${r} 근처에 있어?`,
      (r: string, t: string) => `${r} ${t} 잘한다고 소문난 ${specialtyName} 알려줘`,
      (r: string, t: string) => `${t} 하려는데 ${r} 쪽에 괜찮은 ${specialtyName} 있을까?`,
    ];
    for (const t of treatments.slice(0, 5)) {
      const r = regions[templates.length % regions.length] || shortRegion;
      const pattern = recommendPatterns[templates.length % recommendPatterns.length];
      templates.push(pattern(r, t));
    }

    // ② 비교 평가
    templates.push(`${shortRegion} ${specialtyName} 비교해서 알려줘`);
    if (treatments.length > 0) {
      templates.push(`${shortRegion} ${treatments[0]} ${specialtyName} 어디가 제일 잘해?`);
    }
    if (treatments.length >= 2) {
      templates.push(`${treatments[0]}이랑 ${treatments[1]} 같이 하려는데 ${shortRegion} ${specialtyName} 어디가 좋아?`);
    }

    // ③ 가격/비용
    if (treatments.length > 0) {
      templates.push(
        `${shortRegion} ${treatments[0]} 가격 합리적인 ${specialtyName} 추천해줘`,
        `${treatments[0]} 비용 보통 얼마야? ${shortRegion} 기준으로 알려줘`,
      );
    }
    templates.push(`${shortRegion} ${specialtyName} 가격 착한 곳 알려줘`);

    // ④~⑨ (기존과 동일)
    templates.push(...this.getSymptomQuestions(dto.specialtyType, shortRegion, specialtyName, treatments));
    templates.push(...this.getAnxietyQuestions(dto.specialtyType, shortRegion, specialtyName));
    templates.push(`${shortRegion} ${specialtyName} 후기 좋은 곳 알려줘`);
    templates.push(`${shortRegion} ${specialtyName} 실제 다녀본 사람들 평가 좋은 곳 어디야?`);
    if (treatments.length > 0) {
      templates.push(`${shortRegion} ${treatments[0]} 후기 좋은 ${specialtyName} 추천해줘`);
    }
    templates.push(...this.getConditionQuestions(dto.specialtyType, shortRegion, specialtyName));

    const strengths = dto.hospitalStrengths || [];
    templates.push(...this.getStrengthQuestions(strengths, dto.specialtyType, shortRegion, specialtyName, treatments));

    if (targetRegions.length > 0) {
      for (const r of targetRegions.slice(0, 3)) {
        if (treatments.length > 0) {
          templates.push(`${r} 근처 ${treatments[0]} 잘하는 ${specialtyName} 있어?`);
        }
        templates.push(`${r}에서 가까운 ${specialtyName} 중에 잘하는 곳 알려줘`);
      }
    }

    return [...new Set(templates)];
  }
}
