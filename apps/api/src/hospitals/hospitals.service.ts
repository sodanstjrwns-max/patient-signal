import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateHospitalDto) {
    // 병원 생성 (무료 플랜)
    const hospital = await this.prisma.hospital.create({
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
        planType: 'STARTER',
        subscriptionStatus: 'ACTIVE',
      },
    });

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
          planType: 'STARTER',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: farFuture,
        },
      });
    } catch (err) {
      // Subscription 생성 실패해도 병원 생성은 진행 (무료 모델)
      console.warn('Subscription 생성 실패 (무시됨):', err?.message);
    }

    // 자동 프롬프트 생성 (지역 기반)
    await this.createAutoPrompts(hospital.id, dto);

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

    // 최근 언급 통계
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentMentions = await this.prisma.aIResponse.count({
      where: {
        hospitalId,
        isMentioned: true,
        responseDate: { gte: last7Days },
      },
    });

    const totalResponses = await this.prisma.aIResponse.count({
      where: {
        hospitalId,
        responseDate: { gte: last7Days },
      },
    });

    // 감성 분석 통계 (최근 30일)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const sentimentResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: last30Days },
        sentimentLabel: { not: null },
      },
      select: {
        sentimentLabel: true,
        isMentioned: true,
      },
    });

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
   * 자동 프롬프트 생성 (강화 버전)
   * 
   * 전략:
   * 1. 기본 지역 추천 질문 (시군구 + 동 레벨)
   * 2. 진료과목별 핵심 시술 질문 
   * 3. 환자 상황/니즈 기반 질문 (실제 검색 패턴)
   * 4. 비교/선택 기준 질문
   * 5. 세부 진료과목(subSpecialties) 기반 질문
   */
  async createAutoPrompts(hospitalId: string, dto: CreateHospitalDto) {
    const templates: string[] = [];

    // ── 지역 변형 준비 ──
    const fullRegion = dto.regionDong
      ? `${dto.regionSido} ${dto.regionSigungu} ${dto.regionDong}`
      : `${dto.regionSido} ${dto.regionSigungu}`;
    // 짧은 지역명: "서울특별시 강남구" → "강남", "서울 강남"
    const shortRegion = dto.regionSigungu.replace(/[시군구]$/, '');
    const midRegion = `${dto.regionSido.replace(/특별시|광역시|도$/, '')} ${shortRegion}`;

    const specialtyName = this.getSpecialtyName(dto.specialtyType);
    const specialtyTemplates = this.getSpecialtyPromptTemplates(dto.specialtyType);

    // ── 1. 기본 지역 추천 질문 (3개) ──
    templates.push(
      `${fullRegion} ${specialtyName} 추천해줘`,
      `${shortRegion} ${specialtyName} 잘하는 곳 알려줘`,
      `${midRegion}에서 좋은 ${specialtyName} 어디야?`,
    );

    // ── 2. 진료과목별 핵심 시술 질문 ──
    const regions = [shortRegion, fullRegion];
    for (const template of specialtyTemplates.coreServices) {
      // 지역 변형을 번갈아 사용하여 다양성 확보
      const region = regions[templates.length % regions.length];
      templates.push(template.replace('{지역}', region).replace('{과}', specialtyName));
    }

    // ── 3. 환자 상황/니즈 기반 질문 ──
    for (const template of specialtyTemplates.patientNeeds) {
      const region = regions[templates.length % regions.length];
      templates.push(template.replace('{지역}', region).replace('{과}', specialtyName));
    }

    // ── 4. 비교/선택 기준 질문 ──
    for (const template of specialtyTemplates.comparison) {
      const region = regions[templates.length % regions.length];
      templates.push(template.replace('{지역}', region).replace('{과}', specialtyName));
    }

    // ── 5. 세부 진료과목(subSpecialties) 기반 질문 ──
    if (dto.subSpecialties && dto.subSpecialties.length > 0) {
      for (const sub of dto.subSpecialties.slice(0, 5)) {
        templates.push(
          `${shortRegion} ${sub} 잘하는 ${specialtyName} 추천`,
          `${fullRegion} ${sub} 전문 ${specialtyName} 어디가 좋아?`,
        );
      }
    }

    // 동이 있으면 동 레벨 질문도 추가
    if (dto.regionDong) {
      templates.push(
        `${dto.regionDong} 근처 ${specialtyName} 추천`,
        `${dto.regionSigungu} ${dto.regionDong} ${specialtyName} 어디가 좋아?`,
      );
    }

    // 중복 제거 후 생성
    const uniqueTemplates = [...new Set(templates)];

    await this.prisma.prompt.createMany({
      data: uniqueTemplates.map((text) => ({
        hospitalId,
        promptText: text,
        promptType: 'AUTO_GENERATED' as const,
        specialtyCategory: dto.specialtyType,
        regionKeywords: [dto.regionSido, dto.regionSigungu, dto.regionDong].filter(Boolean) as string[],
        isActive: true,
      })),
    });

    return { created: uniqueTemplates.length, prompts: uniqueTemplates };
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

    // 강화된 프롬프트 재생성
    const dto: CreateHospitalDto = {
      name: hospital.name,
      specialtyType: hospital.specialtyType as any,
      subSpecialties: hospital.subSpecialties || [],
      regionSido: hospital.regionSido,
      regionSigungu: hospital.regionSigungu,
      regionDong: hospital.regionDong || undefined,
    };

    const result = await this.createAutoPrompts(hospitalId, dto);

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
}
