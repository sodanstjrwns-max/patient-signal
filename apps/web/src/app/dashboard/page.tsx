"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Building2,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { FirstCrawlBanner } from "@/components/dashboard/FirstCrawlBanner";
import { ScoreChart } from "@/components/dashboard/ScoreChart";
import { buildFindings } from "@/components/dashboard/DiagnosisBoard";
import OnboardingTutorial from "@/components/onboarding/OnboardingTutorial";
import { MetricValue, resolveState } from "@/components/ui/metric-value";
import {
  useHospital,
  useDashboard,
  useWeeklyScore,
  usePlatformScores,
  useABHS,
} from "@/hooks/useQueries";
import { competitorsApi, crawlerApi, queryTemplatesApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/hooks/useToast";

const PLATFORM_NAMES: Record<string, string> = {
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  GROK: "Grok",
  CLOVA_X: "CLOVA X",
};
const WORKFLOW = [
  { name: "병원 소개", detail: "Hub 정보 연결", href: "/dashboard/settings" },
  { name: "핵심 질문", detail: "맞춤 질문 설계", href: "/dashboard/prompts" },
  { name: "AI 답변", detail: "실제 원문 확인", href: "/dashboard/responses" },
  {
    name: "경쟁 순위",
    detail: "같은 답변에서 비교",
    href: "/dashboard/competitors",
  },
];
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export default function DashboardPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const queryClient = useQueryClient();
  const { data: hospital } = useHospital();
  const dashboardQuery = useDashboard();
  const { data: dashboard } = dashboardQuery;
  const { data: weekly } = useWeeklyScore();
  const platformQuery = usePlatformScores();
  const abhsQuery = useABHS();
  const { data: abhs } = abhsQuery;
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("patient-signal-tutorial-seen"))
      setShowTutorial(true);
  }, []);
  const finishTutorial = () => {
    localStorage.setItem("patient-signal-tutorial-seen", "true");
    setShowTutorial(false);
  };
  const rankQuery = useQuery({
    queryKey: ["competitor-answer-ranking", hospitalId],
    queryFn: () =>
      competitorsApi.getAnswerRanking(hospitalId!).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const coreQuery = useQuery({
    queryKey: ["core-questions", hospitalId],
    queryFn: () =>
      queryTemplatesApi.coreQuestions(hospitalId!).then((r) => r.data),
    enabled: !!hospitalId,
  });
  const { data: lastAnalysis } = useQuery({
    queryKey: ["lastAnalysis", hospitalId],
    queryFn: () => crawlerApi.getLastAnalysis(hospitalId!).then((r) => r.data),
    enabled: !!hospitalId,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
  const refresh = () => {
    queryClient.invalidateQueries();
  };
  const abhsState = resolveState({
    isLoading: abhsQuery.isLoading,
    isError: abhsQuery.isError,
    hasData: !!abhs && abhs.hasData !== false,
  });
  const abhsOk = abhsState === "ok";
  const sov = abhsOk ? number(abhs?.sovPercent) : null;
  const totalResponses = abhsOk ? number(abhs?.totalResponses) : null;
  const mentioned = abhsOk ? number(abhs?.mentionedCount) : null;
  const platforms: any[] = Array.isArray(platformQuery.data)
    ? platformQuery.data
    : [];
  const ranking = rankQuery.data;
  const rankingAvailable =
    !rankQuery.isError && !!ranking && ranking.totalResponses > 0;
  const rankLabel = rankQuery.isError
    ? "조회 실패"
    : ranking?.status === "NO_COMPETITORS"
      ? "비교 병원 등록 필요"
      : ranking?.status === "NO_MENTIONS"
        ? "등장한 병원 없음"
        : "측정 대기";
  const rows = rankingAvailable
    ? [ranking.myHospital, ...(ranking.competitors || [])]
        .filter(Boolean)
        .sort((a, b) => b.mentionCount - a.mentionCount)
    : [];
  const coreQuestions: any[] = coreQuery.data?.coreQuestions || [];
  const completedAt = lastAnalysis?.lastCrawl?.completedAt;
  const lastCrawlDate = completedAt ? new Date(completedAt) : null;
  const hasLastCrawl =
    lastCrawlDate && Number.isFinite(lastCrawlDate.getTime());
  const name = hospital?.name || user?.hospital?.name || "우리 병원";
  const findings = buildFindings({
    sovPercent: sov,
    mentionedCount: mentioned,
    totalResponses,
    depthDistribution: abhsOk ? (abhs?.depthDistribution ?? null) : null,
    intentScores: abhsOk ? (abhs?.intentScores ?? null) : null,
    platforms: platforms.map((p) => ({
      key: p.platform,
      name: PLATFORM_NAMES[p.platform] || p.platformName,
      mentionRate: p.mentionRate,
      mentionedCount: p.mentionedCount,
      totalQueries: p.totalQueries,
      collectionStatus: p.collectionStatus,
      staleDays: p.staleDays,
      zeroReason: p.zeroReason,
      competitorsPerResponse: p.competitorsPerResponse,
    })),
    negativeRate: dashboard?.sentiment?.negativeRate ?? null,
    topCompetitor: weekly?.topCompetitors?.[0] ?? null,
  });

  return (
    <div className="min-h-screen">
      <Header
        title="한눈에 보기"
        onRefresh={refresh}
        refreshing={dashboardQuery.isFetching || abhsQuery.isFetching}
      />
      {showTutorial && (
        <OnboardingTutorial
          onComplete={finishTutorial}
          onSkip={finishTutorial}
        />
      )}
      <FirstCrawlBanner hospitalId={hospitalId} />
      <div className="mx-auto max-w-[1600px] px-5 pb-12 pt-8 sm:px-8 xl:px-10 xl:pt-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="signal-eyebrow mb-3">Your AI presence</p>
            <h2 className="signal-display text-[34px] sm:text-[44px] xl:text-[50px]">
              우리 병원의
              <br className="sm:hidden" /> 다음 시그널
              <span className="text-[#36765a]">.</span>
            </h2>
            <p className="mt-3 text-xs text-[#778378] sm:text-sm">
              {name} · AI가 전하는 우리 병원의 현재를 읽어보세요.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#778378]">
            <Clock3 className="h-3.5 w-3.5" />
            {hasLastCrawl
              ? `최근 측정 ${lastCrawlDate.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "측정 현황은 수집 후 표시됩니다"}
          </div>
        </div>
        <nav
          aria-label="AI 노출 관리 흐름"
          className="mb-7 grid grid-cols-2 border-y border-[#d7dfcf] lg:grid-cols-4"
        >
          {WORKFLOW.map((item, i) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center gap-3 border-[#d7dfcf] px-2 py-4 transition-colors hover:bg-white sm:px-4 [&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l"
            >
              <span className="self-start pt-0.5 font-mono text-[10px] text-[#85917c]">
                0{i + 1}
              </span>
              <span className="flex-1">
                <strong className="block text-[13px] font-semibold">
                  {item.name}
                </strong>
                <span className="mt-1 block text-[10px] text-[#778378]">
                  {item.detail}
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#829076] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
        <div className="grid gap-5 xl:grid-cols-[1.28fr_1fr]">
          <section className="signal-panel flex flex-col p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="signal-eyebrow">01 / Visibility</p>
              <span className="rounded-full border border-[#dee4d9] px-2.5 py-1 text-[9px] text-[#778378]">
                AI 답변 기준
              </span>
            </div>
            <h3 className="mt-5 text-sm font-medium">
              AI가 우리 병원을 언급한 비율
            </h3>
            <div className="my-5 min-h-[102px] font-medium leading-none tracking-[-.075em] text-[#15231b] sm:min-h-[125px]">
              <MetricValue
                state={sov === null && abhsState === "ok" ? "empty" : abhsState}
                onRetry={() => abhsQuery.refetch()}
                emptyLabel="첫 측정을 기다리고 있어요"
              >
                <span className="text-[96px] tabular-nums sm:text-[120px]">
                  {sov?.toFixed(1)}
                </span>
                <span className="ml-1 text-[38px] text-[#8c997f] sm:text-[48px]">
                  %
                </span>
              </MetricValue>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-[#edf0e8]">
              <div
                className="h-full bg-[#36765a] transition-[width] duration-700"
                style={{ width: `${Math.max(0, Math.min(100, sov ?? 0))}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between gap-4 text-[10px] text-[#778378]">
              <span>
                {totalResponses !== null && mentioned !== null
                  ? `분석 답변 ${totalResponses.toLocaleString()}건 중 ${mentioned.toLocaleString()}건에서 등장`
                  : "측정 전에는 언급률을 계산하지 않습니다"}
              </span>
              <span>100%</span>
            </div>
            <div className="mt-7 grid grid-cols-3 border-t border-[#e5eadd] pt-5">
              {[
                {
                  label: "추적 질문",
                  value:
                    dashboardQuery.isError || !dashboard
                      ? "—"
                      : (dashboard.stats?.totalPrompts ?? "—"),
                  suffix: "개",
                },
                {
                  label: "브랜드 건강 점수",
                  value: abhsOk
                    ? (number(abhs?.abhsScore)?.toFixed(1) ?? "—")
                    : "—",
                  suffix: "/ 100",
                },
                {
                  label: "분석 AI 플랫폼",
                  value:
                    platformQuery.isError || platformQuery.isLoading
                      ? "—"
                      : platforms.filter(
                          (p) => p.hasData !== false && p.totalQueries > 0,
                        ).length,
                  suffix: "개",
                },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={i ? "border-l border-[#e5eadd] pl-4" : ""}
                >
                  <p className="text-[9px] text-[#778378] sm:text-[10px]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-medium tracking-[-.045em] sm:text-3xl">
                    {item.value}
                    <span className="ml-1 text-[10px] font-normal tracking-normal text-[#8b967f]">
                      {item.suffix}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col rounded-xl bg-[#13251d] p-6 text-white sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#a0b392]">
                02 / Competitive position
              </p>
              <Activity className="h-4 w-4 text-[#d8f36a]" />
            </div>
            <div className="mb-6 mt-5 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm text-[#c6d1bf]">
                  등록 경쟁 병원 사이에서
                </h3>
                <p className="mt-2 font-medium leading-none tracking-[-.075em]">
                  <span className="text-[82px] text-[#d8f36a] sm:text-[96px]">
                    {rankingAvailable && ranking.rank != null
                      ? ranking.rank
                      : "—"}
                  </span>
                  <span className="ml-2 text-xl tracking-[-.025em] text-[#a5b59a]">
                    {rankingAvailable && ranking.rank != null
                      ? `위 / ${ranking.totalClinics}곳`
                      : rankLabel}
                  </span>
                </p>
              </div>
              <Link
                href="/dashboard/competitors"
                aria-label="경쟁 순위 상세 보기"
                className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-[#d8f36a] hover:bg-white/10"
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="flex-1 space-y-4">
              {rows.slice(0, 3).map((row) => (
                <div key={row.id}>
                  <div className="mb-1.5 flex items-center gap-3 text-[11px]">
                    <span className="w-3 font-mono text-[#829878]">
                      {row.rank ?? "—"}
                    </span>
                    <span
                      className={`flex-1 ${row.id === hospitalId ? "text-[#d8f36a]" : "text-[#cad5c4]"}`}
                    >
                      {row.name}
                      {row.id === hospitalId && (
                        <span className="ml-1 text-[9px]">/ 우리 병원</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {row.mentionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="ml-6 h-1.5 bg-white/[.08]">
                    <div
                      className={`h-full ${row.id === hospitalId ? "bg-[#d8f36a]" : "bg-[#668164]"}`}
                      style={{ width: `${Math.min(100, row.mentionRate)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="py-3 text-xs leading-6 text-[#a2b498]">
                  {rankQuery.isError
                    ? "경쟁 순위를 불러오지 못했습니다."
                    : rankQuery.isLoading
                      ? "비교 데이터를 불러오는 중입니다."
                      : "경쟁 병원을 등록하면, 같은 AI 답변에서 등장 빈도를 비교합니다."}
                </p>
              )}
            </div>
            <p className="mt-6 border-t border-white/10 pt-4 text-[10px] leading-5 text-[#8fa382]">
              {rankingAvailable
                ? `공통 답변 ${ranking.totalResponses}건 · `
                : ""}
              {ranking?.status === "LOW_SAMPLE"
                ? "표본이 적어 순위가 쉽게 달라질 수 있습니다. "
                : ""}
              등록 병원 간 AI 등장률 순위입니다. 의료 품질이나 지역 전체 순위가
              아닙니다.
            </p>
          </section>
        </div>
        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="signal-eyebrow mb-2">Channel breakdown</p>
              <h3 className="text-xl font-semibold tracking-[-.04em]">
                어떤 AI에서 보이고 있나요?
              </h3>
            </div>
            <Link href="/dashboard/analytics" className="signal-link shrink-0">
              전체 분석
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#dee4d9] bg-white">
            <div className="grid grid-cols-[1fr_80px_78px] gap-3 border-b border-[#dee4d9] px-5 py-3 text-[9px] uppercase tracking-[.1em] text-[#8b967f] sm:grid-cols-[1fr_1.4fr_100px_100px] sm:px-6">
              <span>AI 플랫폼</span>
              <span className="hidden sm:block">언급률</span>
              <span className="text-right">언급 / 답변</span>
              <span className="text-right">수집 상태</span>
            </div>
            {platformQuery.isError ? (
              <div className="p-6 text-sm text-[#778378]">
                플랫폼 데이터를 불러오지 못했습니다.{" "}
                <button
                  onClick={() => platformQuery.refetch()}
                  className="underline"
                >
                  다시 시도
                </button>
              </div>
            ) : platforms.length ? (
              platforms.map((p, i) => {
                const measured = p.hasData !== false && p.totalQueries > 0;
                const rate = measured ? number(p.mentionRate) : null;
                const stalled = p.collectionStatus === "STALLED";
                return (
                  <Link
                    key={p.platform}
                    href={`/dashboard/responses?platform=${p.platform}`}
                    className="grid grid-cols-[1fr_80px_78px] items-center gap-3 border-b border-[#edf0e8] px-5 py-4 last:border-0 hover:bg-[#fafbf7] sm:grid-cols-[1fr_1.4fr_100px_100px] sm:px-6"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="hidden font-mono text-[10px] text-[#9ba68f] md:block">
                        0{i + 1}
                      </span>
                      <strong className="text-[13px] font-medium">
                        {PLATFORM_NAMES[p.platform] || p.platformName}
                      </strong>
                    </span>
                    <span className="hidden items-center gap-5 pr-5 sm:flex">
                      <span className="h-1.5 flex-1 bg-[#edf0e8]">
                        <span
                          className="block h-full bg-[#36765a]"
                          style={{ width: `${Math.min(100, rate ?? 0)}%` }}
                        />
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums">
                        {rate === null ? "—" : `${rate.toFixed(1)}%`}
                      </span>
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-[#778378]">
                      {measured
                        ? `${p.mentionedCount} / ${p.totalQueries}`
                        : "—"}
                    </span>
                    <span
                      className={`text-right text-[10px] ${stalled ? "text-[#a1643a]" : "text-[#778378]"}`}
                    >
                      {stalled
                        ? "수집 확인 중"
                        : measured
                          ? "측정됨"
                          : "측정 대기"}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="px-6 py-8 text-sm text-[#778378]">
                {platformQuery.isLoading
                  ? "플랫폼별 결과를 불러오고 있습니다."
                  : "첫 측정이 완료되면 플랫폼별 결과가 여기에 표시됩니다."}
              </div>
            )}
          </div>
        </section>
        <div className="mt-9 grid gap-7 xl:grid-cols-[1.28fr_1fr]">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="signal-eyebrow mb-2">Questions that matter</p>
                <h3 className="text-xl font-semibold tracking-[-.04em]">
                  우리 병원에 필요한 질문
                </h3>
              </div>
              <Link href="/dashboard/prompts" className="signal-link shrink-0">
                질문 관리
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="border-t border-[#d7dfcf]">
              {coreQuestions.slice(0, 3).map((q, i) => (
                <Link
                  key={q.query}
                  href={
                    q.alreadyTracked && q.promptId
                      ? `/dashboard/prompts?promptId=${q.promptId}`
                      : "/dashboard/prompts"
                  }
                  className="group flex gap-4 border-b border-[#d7dfcf] py-5"
                >
                  <span className="pt-1 font-mono text-[10px] text-[#8b967f]">
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-6">{q.query}</p>
                    <p className="mt-1 text-[10px] text-[#778378]">
                      {q.alreadyTracked ? "측정 중 · 답변 보기" : q.reason}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#7d8d70] group-hover:text-[#15231b]" />
                </Link>
              ))}
              {!coreQuestions.length && (
                <p className="py-7 text-sm leading-6 text-[#778378]">
                  {coreQuery.isError
                    ? "추천 질문을 불러오지 못했습니다."
                    : coreQuery.isLoading
                      ? "병원 정보를 바탕으로 질문을 불러오는 중입니다."
                      : "병원 소개와 주력 진료를 입력하면 핵심 질문을 추천합니다."}
                </p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-[#d7dfcf] bg-[#e9eddf] p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="signal-eyebrow">Your starting point</p>
              <Building2 className="h-4 w-4 text-[#718265]" />
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-[-.04em]">
              좋은 질문은
              <br />
              병원을 아는 데서 시작됩니다.
            </h3>
            <p className="mt-4 line-clamp-3 text-xs leading-6 text-[#69765e]">
              {hospital?.clinicIntroduction ||
                "Hub의 병원 정보를 불러오고, 우리 병원을 가장 잘 설명하는 소개를 완성하세요. 소개는 언제든 직접 수정할 수 있습니다."}
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-5 inline-flex items-center gap-2 border-b border-[#aab79b] pb-1 text-xs font-semibold"
            >
              병원 소개 편집
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
        {findings.length > 0 && (
          <section className="mt-9">
            <div className="mb-4">
              <p className="signal-eyebrow mb-2">Next moves</p>
              <h3 className="text-xl font-semibold tracking-[-.04em]">
                지금 살펴볼 변화
              </h3>
            </div>
            <div className="signal-panel divide-y divide-[#e5eadd]">
              {findings.slice(0, 3).map((f, i) => (
                <Link
                  key={f.id}
                  href={f.href}
                  className="flex items-start gap-4 p-5 transition-colors hover:bg-[#fafbf7] sm:p-6"
                >
                  <span className="mt-0.5 font-mono text-xs text-[#8b967f]">
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold">{f.headline}</h4>
                    <p className="mt-2 text-xs leading-6 text-[#778378]">
                      {f.cause}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-[#36765a]">
                      {f.cta}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#7d8d70]" />
                </Link>
              ))}
            </div>
          </section>
        )}
        {dashboard?.scoreHistory?.length > 0 && (
          <section className="mt-9">
            <ScoreChart
              data={dashboard.scoreHistory}
              title="가시성 점수의 흐름"
              subtitle="AI 언급률과 별개인 종합 가시성 점수의 변화입니다."
            />
          </section>
        )}
        <footer className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-[#d7dfcf] pt-5">
          <p className="text-[10px] text-[#8b967f]">
            PATIENT SIGNAL <span className="mx-2">/</span> 병원의 다음 선택을
            위한 데이터
          </p>
          <div className="flex items-center gap-5">
            <Link href="/dashboard/report" className="signal-link">
              리포트 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <CrawlControl
              hospitalId={hospitalId}
              isAdmin={user?.email === "sodanstjrwns@gmail.com"}
              onComplete={refresh}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}

function CrawlControl({
  hospitalId,
  isAdmin,
  onComplete,
}: {
  hospitalId?: string;
  isAdmin: boolean;
  onComplete: () => void;
}) {
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const clearPolling = () => {
    clearInterval(pollRef.current);
    clearTimeout(timeoutRef.current);
  };
  useEffect(() => () => clearPolling(), []);
  const mutation = useMutation({
    mutationFn: () => crawlerApi.trigger(hospitalId!),
    onSuccess: (res) => {
      toast.success("측정을 시작했습니다.");
      if (!res.data?.jobId) {
        onComplete();
        return;
      }
      setRunning(true);
      clearPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await crawlerApi.getJobStatus(res.data.jobId);
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            clearPolling();
            setRunning(false);
            if (data.status === "COMPLETED") {
              toast.success(`${data.completed || 0}개 답변을 수집했습니다.`);
              onComplete();
            } else toast.error("측정 중 오류가 발생했습니다.");
          }
        } catch {
          /* Next attempt may recover. */
        }
      }, 5000);
      timeoutRef.current = setTimeout(() => {
        clearPolling();
        setRunning(false);
        toast.info(
          "측정이 계속 진행 중일 수 있습니다. 잠시 후 새로고침해 주세요.",
        );
      }, 300000);
    },
    onError: (error: any) => {
      setRunning(false);
      toast.error(
        error.response?.data?.message || "측정을 시작하지 못했습니다.",
      );
    },
  });
  if (!isAdmin) return null;
  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={!hospitalId || mutation.isPending || running}
      className="signal-link disabled:opacity-50"
    >
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      {running ? "측정 중" : "지금 측정"}
    </button>
  );
}
