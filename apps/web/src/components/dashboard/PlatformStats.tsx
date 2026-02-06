'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

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

export function PlatformStats({ data }: PlatformStatsProps) {
  // 상세 데이터인지 확인
  const isDetailedData = Array.isArray(data);
  
  if (isDetailedData) {
    return <DetailedPlatformStats data={data as PlatformDetail[]} />;
  }
  
  // 기존 간단한 형식 처리
  const platforms = Object.entries(data as Record<string, number>).map(([platform, score]) => ({
    name: platformNames[platform.toUpperCase()] || platform,
    score,
    color: platformColors[platform.toUpperCase()] || '#6B7280',
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">플랫폼별 가시성</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {platforms.map((platform) => (
            <div key={platform.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm font-medium">{platform.name}</span>
                </div>
                <span className="text-sm font-semibold">{platform.score}점</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${platform.score}%`,
                    backgroundColor: platform.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {platforms.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            아직 데이터가 없습니다. 크롤링을 실행해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailedPlatformStats({ data }: { data: PlatformDetail[] }) {
  const TrendIcon = ({ direction }: { direction: 'UP' | 'DOWN' | 'STABLE' }) => {
    if (direction === 'UP') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === 'DOWN') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">플랫폼별 AI 가시성</CardTitle>
        <span className="text-xs text-gray-500">최근 30일</span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">아직 데이터가 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">크롤링을 실행해 데이터를 수집하세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((platform) => {
              const color = platformColors[platform.platform] || '#6B7280';
              
              return (
                <div key={platform.platform} className="space-y-3">
                  {/* 플랫폼 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold">{platform.platformName}</span>
                      <TrendIcon direction={platform.trend.direction} />
                      {platform.trend.change !== 0 && (
                        <span className={`text-xs ${
                          platform.trend.direction === 'UP' ? 'text-green-600' :
                          platform.trend.direction === 'DOWN' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {platform.trend.change > 0 ? '+' : ''}{platform.trend.change}%
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold" style={{ color }}>
                        {platform.visibilityScore}
                      </span>
                      <span className="text-sm text-gray-500">점</span>
                    </div>
                  </div>
                  
                  {/* 가시성 바 */}
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${platform.visibilityScore}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  
                  {/* 상세 통계 */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {/* 언급률 */}
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-500 mb-1">언급률</div>
                      <div className="font-semibold text-base">
                        {platform.mentionRate}%
                      </div>
                      <div className="text-gray-400">
                        {platform.mentionedCount}/{platform.totalQueries}회
                      </div>
                    </div>
                    
                    {/* 평균 순위 */}
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-500 mb-1">평균 순위</div>
                      <div className="font-semibold text-base">
                        {platform.ranking.avgPosition ? `${platform.ranking.avgPosition}위` : '-'}
                      </div>
                      <div className="text-gray-400">
                        TOP3 {platform.ranking.top3Rate}%
                      </div>
                    </div>
                    
                    {/* 긍정 비율 */}
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-500 mb-1">긍정률</div>
                      <div className="font-semibold text-base text-green-600">
                        {platform.sentiment.positiveRate}%
                      </div>
                      <div className="text-gray-400">
                        {platform.sentiment.positive}회
                      </div>
                    </div>
                    
                    {/* 감성 분포 */}
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-500 mb-1">감성</div>
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>{platform.sentiment.positive}</span>
                        <Minus className="w-3 h-3 text-gray-400 ml-1" />
                        <span>{platform.sentiment.neutral}</span>
                        <XCircle className="w-3 h-3 text-red-500 ml-1" />
                        <span>{platform.sentiment.negative}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
