"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AnimatedNumber } from "@/components/motion/SignalMotion";
import { MetricValue, resolveState } from "@/components/ui/metric-value";
import { formatDecimal } from "@/lib/utils";
import { ScoreChart } from "./ScoreChart";

interface ScorePoint {
  scoreDate: string;
  overallScore: number;
  mentionCount?: number;
}

const scoreDay = (value: string) => new Date(value).toLocaleDateString("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
});

export function VisibilityHero({ history, isLoading, isError, onRetry }: {
  history?: ScorePoint[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  // The dashboard API defaults overallScore to zero before the first score exists.
  // A dated score row is required so an unmeasured hospital never displays a false zero.
  const scores = (Array.isArray(history) ? history : [])
    .filter((point) => typeof point.overallScore === "number" &&
      Number.isFinite(point.overallScore) && Number.isFinite(Date.parse(point.scoreDate)))
    .slice().sort((a, b) => Date.parse(a.scoreDate) - Date.parse(b.scoreDate));
  const latest = scores.at(-1);
  const previous = scores.at(-2);
  const state = resolveState({ isLoading, isError, hasData: !!latest });
  const ready = state === "ok" && !!latest;
  const change = ready && previous ? latest.overallScore - previous.overallScore : null;
  const Trend = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <section aria-labelledby="visibility-score-title" className="mb-6 border border-[#30343a] border-t-2 border-t-[#ff6a24] bg-[#0d0f10]">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-numeric text-[10px] tracking-[.16em] text-[#ff6a24]">AI VISIBILITY</p>
            <span className="text-[10px] text-[#959c9f]">종합 가시성 · 100점 만점</span>
          </div>
          <h1 id="visibility-score-title" className="mt-4 font-display text-[26px] tracking-[-.04em] sm:text-[32px]">AI 가시성 점수</h1>
          <div className="flex min-h-[140px] items-center sm:min-h-[184px]" aria-live="polite" aria-atomic="true">
            <MetricValue state={state} dark onRetry={onRetry} emptyLabel="첫 가시성 점수를 기다리고 있습니다" className="!rounded-none !text-[#959c9f]" skeletonWidth="w-52">
              {ready && (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 font-numeric leading-none tracking-[-.06em]">
                  <AnimatedNumber value={latest.overallScore} decimals={Number.isInteger(latest.overallScore) ? 0 : 2} className="text-[clamp(80px,21vw,112px)] text-[#d9ff43] sm:text-[140px] xl:text-[176px]" />
                  <span className="text-[24px] tracking-[-.02em] text-[#959c9f] sm:text-[30px]">/ 100</span>
                </div>
              )}
            </MetricValue>
          </div>
          <div className="flex min-h-[38px] flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#30343a] pt-4">
            {ready ? (
              <>
                <span className={`inline-flex items-center gap-1.5 font-numeric text-lg ${change !== null && change > 0 ? "text-[#d9ff43]" : change !== null && change < 0 ? "text-[#ff9565]" : "text-[#c0c4c7]"}`}>
                  <Trend className="h-5 w-5" />
                  {change === null ? "첫 점수" : `${change > 0 ? "+" : ""}${formatDecimal(change)}점`}
                </span>
                <span className="text-[11px] leading-5 text-[#959c9f]">
                  {previous ? `직전 집계(${scoreDay(previous.scoreDate)}) 대비` : "다음 집계부터 변화를 함께 보여드립니다."}
                </span>
              </>
            ) : <span className="text-xs text-[#959c9f]">{state === "loading" ? "최근 집계된 점수를 불러오는 중입니다." : state === "error" ? "다시 불러오면 최신 점수를 확인할 수 있습니다." : "첫 분석이 완료되면 점수와 변화가 표시됩니다."}</span>}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-[#959c9f]">
            {ready ? `점수 기준일 ${scoreDay(latest.scoreDate)} · 저장된 최신 집계` : "AI 답변 분석으로 집계하는 우리 병원의 가시성"}
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between border-t border-[#30343a] bg-[#111315] px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
          {ready ? (
            <ScoreChart compact data={scores} title="가시성 점수의 흐름" subtitle={`최근 ${scores.length}회 집계 · 그래프 위에서 날짜별 점수 확인`} />
          ) : (
            <div className="flex min-h-[170px] flex-col justify-center px-2">
              <p className="font-display text-xl">점수와 변화를 한눈에.</p>
              <p className="mt-3 text-xs leading-6 text-[#959c9f]">최근 가시성 점수와 흐름을 이곳에서 확인하세요.</p>
            </div>
          )}
          <Link href="/dashboard/analytics" className="mt-4 flex items-center justify-between border-t border-[#30343a] px-2 pt-4 text-xs font-semibold text-[#ff9565] hover:text-[#ff6a24]">
            AI별 분석 자세히 보기 <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
