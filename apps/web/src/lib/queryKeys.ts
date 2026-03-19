/**
 * 중앙 집중 쿼리 키 관리
 * - 대시보드, 인사이트, 분석 페이지 간 캐시 공유 보장
 * - queryKey 중복/불일치 문제 근절
 */

export const queryKeys = {
  // === Hospital ===
  hospital: (hospitalId: string) => ['hospital', hospitalId] as const,
  dashboard: (hospitalId: string) => ['dashboard', hospitalId] as const,

  // === Scores ===
  scores: {
    weekly: (hospitalId: string) => ['weekly', hospitalId] as const,
    history: (hospitalId: string, days?: number) => ['scoreHistory', hospitalId, days ?? 30] as const,
    platforms: (hospitalId: string) => ['platforms', hospitalId] as const,
    specialties: (hospitalId: string) => ['specialties', hospitalId] as const,
    abhs: (hospitalId: string) => ['abhs', hospitalId] as const,
    competitiveShare: (hospitalId: string) => ['competitiveShare', hospitalId] as const,
    actionIntelligence: (hospitalId: string) => ['actions', hospitalId] as const,
  },

  // === Insights (대시보드 + 인사이트 페이지 공유) ===
  insights: {
    mention: (hospitalId: string) => ['insights-mention', hospitalId] as const,
    trend: (hospitalId: string) => ['insights-trend', hospitalId] as const,
    sources: (hospitalId: string) => ['insights-sources', hospitalId] as const,
    positioning: (hospitalId: string) => ['insights-positioning', hospitalId] as const,
    sourceQuality: (hospitalId: string) => ['insights-source-quality', hospitalId] as const,
    actions: (hospitalId: string) => ['insights-actions', hospitalId] as const,
    contentGap: (hospitalId: string) => ['content-gap', hospitalId] as const,
  },

  // === Competitors ===
  competitors: {
    list: (hospitalId: string) => ['competitors', hospitalId] as const,
    comparison: (hospitalId: string) => ['comparison', hospitalId] as const,
  },

  // === Prompts ===
  prompts: (hospitalId: string) => ['prompts', hospitalId] as const,

  // === Subscriptions ===
  subscription: () => ['subscription'] as const,
  usage: () => ['usage'] as const,
} as const;

/**
 * staleTime 상수 (밀리초)
 * - 자주 변하지 않는 데이터일수록 긴 staleTime
 */
export const STALE_TIMES = {
  /** 실시간에 가까운 데이터 (1분) */
  REALTIME: 1 * 60 * 1000,
  /** 대시보드 핵심 지표 (2분) */
  DASHBOARD: 2 * 60 * 1000,
  /** 인사이트/분석 데이터 (5분) - 자주 안 바뀜 */
  INSIGHTS: 5 * 60 * 1000,
  /** 주간 리포트/정적 데이터 (10분) */
  STATIC: 10 * 60 * 1000,
  /** 병원 기본 정보, 구독 등 (15분) */
  CONFIG: 15 * 60 * 1000,
} as const;
