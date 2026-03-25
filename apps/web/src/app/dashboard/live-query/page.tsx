'use client';

import { useState, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Bot,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  Award,
  Loader2,
  MessageSquare,
  Sparkles,
  CheckCircle,
  XCircle,
  Zap,
  Send,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Link2,
  History,
  Target,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';

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

const exampleQuestions = [
  '강남역 임플란트 잘하는 치과 추천해줘',
  '서울에서 치아교정 잘하는 곳 알려줘',
  '임플란트 가격 저렴한 치과 추천',
  '무통 치료 잘하는 치과 어디야',
  '라미네이트 후기 좋은 치과',
];

export default function LiveQueryPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI']);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleQuery = async (queryText?: string) => {
    const q = queryText || question;
    if (!hospitalId || !q.trim() || loading) return;
    if (platforms.length === 0) {
      setError('최소 1개 이상의 AI 플랫폼을 선택해주세요');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setExpandedPlatform(null);
    if (queryText) setQuestion(queryText);

    try {
      const res = await crawlerApi.liveQuery(hospitalId, {
        question: q.trim(),
        platforms,
      });
      setResults(res.data);
      setHistory(prev => [res.data, ...prev].slice(0, 10));
      // 첫 번째 성공한 플랫폼 자동 펼치기
      const firstSuccess = res.data.responses?.find((r: any) => r.success);
      if (firstSuccess) setExpandedPlatform(firstSuccess.platform);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'AI 질의 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="실시간 AI 질문" description="AI에게 직접 질문하고 실시간으로 확인하세요" />
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">병원 등록이 필요합니다</h3>
              <p className="text-gray-500 mb-4">실시간 질문을 사용하려면 먼저 병원 정보를 등록해주세요.</p>
              <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="실시간 AI 질문" description="원하는 질문을 AI에게 직접 물어보고 우리 병원이 언급되는지 확인하세요" />

      <div className="p-4 sm:p-6 space-y-6">

        {/* 질문 입력 카드 */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/30 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">AI에게 질문하기</h2>
                <p className="text-xs text-gray-500">환자가 실제로 물어볼 만한 질문을 입력해보세요</p>
              </div>
            </div>

            {/* 플랫폼 선택 */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 mb-2">질문할 AI 플랫폼</p>
              <div className="flex flex-wrap gap-2">
                {(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'] as const).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      platforms.includes(platform)
                        ? `${platformColors[platform]} ring-2 ring-offset-1 ring-current shadow-sm`
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {platformNames[platform]}
                    {platforms.includes(platform) && (
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
                  ref={inputRef}
                  placeholder="예: 강남역 임플란트 잘하는 치과 추천해줘"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                  className="pl-10 pr-4 h-12 text-sm border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  disabled={loading}
                />
              </div>
              <Button
                onClick={() => handleQuery()}
                disabled={!question.trim() || loading || platforms.length === 0}
                className="h-12 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/20"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    질문하기
                  </>
                )}
              </Button>
            </div>

            {/* 예시 질문 */}
            {!results && !loading && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">예시 질문</p>
                <div className="flex flex-wrap gap-2">
                  {exampleQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuestion(q); handleQuery(q); }}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 로딩 상태 */}
        {loading && (
          <Card className="border-purple-100">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                  <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800">AI에게 질문하는 중...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {platforms.map(p => platformNames[p]).join(', ')}에 동시에 질문하고 있어요
                  </p>
                  <p className="text-xs text-gray-400 mt-2">보통 10~30초 정도 소요됩니다</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 w-full max-w-md">
                  {platforms.map((platform) => (
                    <div key={platform} className="flex items-center gap-2 bg-purple-50 rounded-lg p-3 justify-center">
                      <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                      <span className="text-xs font-medium text-purple-700">{platformNames[platform]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 에러 */}
        {error && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">질의 실패</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-red-600 border-red-200"
                  onClick={() => { setError(null); handleQuery(); }}
                >
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  다시 시도
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 결과 */}
        {results && !loading && (
          <div className="space-y-4">
            {/* 요약 카드 */}
            <Card className="border-purple-100 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    <span className="font-bold text-gray-900">질문 결과</span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(results.timestamp).toLocaleString('ko-KR')}
                  </span>
                </div>

                {/* 질문 표시 */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-purple-900">
                    Q: {results.question}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    대상: {results.hospitalName}
                  </p>
                </div>

                {/* 요약 통계 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">
                      {results.successCount}<span className="text-sm font-normal text-gray-400">/{results.totalPlatforms}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">응답 성공</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${results.mentionedCount > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className={`text-2xl font-bold ${results.mentionedCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {results.mentionedCount}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">우리 병원 언급</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    results.mentionRate >= 50 ? 'bg-blue-50' : results.mentionRate > 0 ? 'bg-yellow-50' : 'bg-gray-50'
                  }`}>
                    <p className={`text-2xl font-bold ${
                      results.mentionRate >= 50 ? 'text-blue-600' : results.mentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'
                    }`}>
                      {results.mentionRate}%
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">언급률</p>
                  </div>
                </div>

                {/* 간단 인사이트 */}
                {results.mentionRate > 0 && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100 flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-800">
                      {results.mentionRate >= 75
                        ? '대부분의 AI가 우리 병원을 추천하고 있어요! 현재 전략이 잘 작동하고 있습니다.'
                        : results.mentionRate >= 50
                        ? '절반 이상의 AI에서 언급되고 있어요. 언급되지 않는 플랫폼에 맞는 콘텐츠를 보강해보세요.'
                        : '일부 AI에서 언급되고 있어요. 블로그, 공식 사이트 콘텐츠를 강화하면 노출이 늘어날 수 있습니다.'}
                    </p>
                  </div>
                )}
                {results.mentionRate === 0 && results.successCount > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      이 질문에서는 아직 우리 병원이 언급되지 않고 있어요. 해당 키워드 관련 블로그 포스팅이나 네이버 플레이스 최적화를 시도해보세요.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 플랫폼별 결과 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                플랫폼별 응답
              </h3>

              {results.responses?.map((resp: any) => (
                <Card
                  key={resp.platform}
                  className={`overflow-hidden transition-all ${
                    resp.success && resp.isMentioned
                      ? 'border-l-4 border-l-green-400 border-green-100'
                      : resp.success
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  {/* 플랫폼 헤더 */}
                  <button
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedPlatform(
                      expandedPlatform === resp.platform ? null : resp.platform
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${platformColors[resp.platform]}`}>
                        {resp.platformName}
                      </span>
                      {resp.success ? (
                        resp.isMentioned ? (
                          <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
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
                      {expandedPlatform === resp.platform ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* 펼쳐진 응답 내용 */}
                  {expandedPlatform === resp.platform && resp.success && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                        {resp.response}
                      </div>

                      {/* 함께 언급된 경쟁사 */}
                      {resp.competitorsMentioned?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-gray-500 mr-1">함께 언급된 병원:</span>
                          {resp.competitorsMentioned.map((comp: string, i: number) => (
                            <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
                              {comp}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 출처 링크 */}
                      {resp.citedSources?.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                          <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            출처 ({resp.citedSources.length}개)
                          </p>
                          <div className="space-y-1.5">
                            {resp.citedSources.slice(0, 5).map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{url}</span>
                              </a>
                            ))}
                            {resp.citedSources.length > 5 && (
                              <p className="text-xs text-gray-400">... 외 {resp.citedSources.length - 5}개</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* 새 질문 버튼 */}
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResults(null);
                  setQuestion('');
                  setExpandedPlatform(null);
                  inputRef.current?.focus();
                }}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Zap className="h-4 w-4 mr-2" />
                새 질문하기
              </Button>
            </div>
          </div>
        )}

        {/* 질문 히스토리 */}
        {history.length > 0 && !loading && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-700">최근 질문 기록</h3>
                <span className="text-xs text-gray-400">({history.length}개)</span>
              </div>
              <div className="space-y-2">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      results === item
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                    }`}
                    onClick={() => {
                      setResults(item);
                      setQuestion(item.question);
                      const firstSuccess = item.responses?.find((r: any) => r.success);
                      if (firstSuccess) setExpandedPlatform(firstSuccess.platform);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-800 truncate flex-1">
                        {item.question}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* 플랫폼별 미니 결과 */}
                        <div className="hidden sm:flex gap-1">
                          {item.responses?.map((r: any) => (
                            <div
                              key={r.platform}
                              className={`w-2 h-2 rounded-full ${
                                r.success && r.isMentioned
                                  ? 'bg-green-400'
                                  : r.success
                                  ? 'bg-gray-300'
                                  : 'bg-red-300'
                              }`}
                              title={`${r.platformName}: ${r.success ? (r.isMentioned ? '언급됨' : '언급 안됨') : '실패'}`}
                            />
                          ))}
                        </div>
                        <span className={`text-xs font-bold min-w-[40px] text-right ${
                          item.mentionRate >= 50 ? 'text-green-600' : item.mentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'
                        }`}>
                          {item.mentionRate}%
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
