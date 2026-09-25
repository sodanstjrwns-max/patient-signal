import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-brand-700';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-brand-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  return 'bg-red-100';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return '우수';
  if (score >= 60) return '양호';
  if (score >= 40) return '보통';
  return '개선 필요';
}

export function getPlatformName(platform: string): string {
  const names: Record<string, string> = {
    CHATGPT: 'ChatGPT',
    PERPLEXITY: 'Perplexity',
    CLAUDE: 'Claude',
    GEMINI: 'Gemini',
    GOOGLE_AI_OVERVIEW: 'Google AI Overview',
    GROK: 'Grok',
    CLOVA_X: 'CLOVA X',
    NAVER_AI_BRIEFING: '네이버 AI 브리핑',
  };
  return names[platform] || platform;
}

export function getPlatformColor(platform: string): string {
  // Chart series use the Signal palette; platform names identify the source.
  const colors: Record<string, string> = {
    CHATGPT: '#ff5d2a',
    PERPLEXITY: '#b4db2f',
    CLAUDE: '#262a21',
    GEMINI: '#b83b17',
    GOOGLE_AI_OVERVIEW: '#768340',
    GROK: '#000000',      // xAI 브랜드 색상 (블랙)
    CLOVA_X: '#ffac80',
    NAVER_AI_BRIEFING: '#bec3af',
  };
  return colors[platform] || '#687253';
}
