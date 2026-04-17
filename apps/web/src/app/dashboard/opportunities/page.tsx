'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { api, geoContentApi, crawlerApi } from '@/lib/api';
import { toast } from '@/hooks/useToast';
import { 
  Zap, Target, TrendingUp, AlertTriangle, CheckCircle, 
  ArrowRight, Eye, Users, MessageSquare, Lightbulb,
  ChevronDown, ChevronUp, Star, BarChart3, Shield,
  ThumbsUp, ThumbsDown, Minus, Clock, Sparkles, Loader2, PenTool,
} from 'lucide-react';
import Link from 'next/link';

// ─── API 호출: Content Gap + 경쟁사 언급 vs 우리 병원 미언급 (axios interceptor 사용) ───
const fetchOpportunities = async (hospitalId: string) => {
  const [gapsRes, responsesRes] = await Promise.allSettled([
    api.get(`/scores/${hospitalId}/content-gaps`),
    api.get(`/scores/${hospitalId}/opportunity-analysis`),
  ]);

  const gaps = gapsRes.status === 'fulfilled' ? gapsRes.value.data : [];
  const opportunities = responsesRes.status === 'fulfilled' ? responsesRes.value.data : { opportunities: [], summary: {} };

  return { gaps, opportunities: opportunities.opportunities || [], summary: opportunities.summary || {} };
};

// ─── Opportunity 타입 ───
interface OpportunityItem {
  promptText: string;
  category: string;
  competitorsMentioned: string[];
  competitorCount: number;
  platforms: string[];
  urgency: 'high' | 'medium' | 'low';
  suggestedAction: string;
  intent: string;
  lastDetectedAt: string;
}

interface ContentGapItem {
  id: string;
  topic: string;
  gapType: string;
  competitorHas: boolean;
  competitorNames: string[];
  priorityScore: number;
  suggestedAction: string;
  status: string;
  aiGeneratedGuide?: string;
}

