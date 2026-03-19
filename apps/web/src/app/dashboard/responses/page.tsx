'use client';

import { useState } from 'react';
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
  const { data: responseData, isLoading, error: queryError, status: queryStatus, fetchStatus } = useQuery({
    queryKey: ['responses', hospitalId, selectedPlatform, mentionFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (selectedPlatform) params.platform = selectedPlatform;
      if (mentionFilter === 'mentioned') params.mentioned = 'true';
      if (mentionFilter === 'not_mentioned') params.mentioned = 'false';
      
      const startTime = Date.now();
      console.log('[AI 응답] API 호출 시작', { hospitalId, params });
      
      const res = await crawlerApi.getResponses(hospitalId!, params);
      const elapsed = Date.now() - startTime;
      
      console.log('[AI 응답] API 응답', {
        elapsed: `${elapsed}ms`,
        status: res.status,
        dataType: typeof res.data,
        isArray: Array.isArray(res.data),
        total: res.data?.total,
        dataLen: Array.isArray(res.data) ? res.data.length : res.data?.data?.length,
        raw200: JSON.stringify(res.data).substring(0, 200),
      });
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
        {/* 디버그 정보 (임시) */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs font-mono space-y-1">
          <p>🔍 hospitalId: {hospitalId || 'null'}</p>
          <p>📡 queryStatus: {queryStatus} | fetchStatus: {fetchStatus}</p>
          <p>📦 responseData type: {typeof responseData} | isArray: {String(Array.isArray(responseData))}</p>
          <p>📊 data.length: {responseData?.data?.length ?? 'N/A'} | total: {responseData?.total ?? 'N/A'}</p>
          <p>🔢 responses: {responses?.length ?? 0} | filtered: {filteredResponses?.length ?? 0}</p>
          {queryError && (
            <div className="text-red-600 space-y-1">
              <p>❌ Error: {(queryError as any)?.message}</p>
              <p>❌ Status: {(queryError as any)?.response?.status || 'N/A'}</p>
              <p>❌ Code: {(queryError as any)?.code || 'N/A'}</p>
              <p>❌ Data: {JSON.stringify((queryError as any)?.response?.data)?.substring(0, 200) || 'N/A'}</p>
            </div>
          )}
          {responseData?.error && <p className="text-amber-600">⚠️ API Error: {responseData.error}</p>}
          <p className="text-gray-400 break-all">raw: {JSON.stringify(responseData)?.substring(0, 300) || 'undefined'}</p>
        </div>

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
      </div>
    </div>
  );
}
