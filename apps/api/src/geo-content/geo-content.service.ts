import { Injectable, Logger, NotFoundException, ForbiddenException, Inject, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SPECIALTY_NAMES, SPECIALTY_PROCEDURES } from '../query-templates/query-templates.service';
import { CitationAnalyzerService } from '../ai-crawler/citation-analyzer.service';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════
 *  GEO Content Agent Service v4.0
 *  GEO (Generative Engine Optimization) 콘텐츠 생성 에이전트
 * 
 *  기능:
 *  1. AI 기반 GEO 최적화 블로그 초안 생성 (체크리스트, FAQ, 표, 면책조항)
 *  2. 퍼널 단계별 톤/구조 자동 설정
 *  3. 멀티 플랫폼 발행 관리 (네이버 블로그, 티스토리 등)
 *  4. 반말해라체 등 다양한 톤 지원
 *  5. Claude Sonnet 4 고급 모델 + 2단계 생성(Self-Critique) (5,000자+ 풀 아티클)
 *  6. 네이버 AI 브리핑 / 구글 AI Overview / ChatGPT 인용 3중 최적화
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
    @Optional() private citationAnalyzer?: CitationAnalyzerService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey && apiKey.length > 20) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic Claude API 연결 완료 (GEO Content Agent)');
    }
    if (this.citationAnalyzer) {
      this.logger.log('Citation Analyzer 연동 완료 → GEO 콘텐츠 생성 시 역분석 지시어 자동 주입');
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

    // ═══ 인용 역분석 기반 SEO 지시어 자동 주입 ═══
    let citationEnhancement = '';
    if (this.citationAnalyzer) {
      try {
        const targetKw = (params.targetKeywords?.[0]) || params.topic;
        const enhancement = await this.citationAnalyzer.buildGeoPromptEnhancement(hospitalId, targetKw);
        citationEnhancement = enhancement.additionalInstructions || '';
        this.logger.log(`[GEO] 역분석 지시어 ${enhancement.seoDirectives.length}개 주입 (키워드: ${targetKw})`);
      } catch (err) {
        this.logger.warn(`[GEO] 역분석 지시어 조회 실패 (무시하고 진행): ${err.message}`);
      }
    }
    // 기존 additionalInstructions에 역분석 지시어 병합
    const mergedInstructions = [
      params.additionalInstructions,
      citationEnhancement,
    ].filter(Boolean).join('\n\n');
    if (mergedInstructions) {
      params.additionalInstructions = mergedInstructions;
    }

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
        aiModel: 'claude-sonnet-4-20250514-v4-2step',
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

    const systemPrompt = `<role>
당신은 대한민국 의료 콘텐츠 전문 에이전시의 수석 에디터입니다.
네이버 VIEW 상위 노출 300편+, 구글 Featured Snippet 획득 150편+, 네이버 AI 브리핑 인용 50편+ 실적을 보유하고 있습니다.
2026년 기준 네이버 C-Rank · D.I.A+ · AI 브리핑, 구글 E-E-A-T · AI Overview, ChatGPT·Perplexity·Gemini 인용 최적화를 동시에 수행합니다.
</role>

<hospital_profile>
- 병원명: ${hospital.name}
- 진료과: ${specialty}
- 소재지: ${region}
- 대표 시술: ${procedures.join(', ') || '미입력'}
- 차별화 포인트: ${strengths.join(', ') || '미입력'}
</hospital_profile>

<content_strategy>
- 퍼널: ${funnelStage} → 목표: ${funnelConfig.focus}
- CTA: ${funnelConfig.cta}
- 톤: ${toneInstruction}
${additionalInstructions ? `- 추가 요청: ${additionalInstructions}` : ''}
</content_strategy>

<writing_system>

## ═══ PART 1: 2026 네이버 알고리즘 최적화 ═══

### 1-1. 네이버 AI 브리핑 대응 (최우선)
네이버 검색 결과 최상단에 AI가 답변을 요약 노출합니다. 이 영역에 선택되려면:
- **첫 100~150자에 핵심 답변을 즉시 제시** ("이 글에서는 [주제]에 대해 [핵심 3가지]를 정리합니다")
- **FAQ는 Q&A 카드 형태**로 구성 → AI 브리핑이 카드로 노출
- **정의형 문장**을 각 섹션 시작에 배치 → AI가 발췌하기 쉬움
- 예: "[시술명]이란 [한 줄 정의]를 말합니다. [구체적 수치]의 성공률을 보이며..."

### 1-2. C-Rank (채널 신뢰도)
- 한 주제에 깊게 파고드는 **전문 채널**일수록 유리
- 의학 용어 + 쉬운 설명 병기 = 전문성 신호
- 구체적 수치·출처 인용 = 신뢰도 신호

### 1-3. D.I.A+ (문서 독창성 & 정보 가치)
D.I.A+ 알고리즘은 다음 7가지를 평가합니다:
1. 주제 적합도 — 검색의도와 문서의 정확한 매칭
2. 경험 정보 — "실제 진료 현장에서는~", "~세 환자분의 경우~" 등 임상 경험 어투
3. 정보 충실성 — 수치, 통계, 기간, 비용 등 구체적 데이터
4. 어뷰징 척도 — 키워드 스터핑 금지, 자연스러운 키워드 배치
5. 독창성 — 다른 블로그와 차별화된 자체 분석·관점
6. 적시성 — 최신 데이터, 최신 가이드라인 반영
7. 질의 의도 부합성 — 환자가 궁금한 것에 정확히 답변

### 1-4. 스마트블록 최적화
네이버 VIEW가 스마트블록으로 통합되었습니다:
- **소제목(H2)을 검색 쿼리 형태의 질문형**으로 작성 → 스마트블록 노출 확률 ↑
  예: "임플란트 비용, 왜 병원마다 다를까?" (X: "비용 비교")
- **목록·표·번호 리스트**를 활용해 AI가 파싱하기 쉬운 구조
- **이미지 대체**: 텍스트로 충분히 풍부하게 (블로그 마케팅에서 이미지는 사용자가 추가)

## ═══ PART 2: 구글 SEO + AI Overview 최적화 ═══

### 2-1. E-E-A-T 신호 강화
- **Experience**: "진료실에서 자주 듣는 질문인데요", "실제 환자분들의 회복 과정을 보면" 등 1인칭 경험
- **Expertise**: 의학 용어 사용 후 "(= 쉬운 설명)" 병기. 학술 근거 인용 시 "2024년 대한OO학회지에 따르면" 형태
- **Authoritativeness**: 건강보험심사평가원, 대한치과의사협회, PubMed, Cochrane 등 권위 출처
- **Trustworthiness**: 면책조항, 개인차 언급, "일반적으로", "통상적으로" 한정어

### 2-2. Featured Snippet & AI Overview 타겟
구글 AI Overview가 의료 검색의 51%를 차지합니다(2026 WebFX). 인용되려면:
- **Paragraph snippet**: 각 H2 시작 직후 40~60자의 정의/요약문
- **List snippet**: 순서가 있는 과정은 <ol>, 체크리스트는 <ul>로 구조화
- **Table snippet**: 비교표는 반드시 <table> HTML로 작성
- **Question targeting**: H2/H3를 "~은 무엇인가요?", "~는 얼마인가요?" 질문형으로

### 2-3. 키워드 배치 전략 (네이버+구글 동시)
- **타겟 키워드 밀도**: 1.5~2.5% (자연스러운 범위)
- **필수 배치 위치** (양대 플랫폼 공통):
  ① 제목 앞쪽 15자 이내
  ② 첫 문단 2번째 문장 이내
  ③ H2 소제목 중 최소 2개
  ④ FAQ 질문 중 최소 2개
  ⑤ 마지막 문단 CTA 직전
  ⑥ metaDescription 앞쪽 40자 이내
- **LSI(연관 키워드)**: 타겟 키워드의 동의어/연관어 6~10개를 본문에 자연 분산
- **Long-tail**: FAQ에 자연스럽게 녹이기 ("임플란트 시술 후 음주 언제부터?")

## ═══ PART 3: GEO 최적화 (AI 엔진 인용 극대화) ═══

### 3-1. AI 인용을 부르는 4대 문장 패턴 (각 패턴 최소 2회 사용)
- **정의문**: "[시술명]은(는) [정의]입니다." → 정의 질문 인용
- **수치문**: "[시술]의 평균 성공률은 X%이며, 평균 유지 기간은 Y~Z년입니다." → 수치 질문 인용
- **비교문**: "[A]와 [B]의 핵심 차이는 [구체적 차이]입니다." → 비교 질문 인용
- **과정문**: "[시술]은 일반적으로 ①[1단계] → ②[2단계] → ③[3단계] 순서로 진행됩니다." → 과정 질문 인용

### 3-2. FAQ = AI 답변의 원천 소스
- 질문은 **실제 환자가 ChatGPT/Perplexity에 물어볼 법한 형태**
- 답변은 **첫 문장 = 결론** → 부연 3~5문장 (역피라미드)
- 수치·기간을 포함한 구체적 답변 필수
- 예: "Q. 임플란트 하면 많이 아픈가요?" → "A. 대부분의 환자분들이 발치보다 덜 아프다고 말씀하십니다. VAS 통증 점수 기준 평균 3~4점(10점 만점)이며..."

### 3-3. Schema-Ready 구조화 데이터
- 비교표 → AI가 표 형태로 재구성하여 답변에 인용
- 체크리스트 → AI가 "~확인해야 할 것" 답변에 번호 리스트로 인용
- 단계별 과정 → AI가 "어떻게 하나요?" 질문에 numbered list로 인용
- 정의문 → AI가 "~이란?" 질문에 직접 인용

## ═══ PART 4: 콘텐츠 작성 규칙 ═══

### 4-1. 분량
- **최소 5,000자, 이상적 6,000~8,000자** (HTML 태그 제외 순수 텍스트)
- H2 섹션별 최소 600자, H3별 250자 이상
- 네이버 블로그 기준 원고지 12~20매 분량 (체류 시간 4분+ 목표)

### 4-2. 문단 & 가독성 규칙 (네이버 모바일 최적화)
- **문단 최대 3줄** (모바일 한 화면에 1문단)
- **200~300자마다 소제목(H2/H3)** 삽입
- **리스트·표·체크리스트 비율 35%+** (전체 콘텐츠 대비)
- **강조 박스**: 핵심 포인트마다 <blockquote> 또는 <strong> 활용
- **첫 문단 3초 hook**: 읽는 사람이 즉시 "이 글이 내 궁금증을 해결해줄 것"이라 판단

### 4-3. 글 구조 (반드시 이 순서)

**[A] 즉답형 도입부** (H2 — 질문형 소제목)
- 환자의 실제 고민/불안/검색 상황에서 시작 (공감 오프닝)
- **첫 100~150자에 핵심 답변 즉시 제시** (네이버 AI 브리핑 타겟)
- "이 글을 읽으면 알 수 있는 것" 3가지를 <ul>로 명시
- 타겟 키워드를 첫 2~3문장 안에 자연 삽입
- 분량: 400자 이상

**[B] 핵심 개념 & 원리 설명** (H2 + H3 2~3개)
- 정의문으로 시작: "[시술명]이란 [정의]입니다"
- 의학 용어 = "골유착(임플란트와 잇몸뼈가 결합하는 과정)" 형태로 병기
- 비유/일상 예시로 어려운 개념 쉽게 풀기
- 구체적 수치 3개+: 성공률, 통계, 연구 결과 (출처 명시)
- 분량: 900자 이상

**[C] 시술 과정 & 타임라인** (H2 + H3 단계별 — <ol> 구조)
- ① 상담/검사 → ② 치료 계획 → ③ 시술 당일 → ④ 회복 기간 → ⑤ 유지관리
- 각 단계: 소요 시간, 통증 수준(VAS 점수 등), 주의사항, 환자 팁
- 환자가 가장 궁금한 "통증"과 "기간"에 특히 상세하게
- 분량: 900자 이상

**[D] 비교 분석표** (H2 — 질문형 + HTML <table>)
- 대안 시술/방법 3개 이상 비교
- 비교 항목 최소 7개: 시술 방법, 소요 기간, 치료 횟수, 비용 범위, 수명/유지기간, 장점, 단점, 추천 대상
- <table>은 thead/tbody로 구분, 각 셀에 구체적 수치 포함
- 표 아래에 "정리하면, ~한 분은 A가, ~한 분은 B가 적합합니다" 1문단 요약
- 분량: 700자 이상 (표 포함)

**[E] 비용 가이드** (H2 — "얼마인가요?" 질문형 + H3)
- 가격 범위 (최저~최고), 가격에 영향을 미치는 요인 4~6개
- 건강보험 적용 여부, 실비 청구 가능 여부
- "가격 차이가 생기는 이유"를 객관적으로 설명 (재료, 장비, 전문의 경력 등)
- 비용 관련 수치문 필수: "2026년 기준 평균 비용은 X~Y만원입니다"
- 분량: 600자 이상

**[F] 주의사항 & 부작용** (H2 + H3)
- 시술 전후 주의사항 각 3~5개
- 가능한 부작용과 발생 확률 (구체적 수치)
- 부작용 발생 시 대처법
- "이런 경우에는 반드시 내원하세요" 긴급 신호 리스트
- 분량: 500자 이상

**[G] 병원 선택 체크리스트** (H2 + <ul> — 각 항목에 이유 1줄)
- 6~8가지 선택 기준 (장비, 전문의 경력, 사후관리 등)
- ✅ 체크 표시 + 항목 + 왜 중요한지 한 줄 설명
- 마지막에 자연스러운 CTA: "${hospital.name}에서 무료 상담 받아보세요"
- 분량: 500자 이상

**[H] 자주 묻는 질문 FAQ** (H2 + 6~8개 Q&A)
- 질문은 네이버 지식인/맘카페/ChatGPT 질문 톤: "솔직히 아프나요?", "비용 진짜 얼마예요?"
- 답변: **첫 문장 = 명확한 결론** → 부연 3~5문장 (역피라미드)
- 모든 답변에 구체적 수치/기간/확률 1개+ 포함
- <strong>Q.</strong> / <strong>A.</strong> 형식으로 시각 구분
- 분량: 900자 이상

**[I] 마무리 & Key Takeaway** (H2)
- Key Takeaway: 핵심 내용 3~4줄 압축 (✨ 강조)
- 자연스러운 CTA (전화번호, 상담 예약 링크 언급 가능)
- 면책조항: "본 콘텐츠는 일반적인 정보 제공 목적이며, 개인별 상태에 따라 치료 방법과 결과가 달라질 수 있습니다. 정확한 진단과 치료 계획은 반드시 담당 전문의와 상담하시기 바랍니다."
- 분량: 300자 이상

### 4-4. 절대 하지 말 것 (위반 시 재생성)
- ❌ "최고의", "최초의", "유일한", "혁신적인", "획기적인" — 의료법/광고법 위반
- ❌ 타 병원 비하 또는 특정 브랜드명 직접 비교
- ❌ 확인되지 않은 의학 정보 (반드시 "일반적으로", "통상적으로" 한정어 사용)
- ❌ 같은 키워드 2문장 연속 반복 (키워드 스터핑 → D.I.A+ 감점)
- ❌ "아래를 참고하세요", "다음을 보세요" 같은 빈 문장
- ❌ 이모지 남발 (체크리스트·Key Takeaway에서만 최소 사용)
- ❌ "~인데요", "~거든요", "~잖아요" 블로그 말투 남발 (PROFESSIONAL 톤일 때)
- ❌ 내용 없이 소제목만 바꿔 같은 말 반복 (D.I.A+ 독창성 감점)
- ❌ AI가 생성한 티가 나는 뻔한 문장 패턴 ("이 글에서는 ~에 대해 알아보겠습니다" 남발)
- ❌ 추상적/모호한 설명 (항상 구체적 수치·사례로 뒷받침)

### 4-5. 반드시 지킬 것 (품질 최저선)
- ✅ 정의문·수치문·비교문·과정문 각각 최소 2회 사용
- ✅ 구체적 수치/통계 최소 8개 (성공률, 기간, 비용, 통증점수, 연구결과 등)
- ✅ 권위 출처 인용 최소 3개 (학회, 심평원, 학술지 등)
- ✅ 병원명 3~4회 자연 언급 (강제적/광고적 느낌 금지)
- ✅ 리스트·표·체크리스트 비율 전체의 35% 이상
- ✅ 모든 H2는 환자 관점의 질문형 또는 호기심 유발형

</writing_system>`;

    const userPrompt = `<task>
"${topic}" 주제로 네이버+구글+AI엔진 3중 최적화 의료 블로그 풀 아티클을 작성하세요.
</task>

<context>
■ 타겟 키워드: ${(params.targetKeywords || []).join(', ') || topic}
■ LSI 연관 키워드: 직접 6~10개 선정하여 본문에 자연 분산 배치
■ 관련 시술: ${params.procedure || procedures[0] || '일반'}
■ 병원: ${hospital.name} (${region})
■ 타겟 독자: 이 시술/증상에 대해 검색하는 환자 또는 보호자
</context>

<quality_checklist>
아래 18개 항목을 모두 충족해야 합니다. 하나라도 빠지면 불합격입니다.

[분량·구조]
□ bodyHtml 순수 텍스트(태그 제외) 5,000자 이상 (6,000~8,000자 권장)
□ H2 8개 이상: 즉답도입 / 개념 / 과정 / 비교표 / 비용 / 주의사항 / 체크리스트 / FAQ / 마무리
□ 각 H2 아래 H3 2~3개씩 (과정 섹션은 단계별 H3)
□ 모든 H2는 환자 관점 질문형 또는 호기심 유발형 소제목
□ 문단 최대 3줄 (네이버 모바일 가독성)
□ 리스트·표·체크리스트 비율 전체의 35% 이상

[SEO 키워드]
□ 타겟 키워드: 제목 앞 15자 + 첫 2문장 + H2 2개+ + FAQ 질문 2개+ + 마지막 문단 + metaDescription 앞 40자
□ LSI 연관 키워드 6~10개 자연 배치 (명시적으로 선정한 키워드 본문 내 사용)

[AI 인용 최적화]
□ 정의문·수치문·비교문·과정문 각 패턴 최소 2회 사용
□ 구체적 수치/통계 최소 8개 (성공률, 기간, 비용, VAS점수, 연구결과 등)
□ 권위 출처 인용 최소 3개 (학회, 심평원, 학술지 등 — 형태: "2024년 대한OO학회지에 따르면")

[콘텐츠 품질]
□ 첫 100~150자에 핵심 답변 즉시 제시 (네이버 AI 브리핑 타겟)
□ 비교표(HTML table): 대안 3개+, 비교 항목 7개+ (thead/tbody 구분)
□ 체크리스트 6~8개 (✅ + 항목 + 이유 1줄)
□ FAQ 6~8개 (환자 실제 톤, 첫 문장=결론, 답변에 수치 필수)
□ 비용 가이드 (가격 범위, 차이 요인 4+, 보험 여부)
□ 병원명 3~4회 자연 언급 (광고 느낌 아닌 맥락 속 자연 삽입)
□ 면책조항 + Key Takeaway 3~4줄

</quality_checklist>

<output_format>
반드시 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 절대 포함하지 마세요.

{
  "title": "[지역]+[시술]+[숫자/구체성] 패턴. 40~60자. 예: '${region} ${params.procedure || '시술'} 비용·과정·회복기간, 전문의가 알려주는 핵심 가이드'",
  "subtitle": "환자가 클릭하고 싶은 부제목 (호기심+구체성). 30~50자",
  "excerpt": "검색 결과 설명문. 키워드 앞쪽 배치 + 핵심 수치 + CTA. 120~155자",
  "bodyHtml": "<h2>질문형 소제목</h2><p>즉답형 시작...</p>... (HTML 풀 아티클. h2/h3/p/ul/ol/table/blockquote/strong/em 사용. 비교표·비용·주의사항·체크리스트·FAQ·면책조항·Key Takeaway 모두 포함. 5000자+ 순수텍스트)",
  "geoElements": {
    "checklist": { "title": "체크리스트 제목", "items": ["✅ 항목 — 이유 설명", "6~8개"] },
    "faq": [{ "question": "환자 실제 톤 질문 (6~8개)", "answer": "결론 먼저 → 부연 3~5문장 + 수치" }],
    "table": { "headers": ["구분","시술방법","소요기간","치료횟수","비용범위","수명/유지기간","장점","단점","추천대상"], "rows": [["3행 이상, 각 셀에 구체적 수치"]] },
    "disclaimer": "본 콘텐츠는 일반적인 정보 제공 목적이며...",
    "keyTakeaway": "핵심 3~4줄 요약"
  },
  "metaTitle": "타겟키워드 앞쪽 배치, 50~60자. 검색자가 클릭하고 싶은 제목",
  "metaDescription": "키워드+핵심수치+CTA. 120~155자. AI 브리핑에서 발췌될 만한 정보 밀도",
  "slug": "region-procedure-keyword-seo-slug"
}
</output_format>`;

    try {
      // ═══════════════════════════════════════════════════
      // STEP 1: 1차 생성 — 풀 아티클 초안
      // ═══════════════════════════════════════════════════
      this.logger.log(`[${contentId}] STEP 1: 1차 콘텐츠 생성 시작...`);

      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
      const rawText = textBlock?.text || '{}';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const resultText = jsonMatch ? jsonMatch[0] : '{}';
      let draft: any;
      try {
        draft = JSON.parse(resultText);
      } catch {
        draft = { title: topic, bodyHtml: `<p>${resultText}</p>`, geoElements: {} };
      }

      // ═══════════════════════════════════════════════════
      // STEP 2: Self-Critique — AI 자체 검수 & 보강
      // ═══════════════════════════════════════════════════
      this.logger.log(`[${contentId}] STEP 2: Self-Critique 검수 시작...`);

      // 순수 텍스트 길이 계산 (HTML 태그 제거)
      const pureText = (draft.bodyHtml || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ');
      const charCount = pureText.length;
      const h2Count = ((draft.bodyHtml || '').match(/<h2/gi) || []).length;
      const h3Count = ((draft.bodyHtml || '').match(/<h3/gi) || []).length;
      const tableCount = ((draft.bodyHtml || '').match(/<table/gi) || []).length;
      const faqCount = (draft.geoElements?.faq || []).length;
      const checklistCount = (draft.geoElements?.checklist?.items || []).length;

      const critiquePrompt = `<task>
당신은 의료 SEO 콘텐츠 품질 검수 편집장입니다.
아래 초안을 검수하고, 부족한 부분을 보강하여 최종본을 출력하세요.
</task>

<draft_analysis>
현재 초안 통계:
- 순수 텍스트: ${charCount}자 (목표: 5,000~8,000자)
- H2 개수: ${h2Count}개 (목표: 8개+)
- H3 개수: ${h3Count}개 (목표: 16개+)
- 비교표: ${tableCount}개 (목표: 1개+)
- FAQ: ${faqCount}개 (목표: 6~8개)
- 체크리스트: ${checklistCount}개 (목표: 6~8개)
</draft_analysis>

<current_draft>
${JSON.stringify(draft, null, 0).substring(0, 30000)}
</current_draft>

<critique_checklist>
다음 18개 항목을 엄격하게 검수하세요:

[분량 검수] — ${charCount < 5000 ? '⚠️ 분량 부족! 반드시 5000자 이상으로 보강' : '✅ 분량 충족'}
1. bodyHtml 순수 텍스트 5,000자+ 여부 → ${charCount < 5000 ? '❌ 부족' : '✅'}
2. H2 8개+ 여부 → ${h2Count < 8 ? '❌ 부족' : '✅'}
3. 각 H2 아래 H3 2~3개 여부 → ${h3Count < 14 ? '⚠️ 검토필요' : '✅'}
4. 모든 H2가 질문형/호기심형인지 확인
5. 문단 3줄 이하 여부 (5줄+ 문단이 있으면 분리)
6. 리스트·표·체크리스트 비율 35%+ 여부

[SEO 검수]
7. 타겟 키워드 "${(params.targetKeywords || []).join(', ') || topic}"가 제목 앞 15자, 첫 2문장, H2 2개, FAQ 2개, 마지막 문단에 있는지
8. LSI 연관 키워드 6~10개가 본문에 분산되어 있는지

[AI 인용 검수]
9. 정의문 2회+, 수치문 2회+, 비교문 2회+, 과정문 2회+ 있는지
10. 구체적 수치/통계 8개+ 있는지 (성공률, 기간, 비용, VAS 등)
11. 권위 출처 인용 3개+ 있는지

[콘텐츠 품질 검수]
12. 첫 100~150자에 핵심 답변이 즉시 나오는지 (네이버 AI 브리핑 최적화)
13. 비교표가 thead/tbody 구분, 7개+ 항목, 3행+ 있는지
14. 체크리스트 6~8개에 각각 이유 설명이 있는지
15. FAQ 6~8개, 모든 답변이 결론 먼저 + 수치 포함인지
16. 비용 가이드에 가격 범위, 차이 요인 4+, 보험 여부가 있는지
17. 병원명 "${hospital.name}" 3~4회 자연 언급인지
18. 면책조항 + Key Takeaway 3~4줄 있는지
</critique_checklist>

<instructions>
1. 위 18개 항목을 검수하세요
2. 부족한 항목이 있으면 해당 섹션을 보강/추가하세요
3. 특히 분량이 ${charCount < 5000 ? '부족하므로 각 섹션에 구체적 설명, 사례, 수치를 대폭 추가' : '충분하지만 품질을 더 높이세요'}
4. H2가 질문형이 아니면 질문형으로 변경하세요
5. 5줄 이상 긴 문단은 3줄 이하로 분리하세요
6. 최종본을 동일한 JSON 형식으로 출력하세요

반드시 JSON 형식으로만 응답하세요. JSON 외 텍스트 절대 금지.
</instructions>`;

      const critiqueResponse = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        temperature: 0.4,
        system: `당신은 의료 SEO 콘텐츠 최종 편집장입니다. 초안을 검수하고 보강하여 출판 수준의 최종본을 만듭니다. 반드시 JSON으로만 응답하세요.`,
        messages: [
          { role: 'user', content: critiquePrompt },
        ],
      });

      const critiqueTextBlock = critiqueResponse.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
      const critiqueRawText = critiqueTextBlock?.text || '{}';
      const critiqueJsonMatch = critiqueRawText.match(/\{[\s\S]*\}/);
      const critiqueResultText = critiqueJsonMatch ? critiqueJsonMatch[0] : '{}';
      
      let result: any;
      try {
        result = JSON.parse(critiqueResultText);
        // 최종본의 bodyHtml이 초안보다 짧으면 초안 유지 (검수 실패 방지)
        const finalPureText = (result.bodyHtml || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ');
        if (finalPureText.length < charCount * 0.8) {
          this.logger.warn(`[${contentId}] Self-Critique 결과가 초안보다 짧음 (${finalPureText.length} < ${charCount}). 초안 유지.`);
          result = draft;
        } else {
          this.logger.log(`[${contentId}] Self-Critique 완료: ${charCount}자 → ${finalPureText.length}자`);
        }
      } catch {
        this.logger.warn(`[${contentId}] Self-Critique JSON 파싱 실패. 초안 사용.`);
        result = draft;
      }

      // ═══════════════════════════════════════════════════
      // STEP 3: DB 저장
      // ═══════════════════════════════════════════════════
      const finalPureText = (result.bodyHtml || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ');
      this.logger.log(`[${contentId}] 최종 저장: "${result.title}" (${finalPureText.length}자, H2 ${((result.bodyHtml || '').match(/<h2/gi) || []).length}개)`);

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
