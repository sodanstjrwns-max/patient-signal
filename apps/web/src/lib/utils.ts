import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatDecimal(num: number | null | undefined): string {
  return num == null || !Number.isFinite(num)
    ? '—'
    : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(num);
}

export function formatPercent(num: number | null | undefined): string {
  return `${formatDecimal(num)}%`;
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
    CHATGPT: '#ff6a24',
    PERPLEXITY: '#d9ff43',
    CLAUDE: '#e0e4e7',
    GEMINI: '#d77d55',
    GOOGLE_AI_OVERVIEW: '#879296',
    GROK: '#b6bdc1',
    CLOVA_X: '#ffac80',
    NAVER_AI_BRIEFING: '#959c9f',
  };
  return colors[platform] || '#959c9f';
}
