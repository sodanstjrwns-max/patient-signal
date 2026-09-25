"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Globe2,
  Loader2,
  RotateCcw,
  Search,
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
  registeredWebsiteUrl: string | null;
  hostPolicy: "EXACT_AND_WWW";
  scopePath: string | null;
  scopeSearch: string;
  scopeMode: "PATH_SUBTREE" | "EXACT_URL" | null;
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
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [domainInput, setDomainInput] = useState("");
  const [activeDomain, setActiveDomain] = useState("");
  const [page, setPage] = useState(1);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  const analysisQuery = useQuery({
    queryKey: ["website-analysis", hospitalId, days, platform, activeDomain, page],
    queryFn: () => api.get<WebsiteAnalysisResult>(
      `/ai-crawler/website-analysis/${hospitalId}`,
      {
        params: {
          days,
          platform,
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

  return (
    <div className="space-y-5 text-[#f5f5ef]">
      <div className="grid gap-5 border-b border-[#30343a] pb-6 pt-1 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.13em] text-[#959c9f]">
            <span className="h-2 w-2 bg-[#ff6a24]" /> FIRST PARTY CITATION MAP
          </p>
          <h2 className="font-display text-[28px] leading-[1.13] tracking-[-.055em] sm:text-[36px]">
            홈페이지, 어느 페이지가 인용됐을까
          </h2>
        </div>
        <p className="max-w-lg text-xs leading-6 text-[#959c9f] lg:justify-self-end">
          저장된 AI 답변의 실제 출처 URL을 페이지별로 묶었습니다. 홈페이지의 내용이나 검색 순위를 검사한 결과가 아닙니다.
        </p>
      </div>

      <section className="border border-[#30343a] bg-[#111315] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <form onSubmit={applyDomain} className="min-w-0">
            <label htmlFor="website-domain-input" className="mb-2 block text-[11px] font-bold tracking-[.06em] text-[#c0c4c7]">
              분석할 홈페이지 도메인 또는 URL
            </label>
            <div className="flex min-w-0 gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-[#454a50] bg-[#08090a] px-3 focus-within:border-[#ff6a24]">
                <Globe2 className="h-4 w-4 shrink-0 text-[#959c9f]" />
                <input
                  id="website-domain-input"
                  type="text"
                  inputMode="url"
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder={data?.registeredWebsiteUrl || "예: bdbddc.com"}
                  className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#777f84]"
                />
              </div>
              <button type="submit" className="flex shrink-0 items-center gap-1.5 bg-[#ff6a24] px-3.5 text-xs font-bold text-[#08090a] hover:bg-[#ff9565]">
                <Search className="h-3.5 w-3.5" /> 조회
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#959c9f]">
              {data?.registeredWebsiteUrl ? <>병원 등록 주소: <span className="text-[#c0c4c7]">{data.registeredWebsiteUrl}</span>. </> : "등록된 홈페이지 주소가 없습니다. 도메인을 직접 입력하세요. "}
              입력한 도메인은 이 조회에만 적용됩니다.
            </p>
          </form>
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
        {data?.domain && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#30343a] pt-3 text-[11px] text-[#959c9f]">
            <span>조회 범위: <strong className="font-semibold text-[#f5f5ef]">{data.domain}{data.scopePath === "/" ? "" : data.scopePath}{data.scopeSearch}</strong>{data.scopeMode === "PATH_SUBTREE" && data.scopePath !== "/" ? " 및 하위 경로" : ""}</span>
            <span>·</span>
            <span>{dayLabel(data.fromDate)}–{dayLabel(data.toDate)} 수집일(KST)</span>
            <span>· www는 동일 도메인, 다른 하위 도메인은 제외</span>
            {activeDomain && (
              <button type="button" onClick={() => { setActiveDomain(""); setDomainInput(""); setPage(1); }} className="flex items-center gap-1 text-[#ff9565] hover:underline">
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
          <p className="text-sm font-semibold text-[#f5f5ef]">홈페이지 인용 데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs text-[#c0c4c7]">도메인 형식과 네트워크 연결을 확인한 뒤 다시 조회하세요.</p>
          <button type="button" onClick={() => analysisQuery.refetch()} className="mt-4 text-xs font-semibold text-[#ff9565] hover:underline">다시 조회</button>
        </div>
      ) : data?.status === "DOMAIN_REQUIRED" ? (
        <div className="border border-[#30343a] bg-[#111315] px-5 py-12 text-center">
          <Globe2 className="mx-auto h-7 w-7 text-[#ff6a24]" />
          <p className="mt-4 text-base font-semibold">홈페이지 도메인을 입력해 주세요.</p>
          <p className="mt-2 text-xs leading-6 text-[#959c9f]">병원 등록 홈페이지가 비어 있습니다. 실제 운영 도메인을 위에 입력하면 저장된 답변에서 해당 페이지의 인용을 찾습니다.</p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 border border-[#30343a] bg-[#111315] lg:grid-cols-4">
            <Metric label="인용된 AI 답변" value={data.citedResponseCount} note="선택 도메인 페이지를 1개 이상 인용" accent />
            <Metric label="확인된 페이지" value={data.pageCount} note="같은 페이지의 중복 URL 통합" />
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
              <p className="text-base font-semibold">이 도메인의 페이지 인용은 확인되지 않았습니다.</p>
              <p className="mt-2 text-xs leading-6 text-[#959c9f]">수집 답변 {data.totalResponses.toLocaleString()}건을 확인했습니다. 실제 사이트 도메인이나 경로가 병원 등록 주소와 다르면 위에서 바꿔 조회해 보세요. Gemini 마스킹 링크는 원본 페이지 URL이 없으면 포함하지 않습니다.</p>
            </div>
          ) : (
            <section className="border border-[#30343a] bg-[#111315]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30343a] px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#ff9565]">PAGE BY PAGE</p>
                  <h3 className="mt-1 font-display text-lg font-semibold">인용된 홈페이지 페이지</h3>
                </div>
                <p className="text-xs text-[#959c9f]">인용 답변 수 순 · 전체 {data.pageCount.toLocaleString()}페이지</p>
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
            집계 기준: 저장된 동일 병원의 AI 답변과 수집 시각(KST), 선택 기간·AI, 실제 출처 URL. www는 같은 호스트로 묶고 다른 하위 도메인은 별개로 취급합니다. 등록 주소에 경로가 있으면 그 경로와 하위 페이지만 포함합니다. 전체 도메인을 보려면 위에 도메인만 입력하세요. URL의 UTM·클릭 추적값과 #위치는 제거하지만 페이지를 구분하는 검색 조건은 유지합니다. Gemini의 가려진 링크는 실제 페이지 URL 단서만 집계하고, 마스킹 링크 수보다 URL 단서가 적은 답변을 미확인으로 셉니다.
          </p>
        </>
      ) : null}
    </div>
  );
}

export default WebsiteAnalysis;
