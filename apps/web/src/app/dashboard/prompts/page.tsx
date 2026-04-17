'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { promptsApi, hospitalApi, queryTemplatesApi } from '@/lib/api';
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
} from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { UsageBar, UpgradeModal, getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { Lock } from 'lucide-react';

// 카테고리별 아이콘 & 색상 매핑
const categoryConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  '추천': { icon: Star, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  '비교': { icon: BarChart3, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  '가격': { icon: TrendingUp, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  '증상': { icon: AlertCircle, color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  '후기': { icon: MessageSquare, color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  '불안해소': { icon: Heart, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  '강점': { icon: Sparkles, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  '지역': { icon: MapPin, color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  '플랫폼': { icon: Stethoscope, color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' },
};

export default function PromptsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  // 서버에서 최신 hospital 데이터 가져오기 (planType 동기화)
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
  
  // 질문 제안 패널 상태
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 프롬프트 목록 조회
  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', hospitalId],
    queryFn: () => promptsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 질문 제안 조회
  const { data: suggestData, isLoading: isSuggestLoading, refetch: refetchSuggestions } = useQuery({
    queryKey: ['suggestions', hospitalId],
    queryFn: () => queryTemplatesApi.suggestQuestions(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showSuggestions,
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

  // 제안 질문 일괄 추가
  const bulkAddMutation = useMutation({
    mutationFn: async (texts: string[]) => {
      // 하나씩 순차적으로 추가 (에러 시에도 가능한 것까지 추가)
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
      setSelectedSuggestions(new Set());
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

  // 프롬프트 활성화/비활성화
  const toggleMutation = useMutation({
    mutationFn: (id: string) => promptsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  // AI 추천 질문 생성
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

  // 제안 질문 선택 토글
  const toggleSuggestionSelect = (query: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(query)) {
        next.delete(query);
      } else {
        if (next.size >= remainingSlots) {
          toast.warning(`남은 슬롯이 ${remainingSlots}개입니다. 그 이상 선택할 수 없습니다.`);
          return prev;
        }
        next.add(query);
      }
      return next;
    });
  };

  // 카테고리 접기/펼치기
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // 제안 카테고리별 그룹화
  const groupedSuggestions = suggestData?.suggestions?.reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // 선택한 질문 일괄 추가
  const handleBulkAdd = () => {
    const texts = Array.from(selectedSuggestions);
    if (texts.length === 0) return;
    bulkAddMutation.mutate(texts);
  };

  // 질문 제안 패널 열기
  const handleOpenSuggestions = () => {
    setShowSuggestions(true);
    setSelectedSuggestions(new Set());
    // 모든 카테고리 펼치기
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
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
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
        description="AI에게 물어볼 질문을 관리합니다"
      />

      <div className="p-6 space-y-6">
        {/* 플랜 사용량 표시 */}
        <Card className="bg-gradient-to-r from-gray-50 to-white">
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
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
                    placeholder="예: 강남역 근처 임플란트 잘하는 치과 추천해줘"
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
                  <p className="text-sm text-gray-500">
                    💡 팁: 환자들이 실제로 검색할 만한 질문을 추가해보세요 (남은 슬롯: {remainingSlots}개)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSuggestions}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50 flex-shrink-0"
                  >
                    <Lightbulb className="h-4 w-4 mr-1.5" />
                    질문 제안
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ==================== 질문 제안 패널 ==================== */}
        {showSuggestions && (
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  AI 질문 제안
                  {suggestData?.hospital && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
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
                  <span className="text-xs text-gray-500">핵심 진료:</span>
                  {suggestData.hospital.procedures.map((p: string) => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {isSuggestLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
                  <p className="text-sm text-gray-500">병원 정보를 분석하여 질문을 생성하고 있습니다...</p>
                </div>
              ) : Object.keys(groupedSuggestions).length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">모든 제안 질문이 이미 등록되어 있습니다!</p>
                  <p className="text-gray-500 text-sm mt-1">직접 질문을 입력하거나 핵심 시술을 변경해보세요.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {(Object.entries(groupedSuggestions) as [string, any[]][]).map(([category, items]) => {
                    const config = categoryConfig[category] || categoryConfig['추천'];
                    const IconComp = config.icon;
                    const isExpanded = expandedCategories.has(category);
                    const selectedInCategory = items.filter(s => selectedSuggestions.has(s.query)).length;

                    return (
                      <div key={category} className={`border rounded-lg overflow-hidden ${config.bgColor}`}>
                        {/* 카테고리 헤더 */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-80 transition"
                        >
                          <div className="flex items-center gap-2">
                            <IconComp className={`h-4 w-4 ${config.color}`} />
                            <span className={`text-sm font-semibold ${config.color}`}>{category}</span>
                            <span className="text-xs text-gray-500">{items.length}개</span>
                            {selectedInCategory > 0 && (
                              <span className="text-xs bg-amber-600 text-white px-1.5 py-0.5 rounded-full">{selectedInCategory}개 선택</span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>

                        {/* 질문 목록 */}
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {items.map((s: any) => {
                              const isSelected = selectedSuggestions.has(s.query);
                              return (
                                <button
                                  key={s.query}
                                  onClick={() => toggleSuggestionSelect(s.query)}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                                    isSelected
                                      ? 'border-amber-400 bg-amber-100 ring-1 ring-amber-300'
                                      : 'border-transparent bg-white/80 hover:bg-white hover:border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                      isSelected
                                        ? 'bg-amber-500 border-amber-500'
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className={`${isSelected ? 'text-amber-900 font-medium' : 'text-gray-700'}`}>
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

              {/* 하단 액션 바 */}
              {suggestData && Object.keys(groupedSuggestions).length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-amber-200">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-amber-700">{suggestData.total}</span>개 제안 중{' '}
                    <span className="font-medium text-amber-700">{selectedSuggestions.size}</span>개 선택
                    {remainingSlots < suggestData.total && (
                      <span className="text-gray-400 ml-2">(슬롯 {remainingSlots}개 남음)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // 전체 선택/해제
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="질문 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <p className="text-sm text-gray-500">
            크롤링은 매일 자동으로 실행됩니다
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
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : filteredPrompts?.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 질문이 없습니다'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  위에서 새 질문을 추가하거나 <button onClick={handleOpenSuggestions} className="text-amber-600 underline font-medium">질문 제안</button>을 이용해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPrompts?.map((prompt: any) => (
                  <div
                    key={prompt.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      prompt.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-gray-900">{prompt.promptText}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          prompt.promptType === 'PRESET'
                            ? 'bg-blue-100 text-blue-700'
                            : prompt.promptType === 'AUTO_GENERATED'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {prompt.promptType === 'PRESET' ? '추천' :
                           prompt.promptType === 'AUTO_GENERATED' ? 'AI생성' : '직접입력'}
                        </span>
                        {prompt.specialtyCategory && (
                          <span className="text-xs text-gray-500">
                            {prompt.specialtyCategory}
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
                            <Lock className="h-3 w-3 ml-0.5 text-gray-400" />
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
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
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

      {/* 업그레이드 모달 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        currentPlan={planType}
      />
    </div>
  );
}
