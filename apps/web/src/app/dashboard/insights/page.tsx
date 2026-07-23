'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/hooks/useToast';
import {
  useMentionInsight,
  useTrendInsight,
  useSourceInsight,
  useTopUrls,
  useUrlMatrix,
  useSourceDiagnostic,
  useBreadthInsight,
  useSourceIntelSummary,
  useTopSources,
  useInstagramIntel,
  useHintKeywords,
  useNewChannels,
  useEnrichStatus,
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
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Instagram,
  Sparkles,
  Eye,
  FileSearch,
  Hash,
  MessageCircle,
  Antenna,
  ShieldAlert,
} from 'lucide-react';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GOOGLE_AI_OVERVIEW: 'Google AI',
  GROK: 'Grok',
  CLOVA_X: 'CLOVA X',
  NAVER_AI_BRIEFING: '네이버 AI 브리핑',
};

const platformColors: Record<string, string> = {
  CHATGPT: 'bg-green-500',
  CLAUDE: 'bg-orange-500',
  PERPLEXITY: 'bg-brand-500',
  GEMINI: 'bg-purple-500',
  GOOGLE_AI_OVERVIEW: 'bg-yellow-500',
  GROK: 'bg-slate-900',
  CLOVA_X: 'bg-emerald-500',
};

const platformBgColors: Record<string, string> = {
  CHATGPT: 'bg-green-50 text-green-700',
  CLAUDE: 'bg-orange-50 text-orange-700',
  PERPLEXITY: 'bg-brand-50 text-brand-700',
  GEMINI: 'bg-purple-50 text-purple-700',
  GOOGLE_AI_OVERVIEW: 'bg-yellow-50 text-yellow-700',
  GROK: 'bg-slate-900 text-white',
  CLOVA_X: 'bg-emerald-50 text-emerald-700',
};

