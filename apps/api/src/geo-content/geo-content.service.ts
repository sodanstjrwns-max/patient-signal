import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SPECIALTY_NAMES, SPECIALTY_PROCEDURES } from '../query-templates/query-templates.service';
import Anthropic from '@anthropic-ai/sdk';
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
 *  5. Claude Sonnet 4 고급 모델 사용 (2,500자+ 풀 아티클)
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
  private anthropic: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey && apiKey.length > 20) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic Claude API 연결 완료 (GEO Content Agent)');
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
    if (!this.anthropic) {
      throw new Error('Anthropic API가 설정되지 않았습니다');
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
        aiModel: 'claude-sonnet-4-20250514',
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

    const systemPrompt = `당신은 대한민국 최고의 의료 콘텐츠 전략가이자, 네이버 블로그·티스토리에서 실제로 상위 노출되는 병원 블로그를 200편 이상 작성한 전문 메디컬 라이터입니다.
동시에 GEO(Generative Engine Optimization) 전문가로서, AI 검색 엔진(ChatGPT, Perplexity, Gemini, Claude)이 이 콘텐츠를 "신뢰할 수 있는 출처"로 인용하도록 설계합니다.

## 이 병원의 프로필
- 병원명: ${hospital.name}
- 진료과목: ${specialty}
- 소재지: ${region}
- 대표 시술: ${procedures.join(', ') || '정보 없음'}
- 차별화 포인트: ${strengths.join(', ') || '정보 없음'}

## 콘텐츠 전략 컨텍스트
- 퍼널 단계: ${funnelStage}
- 이 단계의 핵심 목표: ${funnelConfig.focus}
- 행동 유도(CTA): ${funnelConfig.cta}
- 톤앤매너: ${toneInstruction}
${additionalInstructions ? `- 원장님 추가 요청사항: ${additionalInstructions}` : ''}

─────────────────────────────────────────────
## 작성 원칙 — "이 글 하나로 환자의 모든 궁금증을 해결한다"
─────────────────────────────────────────────

### 1. 콘텐츠 철학
- **"읽고 나면 병원에 전화하고 싶어지는 글"**을 목표로 하세요.
- 뻔한 정보 나열이 아니라, 환자가 진짜 밤에 검색하면서 불안해하는 감정에 공감하고 답을 주세요.
- 원장이 진료실에서 환자에게 직접 설명하듯 따뜻하면서도 전문적인 톤을 유지하세요.
- 광고성 과장(최고, 최초, 유일 등)은 절대 금지. 팩트와 논리로 신뢰를 쌓으세요.

### 2. 분량 & 깊이
- **최소 3,000자, 이상적으로 4,000~5,000자** (HTML 태그 제외 순수 텍스트).
- 각 H2 섹션은 최소 400자 이상. H3 소주제별로 150자 이상.
- "아 이것도 알려줘야 하는데…"라는 생각이 들면 그것까지 포함하세요.

### 3. 글 구조 (반드시 순서대로)

**[도입] 환자의 감정에서 시작하기**
- "혹시 ~한 고민을 하고 계신가요?" 식의 공감 오프닝
- 이 글을 끝까지 읽으면 얻게 될 3가지 정보를 bullet point로 명시
- 도입부에 타겟 키워드 자연 삽입

**[본론 1] 핵심 개념 — 쉽게, 하지만 정확하게**
- 의학 용어를 쓸 때는 반드시 괄호 안에 쉬운 설명 병기: "골유착(임플란트가 뼈와 결합하는 과정)"
- 비유나 일상 예시로 어려운 개념을 풀어주세요
- 가능하면 **구체적인 수치/데이터** 포함:
  예) "국내 임플란트 시술 건수는 연간 약 100만 건(건강보험심사평가원, 2024)"
  예) "치아 상실 후 1년 내 시술 시 성공률 97%, 5년 이상 방치 시 80%대로 하락"

**[본론 2] 시술 과정 — 환자 여정 타임라인**
- ① 상담/검사 → ② 치료 계획 → ③ 시술 → ④ 회복 → ⑤ 사후 관리
- 각 단계별 소요 시간, 통증 수준, 주의사항을 구체적으로
- "이때 이런 병원을 선택하면 좋습니다" 형태로 해당 병원의 강점을 자연스럽게 연결

**[본론 3] 비교 분석 — 표로 한눈에**
- 반드시 HTML <table>로 대안 시술/방법 3개 이상 비교
- 비교 항목: 특징, 수명/내구성, 비용 범위, 시술 기간, 장점, 단점, 추천 대상
- 표 아래에 "결론적으로 ~한 분에게는 A가, ~한 분에게는 B가 적합합니다" 요약

**[본론 4] 병원 선택 체크리스트**
- 환자가 병원을 고를 때 확인해야 할 5~7가지 기준
- ✅ 이모지 + 항목명 + 왜 중요한지 1줄 설명 형태
- 마지막에 "위 체크리스트에 부합하는 병원을 찾으신다면, ${hospital.name}에서 상담받아보세요" 식의 자연스러운 CTA

**[FAQ] 자주 묻는 질문 — 진짜 환자가 묻는 것**
- 5~7개의 Q&A. 네이버 지식인, 맘카페에서 실제로 올라오는 질문 톤
- 질문 예시: "아프지 않나요?", "비용은 얼마나 드나요?", "얼마나 오래 가나요?"
- 답변은 3~5문장. 두루뭉술한 답 금지. 구체적 수치/기간/방법 포함
- <strong>Q.</strong> / <strong>A.</strong> 형식으로 시각적 구분

**[마무리] 핵심 정리 + 행동 유도**
- ✨ Key Takeaway 박스: 전체 내용을 3줄로 압축
- 자연스러운 CTA: "궁금한 점이 있으시다면 ${hospital.name}에서 부담 없이 상담받아보세요"
- 면책조항: "본 콘텐츠는 일반적인 정보 제공 목적이며, 개인의 구강 상태에 따라 치료 방법과 결과가 달라질 수 있습니다. 정확한 진단은 전문의와 상담하세요."

### 4. GEO 최적화 전략 (AI가 인용하게 만들기)
- 팩트 기반 문장을 많이 쓸수록 AI가 인용합니다. 주관적 의견보다 객관적 사실.
- "~입니다"로 끝나는 단정형 문장이 AI 인용에 유리합니다.
- FAQ를 <strong>Q.</strong> <strong>A.</strong> 로 구조화하면 AI가 직접 답변 소스로 사용합니다.
- 비교표의 수치 데이터는 AI가 표 형태로 재인용합니다.
- 타겟 키워드를: 제목, 첫 문단, H2 2개 이상, FAQ 질문에 자연 삽입.

### 5. 절대 하지 말 것
- ❌ "최고의", "최초의", "유일한" 등 광고법 위반 표현
- ❌ 특정 브랜드 비하 또는 타 병원 언급
- ❌ 의학적으로 부정확한 정보 (확실하지 않으면 "일반적으로", "통상적으로" 한정어 사용)
- ❌ 키워드 스터핑 (같은 키워드를 3줄 연속 반복 등)
- ❌ "자세한 내용은 아래를 참고하세요" 같은 빈 문장
- ❌ 이모지 남발 (체크리스트와 Key Takeaway에서만 제한적 사용)`;

    const userPrompt = `아래 정보를 바탕으로 "${topic}"에 대한 블로그 풀 아티클을 작성해주세요.

■ 주제: ${topic}
■ 타겟 키워드: ${(params.targetKeywords || []).join(', ') || topic}
■ 관련 시술/분야: ${params.procedure || procedures[0] || '일반'}
■ 병원명: ${hospital.name} (${region})

━━━ 품질 체크리스트 (모두 충족해야 합니다) ━━━
□ bodyHtml 순수 텍스트 3,000자 이상 (4,000~5,000자 권장)
□ H2 소제목 5개 이상, 각 H2 아래 H3 2~3개
□ 도입부에서 환자 감정 공감 + 이 글에서 얻을 정보 3가지 bullet
□ 비교표(HTML table) 1개: 대안 3개 이상, 5개 이상 비교 항목
□ 구체적 수치/데이터 최소 3개 (기간, 비용 범위, 성공률 등)
□ 체크리스트 5~7개 (✅ 이모지 + 항목 + 이유 1줄)
□ FAQ 5~7개 (실제 환자 톤, 답변 3~5문장, 구체적)
□ Key Takeaway 3줄 요약
□ 면책조항 포함
□ 병원명은 본문에서 2~3회 자연스럽게 언급 (광고 느낌 금지)
□ 키워드 스터핑 없음, 자연스러운 배치

반드시 아래 JSON 형식으로만 응답하세요 (JSON 외 텍스트 금지):
{
  "title": "검색 클릭을 부르는 제목 40~60자. 숫자/구체성 포함. 예: '임플란트 수명 10년? 20년? — 수명을 결정하는 5가지 핵심 요소'",
  "subtitle": "제목을 보완하는 부제목. 환자의 궁금증을 자극",
  "excerpt": "네이버/구글 검색 결과에 보이는 설명문 120~155자. 키워드 + 핵심정보 + CTA 포함",
  "bodyHtml": "완전한 HTML 블로그 기사. h2/h3/p/ul/ol/table/strong/em 태그 사용. 비교표·체크리스트·FAQ·면책조항·Key Takeaway 모두 bodyHtml 안에 포함. 최소 3000자 이상.",
  "geoElements": {
    "checklist": {
      "title": "~할 때 확인해야 할 체크리스트",
      "items": ["5~7개의 체크 항목"]
    },
    "faq": [
      { "question": "환자가 실제로 묻는 질문 (네이버 지식인 톤)", "answer": "구체적 수치/기간 포함 답변 3~5문장" }
    ],
    "table": {
      "headers": ["구분", "특징", "수명/기간", "비용 범위", "장점", "단점", "추천 대상"],
      "rows": [["최소 3행 이상"]]
    },
    "disclaimer": "개인별 차이, 전문의 상담 권고 등 구체적 면책조항",
    "keyTakeaway": "이 글의 핵심 메시지 1~3줄"
  },
  "metaTitle": "SEO 메타 타이틀 50~60자 (키워드 앞쪽 배치)",
  "metaDescription": "메타 디스크립션 120~155자 (키워드 + 핵심정보 + CTA)",
  "slug": "english-url-slug-with-keywords"
}`;

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
      const rawText = textBlock?.text || '{}';
      // Claude는 JSON 앞뒤에 설명 텍스트를 붙일 수 있으므로 첫 { ~ 마지막 } 만 추출
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const resultText = jsonMatch ? jsonMatch[0] : '{}';
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
