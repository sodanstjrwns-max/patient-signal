"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/motion/SignalMotion";
import { TermTip } from "@/components/ui/term-tooltip";
import { api, crawlerApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

const platformNames: Record<string, string> = {
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  GROK: "Grok",
  CLOVA_X: "CLOVA X",
};
const platforms = Object.keys(platformNames);
const PAGE_SIZE = 50;
type MentionFilter = "all" | "mentioned" | "not_mentioned";

interface AIResponse {
  id: string;
  aiPlatform: string;
  aiModelVersion?: string;
  responseText?: string;
  responseTextFull?: boolean;
  responseDate?: string;
  createdAt?: string;
  isMentioned: boolean;
  mentionPosition?: number;
  totalRecommendations?: number;
  sentimentLabel?: string | null;
  measuredQuestion?: string | null;
  questionSnapshotAvailable?: boolean;
  competitorsMentioned?: string[];
  citedSources?: unknown[];
  isWebSearch?: boolean;
  recommendationDepth?: string;
  prompt?: { id?: string; promptText?: string; specialtyCategory?: string };
}
interface ResponsePage {
  data: AIResponse[];
  total: number;
  hasMore: boolean;
}

function formatDate(dateString?: string, includeTime = false) {
  if (!dateString || Number.isNaN(new Date(dateString).getTime()))
    return "측정 시각 미확인";
  return new Date(dateString).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  });
}
function measurementDay(response: AIResponse) {
  const value = response.responseDate || response.createdAt;
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
function responseQuestion(response?: AIResponse | null) {
  return response?.measuredQuestion || response?.prompt?.promptText || "";
}
function questionLabel(response?: AIResponse | null) {
  return response?.questionSnapshotAvailable
    ? "측정 당시 질문"
    : "현재 질문 · 측정 당시 문장 미보관";
}
function sentimentText(label?: string | null) {
  if (label === "POSITIVE") return "긍정 표현";
  if (label === "NEGATIVE") return "부정 표현";
  if (label === "NEUTRAL") return "중립 표현";
  return "감성 미분석";
}
function sourceLink(source: unknown): { url: string; title: string } | null {
  const raw =
    typeof source === "string"
      ? source
      : source && typeof source === "object"
        ? (source as { url?: unknown }).url
        : null;
  if (typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    const title =
      typeof source === "object" &&
      source &&
      typeof (source as { title?: unknown }).title === "string"
        ? String((source as { title: string }).title)
        : parsed.hostname;
    return { url: parsed.href, title };
  } catch {
    return null;
  }
}

export default function ResponsesPage() {
  const hospitalId = useAuthStore((state) => state.user?.hospitalId);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    () => {
      const requested = searchParams.get("platform");
      return requested && platforms.includes(requested) ? requested : null;
    },
  );
  const [mentionFilter, setMentionFilter] = useState<MentionFilter>(
    initialFilter === "mentioned" || initialFilter === "not_mentioned"
      ? initialFilter
      : "all",
  );
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<AIResponse | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogAnimationRef = useRef<Animation | null>(null);
  const dialogClosingRef = useRef(false);
  const closeDialog = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialogClosingRef.current) return;
    dialogClosingRef.current = true;
    dialogAnimationRef.current?.cancel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      dialogClosingRef.current = false;
      return;
    }
    const animation = dialog.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(12px) scale(.985)" },
      ],
      { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
    );
    dialogAnimationRef.current = animation;
    animation.finished
      .then(() => {
        dialog.close();
        animation.cancel();
        dialogClosingRef.current = false;
      })
      .catch(() => {
        dialogClosingRef.current = false;
      });
  }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = () => {
      if (!preference.matches) return;
      dialogAnimationRef.current?.cancel();
      if (dialogClosingRef.current) dialogRef.current?.close();
      dialogClosingRef.current = false;
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      preference.removeEventListener("change", onPreferenceChange);
      dialogAnimationRef.current?.cancel();
    };
  }, []);
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<ResponsePage>({
    queryKey: ["responses", hospitalId, selectedPlatform, mentionFilter],
    queryFn: async ({ pageParam }) => {
      const params: {
        platform?: string;
        limit: number;
        offset: number;
        mentioned?: string;
      } = { limit: PAGE_SIZE, offset: Number(pageParam) };
      if (selectedPlatform) params.platform = selectedPlatform;
      if (mentionFilter !== "all")
        params.mentioned = String(mentionFilter === "mentioned");
      const response = await crawlerApi.getResponses(hospitalId!, params);
      if (response.data?.error)
        throw new Error("응답 목록을 불러오지 못했습니다.");
      return Array.isArray(response.data)
        ? { data: response.data, total: response.data.length, hasMore: false }
        : response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((count, page) => count + page.data.length, 0)
        : undefined,
    enabled: !!hospitalId,
    staleTime: 1000 * 60 * 2,
    retry: 1,
    retryDelay: 2000,
  });
  const {
    data: responseDetail,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useQuery<AIResponse>({
    queryKey: ["response-detail", hospitalId, selectedResponse?.id],
    queryFn: () =>
      api
        .get(`/ai-crawler/responses/${hospitalId}/${selectedResponse!.id}`)
        .then((response) => response.data),
    enabled: !!hospitalId && !!selectedResponse,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedResponse && !dialog.open) {
      dialog.showModal();
      dialogClosingRef.current = false;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dialogAnimationRef.current = dialog.animate(
          [
            { opacity: 0, transform: "translateY(20px) scale(.98)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 280, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      }
    }
    if (!selectedResponse && dialog.open) dialog.close();
    if (!selectedResponse) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedResponse]);

  const responses = data?.pages.flatMap((page) => page.data) || [];
  const totalCount = data?.pages[0]?.total || 0;
  const questions = Array.from(
    new Set(
      responses
        .map((response) => responseQuestion(response))
        .filter((text): text is string => !!text),
    ),
  );
  const filteredResponses = responses.filter((response) => {
    const query = searchTerm.toLocaleLowerCase("ko-KR");
    const matchesSearch =
      !query ||
      responseQuestion(response).toLocaleLowerCase("ko-KR").includes(query) ||
      response.responseText?.toLocaleLowerCase("ko-KR").includes(query);
    const day = measurementDay(response);
    return (
      matchesSearch &&
      (!selectedQuestion || responseQuestion(response) === selectedQuestion) &&
      (!dateFrom || day >= dateFrom) &&
      (!dateTo || (!!day && day <= dateTo))
    );
  });
  const mentionedCount = filteredResponses.filter(
    (response) => response.isMentioned,
  ).length;
  const webSearchCount = filteredResponses.filter(
    (response) => response.isWebSearch,
  ).length;
  const localFiltersActive =
    !!searchTerm || !!selectedQuestion || !!dateFrom || !!dateTo;
  const selectedResponseIndex = filteredResponses.findIndex(
    (response) => response.id === selectedResponse?.id,
  );
  const selectAdjacentResponse = (direction: -1 | 1) => {
    if (selectedResponseIndex < 0) return;
    const response = filteredResponses[selectedResponseIndex + direction];
    if (response && !dialogClosingRef.current) setSelectedResponse(response);
  };
  const activeDetail = responseDetail || selectedResponse;
  const fullTextAvailable = !!responseDetail?.responseText;
  const detailText =
    responseDetail?.responseText || selectedResponse?.responseText || "";

  function resetFilters() {
    setSearchTerm("");
    setSelectedQuestion("");
    setDateFrom("");
    setDateTo("");
    setSelectedPlatform(null);
    setMentionFilter("all");
  }
  function downloadResponse() {
    if (!responseDetail?.responseText) return;
    const text = [
      platformNames[responseDetail.aiPlatform] || responseDetail.aiPlatform,
      formatDate(responseDetail.createdAt || responseDetail.responseDate, true),
      "",
      `${questionLabel(responseDetail)}: ${responseQuestion(responseDetail) || "질문 정보 없음"}`,
      "",
      responseDetail.responseText,
    ].join("\n");
    const objectUrl = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `PatientSignal_${responseDetail.aiPlatform}_${measurementDay(responseDetail)}_${responseDetail.id.slice(0, 8)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  if (!hospitalId)
    return (
      <div className="min-h-screen bg-[#f1f1eb]">
        <Header
          title="답변 보관함"
          description="AI가 작성한 답변을 원문으로 확인하세요"
        />
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-10">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#72756a]">
            답변 보관함
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#141512]">
            병원을 등록하면
            <br />
            AI 답변이 여기에 쌓입니다.
          </h1>
          <p className="mb-7 mt-4 text-sm text-[#72756a]">
            병원 소개와 모니터링 질문을 먼저 설정해 주세요.
          </p>
          <Link href="/onboarding">
            <Button>
              병원 등록하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f1f1eb] text-[#141512]">
      <Header
        title="답변 보관함"
        description="질문에 돌아온 실제 답변을 모아봅니다"
      />
      <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-5 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#141512] pb-5">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
              답변 보관함
            </h1>
            <p className="mt-1.5 text-xs text-[#72756a]">
              질문·플랫폼·측정 날짜별로 원문을 찾습니다.
            </p>
          </div>
          <Link
            href="/dashboard/live-query"
            className="desk-action inline-flex min-h-9 items-center gap-2 border border-[#141512] bg-[#ff5d2a] px-3 text-xs font-semibold text-[#141512]"
          >
            <Plus className="h-3.5 w-3.5" /> 직접 질문하기
          </Link>
        </div>
        <div className="desk-panel border border-[#d4d6cb] bg-white">
          <div className="flex items-center border-b border-[#d4d6cb]">
            <span className="hidden shrink-0 px-4 text-[10px] font-semibold text-[#72756a] sm:block">
              플랫폼
            </span>
            <div
              className="flex min-w-0 flex-1 overflow-x-auto"
              aria-label="AI 플랫폼 필터"
            >
              {[null, ...platforms].map((platform) => (
                <button
                  key={platform || "all"}
                  onClick={() => {
                    setSelectedPlatform(platform);
                    setSelectedQuestion("");
                  }}
                  aria-pressed={selectedPlatform === platform}
                  className={`desk-tab shrink-0 border-r border-[#d4d6cb] px-4 py-3 text-xs font-medium ${selectedPlatform === platform ? "desk-tab-active bg-[#d0ff43] text-[#141512]" : "text-[#72756a] hover:bg-[#f1f1eb] hover:text-[#141512]"}`}
                >
                  {platform ? platformNames[platform] : "전체"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[#d4d6cb] px-4 py-2.5">
            <button
              type="button"
              onClick={() => setShowMobileFilters((current) => !current)}
              aria-expanded={showMobileFilters}
              aria-controls="response-filters"
              className="inline-flex items-center gap-2 text-xs font-medium lg:pointer-events-none"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> 답변 필터
              {(localFiltersActive || mentionFilter !== "all") && (
                <span className="border-l border-[#d4d6cb] pl-2 text-[10px]">
                  적용 중
                </span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform lg:hidden ${showMobileFilters ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] text-[#72756a] hover:text-[#141512]"
            >
              초기화
            </button>
          </div>
          <div
            id="response-filters"
            className={`${showMobileFilters ? "signal-panel-enter block" : "hidden"} lg:block`}
          >
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label
                  htmlFor="response-search"
                  className="mb-2 block text-[11px] font-semibold"
                >
                  내용 검색
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-[#72756a]" />
                  <input
                    id="response-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="질문 또는 답변"
                    className="h-10 w-full min-w-0 border border-[#d4d6cb] bg-[#fafaf6] pl-9 pr-3 text-xs outline-none focus:border-[#141512] focus:ring-2 focus:ring-[#d0ff43]"
                  />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#72756a]">
                  불러온 질문·답변 미리보기에서 검색
                </p>
              </div>
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold">
                  우리 병원 언급
                </legend>
                <div className="space-y-0.5">
                  {(
                    [
                      ["all", "전체 답변"],
                      ["mentioned", "언급된 답변"],
                      ["not_mentioned", "언급되지 않은 답변"],
                    ] as [MentionFilter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setMentionFilter(value);
                        setSelectedQuestion("");
                      }}
                      aria-pressed={mentionFilter === value}
                      className={`desk-tab flex min-h-9 w-full items-center gap-2 rounded-none px-2 text-left text-xs transition-colors ${mentionFilter === value ? "desk-tab-active bg-[#d0ff43] font-semibold text-[#141512]" : "text-[#72756a] hover:bg-[#f1f1eb]"}`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${mentionFilter === value ? "border-[#d0ff43]" : "border-[#b8bcab]"}`}
                      >
                        {mentionFilter === value && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#d0ff43]" />
                        )}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label
                  htmlFor="response-question"
                  className="mb-2 block text-[11px] font-semibold"
                >
                  질문
                </label>
                <select
                  id="response-question"
                  value={selectedQuestion}
                  onChange={(event) => setSelectedQuestion(event.target.value)}
                  className="h-10 w-full min-w-0 max-w-full border border-[#d4d6cb] bg-[#fafaf6] px-2 text-xs outline-none focus:border-[#141512] focus:ring-2 focus:ring-[#d0ff43]"
                >
                  <option value="">불러온 모든 질문</option>
                  {questions.map((question) => (
                    <option key={question} value={question}>
                      {question}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-[11px] font-semibold">
                  측정 날짜
                </legend>
                <div className="grid min-w-0 gap-2">
                  <input
                    aria-label="측정 시작일"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-10 min-w-0 max-w-full border border-[#d4d6cb] bg-[#fafaf6] px-2 text-xs outline-none focus:border-[#141512] focus:ring-2 focus:ring-[#d0ff43]"
                  />
                  <input
                    aria-label="측정 종료일"
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-10 min-w-0 max-w-full border border-[#d4d6cb] bg-[#fafaf6] px-2 text-xs outline-none focus:border-[#141512] focus:ring-2 focus:ring-[#d0ff43]"
                  />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#72756a]">
                  불러온 답변 안에서 질문·날짜를 고릅니다.
                </p>
              </fieldset>
            </div>

            <div className="flex items-center justify-between border-t border-[#d4d6cb] px-4 py-2.5 text-[10px] text-[#72756a]">
              <span>질문·날짜·내용 검색은 불러온 답변 범위에 적용됩니다.</span>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="ml-3 shrink-0 border-b border-[#141512] pb-0.5 text-[#141512] lg:hidden"
              >
                필터 접기
              </button>
            </div>
          </div>
        </div>
        <section aria-label="AI 답변 목록" className="mt-5 min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <h2 className="font-semibold">
                {localFiltersActive ? "검색 결과" : "전체 기록"}{" "}
                <span className="ml-1 font-mono">
                  {isLoading || error ? (
                    "—"
                  ) : (
                    <AnimatedNumber
                      value={
                        localFiltersActive
                          ? filteredResponses.length
                          : totalCount
                      }
                    />
                  )}
                </span>
              </h2>
              <span className="text-[10px] text-[#72756a]">
                {responses.length.toLocaleString()}건 불러옴
                {totalCount > responses.length
                  ? ` / ${totalCount.toLocaleString()}건`
                  : ""}
              </span>
            </div>
            <Link
              href="/dashboard/prompts"
              className="desk-action inline-flex items-center gap-2 border-b border-[#141512] pb-0.5 text-[11px]"
            >
              질문 관리 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {responses.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-x border-t border-[#d4d6cb] bg-[#f1f1eb] px-4 py-2 text-[10px] text-[#72756a]">
              <span>표시 중 {filteredResponses.length}건 기준</span>
              <span>
                우리 병원 언급{" "}
                <b className="ml-1 font-mono text-[#141512]">
                  {mentionedCount}
                </b>
              </span>
              <span>
                웹검색 기반{" "}
                <b className="ml-1 font-mono text-[#141512]">
                  {webSearchCount}
                </b>
              </span>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2 border border-[#d4d6cb] bg-white p-10 text-sm text-[#72756a]">
              <Loader2 className="h-4 w-4 animate-spin" /> 답변을 불러오고
              있습니다.
            </div>
          ) : error ? (
            <div className="border border-[#d4d6cb] bg-white p-8">
              <h3 className="text-base font-semibold">
                답변을 불러오지 못했습니다.
              </h3>
              <p className="mb-5 mt-2 text-xs text-[#72756a]">
                잠시 후 다시 시도해 주세요.
              </p>
              <Button size="sm" onClick={() => refetch()}>
                다시 불러오기
              </Button>
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="border border-[#d4d6cb] bg-white px-6 py-12">
              <h3 className="text-base font-semibold">
                {localFiltersActive ||
                mentionFilter !== "all" ||
                selectedPlatform
                  ? "이 조건에 맞는 답변이 없습니다."
                  : "아직 측정된 답변이 없습니다."}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[#72756a]">
                {localFiltersActive
                  ? "검색 조건을 바꾸거나 이전 답변을 더 불러와보세요."
                  : "질문 측정이 완료되면 이곳에 답변이 저장됩니다."}
              </p>
            </div>
          ) : (
            <div
              key={`${selectedPlatform || "all"}-${mentionFilter}`}
              className="signal-enter desk-panel border border-[#d4d6cb] bg-white"
            >
              <div className="hidden grid-cols-[105px_105px_minmax(0,1fr)_90px_45px] gap-4 border-b border-[#141512] bg-[#141512] px-4 py-2.5 text-[10px] font-medium text-white md:grid">
                <span>플랫폼</span>
                <span>측정일</span>
                <span>질문 / 답변 미리보기</span>
                <span>우리 병원</span>
                <span>원문</span>
              </div>
              <div className="divide-y divide-[#d4d6cb]">
                {filteredResponses.map((response, index) => (
                  <article
                    key={response.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-4 transition-colors md:grid-cols-[105px_105px_minmax(0,1fr)_90px_45px] md:gap-x-4 ${selectedResponse?.id === response.id ? "bg-[#d0ff43] text-[#141512]" : "hover:bg-[#f1f1eb]"}`}
                  >
                    <div className="flex items-center gap-2 md:block">
                      <span className="font-mono text-[9px] text-[#72756a] md:mb-1 md:block">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-xs font-semibold">
                        {platformNames[response.aiPlatform] ||
                          response.aiPlatform}
                      </span>
                      {response.aiModelVersion && (
                        <span className="mt-1 hidden max-w-full truncate font-mono text-[9px] text-[#72756a] md:block">
                          {response.aiModelVersion}
                        </span>
                      )}
                    </div>
                    <time className="pt-0.5 text-[10px] text-[#72756a] md:text-[11px]">
                      {formatDate(response.responseDate || response.createdAt)}
                    </time>
                    <button
                      type="button"
                      onClick={() => setSelectedResponse(response)}
                      className="col-span-2 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#141512] focus-visible:ring-offset-2 md:col-span-1"
                    >
                      {!response.questionSnapshotAvailable && (
                        <p className="mb-1 text-[9px] text-[#72756a]">
                          {questionLabel(response)}
                        </p>
                      )}
                      <h3 className="text-[13px] font-medium leading-6">
                        {responseQuestion(response) || "질문 정보 없음"}
                      </h3>
                      <p className="mt-1 line-clamp-2 break-words text-[11px] leading-5 text-[#72756a]">
                        {response.responseText ||
                          "답변 미리보기가 없습니다. 원문을 열어 확인해 주세요."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#72756a]">
                        <span>{sentimentText(response.sentimentLabel)}</span>
                        {response.isWebSearch && <span>웹검색</span>}
                        {!!response.citedSources?.length && (
                          <span>출처 {response.citedSources.length}</span>
                        )}
                        {!!response.totalRecommendations && (
                          <span>총 {response.totalRecommendations}곳 추천</span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 self-start pt-1 text-[10px] md:col-start-4">
                      {response.isMentioned ? (
                        <>
                          <span className="h-1.5 w-1.5 bg-[#ff5d2a]" />
                          <span>
                            {response.mentionPosition
                              ? `${response.mentionPosition}번째 언급`
                              : "언급됨"}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#72756a]">미언급</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedResponse(response)}
                      className="desk-action inline-flex min-h-7 items-center justify-end gap-1 self-start border-b border-[#141512] text-[10px] md:justify-center"
                    >
                      읽기 <ArrowRight className="h-3 w-3" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="desk-action mt-3 flex min-h-11 w-full items-center justify-center gap-2 border border-[#141512] bg-white text-xs font-medium hover:bg-[#d0ff43] disabled:opacity-50"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}{" "}
              이전 답변{" "}
              {Math.min(PAGE_SIZE, Math.max(0, totalCount - responses.length))}
              건 불러오기
            </button>
          )}
        </section>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setSelectedResponse(null)}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
            return;
          if (
            event.target instanceof HTMLElement &&
            (event.target.isContentEditable ||
              ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
          )
            return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectAdjacentResponse(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            selectAdjacentResponse(1);
          }
        }}
        className="m-auto rounded-none max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[1000px] overflow-hidden border border-[#d4d6cb] bg-[#f1f1eb] p-0 text-[#141512] shadow-2xl backdrop:bg-[#141512]/60 sm:w-[calc(100%_-_64px)]"
        aria-labelledby="answer-dialog-title"
      >
        {selectedResponse && (
          <div className="flex max-h-[92dvh] flex-col">
            <div className="flex shrink-0 items-center justify-between gap-4 bg-[#141512] px-5 py-4 text-white sm:px-7">
              <div>
                <p className="text-[9px] font-semibold tracking-[0.18em] text-white/65">
                  저장된 원문
                </p>
                <h2
                  id="answer-dialog-title"
                  className="mt-1 text-base font-medium"
                >
                  {platformNames[selectedResponse.aiPlatform] ||
                    selectedResponse.aiPlatform}
                  의 답변
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="답변 닫기"
                className="signal-interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-white/30 text-white hover:bg-[#d0ff43] hover:text-[#141512]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              key={selectedResponse.id}
              className="signal-enter min-h-0 overflow-y-auto p-5 sm:p-7"
            >
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#72756a]">
                <span>
                  {formatDate(
                    activeDetail?.createdAt || activeDetail?.responseDate,
                    true,
                  )}
                </span>
                {activeDetail?.aiModelVersion && (
                  <span className="break-all font-mono text-[10px]">
                    {activeDetail.aiModelVersion}
                  </span>
                )}
                <span
                  className={
                    activeDetail?.isMentioned
                      ? "font-semibold text-[#141512]"
                      : ""
                  }
                >
                  {activeDetail?.isMentioned
                    ? activeDetail.mentionPosition
                      ? `우리 병원 ${activeDetail.mentionPosition}번째 언급`
                      : "우리 병원 언급"
                    : "우리 병원 미언급"}
                </span>
                {activeDetail?.isWebSearch && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> 웹검색 기반
                  </span>
                )}
              </div>
              <blockquote className="mb-6 border-l-2 border-[#d0ff43] pl-4">
                <p className="mb-2 text-[10px] font-semibold text-[#72756a]">
                  {questionLabel(activeDetail)}
                </p>
                <p className="text-base font-medium leading-7 tracking-[-0.02em]">
                  {responseQuestion(activeDetail) ||
                    responseQuestion(selectedResponse) ||
                    "질문 정보 없음"}
                </p>
              </blockquote>
              <div className="rounded-none border border-[#d4d6cb] bg-white p-5 sm:p-7">
                {detailLoading ? (
                  <div className="flex items-center gap-2 py-12 text-sm text-[#72756a]">
                    <Loader2 className="h-4 w-4 animate-spin" /> 전체 원문을
                    불러오고 있습니다
                  </div>
                ) : (
                  <>
                    {(!fullTextAvailable || detailError) && (
                      <div className="mb-5 border-l-2 border-[#A78544] bg-[#F7F3E9] px-4 py-3 text-xs leading-5 text-[#786745]">
                        전체 원문을 가져오지 못했습니다. 아래에는 저장된 목록
                        미리보기를 표시합니다.
                        <button
                          type="button"
                          onClick={() => refetchDetail()}
                          className="ml-2 font-semibold underline"
                        >
                          다시 시도
                        </button>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-[13px] leading-[2] text-[#33372c] sm:text-sm">
                      {detailText || "확인할 수 있는 답변 내용이 없습니다."}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#72756a]">
                <span>{sentimentText(activeDetail?.sentimentLabel)}</span>
                {!!activeDetail?.totalRecommendations && (
                  <span>총 추천 {activeDetail.totalRecommendations}곳</span>
                )}
                {activeDetail?.recommendationDepth && (
                  <span>
                    <TermTip term="recommendationDepth">추천 깊이</TermTip> ·{" "}
                    {activeDetail.recommendationDepth}
                  </span>
                )}
              </div>
              {!!activeDetail?.competitorsMentioned?.length && (
                <div className="mt-5 border-t border-[#d4d6cb] pt-4">
                  <p className="mb-2 text-[10px] font-semibold text-[#72756a]">
                    이 답변에 함께 등장한 병원
                  </p>
                  <p className="break-words text-xs leading-6 text-[#525849]">
                    {activeDetail.competitorsMentioned.join(" · ")}
                  </p>
                </div>
              )}
              {!!activeDetail?.citedSources?.length && (
                <div className="mt-5 border-t border-[#d4d6cb] pt-4">
                  <p className="mb-3 text-[10px] font-semibold text-[#72756a]">
                    인용 출처 · {activeDetail.citedSources.length}개
                  </p>
                  <div className="flex flex-col gap-2">
                    {activeDetail.citedSources.map((source, index) => {
                      const link = sourceLink(source);
                      return link ? (
                        <a
                          key={`${link.url}-${index}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-start gap-2 text-xs leading-5 text-[#141512] hover:underline"
                        >
                          <span className="shrink-0 font-mono text-[10px] text-[#72756a]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="break-all">{link.title}</span>
                          <ExternalLink className="mt-1 h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span
                          key={index}
                          className="text-[11px] text-[#72756a]"
                        >
                          출처 {index + 1} · 링크 정보 없음
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#d4d6cb] bg-white px-5 py-4 sm:px-7">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="이전 답변 원문"
                  aria-disabled={selectedResponseIndex <= 0}
                  className="aria-disabled:opacity-40"
                  onClick={() => selectAdjacentResponse(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-1 font-mono text-[10px] text-[#72756a]">
                  {selectedResponseIndex + 1} / {filteredResponses.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="다음 답변 원문"
                  aria-disabled={
                    selectedResponseIndex < 0 ||
                    selectedResponseIndex >= filteredResponses.length - 1
                  }
                  className="aria-disabled:opacity-40"
                  onClick={() => selectAdjacentResponse(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadResponse}
                disabled={detailLoading || !fullTextAvailable}
              >
                <Download className="h-3.5 w-3.5" /> 원문 내려받기
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
