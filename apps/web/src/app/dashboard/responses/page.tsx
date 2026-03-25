'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Bot,
  Search,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  Clock,
  Award,
  Loader2,
  MessageSquare,
  Sparkles,
  Calendar,
  Globe,
  CheckCircle,
  XCircle,
  Filter,
  Zap,
  Send,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Link2,
} from 'lucide-react';
import Link from 'next/link';

const platformColors: Record<string, string> = {
  CHATGPT: 'bg-green-100 text-green-800',
  CLAUDE: 'bg-orange-100 text-orange-800',
  PERPLEXITY: 'bg-blue-100 text-blue-800',
  GEMINI: 'bg-purple-100 text-purple-800',
};

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
};

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStrFormatted = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  if (diffHours < 1) {
    const diffMin = Math.floor(diffMs / (1000 * 60));
    return { relative: `${diffMin}분 전`, full: `${dateStrFormatted} ${timeStr}` };
  }
  if (diffHours < 24) {
    return { relative: `${diffHours}시간 전`, full: `오늘 ${timeStr}` };
  }
  if (diffDays < 7) {
    return { relative: `${diffDays}일 전`, full: `${dateStrFormatted} ${timeStr}` };
  }
  return { relative: dateStrFormatted, full: `${dateStrFormatted} ${timeStr}` };
}

