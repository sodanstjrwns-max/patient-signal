import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SPECIALTY_NAMES, SPECIALTY_PROCEDURES } from '../query-templates/query-templates.service';
import OpenAI from 'openai';

/**
 * ═══════════════════════════════════════════════════════════
 *  GEO Content Agent Service v1.0
 *  GEO (Generative Engine Optimization) 콘텐츠 생성 에이전트
 * 
 *  기능:
 *  1. AI 기반 GEO 최적화 콘텐츠 생성 (체크리스트, FAQ, 표, 면책조항)
 *  2. 퍼널 단계별 톤/구조 자동 설정
 *  3. 카드뉴스 슬라이드 자동 생성
 *  4. 멀티 플랫폼 발행 관리 (네이버 블로그, 티스토리 등)
 *  5. 반말해라체 등 다양한 톤 지원
 * ═══════════════════════════════════════════════════════════
 */

// GEO 콘텐츠 블록 타입
interface GeoElements {
  checklist?: { title: string; items: string[] };
  faq?: Array<{ question: string; answer: string }>;
  table?: { headers: string[]; rows: string[][] };
  disclaimer?: string;
  citations?: Array<{ title: string; url?: string }>;
  keyTakeaway?: string;
}

// 퍼널별 톤 매핑
const FUNNEL_TONE_MAP: Record<string, { defaultTone: string; focus: string; cta: string }> = {
  AWARENESS: {
    defaultTone: 'FRIENDLY',
    focus: '증상 인지, 치료 필요성 교육, 공감',
    cta: '자세히 알아보기 / 무료 상담 예약',
  },
  CONSIDERATION: {
    defaultTone: 'PROFESSIONAL',
    focus: '비교 분석, 장단점, 비용, 후기',
    cta: '상담 받아보기 / 비교 표 다운로드',
  },
  DECISION: {
    defaultTone: 'POLITE',
    focus: '병원 차별점, 전문성, 접근성, 실적',
    cta: '지금 예약하기 / 전화 상담',
  },
  RETENTION: {
    defaultTone: 'FRIENDLY',
    focus: '관리 팁, 정기검진, 이벤트, 감사',
    cta: '다음 검진 예약 / 이벤트 확인',
  },
  ADVOCACY: {
    defaultTone: 'CASUAL',
    focus: '환자 후기, 소개 이벤트, 커뮤니티',
    cta: '후기 남기기 / 지인 소개 혜택',
  },
};

// 톤별 시스템 프롬프트
const TONE_INSTRUCTIONS: Record<string, string> = {
  FORMAL: '존댓말(합쇼체)로 작성하세요. 예: "~습니다", "~하십시오". 격식체를 유지합니다.',
  POLITE: '해요체로 작성하세요. 예: "~해요", "~이에요". 친절하면서도 정중합니다.',
  CASUAL: '반말해라체로 작성하세요. 예: "~해", "~야", "~거든". 친구에게 말하듯 편하게 씁니다. 이모지도 자유롭게 사용하세요.',
  FRIENDLY: '친근체로 작성하세요. 해요체를 기반으로 하되 가벼운 이모지와 구어체 표현을 섞어주세요.',
  PROFESSIONAL: '전문가 톤으로 작성하세요. 의학적 근거를 인용하고, 데이터와 통계를 활용합니다. 존댓말을 사용하되 권위 있는 톤입니다.',
};

