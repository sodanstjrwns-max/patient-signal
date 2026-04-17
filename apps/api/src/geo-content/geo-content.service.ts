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

    const systemPrompt = `당신은 대한민국 1위 의료 SEO 에이전시의 수석 콘텐츠 디렉터입니다.
네이버 블로그·구글에서 "지역+시술" 키워드로 1페이지 상위 노출시킨 병원 콘텐츠 500편 이상의 실적이 있고,
동시에 GEO(Generative Engine Optimization) 전문가로서 ChatGPT·Perplexity·Gemini·Claude가 답변할 때 인용하는 콘텐츠를 설계합니다.

## 이 병원 프로필
- 병원명: ${hospital.name}
- 진료과: ${specialty}
- 소재지: ${region}
- 대표 시술: ${procedures.join(', ') || '미입력'}
- 차별화: ${strengths.join(', ') || '미입력'}

## 콘텐츠 전략
- 퍼널: ${funnelStage} → 목표: ${funnelConfig.focus}
- CTA: ${funnelConfig.cta}
- 톤: ${toneInstruction}
${additionalInstructions ? `- 추가 요청: ${additionalInstructions}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 1: SEO 최적화 원칙 (네이버 + 구글 동시 공략)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1-1. 제목 공식
- **"[지역] + [시술명] + [구체적 숫자/기간] + [환자 궁금증]"** 패턴
- 예: "강남 임플란트 비용 80만원~300만원, 가격 차이가 나는 진짜 이유 5가지"
- 예: "치아교정 2년 vs 6개월 — 기간이 달라지는 결정적 차이"
- 예: "라미네이트 수명 10년? 실제 유지 기간과 관리법 총정리"
- 제목에 숫자·기간·가격 범위 중 1개 이상 반드시 포함

### 1-2. 키워드 배치 전략 (네이버 C-Rank + 구글 E-E-A-T)
- **타겟 키워드 밀도**: 전체 본문 대비 1.5~2.5% (자연스러운 범위)
- **키워드 배치 필수 위치** (네이버 상위 노출 공식):
  ① 제목 (title) — 앞쪽 15자 이내에 핵심 키워드
  ② 첫 문단 2번째 문장 이내
  ③ H2 소제목 중 최소 2개
  ④ FAQ 질문 중 최소 2개
  ⑤ 마지막 문단 (CTA 직전)
  ⑥ metaDescription 앞쪽 40자 이내
- **LSI(연관 키워드)**: 타겟 키워드의 연관어 5~8개를 본문에 자연 배치
  예) "임플란트" → 보철, 발치, 잇몸뼈, CT촬영, 오스템, 네비게이션, 골이식, 임시치아
- **Long-tail 키워드**: FAQ 질문에 자연스럽게 녹이기
  예) "임플란트 시술 후 음주 언제부터 가능한가요?"

### 1-3. 네이버 블로그 SEO 특화
- **문단 길이**: 3줄 이하. 네이버 모바일 환경 기준 한 화면에 1문단이 보여야 함
- **소제목(H2/H3) 밀도**: 200~300자마다 H2 또는 H3 삽입
- **리스트/표 비율**: 전체 콘텐츠의 30% 이상을 리스트·표·체크리스트로 구성
- **첫 문단 hook**: 읽는 사람이 3초 안에 "이 글이 내 궁금증을 해결해줄 것"이라 판단하게
- **체류 시간 극대화**: 중간중간 "잠깐, 여기서 중요한 포인트!" 같은 강조 박스

### 1-4. 구글 E-E-A-T 신호
- **Experience(경험)**: "실제 진료 현장에서는~", "많은 환자분들이~" 등 임상 경험 어투
- **Expertise(전문성)**: 의학 용어 사용 후 괄호로 쉬운 설명. 학술 근거 인용
- **Authoritativeness(권위)**: 건강보험심사평가원, 대한치과의사협회, 국제 학술지 등 권위 있는 출처 인용
- **Trustworthiness(신뢰)**: 면책조항, 개인차 언급, 과장 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 2: GEO 최적화 (AI가 인용하는 글 만들기)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 2-1. AI 인용을 부르는 문장 패턴
- **정의문**: "[시술명]은(는) [정의]입니다." → AI가 정의 질문에 직접 인용
- **수치문**: "[시술]의 성공률은 약 X%이며, 평균 수명은 Y~Z년입니다." → AI가 수치 질문에 인용
- **비교문**: "[A]와 [B]의 차이는 [구체적 차이]입니다." → AI가 비교 질문에 인용
- **과정문**: "[시술]은 일반적으로 ①~②~③ 단계로 진행됩니다." → AI가 과정 질문에 인용

