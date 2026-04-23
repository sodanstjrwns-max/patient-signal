'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { citationApi } from '@/lib/api';
import { toast } from '@/hooks/useToast';
import {
  CalendarDays, Loader2, Plus, Search, Sparkles,
  ChevronDown, ChevronUp, Target, Zap, CheckCircle,
  Clock, FileText, BarChart3, Filter, ArrowRight,
  AlertTriangle, Eye, PenTool, RefreshCw, Play,
} from 'lucide-react';

// ─── Types ───
interface CalendarItem {
  id: string;
  weekNumber: number;
  yearWeek: string;
  scheduledDate: string;
  topic: string;
  targetKeyword: string;
  funnelStage: string;
  procedure?: string;
  contentType: string;
  status: string;
  priority: string;
  seoDirectives?: any;
  geoContentId?: string;
  notes?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PLANNED: { label: '계획', color: 'bg-slate-100 text-slate-600', icon: Clock },
  ANALYZED: { label: '분석 완료', color: 'bg-blue-100 text-blue-700', icon: Search },
  GENERATING: { label: '생성 중', color: 'bg-amber-100 text-amber-700', icon: Loader2 },
  PUBLISHED: { label: '발행됨', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  SKIPPED: { label: '건너뜀', color: 'bg-red-100 text-red-600', icon: AlertTriangle },
};

const funnelConfig: Record<string, { label: string; color: string; emoji: string }> = {
  AWARENESS: { label: '인지', color: 'bg-sky-100 text-sky-700', emoji: '👀' },
  CONSIDERATION: { label: '고려', color: 'bg-violet-100 text-violet-700', emoji: '🤔' },
  DECISION: { label: '결정', color: 'bg-emerald-100 text-emerald-700', emoji: '✅' },
  RETENTION: { label: '유지', color: 'bg-amber-100 text-amber-700', emoji: '🔄' },
  ADVOCACY: { label: '추천', color: 'bg-pink-100 text-pink-700', emoji: '💖' },
};

const priorityColors: Record<string, string> = {
  HIGH: 'border-l-red-400',
  MEDIUM: 'border-l-amber-400',
  LOW: 'border-l-slate-300',
};

export default function ContentCalendarPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFunnel, setFilterFunnel] = useState<string>('');
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  // 캘린더 데이터 로드
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['content-calendar', hospitalId, filterStatus],
    queryFn: () => citationApi.getCalendar(hospitalId!, {
      status: filterStatus || undefined,
      limit: 56,
    }).then(r => r.data),
    enabled: !!hospitalId,
  });

  // 캘린더 생성
  const generateMutation = useMutation({
    mutationFn: () => citationApi.generateCalendar(hospitalId!),
    onSuccess: (response) => {
      if (response.data?.success) {
        toast.success(response.data.message);
        queryClient.invalidateQueries({ queryKey: ['content-calendar'] });
      } else {
        toast.error(response.data?.error || '캘린더 생성 실패');
      }
    },
    onError: () => toast.error('캘린더 생성 중 오류가 발생했습니다'),
  });

  // 주차별 역분석
  const analyzeMutation = useMutation({
    mutationFn: (weekNumber: number) => citationApi.analyzeCalendarWeek(hospitalId!, weekNumber),
    onSuccess: (response) => {
      if (response.data?.success) {
        toast.success(response.data.message);
        queryClient.invalidateQueries({ queryKey: ['content-calendar'] });
      } else {
        toast.error(response.data?.error || '분석 실패');
      }
    },
    onError: () => toast.error('주차 분석 중 오류가 발생했습니다'),
  });

  const calendar = calendarData?.data;
  const items: CalendarItem[] = calendar?.items || [];
  const stats = calendar?.stats || {};
  const funnelDist = calendar?.funnelDistribution || {};

  // 필터링
  let filteredItems = items;
  if (filterFunnel) {
    filteredItems = filteredItems.filter(i => i.funnelStage === filterFunnel);
  }

  // 표시할 항목 수 제한
  const displayItems = showAll ? filteredItems : filteredItems.slice(0, 12);

  // 현재 주차 계산
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const currentWeekOfYear = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

  return (
    <div className="flex-1 min-h-screen">
      <Header
        title="56주 콘텐츠 캘린더"
        description="AI가 병원 맞춤형 56주 콘텐츠 계획을 자동으로 생성합니다"
      />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

        {/* ─── 상단 통계 + 생성 버튼 ─── */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-1">
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm text-center">
              <p className="text-lg font-bold text-slate-800">{calendar?.total || 0}</p>
              <p className="text-[10px] text-slate-500">총 주차</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm text-center">
              <p className="text-lg font-bold text-green-600">{stats.PUBLISHED || 0}</p>
              <p className="text-[10px] text-slate-500">발행 완료</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm text-center">
              <p className="text-lg font-bold text-blue-600">{stats.ANALYZED || 0}</p>
              <p className="text-[10px] text-slate-500">분석 완료</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm text-center">
              <p className="text-lg font-bold text-slate-600">{stats.PLANNED || 0}</p>
              <p className="text-[10px] text-slate-500">계획 중</p>
            </div>
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm text-center">
              <p className="text-lg font-bold text-purple-600">
                {calendar?.total ? Math.round(((stats.PUBLISHED || 0) / calendar.total) * 100) : 0}%
              </p>
              <p className="text-[10px] text-slate-500">진행률</p>
            </div>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-6"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 생성 중...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> {items.length > 0 ? '캘린더 재생성' : '56주 캘린더 생성'}</>
            )}
          </Button>
        </div>

        {/* ─── 퍼널 분포 바 ─── */}
        {calendar?.total > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h4 className="text-xs font-semibold text-slate-500 mb-2">퍼널 분포</h4>
              <div className="flex h-6 rounded-full overflow-hidden">
                {Object.entries(funnelDist).map(([stage, count]: [string, any]) => {
                  const config = funnelConfig[stage] || funnelConfig.AWARENESS;
                  const pct = Math.round((count / calendar.total) * 100);
                  if (pct < 2) return null;
                  return (
                    <div
                      key={stage}
                      className={`${config.color} flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer hover:opacity-80`}
                      style={{ width: `${pct}%` }}
                      onClick={() => setFilterFunnel(filterFunnel === stage ? '' : stage)}
                      title={`${config.label}: ${count}주 (${pct}%)`}
                    >
                      {pct >= 10 && `${config.emoji} ${pct}%`}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-2">
                {Object.entries(funnelConfig).map(([stage, config]) => (
                  <button
                    key={stage}
                    onClick={() => setFilterFunnel(filterFunnel === stage ? '' : stage)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition ${
                      filterFunnel === stage ? config.color + ' ring-2 ring-offset-1' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {config.emoji} {config.label} {funnelDist[stage] || 0}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── 필터 ─── */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('')}
            className={`text-xs px-3 py-1.5 rounded-full transition ${!filterStatus ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}
          >
            전체
          </button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
              className={`text-xs px-3 py-1.5 rounded-full transition flex items-center gap-1 ${
                filterStatus === key ? config.color + ' ring-2 ring-offset-1' : 'bg-white text-slate-600 hover:bg-slate-50 border'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* ─── 캘린더 비어있을 때 ─── */}
        {!isLoading && items.length === 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <CalendarDays className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">콘텐츠 캘린더가 비어있습니다</h3>
              <p className="text-sm text-slate-500 mb-6">
                AI가 병원의 핵심 시술, 지역, 퍼널 단계를 고려하여<br />
                56주치 콘텐츠 계획을 자동으로 생성합니다.
              </p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-8 py-3"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 캘린더 생성 중...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> 56주 캘린더 자동 생성</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── 캘린더 리스트 ─── */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500">캘린더 로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const stConfig = statusConfig[item.status] || statusConfig.PLANNED;
              const fConfig = funnelConfig[item.funnelStage] || funnelConfig.AWARENESS;
              const isExpanded = expandedWeek === item.weekNumber;
              const priorityBorder = priorityColors[item.priority] || priorityColors.MEDIUM;
              const scheduledDate = new Date(item.scheduledDate);
              const isPast = scheduledDate < now;
              const isThisWeek = item.yearWeek === `${now.getFullYear()}-W${String(currentWeekOfYear).padStart(2, '0')}`;

              return (
                <Card
                  key={item.id}
                  className={`border-0 shadow-sm border-l-4 ${priorityBorder} ${isThisWeek ? 'ring-2 ring-brand-200' : ''}`}
                >
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedWeek(isExpanded ? null : item.weekNumber)}
                      className="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-50/50 transition"
                    >
                      {/* 주차 번호 */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isThisWeek ? 'bg-brand-600 text-white' : isPast ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.weekNumber}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${stConfig.color}`}>{stConfig.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${fConfig.color}`}>{fConfig.emoji} {fConfig.label}</span>
                          {item.contentType && item.contentType !== 'BLOG' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{item.contentType}</span>
                          )}
                          {isThisWeek && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-bold">이번 주</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{item.topic}</p>
                        <p className="text-xs text-slate-500">
                          {item.targetKeyword} · {scheduledDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          {item.procedure && ` · ${item.procedure}`}
                        </p>
                      </div>

                      {/* SEO 지시어 유무 표시 */}
                      {item.seoDirectives && (
                        <div className="flex-shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                            SEO 지시어 ✓
                          </span>
                        </div>
                      )}

                      {isExpanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                    </button>

                    {/* 확장 영역 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t bg-slate-50/50 space-y-3">
                        {/* 액션 버튼 */}
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              analyzeMutation.mutate(item.weekNumber);
                            }}
                            disabled={analyzeMutation.isPending}
                            className="text-xs"
                          >
                            {analyzeMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Search className="w-3 h-3 mr-1" />
                            )}
                            인용 역분석
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              window.location.href = `/dashboard/geo-content?generate=true&topic=${encodeURIComponent(item.topic)}&keyword=${encodeURIComponent(item.targetKeyword)}&funnel=${item.funnelStage}&procedure=${encodeURIComponent(item.procedure || '')}`;
                            }}
                          >
                            <PenTool className="w-3 h-3 mr-1" />
                            GEO 콘텐츠 생성
                          </Button>
                        </div>

                        {/* SEO 지시어 표시 */}
                        {item.seoDirectives && (
                          <div className="bg-white rounded-lg p-3 border">
                            <h5 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              역분석 기반 SEO 지시어
                            </h5>
                            {(item.seoDirectives as any)?.directives?.slice(0, 3).map((d: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 mb-2">
                                <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                                  d.priority === 'critical' ? 'bg-red-100 text-red-600' :
                                  d.priority === 'high' ? 'bg-amber-100 text-amber-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {d.priority === 'critical' ? '필수' : d.priority === 'high' ? '권장' : '참고'}
                                </span>
                                <p className="text-xs text-slate-700">{d.action}</p>
                              </div>
                            ))}
                            {(item.seoDirectives as any)?.contentScore && (
                              <div className="mt-2 pt-2 border-t flex items-center gap-4 text-xs">
                                <span className="text-slate-500">인용 가능성:</span>
                                <span className="font-bold text-slate-700">
                                  {(item.seoDirectives as any).contentScore.current} → {(item.seoDirectives as any).contentScore.potential}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 메모 */}
                        {item.notes && (
                          <p className="text-xs text-slate-500 italic">📝 {item.notes}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* 더보기 버튼 */}
            {filteredItems.length > 12 && !showAll && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="text-sm"
                >
                  <ChevronDown className="w-4 h-4 mr-1" />
                  나머지 {filteredItems.length - 12}주 더보기
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
