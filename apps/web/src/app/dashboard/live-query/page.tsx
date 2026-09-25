'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { WorkspaceIntro } from '@/components/dashboard/WorkspaceIntro';
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
  Gauge,
  Clock,
  ArrowUpCircle,
  Shield,
  PieChart,
  ArrowRight,
  Stethoscope,
  Heart,
  DollarSign,
  MapPin,
  MessageCircle,
  GitCompare,
  HelpCircle,
} from 'lucide-react';

// ==================== 상수 ====================

const platformColors: Record<string, string> = {
  CHATGPT: 'bg-[#352115] text-[#ff9565]',
  CLAUDE: 'bg-orange-100 text-orange-800',
  PERPLEXITY: 'bg-[#352115] text-[#ff9565]',
  GEMINI: 'bg-[#181b1e] text-[#f5f5ef]',
  GROK: 'bg-[#30343a] text-[#f5f5ef]',
  CLOVA_X: 'bg-[#352115] text-[#ff9565]',
};

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  CLOVA_X: 'CLOVA X',
};

// 【2026.08.19 가격 최종본】티어명 S/M/L 통일
const planDisplayNames: Record<string, string> = {
  FREE: '무료',
  STARTER: 'S',
  STANDARD: 'M',
  PRO: 'L',
  ENTERPRISE: '별도(엔터프라이즈)',
};

const categoryConfig: Record<string, { name: string; icon: any; color: string; bgColor: string; emoji: string }> = {
  PROCEDURE: { name: '시술/진료', icon: Stethoscope, color: 'text-[#ff9565]', bgColor: 'bg-[#281a13] border-[#30343a]', emoji: '🦷' },
  EMOTION:   { name: '감성/경험', icon: Heart, color: 'text-[#c0c4c7]', bgColor: 'bg-[#08090a] border-[#30343a]', emoji: '💝' },
  COST:      { name: '비용/가격', icon: DollarSign, color: 'text-[#ff9565]', bgColor: 'bg-[#281a13] border-[#30343a]', emoji: '💰' },
  REGION:    { name: '지역 기반', icon: MapPin, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', emoji: '📍' },
  REVIEW:    { name: '후기/평판', icon: MessageCircle, color: 'text-yellow-400', bgColor: 'bg-[#282418] border-yellow-200', emoji: '⭐' },
  COMPARISON:{ name: '비교', icon: GitCompare, color: 'text-[#c0c4c7]', bgColor: 'bg-[#08090a] border-[#30343a]', emoji: '⚖️' },
  GENERAL:   { name: '기타', icon: HelpCircle, color: 'text-[#c0c4c7]', bgColor: 'bg-[#08090a] border-[#30343a]', emoji: '📋' },
};

const exampleQuestions = [
  '강남역 임플란트 잘하는 병원 추천해줘',
  '서울에서 치아교정 잘하는 곳 알려줘',
  '임플란트 가격 저렴한 병원 추천',
  '무서운데 친절한 병원 어디야',
  '라미네이트 후기 좋은 병원',
];

const getSentimentIcon = (label: string) => {
  switch (label) {
    case 'POSITIVE': return <ThumbsUp className="h-4 w-4 text-[#ff9565]" />;
    case 'NEGATIVE': return <ThumbsDown className="h-4 w-4 text-red-400" />;
    default: return <Minus className="h-4 w-4 text-[#959c9f]" />;
  }
};

// ==================== 타입 ====================

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited?: boolean;
}

// ==================== 컴포넌트 ====================

