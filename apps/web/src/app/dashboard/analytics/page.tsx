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
  Shield,
  AlertTriangle,
  Zap,
  PieChart,
  Activity,
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

const intentNames: Record<string, string> = {
  reservation: '예약 의도',
  comparison: '비교 의도',
  information: '정보 탐색',
  review: '후기/리뷰',
  fear: '공포/걱정',
};

const depthNames: Record<string, string> = {
  R3: '단독 추천',
  R2: '상위 추천',
  R1: '단순 언급',
  R0: '미언급/부정',
};

const depthColors: Record<string, string> = {
  R3: 'bg-green-500',
  R2: 'bg-blue-500',
  R1: 'bg-yellow-500',
  R0: 'bg-red-400',
};

const sentimentLabel = (v: number) => {
  if (v >= 1.5) return { text: '매우 긍정', color: 'text-green-600' };
  if (v >= 0.5) return { text: '긍정', color: 'text-green-500' };
  if (v >= -0.5) return { text: '중립', color: 'text-gray-500' };
  if (v >= -1.5) return { text: '부정', color: 'text-red-500' };
  return { text: '매우 부정', color: 'text-red-600' };
};

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  // 기존 데이터
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['scoreHistory', hospitalId],
    queryFn: () => scoresApi.getHistory(hospitalId!, 30).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: platforms, isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms', hospitalId],
    queryFn: () => scoresApi.getPlatforms(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly', hospitalId],
    queryFn: () => scoresApi.getWeekly(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 초고도화 ABHS 데이터
  const { data: abhs, isLoading: abhsLoading } = useQuery({
    queryKey: ['abhs', hospitalId],
    queryFn: () => scoresApi.getABHS(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: competitiveShare, isLoading: csLoading } = useQuery({
    queryKey: ['competitiveShare', hospitalId],
    queryFn: () => scoresApi.getCompetitiveShare(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: actions, isLoading: actionsLoading } = useQuery({
    queryKey: ['actions', hospitalId],
    queryFn: () => scoresApi.getActionIntelligence(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const isLoading = historyLoading || platformsLoading || weeklyLoading || abhsLoading;

  const getTrendIcon = (change: number | undefined) => {
    if (!change) return <Minus className="h-4 w-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="ABHS 분석 리포트" description="AI-Based Hospital Score 분석" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                ABHS 분석 리포트를 확인하려면 먼저 병원 정보를 등록해주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="ABHS 분석 리포트" description="AI-Based Hospital Score · 초고도화 평가 프레임워크" />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* ========== ABHS 종합 점수 섹션 ========== */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* ABHS 종합 점수 */}
              <Card className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-100">ABHS 종합 점수</p>
                    <Shield className="h-5 w-5 text-blue-200" />
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="text-5xl font-bold">{abhs?.abhsScore ?? 0}</p>
                    <p className="text-blue-200 text-sm pb-1">/100</p>
                  </div>
                  <div className="mt-3 w-full bg-blue-500/30 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all"
                      style={{ width: `${abhs?.abhsScore ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-200 mt-2">
                    SoV × Sentiment × Depth × Weight × Intent
                  </p>
                </CardContent>
              </Card>

              {/* Voice Share */}
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 mb-1">Voice Share</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {abhs?.sovPercent ?? 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">언급 점유율</p>
                </CardContent>
              </Card>

              {/* 평균 감성 */}
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 mb-1">평균 감성</p>
                  <p className={`text-3xl font-bold ${sentimentLabel(abhs?.avgSentimentV2 ?? 0).color}`}>
                    {abhs?.avgSentimentV2 != null ? (abhs.avgSentimentV2 > 0 ? '+' : '') + abhs.avgSentimentV2.toFixed(1) : '0'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {sentimentLabel(abhs?.avgSentimentV2 ?? 0).text} (-2 ~ +2)
                  </p>
                </CardContent>
              </Card>

              {/* 경쟁 점유율 */}
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 mb-1">경쟁 점유율</p>
                  <p className="text-3xl font-bold text-indigo-600">
                    {competitiveShare?.mySharePercent ?? 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Weighted Share</p>
                </CardContent>
              </Card>
            </div>

            {/* ========== 5축 분석: 플랫폼별 기여도 + 추천 깊이 ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 플랫폼별 ABHS 기여도 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    플랫폼별 ABHS 기여도
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(abhs?.platformContributions || {}).map(([platform, data]: [string, any]) => (
                      <div key={platform} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {platformNames[platform.toUpperCase()] || platform}
                            </span>
                            <span className="text-xs text-gray-400">×{data.weight}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              SoV {data.sovPercent}%
                            </span>
                            <span className="font-semibold text-sm">
                              {Math.round(data.contribution)}점
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div
                            className="rounded-full h-3 transition-all"
                            style={{
                              width: `${Math.min(100, data.contribution)}%`,
                              backgroundColor: platformColors[platform.toUpperCase()] || '#6B7280',
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>깊이: {data.avgDepth}</span>
                          <span>{data.responseCount}개 응답</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(abhs?.platformContributions || {}).length === 0 && (
                      <p className="text-center text-gray-400 py-4">아직 데이터가 없습니다</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 추천 깊이 분포 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    추천 깊이 분포
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['R3', 'R2', 'R1', 'R0'].map((depth) => {
                      const count = abhs?.depthDistribution?.[depth] ?? 0;
                      const total = Object.values(abhs?.depthDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;
                      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={depth}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${depthColors[depth]}`} />
                              <span className="text-sm font-medium">{depth}</span>
                              <span className="text-xs text-gray-400">{depthNames[depth]}</span>
                            </div>
                            <span className="text-sm font-semibold">{count}건 ({percent}%)</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div
                              className={`${depthColors[depth]} rounded-full h-2 transition-all`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 깊이 설명 */}
                  <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                    <p><strong>R3</strong>: AI가 우리 병원만 단독 추천</p>
                    <p><strong>R2</strong>: 복수 추천 중 1~2순위</p>
                    <p><strong>R1</strong>: 단순 언급/하위 노출</p>
                    <p><strong>R0</strong>: 미언급 또는 부정 맥락</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ========== 질문 의도별 점수 ========== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  질문 의도별 AI 가시성
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {Object.entries(abhs?.intentScores || {}).map(([intent, score]: [string, any]) => {
                    const isReservation = intent === 'reservation';
                    return (
                      <div key={intent} className={`p-4 rounded-lg border ${isReservation ? 'border-blue-200 bg-blue-50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">{intentNames[intent] || intent}</span>
                          {isReservation && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">×1.5</span>}
                        </div>
                        <p className={`text-2xl font-bold ${score >= 60 ? 'text-green-600' : score >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {score}
                        </p>
                        <div className="bg-gray-200 rounded-full h-1.5 mt-2">
                          <div
                            className={`rounded-full h-1.5 transition-all ${score >= 60 ? 'bg-green-500' : score >= 30 ? 'bg-yellow-500' : 'bg-red-400'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(abhs?.intentScores || {}).length === 0 && (
                    <p className="col-span-5 text-center text-gray-400 py-4">아직 데이터가 없습니다</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ========== 자동 액션 인텔리전스 ========== */}
            {actions && actions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    자동 액션 인텔리전스
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {actions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          action.severity === 'critical' ? 'border-l-red-500 bg-red-50' :
                          action.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
                          'border-l-blue-500 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {action.severity === 'critical' ? (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                            )}
                            <p className="text-sm font-medium text-gray-900">{action.message}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            action.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {action.severity === 'critical' ? '긴급' : action.severity === 'warning' ? '주의' : '참고'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 ml-6">
                          💡 {action.suggestedAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========== 경쟁사 대비 Weighted Share ========== */}
            {competitiveShare && competitiveShare.competitorShares?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    경쟁사 대비 Weighted Competitive Share
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* 내 병원 */}
                    <div className="flex items-center gap-4">
                      <div className="w-32 text-sm font-semibold text-blue-600">우리 병원</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5">
                        <div
                          className="bg-blue-500 rounded-full h-5 flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max(5, competitiveShare.mySharePercent)}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {competitiveShare.mySharePercent}%
                          </span>
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-bold">{competitiveShare.myABHS}점</div>
                    </div>
                    {/* 경쟁사들 */}
                    {competitiveShare.competitorShares.map((cs: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="w-32 text-sm text-gray-600 truncate">{cs.name}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-5">
                          <div
                            className="bg-gray-400 rounded-full h-5 flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max(5, cs.sharePercent)}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {cs.sharePercent}%
                            </span>
                          </div>
                        </div>
                        <div className="w-16 text-right text-sm">{cs.abhsEstimate}점</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ========== 기존: 플랫폼별 점수 ========== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  플랫폼별 AI 가시성 점수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(platforms) ? (
                    platforms.map((item: any) => (
                      <div key={item.platform} className="flex items-center gap-4">
                        <div className="w-24 font-medium">
                          {item.platformName || platformNames[item.platform] || item.platform}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                          <div
                            className="rounded-full h-4 transition-all"
                            style={{
                              width: `${item.visibilityScore || 0}%`,
                              backgroundColor: platformColors[item.platform] || '#6B7280',
                            }}
                          />
                        </div>
                        <div className="w-12 text-right font-semibold">
                          {item.visibilityScore || 0}점
                        </div>
                      </div>
                    ))
                  ) : (
                    Object.entries(platforms || {}).map(([platform, score]) => (
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ========== 기존: 점수 히스토리 ========== */}
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

            {/* ========== 기존: 인사이트 ========== */}
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
