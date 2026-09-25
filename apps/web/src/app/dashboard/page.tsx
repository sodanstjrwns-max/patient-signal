"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { FirstCrawlBanner } from "@/components/dashboard/FirstCrawlBanner";
import { VisibilityHero } from "@/components/dashboard/VisibilityHero";
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
import { formatDecimal } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/SignalMotion";

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
    ? Math.round((count / responses) * 10000) / 100
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
          hasData: platformHasMeasurement && selectedPlatformRate !== null,
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
    <div className="min-h-screen bg-[#08090a] text-[#f5f5ef]">
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
      <div className="mx-auto max-w-[1560px] px-4 pb-10 pt-6 sm:px-7 lg:px-9">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="desk-label mb-2">우리 병원의 AI 가시성</p>
            <p className="font-display text-xl leading-[1.25] tracking-[-.035em] sm:text-2xl">
              {name}
            </p>
          </div>
          <p className="flex items-center gap-2 text-[11px] text-[#959c9f]">
            <Clock3 className="h-3.5 w-3.5" />
            {hasLastCrawl
              ? `최근 측정 ${lastCrawlDate.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
              : "첫 측정 대기"}
          </p>
        </div>

        <VisibilityHero
          history={dashboard?.scoreHistory}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          onRetry={() => dashboardQuery.refetch()}
        />

        <nav
          aria-label="AI 노출 관리 흐름"
          className="mb-5 grid grid-cols-2 border-y border-[#30343a] sm:grid-cols-4"
        >
          {WORKFLOW.map((item, i) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center gap-3 border-[#30343a] px-2 py-3 text-xs hover:bg-[#181b1e] sm:px-3 [&:nth-child(even)]:border-l sm:[&:not(:first-child)]:border-l"
            >
              <span className="font-numeric text-[10px] text-[#959c9f]">
                0{i + 1}
              </span>
              <span className="flex-1 font-semibold">{item.name}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </nav>

        <section
          aria-label="플랫폼별 AI 언급률"
          className="border border-[#30343a]"
        >
          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex min-w-0 flex-col border-t-2 border-[#ff6a24] bg-[#08090a] p-5 text-[#f5f5ef] sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-[#30343a] pb-4">
                <h2 className="font-display text-sm">우리 병원 언급률 <span className="ml-2 font-sans text-[10px] font-normal text-[#959c9f]">최근 30일</span></h2>
                <span className="border border-[#ff6a24]/50 px-2 py-1 text-[10px] font-semibold text-[#ff6a24]">
                  {selectedName}
                </span>
              </div>
              <div
                className="flex min-h-[100px] flex-1 items-center py-5 sm:min-h-[130px]"
                aria-live="polite"
                aria-atomic="true"
              >
                <MetricValue
                  dark
                  className="!rounded-none !text-[#f5f5ef]"
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
                  emptyLabel="아직 측정 결과가 없습니다"
                >
                  <span className="flex items-baseline font-numeric leading-none tracking-[-.065em] text-[#d9ff43]">
                    {selectedRate !== null && (
                      <AnimatedNumber
                        value={selectedRate}
                        decimals={2}
                        className="text-[64px] sm:text-[84px] xl:text-[96px]"
                      />
                    )}
                    <span className="ml-2 text-[32px] tracking-[-.04em] text-[#ff6a24] sm:text-[40px]">
                      %
                    </span>
                  </span>
                </MetricValue>
              </div>
              <div className="pt-4">
                <div aria-hidden="true" className="mb-4 h-px bg-[#30343a]">
                  <span
                    className="block h-px bg-[#ff6a24] transition-[width] duration-500 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min(100, Math.max(0, selectedRate ?? 0))}%`,
                    }}
                  />
                </div>
                <p
                  className="text-xs leading-6 text-[#959c9f] [&_strong]:font-numeric [&_strong]:text-[#f5f5ef]"
                  aria-live="polite"
                >
                  {selectedTotal !== null && selectedMentions !== null ? (
                    <>
                      답변 <strong>{selectedTotal.toLocaleString()}건</strong>{" "}
                      중 <strong>{selectedMentions.toLocaleString()}건</strong>
                      에 등장
                    </>
                  ) : (
                    "측정한 답변이 쌓이면 언급률을 표시합니다."
                  )}
                </p>
                {selectedPlatform !== "ALL" &&
                  selectedPlatformData?.collectionStatus === "STALLED" && (
                    <p className="mt-1 text-xs font-semibold">
                      이 플랫폼의 수집 상태를 확인 중입니다.
                    </p>
                  )}
                <Link
                  href={selectedResponseHref}
                  className="mt-4 flex items-center justify-between border border-[#ff6a24]/50 px-3 py-3 text-xs font-bold text-[#ff6a24] hover:bg-[#181b1e]"
                >
                  {selectedPlatform === "ALL" ? "전체" : selectedName} 답변 원문
                  보기 <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="min-w-0 border-t border-[#30343a] bg-[#111315] p-5 text-[#f5f5ef] sm:p-7 xl:border-l xl:border-t-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold">플랫폼을 선택해 비교</h3>
                <Link
                  href="/dashboard/analytics"
                  className="flex items-center gap-1 text-[10px] text-[#ff6a24] hover:underline"
                >
                  전체 분석 <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="mb-1 grid grid-cols-[88px_minmax(0,1fr)_46px] gap-3 border-b border-white/20 pb-2 text-[9px] text-[#959c9f] sm:grid-cols-[100px_minmax(0,1fr)_52px_76px]">
                <span>AI 플랫폼</span>
                <span>언급률</span>
                <span className="text-right">%</span>
                <span className="hidden text-right sm:block">언급 / 답변</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlatform("ALL")}
                aria-pressed={selectedPlatform === "ALL"}
                className={`grid w-full grid-cols-[88px_minmax(0,1fr)_46px] items-center gap-3 border-b border-white/15 py-3 text-left text-xs transition-colors sm:grid-cols-[100px_minmax(0,1fr)_52px_76px] ${selectedPlatform === "ALL" ? "text-[#ff6a24]" : "text-[#f5f5ef] hover:text-[#ff6a24]"}`}
              >
                <span className="font-semibold">
                  전체 AI{" "}
                  <span aria-hidden="true">
                    {selectedPlatform === "ALL" ? "↗" : ""}
                  </span>
                </span>
                <span className="h-2 bg-white/10">
                  <span
                    className="block h-full bg-current transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${Math.min(100, sov ?? 0)}%` }}
                  />
                </span>
                <span className="text-right font-numeric tabular-nums">
                  {sov === null ? "—" : formatDecimal(sov)}
                </span>
                <span className="hidden text-right font-numeric text-[10px] sm:block">
                  {mentioned === null || totalResponses === null
                    ? "—"
                    : `${mentioned}/${totalResponses}`}
                </span>
              </button>
              {platformQuery.isError ? (
                <p className="py-7 text-xs leading-6 text-[#959c9f]">
                  플랫폼 데이터를 불러오지 못했습니다.{" "}
                  <button
                    type="button"
                    onClick={() => platformQuery.refetch()}
                    className="text-[#ff6a24] underline"
                  >
                    다시 시도
                  </button>
                </p>
              ) : platforms.length ? (
                platforms.map((p) => {
                  const rate =
                    p.hasData !== false
                      ? mentionRate(p.mentionedCount, p.totalQueries)
                      : null;
                  const measured = rate !== null;
                  const selected = selectedPlatform === p.platform;
                  return (
                    <button
                      key={p.platform}
                      type="button"
                      onClick={() => setSelectedPlatform(p.platform)}
                      aria-pressed={selected}
                      aria-label={`${PLATFORM_NAMES[p.platform] || p.platformName}, ${measured ? `언급률 ${formatDecimal(rate)}%, ${p.totalQueries}건 중 ${p.mentionedCount}건` : "측정 대기"}${p.collectionStatus === "STALLED" ? ", 수집 확인 중" : ""}`}
                      className={`grid w-full grid-cols-[88px_minmax(0,1fr)_46px] items-center gap-3 border-b border-white/15 py-3 text-left text-xs transition-colors last:border-b-0 sm:grid-cols-[100px_minmax(0,1fr)_52px_76px] ${selected ? "text-[#ff6a24]" : "text-[#f5f5ef] hover:text-[#ff6a24]"}`}
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {PLATFORM_NAMES[p.platform] || p.platformName}{" "}
                          <span aria-hidden="true">{selected ? "↗" : ""}</span>
                        </span>
                        {p.collectionStatus === "STALLED" && (
                          <span className="mt-1 block text-[9px] text-[#ff9a7a]">
                            수집 확인 중
                          </span>
                        )}
                      </span>
                      <span className="h-2 bg-white/10">
                        <span
                          className={`block h-full transition-[width,background-color] duration-500 motion-reduce:transition-none ${selected ? "bg-[#ff6a24]" : "bg-[#646b70]"}`}
                          style={{ width: `${Math.min(100, rate ?? 0)}%` }}
                        />
                      </span>
                      <span className="text-right font-numeric tabular-nums">
                        {rate === null ? "—" : formatDecimal(rate)}
                      </span>
                      <span className="hidden text-right font-numeric text-[10px] sm:block">
                        {measured
                          ? `${p.mentionedCount}/${p.totalQueries}`
                          : "대기"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="py-7 text-xs leading-6 text-[#959c9f]">
                  {platformQuery.isLoading
                    ? "플랫폼별 결과를 불러오고 있습니다."
                    : "첫 측정 후 플랫폼별 결과를 표시합니다."}
                </p>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-[#30343a] border-t border-[#30343a] bg-[#111315]">
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
                suffix: "/100",
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
            ].map((item) => (
              <div
                key={item.label}
                className="px-3 py-4 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:px-5"
              >
                <dt className="text-[10px] text-[#959c9f]">{item.label}</dt>
                <dd className="mt-1 font-numeric text-[28px] leading-none tracking-tight sm:mt-0">
                  {item.value === null ? (
                    "—"
                  ) : (
                    <AnimatedNumber
                      value={item.value}
                      decimals={item.decimals}
                    />
                  )}
                  <span className="ml-1 text-[10px] font-normal text-[#959c9f]">
                    {item.suffix}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-7 border-y border-[#30343a]">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <h2 className="font-display text-base tracking-tight">
              등록 병원 순위{" "}
              <span className="ml-2 border border-[#ff6a24]/40 px-2 py-1 font-numeric text-sm text-[#ff6a24]">
                {rankingAvailable && ranking.rank != null
                  ? `${ranking.rank}위 / ${ranking.totalClinics}곳`
                  : rankLabel}
              </span>
            </h2>
            <Link
              href="/dashboard/competitors"
              className="flex items-center gap-2 text-[11px] font-semibold"
            >
              비교 병원 관리 <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-[30px_minmax(0,1fr)_65px_48px] gap-3 border-y border-[#30343a] py-2 text-[9px] text-[#959c9f] sm:grid-cols-[40px_minmax(0,1fr)_minmax(100px,.7fr)_74px_66px] sm:px-3">
            <span>순위</span>
            <span>병원</span>
            <span className="hidden sm:block">공통 답변의 언급률</span>
            <span className="text-right">언급률</span>
            <span className="text-right">건수</span>
          </div>
          <div className="max-h-[328px] overflow-y-auto">
            {rows.map((row) => (
              <Link
                href="/dashboard/competitors"
                key={row.id}
                className={`grid grid-cols-[30px_minmax(0,1fr)_65px_48px] items-center gap-3 border-b border-[#30343a] px-1 py-3 text-xs last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_minmax(100px,.7fr)_74px_66px] sm:px-3 ${row.id === hospitalId ? "border-l-2 border-l-[#ff6a24] bg-[#181b1e] font-semibold" : "border-l-2 border-l-transparent hover:bg-[#181b1e]"}`}
              >
                <span className="font-numeric text-base">
                  {row.rank ?? "—"}
                </span>
                <span className="min-w-0 break-words">
                  {row.name}
                  {row.id === hospitalId && (
                    <span className="ml-2 text-[9px] font-normal text-[#d9ff43]">
                      우리 병원
                    </span>
                  )}
                </span>
                <span className="hidden h-1.5 bg-[#30343a] sm:block">
                  <span
                    className="block h-full bg-[#ff6a24]"
                    style={{ width: `${Math.min(100, row.mentionRate)}%` }}
                  />
                </span>
                <span className="text-right font-numeric">
                  {row.mentionRate.toFixed(1)}%
                </span>
                <span className="text-right font-numeric">
                  {row.mentionCount}
                </span>
              </Link>
            ))}
            {!rows.length && (
              <p className="py-8 text-sm leading-6 text-[#959c9f]">
                {rankQuery.isError
                  ? "경쟁 순위를 불러오지 못했습니다."
                  : rankQuery.isLoading
                    ? "비교 데이터를 불러오는 중입니다."
                    : ranking?.status === "NO_COMPETITORS"
                      ? "경쟁 병원을 등록하면 같은 AI 답변에서 등장 빈도를 비교합니다."
                      : ranking?.status === "NO_MENTIONS"
                        ? `공통 답변 ${ranking.totalResponses}건에서 등록 병원이 모두 미언급되어 순위를 매기지 않습니다.`
                        : "등록 병원을 함께 비교할 수 있는 실측 답변을 기다리고 있습니다."}
              </p>
            )}
          </div>
          <p className="border-t border-[#30343a] py-3 text-[10px] leading-5 text-[#959c9f]">
            {rankingAvailable
              ? `공통 답변 ${ranking.totalResponses}건 기준. `
              : ""}
            {ranking?.status === "LOW_SAMPLE"
              ? "표본이 적어 순위가 쉽게 달라질 수 있습니다. "
              : ""}
            플랫폼 선택과 별개인 전체 공통 답변의 순위입니다. 동률은 공동
            순위이며 의료 품질이나 지역 전체 순위가 아닙니다.
          </p>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-base">핵심 질문</h2>
              <Link
                href="/dashboard/prompts"
                className="flex items-center gap-2 text-[11px] font-semibold"
              >
                질문 관리 <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="border-t border-[#30343a]">
              {coreQuestions.slice(0, 4).map((q, i) => (
                <Link
                  key={q.query}
                  href={
                    q.alreadyTracked && q.promptId
                      ? `/dashboard/prompts?promptId=${q.promptId}`
                      : "/dashboard/prompts"
                  }
                  className="group flex gap-3 border-b border-[#30343a] py-4 hover:bg-[#181b1e]"
                >
                  <span className="pt-1 font-numeric text-[10px] text-[#959c9f]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-6">
                      {q.query}
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-[#959c9f]">
                      {q.alreadyTracked ? "측정 중 · 답변 보기" : q.reason}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0" />
                </Link>
              ))}
              {!coreQuestions.length && (
                <p className="py-7 text-xs leading-6 text-[#959c9f]">
                  {coreQuery.isError
                    ? "추천 질문을 불러오지 못했습니다."
                    : coreQuery.isLoading
                      ? "병원 정보를 바탕으로 질문을 불러오는 중입니다."
                      : "병원 소개와 주력 진료를 입력하면 핵심 질문을 추천합니다."}
                </p>
              )}
            </div>
          </section>
          <section className="border border-[#30343a] bg-[#111315] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm">
                질문 추천에 쓰는 병원 소개
              </h2>
              <Building2 className="h-4 w-4" />
            </div>
            <p className="mt-4 line-clamp-5 text-xs leading-7 text-[#959c9f]">
              {hospital?.clinicIntroduction ||
                "Hub의 병원 정보를 가져와 소개를 채우세요. 우리 병원의 주력 진료와 강점을 바탕으로 질문을 추천합니다."}
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-5 flex items-center justify-between border-t border-[#30343a] pt-4 text-xs font-semibold"
            >
              Hub 연동 · 소개 편집 <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        </div>

        {findings.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 font-display text-base">확인할 변화</h2>
            <div className="border-y border-[#30343a]">
              {findings.slice(0, 3).map((f, i) => (
                <Link
                  key={f.id}
                  href={f.href}
                  className="grid gap-2 border-b border-[#30343a] py-4 last:border-b-0 hover:bg-[#181b1e] sm:grid-cols-[24px_minmax(0,.8fr)_minmax(0,1.2fr)_auto] sm:gap-4"
                >
                  <span className="hidden pt-1 font-numeric text-[10px] text-[#959c9f] sm:block">
                    0{i + 1}
                  </span>
                  <h3 className="text-xs font-semibold leading-6">
                    {f.headline}
                  </h3>
                  <p className="text-[11px] leading-6 text-[#959c9f]">
                    {f.cause}
                  </p>
                  <span className="flex items-center gap-2 text-[11px] font-semibold">
                    {f.cta}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#30343a] pt-4 text-[10px] text-[#959c9f]">
          <span>실제 수집된 AI 답변 기준</span>
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard/report"
              className="flex items-center gap-2 text-xs font-semibold text-[#f5f5ef]"
            >
              리포트 보기 <ArrowRight className="h-3.5 w-3.5" />
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
