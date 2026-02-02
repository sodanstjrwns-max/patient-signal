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
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100';
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
    NAVER_CUE: '네이버 Cue',
    GOOGLE_AI_OVERVIEW: 'Google AI Overview',
  };
  return names[platform] || platform;
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    CHATGPT: '#10a37f',
    PERPLEXITY: '#1a73e8',
    CLAUDE: '#7c3aed',
    GEMINI: '#4285f4',
    NAVER_CUE: '#03c75a',
    GOOGLE_AI_OVERVIEW: '#ea4335',
  };
  return colors[platform] || '#6b7280';
}
