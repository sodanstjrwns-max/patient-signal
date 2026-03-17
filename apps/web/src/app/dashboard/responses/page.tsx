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

export default function ResponsesPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI 응답 목록 조회
  const { data: responses, isLoading } = useQuery({
    queryKey: ['responses', hospitalId, selectedPlatform],
    queryFn: () =>
      crawlerApi.getResponses(hospitalId!, selectedPlatform || undefined).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const filteredResponses = (responses || []).filter((response: any) => {
    if (selectedPlatform && response.aiPlatform !== selectedPlatform) return false;
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      response.prompt?.promptText?.toLowerCase().includes(searchLower) ||
      response.responseText?.toLowerCase().includes(searchLower)
    );
  });

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
        {/* 필터 영역 */}
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

        {/* 응답 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
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
                      <span>매주 월/목 자동 크롤링 예정</span>
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
          <div className="space-y-4">
            {filteredResponses.map((response: any) => (
              <Card key={response.id}>
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
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(response.responseDate).toLocaleDateString('ko-KR')}
                      </span>
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
                      {getSentimentIcon(response.sentimentLabel)}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
