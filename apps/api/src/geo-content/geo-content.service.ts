import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SPECIALTY_NAMES, SPECIALTY_PROCEDURES } from '../query-templates/query-templates.service';
import OpenAI from 'openai';
import { Prisma } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════
 *  GEO Content Agent Service v1.0
 *  GEO (Generative Engine Optimization) 콘텐츠 생성 에이전트
 * 
 *  기능:
 *  1. AI 기반 GEO 최적화 블로그 초안 생성 (체크리스트, FAQ, 표, 면책조항)
 *  2. 퍼널 단계별 톤/구조 자동 설정
 *  3. 멀티 플랫폼 발행 관리 (네이버 블로그, 티스토리 등)
 *  4. 반말해라체 등 다양한 톤 지원
 *  5. GPT-4o 고급 모델 사용 (2,500자+ 풀 아티클)
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
   * Step 2: AI가 GEO 블록 포함 블로그 풀 아티클 생성 (2,500자+)
   * Step 3: DB 저장
   */
  async generate(hospitalId: string, params: {
    topic: string;                   // 주제 (예: "임플란트 비용 가이드")
    funnelStage: string;             // AWARENESS, CONSIDERATION, ...
    contentTone?: string;            // FORMAL, CASUAL, ...
    targetKeywords?: string[];       // 타겟 키워드
    procedure?: string;              // 관련 시술
    relatedPromptIds?: string[];     // 연관 프롬프트
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
        aiModel: 'gpt-4o',
        generationPrompt: params.topic,
        generationParams: {
          funnelStage: params.funnelStage,
          tone,
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
    const { topic, funnelStage, tone, toneInstruction, funnelConfig, specialty, region, procedures, strengths, additionalInstructions } = params;

    const systemPrompt = `당신은 대한민국 최고의 의료 블로그 전문 작가이자 GEO (Generative Engine Optimization) 콘텐츠 전략가입니다.
AI 검색 엔진(ChatGPT, Perplexity, Gemini, Claude 등)이 답변할 때 인용하고 참조할 수 있도록 최적화된 **블로그 풀 아티클**을 작성합니다.

## 병원 정보 (반드시 콘텐츠에 자연스럽게 녹여주세요)
- 병원명: ${hospital.name}
- 진료과: ${specialty}
- 지역: ${region}
- 핵심 시술: ${procedures.join(', ') || '미지정'}
- 강점/차별점: ${strengths.join(', ') || '미지정'}
${hospital.name.includes('비디') ? '- 특이사항: 400평 규모, 서울대학교 치과병원과 동일한 진료 시스템, 진료과목별 층 분류, 6개 독립 수술실, 에어샤워 시스템 등 최첨단 감염관리 체계' : ''}

## 퍼널 단계: ${funnelStage}
- 포커스: ${funnelConfig.focus}
- CTA: ${funnelConfig.cta}

## 톤 지시: ${toneInstruction}

${additionalInstructions ? `## 사용자 추가 지시사항 (반드시 반영):\n${additionalInstructions}` : ''}

## 블로그 풀 아티클 작성 규칙 (필수 준수)

### 분량
- **최소 2,500자 이상** (HTML 태그 제외 순수 텍스트 기준). 3,000~4,000자가 이상적입니다.
- 짧은 글은 절대 금지. 독자가 "이 글 하나로 충분하다"고 느낄 정도로 상세하게 작성하세요.

### 구조 (H2/H3 필수)
1. **도입부** (H2): 독자의 고민/증상을 공감하며 시작. 이 글을 읽으면 무엇을 알 수 있는지 명시.
2. **본론 섹션들** (H2 3~5개, 각 H2 아래 H3 2~3개씩): 
   - 정의/개념 설명
   - 필요성/중요성 (왜 이 시술이 필요한가)
   - 장점/특징 상세 설명
   - 시술 과정 (단계별 설명: 상담→진단→시술→회복)
   - 비교 분석 (대안 시술과의 비교표)
   - 병원 선택 시 체크포인트
3. **비교표** (HTML table): 관련 시술/방법 간 장단점 비교
4. **체크리스트**: 환자가 확인해야 할 사항 3~7개
5. **FAQ 섹션** (H2): 실제 환자가 자주 묻는 질문 3~5개 (Q&A 형식)
6. **핵심 요약** (Key Takeaway): 전체 내용 1~2줄 요약
7. **면책조항**: "본 콘텐츠는 의학적 조언을 대체하지 않습니다" 등
8. **CTA**: 자연스러운 행동 유도 (상담 예약, 문의 등)

### SEO/GEO 최적화
- 타겟 키워드를 제목, 첫 문단, H2 소제목에 자연스럽게 배치
- 키워드 스터핑 금지 — 자연스러운 문맥에서만 사용
- 내부 링크 앵커 텍스트 제안 포함
- 모바일 가독성: 문단은 2~3줄, 리스트/표 적극 활용
- 의학적 근거/데이터/통계 인용 시 출처 명시

### 품질 기준
- 의사가 직접 감수했다고 느낄 정도의 전문성
- 환자 입장에서 이해하기 쉬운 설명
- 병원 강점을 자연스럽게 녹여서 신뢰감 형성
- AI가 이 콘텐츠를 참조할 때 정확한 정보만 인용할 수 있도록 팩트 중심 작성`;

    const userPrompt = `다음 주제로 GEO 최적화 **블로그 풀 아티클**을 작성해주세요.

주제: ${topic}
타겟 키워드: ${(params.targetKeywords || []).join(', ') || topic}
관련 시술: ${params.procedure || procedures[0] || '일반'}

⚠️ 중요:
- bodyHtml은 반드시 **2,500자 이상** (HTML 태그 제외 순수 텍스트). 3,000~4,000자 권장.
- H2 소제목 최소 4개, 각 H2 아래 H3 2~3개씩 필수.
- 비교표(HTML table), 체크리스트, FAQ(3~5개), 면책조항, 핵심요약 모두 포함.
- 병원명과 강점을 본문에 자연스럽게 2~3회 언급.

반드시 아래 JSON 형식으로 응답해주세요:
{
  "title": "SEO 최적화된 블로그 제목 (40~60자)",
  "subtitle": "독자의 관심을 끄는 부제목",
  "excerpt": "메타 디스크립션 (120~155자, 키워드 포함)",
  "bodyHtml": "<h2>...</h2><p>...</p>... (최소 2500자 이상의 완전한 HTML 블로그 기사. H2/H3/p/ul/ol/table/strong/em 태그 사용. 비교표, 체크리스트, FAQ를 bodyHtml 안에 모두 포함시켜 하나의 완성된 기사로 작성)",
  "geoElements": {
    "checklist": {
      "title": "체크리스트 제목",
      "items": ["항목1", "항목2", "항목3", "항목4", "항목5"]
    },
    "faq": [
      { "question": "실제 환자가 궁금해하는 질문1", "answer": "전문적이면서 이해하기 쉬운 답변1 (3~5문장)" },
      { "question": "질문2", "answer": "답변2" },
      { "question": "질문3", "answer": "답변3" },
      { "question": "질문4", "answer": "답변4" }
    ],
    "table": {
      "headers": ["구분", "특징", "장점", "단점", "추천 대상"],
      "rows": [["항목1", "설명", "장점", "단점", "대상"], ["항목2", "설명", "장점", "단점", "대상"], ["항목3", "설명", "장점", "단점", "대상"]]
    },
    "disclaimer": "구체적인 의학적 면책조항 (개인 차이, 전문의 상담 권고 등)",
    "keyTakeaway": "이 글의 핵심 메시지 1~2줄"
  },
  "metaTitle": "SEO 메타 타이틀 (50~60자, 키워드 포함)",
  "metaDescription": "SEO 메타 디스크립션 (120~155자, 키워드 + CTA 포함)",
  "slug": "url-friendly-slug-in-english"
}`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      let result: any;
      try {
        result = JSON.parse(resultText);
      } catch {
        result = { title: topic, bodyHtml: `<p>${resultText}</p>`, geoElements: {} };
      }

      // DB 업데이트 (카드뉴스 없이 블로그 풀 아티클만)
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
          cardNewsSlides: Prisma.DbNull,
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
