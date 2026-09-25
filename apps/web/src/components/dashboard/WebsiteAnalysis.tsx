"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Globe2,
  Instagram,
  Loader2,
  RotateCcw,
  Search,
  Youtube,
} from "lucide-react";
import { api } from "@/lib/api";

type Platform =
  | "CHATGPT"
  | "PERPLEXITY"
  | "CLAUDE"
  | "GEMINI"
  | "GROK"
  | "CLOVA_X"
  | "NAVER_AI_BRIEFING";
type Channel = "WEBSITE" | "BLOG" | "INSTAGRAM" | "YOUTUBE";

const channelDetails = {
  WEBSITE: { label: "홈페이지", icon: Globe2, item: "페이지" },
  BLOG: { label: "블로그", icon: BookOpen, item: "글·페이지" },
  INSTAGRAM: { label: "인스타그램", icon: Instagram, item: "프로필 경로" },
  YOUTUBE: { label: "유튜브", icon: Youtube, item: "채널 경로" },
} as const;

interface Example {
  responseId: string;
  question: string;
  platform: Platform;
  responseDate: string;
  isMentioned: boolean;
}

interface WebsitePage {
  url: string;
  path: string;
  citationResponses: number;
  mentionedResponses: number;
  byPlatform: Array<{ platform: Platform; count: number }>;
  lastCitedAt: string;
  examples: Example[];
}

interface WebsiteAnalysisResult {
  status: "DOMAIN_REQUIRED" | "NO_MEASUREMENTS" | "NO_CITATIONS" | "READY";
  domain: string | null;
  domainSource: "hospital" | "override" | "missing";
  channel: Channel;
  registeredChannels: Record<Channel, string | null>;
  selectedChannelUrl: string | null;
  registeredWebsiteUrl: string | null;
  hostPolicy: "EXACT_AND_WWW" | "EXACT_WWW_AND_PLATFORM_MOBILE";
  scopePath: string | null;
  scopeSearch: string;
  scopeMode: "PATH_SUBTREE" | "EXACT_URL" | "NAVER_ACCOUNT" | "SOCIAL_PROFILE" | null;
  dateBasis: "CREATED_AT_KST";
  periodDays: number;
  fromDate: string;
  toDate: string;
  platform: Platform | "ALL";
  page: number;
  pageSize: number;
  totalResponses: number;
  citedResponseCount: number;
  pageCount: number;
  unresolvedGeminiResponses: number;
  hasMorePages: boolean;
  pages: WebsitePage[];
}

interface AnswerDetail {
  id: string;
  measuredQuestion: string;
  responseText: string;
  aiPlatform: Platform;
  responseDate: string;
  isMentioned: boolean;
}

const platformNames: Record<Platform, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
  GROK: "Grok",
  CLOVA_X: "CLOVA X",
  NAVER_AI_BRIEFING: "네이버 AI 브리핑",
};

const dayLabel = (day: string) => day ? day.replace(/-/g, ".") : "—";

