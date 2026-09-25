'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { WorkspaceIntro } from '@/components/dashboard/WorkspaceIntro';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TermTip } from '@/components/ui/term-tooltip';
import { useAuthStore } from '@/stores/auth';
import { citationApi } from '@/lib/api';
import { toast } from '@/hooks/useToast';
import {
  Search, Loader2, ArrowRight, ExternalLink, BarChart3,
  Target, Zap, ChevronDown, ChevronUp, Globe, Star,
  AlertTriangle, CheckCircle, TrendingUp, FileText,
  Sparkles, Shield, Eye, BookOpen,
} from 'lucide-react';

// ─── Types ───
interface Directive {
  priority: string;
  category: string;
  action: string;
  example: string;
  reason: string;
  estimatedImpact: string;
  seoTag?: string;
}

interface AnalysisResult {
  query: string;
  targetKeyword: string;
  analyzedPages: {
    url: string;
    domain: string;
    title: string;
    citedByPlatforms: string[];
    citationCount: number;
    strengths: string[];
  }[];
  citationPatterns: any;
  directives: Directive[];
  contentScore: { current: number; potential: number; improvements: string[] };
  seoUpgrade: {
    naverOptimization: string[];
    googleOptimization: string[];
    aiEngineOptimization: string[];
    schemaMarkupSuggestions: string[];
  };
  summary: string;
}

const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  critical: { label: '필수', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  high: { label: '강력 권장', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Zap },
  medium: { label: '권장', color: 'bg-[#ECEFE6] text-[#15231B] border-[#DEE4D9]', icon: Target },
};

const seoTagConfig: Record<string, { label: string; color: string }> = {
  NAVER: { label: '네이버', color: 'bg-brand-100 text-brand-700' },
  GOOGLE: { label: '구글', color: 'bg-[#ECEFE6] text-[#15231B]' },
  AI_ENGINE: { label: 'AI엔진', color: 'bg-[#ECEFE6] text-[#15231B]' },
  ALL: { label: '전체', color: 'bg-[#ECEFE6] text-[#405345]' },
};

