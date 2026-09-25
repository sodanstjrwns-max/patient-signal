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
import {
  AnimatedNumber,
  Reveal,
  SignalSurface,
} from "@/components/motion/SignalMotion";

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
const mentionRate = (mentioned: unknown, total: unknown) => {
  const count = number(mentioned);
  const responses = number(total);
  return count !== null && responses !== null && responses > 0
    ? Math.round((count / responses) * 1000) / 10
    : null;
};

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
  const [selectedPlatform, setSelectedPlatform] = useState("ALL");
  useEffect(() => {
    setSelectedPlatform("ALL");
  }, [hospitalId]);
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
  const selectedPlatformData = platforms.find(
    (platform) => platform.platform === selectedPlatform,
  );
  const platformHasMeasurement =
    selectedPlatformData?.hasData !== false &&
    (number(selectedPlatformData?.totalQueries) ?? 0) > 0;
  const selectedPlatformRate = mentionRate(
    selectedPlatformData?.mentionedCount,
    selectedPlatformData?.totalQueries,
  );
  const selectedMetricState =
    selectedPlatform === "ALL"
      ? abhsState
      : resolveState({
          isLoading: platformQuery.isLoading,
          isError: platformQuery.isError,
          hasData:
            platformHasMeasurement &&
            selectedPlatformRate !== null,
        });
  const selectedRate =
    selectedPlatform === "ALL"
      ? sov
      : selectedMetricState === "ok"
        ? selectedPlatformRate
        : null;
  const selectedTotal =
    selectedPlatform === "ALL"
      ? totalResponses
      : selectedMetricState === "ok"
        ? number(selectedPlatformData?.totalQueries)
        : null;
  const selectedMentions =
    selectedPlatform === "ALL"
      ? mentioned
      : selectedMetricState === "ok"
        ? number(selectedPlatformData?.mentionedCount)
        : null;
  const selectedName =
    selectedPlatform === "ALL"
      ? "전체 AI"
      : PLATFORM_NAMES[selectedPlatform] ||
        selectedPlatformData?.platformName ||
        selectedPlatform;
  const selectedResponseHref =
    selectedPlatform === "ALL"
      ? "/dashboard/responses"
      : `/dashboard/responses?platform=${encodeURIComponent(selectedPlatform)}`;
  const ranking = rankQuery.data;
  const rankingAvailable =
    !rankQuery.isError &&
    !!ranking &&
    (ranking.status === "READY" || ranking.status === "LOW_SAMPLE");
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
        <Reveal className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#5b4dff]">
              LIVE SIGNAL / YOUR CLINIC
            </p>
            <h2 className="text-[36px] font-semibold leading-[1.04] tracking-[-.065em] sm:text-[48px] xl:text-[56px]">
              AI 속 우리 병원,
              <br className="sm:hidden" /> 지금 어디에
              <span className="text-[#ff6b3d]">.</span>
            </h2>
            <p className="mt-4 text-xs text-[#737382] sm:text-sm">
              {name} · 플랫폼을 골라 실제 답변 속 존재감을 확인하세요.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-[#dedee8] bg-white px-3 py-2 text-[10px] text-[#737382] sm:self-auto">
            <Clock3 className="h-3.5 w-3.5" />
            {hasLastCrawl
              ? `최근 측정 ${lastCrawlDate.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "첫 측정 대기"}
          </div>
        </Reveal>
        <nav
          aria-label="AI 노출 관리 흐름"
          className="mb-7 grid grid-cols-2 border-y border-[#d9d8e6] lg:grid-cols-4"
        >
          {WORKFLOW.map((item, i) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center gap-3 border-[#d9d8e6] px-2 py-4 transition-colors hover:bg-white sm:px-4 [&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l"
            >
              <span className="self-start pt-0.5 font-mono text-[10px] text-[#777489]">
                0{i + 1}
              </span>
              <span className="flex-1">
                <strong className="block text-[13px] font-semibold">
                  {item.name}
                </strong>
                <span className="mt-1 block text-[10px] text-[#737382]">
                  {item.detail}
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#777489] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <SignalSurface className="relative overflow-hidden rounded-[26px] bg-[#101016] p-6 text-white sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-[#5b4dff]/20"
            />
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#b9b8c9]">
                  01 / AI VISIBILITY
                </p>
                <span className="flex items-center gap-1.5 text-[9px] text-[#b9b8c9]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b3d]" />
                  실제 수집 답변
                </span>
              </div>
              <div
                role="group"
                aria-label="언급률을 볼 AI 플랫폼 선택"
                className="flex flex-wrap gap-1.5"
              >
                {[{ platform: "ALL", platformName: "전체" }, ...platforms].map(
                  (platform) => (
                    <button
                      key={platform.platform}
                      type="button"
                      onClick={() => setSelectedPlatform(platform.platform)}
                      aria-pressed={selectedPlatform === platform.platform}
                      className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5 motion-reduce:transform-none ${selectedPlatform === platform.platform ? "border-[#ff6b3d] bg-[#ff6b3d] text-[#101016] shadow-[0_0_26px_#ff6b3d26]" : "border-white/15 bg-white/[.03] text-[#b9b8c9] hover:border-white/40 hover:text-white"}`}
                    >
                      {platform.platform === "ALL"
                        ? "전체"
                        : PLATFORM_NAMES[platform.platform] ||
                          platform.platformName ||
                          platform.platform}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-7 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-[#d9d8e6]">
                  {selectedName}의 우리 병원 언급률
                </h3>
                {selectedPlatform !== "ALL" &&
                  selectedPlatformData?.collectionStatus === "STALLED" && (
                    <span className="text-[10px] text-[#ffab8d]">
                      수집 상태 확인 중
                    </span>
                  )}
              </div>
              <div
                className="my-5 flex min-h-[106px] items-baseline font-medium leading-none tracking-[-.075em] sm:min-h-[130px]"
                aria-live="polite"
                aria-atomic="true"
              >
                <MetricValue
                  dark
                  state={
                    selectedRate === null && selectedMetricState === "ok"
                      ? "empty"
                      : selectedMetricState
                  }
                  onRetry={() =>
                    selectedPlatform === "ALL"
                      ? abhsQuery.refetch()
                      : platformQuery.refetch()
                  }
                  emptyLabel="아직 이 플랫폼의 측정 결과가 없습니다"
                >
                  {selectedRate !== null && (
                    <AnimatedNumber
                      value={selectedRate}
                      decimals={1}
                      className="text-[88px] tabular-nums text-[#ff6b3d] sm:text-[114px]"
                    />
                  )}
                  <span className="ml-1 text-[34px] text-[#777489] sm:text-[46px]">
                    %
                  </span>
                </MetricValue>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#ff6b3d] shadow-[0_0_16px_#ff6b3d55] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(0, Math.min(100, selectedRate ?? 0))}%`,
                  }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p
                  className="text-[11px] leading-6 text-[#a5a3ba]"
                  aria-live="polite"
                >
                  {selectedTotal !== null && selectedMentions !== null ? (
                    <>
                      답변{" "}
                      <strong className="font-semibold text-white">
                        {selectedTotal.toLocaleString()}건
                      </strong>{" "}
                      중{" "}
                      <strong className="font-semibold text-[#ff9a7a]">
                        {selectedMentions.toLocaleString()}건
                      </strong>
                      에서 등장
                    </>
                  ) : (
                    "측정 결과가 있어야 언급률을 계산할 수 있습니다."
                  )}
                </p>
                <Link
                  href={selectedResponseHref}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white hover:text-[#ff6b3d]"
                >
                  {selectedPlatform === "ALL" ? "전체" : "선택한 AI"} 답변 보기
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-7 grid grid-cols-3 border-t border-white/15 pt-5">
                {[
                  {
                    label: "추적 질문",
                    value:
                      dashboardQuery.isError || !dashboard
                        ? null
                        : number(dashboard.stats?.totalPrompts),
                    suffix: "개",
                    decimals: 0,
                  },
                  {
                    label: "브랜드 건강 점수",
                    value: abhsOk ? number(abhs?.abhsScore) : null,
                    suffix: "/ 100",
                    decimals: 1,
                  },
                  {
                    label: "측정된 플랫폼",
                    value:
                      platformQuery.isError || platformQuery.isLoading
                        ? null
                        : platforms.filter(
                            (p) => p.hasData !== false && p.totalQueries > 0,
                          ).length,
                    suffix: "개",
                    decimals: 0,
                  },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className={i ? "border-l border-white/15 pl-4" : ""}
                  >
                    <p className="text-[9px] text-[#9997ad] sm:text-[10px]">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-medium tracking-[-.045em] text-white sm:text-3xl">
                      {item.value === null ? (
                        "—"
                      ) : (
                        <AnimatedNumber
                          value={item.value}
                          decimals={item.decimals}
                        />
                      )}
                      <span className="ml-1 text-[9px] font-normal tracking-normal text-[#9997ad]">
                        {item.suffix}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SignalSurface>
          <SignalSurface className="flex flex-col rounded-[26px] bg-[#5b4dff] p-6 text-white sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-white/55">
                02 / Competitive position
              </p>
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="mb-6 mt-5 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm text-white/85">
                  등록 경쟁 병원 사이에서
                </h3>
                <p className="mt-2 font-medium leading-none tracking-[-.075em]">
                  <span className="text-[82px] text-white sm:text-[96px]">
                    {rankingAvailable && ranking.rank != null ? (
                      <AnimatedNumber value={ranking.rank} />
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="ml-2 text-xl tracking-[-.025em] text-white/55">
                    {rankingAvailable && ranking.rank != null
                      ? `위 / ${ranking.totalClinics}곳`
                      : rankLabel}
                  </span>
                </p>
              </div>
              <Link
                href="/dashboard/competitors"
                aria-label="경쟁 순위 상세 보기"
                className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="flex-1 space-y-4">
              {rows.slice(0, 3).map((row) => (
                <div key={row.id}>
                  <div className="mb-1.5 flex items-center gap-3 text-[11px]">
                    <span className="w-3 font-mono text-white/55">
                      {row.rank ?? "—"}
                    </span>
                    <span
                      className={`flex-1 ${row.id === hospitalId ? "text-white" : "text-white/85"}`}
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
                      className={`h-full ${row.id === hospitalId ? "bg-[#ff9a7a]" : "bg-white/35"}`}
                      style={{ width: `${Math.min(100, row.mentionRate)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="py-3 text-xs leading-6 text-white/55">
                  {rankQuery.isError
                    ? "경쟁 순위를 불러오지 못했습니다."
                    : rankQuery.isLoading
                      ? "비교 데이터를 불러오는 중입니다."
                      : ranking?.status === "NO_COMPETITORS"
                        ? "경쟁 병원을 등록하면, 같은 AI 답변에서 등장 빈도를 비교합니다."
                        : ranking?.status === "NO_MENTIONS"
                          ? `공통 답변 ${ranking.totalResponses}건에서 등록 병원이 모두 미언급되어 순위를 매기지 않습니다.`
                        : "등록 병원을 함께 비교할 수 있는 실측 답변이 쌓이면 순위를 표시합니다."}
                </p>
              )}
            </div>
            <p className="mt-6 border-t border-white/10 pt-4 text-[10px] leading-5 text-white/55">
              {rankingAvailable
                ? `공통 답변 ${ranking.totalResponses}건 · `
                : ""}
              {ranking?.status === "LOW_SAMPLE"
                ? "표본이 적어 순위가 쉽게 달라질 수 있습니다. "
                : ""}
              플랫폼 선택과 별개인 전체 공통 답변의 순위입니다. 동률은 공동
              순위이며 의료 품질이나 지역 전체 순위가 아닙니다.
            </p>
          </SignalSurface>
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
          <div className="overflow-hidden rounded-xl border border-[#dedee8] bg-white">
            <div className="grid grid-cols-[1fr_80px_78px] gap-3 border-b border-[#dedee8] px-5 py-3 text-[9px] uppercase tracking-[.1em] text-[#9997ad] sm:grid-cols-[1fr_1.4fr_100px_100px] sm:px-6">
              <span>AI 플랫폼</span>
              <span className="hidden sm:block">언급률</span>
              <span className="text-right">언급 / 답변</span>
              <span className="text-right">수집 상태</span>
            </div>
            {platformQuery.isError ? (
              <div className="p-6 text-sm text-[#737382]">
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
                const rate = p.hasData !== false
                  ? mentionRate(p.mentionedCount, p.totalQueries)
                  : null;
                const measured = rate !== null;
                const stalled = p.collectionStatus === "STALLED";
                return (
                  <Link
                    key={p.platform}
                    href={`/dashboard/responses?platform=${p.platform}`}
                    className={`grid grid-cols-[1fr_80px_78px] items-center gap-3 border-b border-[#ededf6] px-5 py-4 transition-colors last:border-0 hover:bg-[#fafafe] sm:grid-cols-[1fr_1.4fr_100px_100px] sm:px-6 ${selectedPlatform === p.platform ? "bg-[#5b4dff]/[.05]" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="hidden font-mono text-[10px] text-[#9997ad] md:block">
                        0{i + 1}
                      </span>
                      <strong className="text-[13px] font-medium">
                        {PLATFORM_NAMES[p.platform] || p.platformName}
                      </strong>
                    </span>
                    <span className="hidden items-center gap-5 pr-5 sm:flex">
                      <span className="h-1.5 flex-1 bg-[#ededf6]">
                        <span
                          className="block h-full bg-[#5b4dff] transition-[width] duration-700 motion-reduce:transition-none"
                          style={{ width: `${Math.min(100, rate ?? 0)}%` }}
                        />
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums">
                        {rate === null ? "—" : `${rate.toFixed(1)}%`}
                      </span>
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-[#737382]">
                      {measured
                        ? `${p.mentionedCount} / ${p.totalQueries}`
                        : "—"}
                    </span>
                    <span
                      className={`text-right text-[10px] ${stalled ? "text-[#a1643a]" : "text-[#737382]"}`}
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
              <div className="px-6 py-8 text-sm text-[#737382]">
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
            <div className="border-t border-[#d9d8e6]">
              {coreQuestions.slice(0, 3).map((q, i) => (
                <Link
                  key={q.query}
                  href={
                    q.alreadyTracked && q.promptId
                      ? `/dashboard/prompts?promptId=${q.promptId}`
                      : "/dashboard/prompts"
                  }
                  className="group flex gap-4 border-b border-[#d9d8e6] py-5"
                >
                  <span className="pt-1 font-mono text-[10px] text-[#9997ad]">
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-6">{q.query}</p>
                    <p className="mt-1 text-[10px] text-[#737382]">
                      {q.alreadyTracked ? "측정 중 · 답변 보기" : q.reason}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#777489] group-hover:text-[#111118]" />
                </Link>
              ))}
              {!coreQuestions.length && (
                <p className="py-7 text-sm leading-6 text-[#737382]">
                  {coreQuery.isError
                    ? "추천 질문을 불러오지 못했습니다."
                    : coreQuery.isLoading
                      ? "병원 정보를 바탕으로 질문을 불러오는 중입니다."
                      : "병원 소개와 주력 진료를 입력하면 핵심 질문을 추천합니다."}
                </p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-[#d9d8e6] bg-[#eeedff] p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="signal-eyebrow">Your starting point</p>
              <Building2 className="h-4 w-4 text-[#777489]" />
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-[-.04em]">
              좋은 질문은
              <br />
              병원을 아는 데서 시작됩니다.
            </h3>
            <p className="mt-4 line-clamp-3 text-xs leading-6 text-[#777489]">
              {hospital?.clinicIntroduction ||
                "Hub의 병원 정보를 불러오고, 우리 병원을 가장 잘 설명하는 소개를 완성하세요. 소개는 언제든 직접 수정할 수 있습니다."}
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-5 inline-flex items-center gap-2 border-b border-[#9997ad] pb-1 text-xs font-semibold"
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
            <div className="signal-panel divide-y divide-[#ededf6]">
              {findings.slice(0, 3).map((f, i) => (
                <Link
                  key={f.id}
                  href={f.href}
                  className="flex items-start gap-4 p-5 transition-colors hover:bg-[#fafafe] sm:p-6"
                >
                  <span className="mt-0.5 font-mono text-xs text-[#9997ad]">
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold">{f.headline}</h4>
                    <p className="mt-2 text-xs leading-6 text-[#737382]">
                      {f.cause}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-[#5b4dff]">
                      {f.cta}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#777489]" />
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
        <footer className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-[#d9d8e6] pt-5">
          <p className="text-[10px] text-[#9997ad]">
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