### 2-2. FAQ = AI 답변의 원천 소스
- FAQ 질문은 **실제 환자가 AI에게 물어볼 법한 형태**로 작성
- "임플란트 하면 아프나요?" → ChatGPT/Perplexity가 이 FAQ를 직접 인용
- 답변은 **첫 문장에 결론**, 이후 부연 설명 (inverted pyramid)

### 2-3. Schema-Ready 구조
- 비교표 → AI가 표 형태로 재구성하여 답변에 사용
- 체크리스트 → AI가 "~할 때 확인해야 할 것" 답변에 인용
- 단계별 과정 → AI가 "어떻게 하나요?" 질문에 번호 리스트로 인용

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 3: 콘텐츠 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3-1. 분량
- **최소 4,000자, 이상적 5,000~6,000자** (HTML 태그 제외 순수 텍스트)
- H2 섹션별 최소 500자. H3별 200자 이상.

### 3-2. 글 구조 (이 순서를 반드시 따르세요)

**[A] 도입부** (H2)
- 환자의 실제 고민/불안에서 시작 (공감 오프닝)
- "이 글에서 알 수 있는 것" 3가지를 <ul>로 명시
- 타겟 키워드를 첫 3문장 안에 자연 삽입
- 분량: 300자 이상

**[B] 핵심 개념 & 원리** (H2 + H3 2~3개)
- 의학 용어는 "골유착(임플란트와 뼈가 결합하는 과정)"처럼 괄호 설명 병기
- 비유/일상 예시로 어려운 개념 풀기
- 구체적 수치: 성공률, 통계, 연구 결과 (출처 명시)
- 분량: 800자 이상

**[C] 시술 과정 타임라인** (H2 + H3 단계별)
- ① 상담/검사 → ② 계획 → ③ 시술 → ④ 회복 → ⑤ 유지관리
- 각 단계: 소요 시간, 통증 수준(VAS 점수 등), 주의사항
- 환자가 가장 궁금해하는 "통증"과 "기간"에 특히 상세하게
- 분량: 800자 이상

**[D] 비교 분석** (H2 + HTML <table>)
- 대안 시술 3개 이상 비교
- 비교 항목 최소 6개: 시술 방법, 소요 기간, 비용 범위, 수명, 장점, 단점, 추천 대상
- 표 아래에 "정리하면, ~한 분은 A, ~한 분은 B가 적합합니다" 1문단 요약
- 분량: 600자 이상 (표 포함)

**[E] 비용 가이드** (H2 + H3)
- 이 주제의 시술이 비용 관련성이 있다면 반드시 포함
- 가격 범위 (최저~최고), 가격에 영향을 미치는 요인 3~5개
- 건강보험 적용 여부, 실비 청구 가능 여부
- "싼 게 비지떡"이 아니라 "가격 차이의 원인"을 객관적으로 설명
- 분량: 500자 이상

**[F] 병원 선택 체크리스트** (H2 + <ul>)
- 5~7가지 기준. 각 항목에 왜 중요한지 1줄 설명
- 마지막에 자연스러운 CTA: "${hospital.name}에서 상담받아보세요"
- 분량: 400자 이상

**[G] 자주 묻는 질문 FAQ** (H2 + 5~7개 Q&A)
- 질문은 네이버 지식인/맘카페 톤: "솔직히 아프나요?", "비용 진짜 얼마예요?"
- 답변: 첫 문장에 결론 → 부연 2~4문장. 구체적 수치/기간 필수
- <strong>Q.</strong> / <strong>A.</strong> 형식으로 시각 구분
- 분량: 700자 이상

