import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenchmarkService, ResolvedBenchmark } from './benchmark.service';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 【슈퍼 개선】AI 환자 퍼널 진단 (Patient Funnel × AEO)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 범용 AEO 툴과의 결정적 차별점:
 *  - 범용 툴: "SoV 35%입니다" (점수 나열)
 *  - 우리:   "환자 여정 '비교 단계'에서 새고 있습니다.
 *             이번 달 신환 ~N명 / 약 X천만원 기회 손실" (퍼널 진단 + 매출 환산)
 *
 * 페이션트 퍼널 프레임워크 매핑:
 *  환자가 AI에게 묻는 질문의 의도(QueryIntent)는 환자 여정 단계를 드러냄
 *    AWARENESS     (인지)      ← INFORMATION  "임플란트 가격이 얼마야?"
 *    COMPARISON    (탐색·비교)  ← COMPARISON   "강남에서 임플란트 잘하는 곳 어디?"
 *    TRUST         (신뢰검증)   ← REVIEW+FEAR  "OO치과 후기 어때?" "임플란트 부작용 무서운데"
 *    DECISION      (결정·예약)  ← RESERVATION  "지금 예약 가능한 치과 추천해줘"
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── 퍼널 단계 정의 ───
export type FunnelStage = 'AWARENESS' | 'COMPARISON' | 'TRUST' | 'DECISION';

const STAGE_ORDER: FunnelStage[] = ['AWARENESS', 'COMPARISON', 'TRUST', 'DECISION'];

const INTENT_TO_STAGE: Record<string, FunnelStage> = {
  INFORMATION: 'AWARENESS',
  COMPARISON: 'COMPARISON',
  REVIEW: 'TRUST',
  FEAR: 'TRUST',
  RESERVATION: 'DECISION',
};

// benchmark 필드는 기본값(fallback)일 뿐, 실제 진단은 BenchmarkService의
// 실측 벤치마크(진료과별 전체 고객 병원 SoV 분포 p75)를 우선 사용한다.
const STAGE_META: Record<FunnelStage, {
  label: string;
  patientVoice: string;       // 이 단계 환자의 속마음
  weight: number;             // 신환 전환 기여 가중치 (결정 단계로 갈수록 ↑)
  benchmark: number;          // 단계별 권장 SoV 벤치마크 기본값 (%) — 실측 부족 시 fallback
}> = {
  AWARENESS:  { label: '인지',      patientVoice: '"이 시술이 뭐지? 가격은?"',          weight: 0.10, benchmark: 15 },
  COMPARISON: { label: '탐색·비교', patientVoice: '"우리 동네에서 어디가 잘하지?"',      weight: 0.30, benchmark: 30 },
  TRUST:      { label: '신뢰 검증', patientVoice: '"이 병원 진짜 괜찮을까? 부작용은?"',  weight: 0.25, benchmark: 25 },
  DECISION:   { label: '결정·예약', patientVoice: '"좋아, 지금 예약할 수 있는 곳은?"',   weight: 0.35, benchmark: 40 },
};

// ─── 진료과별 신환 객단가 (보수적 추정, 만원 단위 아님 — 원 단위) ───
// 출처: 업계 평균 추정치. 병원별 실제 객단가는 설정에서 커스텀 가능하도록 확장 여지
const SPECIALTY_AVG_REVENUE: Record<string, { perPatient: number; label: string }> = {
  DENTAL:            { perPatient: 1_200_000, label: '치과 (임플란트·교정 평균)' },
  DERMATOLOGY:       { perPatient: 450_000,   label: '피부과 (시술 패키지 평균)' },
  PLASTIC_SURGERY:   { perPatient: 3_500_000, label: '성형외과 (수술 평균)' },
  ORTHOPEDICS:       { perPatient: 800_000,   label: '정형외과 (비수술 치료 평균)' },
  KOREAN_MEDICINE:   { perPatient: 600_000,   label: '한의원 (추나·약침 패키지)' },
  OPHTHALMOLOGY:     { perPatient: 1_800_000, label: '안과 (라식·라섹 평균)' },
  INTERNAL_MEDICINE: { perPatient: 250_000,   label: '내과 (검진 패키지)' },
  UROLOGY:           { perPatient: 700_000,   label: '비뇨의학과' },
  ENT:               { perPatient: 300_000,   label: '이비인후과' },
  PSYCHIATRY:        { perPatient: 400_000,   label: '정신건강의학과' },
  OBGYN:             { perPatient: 500_000,   label: '산부인과' },
  PEDIATRICS:        { perPatient: 200_000,   label: '소아청소년과' },
  OTHER:             { perPatient: 500_000,   label: '기타 진료과' },
};