export default function ResponsesPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mentionFilter, setMentionFilter] = useState<'all' | 'mentioned' | 'not_mentioned'>('all');

  // AI 응답 목록 조회
  const { data: responseData, isLoading, error: queryError } = useQuery({
    queryKey: ['responses', hospitalId, selectedPlatform, mentionFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (selectedPlatform) params.platform = selectedPlatform;
      if (mentionFilter === 'mentioned') params.mentioned = 'true';
      if (mentionFilter === 'not_mentioned') params.mentioned = 'false';
      
      const res = await crawlerApi.getResponses(hospitalId!, params);
      return res.data;
    },
    enabled: !!hospitalId,
    staleTime: 1000 * 60 * 2,
    retry: 1, // 타임아웃 시 재시도 최소화
    retryDelay: 2000,
  });

  // 새 API 포맷 지원 (data 배열 또는 직접 배열 둘 다 호환)
  const responses = Array.isArray(responseData) ? responseData : (responseData?.data || []);

  const filteredResponses = (responses || []).filter((response: any) => {
    // 서버 사이드 필터링 적용되었으므로 검색만 프론트에서 처리
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      response.prompt?.promptText?.toLowerCase().includes(searchLower) ||
      response.responseText?.toLowerCase().includes(searchLower)
    );
  });

  // 통계 계산
  const totalCount = responseData?.total || responses?.length || 0;
  const mentionedCount = (responses || []).filter((r: any) => r.isMentioned).length;
  const webSearchCount = (responses || []).filter((r: any) => r.isWebSearch).length;

  const getSentimentIcon = (label: string) => {
    switch (label) {
      case 'POSITIVE':
        return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case 'NEGATIVE':
        return <ThumbsDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSentimentText = (label: string) => {
    switch (label) {
      case 'POSITIVE': return '긍정';
      case 'NEGATIVE': return '부정';
      default: return '중립';
    }
  };

  // === 실시간 질문 상태 ===
  const [liveQuestion, setLiveQuestion] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState<any>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [livePlatforms, setLivePlatforms] = useState<string[]>(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI']);
  const [liveExpandedPlatform, setLiveExpandedPlatform] = useState<string | null>(null);
  const [liveHistory, setLiveHistory] = useState<any[]>([]);
  const liveInputRef = useRef<HTMLInputElement>(null);

  const toggleLivePlatform = (platform: string) => {
    setLivePlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform) 
        : [...prev, platform]
    );
  };

  const handleLiveQuery = async () => {
    if (!hospitalId || !liveQuestion.trim() || liveLoading) return;
    if (livePlatforms.length === 0) {
      setLiveError('최소 1개 이상의 AI 플랫폼을 선택해주세요');
      return;
    }

    setLiveLoading(true);
    setLiveError(null);
    setLiveResults(null);

    try {
      const res = await crawlerApi.liveQuery(hospitalId, {
        question: liveQuestion.trim(),
        platforms: livePlatforms,
      });
      setLiveResults(res.data);
      // 히스토리에 추가 (최근 5개)
      setLiveHistory(prev => [res.data, ...prev].slice(0, 5));
    } catch (err: any) {
      setLiveError(err?.response?.data?.message || err?.message || 'AI 질의 중 오류가 발생했습니다');
    } finally {
      setLiveLoading(false);
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="AI 응답" description="AI 플랫폼들의 응답을 확인합니다" />
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                AI 응답을 확인하려면 먼저 병원 정보를 등록해주세요.
              </p>
              <Button onClick={() => window.location.href = '/onboarding'}>
                병원 등록하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="AI 응답" description="AI 플랫폼들의 응답 내역을 확인합니다" />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* 상단 통계 요약 */}
        {totalCount > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                <p className="text-xs text-gray-500">전체 응답</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{mentionedCount}</p>
                <p className="text-xs text-gray-500">
                  언급됨 ({totalCount > 0 ? Math.round((mentionedCount / totalCount) * 100) : 0}%)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{webSearchCount}</p>
                <p className="text-xs text-gray-500">웹검색 기반</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 필터 영역 */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={selectedPlatform === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform(null)}
                className="flex-shrink-0"
              >
                전체
              </Button>
              {['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'].map((platform) => (
                <Button
                  key={platform}
                  variant={selectedPlatform === platform ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPlatform(platform)}
                  className="flex-shrink-0"
                >
                  {platformNames[platform]}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="응답 내용 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
          </div>

          {/* 언급 필터 */}
          <div className="flex gap-2">
            <Button
              variant={mentionFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMentionFilter('all')}
              className="text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              전체
            </Button>
            <Button
              variant={mentionFilter === 'mentioned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMentionFilter('mentioned')}
              className="text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              언급됨만
            </Button>
            <Button
              variant={mentionFilter === 'not_mentioned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMentionFilter('not_mentioned')}
              className="text-xs"
            >
              <XCircle className="h-3 w-3 mr-1" />
              언급 안됨
            </Button>
          </div>
        </div>

        {/* 응답 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : queryError ? (
          /* Error State */
          <Card>
            <CardContent className="p-8 sm:p-16 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  응답 데이터를 불러올 수 없습니다
                </h3>
                <p className="text-gray-500 mb-4">
                  서버 연결이 불안정합니다. 잠시 후 다시 시도해주세요.
                </p>
                <Button onClick={() => window.location.reload()}>
                  <Loader2 className="h-4 w-4 mr-2" />
                  새로고침
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredResponses.length === 0 ? (
          /* Empty State */
          <Card>
            <CardContent className="p-8 sm:p-16 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {searchTerm ? '검색 결과가 없습니다' : '아직 AI 응답이 없습니다'}
                </h3>
                {searchTerm ? (
                  <p className="text-gray-500 mb-6">
                    다른 검색어를 시도해보세요
                  </p>
                ) : (
                  <>
                    <p className="text-gray-500 mb-2">
                      AI 크롤링이 실행되면 ChatGPT, Perplexity, Claude, Gemini의
                      응답 내역이 이곳에 표시됩니다.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mb-6">
                      <Calendar className="h-4 w-4" />
                      <span>매일 자동 크롤링 예정</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Link href="/dashboard/prompts">
                        <Button variant="outline">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          질문 등록하기
                        </Button>
                      </Link>
                      <Link href="/dashboard">
                        <Button>
                          대시보드로 이동
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {filteredResponses.length}개 응답
              {searchTerm && ` (검색: "${searchTerm}")`}
              {mentionFilter !== 'all' && ` · ${mentionFilter === 'mentioned' ? '언급됨' : '언급 안됨'} 필터`}
            </p>
            {filteredResponses.map((response: any) => {
              const timeInfo = formatDateTime(response.createdAt || response.responseDate);
              return (
                <Card key={response.id} className={response.isMentioned ? 'border-l-4 border-l-green-400' : ''}>
                  <CardContent className="p-3 sm:p-4">
                    {/* 헤더 */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            platformColors[response.aiPlatform]
                          }`}
                        >
                          {platformNames[response.aiPlatform]}
                        </span>
                        {response.aiModelVersion && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {response.aiModelVersion}
                          </span>
                        )}
                        <span className="text-sm text-gray-500 flex items-center gap-1" title={timeInfo.full}>
                          <Clock className="h-3 w-3" />
                          {timeInfo.full}
                          <span className="text-gray-400 text-xs">({timeInfo.relative})</span>
                        </span>
                        {response.isWebSearch && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                            <Globe className="h-2.5 w-2.5" />
                            웹검색
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {response.isMentioned && (
                          <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                            <Award className="h-4 w-4" />
                            {response.mentionPosition
                              ? `${response.mentionPosition}위로 언급`
                              : '언급됨'}
                          </span>
                        )}
                        {!response.isMentioned && (
                          <span className="text-sm text-gray-400">
                            언급 안됨
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {getSentimentIcon(response.sentimentLabel)}
                          <span className="hidden sm:inline">{getSentimentText(response.sentimentLabel)}</span>
                        </span>
                      </div>
                    </div>

                    {/* 질문 */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        Q: {response.prompt?.promptText || '질문 정보 없음'}
                      </p>
                    </div>

                    {/* 응답 내용 */}
                    <div className="relative">
                      <div
                        className={`text-sm text-gray-600 whitespace-pre-wrap ${
                          expandedId === response.id ? '' : 'line-clamp-6'
                        }`}
                      >
                        {response.responseText}
                      </div>
                      {response.responseText?.length > 400 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedId(expandedId === response.id ? null : response.id)
                          }
                          className="mt-2"
                        >
                          {expandedId === response.id ? '접기' : '더 보기'}
                        </Button>
                      )}
                    </div>

                    {/* 추가 정보 */}
                    <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 pt-3 border-t text-xs text-gray-500">
                      {response.totalRecommendations && (
                        <span className="flex items-center gap-1">
                          총 추천: <strong>{response.totalRecommendations}개</strong>
                        </span>
                      )}
                      {response.competitorsMentioned?.length > 0 && (
                        <span className="flex items-center gap-1">
                          함께 언급: {response.competitorsMentioned.slice(0, 3).join(', ')}
                          {response.competitorsMentioned.length > 3 && ` 외 ${response.competitorsMentioned.length - 3}개`}
                        </span>
                      )}
                      {response.citedSources?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          출처: {response.citedSources.length}개
                        </span>
                      )}
                      {response.recommendationDepth && (
                        <span className="flex items-center gap-1">
                          추천 깊이: <strong>{response.recommendationDepth}</strong>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ============================== */}
        {/* 실시간 AI 질문 섹션 */}
        {/* ============================== */}
        <div className="mt-8 pt-6 border-t-2 border-dashed border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">실시간 AI 질문</h2>
              <p className="text-xs text-gray-500">원하는 질문을 AI에게 직접 물어보고 실시간으로 확인하세요</p>
            </div>
          </div>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
            <CardContent className="p-4 sm:p-6">
              {/* 플랫폼 선택 */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">질문할 AI 플랫폼 선택</p>
                <div className="flex flex-wrap gap-2">
                  {(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'] as const).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => toggleLivePlatform(platform)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        livePlatforms.includes(platform)
                          ? `${platformColors[platform]} ring-2 ring-offset-1 ring-current shadow-sm`
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {platformNames[platform]}
                      {livePlatforms.includes(platform) && (
                        <CheckCircle className="inline h-3 w-3 ml-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 질문 입력 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
                  <Input
                    ref={liveInputRef}
                    placeholder="예: 강남역 임플란트 잘하는 치과 추천해줘"
                    value={liveQuestion}
                    onChange={(e) => setLiveQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLiveQuery()}
                    className="pl-10 pr-4 h-11 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    disabled={liveLoading}
                  />
                </div>
                <Button
                  onClick={handleLiveQuery}
                  disabled={!liveQuestion.trim() || liveLoading || livePlatforms.length === 0}
                  className="h-11 px-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/20"
                >
                  {liveLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      질문하기
                    </>
                  )}
                </Button>
              </div>

              {/* 로딩 상태 */}
              {liveLoading && (
                <div className="mt-4 p-6 bg-white/70 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-center gap-3">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                      <Sparkles className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">AI에게 질문하는 중...</p>
                      <p className="text-xs text-gray-500">
                        {livePlatforms.map(p => platformNames[p]).join(', ')}에 동시에 질문하고 있어요
                      </p>
                    </div>
                  </div>
                  {/* 플랫폼별 로딩 인디케이터 */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {livePlatforms.map((platform) => (
                      <div key={platform} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                        <span className="text-xs text-gray-600">{platformNames[platform]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 에러 */}
              {liveError && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">질의 실패</p>
                    <p className="text-xs text-red-600 mt-1">{liveError}</p>
                  </div>
                </div>
              )}

              {/* 결과 */}
              {liveResults && !liveLoading && (
                <div className="mt-4 space-y-3">
                  {/* 요약 카드 */}
                  <div className="p-4 bg-white rounded-xl border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-bold text-gray-900">질문 결과</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(liveResults.timestamp).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-purple-900">
                        Q: {liveResults.question}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-800">{liveResults.successCount}/{liveResults.totalPlatforms}</p>
                        <p className="text-[10px] text-gray-500">응답 성공</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{liveResults.mentionedCount}</p>
                        <p className="text-[10px] text-gray-500">우리 병원 언급</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-600">{liveResults.mentionRate}%</p>
                        <p className="text-[10px] text-gray-500">언급률</p>
                      </div>
                    </div>
                  </div>

                  {/* 플랫폼별 결과 */}
                  {liveResults.responses?.map((resp: any) => (
                    <div
                      key={resp.platform}
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                        resp.success && resp.isMentioned
                          ? 'border-l-4 border-l-green-400 border-green-100'
                          : resp.success
                          ? 'border-gray-200'
                          : 'border-red-200 bg-red-50/50'
                      }`}
                    >
                      {/* 플랫폼 헤더 */}
                      <button
                        className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                        onClick={() => setLiveExpandedPlatform(
                          liveExpandedPlatform === resp.platform ? null : resp.platform
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${platformColors[resp.platform]}`}>
                            {resp.platformName}
                          </span>
                          {resp.success ? (
                            resp.isMentioned ? (
                              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                <Award className="h-4 w-4" />
                                {resp.mentionPosition ? `${resp.mentionPosition}위 추천` : '언급됨'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">언급 안됨</span>
                            )
                          ) : (
                            <span className="text-sm text-red-500 flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              응답 실패
                            </span>
                          )}
                          {resp.success && resp.sentimentLabel && (
                            <span className="hidden sm:flex items-center gap-1">
                              {getSentimentIcon(resp.sentimentLabel)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {resp.success && resp.totalRecommendations > 0 && (
                            <span className="text-xs text-gray-500 hidden sm:block">
                              총 {resp.totalRecommendations}곳 추천
                            </span>
                          )}
                          {liveExpandedPlatform === resp.platform ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* 펼쳐진 응답 내용 */}
                      {liveExpandedPlatform === resp.platform && resp.success && (
                        <div className="px-3 sm:px-4 pb-4 border-t border-gray-100">
                          <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                            {resp.response}
                          </div>

                          {/* 함께 언급된 경쟁사 */}
                          {resp.competitorsMentioned?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <span className="text-xs text-gray-500 mr-1">함께 언급:</span>
                              {resp.competitorsMentioned.map((comp: string, i: number) => (
                                <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                                  {comp}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 출처 링크 */}
                          {resp.citedSources?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                출처
                              </p>
                              <div className="space-y-1">
                                {resp.citedSources.slice(0, 5).map((url: string, i: number) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
                                  >
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{url}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 다시 질문 */}
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLiveResults(null);
                        setLiveQuestion('');
                        liveInputRef.current?.focus();
                      }}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      새 질문하기
                    </Button>
                  </div>
                </div>
              )}

              {/* 최근 질문 히스토리 */}
              {liveHistory.length > 1 && !liveLoading && (
                <div className="mt-6 pt-4 border-t border-purple-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">최근 질문</p>
                  <div className="space-y-1.5">
                    {liveHistory.slice(1).map((item, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left p-2.5 bg-white/60 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-purple-100"
                        onClick={() => {
                          setLiveResults(item);
                          setLiveQuestion(item.question);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-700 truncate flex-1 mr-2">
                            {item.question}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs font-medium ${
                              item.mentionRate > 50 ? 'text-green-600' : item.mentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'
                            }`}>
                              {item.mentionRate}%
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {item.mentionedCount}/{item.successCount}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
