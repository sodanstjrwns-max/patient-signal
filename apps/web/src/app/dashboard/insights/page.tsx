'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
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
  const hospitalId = user?.hospitalId;
  const [activeTab, setActiveTab] = useState<'mention' | 'trend' | 'sources'>('mention');

  // Phase 1 APIs
  const { data: mentionData, isLoading: mentionLoading } = useQuery({
    queryKey: ['insights-mention', hospitalId],
    queryFn: () => crawlerApi.getMentionAnalysis(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['insights-trend', hospitalId],
    queryFn: () => crawlerApi.getResponseTrend(hospitalId!, 60).then(r => r.data),
    enabled: !!hospitalId,
  });

  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['insights-sources', hospitalId],
    queryFn: () => crawlerApi.getSourceAnalysis(hospitalId!, 30).then(r => r.data),
    enabled: !!hospitalId,
  });

  const isLoading = mentionLoading || trendLoading || sourceLoading;

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
          <Button
            variant={activeTab === 'mention' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('mention')}
            className="flex-shrink-0"
          >
            <Quote className="h-4 w-4 mr-1.5" />
            추천 멘트 분석
          </Button>
          <Button
            variant={activeTab === 'trend' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('trend')}
            className="flex-shrink-0"
          >
            <TrendingUp className="h-4 w-4 mr-1.5" />
            트렌드 추적
          </Button>
          <Button
            variant={activeTab === 'sources' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('sources')}
            className="flex-shrink-0"
          >
            <Globe className="h-4 w-4 mr-1.5" />
            출처 분석
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {activeTab === 'mention' && mentionData && <MentionAnalysis data={mentionData} />}
            {activeTab === 'trend' && trendData && <TrendAnalysis data={trendData} />}
            {activeTab === 'sources' && sourceData && <SourceAnalysis data={sourceData} />}
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

  return (
    <div className="space-y-6">
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