function Metric({ label, value, note, accent = false }: {
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 border-r border-[#30343a] px-4 py-5 last:border-r-0 sm:px-5">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#959c9f]">{label}</p>
      <p className={`mt-2 font-display text-[29px] leading-none tracking-[-.045em] sm:text-[36px] ${accent ? "text-[#d9ff43]" : "text-[#f5f5ef]"}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[#959c9f]">{note}</p>
    </div>
  );
}

export function WebsiteAnalysis({ hospitalId }: { hospitalId: string }) {
  const [channel, setChannel] = useState<Channel>("WEBSITE");
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [domainInput, setDomainInput] = useState("");
  const [activeDomain, setActiveDomain] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  const analysisQuery = useQuery({
    queryKey: ["website-analysis", hospitalId, channel, days, platform, activeDomain, page],
    queryFn: () => api.get<WebsiteAnalysisResult>(
      `/ai-crawler/website-analysis/${hospitalId}`,
      {
        params: {
          days,
          platform,
          channel,
          ...(activeDomain ? { domain: activeDomain } : {}),
          page,
          pageSize: 25,
        },
      },
    ).then((response) => response.data),
    enabled: !!hospitalId,
    staleTime: 60_000,
    retry: 1,
  });
  const detailQuery = useQuery({
    queryKey: ["website-analysis-answer", hospitalId, selectedResponseId],
    queryFn: () => api.get<AnswerDetail>(
      `/ai-crawler/responses/${hospitalId}/${selectedResponseId}`,
    ).then((response) => response.data),
    enabled: !!hospitalId && !!selectedResponseId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const data = analysisQuery.data;
  const selectedChannel = channelDetails[channel];
  const applyDomain = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setExpandedUrl(null);
    setSelectedResponseId(null);
    setActiveDomain(domainInput.trim());
  };
  const chooseDays = (value: number) => {
    setDays(value);
    setPage(1);
    setExpandedUrl(null);
    setSelectedResponseId(null);
  };
  const chooseChannel = (value: Channel) => {
    setChannel(value);
    setActiveDomain("");
    setDomainInput("");
    setCustomOpen(false);
    setPage(1);
    setExpandedUrl(null);
    setSelectedResponseId(null);
  };

  return (
    <div className="space-y-5 text-[#f5f5ef]">
      <div className="grid gap-5 border-b border-[#30343a] pb-6 pt-1 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.13em] text-[#959c9f]">
            <span className="h-2 w-2 bg-[#ff6a24]" /> FIRST PARTY CITATION MAP
          </p>
          <h2 className="font-display text-[28px] leading-[1.13] tracking-[-.055em] sm:text-[36px]">
            우리 채널, 어떤 주소가 인용됐을까
          </h2>
        </div>
        <p className="max-w-lg text-xs leading-6 text-[#959c9f] lg:justify-self-end">
          병원에 등록한 공식 채널을 기준으로 저장된 AI 답변의 실제 출처 URL을 묶었습니다. 채널 내용이나 검색 순위를 검사한 결과는 아닙니다.
        </p>
      </div>

      <section className="border border-[#30343a] bg-[#111315] p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="공식 채널 선택">
          {(Object.keys(channelDetails) as Channel[]).map((value) => {
            const item = channelDetails[value];
            const Icon = item.icon;
            const registered = !!data?.registeredChannels?.[value];
            return (
              <button key={value} type="button" onClick={() => chooseChannel(value)} aria-pressed={channel === value}
                className={`flex min-w-0 items-center gap-2 border px-3 py-3 text-left transition-colors ${channel === value ? "border-[#d9ff43] bg-[#222916] text-[#f5f5ef]" : "border-[#454a50] bg-[#08090a] text-[#c0c4c7] hover:border-[#959c9f]"}`}>
                <Icon className={`h-4 w-4 shrink-0 ${channel === value ? "text-[#d9ff43]" : "text-[#ff6a24]"}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.label}</span>
                <span className={`shrink-0 text-[10px] ${registered ? "text-[#d9ff43]" : "text-[#959c9f]"}`}>{registered ? "등록" : "미등록"}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 border-t border-[#30343a] pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[.06em] text-[#c0c4c7]">등록된 {selectedChannel.label} 주소</p>
            <p className="mt-1 break-all text-sm font-semibold text-[#f5f5ef]">
              {analysisQuery.isLoading ? "등록 주소 확인 중" : data?.selectedChannelUrl || "아직 등록된 주소가 없습니다"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <a href="/dashboard/settings#online-channels" className="font-semibold text-[#ff9565] hover:underline">병원 소개에서 공식 채널 주소 설정 <ArrowUpRight className="inline h-3 w-3" /></a>
              <button type="button" onClick={() => setCustomOpen(!customOpen)} aria-expanded={customOpen} className="text-[#c0c4c7] hover:text-white">{customOpen ? "임시 주소 닫기" : "다른 주소로 조회"}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-2 text-[11px] font-bold text-[#c0c4c7]">기간</p>
              <div className="flex border border-[#454a50]">
                {[7, 30, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => chooseDays(value)}
                    aria-pressed={days === value}
                    className={`px-3 py-2 text-xs font-semibold ${days === value ? "bg-[#d9ff43] text-[#08090a]" : "bg-[#08090a] text-[#c0c4c7] hover:text-white"}`}
                  >
                    {value}일
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="website-platform" className="mb-2 block text-[11px] font-bold text-[#c0c4c7]">AI</label>
              <select
                id="website-platform"
                value={platform}
                onChange={(event) => {
                  setPlatform(event.target.value as Platform | "ALL");
                  setPage(1);
                  setExpandedUrl(null);
                  setSelectedResponseId(null);
                }}
                className="h-[35px] border border-[#454a50] bg-[#08090a] px-2.5 text-xs text-[#f5f5ef]"
              >
                <option value="ALL">전체 AI</option>
                {Object.entries(platformNames).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {customOpen && (
          <form onSubmit={applyDomain} className="mt-4 border-t border-[#30343a] pt-4">
            <label htmlFor="website-domain-input" className="mb-2 block text-[11px] font-bold text-[#c0c4c7]">조회할 도메인 또는 계정 URL</label>
            <div className="flex min-w-0 gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-[#454a50] bg-[#08090a] px-3 focus-within:border-[#ff6a24]">
                <Globe2 className="h-4 w-4 shrink-0 text-[#959c9f]" />
                <input id="website-domain-input" type="text" inputMode="url" value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder={data?.selectedChannelUrl || "https://example.com/clinic"}
                  className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#777f84]" />
              </div>
              <button type="submit" className="flex shrink-0 items-center gap-1.5 bg-[#ff6a24] px-3.5 text-xs font-bold text-[#08090a] hover:bg-[#ff9565]">
                <Search className="h-3.5 w-3.5" /> 조회
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#959c9f]">임시 주소는 이번 조회에만 적용됩니다. 저장하려면 병원 소개에서 등록하세요.</p>
          </form>
        )}
        {data?.domain && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#30343a] pt-3 text-[11px] text-[#959c9f]">
            <span>조회 범위: <strong className="font-semibold text-[#f5f5ef]">{data.domain}{data.scopePath === "/" ? "" : data.scopePath}{data.scopeSearch}</strong>{["PATH_SUBTREE", "SOCIAL_PROFILE"].includes(data.scopeMode || "") && data.scopePath !== "/" ? " 및 하위 경로" : ""}{data.scopeMode === "NAVER_ACCOUNT" ? " 계정의 글" : ""}</span>
            <span>·</span>
            <span>{dayLabel(data.fromDate)}–{dayLabel(data.toDate)} 수집일(KST)</span>
            <span>· 다른 계정·하위 도메인은 제외</span>
            {activeDomain && (
              <button type="button" onClick={() => { setActiveDomain(""); setDomainInput(""); setPage(1); setExpandedUrl(null); setSelectedResponseId(null); }} className="flex items-center gap-1 text-[#ff9565] hover:underline">
                <RotateCcw className="h-3 w-3" /> 등록 주소로
              </button>
            )}
          </div>
        )}
      </section>

      {analysisQuery.isLoading ? (
        <div className="flex items-center gap-2 border border-[#30343a] bg-[#111315] px-5 py-12 text-sm text-[#c0c4c7]">
          <Loader2 className="h-4 w-4 animate-spin text-[#ff6a24]" /> 저장된 AI 답변을 집계하고 있습니다.
        </div>
      ) : analysisQuery.isError ? (
        <div role="alert" className="border border-[#703c29] bg-[#251914] px-5 py-7">
          <p className="text-sm font-semibold text-[#f5f5ef]">{selectedChannel.label} 인용 데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs text-[#c0c4c7]">등록 주소나 임시 조회 URL의 형식과 네트워크 연결을 확인한 뒤 다시 조회하세요. 공유 플랫폼의 전체 도메인만으로는 우리 계정을 식별할 수 없습니다.</p>
          <button type="button" onClick={() => analysisQuery.refetch()} className="mt-4 text-xs font-semibold text-[#ff9565] hover:underline">다시 조회</button>
        </div>
      ) : data?.status === "DOMAIN_REQUIRED" ? (
        <div className="border border-[#30343a] bg-[#111315] px-5 py-12 text-center">
          <Globe2 className="mx-auto h-7 w-7 text-[#ff6a24]" />
          <p className="mt-4 text-base font-semibold">{selectedChannel.label} 주소를 등록해 주세요.</p>
          <p className="mt-2 text-xs leading-6 text-[#959c9f]">병원 소개에서 공식 주소를 저장하면 해당 채널을 자동으로 분석합니다. 주소를 저장하기 전에는 “다른 주소로 조회”를 사용할 수 있습니다.</p>
          <a href="/dashboard/settings#online-channels" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#ff9565] hover:underline">공식 채널 주소 설정 <ArrowUpRight className="h-3.5 w-3.5" /></a>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 border border-[#30343a] bg-[#111315] lg:grid-cols-4">
            <Metric label="인용된 AI 답변" value={data.citedResponseCount} note={`${selectedChannel.label} 주소를 1개 이상 인용`} accent />
            <Metric label={`확인된 ${selectedChannel.item}`} value={data.pageCount} note="같은 URL의 중복 인용 통합" />
            <Metric label="기간 내 수집 답변" value={data.totalResponses} note="선택한 기간·AI의 전체 답변" />
            <Metric label="Gemini 미확인" value={data.unresolvedGeminiResponses} note="마스킹 링크보다 실제 URL 단서가 적은 답변" />
          </div>
          <p className="text-[11px] leading-5 text-[#959c9f]">
            각 페이지의 인용 수는 그 페이지를 인용한 <strong className="text-[#c0c4c7]">서로 다른 AI 답변 수</strong>입니다. 한 답변이 여러 페이지를 인용할 수 있어 페이지별 수의 합은 상단 답변 수보다 클 수 있습니다. 병원 언급은 별도 집계입니다.
          </p>

          {data.status === "NO_MEASUREMENTS" ? (
            <div className="border border-[#30343a] bg-[#111315] px-5 py-12 text-center">
              <p className="text-base font-semibold">이 기간에는 측정된 AI 답변이 없습니다.</p>
              <p className="mt-2 text-xs text-[#959c9f]">기간을 넓히거나 수집이 완료된 뒤 다시 확인하세요.</p>
            </div>
          ) : data.status === "NO_CITATIONS" ? (
            <div className="border border-[#30343a] bg-[#111315] px-5 py-12 text-center">
              <p className="text-base font-semibold">{selectedChannel.label} 주소의 확인 가능한 인용은 없습니다.</p>
              <p className="mt-2 text-xs leading-6 text-[#959c9f]">수집 답변 {data.totalResponses.toLocaleString()}건을 확인했습니다. 등록 주소와 실제 인용 URL이 다른 경우 “다른 주소로 조회”를 이용하세요. 가려진 링크는 원본 URL이 없으면 포함하지 않습니다. 0건이 해당 채널의 인용 부재를 증명하지는 않습니다.</p>
            </div>
          ) : (
            <section className="border border-[#30343a] bg-[#111315]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30343a] px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#ff9565]">PAGE BY PAGE</p>
                  <h3 className="mt-1 font-display text-lg font-semibold">인용된 {selectedChannel.label} {selectedChannel.item}</h3>
                </div>
                <p className="text-xs text-[#959c9f]">인용 답변 수 순 · 전체 {data.pageCount.toLocaleString()}개 URL</p>
              </div>
              <div className="divide-y divide-[#30343a]">
                {data.pages.map((item, index) => {
                  const expanded = expandedUrl === item.url;
                  return (
                    <div key={item.url} className="px-4 py-4 sm:px-5">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="flex min-w-0 gap-3">
                          <span className="font-mono text-xs text-[#ff6a24]">{String((data.page - 1) * data.pageSize + index + 1).padStart(2, "0")}</span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] text-[#959c9f]">{data.domain}</p>
                            <p className="break-all text-sm font-semibold leading-6 text-[#f5f5ef]">{item.path}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#959c9f]">
                              <span>최근 인용 수집일 {dayLabel(item.lastCitedAt)}</span>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#ff9565] hover:underline">
                                실제 페이지 열기 <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs lg:justify-end">
                          <span className="bg-[#222916] px-2.5 py-1.5 font-bold text-[#d9ff43]">{item.citationResponses}개 답변 인용</span>
                          <span className="text-[#c0c4c7]">이 중 병원 언급 {item.mentionedResponses}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedUrl(expanded ? null : item.url);
                              setSelectedResponseId(null);
                            }}
                            aria-expanded={expanded}
                            className="inline-flex items-center gap-1 font-semibold text-[#ff9565] hover:underline"
                          >
                            질문·답변 {expanded ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="ml-7 mt-3 flex flex-wrap gap-1.5">
                        {item.byPlatform.map(({ platform: name, count }) => (
                          <span key={name} className="border border-[#30343a] bg-[#08090a] px-2 py-1 text-[10px] text-[#c0c4c7]">
                            {platformNames[name] || name} {count}
                          </span>
                        ))}
                      </div>
                      {expanded && (
                        <div className="ml-7 mt-4 space-y-3 border-l-2 border-[#ff6a24] bg-[#0b0c0e] p-4">
                          <p className="text-[11px] leading-5 text-[#959c9f]">최근 질문 예시 최대 3개 · 답변 원문은 클릭할 때 조회합니다.</p>
                          {item.examples.map((example) => (
                            <div key={example.responseId} className="border-t border-[#30343a] pt-3 first:border-0 first:pt-0">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#959c9f]">
                                <span>{platformNames[example.platform] || example.platform}</span>
                                <span>·</span>
                                <span>{dayLabel(example.responseDate)}</span>
                                <span>·</span>
                                <span className={example.isMentioned ? "text-[#d9ff43]" : "text-[#959c9f]"}>
                                  {example.isMentioned ? "병원 언급" : "병원 미언급"}
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs leading-6 text-[#f5f5ef]">{example.question || "측정 당시 질문 원문 없음"}</p>
                              <button type="button" onClick={() => setSelectedResponseId(selectedResponseId === example.responseId ? null : example.responseId)} className="mt-1 text-[11px] font-semibold text-[#ff9565] hover:underline">
                                {selectedResponseId === example.responseId ? "원문 닫기" : "답변 원문 보기"}
                              </button>
                              {selectedResponseId === example.responseId && (
                                <div className="mt-3 border border-[#30343a] bg-[#111315] p-3">
                                  {detailQuery.isLoading ? (
                                    <p className="flex items-center gap-2 text-xs text-[#c0c4c7]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 원문을 불러오고 있습니다.</p>
                                  ) : detailQuery.isError ? (
                                    <p role="alert" className="text-xs text-[#ff9565]">답변 원문을 불러오지 못했습니다. <button type="button" onClick={() => detailQuery.refetch()} className="underline">다시 시도</button></p>
                                  ) : (
                                    <p className="max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-[#c0c4c7]">{detailQuery.data?.responseText || "답변 원문이 없습니다."}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {data.pageCount > data.pageSize && (
                <div className="flex items-center justify-between border-t border-[#30343a] px-4 py-3 text-xs sm:px-5">
                  <button type="button" disabled={page <= 1} onClick={() => { setPage(page - 1); setExpandedUrl(null); setSelectedResponseId(null); }} className="inline-flex items-center gap-1 text-[#c0c4c7] disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" /> 이전</button>
                  <span className="text-[#959c9f]">{page} / {Math.ceil(data.pageCount / data.pageSize)}</span>
                  <button type="button" disabled={!data.hasMorePages} onClick={() => { setPage(page + 1); setExpandedUrl(null); setSelectedResponseId(null); }} className="inline-flex items-center gap-1 text-[#c0c4c7] disabled:opacity-40">다음 <ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </section>
          )}
          <p className="border-t border-[#30343a] pt-4 text-[11px] leading-6 text-[#959c9f]">
            집계 기준: 저장된 동일 병원의 AI 답변과 수집 시각(KST), 선택 기간·AI, 실제 출처 URL. 등록한 계정·경로 범위만 포함하며 타 계정은 제외합니다. 네이버 블로그의 모바일·PostView 주소는 같은 글로 묶습니다. 인스타그램 게시물·릴스와 유튜브 영상의 일반 URL은 소유 계정을 확인할 수 없어 제외합니다. 따라서 0건은 인용 부재의 증거가 아닙니다. UTM·클릭 추적값과 #위치는 제거하지만 일반 페이지를 구분하는 검색 조건은 유지합니다. Gemini의 가려진 링크는 실제 페이지 URL 단서만 집계합니다.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default WebsiteAnalysis;
