import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * 【PS-통합】Patient Series Open API v1 — 시그널 공급자
 *
 * 개인정보 절대 원칙: 집계·비식별 데이터만 반환.
 * 환자/직원 식별 정보 없음 — AEO 점수·경쟁사 순위·인용 도메인 집계만 다룬다.
 *
 * 신호 4종:
 *  1. aeo_score_drop        — AEO 종합점수 하락
 *  2. competitor_overtake   — 경쟁 병원 순위 역전
 *  3. citation_lost         — 주요 질문에서 인용(언급) 상실
 *  4. new_competitor        — 신규 경쟁자 진입 (자동 감지)
 */

export interface PsSignal {
  signal_id: string;
  type: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  summary: string;
  occurred_at: string;
  data?: Record<string, any>;
}

const KST_OFFSET = '+09:00';

/** Date(UTC 자정 저장) → 'YYYY-MM-DD' */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → KST ISO8601 (신호 발생 시각은 해당일 09:00 KST로 표준화) */
function toKstIso(dateStr: string, hour = 9): string {
  return `${dateStr}T${String(hour).padStart(2, '0')}:00:00${KST_OFFSET}`;
}

/** Date → KST(+09:00) ISO8601 (시각 보존) */
function toKstIsoExact(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 3600_000);
  return kst.toISOString().replace(/\.\d{3}Z$/, KST_OFFSET);
}

@Injectable()
export class PsOpenApiService {
  private readonly logger = new Logger(PsOpenApiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * GET /api/v1/signals
   * @param hospitalId 로컬 hospitalId (가드가 매핑 완료)
   * @param since ISO8601 — 주어지면 그 이후 발생분만
   */
  async getSignals(hospitalId: string, since?: string): Promise<{ service: string; signals: PsSignal[] }> {
    const sinceDate = since ? new Date(since) : null;
    const signals: PsSignal[] = [];

    // 최근 21일 DailyScore (추세 판단용) — 없으면 신호 없음 (가짜 신호 생성 금지)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 21);
    const scores = await this.prisma.dailyScore.findMany({
      where: { hospitalId, scoreDate: { gte: cutoff } },
      orderBy: { scoreDate: 'asc' },
      select: {
        scoreDate: true,
        overallScore: true,
        abhsScore: true,
        mentionCount: true,
        sovPercent: true,
      },
    });

    signals.push(...this.buildStanding(scores));

    if (scores.length >= 2) {
      signals.push(...this.detectAeoScoreDrop(scores));
      signals.push(...(await this.detectCitationLost(hospitalId, scores)));
    }

    signals.push(...(await this.detectCompetitorOvertake(hospitalId, scores)));
    signals.push(...(await this.detectNewCompetitors(hospitalId)));

    // since 필터 + 최신순 정렬
    const filtered = signals
      .filter((s) => !sinceDate || new Date(s.occurred_at) > sinceDate)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    return { service: 'signal', signals: filtered };
  }

  /**
   * 운영 조회: 이름 매칭 병원들의 최근 14일 크롤 커버리지.
   * 비식별 집계만 반환 (병원명·건수·마지막 크롤일). 전체 스캔 방지를 위해 q 2자 이상 필수.
   */
  async getCrawlCoverage(q?: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException({
        error: { code: 'QUERY_REQUIRED', message: 'q 파라미터(병원명 일부, 2자 이상)가 필요합니다' },
      });
    }
    const since = new Date(Date.now() - 14 * 86400_000);
    const hospitals = await this.prisma.hospital.findMany({
      where: { name: { contains: q.trim() } },
      select: { id: true, name: true, regionSigungu: true },
      take: 20,
    });

    const coverage = await Promise.all(
      hospitals.map(async (h) => {
        const [scores14d, lastScore, responses14d] = await Promise.all([
          this.prisma.dailyScore.count({ where: { hospitalId: h.id, scoreDate: { gte: since } } }),
          this.prisma.dailyScore.findFirst({
            where: { hospitalId: h.id },
            orderBy: { scoreDate: 'desc' },
            select: { scoreDate: true },
          }),
          this.prisma.aIResponse.count({ where: { hospitalId: h.id, responseDate: { gte: since } } }),
        ]);
        return {
          hospital_id: h.id,
          name: h.name,
          region: h.regionSigungu,
          daily_scores_14d: scores14d,
          ai_responses_14d: responses14d,
          last_score_date: lastScore ? dateKey(lastScore.scoreDate) : null,
        };
      }),
    );

    coverage.sort((a, b) => b.ai_responses_14d - a.ai_responses_14d);
    return { service: 'signal', coverage };
  }