export default function InsightsPage() {
  const { user } = useAuthStore();
  const hospitalId = useHospitalId();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['mention', 'trend', 'sources', 'topUrls', 'urlMatrix', 'breadth', 'sourceIntel', 'newChannels', 'positioning', 'sourceQuality', 'actions'] as const;
  type TabType = typeof validTabs[number];
  const initialTab: TabType = validTabs.includes(tabParam as TabType) ? (tabParam as TabType) : 'actions';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [trendCohort, setTrendCohort] = useState<'all' | 'fixed'>('all');
  const queryClient = useQueryClient();

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam as TabType)) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);

  // 【캐싱 통합 완료】공유 훅 사용 → 대시보드에서 프리페치된 데이터 자동 활용
  // lazy 파라미터로 비활성 탭은 fetch 안 함 (이미 캐시 있으면 즉시 표시)
  const { data: mentionData, isLoading: mentionLoading, error: mentionError } = useMentionInsight(activeTab !== 'mention');
  const { data: trendData, isLoading: trendLoading, error: trendError } = useTrendInsight(activeTab !== 'trend', trendCohort);
  const { data: sourceData, isLoading: sourceLoading, error: sourceError } = useSourceInsight(activeTab !== 'sources');
  const { data: diagnosticData } = useSourceDiagnostic(activeTab !== 'sources');
  const { data: topUrlsData, isLoading: topUrlsLoading, error: topUrlsError } = useTopUrls(activeTab !== 'topUrls', 100);
  const { data: urlMatrixData, isLoading: urlMatrixLoading, error: urlMatrixError } = useUrlMatrix(activeTab !== 'urlMatrix', 30);
  const { data: breadthData, isLoading: breadthLoading, error: breadthError } = useBreadthInsight(activeTab !== 'breadth');
  const { data: siSummary, isLoading: siSummaryLoading, error: siSummaryError } = useSourceIntelSummary(activeTab !== 'sourceIntel');
  const { data: siTopSources, isLoading: siTopLoading } = useTopSources(activeTab !== 'sourceIntel');
  const { data: siInstagram, isLoading: siIgLoading } = useInstagramIntel(activeTab !== 'sourceIntel');
  const { data: siHints, isLoading: siHintsLoading } = useHintKeywords(activeTab !== 'sourceIntel');
  const { data: newChannelsData, isLoading: newChannelsLoading, error: newChannelsError } = useNewChannels(activeTab !== 'newChannels');
  const { data: positionData, isLoading: positionLoading, error: positionError } = usePositioningInsight(activeTab !== 'positioning');
  const { data: sourceQualityData, isLoading: sourceQualityLoading, error: sourceQualityError } = useSourceQualityInsight(activeTab !== 'sourceQuality');
  const { data: actionData, isLoading: actionLoading, error: actionError } = useActionInsight(activeTab !== 'actions');



  // 현재 활성 탭의 에러 상태
  const currentError = (
    (activeTab === 'mention' && mentionError) ||
    (activeTab === 'trend' && trendError) ||
    (activeTab === 'sources' && sourceError) ||
    (activeTab === 'topUrls' && topUrlsError) ||
    (activeTab === 'urlMatrix' && urlMatrixError) ||
    (activeTab === 'breadth' && breadthError) ||
    (activeTab === 'sourceIntel' && siSummaryError) ||
    (activeTab === 'newChannels' && newChannelsError) ||
    (activeTab === 'positioning' && positionError) ||
    (activeTab === 'sourceQuality' && sourceQualityError) ||
    (activeTab === 'actions' && actionError)
  ) as any;

  // 현재 활성 탭의 로딩 상태만 확인
  const isLoading = (
    (activeTab === 'mention' && mentionLoading) ||
    (activeTab === 'trend' && trendLoading) ||
    (activeTab === 'sources' && sourceLoading) ||
    (activeTab === 'topUrls' && topUrlsLoading) ||
    (activeTab === 'urlMatrix' && urlMatrixLoading) ||
    (activeTab === 'breadth' && breadthLoading) ||
    (activeTab === 'sourceIntel' && siSummaryLoading && siTopLoading && siIgLoading && siHintsLoading) ||
    (activeTab === 'newChannels' && newChannelsLoading) ||
    (activeTab === 'positioning' && positionLoading) ||
    (activeTab === 'sourceQuality' && sourceQualityLoading) ||
    (activeTab === 'actions' && actionLoading)
  );

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="AI 인사이트" description="AI가 우리 병원을 어떻게 보는지 분석합니다" />
        <div className="p-6 text-center text-slate-500">병원 등록이 필요합니다</div>
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
            { key: 'mention', icon: Quote, label: '추천 멘트' },
            { key: 'positioning', icon: Radar, label: '포지셔닝 맵' },
            { key: 'trend', icon: TrendingUp, label: '트렌드' },
            { key: 'sources', icon: Globe, label: '출처 분석' },
            { key: 'topUrls', icon: ExternalLink, label: 'Top URL 랭킹' },
            { key: 'urlMatrix', icon: BarChart3, label: 'AI×URL 매트릭스' },
            { key: 'breadth', icon: Award, label: 'Breadth 리포트' },
            { key: 'sourceIntel', icon: Sparkles, label: '출처 인텔리전스' },
            { key: 'newChannels', icon: Antenna, label: '신규 인용 채널 🆕' },
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
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
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
            {activeTab === 'mention' && mentionData && <MentionAnalysis data={mentionData} />}
            {activeTab === 'positioning' && positionData && <PositioningMap data={positionData} />}
            {activeTab === 'trend' && trendData && <TrendAnalysis data={trendData} cohort={trendCohort} onCohortChange={setTrendCohort} />}
            {activeTab === 'sources' && sourceData && <SourceAnalysis data={sourceData} diagnostic={diagnosticData} />}
            {activeTab === 'topUrls' && topUrlsData && <TopUrlsRanking data={topUrlsData} />}
            {activeTab === 'urlMatrix' && urlMatrixData && <UrlMatrix data={urlMatrixData} />}
            {activeTab === 'breadth' && breadthData && <BreadthInsights data={breadthData} />}
            {activeTab === 'sourceIntel' && (
              <SourceIntelDashboard
                summary={siSummary}
                topSources={siTopSources}
                instagram={siInstagram}
                hints={siHints}
                hospitalId={hospitalId!}
              />
            )}
            {activeTab === 'newChannels' && newChannelsData && <NewChannels data={newChannelsData} />}
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
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">전체 응답</p>
            <p className="text-2xl font-bold text-brand-800">{data.totalResponses}</p>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-600" />
            AI가 우리 병원을 추천할 때 강조하는 포인트
          </h3>
          <p className="text-xs text-slate-500 mb-4">AI 응답에서 우리 병원 언급 주변의 키워드를 분석합니다</p>
          {data.recommendationKeywords?.length > 0 ? (
            <div className="space-y-3">
              {data.recommendationKeywords.map((kw: any, i: number) => {
                const maxCount = data.recommendationKeywords[0].count;
                const percentage = maxCount > 0 ? Math.round((kw.count / maxCount) * 100) : 0;
                return (
                  <div key={kw.keyword} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-24 flex-shrink-0">{kw.keyword}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0 ? 'bg-brand-500' : i === 1 ? 'bg-brand-400' : 'bg-blue-300'
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
            <p className="text-slate-400 text-sm">아직 충분한 데이터가 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 플랫폼별 추천 방식 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            플랫폼별 추천 패턴
          </h3>
          <p className="text-xs text-slate-500 mb-4">각 AI 플랫폼이 우리 병원을 어떤 방식으로 추천하는지</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(data.platformContext || {}).map(([platform, stats]: [string, any]) => {
              const mentioned = stats.primary + stats.list + stats.conditional;
              return (
                <div key={platform} className="border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${platformColors[platform]}`} />
                    <span className="font-medium text-slate-900">{platformNames[platform]}</span>
                    <span className="text-xs text-slate-400 ml-auto">{stats.total}건</span>
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
                        <span className="text-brand-600">목록 나열</span>
                        <span className="font-bold">{stats.list}건</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-600">조건부 추천</span>
                        <span className="font-bold">{stats.conditional}건</span>
                      </div>
                      <div className="flex justify-between text-xs border-t pt-2">
                        <span className="text-slate-500">언급 안됨</span>
                        <span className="text-slate-400">{stats.notMentioned}건</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">아직 언급된 적 없음</p>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              경쟁사 대비 차별화 포인트
            </h3>
            <p className="text-xs text-slate-500 mb-4">AI가 경쟁사를 추천할 때 강조하는 포인트 vs 우리</p>
            <div className="space-y-3">
              {/* 우리 병원 */}
              <div className="bg-brand-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-brand-800 mb-2">
                  🏥 {data.hospitalName} (우리)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.ourStrengthProfile || {})
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 5)
                    .map(([attr, count]: any) => (
                      <span key={attr} className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded-full">
                        {attr} ({count})
                      </span>
                    ))}
                  {Object.keys(data.ourStrengthProfile || {}).length === 0 && (
                    <span className="text-xs text-brand-400">데이터 수집 중...</span>
                  )}
                </div>
              </div>
              {/* 경쟁사 */}
              {data.competitorComparison.map((comp: any) => (
                <div key={comp.name} className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">{comp.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {comp.topAttributes?.map((attr: any) => (
                      <span key={attr.keyword} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
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
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Quote className="h-5 w-5 text-green-600" />
              AI의 실제 추천 문구
            </h3>
            <p className="text-xs text-slate-500 mb-4">AI가 실제로 우리 병원을 언급한 원문 발췌</p>
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
                        mention.sentiment === 'NEGATIVE' ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {mention.sentiment === 'POSITIVE' ? '😊 긍정' : mention.sentiment === 'NEGATIVE' ? '😟 부정' : '😐 중립'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-1">Q: {mention.question}</p>
                  <p className="text-sm text-slate-700 italic leading-relaxed">
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
function TrendAnalysis({ data, cohort, onCohortChange }: { data: any; cohort: 'all' | 'fixed'; onCohortChange: (c: 'all' | 'fixed') => void }) {
  const markerDates = new Set((data.promptMarkers || []).map((m: any) => m.date));
  const markerCount = (date: string) => (data.promptMarkers || []).find((m: any) => m.date === date)?.count || 0;
  return (
    <div className="space-y-6">
      {/* 코호트 토글 — 신규 프롬프트 유입 착시 제거 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border bg-white p-1">
          <button
            onClick={() => onCohortChange('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cohort === 'all' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            전체 프롬프트
          </button>
          <button
            onClick={() => onCohortChange('fixed')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cohort === 'fixed' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            고정 코호트
          </button>
        </div>
        {cohort === 'fixed' ? (
          <p className="text-xs text-slate-500">
            기간 시작 전부터 있던 프롬프트 <span className="font-semibold text-slate-700">{data.cohortInfo?.cohortPrompts ?? 0}개</span>만 집계 — 같은 질문 셋으로 기간 전체를 비교합니다
          </p>
        ) : (
          data.cohortInfo?.addedInPeriod > 0 && (
            <p className="text-xs text-amber-600">
              ⚠️ 기간 중 프롬프트 {data.cohortInfo.addedInPeriod}개 추가됨 — 평균이 희석될 수 있으니 실제 성과 추이는 &lsquo;고정 코호트&rsquo;로 확인하세요
            </p>
          )
        )}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">전체 응답 (60일)</p>
            <p className="text-2xl font-bold text-brand-800">{data.summary?.totalResponses || 0}</p>
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
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium" title="언급된 응답 중 첫 번째로 추천된 비율 — 언급률이 그대로여도 이 값이 떨어지면 경쟁사가 치고 올라오는 조기 경보">1위 점유율 ⓘ</p>
            <p className="text-2xl font-bold text-purple-800">{data.summary?.firstPositionShare ?? 0}%</p>
            <p className="text-[10px] text-purple-500 mt-0.5">언급 시 첫 번째로 불린 비율</p>
          </CardContent>
        </Card>
      </div>

      {/* 추천 순서 분포 — 언급 ≠ 1등 */}
      {data.summary?.positionDistribution && data.summary.totalMentions > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              AI 추천 순서 분포
            </h3>
            <p className="text-xs text-slate-500 mb-3">AI 답변은 보통 3~5곳을 추천합니다 — 언급돼도 몇 번째로 불렸는지가 환자 눈에 꽂힐 확률을 가릅니다</p>
            {(() => {
              const pd = data.summary.positionDistribution;
              const totalPos = pd.first + pd.second + pd.third + pd.fourthPlus;
              if (totalPos === 0) return <p className="text-xs text-slate-400">포지션 데이터 없음</p>;
              const rows = [
                { label: '1번째', count: pd.first, color: 'bg-purple-500' },
                { label: '2번째', count: pd.second, color: 'bg-purple-300' },
                { label: '3번째', count: pd.third, color: 'bg-slate-300' },
                { label: '4번째 이하', count: pd.fourthPlus, color: 'bg-slate-200' },
              ];
              return (
                <div className="space-y-2">
                  {rows.map(row => {
                    const pct = Math.round((row.count / totalPos) * 100);
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-16">{row.label}</span>
                        <div className="flex-1 h-4 bg-slate-50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-20 text-right">{row.count}건 ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* 플랫폼별 트렌드 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600" />
            플랫폼별 가시성 트렌드
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(data.platformTrend || {}).map(([platform, stats]: [string, any]) => (
              <div key={platform} className="border rounded-2xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${platformColors[platform]}`} />
                    <span className="font-medium text-slate-900">{platformNames[platform]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {stats.trend === 'UP' && <ArrowUpRight className="h-4 w-4 text-green-600" />}
                    {stats.trend === 'DOWN' && <ArrowDownRight className="h-4 w-4 text-red-600" />}
                    {stats.trend === 'STABLE' && <Minus className="h-4 w-4 text-slate-400" />}
                    <span className={`text-xs font-medium ${
                      stats.trend === 'UP' ? 'text-green-600' :
                      stats.trend === 'DOWN' ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {stats.trend === 'UP' ? '상승' : stats.trend === 'DOWN' ? '하락' : '유지'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-bold text-slate-900">{stats.mentionRate}%</p>
                    <p className="text-xs text-slate-500">언급률</p>
                  </div>
                  {stats.firstShare != null && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-purple-600">{stats.firstShare}%</p>
                      <p className="text-xs text-slate-400">1위 점유</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{stats.mentioned}/{stats.total}</p>
                    <p className="text-xs text-slate-400">언급/전체</p>
                  </div>
                </div>
                {/* 간단한 바 */}
                <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              일별 크롤링 기록
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-slate-500">날짜</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">전체</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">언급</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">언급률</th>
                    <th className="pb-2 font-medium text-slate-500 text-center" title="언급 중 1번째로 추천된 비율">1위 점유</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">감성</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyData.slice(-14).reverse().map((day: any) => (
                    <tr key={day.date} className="border-b last:border-0 hover:bg-white/60">
                      <td className="py-2 text-slate-700">
                        {new Date(day.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                        {markerDates.has(day.date) && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700" title={`이날 프롬프트 ${markerCount(day.date)}개 추가 — 이후 언급률 변동은 신규 질문 유입 영향일 수 있음`}>
                            +{markerCount(day.date)} 프롬프트
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-center text-slate-600">{day.total}</td>
                      <td className="py-2 text-center text-green-600 font-medium">{day.mentioned}</td>
                      <td className="py-2 text-center">
                        <span className={`font-medium ${day.mentionRate >= 50 ? 'text-green-600' : day.mentionRate >= 30 ? 'text-amber-600' : 'text-red-500'}`}>
                          {day.mentionRate}%
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        {day.firstShare != null ? (
                          <span className={`text-xs font-medium ${day.firstShare >= 50 ? 'text-purple-600' : 'text-slate-500'}`}>
                            {day.firstShare}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-green-500 text-xs">+{day.sentiment.positive}</span>
                        {' '}
                        <span className="text-slate-400 text-xs">{day.sentiment.neutral}</span>
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
function SourceAnalysis({ data, diagnostic }: { data: any; diagnostic?: any }) {
  return (
    <div className="space-y-6">
      {/* Gemini 디코딩 배지 */}
      {data.decoding && data.decoding.geminiDecoded > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Search className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900">
                Gemini grounding-redirect 디코딩 활성화 ({data.decoding.geminiDecodeRate}%)
              </p>
              <p className="text-xs text-purple-700 mt-0.5">
                Gemini가 마스킹한 출처 URL {data.decoding.geminiDecoded}개의 실제 도메인을 추출해 분석에 반영했습니다.
                {data.decoding.geminiUnDecoded > 0 && ` (미디코딩 ${data.decoding.geminiUnDecoded}개)`}
              </p>
              {diagnostic?.summary?.newDomainsRevealed > 0 && (
                <p className="text-xs text-purple-800 mt-1 font-medium">
                  🎯 디코딩으로 신규 도메인 {diagnostic.summary.newDomainsRevealed}개 추가 노출
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">인용된 출처</p>
            <p className="text-2xl font-bold text-brand-800">{data.totalUrls || 0}개</p>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-600" />
            AI가 참조하는 출처 채널
          </h3>
          <p className="text-xs text-slate-500 mb-4">AI가 우리 병원 정보를 가져오는 소스 분석</p>
          {data.categories?.length > 0 ? (
            <div className="space-y-3">
              {data.categories.map((cat: any, i: number) => {
                const colors = [
                  'bg-brand-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500',
                  'bg-pink-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500',
                ];
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-28 flex-shrink-0 truncate">{cat.category}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors[i % colors.length]}`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
                        {cat.count}건 ({cat.percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">출처 데이터가 없습니다. Perplexity 응답에서 주로 수집됩니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 플랫폼별 출처 현황 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-green-600" />
            플랫폼별 출처 인용 현황
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(data.platformSources || {}).map(([platform, stats]: [string, any]) => (
              <div key={platform} className="text-center border rounded-2xl p-4">
                <div className={`w-3 h-3 rounded-full ${platformColors[platform]} mx-auto mb-2`} />
                <p className="text-sm font-medium text-slate-900">{platformNames[platform]}</p>
                <p className="text-2xl font-bold text-slate-800 my-1">{stats.totalSources}</p>
                <p className="text-xs text-slate-500">
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
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              미활용 채널 — AI 참조를 늘릴 수 있는 기회!
            </h3>
            <p className="text-xs text-slate-500 mb-4">이 채널에 콘텐츠를 올리면 AI 가시성이 올라갈 수 있어요</p>
            <div className="space-y-3">
              {data.missingChannels.map((ch: any) => (
                <div key={ch.channel} className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-amber-100">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ch.channel}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{ch.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주요 도메인 (상위 25개) */}
      {data.topDomains?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              인용 빈도 상위 도메인 (Top {Math.min(data.topDomains.length, 25)})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              어떤 AI가 인용했는지까지 표시 — 여러 AI에서 인용되는 도메인이 우선순위
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-slate-500 w-10">#</th>
                    <th className="pb-2 font-medium text-slate-500">도메인</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">카테고리</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">인용 수</th>
                    <th className="pb-2 font-medium text-slate-500 text-center">인용 AI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topDomains.slice(0, 25).map((d: any, i: number) => (
                    <tr key={d.domain} className="border-b last:border-0 hover:bg-white/60">
                      <td className="py-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="py-2 text-slate-700 font-mono text-xs break-all">{d.domain}</td>
                      <td className="py-2 text-center text-slate-500 text-xs">{d.category}</td>
                      <td className="py-2 text-center font-medium text-slate-800">{d.count}</td>
                      <td className="py-2 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {(d.platforms || []).map((p: string) => (
                            <span
                              key={p}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${platformBgColors[p] || 'bg-slate-100 text-slate-600'}`}
                            >
                              {platformNames[p] || p}
                            </span>
                          ))}
                        </div>
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

// ==================== A-1. Top URL 페이지 단위 랭킹 ====================
function TopUrlsRanking({ data }: { data: any }) {
  const urls: any[] = data.urls || [];
  const [showCount, setShowCount] = useState(30);

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-600 font-medium">고유 URL</p>
            <p className="text-2xl font-bold text-indigo-800">{data.totalUniqueUrls || 0}개</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
          <CardContent className="p-4">
            <p className="text-xs text-rose-600 font-medium">크로스-AI 인용</p>
            <p className="text-2xl font-bold text-rose-800">{data.crossAICount || 0}개</p>
            <p className="text-[10px] text-rose-500 mt-0.5">3개 이상 AI가 인용</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium">Gemini 디코딩</p>
            <p className="text-2xl font-bold text-purple-800">{data.geminiDecoded || 0}건</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-medium">표시</p>
            <p className="text-2xl font-bold text-emerald-800">Top {Math.min(showCount, urls.length)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-brand-600" />
            Top URL 페이지 랭킹 ({data.period})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            도메인이 아닌 <strong>개별 페이지(URL)</strong> 단위 인용 순위 — 어떤 콘텐츠가 강한지 정확히 파악
          </p>

          {urls.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">아직 분석된 URL이 없습니다</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-slate-500 w-10">#</th>
                      <th className="pb-2 font-medium text-slate-500">URL</th>
                      <th className="pb-2 font-medium text-slate-500 text-center w-16">인용</th>
                      <th className="pb-2 font-medium text-slate-500 text-center w-20">병원 언급률</th>
                      <th className="pb-2 font-medium text-slate-500 text-center">AI</th>
                      <th className="pb-2 font-medium text-slate-500 text-center w-24">최근 인용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urls.slice(0, showCount).map((u: any) => (
                      <tr key={u.url} className="border-b last:border-0 hover:bg-white/60 align-top">
                        <td className="py-2 text-slate-400 text-xs">{u.rank}</td>
                        <td className="py-2">
                          <div className="space-y-0.5">
                            <a
                              href={u.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-700 hover:underline font-mono break-all line-clamp-2"
                            >
                              {u.url}
                            </a>
                            <p className="text-[10px] text-slate-400 font-mono">{u.domain}</p>
                            {u.isCrossAI && (
                              <span className="inline-block text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                                ✨ 크로스-AI 검증
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-center font-bold text-slate-800">{u.citationCount}</td>
                        <td className="py-2 text-center">
                          <span className={`text-xs font-medium ${u.mentionRate >= 50 ? 'text-green-700' : u.mentionRate >= 20 ? 'text-amber-700' : 'text-slate-500'}`}>
                            {u.mentionRate}%
                          </span>
                          <p className="text-[10px] text-slate-400">{u.mentionedWithHospital}/{u.citationCount}</p>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {(u.platforms || []).map((p: string) => (
                              <span
                                key={p}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${platformBgColors[p] || 'bg-slate-100 text-slate-600'}`}
                              >
                                {platformNames[p] || p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 text-center">
                          <span className="text-xs text-slate-600">{u.freshness}</span>
                          <p className="text-[10px] text-slate-400">{u.daysSinceLast}일 전</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showCount < urls.length && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowCount(c => Math.min(c + 30, urls.length))}>
                    <ChevronDown className="h-4 w-4 mr-1.5" />
                    더보기 ({urls.length - showCount}개 남음)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== A-2. URL × AI 매트릭스 ====================
function UrlMatrix({ data }: { data: any }) {
  const rows: any[] = data.rows || [];
  const platforms: string[] = data.platforms || ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'GOOGLE_AI_OVERVIEW', 'GROK', 'CLOVA_X'];

  // 색 강도 계산: 0=white, 1+=brand 농도
  const getCellBg = (count: number, max: number) => {
    if (count === 0) return 'bg-white';
    const ratio = max > 0 ? count / max : 0;
    if (ratio > 0.75) return 'bg-brand-600 text-white';
    if (ratio > 0.5) return 'bg-brand-500 text-white';
    if (ratio > 0.25) return 'bg-brand-300 text-brand-900';
    return 'bg-brand-100 text-brand-800';
  };

  // 모든 셀의 최댓값
  let maxCell = 0;
  for (const row of rows) {
    for (const c of row.cells) {
      if (c.count > maxCell) maxCell = c.count;
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            URL × AI 매트릭스 ({data.period})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            상위 {data.returnedCount}개 URL이 <strong>어떤 AI</strong>에서 얼마나 인용되는지 한눈에 — 진한 셀일수록 빈도 높음
          </p>

          {rows.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">아직 매트릭스 데이터가 없습니다</div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 pr-2 font-medium text-slate-500 sticky left-0 bg-white z-10 w-8">#</th>
                    <th className="text-left pb-2 pr-2 font-medium text-slate-500 sticky left-8 bg-white z-10 min-w-[180px]">URL</th>
                    <th className="pb-2 px-2 font-medium text-slate-500 text-center w-12">총합</th>
                    {platforms.map(p => (
                      <th key={p} className="pb-2 px-1 font-medium text-slate-500 text-center min-w-[60px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${platformColors[p]}`} />
                          <span className="text-[10px]">{platformNames[p] || p}</span>
                        </div>
                      </th>
                    ))}
                    <th className="pb-2 px-2 font-medium text-slate-500 text-center w-12">커버</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.url} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-slate-400 sticky left-0 bg-white">{row.rank}</td>
                      <td className="py-2 pr-2 sticky left-8 bg-white">
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 hover:underline font-mono text-[11px] break-all line-clamp-2"
                        >
                          {row.url}
                        </a>
                        <p className="text-[10px] text-slate-400 font-mono">{row.domain}</p>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-slate-800">{row.total}</td>
                      {row.cells.map((c: any) => (
                        <td key={c.platform} className="py-1 px-1">
                          <div
                            className={`text-center py-1.5 rounded text-[11px] font-medium ${getCellBg(c.count, maxCell)}`}
                            title={`${platformNames[c.platform] || c.platform}: ${c.count}건`}
                          >
                            {c.count || ''}
                          </div>
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center">
                        <span className={`text-xs font-bold ${row.coverage >= 4 ? 'text-rose-700' : row.coverage >= 2 ? 'text-amber-700' : 'text-slate-500'}`}>
                          {row.coverage}/{platforms.length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-50">
                    <td colSpan={2} className="py-2 px-2 text-right font-bold text-slate-700 sticky left-0 bg-slate-50">AI별 합계</td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800">
                      {(data.columnTotals || []).reduce((s: number, c: any) => s + c.total, 0)}
                    </td>
                    {(data.columnTotals || []).map((c: any) => (
                      <td key={c.platform} className="py-2 px-1 text-center font-bold text-slate-700">
                        {c.total}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <span>색 농도:</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-brand-100 rounded" /> 적음
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-brand-300 rounded" /> 보통
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-brand-500 rounded" /> 많음
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-brand-600 rounded" /> 매우 많음
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Breadth 리포트 (25 카테고리 + 권위도 + 갭) ====================
function BreadthInsights({ data }: { data: any }) {
  const [showAllCats, setShowAllCats] = useState(false);
  const summary = data.summary || {};
  const auth = data.authorityDistribution || [];
  const sentiment = data.overallSentiment || {};
  const categories: any[] = data.categories || [];
  const gap = data.competitorGap || {};
  const opps: any[] = gap.topOpportunities || [];
  const strengths: any[] = gap.ourStrengths || [];
  const recs: any[] = data.recommendations || [];

  const visibleCats = showAllCats ? categories : categories.slice(0, 10);
  const maxCatCount = categories[0]?.count || 1;
  const maxAuthCount = Math.max(...auth.map((a: any) => a.count), 1);

  // 종합 권위도 색상
  const authColor =
    summary.overallAuthority >= 7 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    summary.overallAuthority >= 5 ? 'text-blue-600 bg-blue-50 border-blue-200' :
    summary.overallAuthority >= 3 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-600 bg-red-50 border-red-200';

  const tierColors: Record<string, string> = {
    'tier_s': 'bg-emerald-500',
    'tier_a': 'bg-blue-500',
    'tier_b': 'bg-indigo-400',
    'tier_c': 'bg-amber-400',
    'tier_d': 'bg-red-400',
  };

  const priorityColors: Record<string, string> = {
    P0: 'bg-red-100 text-red-700 border-red-300',
    P1: 'bg-amber-100 text-amber-700 border-amber-300',
    P2: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={`border-2 ${authColor}`}>
          <CardContent className="p-4">
            <p className="text-xs font-medium opacity-80">종합 권위도</p>
            <p className="text-3xl font-bold mt-1">{summary.overallAuthority}/10</p>
            <p className="text-xs mt-1 opacity-90">{summary.overallAuthorityTier}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">총 인용 URL</p>
            <p className="text-2xl font-bold text-brand-800">{summary.totalUrls?.toLocaleString()}</p>
            <p className="text-xs text-brand-600 mt-1">{summary.totalResponses?.toLocaleString()}개 응답</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium">카테고리 다양성</p>
            <p className="text-2xl font-bold text-purple-800">{summary.uniqueCategories}</p>
            <p className="text-xs text-purple-600 mt-1">/ 25개 카테고리</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">긍정 감성</p>
            <p className="text-2xl font-bold text-green-800">{sentiment.positiveRate}%</p>
            <p className="text-xs text-green-600 mt-1">
              부정 {sentiment.negativeRate}% · {data.period}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 권위도 Tier 분포 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            권위도 Tier 분포
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            AI가 우리 병원 정보를 어떤 신뢰 등급 출처에서 가져오는지 — Tier S/A가 많을수록 견고합니다
          </p>
          <div className="space-y-3">
            {auth.map((bucket: any) => {
              const key = Object.keys(tierColors).find(k => bucket.label.includes(k.replace('tier_', '').toUpperCase())) || 'tier_b';
              const widthPct = maxAuthCount > 0 ? (bucket.count / maxAuthCount) * 100 : 0;
              return (
                <div key={bucket.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700">{bucket.label}</span>
                    <span className="text-xs text-slate-500">
                      {bucket.count.toLocaleString()}회 · <span className="font-semibold text-slate-900">{bucket.percentage}%</span>
                    </span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tierColors[key]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {auth.find((a: any) => a.label.includes('Tier D'))?.percentage > 20 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                <strong>경고</strong>: Tier D (광고/저신뢰) 비중이 20% 초과 — AI 인용 출처의 1/4 이상이 신뢰도 낮은 출처입니다. 권위 있는 출처 비중 확대가 시급합니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 경쟁사 갭 분석 */}
      {(opps.length > 0 || strengths.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 진출 기회 */}
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-red-900 mb-1 flex items-center gap-2">
                <Target className="h-5 w-5 text-red-600" />
                🔥 진출 기회 (갭 분석)
              </h3>
              <p className="text-xs text-red-700/80 mb-4">경쟁사는 노출 중이지만 우리는 부재한 카테고리</p>
              {opps.length > 0 ? (
                <div className="space-y-2">
                  {opps.map((opp: any) => (
                    <div key={opp.category} className="bg-white rounded-xl p-3 border border-red-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-slate-900 text-sm">{opp.label}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {opp.opportunity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden flex">
                          <div className="bg-brand-400" style={{ width: `${opp.ourShare}%` }} />
                          <div className="bg-red-400" style={{ width: `${opp.compShare}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between mt-1 text-xs">
                        <span className="text-brand-600">우리 {opp.ourPresence}회 ({opp.ourShare}%)</span>
                        <span className="text-red-600">경쟁사 {opp.competitorPresence}회 ({opp.compShare}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">진출 기회 카테고리가 없습니다</p>
              )}
            </CardContent>
          </Card>

          {/* 우리 우위 */}
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-emerald-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ✅ 우리 우위 영역
              </h3>
              <p className="text-xs text-emerald-700/80 mb-4">경쟁사 대비 우리가 더 많이 노출되는 카테고리</p>
              {strengths.length > 0 ? (
                <div className="space-y-2">
                  {strengths.map((s: any) => (
                    <div key={s.category} className="bg-white rounded-xl p-3 border border-emerald-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-slate-900 text-sm">{s.label}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          ✅ 우위
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-600 font-medium">우리 {s.ourPresence}회</span>
                        <span className="text-slate-500">경쟁사 {s.competitorPresence}회</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">아직 우위 영역이 충분히 누적되지 않았습니다</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 액션 추천 */}
      {recs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              자동 액션 추천
            </h3>
            <p className="text-xs text-slate-500 mb-4">권위도/감성/갭 분석 기반 우선순위별 실행 계획</p>
            <div className="space-y-2">
              {recs.map((r: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-amber-100 flex items-start gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${priorityColors[r.priority] || priorityColors.P2}`}>
                    {r.priority}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{r.label}</p>
                    <p className="text-xs text-slate-600 mt-1">{r.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 카테고리별 상세 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              25 카테고리 상세 분포
            </h3>
            <span className="text-xs text-slate-500">{categories.length}개 카테고리 활성</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">카테고리별 인용 횟수, 권위도, 감성, 플랫폼 분포</p>

          <div className="space-y-3">
            {visibleCats.map((cat: any) => {
              const widthPct = (cat.count / maxCatCount) * 100;
              const authBadge =
                cat.avgAuthority >= 9 ? 'bg-emerald-100 text-emerald-700' :
                cat.avgAuthority >= 7 ? 'bg-blue-100 text-blue-700' :
                cat.avgAuthority >= 5 ? 'bg-indigo-100 text-indigo-700' :
                cat.avgAuthority >= 3 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700';
              return (
                <div key={cat.category} className="border rounded-xl p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{cat.label}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${authBadge}`}>
                        권위 {cat.avgAuthority}/10
                      </span>
                      {cat.ownCount > 0 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                          우리 {cat.ownCount}회
                        </span>
                      )}
                      {cat.sentiment.negativeRate > 30 && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          부정 {cat.sentiment.negativeRate}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-bold text-slate-900">{cat.count.toLocaleString()}회</span>
                      <span className="ml-1">({cat.percentage}%)</span>
                      <span className="ml-2">· {cat.uniqueDomains} 도메인</span>
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${widthPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>
                      😊 긍정 {cat.sentiment.positive} · 😐 중립 {cat.sentiment.neutral} · 😞 부정 {cat.sentiment.negative}
                    </span>
                    <span>병원 언급률 {cat.mentionedRate}%</span>
                  </div>
                  {/* 플랫폼 */}
                  {cat.platforms?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      <span className="text-xs text-slate-400 mr-1">AI:</span>
                      {cat.platforms.map((p: string) => (
                        <span key={p} className={`text-xs px-1.5 py-0.5 rounded ${platformBgColors[p] || 'bg-slate-100 text-slate-700'}`}>
                          {platformNames[p] || p}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Top 도메인 */}
                  {cat.topDomains?.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-slate-400 mr-1">Top:</span>
                      {cat.topDomains.slice(0, 3).map((d: any) => (
                        <span key={d.domain} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          {d.domain} ({d.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {categories.length > 10 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllCats(!showAllCats)}
              className="w-full mt-4"
            >
              {showAllCats ? (
                <><ChevronUp className="h-4 w-4 mr-1.5" />접기</>
              ) : (
                <><ChevronDown className="h-4 w-4 mr-1.5" />전체 {categories.length}개 보기</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== 출처 인텔리전스 대시보드 ====================
function SourceIntelDashboard({
  summary,
  topSources,
  instagram,
  hints,
  hospitalId,
}: {
  summary: any;
  topSources: any;
  instagram: any;
  hints: any;
  hospitalId: string;
}) {
  const [subTab, setSubTab] = useState<'overview' | 'quotes' | 'instagram' | 'hints' | 'top'>('overview');
  const [enrichTriggered, setEnrichTriggered] = useState(false);
  const { data: enrichStatus } = useEnrichStatus(hospitalId, enrichTriggered);
  const queryClient = useQueryClient();

  const handleEnrich = async () => {
    try {
      await crawlerApi.enrichSources(hospitalId, 30, 200, true);
      setEnrichTriggered(true);
      toast.success('🔥 분석 시작 — AI가 인용 페이지를 크롤링하고 분석 중입니다 (약 5-10분)');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '분석 시작 실패');
    }
  };

  // 폴링 상태에 따라 캐시 무효화
  useEffect(() => {
    if (enrichStatus?.status === 'done' && enrichTriggered) {
      setEnrichTriggered(false);
      queryClient.invalidateQueries({ queryKey: ['source-intel-summary', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['source-intel-top', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['source-intel-instagram', hospitalId] });
      toast.success(`✅ 분석 완료 — ${enrichStatus.processed}개 페이지 처리, ${enrichStatus.aiAnalyzed}개 AI 분석 완료`);
    }
  }, [enrichStatus?.status, enrichTriggered, queryClient, hospitalId]);

  const isRunning = enrichStatus?.status === 'running';
  const enrichProgress = isRunning && enrichStatus?.total > 0
    ? Math.round((enrichStatus.processed / enrichStatus.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* 상단 — 분석 트리거 */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                출처 인텔리전스 🆕
              </h3>
              <p className="text-sm text-slate-600">
                AI가 인용한 페이지의 <strong>실제 본문 + 우리 병원이 어떻게 묘사되는지</strong>를 분석합니다.
                인스타 릴/포스트, 블로그, 모두닥 등 모든 인용 출처를 심층 추적.
              </p>
            </div>
            <div className="flex-shrink-0">
              {isRunning ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    분석 중 {enrichStatus?.processed || 0}/{enrichStatus?.total || 0}
                  </div>
                  <div className="w-40 h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all" style={{ width: `${enrichProgress}%` }} />
                  </div>
                </div>
              ) : (
                <Button onClick={handleEnrich} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  AI 분석 실행
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* sub tabs */}
      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {[
          { key: 'overview', icon: Eye, label: '개요' },
          { key: 'quotes', icon: MessageCircle, label: 'Quote & 정확성' },
          { key: 'top', icon: Award, label: 'Top 영향 출처' },
          { key: 'instagram', icon: Instagram, label: '인스타 인사이트' },
          { key: 'hints', icon: Hash, label: 'AI 단서 키워드' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              subTab === t.key
                ? 'bg-purple-100 text-purple-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* sub content */}
      {subTab === 'overview' && <SI_Overview summary={summary} instagram={instagram} hospitalId={hospitalId} />}
      {subTab === 'quotes' && <SI_Quotes summary={summary} />}
      {subTab === 'top' && <SI_TopSources data={topSources} />}
      {subTab === 'instagram' && <SI_Instagram data={instagram} />}
      {subTab === 'hints' && <SI_HintKeywords data={hints} />}
    </div>
  );
}

// ━━━ 출처 인텔: 개요 ━━━
function SI_Overview({ summary, instagram, hospitalId }: { summary: any; instagram: any; hospitalId: string }) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileSearch className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-3">아직 분석된 출처가 없습니다</p>
          <p className="text-xs text-slate-400">위의 'AI 분석 실행' 버튼을 눌러 시작하세요</p>
        </CardContent>
      </Card>
    );
  }

  const td = summary.toneDistribution || {};
  const ai = summary.accuracyIssues || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium">분석된 페이지</p>
            <p className="text-2xl font-bold text-purple-800">{summary.analyzed?.toLocaleString() || 0}</p>
            <p className="text-xs text-purple-600 mt-1">/ {summary.totalSnapshots?.toLocaleString() || 0} 스냅샷 ({summary.coverage}%)</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">우리 병원 언급</p>
            <p className="text-2xl font-bold text-green-800">{summary.mentionsUs?.toLocaleString() || 0}</p>
            <p className="text-xs text-green-600 mt-1">{td.positiveRate || 0}% 긍정</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4">
            <p className="text-xs text-amber-600 font-medium">정확성 이슈</p>
            <p className="text-2xl font-bold text-amber-800">{ai.total || 0}</p>
            <p className="text-xs text-amber-600 mt-1">옛 정보 {ai.outdated || 0} · 오류 {ai.incorrect || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100">
          <CardContent className="p-4">
            <p className="text-xs text-pink-600 font-medium">인스타 인용</p>
            <p className="text-2xl font-bold text-pink-800">{instagram?.summary?.igCitations?.toLocaleString() || 0}</p>
            <p className="text-xs text-pink-600 mt-1">{instagram?.summary?.igPercent || 0}% (전체 대비)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tone 분포 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-600" />
            AI 인용 출처가 우리 병원을 묘사하는 톤
          </h3>
          <div className="space-y-2">
            {[
              { label: '😊 긍정', count: td.positive || 0, color: 'bg-green-500' },
              { label: '😐 중립', count: td.neutral || 0, color: 'bg-slate-400' },
              { label: '⚖️ 비교 (vs 경쟁사)', count: td.comparative || 0, color: 'bg-amber-500' },
              { label: '😞 부정', count: td.negative || 0, color: 'bg-red-500' },
            ].map(t => {
              const total = (td.positive || 0) + (td.neutral || 0) + (td.comparative || 0) + (td.negative || 0);
              const pct = total > 0 ? (t.count / total) * 100 : 0;
              return (
                <div key={t.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{t.label}</span>
                    <span className="font-medium">{t.count}회 ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-full ${t.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ━━━ 출처 인텔: Quote & 정확성 ━━━
function SI_Quotes({ summary }: { summary: any }) {
  if (!summary) {
    return (
      <Card><CardContent className="p-8 text-center text-slate-500">분석된 데이터가 없습니다</CardContent></Card>
    );
  }
  const positiveQuotes = summary.positiveQuotes || [];
  const negativeQuotes = summary.negativeQuotes || [];
  const alerts = summary.accuracyAlerts || [];

  return (
    <div className="space-y-4">
      {/* 정확성 알림 */}
      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-red-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              🚨 정정 필요 출처 ({alerts.length}건)
            </h3>
            <div className="space-y-2">
              {alerts.map((a: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-red-100 flex items-start gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    a.type === 'INCORRECT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {a.type === 'INCORRECT' ? '잘못된 정보' : '옛 정보'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">{a.action || '내용 검토 필요'}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">snapshot: {a.snapId.substring(0, 8)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 긍정 quotes */}
      <Card className="border-green-200">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Quote className="h-5 w-5 text-green-600" />
            💎 우리 병원 핵심 quote ({positiveQuotes.length}개)
          </h3>
          {positiveQuotes.length > 0 ? (
            <div className="space-y-3">
              {positiveQuotes.map((q: any, i: number) => (
                <div key={i} className="bg-green-50/50 rounded-xl p-3 border-l-4 border-green-400">
                  <p className="text-sm text-slate-800 italic leading-relaxed">"{q.quote}"</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">아직 긍정 quote가 수집되지 않았습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 부정 quotes */}
      {negativeQuotes.length > 0 && (
        <Card className="border-red-200">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              ⚠️ 부정적 묘사 ({negativeQuotes.length}개) — 평판 관리 대상
            </h3>
            <div className="space-y-3">
              {negativeQuotes.map((q: any, i: number) => (
                <div key={i} className="bg-red-50/50 rounded-xl p-3 border-l-4 border-red-400">
                  <p className="text-sm text-slate-800 italic leading-relaxed">"{q.quote}"</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ━━━ 출처 인텔: Top Sources ━━━
function SI_TopSources({ data }: { data: any }) {
  if (!data || !data.sources?.length) {
    return <Card><CardContent className="p-8 text-center text-slate-500">분석된 출처가 없습니다</CardContent></Card>;
  }
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-600" />
            영향력 TOP {data.sources.length} 출처
          </h3>
          <p className="text-xs text-slate-500 mb-4">권위도 × 인용빈도 × AI 다양성 × 신선도 × 톤 가중 점수 (0~10)</p>
          <div className="space-y-2">
            {data.sources.map((s: any, i: number) => (
              <SourceCard key={s.id} source={s} rank={i + 1} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SourceCard({ source, rank }: { source: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const a = source.analysis;
  const toneColor =
    a?.ourTone === 'POSITIVE' ? 'bg-green-100 text-green-700' :
    a?.ourTone === 'NEGATIVE' ? 'bg-red-100 text-red-700' :
    a?.ourTone === 'COMPARATIVE' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';

  return (
    <div className="border rounded-xl p-3 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-slate-700 truncate">{source.domain}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                Authority {source.authorityScore}/10
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                Influence {source.influenceScore?.toFixed(2)}
              </span>
              {a && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${toneColor}`}>
                  {a.ourTone === 'POSITIVE' ? '😊 긍정' :
                   a.ourTone === 'NEGATIVE' ? '😞 부정' :
                   a.ourTone === 'COMPARATIVE' ? '⚖️ 비교' :
                   a.ourTone === 'NEUTRAL' ? '😐 중립' : '— 미언급'}
                </span>
              )}
              {a?.claimAccuracy && a.claimAccuracy !== 'ACCURATE' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                  ⚠️ {a.claimAccuracy === 'OUTDATED' ? '옛정보' : a.claimAccuracy === 'INCORRECT' ? '오류' : a.claimAccuracy}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-900 truncate">{source.title || source.url}</p>
            {a?.extractedQuote && (
              <p className="text-xs text-slate-600 italic mt-1 line-clamp-2">"{a.extractedQuote}"</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-slate-500">{source.totalCitations}회 인용</span>
          <div className="flex gap-1">
            {source.citingAiPlatforms?.slice(0, 4).map((p: string) => (
              <span key={p} className={`w-2 h-2 rounded-full ${platformColors[p] || 'bg-slate-300'}`} title={platformNames[p]} />
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-purple-600 hover:underline flex items-center gap-1"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        상세 보기
      </button>
      {expanded && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-2">
          <div><span className="font-semibold text-slate-700">URL:</span> <a href={source.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline break-all">{source.url}</a></div>
          {source.publisher && <div><span className="font-semibold text-slate-700">매체:</span> {source.publisher}</div>}
          {source.author && <div><span className="font-semibold text-slate-700">작성자:</span> {source.author}</div>}
          {source.publishedAt && <div><span className="font-semibold text-slate-700">게시일:</span> {new Date(source.publishedAt).toLocaleDateString('ko-KR')}</div>}
          {a?.topicSummary && <div><span className="font-semibold text-slate-700">주제:</span> {a.topicSummary}</div>}
          {a?.ourContext && (
            <div>
              <span className="font-semibold text-slate-700">우리 병원 언급 컨텍스트:</span>
              <p className="mt-1 text-slate-600 leading-relaxed">{a.ourContext}</p>
            </div>
          )}
          {a?.recommendedAction && (
            <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
              <span className="font-semibold text-amber-800">🎯 추천 액션:</span> <span className="text-amber-700">{a.recommendedAction}</span>
            </div>
          )}
          {a?.mentionedCompetitors?.length > 0 && (
            <div>
              <span className="font-semibold text-slate-700">함께 언급된 경쟁사:</span> {a.mentionedCompetitors.slice(0, 5).join(', ')}
            </div>
          )}
          {a?.signalKeywords?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="font-semibold text-slate-700">시그널 키워드:</span>
              {a.signalKeywords.map((k: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{k}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ━━━ 출처 인텔: Instagram ━━━
function SI_Instagram({ data }: { data: any }) {
  if (!data) {
    return <Card><CardContent className="p-8 text-center text-slate-500">인스타 데이터가 없습니다</CardContent></Card>;
  }
  const s = data.summary || {};
  const diag = data.diagnosis || [];

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100">
          <CardContent className="p-4">
            <p className="text-xs text-pink-600 font-medium">인스타 인용</p>
            <p className="text-2xl font-bold text-pink-800">{s.igCitations?.toLocaleString() || 0}</p>
            <p className="text-xs text-pink-600 mt-1">{s.igPercent}% (전체 대비)</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <p className="text-xs text-purple-600 font-medium">고유 URL</p>
            <p className="text-2xl font-bold text-purple-800">{s.uniqueUrls || 0}</p>
            <p className="text-xs text-purple-600 mt-1">{s.uniqueHandles || 0}개 핸들</p>
          </CardContent>
        </Card>
        {data.ourHandle ? (
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-600 font-medium">우리 병원 핸들</p>
              <p className="text-base font-bold text-emerald-800 truncate">{data.ourHandle.handle}</p>
              <p className="text-xs text-emerald-600 mt-1">{data.ourHandle.citations}회 ({data.ourHandle.sharePercent}%)</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4">
              <p className="text-xs text-red-600 font-medium">우리 병원 핸들</p>
              <p className="text-base font-bold text-red-800">🚨 부재</p>
              <p className="text-xs text-red-600 mt-1">인스타 SEO 미진입</p>
            </CardContent>
          </Card>
        )}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">AI 분석된 URL</p>
            <p className="text-2xl font-bold text-brand-800">{s.analyzedCount || 0}</p>
            <p className="text-xs text-brand-600 mt-1">/ {s.snapshotsAvailable || 0} 스냅샷</p>
          </CardContent>
        </Card>
      </div>

      {/* 진단 */}
      {diag.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" /> 진단
            </h4>
            <ul className="text-sm text-slate-700 space-y-1">
              {diag.map((d: string, i: number) => <li key={i}>{d}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* AI 플랫폼별 */}
      <Card>
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-pink-600" /> AI 플랫폼별 인스타 인용
          </h4>
          <div className="space-y-2">
            {(data.aiPlatformDistribution || []).map((p: any) => (
              <div key={p.platform}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${platformBgColors[p.platform] || 'bg-slate-100'}`}>
                    {platformNames[p.platform] || p.platform}
                  </span>
                  <span className="font-medium">{p.citations}회 ({p.percent}%)</span>
                </div>
                <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${platformColors[p.platform] || 'bg-slate-400'}`} style={{ width: `${p.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Handles */}
      <Card>
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Instagram className="h-4 w-4 text-pink-600" /> Top 인스타 핸들
          </h4>
          <div className="space-y-1">
            {(data.topHandles || []).slice(0, 10).map((h: any, i: number) => (
              <div key={h.handle} className={`flex items-center justify-between p-2 rounded-lg ${h.isOurs ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs w-6 text-slate-500">#{i + 1}</span>
                  <span className="font-mono text-sm truncate">{h.handle}</span>
                  {h.isOurs && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">우리</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{h.urls} URL</span>
                  <span className="font-bold text-slate-900">{h.count}회</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top URLs (포스트/릴) */}
      <Card>
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-pink-600" /> Top 인용 인스타 포스트/릴
          </h4>
          <div className="space-y-2">
            {(data.topUrls || []).slice(0, 15).map((u: any, i: number) => (
              <div key={i} className="border rounded-xl p-3 hover:bg-slate-50/50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 font-medium">
                        {u.snapshot?.mediaType === 'reel' ? '🎬 릴' : u.snapshot?.mediaType === 'post' ? '📷 포스트' : '📱'}
                      </span>
                      {u.snapshot?.handle && (
                        <span className="text-xs font-mono text-slate-700">{u.snapshot.handle}</span>
                      )}
                      <span className="text-xs text-slate-500">멘션률 {u.mentionRate}%</span>
                    </div>
                    <a href={u.url} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline truncate block">
                      {u.url}
                    </a>
                    {u.snapshot?.caption && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{u.snapshot.caption}</p>
                    )}
                    {u.analysis?.extractedQuote && (
                      <p className="text-xs text-slate-700 italic mt-1 line-clamp-2">💬 "{u.analysis.extractedQuote}"</p>
                    )}
                    {u.topCoCompetitors?.length > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        🥊 동시언급: {u.topCoCompetitors.slice(0, 3).map((c: any) => c.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900 flex-shrink-0">{u.citations}회</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ━━━ 출처 인텔: Hint Keywords ━━━
function SI_HintKeywords({ data }: { data: any }) {
  if (!data || !data.keywords?.length) {
    return <Card><CardContent className="p-8 text-center text-slate-500">아직 hint keyword가 누적되지 않았습니다</CardContent></Card>;
  }

  const categoryLabels: Record<string, string> = {
    REVIEW_SIGNAL: '⭐ 리뷰/평점',
    OFFICIAL_SIGNAL: '🏥 공식 홈페이지',
    AUTHORITY_SIGNAL: '🏛 공공/권위',
    VIDEO_SIGNAL: '🎬 영상/유튜브',
    SOCIAL_SIGNAL: '📱 SNS/인스타',
    BLOG_SIGNAL: '✍️ 블로그',
    MAP_SIGNAL: '🗺 지도/플레이스',
    NEWS_SIGNAL: '📰 뉴스',
    OTHER: '기타',
  };

  return (
    <div className="space-y-4">
      {/* 카테고리 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Hash className="h-5 w-5 text-purple-600" />
            AI가 인용 시 사용한 단서 신호 (카테고리별)
          </h3>
          <p className="text-xs text-slate-500 mb-4">AI가 응답을 만들 때 어떤 종류의 출처 단서를 참조하는지</p>
          <div className="space-y-2">
            {(data.byCategory || []).map((c: any) => {
              const max = data.byCategory[0]?.total || 1;
              const pct = (c.total / max) * 100;
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{categoryLabels[c.category] || c.category}</span>
                    <span className="text-xs text-slate-500">
                      전체 {c.total} · 우리 {c.withUs} · 경쟁사 {c.withCompetitor}
                    </span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 키워드 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" />
            Top {Math.min(30, data.keywords.length)} 단서 키워드
          </h3>
          <div className="space-y-1">
            {data.keywords.slice(0, 30).map((k: any) => {
              const total = data.keywords[0]?.total || 1;
              const pct = (k.total / total) * 100;
              return (
                <div key={k.keyword} className="border rounded-lg p-2 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-900 truncate">{k.keyword}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{categoryLabels[k.category] || k.category}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-green-600">우리 {k.usShare}%</span>
                      <span className="text-red-600">경쟁사 {k.compShare}%</span>
                      <span className="font-bold text-slate-900 w-8 text-right">{k.total}</span>
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div className="h-full bg-purple-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
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
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4">
            <p className="text-xs text-brand-600 font-medium">우리 병원 언급</p>
            <p className="text-2xl font-bold text-brand-800">{data.ourPosition?.totalMentions || 0}회</p>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Radar className="h-5 w-5 text-brand-600" />
            AI가 보는 시장 내 포지션 맵
          </h3>
          <p className="text-xs text-slate-500 mb-4">AI 응답에서 추출한 5개 축 기준 포지셔닝 비교</p>

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
              <div className="bg-brand-50 rounded-2xl p-4 border border-brand-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-1 bg-brand-600 rounded" />
                  <span className="text-sm font-semibold text-brand-800">🏥 {data.hospitalName} (우리)</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {axisKeys.map(key => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-slate-500">{axisLabels[key]}</p>
                      <p className="text-lg font-bold text-brand-700">{ourScores[key] || 0}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 경쟁사 */}
              {competitors.map((comp: any, ci: number) => (
                <div key={comp.name} className="bg-slate-50 rounded-2xl p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-1 rounded" style={{ backgroundColor: compColors[ci % compColors.length] }} />
                    <span className="text-sm font-medium text-slate-700">{comp.name}</span>
                    <span className="text-xs text-slate-400 ml-auto">{comp.mentionCount}회 언급</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {axisKeys.map(key => {
                      const compVal = comp.scores?.[key] || 0;
                      const ourVal = ourScores[key] || 0;
                      const diff = compVal - ourVal;
                      return (
                        <div key={key} className="text-center">
                          <p className="text-xs text-slate-500">{axisLabels[key]}</p>
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
                <p className="text-sm text-slate-400 text-center py-4">경쟁사 데이터가 없습니다. AI 응답에서 경쟁사가 언급되면 자동으로 추출됩니다.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 인사이트 */}
      {data.insights?.length > 0 && (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              포지셔닝 인사이트
            </h3>
            <div className="space-y-3">
              {data.insights.map((insight: string, i: number) => (
                <div key={i} className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-3 border border-brand-100">
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-brand-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-slate-700">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5축별 상세 비교 바 차트 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            축별 상세 비교
          </h3>
          <div className="space-y-6">
            {axisKeys.map(key => {
              const ourVal = ourScores[key] || 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{axisEmojis[key]} {axisLabels[key]}</span>
                  </div>
                  {/* 우리 바 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0 truncate">{data.hospitalName}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${ourVal}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{ourVal}</span>
                    </div>
                  </div>
                  {/* 경쟁사 바 */}
                  {competitors.map((comp: any, ci: number) => {
                    const compVal = comp.scores?.[key] || 0;
                    return (
                      <div key={comp.name} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-400 w-20 flex-shrink-0 truncate">{comp.name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 relative overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${compVal}%`, backgroundColor: compColors[ci % compColors.length] }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">{compVal}</span>
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
    '양호': 'text-brand-600 bg-brand-50 border-brand-200',
    '보통': 'text-amber-600 bg-amber-50 border-amber-200',
    '개선 필요': 'text-red-600 bg-red-50 border-red-200',
  };

  const weightColors: Record<string, string> = {
    '최상': 'bg-green-100 text-green-800',
    '상': 'bg-brand-100 text-brand-800',
    '중상': 'bg-cyan-100 text-cyan-800',
    '중': 'bg-amber-100 text-amber-800',
    '하': 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* 건강도 점수 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={`${healthColors[data.healthLabel] || 'bg-slate-50'} border-2`}>
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium opacity-80">출처 건강도</p>
            <p className="text-3xl font-bold">{data.healthScore || 0}</p>
            <p className="text-sm font-semibold">{data.healthLabel}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-brand-200">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-brand-600 font-medium">평균 품질</p>
            <p className="text-3xl font-bold text-brand-800">{data.avgQuality || 0}</p>
            <p className="text-xs text-brand-600">100점 만점</p>
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
            <p className="text-xs text-slate-500 font-medium">분석 기간</p>
            <p className="text-lg font-bold text-slate-800">{data.period}</p>
          </CardContent>
        </Card>
      </div>

      {/* 채널별 영향력 분석 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-600" />
            채널별 영향력 분석
          </h3>
          <p className="text-xs text-slate-500 mb-4">각 출처 채널의 품질 점수와 AI 가시성 영향 분석</p>

          {channels.length > 0 ? (
            <div className="space-y-4">
              {channels.map((ch: any, i: number) => (
                <div key={ch.channel} className="border rounded-2xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{ch.channel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${weightColors[ch.qualityWeight] || 'bg-slate-100 text-slate-600'}`}>
                        {ch.qualityWeight}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-brand-600">{ch.influenceScore}</span>
                      <span className="text-xs text-slate-400 ml-1">영향력</span>
                    </div>
                  </div>

                  {/* 지표 바 */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">품질 점수</p>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${ch.qualityScore}%` }} />
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{ch.qualityScore}/100</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">언급 상관도</p>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${ch.mentionCorrelation}%` }} />
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{ch.mentionCorrelation}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">긍정 비율</p>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${ch.positiveCorrelation}%` }} />
                      </div>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{ch.positiveCorrelation}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>인용 {ch.citedCount}건</span>
                    <span>{ch.qualityDescription}</span>
                    <div className="flex gap-1">
                      {ch.platforms?.map((p: string) => (
                        <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${platformBgColors[p] || 'bg-slate-100 text-slate-600'}`}>
                          {platformNames[p] || p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-4">출처 데이터가 아직 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 우선순위 추천 */}
      {data.recommendations?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              출처 강화 추천 (우선순위 순)
            </h3>
            <p className="text-xs text-slate-500 mb-4">AI 가시성을 높이기 위해 집중해야 할 채널</p>
            <div className="space-y-3">
              {data.recommendations.map((rec: any, i: number) => (
                <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{rec.priority}</span>
                    <span className="text-sm font-semibold text-slate-900">{rec.channel}</span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{rec.action}</p>
                  <p className="text-xs text-brand-600 font-medium flex items-center gap-1">
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
    4: 'border-l-blue-500 bg-brand-50/50',
    5: 'border-l-gray-400 bg-slate-50/50',
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
            <div className="bg-white/10 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-300">전체 언급률</p>
              <p className="text-2xl font-bold">{summary.overallMentionRate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-300">최강 플랫폼</p>
              <p className="text-lg font-bold">{summary.strongestPlatform?.name || '-'}</p>
              <p className="text-xs text-green-400">{summary.strongestPlatform?.rate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-300">최약 플랫폼</p>
              <p className="text-lg font-bold">{summary.weakestPlatform?.name || '-'}</p>
              <p className="text-xs text-red-400">{summary.weakestPlatform?.rate || 0}%</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 text-center">
              <p className="text-xs text-slate-300">콘텐츠 갭</p>
              <p className="text-2xl font-bold">{summary.contentGapCount || 0}건</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이번 주 목표 */}
      {weeklyGoals.length > 0 && (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              이번 주 목표
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {weeklyGoals.map((goal: string, i: number) => (
                <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-brand-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{goal}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 액션 아이템 */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            실행 과제 ({actions.length}개)
          </h3>
          <p className="text-xs text-slate-500 mb-4">우선순위 순으로 정렬된 이번 주 실행 과제</p>

          {actions.length > 0 ? (
            <div className="space-y-4">
              {actions.map((action: any, i: number) => (
                <div
                  key={i}
                  className={`border-l-4 rounded-2xl p-4 ${priorityStyles[action.priority] || 'border-l-gray-300 bg-slate-50/50'}`}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-lg">{categoryIcons[action.category] || '📋'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-sm border text-slate-600 font-medium">
                      {action.category}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {action.deadline}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">{action.title}</h4>
                  <p className="text-sm text-slate-600 mb-2">{action.description}</p>
                  <p className="text-xs text-brand-600 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    예상 효과: {action.expectedImpact}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">현재 긴급 액션 아이템이 없습니다!</p>
              <p className="text-sm text-slate-400 mt-1">AI 가시성이 잘 관리되고 있어요 👏</p>
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
            <p className="text-sm text-slate-700">
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

// ==================== 신규 인용 채널 탐지 ====================
const channelCategoryConfig: Record<string, { label: string; color: string; desc: string }> = {
  social: { label: '소셜', color: 'bg-pink-100 text-pink-700', desc: '소셜 플랫폼 — 캡션 공식 적용 대상' },
  directory: { label: '디렉토리', color: 'bg-blue-100 text-blue-700', desc: '병원 정보/예약/가격비교 — 프로필 정비 대상' },
  hospital_site: { label: '병원 사이트', color: 'bg-amber-100 text-amber-700', desc: '경쟁 병원 자사 사이트 — 콘텐츠 공세 감시' },
  satellite_suspect: { label: '⚠️ 위성 의심', color: 'bg-red-100 text-red-700', desc: '어뷰징성 위성 사이트(PBN) 의심 — 감시 대상' },
  wiki_media: { label: '위키/미디어', color: 'bg-purple-100 text-purple-700', desc: '위키·언론·기관 — 프로필 등재 검토' },
  other: { label: '기타', color: 'bg-slate-100 text-slate-600', desc: '' },
};

function NewChannels({ data }: { data: any }) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const channels = (data?.channels || []).filter(
    (c: any) => !categoryFilter || c.category === categoryFilter,
  );
  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{totals.newDomains ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">신규 채널 (최근 {data?.windowDays}일)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{totals.surgingDomains ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">급성장 채널 (5배+)</p>
          </CardContent>
        </Card>
        <Card className={totals.satelliteSuspects > 0 ? 'border-red-200 bg-red-50/40' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totals.satelliteSuspects ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">위성 사이트 의심</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{totals.recentDomains ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">활성 인용 도메인 전체</p>
          </CardContent>
        </Card>
      </div>

      {/* 위성 사이트 경고 배너 */}
      {totals.satelliteSuspects > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-red-700">위성 사이트(PBN) 의심 채널 {totals.satelliteSuspects}개 감지.</span>{' '}
              익명 도메인에 특정 병원 홍보성 콘텐츠를 올려 AI 인용을 노리는 패턴입니다.
              AI 플랫폼이 정화하면 해당 채널 의존 병원의 가시성이 급락할 수 있으니, 감시만 하고 모방하지 마세요.
            </div>
          </CardContent>
        </Card>
      )}

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!categoryFilter ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter(null)}
        >
          전체 ({data?.channels?.length ?? 0})
        </Button>
        {Object.entries(channelCategoryConfig).map(([key, cfg]) => {
          const count = (data?.channels || []).filter((c: any) => c.category === key).length;
          if (count === 0) return null;
          return (
            <Button
              key={key}
              variant={categoryFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
            >
              {cfg.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* 채널 리스트 */}
      {channels.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            최근 {data?.windowDays}일간 새로 나타난 인용 채널이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((ch: any) => {
            const cfg = channelCategoryConfig[ch.category] || channelCategoryConfig.other;
            const topPlatforms = Object.entries(ch.platforms as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <Card key={ch.domain} className={ch.category === 'satellite_suspect' ? 'border-red-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ch.status === 'NEW' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                      {ch.status === 'NEW' ? '🆕 신규' : `📈 급성장${ch.growthX ? ` ×${ch.growthX}` : ''}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    {ch.isOurs && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">우리 병원</span>
                    )}
                    <a
                      href={`https://${ch.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-slate-800 hover:text-brand-600 flex items-center gap-1"
                    >
                      {ch.domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 mb-2">
                    <span>인용 <b className="text-slate-800">{ch.recentCount}회</b>{ch.baselineCount > 0 && <span className="text-slate-400"> (이전 {ch.baselineCount}회)</span>}</span>
                    <span>우리 병원 언급 동반율 <b className={ch.mentionRate >= 50 ? 'text-green-600' : ch.mentionRate >= 20 ? 'text-amber-600' : 'text-red-600'}>{ch.mentionRate}%</b></span>
                    {ch.firstSeenAt && <span>첫 등장 {new Date(ch.firstSeenAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
                    <span className="flex gap-1">
                      {topPlatforms.map(([p, c]) => (
                        <span key={p} className={`px-1.5 rounded ${platformBgColors[p] || 'bg-slate-100 text-slate-600'}`}>
                          {platformNames[p] || p} {c as number}
                        </span>
                      ))}
                    </span>
                  </div>

                  {ch.sampleUrls?.length > 0 && (
                    <div className="text-xs text-slate-400 space-y-0.5">
                      {ch.sampleUrls.slice(0, 2).map((s: any) => (
                        <div key={s.url} className="truncate">
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">
                            {decodeURIComponent(s.url).slice(0, 90)}
                          </a>
                          <span className="ml-1">({s.count}회)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {cfg.desc && <p className="text-xs text-slate-400 mt-2">{cfg.desc}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        최근 {data?.windowDays}일 vs 이전 {data?.baselineDays}일 비교 · 최소 {data?.minCitations}회 인용 기준 · 6시간마다 갱신
      </p>
    </div>
  );
}