const urgencyConfig = {
  high: { label: '긴급', color: 'red', icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  medium: { label: '중요', color: 'amber', icon: Clock, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  low: { label: '검토', color: 'blue', icon: Lightbulb, bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-700' },
};

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  PERPLEXITY: 'Perplexity',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini',
};

export default function OpportunitiesPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'opportunities' | 'gaps'>('opportunities');
  const [generatingGapIds, setGeneratingGapIds] = useState<Set<string>>(new Set());
  const [generatingBlogGapIds, setGeneratingBlogGapIds] = useState<Set<string>>(new Set());

  // GEO 콘텐츠 생성 (퍼널 기반)
  const generateFromGap = async (gap: ContentGapItem) => {
    setGeneratingGapIds(prev => new Set(prev).add(gap.id));
    try {
      await geoContentApi.generate({
        topic: gap.topic,
        funnelStage: 'AWARENESS',
        contentTone: 'PROFESSIONAL',
        targetKeywords: gap.competitorNames || [],
        procedure: gap.topic,
        includeCardNews: true,
        additionalInstructions: gap.suggestedAction || undefined,
      });
      toast.success('AI가 콘텐츠를 생성하고 있습니다! AI 콘텐츠 페이지에서 확인하세요.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '콘텐츠 생성에 실패했습니다');
    } finally {
      setGeneratingGapIds(prev => {
        const next = new Set(prev);
        next.delete(gap.id);
        return next;
      });
    }
  };

  // 블로그 초안 생성 (크롤러 기반)
  const generateBlogFromGap = async (gap: ContentGapItem) => {
    if (!hospitalId) return;
    setGeneratingBlogGapIds(prev => new Set(prev).add(gap.id));
    try {
      const res = await crawlerApi.generateBlogDraft(hospitalId, gap.id);
      toast.success('블로그 초안이 생성되었습니다!');
      setExpandedId(gap.id); // 펼쳐서 결과 보기
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '블로그 생성에 실패했습니다');
    } finally {
      setGeneratingBlogGapIds(prev => {
        const next = new Set(prev);
        next.delete(gap.id);
        return next;
      });
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', hospitalId || ''],
    queryFn: () => fetchOpportunities(hospitalId || ''),
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  const opportunities: OpportunityItem[] = data?.opportunities || [];
  const contentGaps: ContentGapItem[] = data?.gaps || [];
  const summary = data?.summary || {};

  // ─── 우선순위별 정렬 ───
  const sortedOpportunities = useMemo(() => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return [...opportunities].sort((a, b) => (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2));
  }, [opportunities]);

  const highCount = opportunities.filter(o => o.urgency === 'high').length;
  const mediumCount = opportunities.filter(o => o.urgency === 'medium').length;

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <Header title="기회 분석" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <Header 
        title="기회 분석" 
        subtitle="경쟁사는 AI에서 추천되지만 우리 병원은 빠져있는 기회를 발견합니다" 
      />

      {/* 상단 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">긴급 기회</p>
                <p className="text-2xl font-bold text-red-600">{highCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">중요 기회</p>
                <p className="text-2xl font-bold text-amber-600">{mediumCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Content Gap</p>
                <p className="text-2xl font-bold text-slate-900">{contentGaps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">전체 기회</p>
                <p className="text-2xl font-bold text-slate-900">{opportunities.length + contentGaps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 핵심 인사이트 배너 */}
      {highCount > 0 && (
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800">
                  {highCount}개의 긴급 기회가 발견되었습니다
                </p>
                <p className="text-xs text-red-600 mt-1">
                  경쟁 병원이 AI에서 추천되고 있지만 우리 병원은 언급되지 않는 질문 패턴입니다.
                  해당 영역의 콘텐츠(블로그, 웹사이트)를 보강하면 AI 노출이 개선될 수 있습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 섹션 탭 */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveSection('opportunities')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-2xl transition-all ${
            activeSection === 'opportunities'
              ? 'bg-brand-50 text-brand-700 border border-brand-200'
              : 'text-slate-500 hover:bg-white/60'
          }`}
        >
          <Zap className="h-4 w-4" />
          노출 기회 ({opportunities.length})
        </button>
        <button
          onClick={() => setActiveSection('gaps')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-2xl transition-all ${
            activeSection === 'gaps'
              ? 'bg-brand-50 text-brand-700 border border-brand-200'
              : 'text-slate-500 hover:bg-white/60'
          }`}
        >
          <Target className="h-4 w-4" />
          Content Gap ({contentGaps.length})
        </button>
      </div>

      {/* 노출 기회 섹션 */}
      {activeSection === 'opportunities' && (
        <div className="space-y-3">
          {sortedOpportunities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">현재 발견된 노출 기회가 없습니다</p>
                <p className="text-slate-400 text-sm mt-1">
                  AI 크롤링 데이터가 쌓이면 경쟁사 대비 우리 병원의 노출 기회가 자동으로 감지됩니다
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedOpportunities.map((opp, i) => {
              const config = urgencyConfig[opp.urgency];
              const isExpanded = expandedId === `opp-${i}`;
              return (
                <Card key={i} className={`${config.border} border hover:shadow-card-hover transition-all`}>
                  <CardContent className="p-4">
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : `opp-${i}`)}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`${config.bg} p-2 rounded-2xl flex-shrink-0`}>
                          <config.icon className={`h-4 w-4 ${config.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${config.bg} ${config.text} ${config.border} border`}>
                              {config.label}
                            </span>
                            {opp.platforms.map(p => (
                              <span key={p} className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded">
                                {platformNames[p] || p}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm font-medium text-slate-900 leading-snug">
                            "{opp.promptText}"
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            경쟁사 {opp.competitorCount}개 언급 · {opp.competitorsMentioned.slice(0, 3).join(', ')}
                            {opp.competitorsMentioned.length > 3 && ` 외 ${opp.competitorsMentioned.length - 3}개`}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {opp.suggestedAction && (
                          <div className="bg-brand-50 rounded-2xl p-3">
                            <p className="text-xs font-semibold text-brand-700 mb-1 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" /> 개선 제안
                            </p>
                            <p className="text-xs text-brand-600 leading-relaxed">{opp.suggestedAction}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-2xl p-3">
                            <p className="text-[10px] text-slate-400 mb-1">질문 의도</p>
                            <p className="text-xs font-medium text-slate-700">{opp.intent || '정보 탐색'}</p>
                          </div>
                          <div className="bg-slate-50 rounded-2xl p-3">
                            <p className="text-[10px] text-slate-400 mb-1">감지일</p>
                            <p className="text-xs font-medium text-slate-700">
                              {opp.lastDetectedAt ? new Date(opp.lastDetectedAt).toLocaleDateString('ko-KR') : '-'}
                            </p>
                          </div>
                        </div>
                        {/* 1-Click 개선 버튼 */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <Link
                            href={`/dashboard/geo-content`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 text-white hover:from-brand-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
                          >
                            <Sparkles className="h-3 w-3" /> AI로 콘텐츠 만들기
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Content Gap 섹션 */}
      {activeSection === 'gaps' && (
        <div className="space-y-3">
          {contentGaps.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Content Gap이 아직 없습니다</p>
                <p className="text-slate-400 text-sm mt-1">
                  크롤링 데이터가 쌓이면 경쟁사가 노출되는 주제에서 우리가 빠진 영역을 자동으로 발견합니다
                </p>
              </CardContent>
            </Card>
          ) : (
            contentGaps.map((gap) => {
              const isExpanded = expandedId === gap.id;
              return (
                <Card key={gap.id} className="hover:shadow-card-hover transition-all">
                  <CardContent className="p-4">
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : gap.id)}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-2xl flex-shrink-0 ${
                          gap.priorityScore >= 7 ? 'bg-red-50' : gap.priorityScore >= 4 ? 'bg-amber-50' : 'bg-brand-50'
                        }`}>
                          <Target className={`h-4 w-4 ${
                            gap.priorityScore >= 7 ? 'text-red-600' : gap.priorityScore >= 4 ? 'text-amber-600' : 'text-brand-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full border ${
                              gap.gapType === 'CONTENT' ? 'bg-purple-50 text-purple-600 border-purple-200'
                              : gap.gapType === 'KEYWORD' ? 'bg-brand-50 text-brand-600 border-brand-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {gap.gapType === 'CONTENT' ? '콘텐츠' : gap.gapType === 'KEYWORD' ? '키워드' : '주제'}
                            </span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                                  i < gap.priorityScore ? 'bg-brand-500' : 'bg-slate-200'
                                }`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{gap.topic}</p>
                          {gap.competitorNames.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                              경쟁사: {gap.competitorNames.slice(0, 3).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {gap.suggestedAction && (
                          <div className="bg-green-50 rounded-2xl p-3">
                            <p className="text-xs font-semibold text-green-700 mb-1">💡 추천 액션</p>
                            <p className="text-xs text-green-600 leading-relaxed">{gap.suggestedAction}</p>
                          </div>
                        )}
                        {gap.aiGeneratedGuide && (
                          <div className="bg-brand-50 rounded-2xl p-3">
                            <p className="text-xs font-semibold text-brand-700 mb-1">🤖 AI 가이드</p>
                            <p className="text-xs text-brand-600 leading-relaxed whitespace-pre-wrap">{gap.aiGeneratedGuide}</p>
                          </div>
                        )}

                        {/* 콘텐츠 생성 버튼 */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateFromGap(gap);
                            }}
                            disabled={generatingGapIds.has(gap.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 text-white hover:from-brand-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                          >
                            {generatingGapIds.has(gap.id) ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> 생성 중...</>
                            ) : (
                              <><Sparkles className="h-3 w-3" /> GEO 콘텐츠 생성</>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateBlogFromGap(gap);
                            }}
                            disabled={generatingBlogGapIds.has(gap.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-all disabled:opacity-50"
                          >
                            {generatingBlogGapIds.has(gap.id) ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> 생성 중...</>
                            ) : (
                              <><PenTool className="h-3 w-3" /> 블로그 초안</>
                            )}
                          </button>
                          <Link href="/dashboard/geo-content" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-brand-600 transition-colors">
                            AI 콘텐츠 보기 <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* 하단 CTA */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-100">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-800">기회를 활용하는 방법</p>
                <p className="text-xs text-indigo-600 mt-1">
                  발견된 기회를 활용하려면 해당 주제에 대한 블로그 포스트, 웹사이트 콘텐츠, 
                  네이버 플레이스 정보를 보강하세요. AI는 최신 정보를 우선적으로 참고합니다.
                </p>
              </div>
            </div>
            <Link href="/dashboard/insights">
              <Button variant="outline" size="sm" className="flex-shrink-0">
                인사이트 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