  /**
   * 신호 0: AEO 현황 (info) — 이상 유무와 무관하게 최신 상태를 알린다.
   * 소비자(허브 카드 등)가 "신호 없음 = 데이터 없음"으로 오해하지 않게 하는 상시 신호.
   * 최근 7일 내 점수가 있을 때만 생성 (오래된 데이터로 현황 행세 금지).
   */
  private buildStanding(
    scores: Array<{
      scoreDate: Date;
      overallScore: number;
      abhsScore: number | null;
      mentionCount: number | null;
      sovPercent: number | null;
    }>,
  ): PsSignal[] {
    const latest = scores[scores.length - 1];
    if (!latest) return [];
    if (latest.scoreDate.getTime() < Date.now() - 7 * 86400_000) return [];

    const score = latest.abhsScore ?? latest.overallScore;
    const lastDate = dateKey(latest.scoreDate);
    const parts = [`${lastDate} 기준`];
    if (latest.mentionCount != null) parts.push(`AI 답변 언급 ${latest.mentionCount}회`);
    if (latest.sovPercent != null) parts.push(`점유율(SOV) ${Math.round(latest.sovPercent)}%`);

    return [
      {
        signal_id: `signal:${lastDate}:standing`,
        type: 'aeo_standing',
        severity: 'info',
        title: `AEO 종합 ${Math.round(score)}점`,
        summary: `${parts.join(' · ')}. AI 검색 노출이 정상 추적되고 있습니다.`,
        occurred_at: toKstIso(lastDate),
        data: {
          metric: 'aeo_score',
          series: scores.slice(-14).map((s) => ({
            date: dateKey(s.scoreDate),
            value: Math.round((s.abhsScore ?? s.overallScore) * 10) / 10,
          })),
        },
      },
    ];
  }

  /**
   * 신호 1: AEO 종합점수 하락
   * severity 기준:
   *  - critical: 최근 7일 평균이 직전 7일 평균 대비 -15%p 이상 하락
   *  - warn:     -8%p 이상 하락
   *  - (그 미만 하락은 노이즈로 보고 신호 생성 안 함)
   */
  private detectAeoScoreDrop(
    scores: Array<{ scoreDate: Date; overallScore: number; abhsScore: number | null }>,
  ): PsSignal[] {
    const today = new Date();
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 7);
    const d14 = new Date(today);
    d14.setDate(d14.getDate() - 14);

    const recent = scores.filter((s) => s.scoreDate >= d7);
    const prev = scores.filter((s) => s.scoreDate >= d14 && s.scoreDate < d7);
    if (recent.length < 3 || prev.length < 3) return []; // 표본 부족 — 신호 없음

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const pick = (s: { overallScore: number; abhsScore: number | null }) =>
      s.abhsScore ?? s.overallScore;

    const recentAvg = avg(recent.map(pick));
    const prevAvg = avg(prev.map(pick));
    const drop = prevAvg - recentAvg;

    if (drop < 8) return [];

    const severity: PsSignal['severity'] = drop >= 15 ? 'critical' : 'warn';
    const lastDate = dateKey(recent[recent.length - 1].scoreDate);