@Injectable()
export class GeoContentService {
  private readonly logger = new Logger(GeoContentService.name);
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey.length > 20) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI API 연결 완료 (GEO Content Agent)');
    }
  }

  // ==================== CRUD ====================

  async findAll(hospitalId: string, options?: {
    status?: string;
    funnelStage?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { hospitalId };
    if (options?.status) where.status = options.status;
    if (options?.funnelStage) where.funnelStage = options.funnelStage;

    const [items, total] = await Promise.all([
      this.prisma.geoContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
        include: {
          publications: true,
          _count: { select: { publications: true } },
        },
      }),
      this.prisma.geoContent.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string, hospitalId: string) {
    const content = await this.prisma.geoContent.findUnique({
      where: { id },
      include: { publications: true },
    });

    if (!content) throw new NotFoundException('콘텐츠를 찾을 수 없습니다');
    if (content.hospitalId !== hospitalId) throw new ForbiddenException('접근 권한이 없습니다');

    return content;
  }

  async update(id: string, hospitalId: string, data: {
    title?: string;
    subtitle?: string;
    bodyHtml?: string;
    bodyMarkdown?: string;
    excerpt?: string;
    funnelStage?: string;
    contentTone?: string;
    targetKeywords?: string[];
    procedure?: string;
    geoElements?: any;
    metaTitle?: string;
    metaDescription?: string;
    slug?: string;
    status?: string;
  }) {
    const content = await this.prisma.geoContent.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('콘텐츠를 찾을 수 없습니다');
    if (content.hospitalId !== hospitalId) throw new ForbiddenException('접근 권한이 없습니다');

    return this.prisma.geoContent.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string, hospitalId: string) {
    const content = await this.prisma.geoContent.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('콘텐츠를 찾을 수 없습니다');
    if (content.hospitalId !== hospitalId) throw new ForbiddenException('접근 권한이 없습니다');

    await this.prisma.geoContent.delete({ where: { id } });
    return { success: true };
  }

  // ==================== AI 콘텐츠 생성 ====================

  /**
   * GEO 최적화 콘텐츠 생성
   * 
   * Step 1: 병원 정보 + 퍼널 단계 + 톤 + 키워드 수집
   * Step 2: AI가 GEO 블록 포함 콘텐츠 생성
   * Step 3: 카드뉴스 슬라이드 자동 생성
   * Step 4: DB 저장
   */
  async generate(hospitalId: string, params: {
    topic: string;                   // 주제 (예: "임플란트 비용 가이드")
    funnelStage: string;             // AWARENESS, CONSIDERATION, ...
    contentTone?: string;            // FORMAL, CASUAL, ...
    targetKeywords?: string[];       // 타겟 키워드
    procedure?: string;              // 관련 시술
    relatedPromptIds?: string[];     // 연관 프롬프트
    includeCardNews?: boolean;       // 카드뉴스 포함
    additionalInstructions?: string; // 추가 지시사항
  }) {
    if (!this.openai) {
      throw new Error('OpenAI API가 설정되지 않았습니다');
    }

    // 병원 정보 로드
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    const specialty = SPECIALTY_NAMES[hospital.specialtyType] || '병원';
    const region = `${hospital.regionSido} ${hospital.regionSigungu}`;
    const procedures = hospital.coreTreatments?.length > 0
      ? hospital.coreTreatments
      : hospital.keyProcedures || [];
    const strengths = hospital.hospitalStrengths || [];

    // 퍼널별 기본 설정
    const funnelConfig = FUNNEL_TONE_MAP[params.funnelStage] || FUNNEL_TONE_MAP.AWARENESS;
    const tone = params.contentTone || funnelConfig.defaultTone;
    const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.POLITE;

    // 콘텐츠 DB 레코드 생성 (GENERATING 상태)
    const content = await this.prisma.geoContent.create({
      data: {
        hospitalId,
        title: params.topic,
        bodyHtml: '',
        funnelStage: params.funnelStage as any,
        contentTone: tone as any,
        targetKeywords: params.targetKeywords || [],
        relatedPromptIds: params.relatedPromptIds || [],
        procedure: params.procedure,
        status: 'GENERATING',
        aiModel: 'gpt-4o-mini',
        generationPrompt: params.topic,
        generationParams: {
          funnelStage: params.funnelStage,
          tone,
          includeCardNews: params.includeCardNews,
        },
      },
    });

    // AI 콘텐츠 생성 (비동기)
    this.generateContentAsync(content.id, hospital, {
      ...params,
      tone,
      toneInstruction,
      funnelConfig,
      specialty,
      region,
      procedures,
      strengths,
    }).catch(err => {
      this.logger.error(`GEO 콘텐츠 생성 실패 [${content.id}]: ${err.message}`);
      this.prisma.geoContent.update({
        where: { id: content.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
    });

    return {
      id: content.id,
      status: 'GENERATING',
      message: 'AI가 콘텐츠를 생성하고 있습니다. 잠시 후 확인해주세요.',
    };
  }

  /**
   * 비동기 AI 콘텐츠 생성
   */
  private async generateContentAsync(
    contentId: string,
    hospital: any,
    params: any,
  ) {
    const { topic, funnelStage, tone, toneInstruction, funnelConfig, specialty, region, procedures, strengths, includeCardNews, additionalInstructions } = params;

    const systemPrompt = `당신은 의료 마케팅 전문가이자 GEO (Generative Engine Optimization) 콘텐츠 작가입니다.
AI 검색 엔진(ChatGPT, Perplexity, Gemini 등)이 답변할 때 인용하고 참조할 수 있도록 최적화된 콘텐츠를 작성합니다.

병원 정보:
- 병원명: ${hospital.name}
- 진료과: ${specialty}
- 지역: ${region}
- 핵심 시술: ${procedures.join(', ') || '미지정'}
- 강점: ${strengths.join(', ') || '미지정'}

퍼널 단계: ${funnelStage}
- 포커스: ${funnelConfig.focus}
- CTA: ${funnelConfig.cta}

톤 지시: ${toneInstruction}

${additionalInstructions ? `추가 지시사항: ${additionalInstructions}` : ''}

GEO 최적화 규칙:
1. 구조화된 콘텐츠: 명확한 H2/H3 소제목, 번호 리스트, 표 활용
2. FAQ 섹션 필수 포함 (3~5개)
3. 체크리스트 포함 (3~7개 항목)
4. 비교 표 1개 포함 (해당 시)
5. 의학적 면책조항 포함
6. 핵심 포인트(Key Takeaway) 1줄 요약
7. 자연스러운 키워드 배치 (키워드 스터핑 금지)
8. 모바일 가독성 고려 (짧은 문단, 2~3줄)`;

    const userPrompt = `다음 주제로 GEO 최적화 블로그 콘텐츠를 작성해주세요.

주제: ${topic}
타겟 키워드: ${(params.targetKeywords || []).join(', ') || topic}
관련 시술: ${params.procedure || procedures[0] || '일반'}

반드시 아래 JSON 형식으로 응답해주세요:
{
  "title": "SEO 최적화된 제목",
  "subtitle": "부제목",
  "excerpt": "메타 디스크립션 (120자 이내)",
  "bodyHtml": "HTML 본문 (H2, H3, ul, ol, table, p 태그 사용)",
  "geoElements": {
    "checklist": {
      "title": "체크리스트 제목",
      "items": ["항목1", "항목2", "항목3"]
    },
    "faq": [
      { "question": "질문1", "answer": "답변1" },
      { "question": "질문2", "answer": "답변2" },
      { "question": "질문3", "answer": "답변3" }
    ],
    "table": {
      "headers": ["항목", "설명", "비고"],
      "rows": [["데이터1", "설명1", "비고1"]]
    },
    "disclaimer": "의학적 면책조항",
    "keyTakeaway": "핵심 포인트 1줄 요약"
  },
  "metaTitle": "SEO 메타 타이틀 (60자 이내)",
  "metaDescription": "SEO 메타 디스크립션 (155자 이내)",
  "slug": "url-friendly-slug"
}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      let result: any;
      try {
        result = JSON.parse(resultText);
      } catch {
        result = { title: topic, bodyHtml: `<p>${resultText}</p>`, geoElements: {} };
      }

      // 카드뉴스 생성
      let cardNewsSlides = null;
      if (includeCardNews && result.bodyHtml) {
        cardNewsSlides = await this.generateCardNews(result, hospital, specialty);
      }

      // DB 업데이트
      await this.prisma.geoContent.update({
        where: { id: contentId },
        data: {
          title: result.title || topic,
          subtitle: result.subtitle,
          bodyHtml: result.bodyHtml || '',
          excerpt: result.excerpt,
          geoElements: result.geoElements || {},
          metaTitle: result.metaTitle,
          metaDescription: result.metaDescription,
          slug: result.slug,
          cardNewsSlides: cardNewsSlides,
          status: 'REVIEW',
        },
      });

      this.logger.log(`GEO 콘텐츠 생성 완료 [${contentId}]: ${result.title}`);
    } catch (error) {
      this.logger.error(`GEO 콘텐츠 AI 생성 실패: ${error.message}`);
      await this.prisma.geoContent.update({
        where: { id: contentId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  /**
   * 카드뉴스 슬라이드 자동 생성
   */
  private async generateCardNews(content: any, hospital: any, specialty: string) {
    if (!this.openai) return null;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 인스타그램 카드뉴스 전문가입니다. 의료 콘텐츠를 5~7장 슬라이드 카드뉴스로 변환합니다.
각 슬라이드는 짧고 임팩트 있는 텍스트만 포함합니다 (배경 색상 제안 포함).`,
          },
          {
            role: 'user',
            content: `아래 콘텐츠를 카드뉴스로 변환해주세요.
제목: ${content.title}
본문 요약: ${content.excerpt || content.title}
병원: ${hospital.name} (${specialty})

JSON 형식으로 응답:
{
  "slides": [
    { "slideNumber": 1, "title": "슬라이드 제목", "body": "본문 (2~3줄)", "bgColor": "#색상코드", "textColor": "#색상코드" }
  ]
}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(text);
      return result.slides || null;
    } catch {
      this.logger.warn('카드뉴스 생성 실패 - 스킵');
      return null;
    }
  }

  // ==================== 발행 관리 ====================

  async addPublication(contentId: string, hospitalId: string, platform: string, data?: {
    publishedUrl?: string;
    scheduledAt?: string;
  }) {
    const content = await this.prisma.geoContent.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException('콘텐츠를 찾을 수 없습니다');
    if (content.hospitalId !== hospitalId) throw new ForbiddenException('접근 권한이 없습니다');

    return this.prisma.geoPublication.upsert({
      where: {
        contentId_platform: { contentId, platform: platform as any },
      },
      update: {
        publishedUrl: data?.publishedUrl,
        publishedAt: data?.publishedUrl ? new Date() : undefined,
        scheduledAt: data?.scheduledAt ? new Date(data.scheduledAt) : undefined,
        isPublished: !!data?.publishedUrl,
      },
      create: {
        contentId,
        platform: platform as any,
        publishedUrl: data?.publishedUrl,
        publishedAt: data?.publishedUrl ? new Date() : undefined,
        scheduledAt: data?.scheduledAt ? new Date(data.scheduledAt) : undefined,
        isPublished: !!data?.publishedUrl,
      },
    });
  }

  // ==================== 대시보드 통계 ====================

  async getStats(hospitalId: string) {
    const [total, byStatus, byFunnel, recentContents] = await Promise.all([
      this.prisma.geoContent.count({ where: { hospitalId } }),
      this.prisma.geoContent.groupBy({
        by: ['status'],
        where: { hospitalId },
        _count: true,
      }),
      this.prisma.geoContent.groupBy({
        by: ['funnelStage'],
        where: { hospitalId },
        _count: true,
      }),
      this.prisma.geoContent.findMany({
        where: { hospitalId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, funnelStage: true, createdAt: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      byFunnel: byFunnel.reduce((acc, f) => ({ ...acc, [f.funnelStage]: f._count }), {}),
      recentContents,
    };
  }
}
