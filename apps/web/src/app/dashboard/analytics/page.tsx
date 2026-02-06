'use client';

import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { scoresApi, hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Award,
  Loader2,
} from 'lucide-react';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
};

const platformColors: Record<string, string> = {
  CHATGPT: '#10A37F',
  CLAUDE: '#CC785C',
  PERPLEXITY: '#3B82F6',
  GEMINI: '#8B5CF6',
};

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  // 점수 히스토리
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['scoreHistory', hospitalId],
    queryFn: () => scoresApi.getHistory(hospitalId!, 30).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 플랫폼별 점수
  const { data: platforms, isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms', hospitalId],
    queryFn: () => scoresApi.getPlatforms(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 진료과목별 점수
  const { data: specialties, isLoading: specialtiesLoading } = useQuery({
    queryKey: ['specialties', hospitalId],
    queryFn: () => scoresApi.getSpecialties(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 주간 데이터
  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly', hospitalId],
    queryFn: () => scoresApi.getWeekly(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const isLoading = historyLoading || platformsLoading || specialtiesLoading || weeklyLoading;

  const getTrendIcon = (change: number | undefined) => {
    if (!change) return <Minus className="h-4 w-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="분석 리포트" description="AI 가시성 분석 리포트를 확인합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                분석 리포트를 확인하려면 먼저 병원 정보를 등록해주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="분석 리포트" description="AI 가시성 분석 리포트" />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* 주간 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">이번 주 점수</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {weekly?.currentScore || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(weekly?.scoreChange)}
                      <span className={`text-sm font-medium ${
                        (weekly?.scoreChange || 0) > 0 ? 'text-green-600' : 
                        (weekly?.scoreChange || 0) < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {weekly?.scoreChange ? `${weekly.scoreChange > 0 ? '+' : ''}${weekly.scoreChange}` : '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">주간 언급 횟수</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {weekly?.newMentions || 0}
                      </p>
                    </div>
                    <Award className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">긍정적 언급</p>
                      <p className="text-3xl font-bold text-green-600">
                        {weekly?.positiveMentions || 0}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">부정적 언급</p>
                      <p className="text-3xl font-bold text-red-600">
                        {weekly?.negativeMentions || 0}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 플랫폼별 점수 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  플랫폼별 AI 가시성 점수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(platforms || {}).map(([platform, score]) => (
                    <div key={platform} className="flex items-center gap-4">
                      <div className="w-24 font-medium">
                        {platformNames[platform] || platform}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4">
                        <div
                          className="rounded-full h-4 transition-all"
                          style={{
                            width: `${score as number}%`,
                            backgroundColor: platformColors[platform] || '#6B7280',
                          }}
                        />
                      </div>
                      <div className="w-12 text-right font-semibold">
                        {score as number}점
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 점수 히스토리 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  최근 30일 점수 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history?.length > 0 ? (
                  <div className="h-64">
                    <div className="flex items-end justify-between h-full gap-1">
                      {history.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${item.overallScore}%` }}
                          title={`${item.scoreDate}: ${item.overallScore}점`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>30일 전</span>
                      <span>오늘</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <p>아직 데이터가 없습니다. 크롤링을 실행해주세요.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 인사이트 */}
            {weekly?.insights?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>💡 이번 주 인사이트</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {weekly.insights.map((insight: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span className="text-gray-600">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
