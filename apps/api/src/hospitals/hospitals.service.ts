import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateHospitalDto) {
    // 병원 생성
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
        subscriptionStatus: 'TRIAL',
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

    // 7일 무료 체험 구독 생성
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.subscription.create({
      data: {
        hospitalId: hospital.id,
        planType: 'STARTER',
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    });

    // 자동 프롬프트 생성 (지역 기반)
    await this.createAutoPrompts(hospital.id, dto);

    return hospital;
  }

  async findOne(hospitalId: string) {
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
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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
    };
  }

  private async createAutoPrompts(hospitalId: string, dto: CreateHospitalDto) {
    const region = dto.regionDong 
      ? `${dto.regionSido} ${dto.regionSigungu} ${dto.regionDong}`
      : `${dto.regionSido} ${dto.regionSigungu}`;

    const specialtyName = this.getSpecialtyName(dto.specialtyType);
    const templates = [
      `${region} ${specialtyName} 추천해줘`,
      `${region}에서 ${specialtyName} 잘하는 곳`,
      `${region} ${specialtyName} 어디가 좋아?`,
    ];

    // 세부 진료과목 기반 질문 추가
    if (dto.subSpecialties && dto.subSpecialties.length > 0) {
      for (const sub of dto.subSpecialties.slice(0, 3)) {
        templates.push(`${region} ${sub} 잘하는 ${specialtyName} 추천`);
        templates.push(`${region} ${sub} 비용 얼마야?`);
      }
    }

    // 프롬프트 생성
    await this.prisma.prompt.createMany({
      data: templates.map((text) => ({
        hospitalId,
        promptText: text,
        promptType: 'AUTO_GENERATED',
        specialtyCategory: dto.specialtyType,
        regionKeywords: [dto.regionSido, dto.regionSigungu, dto.regionDong].filter(Boolean) as string[],
        isActive: true,
      })),
    });
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
}
