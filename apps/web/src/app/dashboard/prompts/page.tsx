'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { promptsApi, hospitalApi, queryTemplatesApi, schedulerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Search,
  Loader2,
  Lightbulb,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Stethoscope,
  Star,
  AlertCircle,
  Heart,
  BarChart3,
  TrendingUp,
  Zap,
  Calendar,
  Grid3X3,
  RefreshCw,
  Target,
  Layers,
} from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { UsageBar, UpgradeModal, getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { Lock } from 'lucide-react';

// 카테고리별 아이콘 & 색상 매핑
const categoryConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  '추천': { icon: Star, color: 'text-brand-700', bgColor: 'bg-brand-50 border-brand-200' },
  '비교': { icon: BarChart3, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  '가격': { icon: TrendingUp, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  '증상': { icon: AlertCircle, color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  '후기': { icon: MessageSquare, color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  '불안해소': { icon: Heart, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  '강점': { icon: Sparkles, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  '지역': { icon: MapPin, color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  '플랫폼': { icon: Stethoscope, color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
};

// 의도별 아이콘 & 색상
const intentConfig: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  RESERVATION: { icon: Target, label: '예약', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  COMPARISON: { icon: BarChart3, label: '비교', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  INFORMATION: { icon: Lightbulb, label: '정보', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  REVIEW: { icon: MessageSquare, label: '후기', color: 'text-teal-700', bgColor: 'bg-teal-50' },
  FEAR: { icon: Heart, label: '불안해소', color: 'text-red-700', bgColor: 'bg-red-50' },
};

// 톤별 라벨
const toneLabels: Record<string, string> = {
  casual: '구어체',
  polite: '정중체',
  comparison: '비교형',
  emotional: '감성형',
  professional: '전문형',
  seasonal: '시즌',
  symptom: '증상',
  strength: '강점',
  competitor: '경쟁비교',
};

// 진료과별 placeholder 예시
const specialtyPlaceholders: Record<string, string> = {
  DENTAL: '예: 강남역 근처 임플란트 잘하는 치과 추천해줘',
  DERMATOLOGY: '예: 강남 보톡스 잘하는 피부과 추천해줘',
  ORTHOPEDICS: '예: 잠실 무릎관절 잘하는 정형외과 추천해줘',
  KOREAN_MEDICINE: '예: 홍대 추나요법 잘하는 한의원 추천해줘',
  OPHTHALMOLOGY: '예: 신촌 라식 잘하는 안과 추천해줘',
  INTERNAL_MEDICINE: '예: 건강검진 꼼꼼한 강남 내과 추천해줘',
  UROLOGY: '예: 강남 전립선 검사 잘하는 비뇨기과 추천해줘',
  PLASTIC_SURGERY: '예: 압구정 눈성형 자연스러운 성형외과 추천해줘',
  ENT: '예: 코골이 수술 잘하는 이비인후과 추천해줘',
  PSYCHIATRY: '예: 강남 우울증 상담 잘하는 정신건강의학과 추천해줘',
  OBSTETRICS: '예: 산전검사 꼼꼼한 산부인과 추천해줘',
  PEDIATRICS: '예: 영유아 예방접종 잘하는 소아과 추천해줘',
  OTHER: '예: 지역명 + 시술/증상 + 병원 추천해줘',
};

// 진료과 한글 이름
const specialtyNames: Record<string, string> = {
  DENTAL: '치과',
  DERMATOLOGY: '피부과',
  ORTHOPEDICS: '정형외과',
  KOREAN_MEDICINE: '한의원',
  OPHTHALMOLOGY: '안과',
  INTERNAL_MEDICINE: '내과',
  UROLOGY: '비뇨기과',
  PLASTIC_SURGERY: '성형외과',
  ENT: '이비인후과',
  PSYCHIATRY: '정신건강의학과',
  OBSTETRICS: '산부인과',
  PEDIATRICS: '소아과',
  OTHER: '기타',
};

export default function PromptsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  const { data: hospitalData } = useQuery({
    queryKey: ['hospital', hospitalId],
    queryFn: () => hospitalApi.get(hospitalId!).then(r => r.data),
    enabled: !!hospitalId,
    staleTime: 60 * 1000,
  });

  const planType = hospitalData?.planType || (user as any)?.hospital?.planType || 'FREE';
  const planLimits = getPlanLimits(planType);
  const MAX_PROMPTS = planLimits.maxPrompts === -1 ? 999 : planLimits.maxPrompts;
  const [newPrompt, setNewPrompt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showMatrix, setShowMatrix] = useState(false);
  const [selectedMatrixPrompts, setSelectedMatrixPrompts] = useState<Set<string>>(new Set());

  // 프롬프트 목록 조회
  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', hospitalId],
    queryFn: () => promptsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 질문 제안 조회
  const { data: suggestData, isLoading: isSuggestLoading } = useQuery({
    queryKey: ['suggestions', hospitalId],
    queryFn: () => queryTemplatesApi.suggestQuestions(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showSuggestions,
  });

  // 매트릭스 미리보기
  const { data: matrixData, isLoading: isMatrixLoading, refetch: refetchMatrix } = useQuery({
    queryKey: ['matrix-preview', hospitalId],
    queryFn: () => schedulerApi.matrixPreview(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showMatrix,
  });

  // 프롬프트 추가
  const addMutation = useMutation({
    mutationFn: (promptText: string) =>
      promptsApi.create(hospitalId!, { promptText, promptType: 'CUSTOM' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setNewPrompt('');
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_LIMIT_REACHED') {
        setUpgradeFeature('maxPrompts');
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || '질문 추가에 실패했습니다.');
      }
    },
  });

  // 제안/매트릭스 질문 일괄 추가
  const bulkAddMutation = useMutation({
    mutationFn: async (texts: string[]) => {
      let added = 0;
      for (const text of texts) {
        try {
          await promptsApi.create(hospitalId!, { promptText: text, promptType: 'CUSTOM' });
          added++;
        } catch (err: any) {
          const errData = err.response?.data;
          if (errData?.error === 'PLAN_LIMIT_REACHED') {
            toast.warning(`플랜 한도 도달! ${added}개만 추가되었습니다.`);
            break;
          }
        }
      }
      return added;
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['matrix-preview'] });
      setSelectedSuggestions(new Set());
      setSelectedMatrixPrompts(new Set());
      if (added > 0) {
        toast.success(`${added}개 질문이 추가되었습니다!`);
      }
    },
  });

  // 프롬프트 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => promptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  // 활성화/비활성화
  const toggleMutation = useMutation({
    mutationFn: (id: string) => promptsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  // AI 연관 질문 생성
  const generateMutation = useMutation({
    mutationFn: (promptId: string) => promptsApi.generateFanouts(promptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast.success('AI가 연관 질문을 생성했습니다!');
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === 'PLAN_UPGRADE_REQUIRED') {
        setUpgradeFeature('queryFanouts');
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || '질문 생성에 실패했습니다.');
      }
    },
  });

  const totalPrompts = prompts?.length || 0;
  const activePrompts = prompts?.filter((p: any) => p.isActive)?.length || 0;
  const isAtLimit = activePrompts >= MAX_PROMPTS;
  const remainingSlots = MAX_PROMPTS - activePrompts;

  const handleAddPrompt = () => {
    if (!newPrompt.trim()) return;
    addMutation.mutate(newPrompt.trim());
  };

  const filteredPrompts = prompts?.filter((prompt: any) =>
    prompt.promptText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSuggestionSelect = (query: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(query)) {
        next.delete(query);
      } else {
        if (next.size >= remainingSlots) {
          toast.warning(`남은 슬롯이 ${remainingSlots}개입니다.`);
          return prev;
        }
        next.add(query);
      }
      return next;
    });
  };

  const toggleMatrixSelect = (text: string) => {
    setSelectedMatrixPrompts(prev => {
      const next = new Set(prev);
      if (next.has(text)) {
        next.delete(text);
      } else {
        if (next.size >= remainingSlots) {
          toast.warning(`남은 슬롯이 ${remainingSlots}개입니다.`);
          return prev;
        }
        next.add(text);
      }
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const groupedSuggestions = suggestData?.suggestions?.reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const handleBulkAdd = () => {
    const texts = Array.from(selectedSuggestions);
    if (texts.length === 0) return;
    bulkAddMutation.mutate(texts);
  };

  const handleMatrixBulkAdd = () => {
    const texts = Array.from(selectedMatrixPrompts);
    if (texts.length === 0) return;
    bulkAddMutation.mutate(texts);
  };

  const handleOpenSuggestions = () => {
    setShowSuggestions(true);
    setShowMatrix(false);
    setSelectedSuggestions(new Set());
    if (suggestData?.suggestions) {
      const cats = new Set<string>(suggestData.suggestions.map((s: any) => s.category as string));
      setExpandedCategories(cats);
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="질문 관리" description="모니터링할 질문을 관리합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-slate-500 mb-4">
                질문을 관리하려면 먼저 병원 정보를 등록해주세요.
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
      <Header
        title="질문 관리"
        description={hospitalData?.specialtyType 
          ? `${specialtyNames[hospitalData.specialtyType] || '병원'} AI 모니터링 질문을 관리합니다`
          : 'AI에게 물어볼 질문을 관리합니다'}
      />

      <div className="p-6 space-y-6">
        {/* 플랜 사용량 표시 */}
        <Card className="bg-gradient-to-r from-slate-50 to-white">
          <CardContent className="p-4">
            <UsageBar
              used={activePrompts}
              limit={MAX_PROMPTS}
              label="모니터링 질문"
              planType={planType}
            />
          </CardContent>
        </Card>

        {/* 질문 개수 현황 + 새 질문 추가 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                새 질문 추가
              </span>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                isAtLimit
                  ? 'bg-red-100 text-red-700'
                  : remainingSlots <= 3
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {activePrompts} / {MAX_PROMPTS}개
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAtLimit ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-red-700 font-medium">
                  질문은 최대 {MAX_PROMPTS}개까지 등록할 수 있습니다
                </p>
                <p className="text-red-500 text-sm mt-1">
                  기존 질문을 삭제하거나 비활성화한 후 새 질문을 추가해주세요
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <Input
                    placeholder={specialtyPlaceholders[hospitalData?.specialtyType || 'DENTAL'] || specialtyPlaceholders.OTHER}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddPrompt}
                    disabled={addMutation.isPending || !newPrompt.trim()}
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    추가
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-slate-500">
                    💡 팁: 환자들이 실제로 검색할 만한 질문을 추가해보세요 (남은 슬롯: {remainingSlots}개)
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowMatrix(true); setShowSuggestions(false); setSelectedMatrixPrompts(new Set()); }}
                      className="text-brand-700 border-brand-300 hover:bg-brand-50"
                    >
                      <Grid3X3 className="h-4 w-4 mr-1.5" />
                      매트릭스 엔진
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenSuggestions}
                      className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      <Lightbulb className="h-4 w-4 mr-1.5" />
                      질문 제안
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ==================== 5×5 매트릭스 엔진 패널 ==================== */}
        {showMatrix && (
          <Card className="border-brand-200 bg-gradient-to-br from-brand-50/60 to-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-brand-600" />
                  5×5 매트릭스 프롬프트 엔진
                  <span className="text-xs font-normal bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                    V3
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchMatrix()}
                    disabled={isMatrixLoading}
                    title="새로고침"
                  >
                    <RefreshCw className={`h-4 w-4 ${isMatrixLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  {selectedMatrixPrompts.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleMatrixBulkAdd}
                      disabled={bulkAddMutation.isPending}
                      className="bg-brand-600 hover:bg-brand-700 text-white"
                    >
                      {bulkAddMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      {selectedMatrixPrompts.size}개 추가
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowMatrix(false); setSelectedMatrixPrompts(new Set()); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                의도 × 시술 × 톤 × 시즌 × 지역 — 5축 매트릭스에서 매일 최적 프롬프트를 자동 선별합니다
                {hospitalData?.specialtyType && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[10px] font-semibold">
                    <Stethoscope className="h-2.5 w-2.5" />
                    {specialtyNames[hospitalData.specialtyType] || hospitalData.specialtyType} 전용 매트릭스
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {isMatrixLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-3" />
                  <p className="text-sm text-slate-500">매트릭스 후보를 생성하고 있습니다...</p>
                </div>
              ) : matrixData ? (
                <div className="space-y-4">
                  {/* 매트릭스 통계 */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-3 text-center">
                      <div className="text-2xl font-bold text-brand-600">{matrixData.matrix?.totalCandidates || 0}</div>
                      <div className="text-xs text-slate-500">총 후보</div>
                    </div>
                    {Object.entries(matrixData.matrix?.byIntent || {}).slice(0, 4).map(([intent, count]) => {
                      const config = intentConfig[intent];
                      return (
                        <div key={intent} className={`${config?.bgColor || 'bg-slate-50'} rounded-2xl border border-slate-200 p-3 text-center`}>
                          <div className={`text-2xl font-bold ${config?.color || 'text-slate-700'}`}>{count as number}</div>
                          <div className="text-xs text-slate-500">{config?.label || intent}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 시술별 분포 미니차트 */}
                  {matrixData.matrix?.byProcedure && Object.keys(matrixData.matrix.byProcedure).length > 0 && (
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        시술별 후보 분포
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(matrixData.matrix.byProcedure).map(([proc, count]) => {
                          const max = Math.max(...Object.values(matrixData.matrix.byProcedure).map(Number));
                          const pct = max > 0 ? ((count as number) / max) * 100 : 0;
                          return (
                            <div key={proc} className="flex-1 min-w-[120px]">
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className="text-slate-700 font-medium truncate">{proc}</span>
                                <span className="text-slate-400">{count as number}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 시즌 태그 */}
                  {matrixData.matrix?.bySeason && Object.keys(matrixData.matrix.bySeason).length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">오늘의 시즌:</span>
                      {Object.entries(matrixData.matrix.bySeason).map(([season, count]) => (
                        <span key={season} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                          {season} ({count as number})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 오늘의 추천 프롬프트 */}
                  <div className="border-t border-brand-100 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-brand-500" />
                        오늘의 추천 ({matrixData.todayCount}개)
                      </h4>
                      <span className="text-xs text-slate-400">
                        기존 {matrixData.existingCount}개 질문 제외 · 다양성 최적화
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {matrixData.todaySelection?.map((item: any, idx: number) => {
                        const isSelected = selectedMatrixPrompts.has(item.text);
                        const iConfig = intentConfig[item.intent];
                        const IntentIcon = iConfig?.icon || Target;
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleMatrixSelect(item.text)}
                            className={`w-full text-left px-3 py-3 rounded-2xl border text-sm transition-all ${
                              isSelected
                                ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
                                : 'border-transparent bg-white/80 hover:bg-white backdrop-blur-sm hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                isSelected
                                  ? 'bg-brand-500 border-brand-500'
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div className="flex-1">
                                <span className={`${isSelected ? 'text-brand-900 font-medium' : 'text-slate-700'}`}>
                                  {item.text}
                                </span>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${iConfig?.bgColor || 'bg-slate-50'} ${iConfig?.color || 'text-slate-600'}`}>
                                    <IntentIcon className="h-2.5 w-2.5" />
                                    {iConfig?.label || item.intent}
                                  </span>
                                  <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded-full">
                                    {toneLabels[item.tone] || item.tone}
                                  </span>
                                  {item.season && (
                                    <span className="text-[10px] text-amber-600 px-1.5 py-0.5 bg-amber-50 rounded-full">
                                      🗓 {item.season}
                                    </span>
                                  )}
                                  {item.procedure && (
                                    <span className="text-[10px] text-slate-400">
                                      {item.procedure}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-300 ml-auto">
                                    가중치 {item.weight}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 하단 액션 바 */}
                  <div className="flex items-center justify-between pt-3 border-t border-brand-100">
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-brand-700">{matrixData.todayCount}</span>개 추천 중{' '}
                      <span className="font-medium text-brand-700">{selectedMatrixPrompts.size}</span>개 선택
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedMatrixPrompts.size > 0) {
                            setSelectedMatrixPrompts(new Set());
                          } else {
                            const all = (matrixData.todaySelection || []).slice(0, remainingSlots).map((s: any) => s.text);
                            setSelectedMatrixPrompts(new Set(all));
                          }
                        }}
                      >
                        {selectedMatrixPrompts.size > 0 ? '전체 해제' : `전체 선택`}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleMatrixBulkAdd}
                        disabled={selectedMatrixPrompts.size === 0 || bulkAddMutation.isPending}
                        className="bg-brand-600 hover:bg-brand-700 text-white"
                      >
                        {bulkAddMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        {selectedMatrixPrompts.size}개 추가하기
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  매트릭스 데이터를 불러올 수 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== 질문 제안 패널 ==================== */}
        {showSuggestions && (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  AI 질문 제안
                  {suggestData?.hospital && (
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      {suggestData.hospital.name} · {suggestData.hospital.specialty} · {suggestData.hospital.region}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {selectedSuggestions.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBulkAdd}
                      disabled={bulkAddMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {bulkAddMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      {selectedSuggestions.size}개 추가
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowSuggestions(false); setSelectedSuggestions(new Set()); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              {suggestData?.hospital?.procedures && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-xs text-slate-500">핵심 진료:</span>
                  {suggestData.hospital.procedures.map((p: string) => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {isSuggestLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
                  <p className="text-sm text-slate-500">병원 정보를 분석하여 질문을 생성하고 있습니다...</p>
                </div>
              ) : Object.keys(groupedSuggestions).length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-slate-700 font-medium">모든 제안 질문이 이미 등록되어 있습니다!</p>
                  <p className="text-slate-500 text-sm mt-1">직접 질문을 입력하거나 핵심 시술을 변경해보세요.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {(Object.entries(groupedSuggestions) as [string, any[]][]).map(([category, items]) => {
                    const config = categoryConfig[category] || categoryConfig['추천'];
                    const IconComp = config.icon;
                    const isExpanded = expandedCategories.has(category);
                    const selectedInCategory = items.filter(s => selectedSuggestions.has(s.query)).length;

                    return (
                      <div key={category} className={`border rounded-2xl overflow-hidden ${config.bgColor}`}>
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-80 transition"
                        >
                          <div className="flex items-center gap-2">
                            <IconComp className={`h-4 w-4 ${config.color}`} />
                            <span className={`text-sm font-semibold ${config.color}`}>{category}</span>
                            <span className="text-xs text-slate-500">{items.length}개</span>
                            {selectedInCategory > 0 && (
                              <span className="text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded-full">{selectedInCategory}개 선택</span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {items.map((s: any) => {
                              const isSelected = selectedSuggestions.has(s.query);
                              return (
                                <button
                                  key={s.query}
                                  onClick={() => toggleSuggestionSelect(s.query)}
                                  className={`w-full text-left px-3 py-2.5 rounded-2xl border text-sm transition-all ${
                                    isSelected
                                      ? 'border-amber-400 bg-amber-100 ring-1 ring-amber-300'
                                      : 'border-transparent bg-white/80 hover:bg-white/80 backdrop-blur-sm hover:border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                      isSelected
                                        ? 'bg-amber-500 border-amber-500'
                                        : 'border-slate-300 bg-white/80 backdrop-blur-sm'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className={`${isSelected ? 'text-amber-900 font-medium' : 'text-slate-700'}`}>
                                      {s.query}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestData && Object.keys(groupedSuggestions).length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-amber-200">
                  <div className="text-sm text-slate-600">
                    <span className="font-medium text-amber-700">{suggestData.total}</span>개 제안 중{' '}
                    <span className="font-medium text-amber-700">{selectedSuggestions.size}</span>개 선택
                    {remainingSlots < suggestData.total && (
                      <span className="text-slate-400 ml-2">(슬롯 {remainingSlots}개 남음)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedSuggestions.size === suggestData.suggestions.length || selectedSuggestions.size >= remainingSlots) {
                          setSelectedSuggestions(new Set());
                        } else {
                          const all = suggestData.suggestions.slice(0, remainingSlots).map((s: any) => s.query);
                          setSelectedSuggestions(new Set(all));
                        }
                      }}
                    >
                      {selectedSuggestions.size > 0 ? '전체 해제' : `전체 선택 (최대 ${remainingSlots}개)`}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkAdd}
                      disabled={selectedSuggestions.size === 0 || bulkAddMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {bulkAddMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      {selectedSuggestions.size}개 추가하기
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 검색 */}
        <div className="flex justify-between items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="질문 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <p className="text-sm text-slate-500">
            매일 매트릭스 엔진이 자동으로 프롬프트를 생성합니다
          </p>
        </div>

        {/* 질문 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                등록된 질문 ({filteredPrompts?.length || 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
            ) : filteredPrompts?.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 질문이 없습니다'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  위에서 새 질문을 추가하거나{' '}
                  <button onClick={() => { setShowMatrix(true); setShowSuggestions(false); }} className="text-brand-600 underline font-medium">매트릭스 엔진</button>
                  을 이용해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPrompts?.map((prompt: any) => (
                  <div
                    key={prompt.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border ${
                      prompt.isActive ? 'bg-white/80 backdrop-blur-sm' : 'bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-slate-900">{prompt.promptText}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          prompt.promptType === 'PRESET'
                            ? 'bg-brand-100 text-brand-700'
                            : prompt.promptType === 'AUTO_GENERATED'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {prompt.promptType === 'PRESET' ? '추천' :
                           prompt.promptType === 'AUTO_GENERATED' ? 'AI생성' : '직접입력'}
                        </span>
                        {prompt.specialtyCategory && (
                          <span className="text-xs text-slate-500">
                            {prompt.specialtyCategory}
                          </span>
                        )}
                        {prompt._count?.aiResponses > 0 && (
                          <span className="text-xs text-slate-400">
                            응답 {prompt._count.aiResponses}개
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isAtLimit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!canUseFeature(planType, 'queryFanouts')) {
                              setUpgradeFeature('queryFanouts');
                              setShowUpgradeModal(true);
                              return;
                            }
                            generateMutation.mutate(prompt.id);
                          }}
                          disabled={generateMutation.isPending}
                          title="AI로 연관 질문 생성"
                        >
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          {!canUseFeature(planType, 'queryFanouts') && (
                            <Lock className="h-3 w-3 ml-0.5 text-slate-400" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate(prompt.id)}
                        title={prompt.isActive ? '비활성화' : '활성화'}
                      >
                        {prompt.isActive ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('이 질문을 삭제하시겠습니까?')) {
                            deleteMutation.mutate(prompt.id);
                          }
                        }}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        currentPlan={planType}
      />
    </div>
  );
}
