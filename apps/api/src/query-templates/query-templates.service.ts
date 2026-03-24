import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SpecialtyType, QueryIntent, AIPlatform } from '@prisma/client';
import { PlanGuard } from '../common/guards/plan.guard';

// ==================== 7개 진료과 프리셋 시술 DB ====================

export interface ProcedurePreset {
  name: string;
  alias: string[];
  category: 'core' | 'cosmetic' | 'general';
  isPopular: boolean;
}

export const SPECIALTY_PROCEDURES: Record<string, ProcedurePreset[]> = {
  DENTAL: [
    { name: '임플란트', alias: ['임플', 'implant', '인공치아'], category: 'core', isPopular: true },
    { name: '교정', alias: ['치아교정', '치열교정', 'orthodontics', '투명교정'], category: 'core', isPopular: true },
    { name: '미백', alias: ['치아미백', 'whitening', '화이트닝'], category: 'cosmetic', isPopular: true },
    { name: '충치치료', alias: ['충치', '레진', '인레이', '크라운'], category: 'general', isPopular: false },
    { name: '잇몸치료', alias: ['잇몸', '치주치료', '스케일링'], category: 'general', isPopular: false },
    { name: '사랑니발치', alias: ['사랑니', '매복사랑니', '발치'], category: 'general', isPopular: false },
    { name: '라미네이트', alias: ['라미', 'laminate', '심미보철'], category: 'cosmetic', isPopular: true },
    { name: '턱관절', alias: ['턱관절치료', 'TMJ', '이갈이'], category: 'core', isPopular: false },
    { name: '소아치과', alias: ['소아', '아이치과', '유치'], category: 'general', isPopular: false },
    { name: '신경치료', alias: ['근관치료', '신경치료'], category: 'general', isPopular: false },
  ],
  DERMATOLOGY: [
    { name: '보톡스', alias: ['보톡', 'botox', '주름보톡스'], category: 'cosmetic', isPopular: true },
    { name: '필러', alias: ['filler', '볼필러', '턱필러'], category: 'cosmetic', isPopular: true },
    { name: '리프팅', alias: ['울쎄라', '써마지', 'HIFU', '실리프팅'], category: 'cosmetic', isPopular: true },
    { name: '레이저토닝', alias: ['레이저', '피코레이저', '피부레이저'], category: 'core', isPopular: true },
    { name: '여드름치료', alias: ['여드름', '여드름흉터', '피지관리'], category: 'core', isPopular: false },
    { name: '기미치료', alias: ['기미', '색소', '잡티'], category: 'core', isPopular: false },
    { name: '탈모치료', alias: ['탈모', '모발이식', 'PRP'], category: 'core', isPopular: true },
    { name: '피부관리', alias: ['피부관리', '스킨케어', '물광주사'], category: 'cosmetic', isPopular: false },
  ],
  ORTHOPEDICS: [
    { name: '무릎관절', alias: ['무릎', '관절', '인공관절', '슬관절'], category: 'core', isPopular: true },
    { name: '척추치료', alias: ['척추', '디스크', '허리디스크', '협착증'], category: 'core', isPopular: true },
    { name: '어깨치료', alias: ['어깨', '오십견', '회전근개', '어깨관절'], category: 'core', isPopular: true },
    { name: '도수치료', alias: ['도수', '물리치료', '재활'], category: 'general', isPopular: false },
    { name: '관절내시경', alias: ['내시경', '관절수술'], category: 'core', isPopular: false },
    { name: '체외충격파', alias: ['충격파', 'ESWT'], category: 'general', isPopular: false },
  ],
  KOREAN_MEDICINE: [
    { name: '추나요법', alias: ['추나', '교정추나', '도수추나'], category: 'core', isPopular: true },
    { name: '침치료', alias: ['침', '한방침', '전침', '약침'], category: 'core', isPopular: true },
    { name: '한방다이어트', alias: ['다이어트', '한방비만', '한약다이어트'], category: 'cosmetic', isPopular: true },
    { name: '허리디스크한방', alias: ['허리한방', '디스크한방', '한방척추'], category: 'core', isPopular: false },
    { name: '교통사고한방', alias: ['교통사고', '자동차보험한방'], category: 'general', isPopular: false },
    { name: '보약처방', alias: ['보약', '한약', '경옥고'], category: 'general', isPopular: false },
  ],
  OPHTHALMOLOGY: [
    { name: '라식', alias: ['LASIK', '라식수술'], category: 'core', isPopular: true },
    { name: '라섹', alias: ['LASEK', '라섹수술'], category: 'core', isPopular: true },
    { name: '스마일라식', alias: ['스마일', 'SMILE', '렌즈삽입술'], category: 'core', isPopular: true },
    { name: '백내장', alias: ['백내장수술', '다초점렌즈'], category: 'core', isPopular: true },
    { name: '녹내장', alias: ['녹내장치료', '안압'], category: 'core', isPopular: false },
    { name: '드림렌즈', alias: ['드림', '야간렌즈', '소아근시'], category: 'general', isPopular: false },
  ],
  INTERNAL_MEDICINE: [
    { name: '건강검진', alias: ['종합검진', '국가검진', '인간독'], category: 'core', isPopular: true },
    { name: '내시경', alias: ['위내시경', '대장내시경', '수면내시경'], category: 'core', isPopular: true },
    { name: '만성질환관리', alias: ['고혈압', '당뇨', '고지혈증'], category: 'core', isPopular: false },
    { name: '감기진료', alias: ['감기', '독감', '코로나'], category: 'general', isPopular: false },
    { name: '영양수액', alias: ['수액', '비타민주사', '면역주사'], category: 'general', isPopular: false },
  ],
  UROLOGY: [
    { name: '전립선', alias: ['전립선비대증', '전립선염', 'PSA'], category: 'core', isPopular: true },
    { name: '비뇨기검사', alias: ['비뇨기', '소변검사', '요로감염'], category: 'core', isPopular: false },
    { name: '요로결석', alias: ['결석', '신장결석', '체외충격파'], category: 'core', isPopular: true },
    { name: '남성비뇨기', alias: ['남성', '발기부전', '조루'], category: 'core', isPopular: false },
    { name: '과민성방광', alias: ['방광', '빈뇨', '야뇨'], category: 'core', isPopular: false },
  ],
  PLASTIC_SURGERY: [
    { name: '눈성형', alias: ['쌍꺼풀', '눈매교정', '안검하수'], category: 'core', isPopular: true },
    { name: '코성형', alias: ['코수술', '융비술'], category: 'core', isPopular: true },
    { name: '지방흡입', alias: ['지흡', '지방이식', '바디성형'], category: 'cosmetic', isPopular: true },
    { name: '가슴성형', alias: ['가슴수술', '유방'], category: 'cosmetic', isPopular: true },
    { name: '안면윤곽', alias: ['윤곽', '양악', '사각턱'], category: 'core', isPopular: true },
    { name: '리프팅성형', alias: ['안면거상', '페이스리프트'], category: 'cosmetic', isPopular: false },
  ],
};

