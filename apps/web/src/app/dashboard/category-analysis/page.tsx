'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Loader2,
  PieChart,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Stethoscope,
  Heart,
  DollarSign,
  MapPin,
  MessageCircle,
  GitCompare,
  HelpCircle,
  Zap,
  Star,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Tag,
  Database,
  Settings,
  Crosshair,
} from 'lucide-react';

const categoryConfig: Record<string, { name: string; icon: any; color: string; bgColor: string; borderColor: string; barColor: string; emoji: string; description: string }> = {
  PROCEDURE: { name: '시술/진료', icon: Stethoscope, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', barColor: 'bg-blue-400', emoji: '🦷', description: '임플란트, 교정, 라미네이트 등 구체적 시술' },
  EMOTION:   { name: '감성/경험', icon: Heart, color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-200', barColor: 'bg-pink-400', emoji: '💝', description: '친절한, 무서운데, 편안한 등 환자 감정' },
  COST:      { name: '비용/가격', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', barColor: 'bg-emerald-400', emoji: '💰', description: '가격, 가성비, 저렴한 등 비용 관련' },
  REGION:    { name: '지역 기반', icon: MapPin, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', barColor: 'bg-orange-400', emoji: '📍', description: '강남, 홍대, 서울 등 지역 중심 검색' },
  REVIEW:    { name: '후기/평판', icon: MessageCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', barColor: 'bg-yellow-400', emoji: '⭐', description: '후기 좋은, 유명한, 평판 등' },
  COMPARISON:{ name: '비교', icon: GitCompare, color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', barColor: 'bg-violet-400', emoji: '⚖️', description: 'vs, 비교, 차이 등 대안 비교' },
  GENERAL:   { name: '기타', icon: HelpCircle, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', barColor: 'bg-gray-400', emoji: '📋', description: '기타 분류되지 않은 질문' },
};

export default function CategoryAnalysisPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const res = await crawlerApi.getCategoryAnalysis(hospitalId, period);
      setData(res.data);
    } catch { /* 무시 */ }
    finally { setLoading(false); }
  }, [hospitalId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="카테고리 성과" description="질문 유형별 AI 언급 성과를 분석합니다" />
        <div className="p-4 sm:p-6">
          <Card><CardContent className="p-12 text-center">
            <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">병원 등록이 필요합니다</h3>
            <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="카테고리 성과"
        description="시술·감성·비용·지역·후기·비교 — 질문 유형별로 AI가 우리 병원을 어디서 잘 추천하는지, 어디가 약한지 한눈에"
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* 기간 필터 */}
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === d
                  ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>

        {/* 로딩 */}
        {loading && (
          <Card><CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">카테고리별 성과를 분석하고 있어요...</p>
          </CardContent></Card>
        )}

        {/* 데이터 없음 */}
        {!loading && (!data || data.totalQueries === 0) && (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="p-12 text-center">
              <PieChart className="h-14 w-14 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">아직 데이터가 없어요</h3>
              <p className="text-sm text-gray-500 mb-6">
                실시간 질문을 하거나, 정기 크롤링이 실행되면<br/>자동으로 카테고리가 분류되고 성과가 쌓여요!
              </p>
              <Button onClick={() => window.location.href = '/dashboard/live-query'} className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Zap className="h-4 w-4 mr-2" />실시간 질문 하러 가기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 데이터 있을 때 */}
        {!loading && data && data.totalQueries > 0 && (
          <div className="space-y-6">

            {/* 전체 요약 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-gray-800">{data.totalQueries}</p>
                  <p className="text-xs text-gray-500 mt-1">총 질문 수</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className={`p-4 text-center ${data.totalMentionRate >= 50 ? 'bg-green-50/50' : ''}`}>
                  <p className={`text-3xl font-bold ${data.totalMentionRate >= 50 ? 'text-green-600' : data.totalMentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{data.totalMentionRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">평균 언급률</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <p className="text-2xl font-bold text-purple-600">{data.totalLiveQueries}</p>
                  </div>
                  <p className="text-xs text-gray-500">실시간 질문</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Database className="h-4 w-4 text-blue-500" />
                    <p className="text-2xl font-bold text-blue-600">{data.totalCrawlQueries}</p>
                  </div>
                  <p className="text-xs text-gray-500">정기 크롤링</p>
                </CardContent>
              </Card>
            </div>

            {/* 강점 / 약점 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 강한 분야 */}
              <Card className="border-green-200 bg-green-50/30">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h4 className="font-bold text-green-800">우리 병원이 강한 분야</h4>
                  </div>
                  <div className="space-y-2.5">
                    {data.topTags?.filter((t: any) => t.avgMentionRate > 0).slice(0, 5).map((tag: any, i: number) => {
                      const config = categoryConfig[tag.category];
                      return (
                        <div key={i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-green-100">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{config?.emoji || '📋'}</span>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{tag.tag}</p>
                              <p className="text-[10px] text-gray-400">{tag.categoryName} · {tag.totalQueries}회</p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-green-600">{tag.avgMentionRate}%</span>
                        </div>
                      );
                    })}
                    {data.topTags?.filter((t: any) => t.avgMentionRate > 0).length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">아직 언급된 질문이 없어요</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 약한 분야 */}
              <Card className="border-red-200 bg-red-50/30">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <h4 className="font-bold text-red-800">개선이 필요한 분야</h4>
                  </div>
                  <div className="space-y-2.5">
                    {data.weakTags?.filter((t: any) => t.avgMentionRate < 50).slice(0, 5).map((tag: any, i: number) => {
                      const config = categoryConfig[tag.category];
                      return (
                        <div key={i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-red-100">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{config?.emoji || '📋'}</span>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{tag.tag}</p>
                              <p className="text-[10px] text-gray-400">{tag.categoryName} · {tag.totalQueries}회</p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-red-500">{tag.avgMentionRate}%</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ==================== 진료별 드릴다운 ==================== */}
            {data.myProcedures?.length > 0 && (
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50/40 to-indigo-50/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-5 w-5 text-blue-600" />
                      <h3 className="font-bold text-gray-900">내 핵심 진료별 성과</h3>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      등록된 진료 {data.myProcedures.length}개
                    </span>
                  </div>

                  {data.procedureDrilldown?.length > 0 ? (
                    <div className="space-y-3">
                      {data.procedureDrilldown.map((proc: any) => {
                        const hasData = proc.totalQueries > 0;
                        return (
                          <div key={proc.procedure} className={`rounded-xl border p-4 bg-white ${hasData ? 'border-gray-200' : 'border-dashed border-gray-300'}`}>
                            {/* 진료명 + 언급률 */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-base">🦷</span>
                                <span className="text-sm font-bold text-gray-900">{proc.procedure}</span>
                                {hasData && (
                                  <span className="text-[10px] text-gray-400">
                                    {proc.totalQueries}회 ({proc.liveQueries > 0 ? `실시간 ${proc.liveQueries}` : ''}{proc.liveQueries > 0 && proc.crawlQueries > 0 ? ' + ' : ''}{proc.crawlQueries > 0 ? `크롤링 ${proc.crawlQueries}` : ''})
                                  </span>
                                )}
                              </div>
                              {hasData ? (
                                <span className={`text-xl font-bold ${proc.avgMentionRate >= 50 ? 'text-green-600' : proc.avgMentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                  {proc.avgMentionRate}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">데이터 없음</span>
                              )}
                            </div>

                            {hasData && (
                              <>
                                {/* 프로그래스 바 */}
                                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
                                  <div
                                    className={`h-2.5 rounded-full transition-all ${proc.avgMentionRate >= 50 ? 'bg-green-400' : proc.avgMentionRate > 0 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                                    style={{ width: `${proc.avgMentionRate}%` }}
                                  />
                                </div>

                                {/* 실시간 vs 크롤링 비교 */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                  <div className="bg-purple-50/70 rounded-lg px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Zap className="h-3 w-3 text-purple-500" />
                                      <span className="text-sm font-bold text-purple-700">{proc.liveAvgRate}%</span>
                                    </div>
                                    <p className="text-[9px] text-purple-500 mt-0.5">실시간 ({proc.liveQueries})</p>
                                  </div>
                                  <div className="bg-blue-50/70 rounded-lg px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Database className="h-3 w-3 text-blue-500" />
                                      <span className="text-sm font-bold text-blue-700">{proc.crawlAvgRate}%</span>
                                    </div>
                                    <p className="text-[9px] text-blue-500 mt-0.5">크롤링 ({proc.crawlQueries})</p>
                                  </div>
                                </div>

                                {/* 대표 질문 */}
                                {proc.sampleQuestions?.length > 0 && (
                                  <div className="space-y-1">
                                    {proc.sampleQuestions.slice(0, 3).map((q: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <span className="text-[10px]">{q.type === 'live' ? '⚡' : '🔄'}</span>
                                          <span className="text-[11px] text-gray-600 truncate">{q.text}</span>
                                        </div>
                                        <span className={`text-[11px] font-bold ml-2 ${q.mentionRate > 0 ? 'text-green-600' : 'text-gray-400'}`}>{q.mentionRate}%</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {!hasData && (
                              <p className="text-xs text-gray-400 mt-1">
                                이 진료에 대한 질문이나 크롤링 데이터가 아직 없어요.
                                <button onClick={() => window.location.href = '/dashboard/live-query'} className="text-purple-600 hover:underline ml-1">질문해보기</button>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">등록된 진료에 대한 데이터를 수집 중이에요</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 핵심 진료 미등록 시 안내 */}
            {(!data.myProcedures || data.myProcedures.length === 0) && (
              <Card className="border-dashed border-2 border-blue-200 bg-blue-50/20">
                <CardContent className="p-5 text-center">
                  <Settings className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-gray-800 mb-1">핵심 진료를 등록하면 진료별 성과를 볼 수 있어요</h4>
                  <p className="text-xs text-gray-500 mb-3">설정에서 우리 병원의 핵심 시술을 등록해주세요</p>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-600" onClick={() => window.location.href = '/dashboard/settings'}>
                    <Settings className="h-3.5 w-3.5 mr-1.5" />설정에서 등록하기
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 카테고리별 상세 카드 */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-500" />
                카테고리별 상세 분석
              </h3>
              <div className="space-y-3">
                {data.categories.map((cat: any) => {
                  const config = categoryConfig[cat.category] || categoryConfig.GENERAL;
                  const Icon = config.icon;
                  const isExpanded = expandedCategory === cat.category;

                  return (
                    <Card key={cat.category} className={`overflow-hidden border ${config.borderColor}`}>
                      {/* 카테고리 헤더 */}
                      <button
                        className={`w-full p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors ${config.bgColor}`}
                        onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
                            <span className="text-xl">{config.emoji}</span>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-gray-900">{cat.categoryName}</p>
                            <p className="text-[11px] text-gray-500">{config.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-gray-400">{cat.totalQueries}회 질문</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                              <Zap className="h-2.5 w-2.5" />{cat.liveQueries}
                              <Database className="h-2.5 w-2.5 ml-1" />{cat.crawlQueries}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${config.barColor}`} style={{ width: `${cat.avgMentionRate}%` }} />
                            </div>
                            <span className={`text-lg font-bold min-w-[45px] text-right ${cat.avgMentionRate >= 50 ? 'text-green-600' : cat.avgMentionRate > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {cat.avgMentionRate}%
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </button>

                      {/* 펼쳐진 상세 */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 bg-white">
                          {/* 데이터 소스 구분 */}
                          <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-purple-500" />
                                <span className="text-lg font-bold text-purple-700">{cat.liveAvgRate}%</span>
                              </div>
                              <p className="text-[10px] text-purple-600 mt-0.5">실시간 질문 ({cat.liveQueries}회)</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Database className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-lg font-bold text-blue-700">{cat.crawlAvgRate}%</span>
                              </div>
                              <p className="text-[10px] text-blue-600 mt-0.5">정기 크롤링 ({cat.crawlQueries}회)</p>
                            </div>
                          </div>

                          {/* 세부 태그 */}
                          {cat.tags.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-gray-600 mb-2">세부 키워드</p>
                              <div className="flex flex-wrap gap-2">
                                {cat.tags.map((tag: any) => (
                                  <div key={tag.tag} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                                    tag.avgMentionRate >= 50 ? 'bg-green-50 border-green-200 text-green-700'
                                      : tag.avgMentionRate > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-500'
                                  }`}>
                                    <span className="font-medium">{tag.tag}</span>
                                    <span className="font-bold">{tag.avgMentionRate}%</span>
                                    <span className="text-[10px] opacity-60">({tag.totalQueries})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 잘 되는 질문 */}
                          {cat.topQuestions?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1"><Star className="h-3 w-3" />잘 잡히는 질문</p>
                              <div className="space-y-1">
                                {cat.topQuestions.map((q: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-green-50/50 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-[10px] text-green-400">{q.type === 'live' ? '⚡' : '🔄'}</span>
                                      <span className="text-xs text-gray-700 truncate">{q.text}</span>
                                    </div>
                                    <span className="text-xs font-bold text-green-600 ml-2">{q.mentionRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 개선 필요한 질문 */}
                          {cat.weakQuestions?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" />개선이 필요한 질문</p>
                              <div className="space-y-1">
                                {cat.weakQuestions.map((q: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-red-50/50 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-[10px] text-red-400">{q.type === 'live' ? '⚡' : '🔄'}</span>
                                      <span className="text-xs text-gray-700 truncate">{q.text}</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-500 ml-2">{q.mentionRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* CTA: 실시간 질문으로 이동 */}
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">더 많은 데이터로 정확한 분석을</p>
                  <p className="text-xs text-gray-500 mt-0.5">실시간 질문으로 다양한 카테고리의 데이터를 쌓아보세요</p>
                </div>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-blue-600"
                  onClick={() => window.location.href = '/dashboard/live-query'}
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  질문하기
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
