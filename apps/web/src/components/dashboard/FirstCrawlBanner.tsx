'use client';

/**
 * 【Day-0 아하모먼트】온보딩 직후 첫 AI 분석 진행/결과 배너
 *
 * - 병원 생성 후 24시간 이내(isNewHospital)에만 표시
 * - 첫 크롤 진행 중: 15초 간격 폴링 + 진행률 표시
 * - 첫 결과 도착: "우리 병원이 AI 응답에서 언급됐는지" 즉시 보여줌
 * - 닫기(localStorage) 후에는 다시 표시하지 않음
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crawlerApi } from '@/lib/api';
import Link from 'next/link';
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  X,
  PartyPopper,
  Search,
  ArrowRight,
} from 'lucide-react';

const DISMISS_KEY = 'patient-signal-first-crawl-banner-dismissed';

const PLATFORM_NAMES: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  CLOVA_X: 'CLOVA X',
};

export function FirstCrawlBanner({ hospitalId }: { hospitalId?: string }) {
  const [dismissed, setDismissed] = useState(true); // SSR 안전: 기본 숨김

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  const { data } = useQuery({
    queryKey: ['firstCrawlStatus', hospitalId],
    queryFn: async () => {
      if (!hospitalId) return null;
      const res = await crawlerApi.getFirstCrawlStatus(hospitalId);
      return res.data;
    },
    enabled: !!hospitalId && !dismissed,
    // 크롤 진행 중이면 15초, 완료 후엔 폴링 중단
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d?.isNewHospital) return false;
      if (d?.firstJob?.status === 'RUNNING' || d?.firstJob?.status === 'PENDING') return 15 * 1000;
      // 잡은 끝났는데 아직 응답 집계가 안 보이면 짧게 한 번 더
      if (d?.firstJob && (d?.results?.totalResponses ?? 0) === 0) return 30 * 1000;
      return false;
    },
    staleTime: 10 * 1000,
  });

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  // 표시 조건: 새 병원 + 첫 잡이 존재
  if (dismissed || !data?.isNewHospital || !data?.firstJob) return null;

  const job = data.firstJob;
  const results = data.results;
  const isRunning = job.status === 'RUNNING' || job.status === 'PENDING';
  const hasResults = (results?.totalResponses ?? 0) > 0;
  const anyMention = results?.anyMention;

  const progressPct =
    job.totalPrompts > 0
      ? Math.min(100, Math.round(((job.completed + job.failed) / job.totalPrompts) * 100))
      : 0;

  return (
    <div className="mx-4 sm:mx-6 mt-3" id="first-crawl-banner">
      <div
        className={`relative rounded-2xl border p-4 sm:p-5 overflow-hidden ${
          !hasResults
            ? 'bg-gradient-to-r from-brand-50 to-violet-50 border-brand-200'
            : anyMention
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
        }`}
      >
        <button
          onClick={handleDismiss}
          aria-label="배너 닫기"
          className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── 진행 중 ── */}
        {isRunning && !hasResults && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <Loader2 className="h-5 w-5 text-brand-600 animate-spin" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-sm font-black text-slate-800">
                첫 AI 분석이 지금 진행 중입니다 <Sparkles className="inline h-4 w-4 text-brand-500 -mt-0.5" />
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                AI 플랫폼에 실제 질문을 던지고 있어요. 몇 분 안에 첫 결과가 여기에 표시됩니다.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(progressPct, 5)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-brand-600 tabular-nums shrink-0">
                  {job.completed + job.failed}/{job.totalPrompts} 질문
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 첫 결과 도착 ── */}
        {hasResults && (
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                anyMention ? 'bg-emerald-100' : 'bg-amber-100'
              }`}
            >
              {anyMention ? (
                <PartyPopper className="h-5 w-5 text-emerald-600" />
              ) : (
                <Search className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-sm font-black text-slate-800">
                {anyMention ? (
                  <>
                    첫 분석 결과: AI가 우리 병원을{' '}
                    <span className="text-emerald-600">{results.mentionedTotal}회 언급</span>했습니다!
                  </>
                ) : (
                  <>첫 분석 결과: 아직 AI 응답에서 우리 병원이 언급되지 않았습니다</>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {anyMention
                  ? '좋은 출발이에요. 어떤 질문에서 어떻게 언급됐는지 확인해보세요.'
                  : '지극히 정상입니다 — 여기서부터가 시작이에요. AEO 개선 액션으로 언급을 만들어갑니다.'}
              </p>

              {/* 플랫폼별 언급 칩 */}
              {results.platforms?.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {results.platforms.map((p: any) => (
                    <span
                      key={p.platform}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                        p.mentioned > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-white/70 text-slate-500'
                      }`}
                    >
                      {p.mentioned > 0 ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                      {PLATFORM_NAMES[p.platform] || p.platform}
                      {p.mentioned > 0 && ` ${p.mentioned}/${p.total}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard/insights"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 bg-white px-3 py-1.5 rounded-xl border border-brand-200 hover:border-brand-300 transition-colors"
                >
                  AI 응답 원문 보기 <ArrowRight className="h-3 w-3" />
                </Link>
                {!anyMention && (
                  <Link
                    href="/dashboard/funnel"
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-white px-3 py-1.5 rounded-xl border border-amber-200 hover:border-amber-300 transition-colors"
                  >
                    개선 액션 시작하기 <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 잡 실패 ── */}
        {!isRunning && !hasResults && job.status === 'FAILED' && (
          <div className="flex items-start gap-3 pr-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">첫 분석이 아직 준비 중입니다</p>
              <p className="text-xs text-slate-500 mt-0.5">
                다음 정기 분석에서 자동으로 다시 시도합니다. 조금만 기다려주세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