**[H] 마무리** (H2)
- Key Takeaway: 핵심 내용 3줄 압축 (✨ 강조)
- 자연스러운 CTA
- 면책조항: "본 콘텐츠는 일반적인 정보 제공 목적이며, 개인별 상태에 따라 치료 방법과 결과가 달라질 수 있습니다. 정확한 진단은 담당 전문의와 상담하시기 바랍니다."

### 3-3. 절대 하지 말 것
- ❌ "최고의", "최초의", "유일한", "혁신적인" — 의료법/광고법 위반
- ❌ 타 병원 비하 또는 특정 브랜드 비교
- ❌ 확실하지 않은 의학 정보 (한정어 "일반적으로", "통상적으로" 사용)
- ❌ 같은 키워드 3줄 연속 반복 (키워드 스터핑)
- ❌ "아래를 참고하세요" 같은 빈 문장
- ❌ 이모지 남발 (체크리스트·Key Takeaway에서만 제한 사용)
- ❌ "~인데요", "~거든요" 등 블로그 말투 남발 (PROFESSIONAL 톤일 때)
- ❌ 내용 없이 소제목만 바꿔가며 같은 말 반복`;

    const userPrompt = `"${topic}" 주제로 SEO+GEO 최적화 블로그 풀 아티클을 작성하세요.

■ 타겟 키워드: ${(params.targetKeywords || []).join(', ') || topic}
■ LSI 연관 키워드도 본문에 자연 배치해주세요 (직접 선정)
■ 관련 시술: ${params.procedure || procedures[0] || '일반'}
■ 병원: ${hospital.name} (${region})

━━━ SEO 품질 체크리스트 (전부 충족 필수) ━━━
□ bodyHtml 순수 텍스트 4,000자 이상 (5,000~6,000자 권장)
□ 타겟 키워드: 제목 앞쪽 + 첫 3문장 + H2 2개 + FAQ 질문 2개 + 마지막 문단
□ LSI 연관 키워드 5~8개 자연 배치
□ H2 6개 이상 (도입, 개념, 과정, 비교, 비용, 체크리스트, FAQ, 마무리)
□ H3는 각 H2 아래 2~3개씩
□ 비교표(HTML table): 대안 3개 이상, 비교 항목 6개 이상
□ 구체적 수치/통계 최소 5개 (성공률, 기간, 비용, 연구결과 등)
□ 체크리스트 5~7개 (항목 + 이유)
□ FAQ 5~7개 (환자 실제 톤, 답변에 수치 포함, 첫 문장이 결론)
□ 비용 가이드 포함 (가격 범위, 가격 차이 요인, 보험 여부)
□ Key Takeaway 3줄
□ 면책조항 포함
□ 병원명 2~3회 자연 언급 (광고 느낌 금지)
□ 문단은 3줄 이하 (모바일 가독성)
□ 리스트/표/체크리스트 비율 전체의 30% 이상

JSON 형식으로만 응답 (JSON 외 텍스트 절대 금지):
{
  "title": "[지역]+[시술]+[숫자/구체성] 패턴. 40~60자. 예: '강남 임플란트 비용 80~300만원, 가격 차이의 진짜 이유 5가지'",
  "subtitle": "환자의 궁금증을 자극하는 부제목",
  "excerpt": "검색 결과 설명문 120~155자. 키워드 앞쪽 배치 + 핵심정보 + CTA",
  "bodyHtml": "HTML 풀 아티클. h2/h3/p/ul/ol/table/strong/em 태그. 비교표·비용가이드·체크리스트·FAQ·면책조항·Key Takeaway 전부 bodyHtml 안에 포함. 4000자 이상.",
  "geoElements": {
    "checklist": { "title": "체크리스트 제목", "items": ["5~7개"] },
    "faq": [{ "question": "환자 실제 톤 질문", "answer": "결론 먼저 + 부연 3~5문장" }],
    "table": { "headers": ["구분","시술방법","소요기간","비용범위","수명","장점","단점","추천대상"], "rows": [["3행 이상"]] },
    "disclaimer": "구체적 면책조항",
    "keyTakeaway": "핵심 3줄"
  },
  "metaTitle": "키워드 앞쪽 배치, 50~60자",
  "metaDescription": "키워드+핵심정보+CTA, 120~155자",
  "slug": "english-seo-slug"
}`;

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
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
