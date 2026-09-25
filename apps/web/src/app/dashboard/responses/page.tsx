'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { TermTip } from '@/components/ui/term-tooltip';
import { api, crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  CLOVA_X: 'CLOVA X',
};
const platforms = Object.keys(platformNames);
const PAGE_SIZE = 50;
type MentionFilter = 'all' | 'mentioned' | 'not_mentioned';

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
    return '측정 시각 미확인';
  return new Date(dateString).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : {}),
  });
}
function measurementDay(response: AIResponse) {
  const value = response.responseDate || response.createdAt;
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
function responseQuestion(response?: AIResponse | null) {
  return response?.measuredQuestion || response?.prompt?.promptText || '';
}
function questionLabel(response?: AIResponse | null) {
  return response?.questionSnapshotAvailable
    ? '측정 당시 질문'
    : '현재 질문 · 측정 당시 문장 미보관';
}
function sentimentText(label?: string | null) {
  if (label === 'POSITIVE') return '긍정 표현';
  if (label === 'NEGATIVE') return '부정 표현';
  if (label === 'NEUTRAL') return '중립 표현';
  return '감성 미분석';
}
function sourceLink(source: unknown): { url: string; title: string } | null {
  const raw =
    typeof source === 'string'
      ? source
      : source && typeof source === 'object'
        ? (source as { url?: unknown }).url
        : null;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const title =
      typeof source === 'object' &&
      source &&
      typeof (source as { title?: unknown }).title === 'string'
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
  const initialFilter = searchParams.get('filter');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    () => {
      const requested = searchParams.get('platform');
      return requested && platforms.includes(requested) ? requested : null;
    },
  );
  const [mentionFilter, setMentionFilter] = useState<MentionFilter>(
    initialFilter === 'mentioned' || initialFilter === 'not_mentioned'
      ? initialFilter
      : 'all',
  );
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<AIResponse | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<ResponsePage>({
    queryKey: ['responses', hospitalId, selectedPlatform, mentionFilter],
    queryFn: async ({ pageParam }) => {
      const params: {
        platform?: string;
        limit: number;
        offset: number;
        mentioned?: string;
      } = { limit: PAGE_SIZE, offset: Number(pageParam) };
      if (selectedPlatform) params.platform = selectedPlatform;
      if (mentionFilter !== 'all')
        params.mentioned = String(mentionFilter === 'mentioned');
      const response = await crawlerApi.getResponses(hospitalId!, params);
      if (response.data?.error)
        throw new Error('응답 목록을 불러오지 못했습니다.');
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
    queryKey: ['response-detail', hospitalId, selectedResponse?.id],
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
    if (selectedResponse && !dialog.open) dialog.showModal();
    if (!selectedResponse && dialog.open) dialog.close();
    if (!selectedResponse) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
    const query = searchTerm.toLocaleLowerCase('ko-KR');
    const matchesSearch =
      !query ||
      responseQuestion(response).toLocaleLowerCase('ko-KR').includes(query) ||
      response.responseText?.toLocaleLowerCase('ko-KR').includes(query);
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
  const activeDetail = responseDetail || selectedResponse;
  const fullTextAvailable = !!responseDetail?.responseText;
  const detailText =
    responseDetail?.responseText || selectedResponse?.responseText || '';

  function resetFilters() {
    setSearchTerm('');
    setSelectedQuestion('');
    setDateFrom('');
    setDateTo('');
    setSelectedPlatform(null);
    setMentionFilter('all');
  }
  function downloadResponse() {
    if (!responseDetail?.responseText) return;
    const text = [
      platformNames[responseDetail.aiPlatform] || responseDetail.aiPlatform,
      formatDate(responseDetail.createdAt || responseDetail.responseDate, true),
      '',
      `${questionLabel(responseDetail)}: ${responseQuestion(responseDetail) || '질문 정보 없음'}`,
      '',
      responseDetail.responseText,
    ].join('\n');
    const objectUrl = URL.createObjectURL(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `PatientSignal_${responseDetail.aiPlatform}_${measurementDay(responseDetail)}_${responseDetail.id.slice(0, 8)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  if (!hospitalId)
    return (
      <div className="min-h-screen bg-[#F4F5EF]">
        <Header
          title="AI 답변"
          description="AI가 작성한 답변을 원문으로 확인하세요"
        />
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-10">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#778378]">
            ANSWER ARCHIVE
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#15231B]">
            병원을 등록하면
            <br />
            AI 답변이 여기에 쌓입니다.
          </h1>
          <p className="mb-7 mt-4 text-sm text-[#778378]">
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
    <div className="min-h-screen bg-[#F4F5EF] text-[#15231B]">
      <Header
        title="AI 답변"
        description="질문에 돌아온 실제 답변을 모아봅니다"
      />
      <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-7 sm:px-8 lg:px-10 lg:pt-10">
        <section className="mb-9 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#778378]">
              <span className="h-2 w-2 bg-[#36765A]" /> Answer archive
            </p>
            <h1 className="text-[34px] font-semibold leading-[1.17] tracking-[-0.055em] sm:text-[44px]">
              숫자 너머,
              <br className="sm:hidden" /> AI의 실제 답변.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#778378]">
              어떤 질문에 우리 병원이 등장했는지, 어떤 표현으로 소개됐는지
              읽어보세요.
            </p>
          </div>
          <Link
            href="/dashboard/live-query"
            className="group flex shrink-0 items-center gap-4 border-b border-[#BCC8B8] pb-3 text-xs font-semibold"
          >
            <span className="flex h-8 w-8 items-center justify-center bg-[#D8F36A]">
              <Plus className="h-4 w-4" />
            </span>
            <span>지금 AI에게 질문하기</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        <div
          className="mb-6 flex gap-0 overflow-x-auto border-y border-[#DEE4D9]"
          aria-label="AI 플랫폼 필터"
        >
          {[null, ...platforms].map((platform) => (
            <button
              key={platform || 'all'}
              onClick={() => {
                setSelectedPlatform(platform);
                setSelectedQuestion('');
              }}
              aria-pressed={selectedPlatform === platform}
              className={`relative shrink-0 px-4 py-4 text-xs font-semibold transition-colors first:pl-0 sm:px-5 ${selectedPlatform === platform ? 'text-[#15231B]' : 'text-[#778378] hover:text-[#15231B]'}`}
            >
              {platform ? platformNames[platform] : '전체 플랫폼'}
              {selectedPlatform === platform && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#36765A] first:left-0" />
              )}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
          <aside className="min-w-0 border border-[#DEE4D9] bg-white lg:sticky lg:top-24">
            <button
              type="button"
              onClick={() => setShowMobileFilters((current) => !current)}
              aria-expanded={showMobileFilters}
              aria-controls="response-filters"
              className="flex min-h-12 w-full items-center justify-between gap-3 px-5 py-4 text-xs font-semibold lg:hidden"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" /> 답변 필터
                {(localFiltersActive || mentionFilter !== 'all') && (
                  <span className="text-[10px] font-normal text-[#36765A]">
                    적용 중
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#778378] transition-transform ${showMobileFilters ? 'rotate-180' : ''}`}
              />
            </button>
            <div className="hidden items-center justify-between border-b border-[#DEE4D9] px-5 py-4 lg:flex">
              <h2 className="flex items-center gap-2 text-xs font-semibold">
                <SlidersHorizontal className="h-3.5 w-3.5" /> 답변 좁혀보기
              </h2>
              <button
                onClick={resetFilters}
                className="text-[10px] text-[#778378] hover:text-[#15231B]"
              >
                초기화
              </button>
            </div>
            <div
              id="response-filters"
              className={`${showMobileFilters ? 'block' : 'hidden'} border-t border-[#DEE4D9] lg:block lg:border-t-0`}
            >
              <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label
                    htmlFor="response-search"
                    className="mb-2 block text-[11px] font-semibold"
                  >
                    내용 검색
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-[#778378]" />
                    <input
                      id="response-search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="질문 또는 답변"
                      className="h-10 w-full min-w-0 border border-[#DEE4D9] bg-[#F8F9F5] pl-9 pr-3 text-xs outline-none focus:border-[#36765A]"
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-[#778378]">
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
                        ['all', '전체 답변'],
                        ['mentioned', '언급된 답변'],
                        ['not_mentioned', '언급되지 않은 답변'],
                      ] as [MentionFilter, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setMentionFilter(value);
                          setSelectedQuestion('');
                        }}
                        aria-pressed={mentionFilter === value}
                        className={`flex min-h-9 w-full items-center gap-2 text-left text-xs ${mentionFilter === value ? 'font-semibold text-[#36765A]' : 'text-[#778378]'}`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${mentionFilter === value ? 'border-[#36765A]' : 'border-[#BCC8B8]'}`}
                        >
                          {mentionFilter === value && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#36765A]" />
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
                    onChange={(event) =>
                      setSelectedQuestion(event.target.value)
                    }
                    className="h-10 w-full min-w-0 max-w-full border border-[#DEE4D9] bg-[#F8F9F5] px-2 text-xs outline-none focus:border-[#36765A]"
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
                      className="h-10 min-w-0 max-w-full border border-[#DEE4D9] bg-[#F8F9F5] px-2 text-xs outline-none focus:border-[#36765A]"
                    />
                    <input
                      aria-label="측정 종료일"
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="h-10 min-w-0 max-w-full border border-[#DEE4D9] bg-[#F8F9F5] px-2 text-xs outline-none focus:border-[#36765A]"
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-[#778378]">
                    불러온 답변 안에서 질문·날짜를 고릅니다.
                  </p>
                </fieldset>
              </div>
              <Link
                href="/dashboard/prompts"
                className="flex items-center justify-between border-t border-[#DEE4D9] px-5 py-4 text-[11px] font-medium text-[#36765A]"
              >
                모니터링 질문 관리 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="flex items-center justify-between border-t border-[#DEE4D9] px-5 py-3 lg:hidden">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] text-[#778378]"
                >
                  초기화
                </button>
                <Button size="sm" onClick={() => setShowMobileFilters(false)}>
                  답변 보기 <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </aside>

          <section className="min-w-0" aria-label="AI 답변 목록">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[#778378]">
                  {selectedPlatform
                    ? platformNames[selectedPlatform].toUpperCase()
                    : 'ALL PLATFORMS'}
                </p>
                <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.045em]">
                  {localFiltersActive ? '찾은 답변' : '수집된 답변'}{' '}
                  <span className="font-mono text-[#36765A]">
                    {localFiltersActive
                      ? filteredResponses.length.toLocaleString()
                      : totalCount.toLocaleString()}
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-[#778378]">
                {responses.length.toLocaleString()}건 불러옴
                {totalCount > responses.length
                  ? ` / ${totalCount.toLocaleString()}건`
                  : ''}
              </p>
            </div>
            {responses.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[#DEE4D9] py-3 text-[11px]">
                <span className="text-[#778378]">현재 목록 기준</span>
                <span>
                  우리 병원 언급{' '}
                  <b className="ml-1 font-mono text-[#36765A]">
                    {mentionedCount}
                  </b>
                </span>
                <span>
                  웹검색 기반 <b className="ml-1 font-mono">{webSearchCount}</b>
                </span>
                <span className="text-[#778378]">
                  표시 중 {filteredResponses.length}건
                </span>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 border-y border-[#DEE4D9] py-20 text-sm text-[#778378]">
                <Loader2 className="h-4 w-4 animate-spin" /> AI 답변을 불러오고
                있습니다
              </div>
            ) : error ? (
              <div className="border border-[#DEE4D9] bg-white px-6 py-14">
                <h3 className="text-xl font-semibold tracking-tight">
                  답변을 불러오지 못했습니다.
                </h3>
                <p className="mb-6 mt-3 text-sm leading-6 text-[#778378]">
                  잠시 후 다시 시도해 주세요.
                </p>
                <Button onClick={() => refetch()}>
                  다시 불러오기 <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="border border-[#DEE4D9] bg-white px-6 py-14">
                <MessageSquare className="mb-5 h-7 w-7 text-[#778378]" />
                <h3 className="text-xl font-semibold tracking-tight">
                  {localFiltersActive ||
                  mentionFilter !== 'all' ||
                  selectedPlatform
                    ? '이 조건에 맞는 답변이 없습니다.'
                    : '첫 답변을 기다리고 있습니다.'}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#778378]">
                  {localFiltersActive
                    ? '검색 조건을 바꾸거나 이전 답변을 더 불러와보세요.'
                    : '등록된 질문의 AI 측정이 완료되면 이곳에서 답변을 읽을 수 있습니다.'}
                </p>
                <Link
                  href="/dashboard/prompts"
                  className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#36765A]"
                >
                  모니터링 질문 확인 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#DEE4D9] border-y border-[#DEE4D9] bg-white">
                {filteredResponses.map((response, index) => (
                  <article
                    key={response.id}
                    className="group p-5 transition-colors hover:bg-[#FAFBF7] sm:p-6"
                  >
                    <div className="flex gap-4">
                      <span className="hidden pt-1 font-mono text-[11px] text-[#A0AD9A] sm:block">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="text-xs font-semibold">
                            {platformNames[response.aiPlatform] ||
                              response.aiPlatform}
                          </span>
                          <span className="text-[10px] text-[#778378]">
                            {formatDate(
                              response.responseDate || response.createdAt,
                            )}
                          </span>
                          {response.aiModelVersion && (
                            <span className="max-w-full truncate font-mono text-[9px] text-[#A0AD9A]">
                              {response.aiModelVersion}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] sm:ml-auto ${response.isMentioned ? 'text-[#36765A]' : 'text-[#778378]'}`}
                          >
                            <span
                              className={`h-1 w-1 rounded-full ${response.isMentioned ? 'bg-[#36765A]' : 'bg-[#A0AD9A]'}`}
                            />
                            {response.isMentioned
                              ? response.mentionPosition
                                ? `${response.mentionPosition}번째로 언급`
                                : '우리 병원 언급'
                              : '우리 병원 미언급'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedResponse(response)}
                          className="w-full text-left"
                        >
                          <p className="mb-1 text-[10px] text-[#778378]">
                            {questionLabel(response)}
                          </p>
                          <h3 className="text-[15px] font-semibold leading-6 tracking-[-0.025em] sm:text-base">
                            {responseQuestion(response) || '질문 정보 없음'}
                          </h3>
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-[1.85] text-[#6C7D6C]">
                            {response.responseText ||
                              '목록에 답변 미리보기가 없습니다. 원문을 열어 확인해 주세요.'}
                          </p>
                        </button>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#778378]">
                            {response.isWebSearch && (
                              <span className="inline-flex items-center gap-1">
                                <Globe className="h-3 w-3" /> 웹검색
                              </span>
                            )}
                            <span>
                              {sentimentText(response.sentimentLabel)}
                            </span>
                            {!!response.totalRecommendations && (
                              <span>
                                총 {response.totalRecommendations}곳 추천
                              </span>
                            )}
                            {!!response.citedSources?.length && (
                              <span>출처 {response.citedSources.length}개</span>
                            )}
                            {!!response.competitorsMentioned?.length && (
                              <span className="max-w-full break-words">
                                함께 언급:{' '}
                                {response.competitorsMentioned
                                  .slice(0, 2)
                                  .join(', ')}
                                {response.competitorsMentioned.length > 2
                                  ? ` 외 ${response.competitorsMentioned.length - 2}곳`
                                  : ''}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedResponse(response)}
                            className="inline-flex min-h-8 items-center gap-2 text-[11px] font-semibold text-[#36765A] hover:underline"
                          >
                            원문 읽기 <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border border-[#BCC8B8] text-xs font-semibold transition-colors hover:bg-[#EDF1E7] disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}{' '}
                이전 답변{' '}
                {Math.min(
                  PAGE_SIZE,
                  Math.max(0, totalCount - responses.length),
                )}
                건 더 불러오기
              </button>
            )}
          </section>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setSelectedResponse(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[1000px] overflow-hidden border border-[#DEE4D9] bg-[#F4F5EF] p-0 text-[#15231B] shadow-2xl backdrop:bg-[#13251D]/60 sm:w-[calc(100%_-_64px)]"
        aria-labelledby="answer-dialog-title"
      >
        {selectedResponse && (
          <div className="flex max-h-[92dvh] flex-col">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#DEE4D9] bg-[#13251D] px-5 py-4 text-white sm:px-7">
              <div>
                <p className="text-[9px] font-semibold tracking-[0.18em] text-[#D8F36A]">
                  ANSWER ORIGINAL
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
                onClick={() => dialogRef.current?.close()}
                aria-label="답변 닫기"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/25 text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#778378]">
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
                      ? 'font-semibold text-[#36765A]'
                      : ''
                  }
                >
                  {activeDetail?.isMentioned
                    ? activeDetail.mentionPosition
                      ? `우리 병원 ${activeDetail.mentionPosition}번째 언급`
                      : '우리 병원 언급'
                    : '우리 병원 미언급'}
                </span>
                {activeDetail?.isWebSearch && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> 웹검색 기반
                  </span>
                )}
              </div>
              <blockquote className="mb-6 border-l-2 border-[#36765A] pl-4">
                <p className="mb-2 text-[10px] font-semibold text-[#778378]">
                  {questionLabel(activeDetail)}
                </p>
                <p className="text-base font-medium leading-7 tracking-[-0.02em]">
                  {responseQuestion(activeDetail) ||
                    responseQuestion(selectedResponse) ||
                    '질문 정보 없음'}
                </p>
              </blockquote>
              <div className="border border-[#DEE4D9] bg-white p-5 sm:p-7">
                {detailLoading ? (
                  <div className="flex items-center gap-2 py-12 text-sm text-[#778378]">
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
                    <div className="whitespace-pre-wrap break-words text-[13px] leading-[2] text-[#384D3C] sm:text-sm">
                      {detailText || '확인할 수 있는 답변 내용이 없습니다.'}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#778378]">
                <span>{sentimentText(activeDetail?.sentimentLabel)}</span>
                {!!activeDetail?.totalRecommendations && (
                  <span>총 추천 {activeDetail.totalRecommendations}곳</span>
                )}
                {activeDetail?.recommendationDepth && (
                  <span>
                    <TermTip term="recommendationDepth">추천 깊이</TermTip> ·{' '}
                    {activeDetail.recommendationDepth}
                  </span>
                )}
              </div>
              {!!activeDetail?.competitorsMentioned?.length && (
                <div className="mt-5 border-t border-[#DEE4D9] pt-4">
                  <p className="mb-2 text-[10px] font-semibold text-[#778378]">
                    이 답변에 함께 등장한 병원
                  </p>
                  <p className="break-words text-xs leading-6 text-[#526451]">
                    {activeDetail.competitorsMentioned.join(' · ')}
                  </p>
                </div>
              )}
              {!!activeDetail?.citedSources?.length && (
                <div className="mt-5 border-t border-[#DEE4D9] pt-4">
                  <p className="mb-3 text-[10px] font-semibold text-[#778378]">
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
                          className="inline-flex max-w-full items-start gap-2 text-xs leading-5 text-[#36765A] hover:underline"
                        >
                          <span className="shrink-0 font-mono text-[10px] text-[#778378]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="break-all">{link.title}</span>
                          <ExternalLink className="mt-1 h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span
                          key={index}
                          className="text-[11px] text-[#778378]"
                        >
                          출처 {index + 1} · 링크 정보 없음
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#DEE4D9] bg-white px-5 py-4 sm:px-7">
              <p className="text-[10px] text-[#778378]">저장된 AI 응답 원문</p>
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
