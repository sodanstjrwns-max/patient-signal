"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { competitorsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useHospital, useCompetitorComparison } from "@/hooks/useQueries";
import { queryKeys } from "@/lib/queryKeys";
import {
  Plus,
  Trash2,
  Users,
  Sparkles,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Lock,
  X,
  BarChart3,
  RotateCcw,
  Archive,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/hooks/useToast";
import {
  UpgradeModal,
  getPlanLimits,
  canUseFeature,
} from "@/components/plan/PlanGate";

interface Suggestion {
  name: string;
  mentionCount: number;
  coMentionCount: number;
  soloMentionCount: number;
  avgPosition: number | null;
  platforms: string[];
  threatLevel: "HIGH" | "MEDIUM" | "LOW";
  threatScore: number;
  reason: string;
}

const THREAT_CONFIG = {
  HIGH: {
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "높은 위협",
  },
  MEDIUM: {
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    label: "주의 필요",
  },
  LOW: {
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
    label: "낮은 위협",
  },
};

const PLATFORM_LABELS: Record<string, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

export default function CompetitorsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  // 【캐싱 통합】공유 훅으로 planType 안정적 로딩
  const { data: hospitalData } = useHospital();

  const planType =
    hospitalData?.planType || (user as any)?.hospital?.planType || "FREE";
  const planLimits = getPlanLimits(planType);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [showInactive, setShowInactive] = useState(false);

  // 경쟁사 목록 조회 - 공유 queryKey 사용
  const { data: competitors, isLoading } = useQuery({
    queryKey: queryKeys.competitors.list(hospitalId!),
    queryFn: () => competitorsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 비활성(삭제된) 경쟁사 조회
  const {
    data: inactiveCompetitors,
    isLoading: inactiveLoading,
    isError: inactiveError,
  } = useQuery({
    queryKey: ["competitors-inactive", hospitalId],
    queryFn: () =>
      competitorsApi.getInactive(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showInactive,
    retry: 1,
  });

  // 경쟁사 비교 데이터 - 공유 훅 사용
  const { data: comparison } = useCompetitorComparison();

  const {
    data: answerRanking,
    isLoading: rankingLoading,
    isError: rankingError,
  } = useQuery({
    queryKey: ["competitor-answer-ranking", hospitalId],
    queryFn: () =>
      competitorsApi.getAnswerRanking(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // 경쟁사 추가
  const addMutation = useMutation({
    mutationFn: () =>
      competitorsApi.add(hospitalId!, {
        competitorName: newCompetitor,
        competitorRegion: newRegion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.list(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.comparison(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: ["competitor-answer-ranking", hospitalId],
      });
      setNewCompetitor("");
      setNewRegion("");
      toast.success("경쟁사가 추가되었습니다.");
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (
        errData?.error === "PLAN_LIMIT_REACHED" ||
        errData?.error === "PLAN_UPGRADE_REQUIRED"
      ) {
        setUpgradeFeature("maxCompetitors");
        setShowUpgradeModal(true);
      } else if (error.response?.status === 409) {
        // 중복 경쟁사
        toast.error(
          errData?.message || "이미 유사한 이름의 경쟁사가 등록되어 있습니다.",
        );
      } else {
        toast.error(errData?.message || "경쟁사 추가에 실패했습니다.");
      }
    },
  });

  // 경쟁사 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => competitorsApi.remove(id, hospitalId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.list(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.comparison(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: ["competitor-answer-ranking", hospitalId],
      });
      toast.success("경쟁사가 삭제되었습니다.");
    },
  });

  // 경쟁사 전체 복구
  const restoreAllMutation = useMutation({
    mutationFn: () => competitorsApi.restoreAll(hospitalId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.list(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.comparison(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: ["competitor-answer-ranking", hospitalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["competitors-inactive", hospitalId],
      });
      const count = res.data?.restored || 0;
      if (count > 0) {
        toast.success(`${count}개 경쟁 병원이 복구되었습니다.`);
      } else {
        toast.info(
          "복구할 병원이 없거나 현재 플랜의 등록 한도에 도달했습니다.",
        );
      }
      setShowInactive(false);
    },
    onError: () => {
      toast.error("경쟁사 복구에 실패했습니다.");
    },
  });

  // 개별 경쟁사 복구
  const restoreOneMutation = useMutation({
    mutationFn: (competitorId: string) =>
      competitorsApi.restoreOne(hospitalId!, competitorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.list(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.comparison(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: ["competitor-answer-ranking", hospitalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["competitors-inactive", hospitalId],
      });
      toast.success("경쟁사가 복구되었습니다!");
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === "PLAN_LIMIT_REACHED") {
        setUpgradeFeature("maxCompetitors");
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || "경쟁 병원을 복구하지 못했습니다.");
      }
    },
  });

  // AI 제안
  const suggestMutation = useMutation({
    mutationFn: () => competitorsApi.suggest(hospitalId!),
    onSuccess: () => {
      setShowSuggestions(true);
      toast.success("AI 분석이 완료되었습니다!");
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === "PLAN_UPGRADE_REQUIRED") {
        setUpgradeFeature("autoDetect");
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || "AI 제안 분석에 실패했습니다.");
      }
    },
  });

  // 제안 수락
  const acceptMutation = useMutation({
    mutationFn: (data: { competitorName: string }) =>
      competitorsApi.acceptSuggestion(hospitalId!, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.list(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.competitors.comparison(hospitalId!),
      });
      queryClient.invalidateQueries({
        queryKey: ["competitor-answer-ranking", hospitalId],
      });
      setDismissedSuggestions(
        (prev) => new Set(Array.from(prev).concat(variables.competitorName)),
      );
      toast.success(
        `${variables.competitorName}이(가) 경쟁사로 등록되었습니다!`,
      );
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === "PLAN_LIMIT_REACHED") {
        setUpgradeFeature("maxCompetitors");
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || "경쟁사 등록에 실패했습니다.");
      }
    },
  });

  const handleAddCompetitor = () => {
    if (!newCompetitor.trim()) return;
    if (
      planLimits.maxCompetitors !== -1 &&
      (competitors?.length || 0) >= planLimits.maxCompetitors
    ) {
      setUpgradeFeature("maxCompetitors");
      setShowUpgradeModal(true);
      return;
    }
    addMutation.mutate();
  };

  const filteredCompetitors = competitors?.filter((c: any) =>
    c.competitorName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getScoreTrend = (competitor: any) => {
    const compData = comparison?.competitors?.find(
      (c: any) => c.name === competitor.competitorName,
    );
    if (!compData) return null;

    const myScore = comparison?.myHospital?.score || 0;
    const diff = myScore - compData.score;

    if (diff > 5)
      return {
        icon: <TrendingUp className="h-4 w-4 text-green-500" />,
        text: "우위",
        color: "text-green-600",
      };
    if (diff < -5)
      return {
        icon: <TrendingDown className="h-4 w-4 text-red-500" />,
        text: "열세",
        color: "text-red-600",
      };
    return {
      icon: <Minus className="h-4 w-4 text-slate-400" />,
      text: "비슷",
      color: "text-slate-500",
    };
  };

  // 제안 결과에서 이미 등록/거절된 것 필터링
  const suggestions: Suggestion[] = (
    suggestMutation.data?.data?.suggestions || []
  ).filter((s: Suggestion) => !dismissedSuggestions.has(s.name));

  const analysisInfo = suggestMutation.data?.data?.analysisInfo;
  const rankingRows = answerRanking
    ? [
        { ...answerRanking.myHospital, mine: true },
        ...(answerRanking.competitors || []).map((item: any) => ({
          ...item,
          mine: false,
        })),
      ].sort(
        (a: any, b: any) =>
          (a.rank ?? 999) - (b.rank ?? 999) || b.mentionCount - a.mentionCount,
      )
    : [];

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header
          title="경쟁 병원"
          description="AI 답변에서 우리 병원의 위치를 확인하세요"
        />
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <Users className="mx-auto mb-5 h-10 w-10 text-[#36765A]" />
          <h2 className="text-2xl font-semibold tracking-tight">
            병원 등록부터 시작하세요
          </h2>
          <p className="mb-6 mt-3 text-sm text-[#778378]">
            우리 병원을 등록하면 경쟁 병원을 추가하고 비교할 수 있습니다.
          </p>
          <Button onClick={() => (window.location.href = "/onboarding")}>
            병원 등록하기 <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const hasRanking =
    answerRanking?.status === "READY" || answerRanking?.status === "LOW_SAMPLE";
  const rankingMessage =
    answerRanking?.status === "NO_COMPETITORS"
      ? "비교할 경쟁 병원을 먼저 추가하세요."
      : answerRanking?.pendingMeasurement
        ? "새 경쟁 병원 등록 후 첫 공통 측정을 기다리고 있습니다."
        : answerRanking?.status === "NO_MENTIONS"
          ? "비교 기간에 등록 병원들이 등장한 답변이 없습니다."
          : "공통 비교 기간의 AI 답변이 아직 없습니다.";

  return (
    <div className="min-h-screen text-[#15231B]">
      <Header
        title="경쟁 병원"
        description="같은 질문, 같은 답변에서 비교하는 우리 병원의 위치"
      />
      <div className="mx-auto max-w-[1480px] px-5 pb-12 pt-7 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[10px] font-bold tracking-[0.2em] text-[#778378]">
              COMPETITIVE LANDSCAPE
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-[38px]">
              AI 답변 속, 우리의 위치.
            </h1>
          </div>
          <a
            href="#add-competitor"
            className="inline-flex items-center gap-2 border-b border-[#15231B] pb-1.5 text-sm font-semibold"
          >
            비교 병원 추가 <Plus className="h-4 w-4" />
          </a>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-[24px] bg-[#13251D] text-white">
              <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:gap-8 sm:p-8">
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium text-[#B2C1B5]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D8F36A]" />{" "}
                    등록 병원 내 AI 등장 순위
                  </p>
                  {rankingLoading ? (
                    <Loader2 className="my-10 h-8 w-8 animate-spin text-[#D8F36A]" />
                  ) : rankingError ? (
                    <p className="py-8 text-lg text-[#D8E1DA]">
                      순위를 불러오지 못했습니다.
                    </p>
                  ) : (
                    <div className="mt-5 flex items-baseline gap-3">
                      <strong className="text-[92px] font-medium leading-none tracking-[-0.08em] text-[#D8F36A] sm:text-[120px]">
                        {hasRanking ? answerRanking.rank : "—"}
                      </strong>
                      <span className="text-xl font-light text-[#B2C1B5]">
                        {hasRanking
                          ? `/ ${answerRanking.totalClinics}위`
                          : "측정 대기"}
                      </span>
                    </div>
                  )}
                  <p className="mt-4 text-sm text-[#D8E1DA]">
                    {hasRanking
                      ? answerRanking.myHospital?.name ||
                        hospitalData?.name ||
                        "우리 병원"
                      : rankingMessage}
                  </p>
                  {answerRanking?.status === "LOW_SAMPLE" && (
                    <p className="mt-3 inline-flex rounded-full border border-[#D8F36A]/30 px-3 py-1 text-[11px] text-[#D8F36A]">
                      표본 {answerRanking.minRecommendedResponses}건 미만 · 임시
                      순위
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-5 border-t border-white/15 pt-5 sm:grid-cols-1 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                  <div>
                    <dt className="text-[11px] text-[#9AAD9E]">
                      우리 병원 등장률
                    </dt>
                    <dd className="mt-2 text-3xl font-medium tracking-tight">
                      {hasRanking
                        ? Number(
                            answerRanking.myHospital?.mentionRate || 0,
                          ).toFixed(1)
                        : "—"}
                      <span className="ml-1 text-sm text-[#9AAD9E]">%</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[#9AAD9E]">
                      공통 실측 답변
                    </dt>
                    <dd className="mt-2 text-3xl font-medium tracking-tight">
                      {answerRanking?.totalResponses ?? "—"}
                      <span className="ml-1 text-sm text-[#9AAD9E]">건</span>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 px-6 py-4 text-[11px] text-[#9AAD9E] sm:px-8">
                <span>
                  최대 최근 {answerRanking?.periodDays || 30}일 · 등록한 병원
                  안에서 비교
                </span>
                <span>동일한 실제 AI 답변 기준</span>
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#DEE4D9] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEE4D9] px-5 py-5 sm:px-7">
                <h2 className="text-lg font-semibold tracking-tight">
                  등장률 리더보드
                </h2>
                <span className="text-[11px] text-[#778378]">
                  병원명 등장 답변 / 전체 답변
                </span>
              </div>
              {hasRanking ? (
                <div>
                  {rankingRows.map((row: any, index: number) => (
                    <div
                      key={row.id || `${row.name}-${index}`}
                      className={`grid grid-cols-[28px_minmax(0,1fr)_64px] items-center gap-3 border-b border-[#E8ECE4] px-5 py-5 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_80px] sm:px-7 ${row.mine ? "bg-[#F3F8E9]" : ""}`}
                    >
                      <span
                        className={`text-xl font-medium tabular-nums ${row.mine ? "text-[#36765A]" : "text-[#A5AFA5]"}`}
                      >
                        {row.rank ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-semibold">
                            {row.name}
                          </span>
                          {row.mine && (
                            <span className="rounded-full bg-[#D8F36A] px-2 py-0.5 text-[9px] font-bold text-[#24341A]">
                              우리 병원
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#EDF0E9]">
                          <div
                            className={`h-full rounded-full ${row.mine ? "bg-[#36765A]" : "bg-[#B1BDAE]"}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, Number(row.mentionRate) || 0))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] text-[#778378]">
                          {row.mentionCount}건의 답변에 등장
                        </p>
                      </div>
                      <span className="text-right text-base font-semibold tabular-nums tracking-tight">
                        {Number(row.mentionRate || 0).toFixed(1)}
                        <span className="ml-0.5 text-[10px] font-normal text-[#778378]">
                          %
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-14 text-center">
                  <BarChart3 className="mx-auto mb-4 h-8 w-8 text-[#A5B59D]" />
                  <p className="text-sm font-medium">
                    {rankingLoading
                      ? "비교 데이터를 불러오고 있습니다"
                      : rankingError
                        ? "데이터를 다시 불러와 주세요"
                        : rankingMessage}
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-[#778378]">
                    모든 비교 병원이 포함된 동일한 답변이 쌓이면 순위가
                    표시됩니다.
                  </p>
                </div>
              )}
              <div className="border-t border-[#DEE4D9] bg-[#FAFBF8] px-5 py-4 text-[11px] leading-5 text-[#778378] sm:px-7">
                {answerRanking?.windowStart &&
                !Number.isNaN(new Date(answerRanking.windowStart).getTime())
                  ? `${new Date(answerRanking.windowStart).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 이후`
                  : "공통 비교 기간의"}{" "}
                동일한 실제 AI 답변을 분모로 사용합니다. 등록 병원 모두 비교할
                수 있는 시점부터 계산하며, 동률은 공동 순위입니다. 의료 수준이나
                진료 품질의 순위가 아닙니다.
              </div>
            </section>

            {showSuggestions && (suggestions.length > 0 || analysisInfo) && (
              <section className="rounded-[22px] border border-[#DEE4D9] bg-white p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-bold tracking-[0.15em] text-[#778378]">
                      DISCOVER
                    </p>
                    <h2 className="text-lg font-semibold">
                      함께 등장하는 병원
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="AI 제안 닫기"
                    onClick={() => setShowSuggestions(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {analysisInfo && (
                  <p className="mt-2 text-xs leading-6 text-[#778378]">
                    최근 {analysisInfo.periodDays}일 · AI 응답{" "}
                    {analysisInfo.totalResponsesAnalyzed}개 분석 · 우리 병원
                    언급률 {analysisInfo.myMentionRate}%
                  </p>
                )}
                {suggestions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#778378]">
                    현재 추가할 후보가 없습니다. 측정 데이터가 쌓이면 다시
                    확인해 주세요.
                  </p>
                ) : (
                  <div className="mt-5 divide-y divide-[#DEE4D9]">
                    {suggestions.map((suggestion) => {
                      const config = THREAT_CONFIG[suggestion.threatLevel];
                      return (
                        <div key={suggestion.name} className="py-5 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-semibold">
                              {suggestion.name}
                            </h3>
                            <span
                              className={`text-[10px] font-semibold ${config.color}`}
                            >
                              {config.label} · {suggestion.threatScore}점
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#667668]">
                            {suggestion.reason}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#778378]">
                            <span>총 {suggestion.mentionCount}회 언급</span>
                            {suggestion.soloMentionCount > 0 && (
                              <span>
                                우리 대신 {suggestion.soloMentionCount}회 추천
                              </span>
                            )}
                            {suggestion.coMentionCount > 0 && (
                              <span>
                                동시 비교 {suggestion.coMentionCount}회
                              </span>
                            )}
                            {suggestion.avgPosition && (
                              <span>평균 {suggestion.avgPosition}위</span>
                            )}
                            <span>
                              {suggestion.platforms
                                .map((p) => PLATFORM_LABELS[p] || p)
                                .join(", ")}
                            </span>
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDismissedSuggestions(
                                  (prev) =>
                                    new Set(
                                      Array.from(prev).concat(suggestion.name),
                                    ),
                                )
                              }
                            >
                              건너뛰기
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                acceptMutation.mutate({
                                  competitorName: suggestion.name,
                                })
                              }
                              disabled={acceptMutation.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" /> 비교에 추가
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {comparison && comparison.competitors?.length > 0 && (
              <details className="group overflow-hidden rounded-[22px] border border-[#DEE4D9] bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-5 sm:px-7">
                  <div>
                    <h2 className="text-base font-semibold">
                      AI 가시성 점수 비교
                    </h2>
                    <p className="mt-1 text-[11px] text-[#778378]">
                      복합 점수로 살펴보는 노출 상태 · ≈ AI 응답 기반 추정치
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 group-open:rotate-45" />
                </summary>
                <div className="space-y-5 border-t border-[#DEE4D9] px-5 py-6 sm:px-7">
                  {[
                    { ...comparison.myHospital, mine: true },
                    ...[...comparison.competitors].sort(
                      (a: any, b: any) => (b.score || 0) - (a.score || 0),
                    ),
                  ].map((comp: any, index: number) => (
                    <div key={index}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span
                          className={`min-w-0 truncate ${comp.mine ? "font-semibold text-[#36765A]" : "text-[#536354]"}`}
                        >
                          {comp.name || "우리 병원"}
                          {comp.mine && " · 우리 병원"}
                        </span>
                        <span className="shrink-0 font-semibold">
                          {!comp.mine && comp.score === 0
                            ? "데이터 없음"
                            : `${comp.score || 0}점`}
                          {comp.isEstimated && " ≈"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#EDF0E9]">
                        <div
                          className={`h-full rounded-full ${comp.mine ? "bg-[#36765A]" : "bg-[#B1BDAE]"}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, comp.score || 0))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <section
              id="add-competitor"
              className="scroll-mt-24 rounded-[22px] border border-[#DEE4D9] bg-white p-5"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold">비교 병원 관리</h2>
                <span className="text-xs tabular-nums text-[#778378]">
                  {competitors?.length || 0} /{" "}
                  {planLimits.maxCompetitors === -1
                    ? "무제한"
                    : planLimits.maxCompetitors}
                </span>
              </div>
              {planLimits.maxCompetitors !== -1 && (
                <div className="mb-5 h-1 overflow-hidden rounded-full bg-[#EDF0E9]">
                  <div
                    className="h-full bg-[#36765A]"
                    style={{
                      width: `${planLimits.maxCompetitors > 0 ? Math.min(100, ((competitors?.length || 0) / planLimits.maxCompetitors) * 100) : 0}%`,
                    }}
                  />
                </div>
              )}
              <div className="space-y-2.5">
                <Input
                  aria-label="경쟁 병원 이름"
                  placeholder="경쟁 병원 이름"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                />
                <Input
                  aria-label="경쟁 병원 지역"
                  placeholder="지역 (선택)"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                />
                <Button
                  className="w-full"
                  onClick={handleAddCompetitor}
                  disabled={addMutation.isPending || !newCompetitor.trim()}
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}{" "}
                  비교 병원 추가
                </Button>
              </div>
              <div className="mt-5 border-t border-[#DEE4D9] pt-4">
                <button
                  className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-[#36765A] disabled:opacity-50"
                  onClick={() => {
                    if (!canUseFeature(planType, "autoDetect")) {
                      setUpgradeFeature("autoDetect");
                      setShowUpgradeModal(true);
                      return;
                    }
                    suggestMutation.mutate();
                  }}
                  disabled={suggestMutation.isPending}
                >
                  <span className="flex items-center gap-2">
                    {suggestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}{" "}
                    AI에게 후보 받기
                  </span>
                  {!canUseFeature(planType, "autoDetect") ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>
                <p className="mt-2 text-[11px] leading-5 text-[#778378]">
                  측정된 AI 답변에 함께 등장한 병원을 찾아드립니다.
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-[22px] border border-[#DEE4D9] bg-white">
              <div className="p-5">
                <div className="mb-4 flex justify-between text-xs">
                  <span className="font-semibold">등록한 경쟁 병원</span>
                  <span className="text-[#778378]">
                    {filteredCompetitors?.length || 0}개
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#778378]" />
                  <Input
                    className="pl-9"
                    aria-label="등록한 경쟁 병원 검색"
                    placeholder="병원 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {isLoading ? (
                  <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-[#36765A]" />
                ) : !filteredCompetitors?.length ? (
                  <p className="px-5 pb-8 pt-2 text-sm text-[#778378]">
                    {searchTerm
                      ? "검색 결과가 없습니다."
                      : "등록한 경쟁 병원이 없습니다."}
                  </p>
                ) : (
                  filteredCompetitors.map((competitor: any) => {
                    const trend = getScoreTrend(competitor);
                    const compScore = comparison?.competitors?.find(
                      (c: any) => c.name === competitor.competitorName,
                    )?.score;
                    return (
                      <div
                        key={competitor.id}
                        className="border-t border-[#E8ECE4] px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-semibold">
                              {competitor.competitorName}
                            </h3>
                            {competitor.competitorRegion && (
                              <p className="mt-1 text-[11px] text-[#778378]">
                                {competitor.competitorRegion}
                              </p>
                            )}
                          </div>
                          <button
                            aria-label={`${competitor.competitorName} 삭제`}
                            className="shrink-0 rounded-lg p-1.5 text-[#99A596] hover:bg-[#F5F6F0] hover:text-red-600"
                            onClick={() => {
                              if (confirm("이 경쟁사를 삭제하시겠습니까?"))
                                deleteMutation.mutate(competitor.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#778378]">
                          <span
                            className={
                              competitor.isActive ? "text-[#36765A]" : ""
                            }
                          >
                            {competitor.isActive ? "활성" : "비활성"}
                          </span>
                          {competitor.isAutoDetected && <span>AI 제안</span>}
                          {compScore !== undefined && (
                            <span className="ml-auto">
                              가시성 {compScore}점 {trend && `· ${trend.text}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <button
                className="flex w-full items-center justify-between border-t border-[#DEE4D9] bg-[#FAFBF8] px-5 py-4 text-xs text-[#667668]"
                onClick={() => setShowInactive(!showInactive)}
              >
                <span className="flex items-center gap-2">
                  <Archive className="h-3.5 w-3.5" /> 삭제된 병원 복구
                </span>
                <span>{showInactive ? "닫기" : "열기"}</span>
              </button>
            </section>
            {showInactive && (
              <section className="rounded-[22px] border border-[#DEE4D9] bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">삭제된 병원</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreAllMutation.mutate()}
                    disabled={
                      restoreAllMutation.isPending ||
                      (!inactiveError && !inactiveCompetitors?.length)
                    }
                  >
                    <RotateCcw className="h-3 w-3" /> 전체 복구
                  </Button>
                </div>
                {inactiveLoading ? (
                  <Loader2 className="mx-auto my-5 h-5 w-5 animate-spin" />
                ) : inactiveError ? (
                  <p className="text-xs leading-6 text-[#778378]">
                    목록을 불러오지 못했습니다. 전체 복구 버튼으로 복구를 시도할
                    수 있습니다.
                  </p>
                ) : !inactiveCompetitors?.length ? (
                  <p className="text-xs text-[#778378]">
                    복구할 병원이 없습니다.
                  </p>
                ) : (
                  <div className="divide-y divide-[#DEE4D9]">
                    {inactiveCompetitors.map((comp: any) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between gap-2 py-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium">
                            {comp.competitorName}
                          </p>
                          {comp.competitorRegion && (
                            <p className="mt-1 text-[10px] text-[#778378]">
                              {comp.competitorRegion}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => restoreOneMutation.mutate(comp.id)}
                          disabled={restoreOneMutation.isPending}
                        >
                          복구
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        currentPlan={planType}
      />
    </div>
  );
}
