/**
 * 재사용 가능한 커스텀 쿼리 훅
 * - 대시보드, 인사이트, 분석 페이지 간 동일 훅 사용으로 캐시 100% 공유
 * - enabled 조건만 다르게 설정하여 lazy loading 지원
 */

import { useQuery } from '@tanstack/react-query';
import { hospitalApi, scoresApi, crawlerApi, competitorsApi } from '@/lib/api';
import { queryKeys, STALE_TIMES } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/auth';

/** hospitalId를 auth store에서 자동으로 가져오는 헬퍼 */
export function useHospitalId() {
  const { user } = useAuthStore();
  return user?.hospitalId;
}

// ========================
// Hospital & Dashboard
// ========================

export function useHospital() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.hospital(hospitalId!),
    queryFn: () => hospitalApi.get(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.CONFIG,
  });
}

export function useDashboard() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.dashboard(hospitalId!),
    queryFn: () => hospitalApi.getDashboard(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.DASHBOARD,
  });
}

// ========================
// Scores
// ========================

export function useWeeklyScore() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.weekly(hospitalId!),
    queryFn: () => scoresApi.getWeekly(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}

export function usePlatformScores() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.platforms(hospitalId!),
    queryFn: () => scoresApi.getPlatforms(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.DASHBOARD,
  });
}

export function useScoreHistory(days = 30) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.history(hospitalId!, days),
    queryFn: () => scoresApi.getHistory(hospitalId!, days).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}

export function useABHS() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.abhs(hospitalId!),
    queryFn: () => scoresApi.getABHS(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}

export function useCompetitiveShare() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.competitiveShare(hospitalId!),
    queryFn: () => scoresApi.getCompetitiveShare(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}

export function useActionIntelligence() {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.scores.actionIntelligence(hospitalId!),
    queryFn: () => scoresApi.getActionIntelligence(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}

// ========================
// Insights (대시보드 + 인사이트 페이지 공유)
// ========================

/** 
 * 추천 멘트 분석
 * @param lazy - true면 자동 fetch 안 함 (탭 전환 시 lazy loading)
 */
export function useMentionInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.mention(hospitalId!),
    queryFn: () => crawlerApi.getMentionAnalysis(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.INSIGHTS,
    retry: 1,
  });
}

/** 트렌드 분석 */
export function useTrendInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.trend(hospitalId!),
    queryFn: () => crawlerApi.getResponseTrend(hospitalId!, 60).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.INSIGHTS,
    retry: 1,
  });
}

/** 출처 분석 */
export function useSourceInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.sources(hospitalId!),
    queryFn: () => crawlerApi.getSourceAnalysis(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.INSIGHTS,
    retry: 1,
  });
}

/** 포지셔닝 맵 */
export function usePositioningInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.positioning(hospitalId!),
    queryFn: () => crawlerApi.getPositioningMap(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.INSIGHTS,
    retry: 1,
  });
}

/** 출처 품질 */
export function useSourceQualityInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.sourceQuality(hospitalId!),
    queryFn: () => crawlerApi.getSourceQuality(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.INSIGHTS,
    retry: 1,
  });
}

/** 액션 리포트 */
export function useActionInsight(lazy = false) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.insights.actions(hospitalId!),
    queryFn: () => crawlerApi.getActionReport(hospitalId!).then(r => r.data),
    enabled: !!hospitalId && !lazy,
    staleTime: STALE_TIMES.DASHBOARD,
    retry: 1,
  });
}

// ========================
// Competitors
// ========================

export function useCompetitorComparison(enabled = true) {
  const hospitalId = useHospitalId();
  return useQuery({
    queryKey: queryKeys.competitors.comparison(hospitalId!),
    queryFn: () => competitorsApi.getComparison(hospitalId!).then(r => r.data),
    enabled: !!hospitalId && enabled,
    staleTime: STALE_TIMES.INSIGHTS,
  });
}