    return [
      {
        signal_id: `signal:${lastDate}:aeo-score-drop`,
        type: 'aeo_score_drop',
        severity,
        title: `AEO 종합점수 주간 평균 ${drop.toFixed(1)}점 하락`,
        summary: `직전 7일 평균 ${prevAvg.toFixed(1)}점 → 최근 7일 평균 ${recentAvg.toFixed(1)}점. AI 검색에서 병원 노출 강도가 약해지고 있습니다.`,
        occurred_at: toKstIso(lastDate),
        data: {
          metric: 'aeo_score_7d_avg',
          series: [...prev, ...recent].map((s) => ({
            date: dateKey(s.scoreDate),
            value: Math.round(pick(s) * 10) / 10,
          })),
        },
      },
    ];
  }

  /**
   * 신호 2: 경쟁 병원 순위 역전
   * severity 기준:
   *  - critical: 최근 점수 기준, 이전에 우리보다 낮던 경쟁사가 우리를 5점 이상 초과
   *  - warn:     역전 발생 (5점 미만 차이)
   */
  private async detectCompetitorOvertake(
    hospitalId: string,
    myScores: Array<{ scoreDate: Date; overallScore: number; abhsScore: number | null }>,
  ): Promise<PsSignal[]> {
    if (myScores.length === 0) return [];

    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        competitorName: true,
        competitorScores: {
          orderBy: { scoreDate: 'desc' },
          take: 14,
          select: { scoreDate: true, overallScore: true },
        },
      },
    });

    const myLatest = myScores[myScores.length - 1];
    const myLatestScore = myLatest.abhsScore ?? myLatest.overallScore;
    const myWeekAgo = myScores.find(
      (s) => dateKey(s.scoreDate) <= dateKey(new Date(Date.now() - 7 * 86400_000)),
    );
    const myPrevScore = myWeekAgo ? (myWeekAgo.abhsScore ?? myWeekAgo.overallScore) : myLatestScore;

    const out: PsSignal[] = [];
    for (const comp of competitors) {
      if (comp.competitorScores.length < 2) continue;
      const compLatest = comp.competitorScores[0];
      const compPrev = comp.competitorScores[comp.competitorScores.length - 1];

      // 역전 판정: 과거엔 우리가 위, 지금은 경쟁사가 위
      const wasBelow = compPrev.overallScore < myPrevScore;
      const nowAbove = compLatest.overallScore > myLatestScore;
      if (!(wasBelow && nowAbove)) continue;

      const gap = compLatest.overallScore - myLatestScore;
      const lastDate = dateKey(compLatest.scoreDate);
      out.push({
        signal_id: `signal:${lastDate}:overtake-${comp.id.slice(0, 8)}`,
        type: 'competitor_overtake',
        severity: gap >= 5 ? 'critical' : 'warn',
        title: `${comp.competitorName}에게 AEO 순위 역전`,
        summary: `${comp.competitorName}이(가) 우리 점수(${Math.round(myLatestScore)}점)를 넘어섰습니다(${compLatest.overallScore}점, +${gap.toFixed(0)}점). 1~2주 전에는 우리가 앞서 있었습니다.`,
        occurred_at: toKstIso(lastDate),
        data: {
          metric: 'competitor_score_vs_mine',
          competitor: comp.competitorName,
          series: comp.competitorScores
            .slice()
            .reverse()
            .map((s) => ({ date: dateKey(s.scoreDate), value: s.overallScore })),
          my_latest_score: Math.round(myLatestScore),
        },
      });
    }
    return out;
  }

  /**
   * 신호 3: 주요 질문에서 인용(언급) 상실
   * 판정: 이전 7일 구간에서 언급되던 프롬프트가 최근 7일 구간에서 전 플랫폼 미언급으로 전환
   * severity 기준:
   *  - critical: 상실 프롬프트 3개 이상
   *  - warn:     1~2개
   */
  private async detectCitationLost(
    hospitalId: string,
    _scores: Array<{ scoreDate: Date }>,
  ): Promise<PsSignal[]> {
    const d7 = new Date(Date.now() - 7 * 86400_000);
    const d14 = new Date(Date.now() - 14 * 86400_000);

    // 최근 14일 응답을 프롬프트별로 집계 (질문 원문은 스냅샷 우선)
    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, responseDate: { gte: d14 } },
      select: {
        promptId: true,
        archivedPromptText: true,
        prompt: { select: { promptText: true } },
        responseDate: true,
        isMentioned: true,
      },
    });
    if (responses.length === 0) return [];

    type Bucket = { text: string; prevMentioned: boolean; recentTotal: number; recentMentioned: number };
    const byPrompt = new Map<string, Bucket>();
    for (const r of responses) {
      const key = r.promptId || r.archivedPromptText || 'unknown';
      const text = r.prompt?.promptText || r.archivedPromptText || '(질문 삭제됨)';
      if (!byPrompt.has(key)) {
        byPrompt.set(key, { text, prevMentioned: false, recentTotal: 0, recentMentioned: 0 });
      }
      const b = byPrompt.get(key)!;
      if (r.responseDate < d7) {
        if (r.isMentioned) b.prevMentioned = true;
      } else {
        b.recentTotal += 1;
        if (r.isMentioned) b.recentMentioned += 1;
      }
    }

    // 이전 구간 언급 O + 최근 구간 응답 존재 + 최근 언급 0 → 상실
    const lost: string[] = [];
    for (const b of byPrompt.values()) {
      if (b.prevMentioned && b.recentTotal >= 2 && b.recentMentioned === 0) {
        lost.push(b.text);
      }
    }
    if (lost.length === 0) return [];

    const todayStr = dateKey(new Date());
    return [
      {
        signal_id: `signal:${todayStr}:citation-lost`,
        type: 'citation_lost',
        severity: lost.length >= 3 ? 'critical' : 'warn',
        title: `주요 질문 ${lost.length}건에서 언급 상실`,
        summary: `지난주까지 AI 답변에 나오던 질문에서 이번 주 언급이 사라졌습니다: ${lost
          .slice(0, 3)
          .map((t) => `"${t.length > 40 ? t.slice(0, 40) + '…' : t}"`)
          .join(', ')}${lost.length > 3 ? ` 외 ${lost.length - 3}건` : ''}`,
        occurred_at: toKstIso(todayStr),
        data: {
          metric: 'lost_prompt_count',
          lost_prompts: lost.slice(0, 10),
        },
      },
    ];
  }

  /**
   * 신호 4: 신규 경쟁자 진입
   * 판정: 최근 7일 내 자동 감지(isAutoDetected)로 등록된 경쟁사
   * severity: info (인지용 — 위협 판단은 순위 역전 신호가 담당)
   */
  private async detectNewCompetitors(hospitalId: string): Promise<PsSignal[]> {
    const d7 = new Date(Date.now() - 7 * 86400_000);
    const newComps = await this.prisma.competitor.findMany({
      where: { hospitalId, isAutoDetected: true, isActive: true, createdAt: { gte: d7 } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, competitorName: true, competitorRegion: true, createdAt: true },
    });

    return newComps.map((c) => {
      const dateStr = dateKey(c.createdAt);
      return {
        signal_id: `signal:${dateStr}:new-competitor-${c.id.slice(0, 8)}`,
        type: 'new_competitor',
        severity: 'info' as const,
        title: `신규 경쟁자 감지: ${c.competitorName}`,
        summary: `AI 답변에서 새로 관측된 경쟁 병원입니다${c.competitorRegion ? ` (${c.competitorRegion})` : ''}. 환자 질문에 대한 AI 추천 목록에 진입했습니다.`,
        occurred_at: toKstIsoExact(c.createdAt),
        data: {
          competitor: c.competitorName,
          region: c.competitorRegion || null,
        },
      };
    });
  }
}