// ==================== 14개 핵심 쿼리 템플릿 ====================
// 변수: {region} = 지역, {specialty} = 진료과, {procedure} = 시술명

export interface QueryTemplateDefinition {
  intent: QueryIntent;
  template: string;
  description: string;
  platformSpecific?: AIPlatform;
  isWeekly: boolean;
  isMonthly: boolean;
}

// 주간 14개 쿼리 (10개 공통 + 4개 플랫폼별)
export const WEEKLY_QUERY_TEMPLATES: QueryTemplateDefinition[] = [
  // === 예약 의도 (×1.5) - 3개 ===
  { intent: 'RESERVATION', template: '{region} {procedure} 잘하는 {specialty} 추천해줘', description: '예약 의도 - 시술 추천', isWeekly: true, isMonthly: false },
  { intent: 'RESERVATION', template: '{region}에서 {procedure} 잘하는 병원 어디가 좋아?', description: '예약 의도 - 병원 탐색', isWeekly: true, isMonthly: false },
  { intent: 'RESERVATION', template: '{region} {procedure} 전문 {specialty} 예약하려면 어디가 좋을까?', description: '예약 의도 - 예약 전환', isWeekly: true, isMonthly: false },

  // === 비교 의도 (×1.1) - 2개 ===
  { intent: 'COMPARISON', template: '{region} {procedure} 비용 비교해줘. 어디가 가성비 좋아?', description: '비교 의도 - 가성비', isWeekly: true, isMonthly: false },
  { intent: 'COMPARISON', template: '{region} {specialty} 진료 잘하는 곳 Top 3 비교해줘', description: '비교 의도 - 순위 비교', isWeekly: true, isMonthly: false },

  // === 정보 탐색 (×1.0) - 2개 ===
  { intent: 'INFORMATION', template: '{procedure} 시술 과정이 궁금한데, {region}에 유명한 {specialty} 있어?', description: '정보 탐색 - 시술 정보', isWeekly: true, isMonthly: false },
  { intent: 'INFORMATION', template: '{region} {specialty}에서 {procedure} 받으려면 어떤 준비가 필요해?', description: '정보 탐색 - 준비 사항', isWeekly: true, isMonthly: false },

  // === 후기/리뷰 (×1.3) - 1개 ===
  { intent: 'REVIEW', template: '{region} {procedure} 후기 좋은 {specialty} 어디야?', description: '후기 의도 - 리뷰 기반', isWeekly: true, isMonthly: false },

  // === 공포/걱정 (×1.2) - 2개 ===
  { intent: 'FEAR', template: '{procedure} 아프다는데 {region}에서 안전하게 받을 수 있는 곳은?', description: '공포 의도 - 안전성', isWeekly: true, isMonthly: false },
  { intent: 'FEAR', template: '{procedure} 부작용이 걱정되는데, {region} {specialty} 중 실력 좋은 곳은?', description: '공포 의도 - 실력', isWeekly: true, isMonthly: false },

  // === 플랫폼 특화 쿼리 (4개 = 플랫폼별 1개씩) ===
  { intent: 'RESERVATION', template: '{region} {procedure} {specialty} 추천. 출처와 근거도 함께 알려줘.', description: 'Perplexity 특화 - 소스 기반', platformSpecific: 'PERPLEXITY', isWeekly: true, isMonthly: false },
  { intent: 'COMPARISON', template: '{region} {procedure} 잘하는 {specialty} 장단점 분석해줘', description: 'ChatGPT 특화 - 분석형', platformSpecific: 'CHATGPT', isWeekly: true, isMonthly: false },
  { intent: 'INFORMATION', template: '{region} {procedure} {specialty} 검색하면 어디가 나와?', description: 'Gemini 특화 - 로컬 검색', platformSpecific: 'GEMINI', isWeekly: true, isMonthly: false },
  { intent: 'REVIEW', template: '{region} {procedure} 전문가 관점에서 {specialty} 분석해줘', description: 'Claude 특화 - 전문 분석', platformSpecific: 'CLAUDE', isWeekly: true, isMonthly: false },
];

