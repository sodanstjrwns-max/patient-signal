'use client';

/**
 * TopMentionedPrompts — "이번 주 언급된 질문 TOP 5" 위젯
 *
 * 배경 (2026.08.26): 유료 구독 원장이 "어떤 질문에 우리가 AI에 노출되는지
 * 확인하는 곳이 없냐"고 문의 — 핵심 가치(질문 단위 노출 성과)가 첫 화면에
 * 없어서 생긴 일. 서비스 존재 이유를 대시보드 최상단 근처에서 즉답한다.
 *
 * 데이터: GET /scores/:id/abhs/golden-prompts?days=7 (기존 V2 API 재활용)
 *  - goldenScore 순 상위 10개 중 mentionCount>0 만 걸러 5개 표시
 *  - "모르는 것"과 "0"을 구분: loading/error/empty 상태 분리 (metric-value 패턴)
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MessageSquareQuote, ArrowRight, Trophy, AlertTriangle } from 'lucide-react';

const PLATFORM_LABEL: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  CLOVA_X: 'CLOVA X',
  NAVER_AI_BRIEFING: '네이버 AI',
  NONE: '-',
};

interface GoldenPrompt {
  promptText: string;
  goldenScore: number;
  sov: number;
  r3Rate: number;
  topPlatform: string;
  totalResponses: number;
  mentionCount: number;
}

export function TopMentionedPrompts({ hospitalId }: { hospitalId: string | undefined }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['golden-prompts-weekly', hospitalId || ''],
    queryFn: async () => {
      const res = await api.get(`/scores/${hospitalId}/abhs/golden-prompts`, {
        params: { days: 7 },
      });
      return res.data as { goldenPrompts: GoldenPrompt[] };
    },
    enabled: !!hospitalId,
    staleTime: 10 * 60 * 1000,
  });

  const top5 = (data?.goldenPrompts || [])
    .filter(p => p.mentionCount > 0)
    .slice(0, 5);

  return (
    <section id="top-mentioned-prompts" className="glass-bento p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
            <MessageSquareQuote className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">이번 주 언급된 질문 TOP 5</h2>
            <p className="text-[11px] text-slate-400 font-semibold">
              환자가 이렇게 물으면, AI가 우리를 말합니다 (최근 7일)
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/responses?filter=mentioned"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:gap-2.5 transition-all"
        >
          전체 보기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-400">
          <AlertTriangle className="h-4 w-4" />
          불러오지 못했습니다
          <button onClick={() => refetch()} className="text-brand-600 font-bold hover:underline ml-1">
            다시 시도
          </button>
        </div>
      ) : top5.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500 font-medium">이번 주 아직 언급된 질문이 없습니다</p>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            언급이 없는 것도 중요한 데이터입니다 — 경쟁 병원만 나오는 질문부터 공략하세요.
          </p>
          <Link
            href="/dashboard/opportunities"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-brand-600 hover:gap-2.5 transition-all"
          >
            비어 있는 질문 보기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ol className="space-y-2">
          {top5.map((p, idx) => (
            <li
              key={`${p.promptText}-${idx}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/60 px-4 py-3"
            >
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {idx === 0 ? <Trophy className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-800 truncate" title={p.promptText}>
                  “{p.promptText}”
                </p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  {p.totalResponses}회 질문 중 {p.mentionCount}회 언급 ({p.sov}%)
                  {p.topPlatform !== 'NONE' && (
                    <> · 최다 언급 {PLATFORM_LABEL[p.topPlatform] || p.topPlatform}</>
                  )}
                </p>
              </div>
              {p.r3Rate >= 50 && (
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-black shrink-0">
                  단독추천 {Math.round(p.r3Rate)}%
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/dashboard/responses?filter=mentioned"
        className="sm:hidden inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-brand-600"
      >
        전체 보기 <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