export default function LiveQueryPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  // 질문 관련 상태
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK', 'CLOVA_X']);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 사용량 상태
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [planType, setPlanType] = useState<string>('FREE');
  const [cooldownError, setCooldownError] = useState<string | null>(null);
  const [limitReachedError, setLimitReachedError] = useState<any>(null);

  // 사용량 조회
  const fetchUsage = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const res = await crawlerApi.getLiveQueryUsage(hospitalId);
      setUsage(res.data.usage);
      setPlanType(res.data.planType);
    } catch { /* 무시 */ }
  }, [hospitalId]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const togglePlatform = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
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
    setCooldownError(null);
    setLimitReachedError(null);
    setResults(null);
    setExpandedPlatform(null);
    if (queryText) setQuestion(queryText);

    try {
      const res = await crawlerApi.liveQuery(hospitalId, { question: q.trim(), platforms });
      const data = res.data;

      if (data.success === false) {
        if (data.error === 'DAILY_LIMIT_REACHED') {
          setLimitReachedError(data);
          if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit, remaining: 0, isUnlimited: false });
        } else if (data.error === 'COOLDOWN_ACTIVE') {
          setCooldownError(data.message);
          if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit, remaining: data.usage.remaining, isUnlimited: data.usage.limit === -1 });
        } else {
          setError(data.message || data.error || 'AI 질의 중 오류가 발생했습니다');
        }
        return;
      }

      setResults(data);
      setHistory(prev => [data, ...prev].slice(0, 10));
      if (data.usage) setUsage(data.usage);
      else fetchUsage();

      const firstSuccess = data.responses?.find((r: any) => r.success);
      if (firstSuccess) setExpandedPlatform(firstSuccess.platform);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'AI 질의 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const usagePercent = usage
    ? usage.isUnlimited ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;
  const isLimitReached = usage && !usage.isUnlimited && usage.remaining <= 0;

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="실시간 AI 질문" description="AI에게 직접 질문하고 실시간으로 확인하세요" />
        <div className="p-4 sm:p-6">
          <Card><CardContent className="p-8 sm:p-12 text-center">
            <Bot className="h-12 w-12 text-[#959c9f] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#f5f5ef] mb-2">병원 등록이 필요합니다</h3>
            <p className="text-[#959c9f] mb-4">실시간 질문을 사용하려면 먼저 병원 정보를 등록해주세요.</p>
            <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="실시간 AI 질문" description="AI에게 직접 질문하고 카테고리별 언급 성과를 분석하세요" />

      <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 sm:px-8 xl:px-10">
        <WorkspaceIntro eyebrow="LIVE QUERY" title="지금, AI에 물어보세요." description="궁금한 질문을 입력하고 플랫폼별 답변을 나란히 확인하세요." />


        {/* 사용량 배너 */}
        {usage && (
          <Card className={`border ${isLimitReached ? 'border-red-200 bg-[#291718]/50' : usagePercent >= 80 ? 'border-yellow-200 bg-[#282418]/30' : 'border-[#30343a] bg-[#111315] '}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-[#959c9f]" />
                  <span className="text-sm font-semibold text-[#c0c4c7]">오늘 사용량</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planType === 'PRO' || planType === 'ENTERPRISE' ? 'bg-[#352115] text-[#ff9565]' : planType === 'STANDARD' || planType === 'STARTER' ? 'bg-[#352115] text-[#ff9565]' : 'bg-[#181b1e] text-[#c0c4c7]'}`}>
                    {planDisplayNames[planType] || planType}
                  </span>
                </div>
                {usage.isUnlimited ? (
                  <span className="text-sm font-bold text-[#ff9565] flex items-center gap-1"><Shield className="h-3.5 w-3.5" />무제한</span>
                ) : (
                  <span className={`text-sm font-bold ${isLimitReached ? 'text-red-400' : usagePercent >= 80 ? 'text-yellow-400' : 'text-[#f5f5ef]'}`}>{usage.used} / {usage.limit}회</span>
                )}
              </div>
              {!usage.isUnlimited && (
                <div className="w-full bg-[#30343a] rounded-full h-2 mb-2">
                  <div className={`h-2 rounded-full transition-all duration-300 ${isLimitReached ? 'bg-red-500' : usagePercent >= 80 ? 'bg-yellow-500' : 'bg-brand-500'}`} style={{ width: `${usagePercent}%` }} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className={`text-xs ${isLimitReached ? 'text-red-400' : 'text-[#959c9f]'}`}>
                  {usage.isUnlimited ? '별도(엔터프라이즈) 플랜은 무제한' : isLimitReached ? '오늘 소진 완료. 자정에 초기화.' : `남은 횟수: ${usage.remaining}회`}
                </p>
                {planType !== 'ENTERPRISE' && planType !== 'PRO' && (
                  <button onClick={() => window.location.href = '/dashboard/settings'} className="text-xs text-[#ff9565] hover:text-[#ff9565] font-medium flex items-center gap-1">
                    <ArrowUpCircle className="h-3 w-3" />업그레이드
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 카테고리 성과 바로가기 배너 */}
        <button
          onClick={() => window.location.href = '/dashboard/opportunities?tab=category'}
          className="w-full flex items-center justify-between p-3.5 bg-[#281a13] border border-[#30343a] rounded-md hover:bg-[#352115] transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <PieChart className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-semibold text-[#f5f5ef]">카테고리별 성과 분석</span>
            <span className="text-[10px] bg-[#352115] text-[#ff9565] px-1.5 py-0.5 rounded-full">실시간 + 크롤링 통합</span>
          </div>
          <ArrowRight className="h-4 w-4 text-brand-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* ==================== 질문 영역 ==================== */}
            {/* 질문 입력 카드 */}
            <Card className="overflow-hidden border-[#30343a] border-t-4 border-t-[#30343a] bg-[#111315] shadow-none">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3 border-b border-[#30343a] pb-5 mb-5">
                  <div className="w-10 h-10 rounded-none bg-[#08090a] flex items-center justify-center shadow-none">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-[-0.04em] text-[#f5f5ef]">AI에게 질문하기</h2>
                    <p className="text-xs text-[#959c9f]">환자가 실제로 물어볼 만한 질문을 입력해보세요</p>
                  </div>
                </div>

                {/* 플랫폼 선택 */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-[#c0c4c7] mb-2">질문할 AI 플랫폼</p>
                  <div className="flex flex-wrap gap-2">
                    {(['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK', 'CLOVA_X'] as const).map(platform => (
                      <button key={platform} onClick={() => togglePlatform(platform)} aria-pressed={platforms.includes(platform)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${platforms.includes(platform) ? `${platformColors[platform]} ring-2 ring-offset-1 ring-current shadow-sm` : 'bg-[#181b1e] text-[#959c9f] hover:bg-[#30343a]'}`}>
                        {platformNames[platform]}
                        {platforms.includes(platform) && <CheckCircle className="inline h-3 w-3 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 질문 입력 */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
                    <Input ref={inputRef} placeholder="예: 강남역 임플란트 잘하는 병원 추천해줘"
                      value={question} onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isLimitReached && handleQuery()}
                      className="pl-10 pr-4 h-12 text-sm border-[#30343a] focus:border-brand-400 focus:ring-brand-400"
                      disabled={loading || !!isLimitReached} />
                  </div>
                  <Button onClick={() => handleQuery()}
                    disabled={!question.trim() || loading || platforms.length === 0 || !!isLimitReached}
                    className="h-12 px-6 bg-brand-600 hover:bg-brand-700 shadow-none disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLimitReached ? <><XCircle className="h-4 w-4 mr-1.5" />소진</> : <><Send className="h-4 w-4 mr-1.5" />질문하기</>}
                  </Button>
                </div>

                {/* 예시 질문 */}
                {!results && !loading && !isLimitReached && (
                  <div className="mt-4">
                    <p className="text-xs text-[#959c9f] mb-2">예시 질문</p>
                    <div className="flex flex-wrap gap-2">
                      {exampleQuestions.map((q, i) => (
                        <button key={i} onClick={() => { setQuestion(q); handleQuery(q); }}
                          className="text-xs px-3 py-1.5 bg-[#111315] border border-[#30343a] rounded-full hover:border-brand-300 hover:bg-[#281a13] text-[#c0c4c7] hover:text-[#ff9565] transition-all">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 제한 도달 */}
            {limitReachedError && (
              <Card className="border-red-200 bg-[#291718]">
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#3a2022] mb-4">
                    <AlertCircle className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-red-400 mb-2">오늘 사용량을 모두 소진했어요</h3>
                  <p className="text-sm text-red-400 mb-1">{limitReachedError.message}</p>
                  <p className="text-xs text-[#959c9f] mb-4">매일 자정(00:00)에 초기화됩니다.</p>
                  {limitReachedError.upgradeHint && (
                    <Button size="sm" className="bg-brand-600" onClick={() => window.location.href = '/dashboard/settings'}>
                      <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" />플랜 업그레이드
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 쿨다운 */}
            {cooldownError && (
              <Card className="border-yellow-200 bg-[#282418]/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">같은 질문 쿨다운 중</p>
                    <p className="text-xs text-yellow-400 mt-1">{cooldownError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 로딩 */}
            {loading && (
              <Card className="border-[#30343a]">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
                      <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[#f5f5ef]">AI에게 질문하는 중...</p>
                      <p className="text-sm text-[#959c9f] mt-1">{platforms.map(p => platformNames[p]).join(', ')}에 동시 질문 중</p>
                      <p className="text-xs text-[#959c9f] mt-2">보통 10~30초 소요</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 에러 */}
            {error && (
              <Card className="border-red-200 bg-[#291718]/50">
                <CardContent className="p-5 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">질의 실패</p>
                    <p className="text-xs text-red-400 mt-1">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3 text-red-400 border-red-200" onClick={() => { setError(null); handleQuery(); }}>
                      <RotateCcw className="h-3 w-3 mr-1.5" />다시 시도
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 결과 */}
            {results && !loading && (
              <div className="space-y-4">
                {/* 요약 카드 */}
                <Card className="border-[#30343a] shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-brand-500" />
                        <span className="font-bold text-[#f5f5ef]">질문 결과</span>
                        {/* 카테고리 뱃지 */}
                        {results.category && categoryConfig[results.category] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${categoryConfig[results.category].bgColor} ${categoryConfig[results.category].color}`}>
                            {categoryConfig[results.category].emoji} {categoryConfig[results.category].name}
                            {results.categoryTag && results.categoryTag !== '기타' && ` · ${results.categoryTag}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {usage && !usage.isUnlimited && (
                          <span className="text-[10px] text-[#959c9f] bg-[#181b1e] px-2 py-0.5 rounded-full">{usage.remaining}회 남음</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#281a13] rounded-md p-4 mb-4">
                      <p className="text-sm font-medium text-[#ff9565]">Q: {results.question}</p>
                      <p className="text-xs text-[#ff9565] mt-1">대상: {results.hospitalName}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-[#08090a] rounded-md p-3 text-center">
                        <p className="text-2xl font-bold text-[#f5f5ef]">{results.successCount}<span className="text-sm font-normal text-[#959c9f]">/{results.totalPlatforms}</span></p>
                        <p className="text-[10px] text-[#959c9f] mt-0.5">응답 성공</p>
                      </div>
                      <div className={`rounded-md p-3 text-center ${results.mentionedCount > 0 ? 'bg-[#281a13]' : 'bg-[#08090a]'}`}>
                        <p className={`text-2xl font-bold ${results.mentionedCount > 0 ? 'text-[#ff9565]' : 'text-[#959c9f]'}`}>{results.mentionedCount}</p>
                        <p className="text-[10px] text-[#959c9f] mt-0.5">우리 병원 언급</p>
                      </div>
                      <div className={`rounded-md p-3 text-center ${results.mentionRate >= 50 ? 'bg-[#281a13]' : results.mentionRate > 0 ? 'bg-[#282418]' : 'bg-[#08090a]'}`}>
                        <p className={`text-2xl font-bold ${results.mentionRate >= 50 ? 'text-[#ff9565]' : results.mentionRate > 0 ? 'text-yellow-400' : 'text-[#959c9f]'}`}>{results.mentionRate}%</p>
                        <p className="text-[10px] text-[#959c9f] mt-0.5">언급률</p>
                      </div>
                    </div>

                    {results.mentionRate > 0 && (
                      <div className="mt-4 p-3 bg-[#281a13] rounded-lg border border-[#30343a] flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-[#ff9565] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[#ff9565]">
                          {results.mentionRate >= 75 ? '대부분의 AI가 우리 병원을 추천하고 있어요!'
                            : results.mentionRate >= 50 ? '절반 이상의 AI에서 언급되고 있어요.'
                            : '일부 AI에서 언급되고 있어요. 콘텐츠 강화를 추천합니다.'}
                        </p>
                      </div>
                    )}
                    {results.mentionRate === 0 && results.successCount > 0 && (
                      <div className="mt-4 p-3 bg-[#282418] rounded-lg border border-yellow-100 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-400">이 질문에서는 아직 우리 병원이 언급되지 않고 있어요.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 플랫폼별 결과 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#c0c4c7] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" />플랫폼별 응답
                  </h3>
                  {results.responses?.map((resp: any) => (
                    <Card key={resp.platform} className={`overflow-hidden transition-all ${resp.success && resp.isMentioned ? 'border-l-4 border-l-green-400 border-[#30343a]' : resp.success ? 'border-[#30343a] hover:border-[#30343a]' : 'border-red-200 bg-[#291718]/30'}`}>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-[#08090a] transition-colors"
                        onClick={() => setExpandedPlatform(expandedPlatform === resp.platform ? null : resp.platform)}>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${platformColors[resp.platform]}`}>{resp.platformName}</span>
                          {resp.success ? (
                            resp.isMentioned ? <span className="flex items-center gap-1.5 text-sm text-[#ff9565] font-semibold"><Award className="h-4 w-4" />{resp.mentionPosition ? `${resp.mentionPosition}위 추천` : '언급됨'}</span>
                              : <span className="text-sm text-[#959c9f]">언급 안됨</span>
                          ) : <span className="text-sm text-red-500 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />응답 실패</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {expandedPlatform === resp.platform ? <ChevronUp className="h-4 w-4 text-[#959c9f]" /> : <ChevronDown className="h-4 w-4 text-[#959c9f]" />}
                        </div>
                      </button>
                      {expandedPlatform === resp.platform && resp.success && (
                        <div className="px-4 pb-4 border-t border-[#30343a]">
                          <div className="mt-3 text-sm text-[#c0c4c7] whitespace-pre-wrap leading-relaxed bg-[#08090a] rounded-md p-4 max-h-[500px] overflow-y-auto">{resp.response}</div>
                          {resp.competitorsMentioned?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-[#959c9f] mr-1">함께 언급:</span>
                              {resp.competitorsMentioned.map((comp: string, i: number) => (
                                <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">{comp}</span>
                              ))}
                            </div>
                          )}
                          {resp.citedSources?.length > 0 && (
                            <div className="mt-3 p-3 bg-[#281a13]/50 rounded-lg border border-[#30343a]">
                              <p className="text-xs font-medium text-[#ff9565] mb-2 flex items-center gap-1"><Link2 className="h-3 w-3" />출처 ({resp.citedSources.length}개)</p>
                              <div className="space-y-1.5">
                                {resp.citedSources.slice(0, 5).map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#ff9565] hover:text-[#ff9565] hover:underline">
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" /><span className="truncate">{url}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => { setResults(null); setQuestion(''); setExpandedPlatform(null); setLimitReachedError(null); setCooldownError(null); inputRef.current?.focus(); }}
                    className="text-[#ff9565] border-[#30343a] hover:bg-[#281a13]">
                    <Zap className="h-4 w-4 mr-2" />새 질문하기
                  </Button>
                </div>
              </div>
            )}

            {/* 히스토리 */}
            {history.length > 0 && !loading && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="h-4 w-4 text-[#959c9f]" />
                    <h3 className="text-sm font-bold text-[#c0c4c7]">최근 질문 기록</h3>
                  </div>
                  <div className="space-y-2">
                    {history.map((item, idx) => (
                      <button key={idx} className={`w-full text-left p-3 rounded-md transition-all border ${results === item ? 'bg-[#281a13] border-[#30343a]' : 'bg-[#08090a] border-transparent hover:bg-[#181b1e]'}`}
                        onClick={() => { setResults(item); setQuestion(item.question); const f = item.responses?.find((r: any) => r.success); if (f) setExpandedPlatform(f.platform); }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.category && categoryConfig[item.category] && (
                              <span className="text-xs flex-shrink-0">{categoryConfig[item.category].emoji}</span>
                            )}
                            <span className="text-sm text-[#f5f5ef] truncate">{item.question}</span>
                          </div>
                          <span className={`text-xs font-bold min-w-[40px] text-right ${item.mentionRate >= 50 ? 'text-[#ff9565]' : item.mentionRate > 0 ? 'text-yellow-400' : 'text-[#959c9f]'}`}>{item.mentionRate}%</span>
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