// 월간 추가 20개 쿼리 (Pro 전용)
export const MONTHLY_EXTRA_TEMPLATES: QueryTemplateDefinition[] = [
  { intent: 'RESERVATION', template: '{region} {procedure} 주말에 진료하는 {specialty} 알려줘', description: '예약 - 주말 진료', isWeekly: false, isMonthly: true },
  { intent: 'RESERVATION', template: '{region} 야간 진료하는 {specialty} 중 {procedure} 잘하는 곳', description: '예약 - 야간 진료', isWeekly: false, isMonthly: true },
  { intent: 'RESERVATION', template: '{region} {procedure} 당일 예약 가능한 {specialty}', description: '예약 - 당일 예약', isWeekly: false, isMonthly: true },
  { intent: 'COMPARISON', template: '{region} {procedure} 가격대별 {specialty} 비교', description: '비교 - 가격대별', isWeekly: false, isMonthly: true },
  { intent: 'COMPARISON', template: '{region} {procedure} 대학병원 vs 개원의 어디가 나을까?', description: '비교 - 기관 유형', isWeekly: false, isMonthly: true },
  { intent: 'COMPARISON', template: '{region} {procedure} 최신 장비 있는 {specialty} 어디야?', description: '비교 - 장비', isWeekly: false, isMonthly: true },
  { intent: 'INFORMATION', template: '{procedure} 최신 트렌드가 뭐야? {region}에서 받을 수 있어?', description: '정보 - 트렌드', isWeekly: false, isMonthly: true },
  { intent: 'INFORMATION', template: '{region} {specialty} 의료보험 적용되는 {procedure} 있어?', description: '정보 - 보험 적용', isWeekly: false, isMonthly: true },
  { intent: 'INFORMATION', template: '{procedure} 평균 비용이 얼마야? {region} 기준으로', description: '정보 - 비용 정보', isWeekly: false, isMonthly: true },
  { intent: 'INFORMATION', template: '{region} {procedure} 전문의가 있는 {specialty} 어디야?', description: '정보 - 전문의', isWeekly: false, isMonthly: true },
  { intent: 'REVIEW', template: '{region} {procedure} 리뷰가 많은 {specialty} 알려줘', description: '후기 - 리뷰 수', isWeekly: false, isMonthly: true },
  { intent: 'REVIEW', template: '{region} {procedure} 네이버 평점 높은 {specialty}', description: '후기 - 평점', isWeekly: false, isMonthly: true },
  { intent: 'REVIEW', template: '{region} {procedure} 재방문율 높은 {specialty} 어디야?', description: '후기 - 재방문', isWeekly: false, isMonthly: true },
  { intent: 'FEAR', template: '{procedure} 재수술 위험은? {region}에서 안전한 {specialty} 추천', description: '공포 - 재수술', isWeekly: false, isMonthly: true },
  { intent: 'FEAR', template: '{procedure} 마취가 걱정되는데, {region} {specialty} 중 안전한 곳', description: '공포 - 마취', isWeekly: false, isMonthly: true },
  { intent: 'FEAR', template: '{procedure} 실패 사례가 있어서 두려운데, {region} 전문 {specialty} 추천', description: '공포 - 실패 사례', isWeekly: false, isMonthly: true },
  { intent: 'RESERVATION', template: '{region} {procedure} 만족도 높은 {specialty} 소개해줘', description: '예약 - 만족도', isWeekly: false, isMonthly: true },
  { intent: 'COMPARISON', template: '{region} {procedure} 경력 많은 의사 있는 {specialty} 비교', description: '비교 - 경력', isWeekly: false, isMonthly: true },
  { intent: 'INFORMATION', template: '{procedure} 회복 기간은 얼마야? {region} {specialty} 기준', description: '정보 - 회복 기간', isWeekly: false, isMonthly: true },
  { intent: 'REVIEW', template: '{region} {procedure} 솔직한 후기 알려줘. 장단점 포함해서', description: '후기 - 솔직 후기', isWeekly: false, isMonthly: true },
];

