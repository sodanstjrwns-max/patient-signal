// AI 플랫폼
export type AIPlatform = 'CHATGPT' | 'PERPLEXITY' | 'CLAUDE' | 'GEMINI' | 'NAVER_CUE' | 'GOOGLE_AI_OVERVIEW';

// 감성 레이블
export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

// 플랜 타입
export type PlanType = 'STARTER' | 'STANDARD' | 'PRO' | 'ENTERPRISE';

// 구독 상태
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

// 병원 정보
export interface Hospital {
  id: string;
  name: string;
  businessNumber?: string;
  specialtyType: string;
  subSpecialties: string[];
  regionSido: string;
  regionSigungu: string;
  regionDong?: string;
  address?: string;
  websiteUrl?: string;
  naverPlaceId?: string;
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

// 일일 점수
export interface DailyScore {
  id: string;
  hospitalId: string;
  scoreDate: string;
  overallScore: number;
  specialtyScores: Record<string, number>;
  platformScores: Record<string, number>;
  mentionCount: number;
  positiveRatio: number;
}

// AI 응답
export interface AIResponse {
  id: string;
  promptId: string;
  hospitalId: string;
  aiPlatform: AIPlatform;
  aiModelVersion?: string;
  responseText: string;
  responseDate: string;
  isMentioned: boolean;
  mentionPosition?: number;
  totalRecommendations?: number;
  sentimentScore?: number;
  sentimentLabel?: SentimentLabel;
  citedSources: string[];
  competitorsMentioned: string[];
}

// 프롬프트
export interface Prompt {
  id: string;
  hospitalId: string;
  promptText: string;
  promptType: 'PRESET' | 'CUSTOM' | 'AUTO_GENERATED';
  specialtyCategory?: string;
  regionKeywords: string[];
  isActive: boolean;
  _count?: {
    aiResponses: number;
  };
}

// 경쟁사
export interface Competitor {
  id: string;
  hospitalId: string;
  competitorName: string;
  competitorRegion?: string;
  isAutoDetected: boolean;
  isActive: boolean;
  competitorScores: {
    scoreDate: string;
    overallScore: number;
    mentionCount: number;
  }[];
}

// 대시보드 데이터
export interface DashboardData {
  hospital: Hospital;
  overallScore: number;
  specialtyScores: Record<string, number>;
  platformScores: Record<string, number>;
  scoreHistory: DailyScore[];
  stats: {
    totalPrompts: number;
    totalCompetitors: number;
    mentionRate: number;
    recentMentions: number;
  };
}

// 주간 하이라이트
export interface WeeklyHighlight {
  currentScore: number;
  scoreChange: number;
  scoreTrend: 'UP' | 'DOWN' | 'STABLE';
  newMentions: number;
  topCompetitors: { name: string; count: number }[];
  insights: string[];
}

// 플랫폼 분석
export interface PlatformAnalysis {
  platform: AIPlatform;
  totalQueries: number;
  mentionedCount: number;
  mentionRate: number;
  avgSentiment: number;
}