export default function CitationAnalysisPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [query, setQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [expandedDirective, setExpandedDirective] = useState<number | null>(null);
  const [showPages, setShowPages] = useState(false);

  // 최근 분석 이력
  const { data: recentData } = useQuery({
    queryKey: ['citation-recent', hospitalId],
    queryFn: () => citationApi.getRecent(hospitalId!, 5).then(r => r.data),
    enabled: !!hospitalId,
  });

  // 인용 통계
  const { data: statsData } = useQuery({
    queryKey: ['citation-stats', hospitalId],
    queryFn: () => citationApi.getStats(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
  });

  // 역분석 실행
  const analyzeMutation = useMutation({
    mutationFn: (q: string) => citationApi.analyze(hospitalId!, { query: q, maxPages: 5 }),
    onSuccess: (response) => {
      if (response.data?.success) {
        setAnalysisResult(response.data.data);
        toast.success('역분석 완료!');
      } else {
        toast.error(response.data?.error || '분석 실패');
      }
    },
    onError: () => toast.error('역분석 중 오류가 발생했습니다'),
  });

  // 일괄 분석
  const bulkMutation = useMutation({
    mutationFn: () => citationApi.analyzeBulk(hospitalId!, { limit: 10 }),
    onSuccess: (response) => {
      if (response.data?.success) {
        toast.success(response.data.message);
      }
    },
    onError: () => toast.error('일괄 분석 중 오류가 발생했습니다'),
  });

  const handleAnalyze = () => {
    if (!query.trim() || query.trim().length < 2) {
      toast.warning('2자 이상 키워드를 입력해주세요');
      return;
    }
    analyzeMutation.mutate(query.trim());
  };

  const stats = statsData?.data;
  const recentAnalyses = recentData?.data || [];

  return (
    <div className="flex-1 min-h-screen">
      <Header
        title="AI 인용 역분석"
        description="ChatGPT·Perplexity가 인용한 페이지를 역분석하여 SEO 지시어를 생성합니다"
      />

      <main className="mx-auto max-w-[1440px] space-y-7 px-5 py-7 sm:px-8 xl:px-10">
        <WorkspaceIntro eyebrow="CITATION INTELLIGENCE" title="AI는 어디를 참고했을까요?" description="답변에 인용된 페이지를 살피고 콘텐츠를 개선할 근거를 찾으세요." />


        {/* ─── 인용 통계 카드 ─── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{stats.totalCitations}</p>
                <p className="text-xs text-[#778378] mt-1"><TermTip term="totalCitations">총 인용 수 (30일)</TermTip></p>
              </CardContent>
            </Card>
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{stats.totalDomains}</p>
                <p className="text-xs text-[#778378] mt-1"><TermTip term="citationDomains">인용 도메인</TermTip></p>
              </CardContent>
            </Card>
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{stats.naverCitationRate}%</p>
                <p className="text-xs text-[#778378] mt-1"><TermTip term="naverCitationRate">네이버 인용률</TermTip></p>
              </CardContent>
            </Card>
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#36765A]">{stats.overallCompanionRate ?? 0}%</p>
                <p className="text-xs text-[#778378] mt-1"><TermTip term="companionRate">언급 동반율</TermTip></p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── 검색 입력 ─── */}
        <Card className="border border-[#DEE4D9] shadow-none bg-brand-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-bold text-[#20372A]">키워드 역분석</h2>
            </div>
            <p className="text-sm text-[#637167] mb-4">
              환자가 AI에게 물어볼 법한 질문을 입력하세요. AI가 인용한 상위 페이지를 분석하여 구체적 SEO 지시어를 생성합니다.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="예: 강남 임플란트 잘하는 병원 추천해줘"
                className="flex-1 px-4 py-3 rounded-md border border-[#DEE4D9] focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
              />
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium"
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 분석 중...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> 역분석</>
                )}
              </Button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkMutation.mutate()}
                disabled={bulkMutation.isPending}
                className="text-xs"
              >
                {bulkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                일괄 역분석 (상위 인용 키워드 자동)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── 분석 결과 ─── */}
        {analysisResult && (
          <div className="space-y-4">
            {/* 요약 + 점수 */}
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#20372A] flex items-center gap-2">
                      <Target className="w-5 h-5 text-brand-600" />
                      "{analysisResult.targetKeyword}" 역분석 결과
                    </h3>
                    <p className="text-sm text-[#637167] mt-1">{analysisResult.summary}</p>
                  </div>
                </div>

                {/* 인용 가능성 점수 */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-[#F4F5EF] rounded-md p-4 text-center">
                    <p className="text-xs text-[#778378] mb-1">현재 인용 가능성</p>
                    <p className={`text-3xl font-bold ${analysisResult.contentScore.current >= 50 ? 'text-brand-600' : analysisResult.contentScore.current >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {analysisResult.contentScore.current}
                    </p>
                    <p className="text-xs text-[#87917E]">/ 100</p>
                  </div>
                  <div className="bg-brand-50 rounded-md p-4 text-center">
                    <p className="text-xs text-[#778378] mb-1">지시어 반영 후 예상</p>
                    <p className="text-3xl font-bold text-brand-600">
                      {analysisResult.contentScore.potential}
                    </p>
                    <p className="text-xs text-brand-500 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +{analysisResult.contentScore.potential - analysisResult.contentScore.current}점 향상
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 인용 페이지 분석 */}
            {analysisResult.analyzedPages.length > 0 && (
              <Card className="border border-[#DEE4D9] shadow-none">
                <CardContent className="p-4">
                  <button
                    onClick={() => setShowPages(!showPages)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h4 className="text-sm font-semibold text-[#405345] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#36765A]" />
                      분석된 인용 페이지 ({analysisResult.analyzedPages.length}개)
                    </h4>
                    {showPages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showPages && (
                    <div className="mt-3 space-y-3">
                      {analysisResult.analyzedPages.map((page, i) => (
                        <div key={i} className="bg-[#F4F5EF] rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#20372A] truncate">{page.title || page.url}</p>
                              <p className="text-xs text-[#778378] truncate">{page.domain}</p>
                              <div className="flex gap-1 mt-1">
                                {page.citedByPlatforms.map((p, j) => (
                                  <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[#ECEFE6] text-[#36765A]">
                                    {p}
                                  </span>
                                ))}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ECEFE6] text-[#36765A]">
                                  {page.citationCount}회 인용
                                </span>
                              </div>
                              {page.strengths?.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {page.strengths.map((s, k) => (
                                    <li key={k} className="text-xs text-[#637167] flex items-start gap-1">
                                      <Star className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <a href={page.url} target="_blank" rel="noopener noreferrer" className="ml-2">
                              <ExternalLink className="w-4 h-4 text-[#87917E] hover:text-[#36765A]" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SEO 지시어 */}
            <Card className="border border-[#DEE4D9] shadow-none">
              <CardContent className="p-6">
                <h4 className="text-base font-bold text-[#20372A] flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-red-500" />
                  구체 SEO 지시어 ({analysisResult.directives.length}개)
                </h4>
                <div className="space-y-3">
                  {analysisResult.directives.map((d, i) => {
                    const config = priorityConfig[d.priority] || priorityConfig.medium;
                    const Icon = config.icon;
                    const seoTag = seoTagConfig[d.seoTag || 'ALL'] || seoTagConfig.ALL;
                    const isExpanded = expandedDirective === i;

                    return (
                      <div key={i} className={`border rounded-md overflow-hidden ${isExpanded ? 'ring-2 ring-brand-200' : ''}`}>
                        <button
                          onClick={() => setExpandedDirective(isExpanded ? null : i)}
                          className="w-full p-4 text-left flex items-start gap-3 hover:bg-[#F4F5EF] transition"
                        >
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${config.color}`}>
                            {config.label}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#778378]">[{d.category}]</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${seoTag.color}`}>{seoTag.label}</span>
                            </div>
                            <p className="text-sm font-medium text-[#20372A] mt-1">{d.action}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 mt-1" /> : <ChevronDown className="w-4 h-4 mt-1" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 bg-[#F4F5EF] border-t">
                            {d.example && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-[#778378] mb-1">📝 예시 (복사하여 사용)</p>
                                <div className="bg-white rounded-lg p-3 text-sm text-[#405345] border font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                  {d.example}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-4 text-xs">
                              <div>
                                <span className="text-[#778378]">이유: </span>
                                <span className="text-[#405345]">{d.reason}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <TrendingUp className="w-3 h-3 text-brand-500" />
                              <span className="text-brand-700 font-medium">{d.estimatedImpact}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 플랫폼별 SEO 최적화 */}
            {analysisResult.seoUpgrade && (
              <div className="grid md:grid-cols-3 gap-4">
                {/* 네이버 */}
                <Card className="border border-[#DEE4D9] shadow-none border-l-4 border-l-green-400">
                  <CardContent className="p-4">
                    <h5 className="text-sm font-bold text-brand-700 flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">N</div>
                      네이버 AI 브리핑
                    </h5>
                    <ul className="space-y-2">
                      {(analysisResult.seoUpgrade.naverOptimization || []).map((item, i) => (
                        <li key={i} className="text-xs text-[#637167] flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-brand-400 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                {/* 구글 */}
                <Card className="border border-[#DEE4D9] shadow-none border-l-4 border-l-[#36765A]">
                  <CardContent className="p-4">
                    <h5 className="text-sm font-bold text-[#15231B] flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 bg-[#36765A] rounded-full flex items-center justify-center text-white text-[10px] font-bold">G</div>
                      구글 AI Overview
                    </h5>
                    <ul className="space-y-2">
                      {(analysisResult.seoUpgrade.googleOptimization || []).map((item, i) => (
                        <li key={i} className="text-xs text-[#637167] flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-[#637167] mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                {/* AI 엔진 */}
                <Card className="border border-[#DEE4D9] shadow-none border-l-4 border-l-[#8EAB70]">
                  <CardContent className="p-4">
                    <h5 className="text-sm font-bold text-[#15231B] flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 bg-[#36765A] rounded-full flex items-center justify-center text-white text-[10px] font-bold">AI</div>
                      ChatGPT · Perplexity
                    </h5>
                    <ul className="space-y-2">
                      {(analysisResult.seoUpgrade.aiEngineOptimization || []).map((item, i) => (
                        <li key={i} className="text-xs text-[#637167] flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-[#637167] mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ─── 최근 분석 이력 ─── */}
        {recentAnalyses.length > 0 && (
          <Card className="border border-[#DEE4D9] shadow-none">
            <CardContent className="p-4">
              <h4 className="text-sm font-bold text-[#405345] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#778378]" />
                최근 분석 이력
              </h4>
              <div className="space-y-2">
                {recentAnalyses.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setQuery(a.queryText);
                      if (a.directives) {
                        setAnalysisResult({
                          query: a.queryText,
                          targetKeyword: a.targetKeyword || a.queryText,
                          analyzedPages: [],
                          citationPatterns: a.citationPatterns || {},
                          directives: a.directives || [],
                          contentScore: a.contentScore || { current: 0, potential: 0, improvements: [] },
                          seoUpgrade: a.gapAnalysis || { naverOptimization: [], googleOptimization: [], aiEngineOptimization: [], schemaMarkupSuggestions: [] },
                          summary: '',
                        });
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#F4F5EF] transition flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#20372A]">{a.queryText}</p>
                      <p className="text-xs text-[#778378]">
                        {a.targetKeyword && <span className="text-brand-500">{a.targetKeyword}</span>}
                        {' · '}
                        {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                        {' · '}
                        {a.topCitationCount}페이지 분석
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#B9C6B3] group-hover:text-brand-500 transition" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── 인용 도메인 통계 ─── */}
        {stats?.topDomains?.length > 0 && (
          <Card className="border border-[#DEE4D9] shadow-none">
            <CardContent className="p-4">
              <h4 className="text-sm font-bold text-[#405345] mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#36765A]" />
                상위 인용 도메인 (30일)
              </h4>
              <div className="space-y-2">
                {stats.topDomains.slice(0, 10).map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-[#87917E] w-4 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-[#405345] font-medium">{d.domain}</span>
                        <span className="text-xs text-[#778378]">
                          {d.count}회 ({d.percentage}%)
                          {d.companionRate != null && (
                            <TermTip term="companionRate" icon={false} className={`ml-2 !inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              d.companionRate >= 50 ? 'bg-brand-100 text-brand-700' : d.companionRate >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-500'
                            }`}>
                              동반 {d.companionRate}%
                            </TermTip>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#ECEFE6] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.domain.includes('naver') ? 'bg-brand-400' : d.domain.includes('google') ? 'bg-[#A4B88B]' : 'bg-slate-300'}`}
                          style={{ width: `${d.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