// ==================== 진료과 한글 매핑 ====================

export const SPECIALTY_NAMES: Record<string, string> = {
  DENTAL: '치과',
  DERMATOLOGY: '피부과',
  PLASTIC_SURGERY: '성형외과',
  ORTHOPEDICS: '정형외과',
  KOREAN_MEDICINE: '한의원',
  OPHTHALMOLOGY: '안과',
  INTERNAL_MEDICINE: '내과',
  UROLOGY: '비뇨기과',
  ENT: '이비인후과',
  PSYCHIATRY: '정신건강의학과',
  OBSTETRICS: '산부인과',
  PEDIATRICS: '소아과',
  OTHER: '기타',
};

@Injectable()
export class QueryTemplatesService {
  private readonly logger = new Logger(QueryTemplatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 진료과별 프리셋 시술 목록 조회
   */
  async getSpecialtyPresets(specialtyType: string): Promise<ProcedurePreset[]> {
    return SPECIALTY_PROCEDURES[specialtyType] || [];
  }

  /**
   * 전체 진료과 목록과 시술 수 반환
   */
  async getAllSpecialties(): Promise<Array<{
    type: string;
    name: string;
    procedureCount: number;
    popularProcedures: string[];
  }>> {
    return Object.entries(SPECIALTY_PROCEDURES).map(([type, procedures]) => ({
      type,
      name: SPECIALTY_NAMES[type] || type,
      procedureCount: procedures.length,
      popularProcedures: procedures
        .filter(p => p.isPopular)
        .map(p => p.name),
    }));
  }

  /**
   * 병원 설정에 따라 14개(주간) 또는 34개(월간) 쿼리 자동 생성
   * @param hospitalId 병원 ID
   * @param includeMontly Pro 플랜일 경우 월간 쿼리 포함
   */
  async generateQueriesForHospital(
    hospitalId: string,
    includeMonthly: boolean = false,
  ): Promise<{ created: number; queries: string[] }> {
    // 병원 정보 조회
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error('병원을 찾을 수 없습니다');
    }

    const region = `${hospital.regionSido} ${hospital.regionSigungu}`;
    const specialty = SPECIALTY_NAMES[hospital.specialtyType] || hospital.specialtyType;
    // keyProcedures → coreTreatments → 프리셋 순서로 fallback
    const procedures = hospital.keyProcedures?.length > 0
      ? hospital.keyProcedures
      : (hospital.coreTreatments?.length > 0
        ? hospital.coreTreatments
        : (SPECIALTY_PROCEDURES[hospital.specialtyType] || [])
            .filter(p => p.isPopular)
            .slice(0, 3)
            .map(p => p.name));

    if (procedures.length === 0) {
      this.logger.warn(`병원 ${hospitalId}에 핵심 시술이 설정되지 않았습니다`);
      return { created: 0, queries: [] };
    }

    // 기존 PRESET/AUTO_GENERATED 쿼리 삭제 (비활성화 대신 삭제하여 슬롯 확보)
    const deleted = await this.prisma.prompt.deleteMany({
      where: {
        hospitalId,
        promptType: { in: ['PRESET', 'AUTO_GENERATED'] },
      },
    });
    this.logger.log(`기존 자동 질문 ${deleted.count}개 삭제`);

    // 플랜별 한도 체크
    const planType = hospital.planType || 'FREE';
    const planLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxPrompts = planLimits.maxPrompts === -1 ? 999 : planLimits.maxPrompts;
    
    // 커스텀 질문 수 확인 (남은 슬롯 계산)
    const customCount = await this.prisma.prompt.count({
      where: { hospitalId, isActive: true },
    });
    const availableSlots = Math.max(0, maxPrompts - customCount);

    const templates = includeMonthly
      ? [...WEEKLY_QUERY_TEMPLATES, ...MONTHLY_EXTRA_TEMPLATES]
      : WEEKLY_QUERY_TEMPLATES;

    const generatedQueries: string[] = [];
    const promptsToCreate: any[] = [];

    // 핵심 시술별로 템플릿 적용
    for (const procedure of procedures) {
      for (const tmpl of templates) {
        const queryText = tmpl.template
          .replace(/{region}/g, region)
          .replace(/{specialty}/g, specialty)
          .replace(/{procedure}/g, procedure);

        generatedQueries.push(queryText);

        promptsToCreate.push({
          hospitalId,
          promptText: queryText,
          promptType: 'AUTO_GENERATED',
          specialtyCategory: procedure,
          regionKeywords: [hospital.regionSido, hospital.regionSigungu, ...(hospital.regionDong ? [hospital.regionDong] : [])],
          isActive: true,
        });
      }
    }

    // 대량 삽입 (플랜 한도 적용)
    const promptsLimited = promptsToCreate.slice(0, availableSlots);
    if (promptsLimited.length > 0) {
      await this.prisma.prompt.createMany({ data: promptsLimited });
    }

    this.logger.log(`병원 ${hospital.name}: ${promptsLimited.length}개 쿼리 생성 완료 (한도 ${maxPrompts}, 커스텀 ${customCount}, 슬롯 ${availableSlots})`);

    return {
      created: promptsLimited.length,
      queries: generatedQueries.slice(0, 20), // 미리보기용 상위 20개
    };
  }