// AI 검색 경유 월간 잠재 신환 베이스 (보수적: AI 추천 1회 노출 → 실제 내원 전환 모델)
// 질문 1개가 대표하는 실제 월간 검색량 추정 (동일 의도 질문 묶음)
const MONTHLY_SEARCHES_PER_PROMPT = 40;  // 프롬프트 1개 ≈ 월 40회 유사 질문 발생 (보수적)
const AI_RECOMMEND_TO_VISIT_RATE = 0.03; // AI 추천 노출 → 실제 내원 전환율 3% (보수적)

export interface StageDiagnosis {
  stage: FunnelStage;
  label: string;
  patientVoice: string;
  sov: number;                  // 이 단계 SoV (%)
  prevSov: number | null;       // 직전 7일 대비
  trend: 'up' | 'down' | 'flat';
  benchmark: number;
  benchmarkSource: 'MEASURED' | 'DEFAULT'; // 실측 벤치마크 vs 기본값
  peerPosition: string | null;             // "상위 25%" 등 동료 그룹 내 위치
  peerSampleHospitals: number | null;      // 동료 그룹 표본 병원 수
  status: 'healthy' | 'warning' | 'critical';
  totalQueries: number;
  mentionedQueries: number;
  avgSentiment: number | null;  // -2 ~ +2
  r3Rate: number;               // 단독 추천 비율 (%)
  topCompetitors: { name: string; count: number }[];
  platformBreakdown: Record<string, { total: number; mentioned: number; sov: number }>;
  samplePrompts: { text: string; mentioned: boolean }[];
}

