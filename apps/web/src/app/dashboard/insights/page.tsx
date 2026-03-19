'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  useMentionInsight,
  useTrendInsight,
  useSourceInsight,
  usePositioningInsight,
  useSourceQualityInsight,
  useActionInsight,
  useHospitalId,
} from '@/hooks/useQueries';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  MessageSquare,
  Award,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Loader2,
  Quote,
  Zap,
  AlertCircle,
  Radar,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  Star,
  Search,
  BookOpen,
  Play,
  PenTool,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
};

const platformColors: Record<string, string> = {
  CHATGPT: 'bg-green-500',
  CLAUDE: 'bg-orange-500',
  PERPLEXITY: 'bg-blue-500',
  GEMINI: 'bg-purple-500',
};

const platformBgColors: Record<string, string> = {
  CHATGPT: 'bg-green-50 text-green-700',
  CLAUDE: 'bg-orange-50 text-orange-700',
  PERPLEXITY: 'bg-blue-50 text-blue-700',
  GEMINI: 'bg-purple-50 text-purple-700',
};

export default function InsightsPage() {
  const { user } = useAuthStore();
  const hospitalId = useHospitalId();
  const [activeTab, setActiveTab] = useState<'mention' | 'trend' | 'sources' | 'positioning' | 'sourceQuality' | 'actions' | 'contentGap'>('mention');
  const queryClient = useQueryClient();

  // 【캐싱 통합 완료】공유 훅 사용 → 대시보드에서 프리페치된 데이터 자동 활용
  // lazy 파라미터로 비활성 탭은 fetch 안 함 (이미 캐시 있으면 즉시 표시)
  const { data: mentionData, isLoading: mentionLoading, error: mentionError } = useMentionInsight(activeTab !== 'mention');
  const { data: trendData, isLoading: trendLoading, error: trendError } = useTrendInsight(activeTab !== 'trend');
  const { data: sourceData, isLoading: sourceLoading, error: sourceError } = useSourceInsight(activeTab !== 'sources');
  const { data: positionData, isLoading: positionLoading, error: positionError } = usePositioningInsight(activeTab !== 'positioning');
  const { data: sourceQualityData, isLoading: sourceQualityLoading, error: sourceQualityError } = useSourceQualityInsight(activeTab !== 'sourceQuality');
  const { data: actionData, isLoading: actionLoading, error: actionError } = useActionInsight(activeTab !== 'actions');

  // 콘텐츠 갭 분석 (POST - mutation) + 에러 핸들링
  const { data: contentGapData, isPending: contentGapLoading, error: contentGapError, mutate: runContentGap } = useMutation({
    mutationFn: () => crawlerApi.analyzeContentGap(hospitalId!).then(r => r.data),
    mutationKey: ['content-gap', hospitalId],
  });

  // 현재 활성 탭의 에러 상태
  const currentError = (
    (activeTab === 'mention' && mentionError) ||
    (activeTab === 'trend' && trendError) ||
    (activeTab === 'sources' && sourceError) ||
    (activeTab === 'positioning' && positionError) ||
    (activeTab === 'sourceQuality' && sourceQualityError) ||
    (activeTab === 'actions' && actionError)
  ) as any;

  // 현재 활성 탭의 로딩 상태만 확인
  const isLoading = (
    (activeTab === 'mention' && mentionLoading) ||
    (activeTab === 'trend' && trendLoading) ||
    (activeTab === 'sources' && sourceLoading) ||
    (activeTab === 'positioning' && positionLoading) ||
    (activeTab === 'sourceQuality' && sourceQualityLoading) ||
    (activeTab === 'actions' && actionLoading)
  );

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="AI 인사이트" description="AI가 우리 병원을 어떻게 보는지 분석합니다" />
        <div className="p-6 text-center text-gray-500">병원 등록이 필요합니다</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="AI 인사이트" description="AI가 우리 병원을 어떻게 추천하는지 심층 분석" />

      <div className="p-4 sm:p-6 space-y-6">
        {/* 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'actions', icon: FileText, label: '액션 리포트' },
            { key: 'contentGap', icon: Search, label: '콘텐츠 갭' },
            { key: 'mention', icon: Quote, label: '추천 멘트' },
            { key: 'positioning', icon: Radar, label: '포지셔닝 맵' },
            { key: 'trend', icon: TrendingUp, label: '트렌드' },
            { key: 'sources', icon: Globe, label: '출처 분석' },
            { key: 'sourceQuality', icon: Shield, label: '출처 품질' },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-shrink-0"
            >
              <tab.icon className="h-4 w-4 mr-1.5" />
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : currentError ? (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-6 sm:p-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-red-800 mb-1">
                분석 데이터를 불러오지 못했습니다
              </h3>
              <p className="text-sm text-red-600 mb-4">
                {currentError?.code === 'ECONNABORTED' 
                  ? '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
                  : currentError?.response?.status === 500
                  ? '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                  : '네트워크 오류가 발생했습니다.'}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                다시 시도
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTab === 'actions' && actionData && <ActionReport data={actionData} />}
            {activeTab === 'contentGap' && (
              <ContentGapAnalysis
                data={contentGapData}
                isLoading={contentGapLoading}
                error={contentGapError}
                onRun={() => runContentGap()}
                hospitalId={hospitalId!}
              />
            )}
            {activeTab === 'mention' && mentionData && <MentionAnalysis data={mentionData} />}
            {activeTab === 'positioning' && positionData && <PositioningMap data={positionData} />}
            {activeTab === 'trend' && trendData && <TrendAnalysis data={trendData} />}
            {activeTab === 'sources' && sourceData && <SourceAnalysis data={sourceData} />}
            {activeTab === 'sourceQuality' && sourceQualityData && <SourceQuality data={sourceQualityData} />}
          </>
        )}
      </div>
    </div>
  );
}

// ==================== 1. 추천 멘트 분석 ====================
function MentionAnalysis({ data }: { data: any }) {
  const ctx = data.recommendationContext || {};
  const totalMentioned = ctx.primaryRecommend + ctx.listRecommend + ctx.conditionalRecommend;
  const conf = data.confidenceSummary;

  return (
    <div className="space-y-6">
      {/* 신뢰도 경고 배너 */}
      {conf && conf.lowConfidenceCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                신뢰도 알림: {conf.lowConfidenceCount}개 응답이 저신뢰 (40% 미만)
              </p>
              <p className="text-xs text-amber-600 mt-1">
                평균 신뢰도 {Math.round((conf.avgConfidence || 0) * 100)}% · 
                고신뢰(≥70%) {conf.highConfidenceCount}개 / 전체 {conf.totalWithConfidence}개 · 
                AI 응답의 불확실성이 높은 항목은 직접 확인을 권장합니다
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium">전체 응답</p>
            <p className="text-2xl font-bold text-blue-800">{data.totalResponses}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">언급된 응답</p>
            <p className="text-2xl font-bold text-green-800">{data.mentionedResponses}</p>
            <p className="text-xs text-green-600">
              {data.totalResponses > 0 ? Math.round((data.mentionedResponses / data.totalResponses) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-medium">1순위 추천</p>
            <p className="text-2xl font-bold text-amber-800">{ctx.primaryRecommend || 0}</p>
            <p className="text-xs text-amber-600">
              {totalMentioned > 0 ? Math.round(((ctx.primaryRecommend || 0) / totalMentioned) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium">조건부 추천</p>
            <p className="text-2xl font-bold text-purple-800">{ctx.conditionalRecommend || 0}</p>
            <p className="text-xs text-purple-600">
              {totalMentioned > 0 ? Math.round(((ctx.conditionalRecommend || 0) / totalMentioned) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 추천 키워드 분석 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            AI가 우리 병원을 추천할 때 강조하는 포인트
          </h3>
          <p className="text-xs text-gray-500 mb-4">AI 응답에서 우리 병원 언급 주변의 키워드를 분석합니다</p>
          {data.recommendationKeywords?.length > 0 ? (
            <div className="space-y-3">
              {data.recommendationKeywords.map((kw: any, i: number) => {
                const maxCount = data.recommendationKeywords[0].count;
                const percentage = maxCount > 0 ? Math.round((kw.count / maxCount) * 100) : 0;
                return (
                  <div key={kw.keyword} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">{kw.keyword}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-blue-400' : 'bg-blue-300'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        {kw.count}회
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">아직 충분한 데이터가 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 플랫폼별 추천 방식 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            플랫폼별 추천 패턴
          </h3>
          <p className="text-xs text-gray-500 mb-4">각 AI 플랫폼이 우리 병원을 어떤 방식으로 추천하는지</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(data.platformContext || {}).map(([platform, stats]: [string, any]) => {
              const mentioned = stats.primary + stats.list + stats.conditional;
              return (
                <div key={platform} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${platformColors[platform]}`} />
                    <span className="font-medium text-gray-900">{platformNames[platform]}</span>
                    <span className="text-xs text-gray-400 ml-auto">{stats.total}건</span>
                  </div>
                  {mentioned > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-600 flex items-center gap-1">
                          <Award className="h-3 w-3" /> 1순위 추천
                        </span>
                        <span className="font-bold">{stats.primary}건</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600">목록 나열</span>
                        <span className="font-bold">{stats.list}건</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-600">조건부 추천</span>
                        <span className="font-bold">{stats.conditional}건</span>
                      </div>
                      <div className="flex justify-between text-xs border-t pt-2">
                        <span className="text-gray-500">언급 안됨</span>
                        <span className="text-gray-400">{stats.notMentioned}건</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">아직 언급된 적 없음</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 경쟁사 차별화 */}
      {data.competitorComparison?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              경쟁사 대비 차별화 포인트
            </h3>
            <p className="text-xs text-gray-500 mb-4">AI가 경쟁사를 추천할 때 강조하는 포인트 vs 우리</p>
            <div className="space-y-3">
              {/* 우리 병원 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">
                  🏥 {data.hospitalName} (우리)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.ourStrengthProfile || {})
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 5)
                    .map(([attr, count]: any) => (
                      <span key={attr} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {attr} ({count})
                      </span>
                    ))}
                  {Object.keys(data.ourStrengthProfile || {}).length === 0 && (
                    <span className="text-xs text-blue-400">데이터 수집 중...</span>
                  )}
                </div>
              </div>
              {/* 경쟁사 */}
              {data.competitorComparison.map((comp: any) => (
                <div key={comp.name} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">{comp.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {comp.topAttributes?.map((attr: any) => (
                      <span key={attr.keyword} className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                        {attr.keyword} ({attr.count})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 추천 멘트 샘플 */}
      {data.sampleMentions?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Quote className="h-5 w-5 text-green-600" />
              AI의 실제 추천 문구
            </h3>
            <p className="text-xs text-gray-500 mb-4">AI가 실제로 우리 병원을 언급한 원문 발췌</p>
            <div className="space-y-4">
              {data.sampleMentions.map((mention: any, i: number) => (
                <div key={i} className="border-l-4 border-l-green-400 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${platformBgColors[mention.platform]}`}>
                      {platformNames[mention.platform]}
                    </span>
                    {mention.position && (
                      <span className="text-xs text-amber-600 font-medium">{mention.position}위</span>
                    )}
                    {mention.sentiment && (
                      <span className={`text-xs ${
                        mention.sentiment === 'POSITIVE' ? 'text-green-600' :
                        mention.sentiment === 'NEGATIVE' ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {mention.sentiment === 'POSITIVE' ? '😊 긍정' : mention.sentiment === 'NEGATIVE' ? '😟 부정' : '😐 중립'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Q: {mention.question}</p>
                  <p className="text-sm text-gray-700 italic leading-relaxed">
                    "{mention.excerpt}"
                  </p>
                  {mention.confidenceScore != null && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        mention.confidenceScore >= 0.7 ? 'bg-green-100 text-green-700' :
                        mention.confidenceScore >= 0.4 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        신뢰도 {Math.round(mention.confidenceScore * 100)}%
                      </div>
                      {mention.isLowConfidence && (
                        <span className="text-xs text-red-500 flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" />
                          검증 필요
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 2. 트렌드 분석 ====================
function TrendAnalysis({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium">전체 응답 (60일)</p>
            <p className="text-2xl font-bold text-blue-800">{data.summary?.totalResponses || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">총 언급</p>
            <p className="text-2xl font-bold text-green-800">{data.summary?.totalMentions || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-medium">언급률</p>
            <p className="text-2xl font-bold text-amber-800">{data.summary?.overallMentionRate || 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">분석 기간</p>
            <p className="text-lg font-bold text-gray-800">{data.period}</p>
          </CardContent>
        </Card>
      </div>

      {/* 플랫폼별 트렌드 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            플랫폼별 가시성 트렌드
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(data.platformTrend || {}).map(([platform, stats]: [string, any]) => (
              <div key={platform} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${platformColors[platform]}`} />
                    <span className="font-medium text-gray-900">{platformNames[platform]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {stats.trend === 'UP' && <ArrowUpRight className="h-4 w-4 text-green-600" />}
                    {stats.trend === 'DOWN' && <ArrowDownRight className="h-4 w-4 text-red-600" />}
                    {stats.trend === 'STABLE' && <Minus className="h-4 w-4 text-gray-400" />}
                    <span className={`text-xs font-medium ${
                      stats.trend === 'UP' ? 'text-green-600' :
                      stats.trend === 'DOWN' ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {stats.trend === 'UP' ? '상승' : stats.trend === 'DOWN' ? '하락' : '유지'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.mentionRate}%</p>
                    <p className="text-xs text-gray-500">언급률</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{stats.mentioned}/{stats.total}</p>
                    <p className="text-xs text-gray-400">언급/전체</p>
                  </div>
                </div>
                {/* 간단한 바 */}
                <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${platformColors[platform]}`}
                    style={{ width: `${stats.mentionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 일별 데이터 테이블 */}
      {data.dailyData?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              일별 크롤링 기록
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-gray-500">날짜</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">전체</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">언급</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">언급률</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">감성</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyData.slice(-14).reverse().map((day: any) => (
                    <tr key={day.date} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 text-gray-700">{new Date(day.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</td>
                      <td className="py-2 text-center text-gray-600">{day.total}</td>
                      <td className="py-2 text-center text-green-600 font-medium">{day.mentioned}</td>
                      <td className="py-2 text-center">
                        <span className={`font-medium ${day.mentionRate >= 50 ? 'text-green-600' : day.mentionRate >= 30 ? 'text-amber-600' : 'text-red-500'}`}>
                          {day.mentionRate}%
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-green-500 text-xs">+{day.sentiment.positive}</span>
                        {' '}
                        <span className="text-gray-400 text-xs">{day.sentiment.neutral}</span>
                        {' '}
                        {day.sentiment.negative > 0 && (
                          <span className="text-red-500 text-xs">-{day.sentiment.negative}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 3. 출처 분석 ====================
function SourceAnalysis({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium">인용된 출처</p>
            <p className="text-2xl font-bold text-blue-800">{data.totalUrls || 0}개</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">출처 포함 응답</p>
            <p className="text-2xl font-bold text-green-800">{data.totalResponsesWithSources || 0}건</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-amber-600 font-medium">분석 채널</p>
            <p className="text-2xl font-bold text-amber-800">{data.categories?.length || 0}개</p>
          </CardContent>
        </Card>
      </div>

      {/* 출처 카테고리별 분포 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            AI가 참조하는 출처 채널
          </h3>
          <p className="text-xs text-gray-500 mb-4">AI가 우리 병원 정보를 가져오는 소스 분석</p>
          {data.categories?.length > 0 ? (
            <div className="space-y-3">
              {data.categories.map((cat: any, i: number) => {
                const colors = [
                  'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500',
                  'bg-pink-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500',
                ];
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-28 flex-shrink-0 truncate">{cat.category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors[i % colors.length]}`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                        {cat.count}건 ({cat.percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">출처 데이터가 없습니다. Perplexity 응답에서 주로 수집됩니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 플랫폼별 출처 현황 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-green-600" />
            플랫폼별 출처 인용 현황
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(data.platformSources || {}).map(([platform, stats]: [string, any]) => (
              <div key={platform} className="text-center border rounded-lg p-4">
                <div className={`w-3 h-3 rounded-full ${platformColors[platform]} mx-auto mb-2`} />
                <p className="text-sm font-medium text-gray-900">{platformNames[platform]}</p>
                <p className="text-2xl font-bold text-gray-800 my-1">{stats.totalSources}</p>
                <p className="text-xs text-gray-500">
                  {stats.responsesWithSources}/{stats.total} 응답
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 미활용 채널 추천 */}
      {data.missingChannels?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              미활용 채널 — AI 참조를 늘릴 수 있는 기회!
            </h3>
            <p className="text-xs text-gray-500 mb-4">이 채널에 콘텐츠를 올리면 AI 가시성이 올라갈 수 있어요</p>
            <div className="space-y-3">
              {data.missingChannels.map((ch: any) => (
                <div key={ch.channel} className="flex items-start gap-3 bg-white rounded-lg p-4 border border-amber-100">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ch.channel}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{ch.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주요 도메인 */}
      {data.topDomains?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              인용 빈도 상위 도메인
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-gray-500">도메인</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">카테고리</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">인용 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topDomains.slice(0, 10).map((d: any) => (
                    <tr key={d.domain} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 text-gray-700 font-mono text-xs">{d.domain}</td>
                      <td className="py-2 text-center text-gray-500 text-xs">{d.category}</td>
                      <td className="py-2 text-center font-medium text-gray-800">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 4. 경쟁사 포지셔닝 맵 (레이더 차트) ====================
function PositioningMap({ data }: { data: any }) {
  const axisLabels: Record<string, string> = data.axes || {
    expertise: '전문성',
    price: '가격',
    accessibility: '접근성',
    facility: '시설/장비',
    reputation: '후기/평판',
  };
  const axisKeys = Object.keys(axisLabels);
  const axisEmojis: Record<string, string> = {
    expertise: '🎓',
    price: '💰',
    accessibility: '🚇',
    facility: '🏥',
    reputation: '⭐',
  };

  // SVG 레이더 차트 계산
  const cx = 150, cy = 150, maxR = 120;
  const angleStep = (2 * Math.PI) / axisKeys.length;
  const startAngle = -Math.PI / 2; // 12시 방향 시작

  const getPoint = (axisIdx: number, value: number) => {
    const angle = startAngle + axisIdx * angleStep;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const getPolygonPoints = (scores: Record<string, number>) => {
    return axisKeys.map((key, i) => {
      const pt = getPoint(i, scores[key] || 0);
      return `${pt.x},${pt.y}`;
    }).join(' ');
  };

  const ourScores = data.ourPosition?.scores || {};
  const competitors = data.competitors || [];

  // 경쟁사 색상
  const compColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];
  const compBgColors = ['bg-red-100 text-red-700', 'bg-orange-100 text-orange-700', 'bg-yellow-100 text-yellow-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700'];

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium">우리 병원 언급</p>
            <p className="text-2xl font-bold text-blue-800">{data.ourPosition?.totalMentions || 0}회</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 font-medium">비교 경쟁사</p>
            <p className="text-2xl font-bold text-red-800">{competitors.length}곳</p>
          </CardContent>
        </Card>
        {(() => {
          const topAxis = axisKeys.reduce((a, b) => (ourScores[a] || 0) > (ourScores[b] || 0) ? a : b, axisKeys[0]);
          return (
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <p className="text-xs text-green-600 font-medium">최강 포인트</p>
                <p className="text-lg font-bold text-green-800">{axisEmojis[topAxis]} {axisLabels[topAxis]}</p>
                <p className="text-xs text-green-600">{ourScores[topAxis] || 0}점</p>
              </CardContent>
            </Card>
          );
        })()}
        {(() => {
          const weakAxis = axisKeys.reduce((a, b) => (ourScores[a] || 0) < (ourScores[b] || 0) ? a : b, axisKeys[0]);
          return (
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-4">
                <p className="text-xs text-amber-600 font-medium">강화 필요</p>
                <p className="text-lg font-bold text-amber-800">{axisEmojis[weakAxis]} {axisLabels[weakAxis]}</p>
                <p className="text-xs text-amber-600">{ourScores[weakAxis] || 0}점</p>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* 레이더 차트 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Radar className="h-5 w-5 text-blue-600" />
            AI가 보는 시장 내 포지션 맵
          </h3>
          <p className="text-xs text-gray-500 mb-4">AI 응답에서 추출한 5개 축 기준 포지셔닝 비교</p>

          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* SVG 레이더 */}
            <div className="flex-shrink-0">
              <svg viewBox="0 0 300 300" className="w-72 h-72 sm:w-80 sm:h-80">
                {/* 배경 동심원 */}
                {[20, 40, 60, 80, 100].map(level => (
                  <polygon
                    key={level}
                    points={axisKeys.map((_, i) => {
                      const pt = getPoint(i, level);
                      return `${pt.x},${pt.y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}

                {/* 축 선 */}
                {axisKeys.map((_, i) => {
                  const pt = getPoint(i, 100);
                  return (
                    <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#d1d5db" strokeWidth="1" />
                  );
                })}

                {/* 경쟁사 폴리곤 */}
                {competitors.map((comp: any, ci: number) => (
                  <polygon
                    key={comp.name}
                    points={getPolygonPoints(comp.scores || {})}
                    fill={compColors[ci % compColors.length]}
                    fillOpacity="0.08"
                    stroke={compColors[ci % compColors.length]}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                ))}

                {/* 우리 병원 폴리곤 */}
                <polygon
                  points={getPolygonPoints(ourScores)}
                  fill="#3b82f6"
                  fillOpacity="0.2"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                />

                {/* 우리 병원 꼭짓점 */}
                {axisKeys.map((key, i) => {
                  const pt = getPoint(i, ourScores[key] || 0);
                  return (
                    <circle key={key} cx={pt.x} cy={pt.y} r="4" fill="#2563eb" stroke="white" strokeWidth="2" />
                  );
                })}

                {/* 축 라벨 */}
                {axisKeys.map((key, i) => {
                  const pt = getPoint(i, 115);
                  return (
                    <text
                      key={key}
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-medium fill-gray-700"
                      fontSize="11"
                    >
                      {axisEmojis[key]} {axisLabels[key]}
                    </text>
                  );
                })}

                {/* 점수 라벨 (20, 40, 60, 80, 100) */}
                {[20, 40, 60, 80, 100].map(level => {
                  const pt = getPoint(0, level);
                  return (
                    <text key={level} x={pt.x + 8} y={pt.y} fontSize="8" className="fill-gray-400" dominantBaseline="middle">
                      {level}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* 범례 + 수치 */}
            <div className="flex-1 space-y-3 w-full">
              {/* 우리 병원 */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-1 bg-blue-600 rounded" />
                  <span className="text-sm font-semibold text-blue-800">🏥 {data.hospitalName} (우리)</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {axisKeys.map(key => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-gray-500">{axisLabels[key]}</p>
                      <p className="text-lg font-bold text-blue-700">{ourScores[key] || 0}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 경쟁사 */}
              {competitors.map((comp: any, ci: number) => (
                <div key={comp.name} className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-1 rounded" style={{ backgroundColor: compColors[ci % compColors.length] }} />
                    <span className="text-sm font-medium text-gray-700">{comp.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{comp.mentionCount}회 언급</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {axisKeys.map(key => {
                      const compVal = comp.scores?.[key] || 0;
                      const ourVal = ourScores[key] || 0;
                      const diff = compVal - ourVal;
                      return (
                        <div key={key} className="text-center">
                          <p className="text-xs text-gray-500">{axisLabels[key]}</p>
                          <p className="text-lg font-bold" style={{ color: compColors[ci % compColors.length] }}>{compVal}</p>
                          {diff !== 0 && (
                            <p className={`text-xs ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {competitors.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">경쟁사 데이터가 없습니다. AI 응답에서 경쟁사가 언급되면 자동으로 추출됩니다.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 인사이트 */}
      {data.insights?.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              포지셔닝 인사이트
            </h3>
            <div className="space-y-3">
              {data.insights.map((insight: string, i: number) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-blue-100">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-gray-700">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5축별 상세 비교 바 차트 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            축별 상세 비교
          </h3>
          <div className="space-y-6">
            {axisKeys.map(key => {
              const ourVal = ourScores[key] || 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{axisEmojis[key]} {axisLabels[key]}</span>
                  </div>
                  {/* 우리 바 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0 truncate">{data.hospitalName}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${ourVal}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{ourVal}</span>
                    </div>
                  </div>
                  {/* 경쟁사 바 */}
                  {competitors.map((comp: any, ci: number) => {
                    const compVal = comp.scores?.[key] || 0;
                    return (
                      <div key={comp.name} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 w-20 flex-shrink-0 truncate">{comp.name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${compVal}%`, backgroundColor: compColors[ci % compColors.length] }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">{compVal}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== 5. 출처 품질 분석 ====================
function SourceQuality({ data }: { data: any }) {
  const channels = data.channels || [];

  const healthColors: Record<string, string> = {
    '우수': 'text-green-600 bg-green-50 border-green-200',
    '양호': 'text-blue-600 bg-blue-50 border-blue-200',
    '보통': 'text-amber-600 bg-amber-50 border-amber-200',
    '개선 필요': 'text-red-600 bg-red-50 border-red-200',
  };

  const weightColors: Record<string, string> = {
    '최상': 'bg-green-100 text-green-800',
    '상': 'bg-blue-100 text-blue-800',
    '중상': 'bg-cyan-100 text-cyan-800',
    '중': 'bg-amber-100 text-amber-800',
    '하': 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-6">
      {/* 건강도 점수 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={`${healthColors[data.healthLabel] || 'bg-gray-50'} border-2`}>
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium opacity-80">출처 건강도</p>
            <p className="text-3xl font-bold">{data.healthScore || 0}</p>
            <p className="text-sm font-semibold">{data.healthLabel}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-600 font-medium">평균 품질</p>
            <p className="text-3xl font-bold text-blue-800">{data.avgQuality || 0}</p>
            <p className="text-xs text-blue-600">100점 만점</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-purple-600 font-medium">활성 채널</p>
            <p className="text-3xl font-bold text-purple-800">{data.channelDiversity || 0}</p>
            <p className="text-xs text-purple-600">개 채널</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 font-medium">분석 기간</p>
            <p className="text-lg font-bold text-gray-800">{data.period}</p>
          </CardContent>
        </Card>
      </div>

      {/* 채널별 영향력 분석 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            채널별 영향력 분석
          </h3>
          <p className="text-xs text-gray-500 mb-4">각 출처 채널의 품질 점수와 AI 가시성 영향 분석</p>

          {channels.length > 0 ? (
            <div className="space-y-4">
              {channels.map((ch: any, i: number) => (
                <div key={ch.channel} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{ch.channel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${weightColors[ch.qualityWeight] || 'bg-gray-100 text-gray-600'}`}>
                        {ch.qualityWeight}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600">{ch.influenceScore}</span>
                      <span className="text-xs text-gray-400 ml-1">영향력</span>
                    </div>
                  </div>

                  {/* 지표 바 */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">품질 점수</p>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${ch.qualityScore}%` }} />
                      </div>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">{ch.qualityScore}/100</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">언급 상관도</p>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ch.mentionCorrelation}%` }} />
                      </div>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">{ch.mentionCorrelation}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">긍정 비율</p>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${ch.positiveCorrelation}%` }} />
                      </div>
                      <p className="text-xs font-medium text-gray-700 mt-0.5">{ch.positiveCorrelation}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>인용 {ch.citedCount}건</span>
                    <span>{ch.qualityDescription}</span>
                    <div className="flex gap-1">
                      {ch.platforms?.map((p: string) => (
                        <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${platformBgColors[p] || 'bg-gray-100 text-gray-600'}`}>
                          {platformNames[p] || p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">출처 데이터가 아직 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 우선순위 추천 */}
      {data.recommendations?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              출처 강화 추천 (우선순위 순)
            </h3>
            <p className="text-xs text-gray-500 mb-4">AI 가시성을 높이기 위해 집중해야 할 채널</p>
            <div className="space-y-3">
              {data.recommendations.map((rec: any, i: number) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{rec.priority}</span>
                    <span className="text-sm font-semibold text-gray-900">{rec.channel}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{rec.action}</p>
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {rec.expectedImpact}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 6. 자동 액션 리포트 ====================
function ActionReport({ data }: { data: any }) {
  const summary = data.summary || {};
  const actions = data.actions || [];
  const weeklyGoals = data.weeklyGoals || [];

  const priorityStyles: Record<number, string> = {
    1: 'border-l-red-500 bg-red-50/50',
    2: 'border-l-orange-500 bg-orange-50/50',
    3: 'border-l-amber-500 bg-amber-50/50',
    4: 'border-l-blue-500 bg-blue-50/50',
    5: 'border-l-gray-400 bg-gray-50/50',
  };

  const categoryIcons: Record<string, string> = {
    '플랫폼 공략': '🎯',
    '콘텐츠 갭': '📝',
    '출처 강화': '🔗',
    '경쟁사 대응': '⚔️',
    '감성 관리': '💬',
  };

  return (
    <div className="space-y-6">
      {/* 리포트 헤더 */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                주간 액션 리포트
              </h2>
              <p className="text-sm text-slate-300 mt-1">{data.hospitalName} · {data.period}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">생성 시각</p>
              <p className="text-sm text-slate-200">
                {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('ko-KR', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : '-'}
              </p>
            </div>
          </div>

          {/* 핵심 수치 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">전체 언급률</p>
              <p className="text-2xl font-bold">{summary.overallMentionRate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">최강 플랫폼</p>
              <p className="text-lg font-bold">{summary.strongestPlatform?.name || '-'}</p>
              <p className="text-xs text-green-400">{summary.strongestPlatform?.rate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">최약 플랫폼</p>
              <p className="text-lg font-bold">{summary.weakestPlatform?.name || '-'}</p>
              <p className="text-xs text-red-400">{summary.weakestPlatform?.rate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">콘텐츠 갭</p>
              <p className="text-2xl font-bold">{summary.contentGapCount || 0}건</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이번 주 목표 */}
      {weeklyGoals.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              이번 주 목표
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {weeklyGoals.map((goal: string, i: number) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-blue-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{goal}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 액션 아이템 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            실행 과제 ({actions.length}개)
          </h3>
          <p className="text-xs text-gray-500 mb-4">우선순위 순으로 정렬된 이번 주 실행 과제</p>

          {actions.length > 0 ? (
            <div className="space-y-4">
              {actions.map((action: any, i: number) => (
                <div
                  key={i}
                  className={`border-l-4 rounded-lg p-4 ${priorityStyles[action.priority] || 'border-l-gray-300 bg-gray-50/50'}`}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-lg">{categoryIcons[action.category] || '📋'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white border text-gray-600 font-medium">
                      {action.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {action.deadline}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">{action.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    예상 효과: {action.expectedImpact}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">현재 긴급 액션 아이템이 없습니다!</p>
              <p className="text-sm text-gray-400 mt-1">AI 가시성이 잘 관리되고 있어요 👏</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경쟁사 알림 */}
      {summary.topCompetitor && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              경쟁사 알림
            </h3>
            <p className="text-sm text-gray-700">
              <span className="font-bold text-red-700">{summary.topCompetitor.name}</span>이(가)
              최근 30일간 <span className="font-bold">{summary.topCompetitor.count}회</span> AI에서 언급되었습니다.
              {summary.topCompetitor.count > (summary.mentionedCount || 0) && (
                <span className="text-red-600 font-medium">
                  {' '}— 우리({summary.mentionedCount}회)보다 많습니다! 대응이 필요합니다.
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 7. 콘텐츠 갭 분석 ====================
function ContentGapAnalysis({ data, isLoading, error, onRun, hospitalId }: { data: any; isLoading: boolean; error: Error | null; onRun: () => void; hospitalId: string }) {
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(new Set());
  const [blogDrafts, setBlogDrafts] = useState<Record<string, any>>({});
  const [generatingDrafts, setGeneratingDrafts] = useState<Set<string>>(new Set());
  const [viewingDraft, setViewingDraft] = useState<string | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedGaps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleGenerateBlogDraft = async (gapId: string) => {
    if (generatingDrafts.has(gapId)) return;
    setGeneratingDrafts(prev => new Set(prev).add(gapId));
    try {
      const res = await crawlerApi.generateBlogDraft(hospitalId, gapId);
      setBlogDrafts(prev => ({ ...prev, [gapId]: res.data.draft }));
      setViewingDraft(gapId);
    } catch (err: any) {
      console.error('블로그 초안 생성 실패:', err);
    } finally {
      setGeneratingDrafts(prev => {
        const next = new Set(prev);
        next.delete(gapId);
        return next;
      });
    }
  };

  const gaps = data?.gaps || [];
  const totalGaps = data?.totalGaps || 0;

  const priorityColor = (score: number) => {
    if (score >= 100) return { bg: 'bg-red-50', border: 'border-red-400', badge: 'bg-red-100 text-red-700', label: '긴급' };
    if (score >= 75) return { bg: 'bg-orange-50', border: 'border-orange-400', badge: 'bg-orange-100 text-orange-700', label: '높음' };
    if (score >= 50) return { bg: 'bg-yellow-50', border: 'border-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: '보통' };
    return { bg: 'bg-blue-50', border: 'border-blue-400', badge: 'bg-blue-100 text-blue-700', label: '낮음' };
  };

  const strategyIcon = (priority: string) => {
    if (priority === 'high') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (priority === 'medium') return <PenTool className="h-4 w-4 text-amber-500" />;
    return <BookOpen className="h-4 w-4 text-blue-500" />;
  };

  const strategyBorder = (priority: string) => {
    if (priority === 'high') return 'border-l-red-400 bg-red-50/40';
    if (priority === 'medium') return 'border-l-amber-400 bg-amber-50/40';
    return 'border-l-blue-400 bg-blue-50/40';
  };

  // 에러 상태
  if (error && !data && !isLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">분석 중 오류가 발생했습니다</h3>
            <p className="text-sm text-gray-600 mb-4">
              {(error as any)?.response?.data?.message || error.message || '콘텐츠 갭 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'}
            </p>
            <Button onClick={onRun} className="bg-red-600 hover:bg-red-700 text-white">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
            <p className="text-[10px] text-gray-400 mt-3">
              AI API 할당량 초과 또는 네트워크 문제일 수 있습니다
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 아직 분석을 안 한 경우
  if (!data && !isLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">콘텐츠 갭 분석</h3>
            <p className="text-sm text-gray-600 mb-1">
              AI가 경쟁사는 추천하면서 <span className="font-bold text-red-600">우리 병원은 추천하지 않는 질문</span>을 찾아냅니다.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              각 갭에 대해 GPT가 자동으로 <span className="font-semibold">콘텐츠 제작 전략 3가지</span>를 생성합니다.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 max-w-md mx-auto">
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <Search className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                <p className="text-xs font-medium text-gray-700">갭 탐지</p>
                <p className="text-[10px] text-gray-400">4개 AI 플랫폼</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xs font-medium text-gray-700">AI 전략 생성</p>
                <p className="text-[10px] text-gray-400">GPT-4o 기반</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <Target className="h-5 w-5 text-red-500 mx-auto mb-1" />
                <p className="text-xs font-medium text-gray-700">우선순위 분류</p>
                <p className="text-[10px] text-gray-400">긴급→낮음</p>
              </div>
            </div>

            <Button
              onClick={onRun}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg shadow-indigo-200"
            >
              <Play className="h-4 w-4 mr-2" />
              콘텐츠 갭 분석 시작
            </Button>
            <p className="text-[10px] text-gray-400 mt-3">PRO 플랜 전용 기능 · 분석에 약 30초 소요</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-indigo-200">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">콘텐츠 갭 분석 중...</h3>
            <p className="text-sm text-gray-500">4개 AI 플랫폼의 응답을 비교하고 AI 전략을 생성하고 있습니다</p>
            <div className="flex justify-center gap-6 mt-6">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1 animate-pulse">
                  <span className="text-sm">🔍</span>
                </div>
                <p className="text-[10px] text-gray-500">갭 탐지</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-1 animate-pulse" style={{ animationDelay: '0.3s' }}>
                  <span className="text-sm">🤖</span>
                </div>
                <p className="text-[10px] text-gray-500">AI 분석</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1 animate-pulse" style={{ animationDelay: '0.6s' }}>
                  <span className="text-sm">📋</span>
                </div>
                <p className="text-[10px] text-gray-500">전략 생성</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 결과
  const urgentCount = gaps.filter((g: any) => g.priorityScore >= 100).length;
  const highCount = gaps.filter((g: any) => g.priorityScore >= 75 && g.priorityScore < 100).length;

  return (
    <div className="space-y-6">
      {/* 요약 헤더 */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-400" />
                콘텐츠 갭 분석 결과
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                AI가 경쟁사만 추천하고 우리를 추천하지 않는 주제
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRun}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              재분석
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">발견된 갭</p>
              <p className="text-2xl font-bold">{totalGaps}건</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">🔴 긴급 대응</p>
              <p className="text-2xl font-bold text-red-400">{urgentCount}건</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">🟠 높은 우선순위</p>
              <p className="text-2xl font-bold text-orange-400">{highCount}건</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300">AI 전략</p>
              <p className="text-2xl font-bold text-indigo-400">{gaps.filter((g: any) => g.aiGuide).length}건</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 갭이 없는 경우 */}
      {totalGaps === 0 && (
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">콘텐츠 갭이 없습니다! 🎉</h3>
            <p className="text-sm text-gray-600">
              경쟁사가 추천받는 모든 질문에서 우리 병원도 함께 언급되고 있습니다.
            </p>
            <p className="text-xs text-gray-400 mt-2">현재 AI 가시성이 매우 우수한 상태입니다</p>
          </CardContent>
        </Card>
      )}

      {/* 갭 목록 */}
      {gaps.sort((a: any, b: any) => b.priorityScore - a.priorityScore).map((gap: any, index: number) => {
        const pStyle = priorityColor(gap.priorityScore);
        const isExpanded = expandedGaps.has(index);
        let aiGuide: any = null;
        try {
          aiGuide = typeof gap.aiGuide === 'string' ? JSON.parse(gap.aiGuide) : gap.aiGuide;
        } catch { aiGuide = null; }

        return (
          <Card key={gap.id || index} className={`${pStyle.bg} border ${pStyle.border}`}>
            <CardContent className="p-0">
              {/* 갭 헤더 - 클릭으로 펼치기/접기 */}
              <button
                onClick={() => toggleExpand(index)}
                className="w-full p-5 text-left hover:bg-black/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${pStyle.badge}`}>
                        {pStyle.label} · {gap.priorityScore}점
                      </span>
                      {gap.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {gap.category}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-gray-900 mb-2">
                      "{gap.promptText}"
                    </h4>

                    {/* 경쟁사 + 플랫폼 미리보기 */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">경쟁사:</span>
                        {(gap.competitors || []).slice(0, 3).map((c: string, ci: number) => (
                          <span key={ci} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                        {(gap.competitors || []).length > 3 && (
                          <span className="text-xs text-gray-400">+{gap.competitors.length - 3}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">플랫폼:</span>
                        {(gap.platforms || []).map((p: string, pi: number) => (
                          <span key={pi} className={`text-xs px-1.5 py-0.5 rounded ${platformBgColors[p] || 'bg-gray-100 text-gray-700'}`}>
                            {platformNames[p] || p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 pt-1">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* 펼쳐진 상세 - AI 전략 가이드 */}
              {isExpanded && (
                <div className="border-t border-gray-200/60 px-5 pb-5">
                  {aiGuide?.strategies && aiGuide.strategies.length > 0 ? (
                    <div className="mt-4">
                      <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-indigo-600" />
                        AI 추천 콘텐츠 전략
                      </h5>
                      <div className="space-y-3">
                        {aiGuide.strategies.map((strategy: any, si: number) => (
                          <div key={si} className={`border-l-4 rounded-lg p-4 ${strategyBorder(strategy.priority)}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {strategyIcon(strategy.priority)}
                              <span className="text-sm font-bold text-gray-900">{strategy.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto ${
                                strategy.priority === 'high' ? 'bg-red-100 text-red-600' :
                                strategy.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {strategy.priority === 'high' ? '높음' : strategy.priority === 'medium' ? '보통' : '낮음'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{strategy.description}</p>
                            {strategy.expectedImpact && (
                              <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                예상 효과: {strategy.expectedImpact}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-4">
                      <p className="text-sm text-gray-500">AI 전략 가이드가 생성되지 않았습니다</p>
                      <p className="text-xs text-gray-400 mt-1">OpenAI API 연결 상태를 확인해주세요</p>
                    </div>
                  )}

                  {/* 상세 정보 */}
                  <div className="mt-4 pt-3 border-t border-gray-200/40">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">노출된 경쟁사:</span>
                        <div className="mt-1 space-y-1">
                          {(gap.competitors || []).map((c: string, ci: number) => (
                            <div key={ci} className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              <span className="text-gray-700">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">우리가 빠진 AI:</span>
                        <div className="mt-1 space-y-1">
                          {(gap.platforms || []).map((p: string, pi: number) => (
                            <div key={pi} className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${platformColors[p] || 'bg-gray-400'}`} />
                              <span className="text-gray-700">{platformNames[p] || p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 블로그 초안 생성 */}
                  <div className="mt-4 pt-3 border-t border-gray-200/40">
                    {!blogDrafts[gap.id] && !generatingDrafts.has(gap.id) && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleGenerateBlogDraft(gap.id); }}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                      >
                        <PenTool className="h-4 w-4 mr-2" />
                        블로그 초안 생성 (Claude 4 Sonnet)
                      </Button>
                    )}

                    {generatingDrafts.has(gap.id) && (
                      <div className="bg-purple-50 rounded-xl p-6 text-center border border-purple-200">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
                        <p className="text-sm font-bold text-purple-800 mb-1">Claude 4 Sonnet이 블로그 초안을 작성 중...</p>
                        <p className="text-xs text-purple-500">치과 전문 SEO 최적화 글을 생성하고 있습니다 (약 15~30초)</p>
                      </div>
                    )}

                    {blogDrafts[gap.id] && (
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setViewingDraft(viewingDraft === gap.id ? null : gap.id); }}
                          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {viewingDraft === gap.id ? '블로그 초안 접기' : '블로그 초안 보기'}
                          {viewingDraft === gap.id ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                        </Button>

                        {viewingDraft === gap.id && (
                          <BlogDraftViewer draft={blogDrafts[gap.id]} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* 하단 팁 */}
      {totalGaps > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              콘텐츠 갭 해소 가이드
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <p className="font-bold text-gray-800 mb-1">1단계: 콘텐츠 발행</p>
                <p className="text-gray-500">블로그, 유튜브, 네이버 플레이스에 해당 키워드 콘텐츠를 발행하세요</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <p className="font-bold text-gray-800 mb-1">2단계: 2~4주 대기</p>
                <p className="text-gray-500">AI가 새 콘텐츠를 학습하는 데 보통 2~4주가 소요됩니다</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-indigo-100">
                <p className="font-bold text-gray-800 mb-1">3단계: 재분석</p>
                <p className="text-gray-500">콘텐츠 발행 후 재분석을 돌려서 갭이 해소되었는지 확인하세요</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== 8. 블로그 초안 뷰어 ====================
function BlogDraftViewer({ draft }: { draft: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const fullText = `${draft.title}\n\n${draft.metaDescription}\n\n${draft.content}\n\n키워드: ${(draft.seoKeywords || []).join(', ')}\n\n${(draft.hashtags || []).join(' ')}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-200 mb-1 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Claude 4 Sonnet 생성 · {draft.estimatedReadTime || '3분'} 읽기
            </p>
            <h3 className="text-lg font-bold">{draft.title}</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-white/30 text-white hover:bg-white/20 flex-shrink-0"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                복사됨!
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 mr-1" />
                전체 복사
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 메타 설명 */}
      {draft.metaDescription && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-1 font-medium">📝 메타 설명 (SEO)</p>
          <p className="text-sm text-gray-700">{draft.metaDescription}</p>
        </div>
      )}

      {/* 본문 */}
      <div className="px-5 py-5">
        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
          {(draft.content || '').split('\n').map((line: string, i: number) => {
            if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-2">{line.replace('### ', '')}</h3>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-3 pb-2 border-b">{line.replace('## ', '')}</h2>;
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.replace('# ', '')}</h1>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mb-1">{line.replace(/^[-*] /, '')}</li>;
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
            if (line.trim() === '') return <div key={i} className="h-3" />;
            return <p key={i} className="text-sm text-gray-700 mb-2">{line}</p>;
          })}
        </div>
      </div>

      {/* SEO 키워드 + 해시태그 */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
        {draft.seoKeywords && draft.seoKeywords.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1.5">🔍 SEO 키워드</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.seoKeywords.map((kw: string, i: number) => (
                <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}
        {draft.hashtags && draft.hashtags.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1.5"># 해시태그</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.hashtags.map((tag: string, i: number) => (
                <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span>모델: {draft.model || 'Claude 4 Sonnet'}</span>
        <span>생성: {draft.generatedAt ? new Date(draft.generatedAt).toLocaleString('ko-KR') : '-'}</span>
      </div>
    </div>
  );
}
