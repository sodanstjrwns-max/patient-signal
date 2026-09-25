'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, promptsApi, hospitalApi, queryTemplatesApi, schedulerApi } from '@/lib/api';
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
  ArrowRight,
  ExternalLink,
  Building2,
  Pencil,
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

interface CoreQuestion {
  query: string;
  category: string;
  intent: string;
  reason: string;
  source: 'hub' | 'signal' | 'profile';
  alreadyTracked?: boolean;
  promptId?: string;
}

const coreSourceLabels: Record<CoreQuestion['source'], string> = {
  hub: '허브 병원 정보',
  signal: 'Signal 병원 소개',
  profile: '기본 병원 정보',
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
  const [editingCoreQuery, setEditingCoreQuery] = useState<string | null>(null);
  const [coreDrafts, setCoreDrafts] = useState<Record<string, string>>({});
  const [replacingCoreQuery, setReplacingCoreQuery] = useState<string | null>(null);
  const [replacementPromptId, setReplacementPromptId] = useState('');
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');

  // 프롬프트 목록 조회
  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', hospitalId],
    queryFn: () => promptsApi.list(hospitalId!, false).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: coreData, isLoading: coreLoading } = useQuery({
    queryKey: ['core-questions', hospitalId],
    queryFn: () => queryTemplatesApi.coreQuestions(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
    staleTime: 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
      setNewPrompt('');
      setEditingCoreQuery(null);
      toast.success('질문을 모니터링 목록에 추가했습니다.');
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
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
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
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
    },
  });

  // 활성화/비활성화
  const toggleMutation = useMutation({
    mutationFn: (id: string) => promptsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
    },
    onError: (error: any) => toast.error(error.response?.data?.message || '질문 상태를 변경하지 못했습니다.'),
  });

  const replaceMutation = useMutation({
    mutationFn: ({ replacePromptId, promptText }: { replacePromptId: string; promptText: string }) =>
      promptsApi.replace(hospitalId!, { replacePromptId, promptText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
      setReplacingCoreQuery(null);
      setReplacementPromptId('');
      setEditingCoreQuery(null);
      toast.success('핵심 질문으로 교체했습니다. 이전 질문과 AI 답변은 기록에서 확인할 수 있습니다.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || '질문을 교체하지 못했습니다.'),
  });

  const editPromptMutation = useMutation({
    mutationFn: ({ id, promptText }: { id: string; promptText: string }) => promptsApi.update(id, { promptText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['core-questions', hospitalId] });
      setEditingPromptId(null);
      toast.success('질문이 수정되었습니다. 이전 AI 답변의 측정 당시 질문은 그대로 확인할 수 있습니다.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || '질문을 수정하지 못했습니다.'),
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
  const archivedPrompts = totalPrompts - activePrompts;
  const isAtLimit = activePrompts >= MAX_PROMPTS;
  const remainingSlots = MAX_PROMPTS - activePrompts;

  const handleAddPrompt = () => {
    if (!newPrompt.trim()) return;
    addMutation.mutate(newPrompt.trim());
  };

  const handleAddCoreQuestion = (question: CoreQuestion) => {
    const text = (coreDrafts[question.query] ?? question.query).trim();
    if (!text) { toast.warning('질문을 입력해주세요.'); return; }
    if (!prompts) { toast.warning('등록된 질문을 확인하는 중입니다.'); return; }
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');
    const existing = prompts.find((prompt: any) => prompt.isActive && normalize(prompt.promptText) === normalize(text));
    if (existing) {
      toast.info('이미 등록된 질문입니다. 연결된 답변을 확인해 주세요.');
      openTrackedQuestion(existing.id);
      return;
    }
    if (isAtLimit) {
      setReplacingCoreQuery(question.query);
      setReplacementPromptId('');
      return;
    }
    addMutation.mutate(text);
  };

  const handleReplaceCoreQuestion = (question: CoreQuestion) => {
    const text = (coreDrafts[question.query] ?? question.query).trim();
    if (!text) { toast.warning('질문을 입력해주세요.'); return; }
    if (!replacementPromptId) { toast.warning('교체할 기존 질문을 선택해 주세요.'); return; }
    replaceMutation.mutate({ replacePromptId: replacementPromptId, promptText: text });
  };

  const saveEditedPrompt = (id: string) => {
    const text = promptDraft.trim();
    if (!text) { toast.warning('질문을 입력해주세요.'); return; }
    editPromptMutation.mutate({ id, promptText: text });
  };

  const openTrackedQuestion = (promptId: string) => {
    setSearchTerm('');
    setExpandedPromptId(promptId);
    window.setTimeout(() => document.getElementById(`question-${promptId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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

      <div className="mx-auto max-w-[1320px] space-y-6 p-5 sm:p-8">
        <Card className="!border-[#cddcff] !bg-[#f9fbff]">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#e7eeff] text-[#285cf4]"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#285cf4]">먼저 확인할 질문</p>
                  <h2 className="text-xl font-bold tracking-[-0.03em] text-[#17212e]">우리 병원에 맞는 핵심 질문</h2>
                  <p className="mt-1 text-sm leading-6 text-[#65758a]">병원 소개와 주력 진료를 바탕으로 추천합니다. 문장을 직접 고쳐 추가하거나 기존 질문과 교체할 수 있습니다.</p>
                </div>
              </div>
              <Link href="/dashboard/settings" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-[9px] border border-[#d7e2fb] bg-white px-3 text-xs font-semibold text-[#2853c6] hover:bg-[#eff4ff]"><Building2 className="h-3.5 w-3.5" /> 병원 소개 수정 <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#e3eaf5] pt-4 text-xs text-[#63758a]">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${coreData?.hubConnected ? 'bg-[#e3f6ed] text-[#137b55]' : 'bg-[#ecf0f5] text-[#6a7b8e]'}`}>{coreData?.hubConnected ? '허브 정보 반영' : 'Signal 프로필 기준'}</span>
              {coreData?.profile?.name && <span className="font-semibold text-[#364a61]">{coreData.profile.name}</span>}
              {coreData?.profile?.region && <span>· {coreData.profile.region}</span>}
              {coreData?.profile?.treatments?.length > 0 && <span>· {coreData.profile.treatments.join(' · ')}</span>}
            </div>

            {coreLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-[#6d7d90]"><Loader2 className="h-4 w-4 animate-spin" /> 핵심 질문을 준비하고 있습니다</div>
            ) : !coreData?.coreQuestions?.length ? (
              <div className="mt-4 rounded-[12px] border border-dashed border-[#cbd8eb] bg-white p-5 text-sm text-[#607187]">추천할 질문이 아직 없습니다. 병원 소개와 주력 진료를 확인해 주세요.</div>
            ) : (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {(coreData.coreQuestions as CoreQuestion[]).map((question, index) => {
                  const editing = editingCoreQuery === question.query;
                  return (
                    <div key={`${question.query}-${index}`} className="flex flex-col rounded-[13px] border border-[#e1e8f1] bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><span className="text-[11px] font-bold tracking-[0.1em] text-[#285cf4]">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-[#edf2f8] px-2 py-0.5 text-[11px] font-semibold text-[#60738b]">{question.category}</span></div>
                        <span className="text-[11px] text-[#8c9bac]">{coreSourceLabels[question.source] || '병원 정보'}</span>
                      </div>
                      {editing ? (
                        <Input autoFocus aria-label="추천 질문 수정" value={coreDrafts[question.query] ?? question.query} onChange={(e) => setCoreDrafts((prev) => ({ ...prev, [question.query]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAddCoreQuestion(question)} />
                      ) : <p className="min-h-[48px] text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[#1d2b3d]">{coreDrafts[question.query] ?? question.query}</p>}
                      <p className="mt-2 flex-1 text-xs leading-5 text-[#748398]">{question.reason}</p>
                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#edf0f4] pt-3">
                        {question.alreadyTracked && question.promptId ? (
                          <button type="button" onClick={() => openTrackedQuestion(question.promptId!)} className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#eef5ff] px-3 text-xs font-semibold text-[#2853c6] hover:bg-[#e4eeff]">측정 중 · 답변 보기 <ArrowRight className="h-3.5 w-3.5" /></button>
                        ) : (
                          <>
                            {editing ? <button type="button" onClick={() => { setEditingCoreQuery(null); setCoreDrafts((prev) => { const next = { ...prev }; delete next[question.query]; return next; }); }} className="px-2 py-1 text-xs font-semibold text-[#748398] hover:text-[#304156]">취소</button> : <button type="button" onClick={() => setEditingCoreQuery(question.query)} className="px-2 py-1 text-xs font-semibold text-[#506883] hover:text-[#285cf4]">문장 수정</button>}
                            <Button size="sm" onClick={() => handleAddCoreQuestion(question)} disabled={addMutation.isPending || replaceMutation.isPending}><Plus className="h-3.5 w-3.5" /> {isAtLimit ? '기존 질문 교체' : '모니터링에 추가'}</Button>
                          </>
                        )}
                      </div>
                      {replacingCoreQuery === question.query && !question.alreadyTracked && (
                        <div className="mt-3 rounded-[10px] border border-[#cddcff] bg-[#f6f9ff] p-3">
                          <label htmlFor={`replace-prompt-${index}`} className="block text-xs font-semibold text-[#364d69]">모니터링을 중단할 기존 질문</label>
                          <select id={`replace-prompt-${index}`} value={replacementPromptId} onChange={(event) => setReplacementPromptId(event.target.value)} className="mt-2 h-10 w-full rounded-[8px] border border-[#cfd9e8] bg-white px-3 text-sm text-[#26384e]">
                            <option value="">질문을 선택해 주세요</option>
                            {prompts?.filter((prompt: any) => prompt.isActive).map((prompt: any) => <option key={prompt.id} value={prompt.id}>{prompt.promptText} · 답변 {prompt._count?.aiResponses || 0}개</option>)}
                          </select>
                          <p className="mt-2 text-xs leading-5 text-[#6c7e94]">선택한 질문의 측정은 중단됩니다. 이전 질문과 AI 답변은 기록에 남습니다.</p>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setReplacingCoreQuery(null); setReplacementPromptId(''); }}>취소</Button>
                            <Button size="sm" onClick={() => handleReplaceCoreQuestion(question)} disabled={!replacementPromptId || replaceMutation.isPending}>{replaceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} 질문 교체</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1"><Input
                    placeholder={specialtyPlaceholders[hospitalData?.specialtyType || 'DENTAL'] || specialtyPlaceholders.OTHER}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
                  /></div>
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
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="질문 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
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
                등록된 질문 ({activePrompts}개 측정 중{archivedPrompts > 0 ? ` · ${archivedPrompts}개 보관` : ''})
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
                  <div id={`question-${prompt.id}`} key={prompt.id} className={`rounded-[13px] border ${prompt.isActive ? 'border-[#e2e8f0] bg-white' : 'border-[#e8ecf1] bg-[#f7f9fb]'}`}>
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {editingPromptId === prompt.id ? (
                          <Input autoFocus aria-label="등록된 질문 수정" value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditedPrompt(prompt.id)} />
                        ) : <p className={`text-sm font-semibold leading-6 ${prompt.isActive ? 'text-[#223146]' : 'text-[#8998aa]'}`}>{prompt.promptText}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full bg-[#f0f3f7] px-2 py-0.5 font-semibold text-[#64768a]">{prompt.promptType === 'PRESET' ? '추천' : prompt.promptType === 'AUTO_GENERATED' ? 'AI 생성' : '직접 입력'}</span>
                          {!prompt.isActive && <span className="rounded-full bg-[#e9edf2] px-2 py-0.5 font-semibold text-[#68798e]">측정 중단 · 기록 보관</span>}
                          {prompt.specialtyCategory && <span className="text-[#7d8c9e]">{prompt.specialtyCategory}</span>}
                          <span className="text-[#7d8c9e]">실측 답변 {prompt._count?.aiResponses || 0}개</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {editingPromptId === prompt.id ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditingPromptId(null)}>취소</Button>
                            <Button size="sm" onClick={() => saveEditedPrompt(prompt.id)} disabled={editPromptMutation.isPending || !promptDraft.trim()}>{editPromptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} 저장</Button>
                          </>
                        ) : (
                          <>
                            <Button variant={expandedPromptId === prompt.id ? 'secondary' : 'outline'} size="sm" onClick={() => setExpandedPromptId((current) => current === prompt.id ? null : prompt.id)} aria-expanded={expandedPromptId === prompt.id}><MessageSquare className="h-3.5 w-3.5" /> 답변 보기 <ChevronDown className={`h-3.5 w-3.5 ${expandedPromptId === prompt.id ? 'rotate-180' : ''}`} /></Button>
                            {prompt.isActive && <Button variant="ghost" size="sm" onClick={() => { setEditingPromptId(prompt.id); setPromptDraft(prompt.promptText); }} title="질문 문장 수정" aria-label="질문 문장 수정"><Pencil className="h-4 w-4" /></Button>}
                            {prompt.isActive && !isAtLimit && <Button variant="ghost" size="sm" onClick={() => { if (!canUseFeature(planType, 'queryFanouts')) { setUpgradeFeature('queryFanouts'); setShowUpgradeModal(true); return; } generateMutation.mutate(prompt.id); }} disabled={generateMutation.isPending} title="AI로 연관 질문 생성" aria-label="AI로 연관 질문 생성"><Sparkles className="h-4 w-4" />{!canUseFeature(planType, 'queryFanouts') && <Lock className="h-3 w-3 text-slate-400" />}</Button>}
                            <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate(prompt.id)} disabled={!prompt.isActive && isAtLimit || toggleMutation.isPending} title={prompt.isActive ? '비활성화' : '활성화'} aria-label={prompt.isActive ? '비활성화' : '활성화'}>{prompt.isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}</Button>
                            {(prompt.isActive || !prompt._count?.aiResponses) && <Button variant="ghost" size="sm" onClick={() => { if (confirm('이 질문을 삭제하시겠습니까?')) deleteMutation.mutate(prompt.id); }} title="삭제" aria-label="질문 삭제"><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                          </>
                        )}
                      </div>
                    </div>
                    {expandedPromptId === prompt.id && <PromptAnswerPanel hospitalId={hospitalId} promptId={prompt.id} />}
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

interface PromptResponse {
  id: string;
  measuredQuestion: string | null;
  questionSnapshotAvailable: boolean;
  aiPlatform: string;
  responseText: string;
  responseDate: string | null;
  createdAt: string;
  isMentioned: boolean;
  mentionPosition: number | null;
  citedSources?: unknown[];
}

interface PromptResponsePage {
  prompt: { id: string; promptText: string; isActive: boolean };
  summary: { total: number; mentioned: number; mentionRate: number; byPlatform: { platform: string; total: number; mentioned: number }[] };
  data: PromptResponse[];
  total: number;
  hasMore: boolean;
}

function PromptAnswerPanel({ hospitalId, promptId }: { hospitalId: string; promptId: string }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PromptResponsePage>({
    queryKey: ['prompt-responses', hospitalId, promptId],
    queryFn: ({ pageParam }) => api.get(`/ai-crawler/prompt-responses/${hospitalId}/${promptId}`, { params: { limit: 20, offset: pageParam } }).then((res) => res.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.reduce((count, page) => count + page.data.length, 0) : undefined,
    staleTime: 60 * 1000,
  });
  const summary = data?.pages[0]?.summary;
  const responses = data?.pages.flatMap((page) => page.data) || [];

  return (
    <div className="border-t border-[#e7ecf2] bg-[#fafbfd] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#233349]">이 질문에 나온 실제 AI 답변</h4>
          <p className="mt-1 text-xs text-[#74849a]">측정 당시 질문과 답변 원문을 함께 보여줍니다. 질문을 수정해도 지난 측정 기록은 구분됩니다.</p>
        </div>
        <Link href="/dashboard/responses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#285cf4] hover:underline">전체 AI 답변 <ExternalLink className="h-3.5 w-3.5" /></Link>
      </div>
      {isLoading ? <div className="flex items-center gap-2 py-7 text-sm text-[#6b7b90]"><Loader2 className="h-4 w-4 animate-spin" /> 답변을 불러오고 있습니다</div> : isError ? (
        <div className="rounded-[10px] border border-[#f2d7d7] bg-[#fff7f7] p-4 text-sm text-[#b44d4d]">답변을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#eaf0ff] px-2.5 py-1 font-semibold text-[#2853c6]">측정 {summary?.total || 0}건</span>
            <span className="rounded-full bg-[#e5f6ec] px-2.5 py-1 font-semibold text-[#177454]">우리 병원 언급 {summary?.mentioned || 0}건</span>
            {(summary?.byPlatform || []).map((item) => <span key={item.platform} className="rounded-full border border-[#e4eaf0] bg-white px-2.5 py-1 text-[#67788d]">{item.platform} {item.mentioned}/{item.total}</span>)}
          </div>
          {responses.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#d9e2ec] bg-white p-6 text-center text-sm text-[#74849a]">이 질문으로 저장된 AI 답변이 아직 없습니다. 다음 측정 후 여기에 연결됩니다.</div>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => {
                const dateValue = response.responseDate || response.createdAt;
                const date = dateValue && !Number.isNaN(new Date(dateValue).getTime())
                  ? response.responseDate
                    ? new Date(dateValue).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric' })
                    : new Date(dateValue).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '측정 시각 미확인';
                return (
                  <div key={response.id} className="rounded-[12px] border border-[#e5ebf2] bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-bold text-[#314b69]">{response.aiPlatform}</span>
                      <span className="text-[#9ba8b7]">{date}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${response.isMentioned ? 'bg-[#e5f6ec] text-[#177454]' : 'bg-[#f0f2f5] text-[#78889a]'}`}>{response.isMentioned ? `우리 병원 언급${response.mentionPosition ? ` · ${response.mentionPosition}번째` : ''}` : '우리 병원 미언급'}</span>
                      {Array.isArray(response.citedSources) && response.citedSources.length > 0 && <span className="text-[#7c8ba0]">인용 출처 {response.citedSources.length}개</span>}
                    </div>
                    <p className="mt-3 rounded-[8px] bg-[#f5f7fa] px-3 py-2 text-xs leading-5 text-[#68798e]">측정 질문: {response.questionSnapshotAvailable && response.measuredQuestion ? response.measuredQuestion : '당시 질문 문구를 확인할 수 없습니다'}</p>
                    {response.responseText?.length > 240 ? (
                      <details className="group mt-3 text-sm leading-6 text-[#34465a]">
                        <summary className="cursor-pointer list-none font-medium marker:hidden">{response.responseText.slice(0, 220)}… <span className="whitespace-nowrap font-semibold text-[#285cf4] group-open:hidden">전체 답변 보기</span></summary>
                        <div className="mt-3 max-h-[420px] overflow-y-auto whitespace-pre-wrap border-t border-[#edf0f4] pt-3">{response.responseText}</div>
                      </details>
                    ) : <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#34465a]">{response.responseText || '답변 원문이 없습니다.'}</p>}
                  </div>
                );
              })}
              {hasNextPage && <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full">{isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 이전 답변 더 보기</Button>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
