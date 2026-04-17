'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, XCircle, Lock, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { getPlanLimits } from '@/components/plan/PlanGate';
import Link from 'next/link';

interface PlatformDetail {
  platform: string;
  platformName: string;
  visibilityScore: number;
  totalQueries: number;
  mentionedCount: number;
  mentionRate: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    positiveRate: number;
  };
  ranking: {
    avgPosition: number | null;
    top3Count: number;
    top3Rate: number;
  };
  trend: {
    direction: 'UP' | 'DOWN' | 'STABLE';
    change: number;
  };
}

interface PlatformStatsProps {
  data: Record<string, number> | PlatformDetail[];
  planType?: string;
}

const platformColors: Record<string, string> = {
  CHATGPT: '#10a37f',
  PERPLEXITY: '#1E88E5',
  CLAUDE: '#D97706',
  GEMINI: '#8B5CF6',
};

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini',
};

export function PlatformStats({ data, planType: propPlanType }: PlatformStatsProps) {
  const { user } = useAuthStore();
  const planType = propPlanType || (user as any)?.hospital?.planType || 'FREE';
  const planLimits = getPlanLimits(planType);
  const allowedPlatforms = planLimits.platforms;

  const isDetailedData = Array.isArray(data);
  
  if (isDetailedData) {
    return <DetailedPlatformStats data={data as PlatformDetail[]} allowedPlatforms={allowedPlatforms} />;
  }
  
  const allPlatforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'];
  const scoreData = data as Record<string, number>;
  const platforms = allPlatforms.map(platform => ({
    key: platform,
    name: platformNames[platform] || platform,
    score: scoreData[platform.toLowerCase()] ?? scoreData[platform] ?? 0,
    color: platformColors[platform] || '#6B7280',
    isLocked: !allowedPlatforms.includes(platform),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-brand-100">
            <Activity className="h-4 w-4 text-brand-600" />
          </div>
          플랫폼별 가시성
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platforms.map((platform) => (
            <div key={platform.name} className={`space-y-2 relative ${platform.isLocked ? '' : ''}`}>
              {platform.isLocked && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[3px] rounded-2xl">
                  <Link href={`/dashboard/billing?plan=STANDARD`} className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1.5 rounded-full text-xs shadow-lg hover:bg-slate-700 transition-colors">
                    <Lock className="w-3 h-3" />
                    <span>Standard 업그레이드</span>
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: platform.isLocked ? '#D1D5DB' : platform.color,
                      boxShadow: `0 0 0 2px ${platform.isLocked ? '#D1D5DB40' : `${platform.color}40`}`
                    }}
                  />
                  <span className="text-sm font-medium text-slate-700">{platform.name}</span>
                </div>
                <span className="text-sm font-semibold">{platform.isLocked ? '—' : `${platform.score}점`}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: platform.isLocked ? '35%' : `${platform.score}%`,
                    backgroundColor: platform.isLocked ? '#D1D5DB' : platform.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {platforms.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">아직 데이터가 없습니다. 크롤링을 실행해주세요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailedPlatformStats({ data, allowedPlatforms }: { data: PlatformDetail[]; allowedPlatforms: string[] }) {
  const TrendIcon = ({ direction }: { direction: 'UP' | 'DOWN' | 'STABLE' }) => {
    if (direction === 'UP') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (direction === 'DOWN') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-brand-100">
            <Activity className="h-4 w-4 text-brand-600" />
          </div>
          플랫폼별 AI 가시성
        </CardTitle>
        <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">최근 30일</span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">아직 데이터가 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">크롤링을 실행해 데이터를 수집하세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((platform) => {
              const color = platformColors[platform.platform] || '#6B7280';
              const hasData = (platform as any).hasData !== false && platform.totalQueries > 0;
              const isLocked = !allowedPlatforms.includes(platform.platform);
              
              return (
                <div key={platform.platform} className={`space-y-3 relative ${!hasData ? 'opacity-60' : ''}`}>
                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[3px] rounded-2xl">
                      <Link href={`/dashboard/billing?plan=STANDARD`} className="flex items-center gap-1.5 bg-slate-800 text-white px-3 py-1.5 rounded-full text-xs shadow-lg hover:bg-slate-700 transition-colors">
                        <Lock className="w-3 h-3" />
                        <span>Standard 플랜에서 {platform.platformName} 분석 가능</span>
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-slate-800">{platform.platformName}</span>
                      {hasData && <TrendIcon direction={platform.trend.direction} />}
                      {hasData && platform.trend.change !== 0 && (
                        <span className={`text-xs font-medium ${
                          platform.trend.direction === 'UP' ? 'text-emerald-600' :
                          platform.trend.direction === 'DOWN' ? 'text-red-600' : 'text-slate-500'
                        }`}>
                          {platform.trend.change > 0 ? '+' : ''}{platform.trend.change}%
                        </span>
                      )}
                      {!hasData && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          크롤링 대기
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold" style={{ color: hasData ? color : '#D1D5DB' }}>
                        {hasData ? platform.visibilityScore : '-'}
                      </span>
                      {hasData && <span className="text-sm text-slate-400 ml-0.5">점</span>}
                    </div>
                  </div>
                  
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: hasData ? `${platform.visibilityScore}%` : '0%',
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  
                  {hasData ? (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2.5 text-center border border-slate-100/80">
                        <div className="text-slate-500 mb-1">언급률</div>
                        <div className="font-semibold text-base text-slate-800">
                          {platform.mentionRate}%
                        </div>
                        <div className="text-slate-400">
                          {platform.mentionedCount}/{platform.totalQueries}회
                        </div>
                      </div>
                      
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2.5 text-center border border-slate-100/80">
                        <div className="text-slate-500 mb-1">평균 순위</div>
                        <div className="font-semibold text-base text-slate-800">
                          {platform.ranking.avgPosition ? `${platform.ranking.avgPosition}위` : '-'}
                        </div>
                        <div className="text-slate-400">
                          TOP3 {platform.ranking.top3Rate}%
                        </div>
                      </div>
                      
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2.5 text-center border border-slate-100/80">
                        <div className="text-slate-500 mb-1">긍정률</div>
                        <div className="font-semibold text-base text-emerald-600">
                          {platform.sentiment.positiveRate}%
                        </div>
                        <div className="text-slate-400">
                          {platform.sentiment.positive}회
                        </div>
                      </div>
                      
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2.5 text-center border border-slate-100/80">
                        <div className="text-slate-500 mb-1">감성</div>
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{platform.sentiment.positive}</span>
                          <Minus className="w-3 h-3 text-slate-400 ml-1" />
                          <span>{platform.sentiment.neutral}</span>
                          <XCircle className="w-3 h-3 text-red-500 ml-1" />
                          <span>{platform.sentiment.negative}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2">
                      크롤링을 실행하면 데이터가 수집됩니다.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