@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  constructor(
    private prisma: PrismaService,
    private benchmarkService: BenchmarkService,
  ) {}

  /**
   * AI 환자 퍼널 종합 진단
   */
  async getFunnelDiagnosis(hospitalId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const last7 = new Date();
    last7.setDate(last7.getDate() - 7);
    const prev7Start = new Date(last7);
    prev7Start.setDate(prev7Start.getDate() - 7);

    const [hospital, responses] = await Promise.all([
      this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true, specialtyType: true, regionSigungu: true },
      }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: since }, queryIntent: { not: null } },
        select: {
          queryIntent: true,
          isMentioned: true,
          sentimentScoreV2: true,
          recommendationDepth: true,
          aiPlatform: true,
          competitorsMentioned: true,
          responseDate: true,
          prompt: { select: { promptText: true } },
        },
        orderBy: { responseDate: 'desc' },
      }),
    ]);

    if (!hospital) {
      return { error: 'HOSPITAL_NOT_FOUND' };
    }

    // 【본질 강화 2】실측 벤치마크 해석: 진료과별 전체 고객 병원 분포(p75) 우선, 표본 부족 시 기본값
    const resolvedBenchmarks = await this.benchmarkService.resolveBenchmarks(
      hospital.specialtyType as string,
    );

    if (responses.length === 0) {
      return {
        hospital: { name: hospital.name, specialtyType: hospital.specialtyType },
        hasData: false,
        message: '아직 분석할 AI 응답 데이터가 없습니다. 첫 크롤링 후 퍼널 진단이 시작됩니다.',
      };
    }

    // ─── 1. 단계별 진단 ───
    const stages: StageDiagnosis[] = STAGE_ORDER.map((stage) => {
      const stageResponses = responses.filter(
        (r) => INTENT_TO_STAGE[r.queryIntent as string] === stage,
      );
      const recent = stageResponses.filter((r) => r.responseDate >= last7);
      const prev = stageResponses.filter(
        (r) => r.responseDate >= prev7Start && r.responseDate < last7,
      );

      const total = stageResponses.length;
      const mentioned = stageResponses.filter((r) => r.isMentioned).length;
      const sov = total > 0 ? Math.round((mentioned / total) * 1000) / 10 : 0;

      const recentSov = recent.length > 0
        ? (recent.filter((r) => r.isMentioned).length / recent.length) * 100 : null;
      const prevSov = prev.length > 0
        ? (prev.filter((r) => r.isMentioned).length / prev.length) * 100 : null;

      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (recentSov !== null && prevSov !== null) {
        if (recentSov - prevSov > 3) trend = 'up';
        else if (prevSov - recentSov > 3) trend = 'down';
      }

      // 감성 평균 (언급된 응답만)
      const sentiments = stageResponses
        .filter((r) => r.isMentioned && r.sentimentScoreV2 !== null)
        .map((r) => r.sentimentScoreV2 as number);
      const avgSentiment = sentiments.length > 0
        ? Math.round((sentiments.reduce((a, b) => a + b, 0) / sentiments.length) * 100) / 100
        : null;

      // R3 (단독추천) 비율
      const r3Count = stageResponses.filter((r) => r.recommendationDepth === 'R3').length;
      const r3Rate = total > 0 ? Math.round((r3Count / total) * 1000) / 10 : 0;

      // 이 단계에서 자주 등장하는 경쟁사
      const compCount: Record<string, number> = {};
      for (const r of stageResponses) {
        for (const c of r.competitorsMentioned || []) {
          compCount[c] = (compCount[c] || 0) + 1;
        }
      }
      const topCompetitors = Object.entries(compCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      // 플랫폼별 SoV
      const platformBreakdown: Record<string, { total: number; mentioned: number; sov: number }> = {};
      for (const r of stageResponses) {
        const p = r.aiPlatform as string;
        if (!platformBreakdown[p]) platformBreakdown[p] = { total: 0, mentioned: 0, sov: 0 };
        platformBreakdown[p].total++;
        if (r.isMentioned) platformBreakdown[p].mentioned++;
      }
      for (const p of Object.keys(platformBreakdown)) {
        const b = platformBreakdown[p];
        b.sov = Math.round((b.mentioned / b.total) * 1000) / 10;
      }

      // 샘플 질문 (미언급 우선 → 개선 포인트 노출)
      const seen = new Set<string>();
      const samplePrompts: { text: string; mentioned: boolean }[] = [];
      const sorted = [...stageResponses].sort((a, b) => Number(a.isMentioned) - Number(b.isMentioned));
      for (const r of sorted) {
        const text = r.prompt?.promptText;
        if (text && !seen.has(text) && samplePrompts.length < 3) {
          seen.add(text);
          samplePrompts.push({ text, mentioned: r.isMentioned });
        }
      }

      const meta = STAGE_META[stage];
      const bm: ResolvedBenchmark = resolvedBenchmarks[stage];
      const benchmark = bm.benchmark;
      const status: 'healthy' | 'warning' | 'critical' =
        sov >= benchmark ? 'healthy'
        : sov >= benchmark * 0.5 ? 'warning'
        : 'critical';

      return {
        stage,
        label: meta.label,
        patientVoice: meta.patientVoice,
        sov,
        prevSov: prevSov !== null ? Math.round(prevSov * 10) / 10 : null,
        trend,
        benchmark,
        benchmarkSource: bm.source,
        peerPosition: this.benchmarkService.positionInPeers(sov, bm),
        peerSampleHospitals: bm.sampleHospitals ?? null,
        status,
        totalQueries: total,
        mentionedQueries: mentioned,
        avgSentiment,
        r3Rate,
        topCompetitors,
        platformBreakdown,
        samplePrompts,
      };
    });

    // ─── 2. 누수(Leak) 감지: 가중치 × 벤치마크 갭이 가장 큰 단계 ───
    const leaks = stages
      .filter((s) => s.totalQueries > 0)
      .map((s) => ({
        stage: s.stage,
        label: s.label,
        gap: Math.max(0, s.benchmark - s.sov),
        weightedLoss: Math.max(0, s.benchmark - s.sov) * STAGE_META[s.stage].weight,
        status: s.status,
      }))
      .sort((a, b) => b.weightedLoss - a.weightedLoss);

    const primaryLeak = leaks.length > 0 && leaks[0].weightedLoss > 0 ? leaks[0] : null;

    // ─── 3. 신환 임팩트 (매출 환산) ───
    const revenue = SPECIALTY_AVG_REVENUE[hospital.specialtyType as string] || SPECIALTY_AVG_REVENUE.OTHER;
    const uniquePromptCount = new Set(responses.map((r) => r.prompt?.promptText)).size;

    // 결정·비교 단계(전환 직결)에서 미언급된 비율 → 기회 손실
    const conversionStages = stages.filter((s) => s.stage === 'DECISION' || s.stage === 'COMPARISON');
    let missedPatientsMin = 0;
    let missedPatientsMax = 0;
    for (const s of conversionStages) {
      if (s.totalQueries === 0) continue;
      const missRate = 1 - s.sov / 100;
      const stagePromptShare = uniquePromptCount * (s.totalQueries / responses.length);
      const monthlyMissedExposure = stagePromptShare * MONTHLY_SEARCHES_PER_PROMPT * missRate;
      const stageMissed = monthlyMissedExposure * AI_RECOMMEND_TO_VISIT_RATE * STAGE_META[s.stage].weight;
      missedPatientsMin += stageMissed * 0.5; // 보수 범위
      missedPatientsMax += stageMissed * 1.5;
    }
    missedPatientsMin = Math.round(missedPatientsMin);
    missedPatientsMax = Math.max(Math.round(missedPatientsMax), missedPatientsMin);

    const impactEstimate = {
      missedPatientsMin,
      missedPatientsMax,
      revenuePerPatient: revenue.perPatient,
      revenueBasis: revenue.label,
      monthlyLossMin: missedPatientsMin * revenue.perPatient,
      monthlyLossMax: missedPatientsMax * revenue.perPatient,
      disclaimer:
        '업계 평균 객단가와 보수적 전환율(3%) 기반 추정치입니다. 실제 수치는 병원 상황에 따라 다를 수 있습니다.',
    };

    // ─── 4. 퍼널 건강 점수 (0~100) ───
    let healthScore = 0;
    let weightSum = 0;
    for (const s of stages) {
      if (s.totalQueries === 0) continue;
      const w = STAGE_META[s.stage].weight;
      healthScore += Math.min(1, s.sov / s.benchmark) * w * 100;
      weightSum += w;
    }
    healthScore = weightSum > 0 ? Math.round(healthScore / weightSum) : 0;

    // ─── 5. 단계별 액션 플레이북 ───
    const playbook = this.buildPlaybook(stages, hospital.specialtyType as string, hospital.regionSigungu);

    // 벤치마크 메타정보 (프론트 "실측 기준" 배지용)
    const measuredStages = Object.values(resolvedBenchmarks).filter((b) => b.source === 'MEASURED');
    const benchmarkInfo = {
      mode: measuredStages.length > 0 ? ('MEASURED' as const) : ('DEFAULT' as const),
      measuredStageCount: measuredStages.length,
      sampleHospitals: measuredStages.length > 0
        ? Math.max(...measuredStages.map((b) => b.sampleHospitals || 0))
        : 0,
      description: measuredStages.length > 0
        ? `동일 진료과 고객 병원 실측 분포 기반 (상위 25% 수준 = 목표)`
        : '업계 권장 기본값 (표본 누적 중 — 동료 병원 5곳 이상 시 실측 전환)',
    };

    return {
      hospital: { name: hospital.name, specialtyType: hospital.specialtyType, region: hospital.regionSigungu },
      hasData: true,
      periodDays: days,
      analyzedResponses: responses.length,
      healthScore,
      healthGrade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
      stages,
      primaryLeak,
      leaks,
      impactEstimate,
      playbook,
      benchmarkInfo,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 퍼널 단계별 병원 전문 액션 플레이북
   * — 범용 AEO 툴이 절대 못 주는 병원 도메인 지식
   */
  private buildPlaybook(stages: StageDiagnosis[], specialtyType: string, region: string) {
    const actions: {
      stage: FunnelStage;
      stageLabel: string;
      priority: 'critical' | 'high' | 'medium';
      title: string;
      description: string;
      expectedEffect: string;
      effort: '낮음' | '중간' | '높음';
    }[] = [];

    const byStage = Object.fromEntries(stages.map((s) => [s.stage, s]));

    // AWARENESS 처방
    const aw = byStage.AWARENESS;
    if (aw && aw.totalQueries > 0 && aw.status !== 'healthy') {
      actions.push({
        stage: 'AWARENESS',
        stageLabel: '인지',
        priority: aw.status === 'critical' ? 'high' : 'medium',
        title: '시술 정보형 콘텐츠로 AI 인용 출처 선점',
        description:
          `"가격·기간·과정" 질문에 AI가 인용할 수 있는 구조화된 정보 콘텐츠가 부족합니다. ` +
          `FAQ 스키마를 적용한 시술 안내 페이지(가격표 포함)와 네이버 블로그 정보성 포스팅을 우선 발행하세요. ` +
          `56주 캘린더의 AWARENESS 단계 콘텐츠와 연동하면 효율적입니다.`,
        expectedEffect: '정보 탐색 질문 SoV +10~15%p (4~6주 소요)',
        effort: '중간',
      });
    }

    // COMPARISON 처방
    const cmp = byStage.COMPARISON;
    if (cmp && cmp.totalQueries > 0 && cmp.status !== 'healthy') {
      const compNames = cmp.topCompetitors.map((c) => c.name).join(', ');
      actions.push({
        stage: 'COMPARISON',
        stageLabel: '탐색·비교',
        priority: 'critical',
        title: `"${region} 추천" 질문에서 경쟁사에게 밀리는 중 — 권위 출처 보강 시급`,
        description:
          (compNames ? `현재 이 단계에서 ${compNames} 이(가) 자주 추천되고 있습니다. ` : '') +
          `AI는 비교 질문에 답할 때 의료 포털(모두닥 등)·네이버 플레이스 평점·전문의 정보를 근거로 씁니다. ` +
          `①네이버 플레이스 리뷰 100개+ 확보 ②모두닥/굿닥 프로필 완성도 100% ③전문의 약력·장비 정보를 공식 홈페이지에 구조화 — 이 3가지가 비교 단계 핵심 레버입니다.`,
        expectedEffect: '비교 질문 SoV +15~20%p, R2→R3 승격 가능성 ↑',
        effort: '중간',
      });
    }

    // TRUST 처방
    const tr = byStage.TRUST;
    if (tr && tr.totalQueries > 0) {
      if (tr.avgSentiment !== null && tr.avgSentiment < 0.5) {
        actions.push({
          stage: 'TRUST',
          stageLabel: '신뢰 검증',
          priority: 'critical',
          title: '후기·부작용 질문에서 감성 점수 낮음 — 평판 리스크 관리 필요',
          description:
            `AI가 우리 병원을 언급할 때 감성 톤이 중립~부정(${tr.avgSentiment})입니다. ` +
            `①최근 부정 리뷰 원인 파악 및 대응 ②치료 후기 콘텐츠(전후사진+환자 동의 스토리) 발행 ` +
            `③부작용·통증 우려 질문에 "안전 프로토콜" 콘텐츠로 선제 대응하세요. 공포(FEAR) 의도 질문은 전환 직전 환자가 많아 ROI가 높습니다.`,
          expectedEffect: '감성 점수 +1.0 이상, 신뢰 단계 SoV +10%p',
          effort: '높음',
        });
      } else if (tr.status !== 'healthy') {
        actions.push({
          stage: 'TRUST',
          stageLabel: '신뢰 검증',
          priority: 'high',
          title: '후기 콘텐츠 부족 — AI가 인용할 "환자 스토리" 만들기',
          description:
            `후기/걱정 질문에서 언급률이 낮습니다. AI는 실제 환자 경험담(블로그 후기, 카페 글, 플레이스 리뷰)을 근거로 답합니다. ` +
            `퇴원·치료 완료 환자 대상 후기 요청 자동화(알림톡)와 사례 콘텐츠 주 1회 발행을 권장합니다.`,
          expectedEffect: '신뢰 단계 SoV +8~12%p (6~8주 소요)',
          effort: '중간',
        });
      }
    }

    // DECISION 처방
    const dec = byStage.DECISION;
    if (dec && dec.totalQueries > 0 && dec.status !== 'healthy') {
      actions.push({
        stage: 'DECISION',
        stageLabel: '결정·예약',
        priority: 'critical',
        title: '예약 의도 질문 미노출 — 전환 직전 환자를 놓치는 중',
        description:
          `"지금 예약 가능한" 류의 질문은 내원 의사가 확정된 환자입니다. 여기서 안 보이면 다 차린 밥상을 뺏기는 격입니다. ` +
          `①네이버 예약/똑닥 연동 활성화 ②진료시간·야간/주말 진료 정보를 모든 채널에 일관되게 표기 ` +
          `③"당일 예약" "야간 진료" 키워드를 플레이스 소개글과 홈페이지에 명시 — AI는 예약 가능성 정보가 명확한 병원을 우선 추천합니다.`,
        expectedEffect: '예약 의도 SoV +15%p = 직접적인 신환 증가',
        effort: '낮음',
      });
    }

    // 잘하고 있는 단계 → 강화 처방
    const healthy = stages.filter((s) => s.status === 'healthy' && s.totalQueries > 0);
    for (const h of healthy.slice(0, 1)) {
      actions.push({
        stage: h.stage,
        stageLabel: h.label,
        priority: 'medium',
        title: `${h.label} 단계는 건강 — R3(단독 추천) 승격에 집중`,
        description:
          `이 단계 SoV는 벤치마크 이상입니다(${h.sov}%). 이제 "여러 추천 중 하나"에서 "단독 추천"으로 격상시킬 차례입니다. ` +
          `현재 R3 비율 ${h.r3Rate}% → Golden Prompt 분석에서 단독 추천받은 질문 패턴을 찾아 해당 주제 콘텐츠를 증폭하세요.`,
        expectedEffect: `R3 비율 ${h.r3Rate}% → ${Math.min(100, Math.round(h.r3Rate + 10))}%+`,
        effort: '낮음',
      });
    }

    const priorityRank = { critical: 0, high: 1, medium: 2 };
    return actions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  }
}
