'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { geoContentApi, crawlerApi, api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/hooks/useToast';
import {
  PenTool, Plus, FileText, Eye, Trash2, ExternalLink,
  Loader2, CheckCircle, Clock, AlertCircle, Sparkles,
  ChevronDown, ChevronUp, BarChart3, Target, Zap,
  Copy, Download, Filter, RefreshCw, ArrowRight,
  Code, FileDown, X,
} from 'lucide-react';

// ─── Types ───
interface GeoContentItem {
  id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  bodyHtml?: string;
  bodyMarkdown?: string;
  funnelStage: string;
  contentTone: string;
  targetKeywords: string[];
  procedure?: string;
  status: string;
  aiModel?: string;
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  geoElements?: any;
  createdAt: string;
  updatedAt: string;
  publications?: any[];
}

// ─── Constants ───
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: '초안', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
  GENERATING: { label: '생성 중', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Loader2 },
  REVIEW: { label: '검토 대기', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Eye },
  PUBLISHED: { label: '발행됨', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  SCHEDULED: { label: '예약됨', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock },
  FAILED: { label: '실패', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
};

const funnelLabels: Record<string, { label: string; emoji: string }> = {
  AWARENESS: { label: '인지', emoji: '🔍' },
  CONSIDERATION: { label: '고려', emoji: '🤔' },
  DECISION: { label: '결정', emoji: '✅' },
  RETENTION: { label: '유지', emoji: '🔄' },
  ADVOCACY: { label: '추천', emoji: '📣' },
};

const toneLabels: Record<string, string> = {
  FORMAL: '공식적',
  POLITE: '정중한',
  CASUAL: '캐주얼',
  FRIENDLY: '친근한',
  PROFESSIONAL: '전문적',
};


export default function GeoContentPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const queryClient = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [funnelFilter, setFunnelFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);

  // ─── Queries ───
  const { data: statsData } = useQuery({
    queryKey: queryKeys.geoContent.stats(),
    queryFn: () => geoContentApi.getStats().then(r => r.data),
    enabled: !!hospitalId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: queryKeys.geoContent.list(statusFilter, funnelFilter),
    queryFn: () => geoContentApi.list({
      status: statusFilter || undefined,
      funnelStage: funnelFilter || undefined,
      limit: 50,
    }).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: 2 * 60 * 1000,
  });

  const contents: GeoContentItem[] = listData?.items || listData || [];
  const stats = statsData || { total: 0, byStatus: {}, byFunnel: {}, recentContents: [] };

  // ─── Delete mutation ───
  const deleteMutation = useMutation({
    mutationFn: (id: string) => geoContentApi.delete(id),
    onSuccess: () => {
      toast.success('콘텐츠가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['geo-content'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.geoContent.stats() });
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <Header title="AI 콘텐츠" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6">
      <Header
        title="AI 콘텐츠"
        subtitle="콘텐츠 갭에서 발견된 기회를 AI가 자동으로 콘텐츠로 만들어줍니다"
      />

      {/* ─── 상단 통계 카드 ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
                <PenTool className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">전체 콘텐츠</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">검토 대기</p>
                <p className="text-2xl font-bold text-blue-600">{stats.byStatus?.REVIEW || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">발행됨</p>
                <p className="text-2xl font-bold text-green-600">{stats.byStatus?.PUBLISHED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">생성 중</p>
                <p className="text-2xl font-bold text-amber-600">{stats.byStatus?.GENERATING || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 액션 바 ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">전체 상태</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          {/* 퍼널 필터 */}
          <select
            value={funnelFilter}
            onChange={(e) => setFunnelFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">전체 단계</option>
            {Object.entries(funnelLabels).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['geo-content'] });
              queryClient.invalidateQueries({ queryKey: queryKeys.geoContent.stats() });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            새로고침
          </Button>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          새 콘텐츠 생성
        </Button>
      </div>

      {/* ─── 콘텐츠 목록 ─── */}
      {contents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <PenTool className="h-16 w-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              아직 생성된 콘텐츠가 없습니다
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              기회 분석에서 발견된 콘텐츠 갭을 기반으로 AI가 자동으로 블로그 풀 아티클을 만들어줍니다.
              직접 주제를 입력해서 생성할 수도 있어요!
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => setShowCreateModal(true)}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                AI 콘텐츠 생성
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/dashboard/opportunities'}>
                <Target className="h-4 w-4 mr-1.5" />
                기회 분석 보기
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contents.map((item) => {
            const stCfg = statusConfig[item.status] || statusConfig.DRAFT;
            const funnel = funnelLabels[item.funnelStage] || { label: item.funnelStage, emoji: '📄' };
            const isExpanded = expandedId === item.id;
            const StatusIcon = stCfg.icon;

            return (
              <Card key={item.id} className="hover:shadow-card-hover transition-all">
                <CardContent className="p-4">
                  {/* 헤더 */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                        <PenTool className="h-5 w-5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${stCfg.color}`}>
                            <StatusIcon className={`h-3 w-3 ${item.status === 'GENERATING' ? 'animate-spin' : ''}`} />
                            {stCfg.label}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded-full">
                            {funnel.emoji} {funnel.label}
                          </span>
                          {item.contentTone && (
                            <span className="px-2 py-0.5 text-[10px] bg-purple-50 text-purple-500 rounded-full">
                              {toneLabels[item.contentTone] || item.contentTone}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {item.title}
                        </h4>
                        {item.excerpt && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.excerpt}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          <span>{new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {item.procedure && <span className="text-brand-500">#{item.procedure}</span>}
                          {item.targetKeywords?.length > 0 && (
                            <span>키워드 {item.targetKeywords.length}개</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* 확장 영역 */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* 메타 정보 */}
                      {item.metaDescription && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-semibold text-slate-500 mb-1">META DESCRIPTION</p>
                          <p className="text-xs text-slate-700">{item.metaDescription}</p>
                        </div>
                      )}

                      {/* 키워드 */}
                      {item.targetKeywords?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 mb-1.5">타겟 키워드</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.targetKeywords.map((kw, i) => (
                              <span key={i} className="px-2 py-0.5 text-[10px] bg-brand-50 text-brand-600 rounded-full border border-brand-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* GEO 요소 */}
                      {item.geoElements && (
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-[10px] font-semibold text-green-700 mb-1.5">GEO 최적화 요소</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {item.geoElements.checklist && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" /> 체크리스트
                              </div>
                            )}
                            {item.geoElements.faq && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" /> FAQ
                              </div>
                            )}
                            {item.geoElements.table && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" /> 비교표
                              </div>
                            )}
                            {item.geoElements.disclaimer && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" /> 면책 조항
                              </div>
                            )}
                            {item.geoElements.keyTakeaway && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" /> 핵심 요약
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 본문 미리보기 */}
                      {item.bodyHtml && (
                        <div className="bg-white border rounded-xl p-4 max-h-[500px] overflow-y-auto">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-slate-700">블로그 본문</p>
                            <span className="text-[10px] text-slate-400">
                              {item.bodyHtml.replace(/<[^>]+>/g, '').length.toLocaleString()}자
                            </span>
                          </div>
                          <div
                            className="prose prose-sm max-w-none text-slate-700 prose-h2:text-base prose-h2:font-bold prose-h2:text-slate-900 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-sm prose-h3:font-semibold prose-h3:text-slate-800 prose-h3:mt-4 prose-h3:mb-2 prose-table:text-xs prose-table:border prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2 prose-td:border"
                            dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
                          />
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 flex-wrap pt-2">
                        {item.bodyHtml && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const text = item.bodyHtml?.replace(/<[^>]+>/g, '') || '';
                                navigator.clipboard.writeText(text);
                                toast.success('텍스트 본문이 복사되었습니다');
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              텍스트 복사
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(item.bodyHtml || '');
                                toast.success('HTML 본문이 복사되었습니다 (블로그 편집기에 붙여넣기)');
                              }}
                            >
                              <Code className="h-3 w-3 mr-1" />
                              HTML 복사
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const meta = [
                                  `제목: ${item.title}`,
                                  item.subtitle ? `부제: ${item.subtitle}` : '',
                                  item.metaDescription ? `META: ${item.metaDescription}` : '',
                                  item.targetKeywords?.length ? `키워드: ${item.targetKeywords.join(', ')}` : '',
                                  '',
                                  item.bodyHtml?.replace(/<[^>]+>/g, '') || '',
                                ].filter(Boolean).join('\n');
                                navigator.clipboard.writeText(meta);
                                toast.success('제목 + META + 본문 전체가 복사되었습니다');
                              }}
                            >
                              <FileDown className="h-3 w-3 mr-1" />
                              전체 복사
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('이 콘텐츠를 삭제하시겠습니까?')) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── 하단 안내 ─── */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-800">GEO 콘텐츠 자동 파이프라인</p>
                <p className="text-xs text-indigo-600 mt-1">
                  크롤링에서 발견된 콘텐츠 갭 → AI가 자동으로 블로그 초안 생성 → 검토 후 발행 → 2주 후 SoV 재측정.
                  기회 분석 페이지에서 갭별 "콘텐츠 생성" 버튼을 눌러도 됩니다.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => window.location.href = '/dashboard/opportunities'}>
              기회 분석 <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 생성 모달 ─── */}
      {showCreateModal && (
        <CreateContentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['geo-content'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.geoContent.stats() });
          }}
        />
      )}
    </div>
  );
}

// ==================== 콘텐츠 생성 모달 ====================
function CreateContentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [topic, setTopic] = useState('');
  const [funnelStage, setFunnelStage] = useState('AWARENESS');
  const [contentTone, setContentTone] = useState('PROFESSIONAL');
  const [procedure, setProcedure] = useState('');
  const [keywords, setKeywords] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('주제를 입력해주세요');
      return;
    }

    setIsGenerating(true);
    try {
      await geoContentApi.generate({
        topic: topic.trim(),
        funnelStage,
        contentTone,
        procedure: procedure.trim() || undefined,
        targetKeywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        additionalInstructions: additionalInstructions.trim() || undefined,
      });
      toast.success('AI가 콘텐츠를 생성하고 있습니다! 잠시 후 목록에서 확인하세요.');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '콘텐츠 생성에 실패했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            <h3 className="text-lg font-bold text-slate-900">AI 콘텐츠 생성</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 주제 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              주제 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 임플란트 시술 후 관리법, 투명교정 비교 가이드"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* 퍼널 단계 + 톤 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">퍼널 단계</label>
              <select
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Object.entries(funnelLabels).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">콘텐츠 톤</label>
              <select
                value={contentTone}
                onChange={(e) => setContentTone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Object.entries(toneLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 시술명 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">관련 시술명</label>
            <input
              type="text"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              placeholder="예: 임플란트, 라미네이트, 투명교정"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* 키워드 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">타겟 키워드 (콤마 구분)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="예: 강남 임플란트, 임플란트 가격, 임플란트 후기"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* 추가 지시사항 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">추가 지시사항 (선택)</label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="예: 서울비디치과의 감염관리 시스템을 강조해주세요"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* 생성 정보 */}
          <div className="bg-brand-50 rounded-xl p-3 border border-brand-100">
            <p className="text-xs font-semibold text-brand-700 mb-1">✨ GPT-4o 고급 모델로 생성</p>
            <p className="text-[11px] text-brand-600">
              2,500자+ 블로그 풀 아티클 · SEO/GEO 최적화 · 비교표 · FAQ · 체크리스트 자동 포함
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isGenerating}>
              취소
            </Button>
            <Button onClick={handleGenerate} className="flex-1" loading={isGenerating} disabled={isGenerating}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {isGenerating ? 'AI 생성 중...' : 'AI로 생성하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
