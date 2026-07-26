'use client';

/**
 * MetricValue — "모르는 것"과 "0인 것"을 구분해서 표시하는 숫자 컴포넌트
 *
 * 배경:
 *   기존 대시보드는 `abhs?.sovPercent ?? 0` 처럼 옵셔널 체이닝 + `?? 0` 으로
 *   값을 꺼냈다. 그래서 API가 타임아웃/에러로 실패해도 화면에는 깔끔한 "0%"가
 *   찍혔다. 원장이 보기엔 "우리 병원이 AI에서 0% 노출된다"로 읽힌다.
 *   실제로는 그냥 서버 응답을 못 받은 것뿐인데도.
 *
 *   숫자를 다루는 제품에서 이건 오답보다 나쁘다. 오답은 의심이라도 하지만
 *   "0"은 확신을 주기 때문이다.
 *
 * 규칙:
 *   loading → 스켈레톤
 *   error   → "불러오지 못함" + 재시도
 *   empty   → "아직 데이터 없음" (수집 전)
 *   ok      → 실제 값
 */

import { AlertCircle, RotateCw } from 'lucide-react';

export type MetricState = 'loading' | 'error' | 'empty' | 'ok';

/** 쿼리 결과 + 데이터 유무로 상태를 판정 */
export function resolveState(opts: {
  isLoading?: boolean;
  isError?: boolean;
  hasData?: boolean;
}): MetricState {
  if (opts.isLoading) return 'loading';
  if (opts.isError) return 'error';
  if (opts.hasData === false) return 'empty';
  return 'ok';
}

interface MetricValueProps {
  state: MetricState;
  /** state === 'ok' 일 때 렌더할 실제 값 */
  children: React.ReactNode;
  /** 스켈레톤 폭 (tailwind class) */
  skeletonWidth?: string;
  /** 다크 배경 위에 올릴 때 true */
  dark?: boolean;
  /** 에러 시 재시도 핸들러 */
  onRetry?: () => void;
  /** 데이터 없음일 때 문구 */
  emptyLabel?: string;
  className?: string;
}

export function MetricValue({
  state,
  children,
  skeletonWidth = 'w-24',
  dark = false,
  onRetry,
  emptyLabel = '아직 데이터 없음',
  className = '',
}: MetricValueProps) {
  if (state === 'ok') return <>{children}</>;

  if (state === 'loading') {
    return (
      <span
        className={`inline-block h-[1em] ${skeletonWidth} rounded-lg animate-pulse align-middle ${
          dark ? 'bg-white/10' : 'bg-slate-200/70'
        } ${className}`}
        aria-label="불러오는 중"
      />
    );
  }

  if (state === 'error') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
          dark ? 'text-amber-300' : 'text-amber-600'
        } ${className}`}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>불러오지 못함</span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRetry();
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs transition-colors ${
              dark
                ? 'bg-white/10 hover:bg-white/20 text-white/80'
                : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
            }`}
          >
            <RotateCw className="h-3 w-3" />
            다시
          </button>
        )}
      </span>
    );
  }

  // empty
  return (
    <span
      className={`text-sm font-medium ${dark ? 'text-white/35' : 'text-slate-400'} ${className}`}
    >
      {emptyLabel}
    </span>
  );
}
