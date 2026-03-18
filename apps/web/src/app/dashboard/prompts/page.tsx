'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { promptsApi, hospitalApi } from '@/lib/api';
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
} from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { UsageBar, UpgradeModal, getPlanLimits, canUseFeature } from '@/components/plan/PlanGate';
import { Lock } from 'lucide-react';

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

  const planType = hospitalData?.planType || (user as any)?.hospital?.planType || 'STARTER';
  const planLimits = getPlanLimits(planType);
  const MAX_PROMPTS = planLimits.maxPrompts === -1 ? 999 : planLimits.maxPrompts;
  const [newPrompt, setNewPrompt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  // 프롬프트 목록 조회
  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', hospitalId],
    queryFn: () => promptsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
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
  const isAtLimit = totalPrompts >= MAX_PROMPTS;
  const remainingSlots = MAX_PROMPTS - totalPrompts;

  const handleAddPrompt = () => {
    if (!newPrompt.trim()) return;
    addMutation.mutate(newPrompt.trim());
  };

  const filteredPrompts = prompts?.filter((prompt: any) =>
    prompt.promptText.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              used={totalPrompts}
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
                {totalPrompts} / {MAX_PROMPTS}개
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
                  기존 질문을 삭제한 후 새 질문을 추가해주세요
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
                <p className="text-sm text-gray-500 mt-2">
                  💡 팁: 환자들이 실제로 검색할 만한 질문을 추가해보세요 (남은 슬롯: {remainingSlots}개)
                </p>
              </>
            )}
          </CardContent>
        </Card>

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
                  위에서 새 질문을 추가해보세요
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