  /**
   * 쿼리 템플릿 미리보기 (저장 없이)
   */
  previewQueries(
    region: string,
    specialtyType: string,
    procedures: string[],
    includeMonthly: boolean = false,
  ): { total: number; queries: Array<{ intent: string; query: string; platform?: string }> } {
    const specialty = SPECIALTY_NAMES[specialtyType] || specialtyType;

    const templates = includeMonthly
      ? [...WEEKLY_QUERY_TEMPLATES, ...MONTHLY_EXTRA_TEMPLATES]
      : WEEKLY_QUERY_TEMPLATES;

    const queries: Array<{ intent: string; query: string; platform?: string }> = [];

    for (const procedure of procedures) {
      for (const tmpl of templates) {
        queries.push({
          intent: tmpl.intent,
          query: tmpl.template
            .replace(/{region}/g, region)
            .replace(/{specialty}/g, specialty)
            .replace(/{procedure}/g, procedure),
          platform: tmpl.platformSpecific || undefined,
        });
      }
    }

    return { total: queries.length, queries };
  }

  /**
   * DB에 프리셋 시술 데이터 시드
   */
  async seedSpecialtyPresets(): Promise<{ seeded: number }> {
    let count = 0;

    for (const [specialtyType, procedures] of Object.entries(SPECIALTY_PROCEDURES)) {
      for (let i = 0; i < procedures.length; i++) {
        const proc = procedures[i];
        try {
          await this.prisma.specialtyPreset.upsert({
            where: {
              specialtyType_procedureName: {
                specialtyType: specialtyType as SpecialtyType,
                procedureName: proc.name,
              },
            },
            update: {
              procedureAlias: proc.alias,
              category: proc.category,
              isPopular: proc.isPopular,
              sortOrder: i,
            },
            create: {
              specialtyType: specialtyType as SpecialtyType,
              procedureName: proc.name,
              procedureAlias: proc.alias,
              category: proc.category,
              isPopular: proc.isPopular,
              sortOrder: i,
            },
          });
          count++;
        } catch (e) {
          this.logger.warn(`시술 시드 실패: ${specialtyType}/${proc.name}: ${e.message}`);
        }
      }
    }

    return { seeded: count };
  }

  /**
   * DB에 쿼리 템플릿 데이터 시드
   */
  async seedQueryTemplates(): Promise<{ seeded: number }> {
    let count = 0;
    const allTemplates = [...WEEKLY_QUERY_TEMPLATES, ...MONTHLY_EXTRA_TEMPLATES];

    for (let i = 0; i < allTemplates.length; i++) {
      const tmpl = allTemplates[i];
      try {
        await this.prisma.queryTemplate.create({
          data: {
            intentCategory: tmpl.intent,
            templateText: tmpl.template,
            description: tmpl.description,
            platformSpecific: tmpl.platformSpecific || null,
            isWeekly: tmpl.isWeekly,
            isMonthly: tmpl.isMonthly,
            sortOrder: i,
            isActive: true,
          },
        });
        count++;
      } catch (e) {
        // duplicate 등 무시
      }
    }

    return { seeded: count };
  }
}
