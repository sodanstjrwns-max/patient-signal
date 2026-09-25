"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/motion/SignalMotion";
import {
  api,
  promptsApi,
  hospitalApi,
  queryTemplatesApi,
  schedulerApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import {
  Plus,
  Trash2,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  Search,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Grid3X3,
  RefreshCw,
  Layers,
  ArrowRight,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { toast } from "@/hooks/useToast";
import {
  UpgradeModal,
  getPlanLimits,
  canUseFeature,
} from "@/components/plan/PlanGate";
import { Lock } from "lucide-react";

const intentConfig: Record<string, { label: string }> = {
  RESERVATION: { label: "예약" },
  COMPARISON: { label: "비교" },
  INFORMATION: { label: "정보" },
  REVIEW: { label: "후기" },
  FEAR: { label: "불안해소" },
};

// 톤별 라벨
const toneLabels: Record<string, string> = {
  casual: "구어체",
  polite: "정중체",
  comparison: "비교형",
  emotional: "감성형",
  professional: "전문형",
  seasonal: "시즌",
  symptom: "증상",
  strength: "강점",
  competitor: "경쟁비교",
};

// 진료과별 placeholder 예시
const specialtyPlaceholders: Record<string, string> = {
  DENTAL: "예: 강남역 근처 임플란트 잘하는 치과 추천해줘",
  DERMATOLOGY: "예: 강남 보톡스 잘하는 피부과 추천해줘",
  ORTHOPEDICS: "예: 잠실 무릎관절 잘하는 정형외과 추천해줘",
  KOREAN_MEDICINE: "예: 홍대 추나요법 잘하는 한의원 추천해줘",
  OPHTHALMOLOGY: "예: 신촌 라식 잘하는 안과 추천해줘",
  INTERNAL_MEDICINE: "예: 건강검진 꼼꼼한 강남 내과 추천해줘",
  UROLOGY: "예: 강남 전립선 검사 잘하는 비뇨기과 추천해줘",
  PLASTIC_SURGERY: "예: 압구정 눈성형 자연스러운 성형외과 추천해줘",
  ENT: "예: 코골이 수술 잘하는 이비인후과 추천해줘",
  PSYCHIATRY: "예: 강남 우울증 상담 잘하는 정신건강의학과 추천해줘",
  OBSTETRICS: "예: 산전검사 꼼꼼한 산부인과 추천해줘",
  PEDIATRICS: "예: 영유아 예방접종 잘하는 소아과 추천해줘",
  OTHER: "예: 지역명 + 시술/증상 + 병원 추천해줘",
};

interface CoreQuestion {
  query: string;
  category: string;
  intent: string;
  reason: string;
  source: "hub" | "signal" | "profile";
  alreadyTracked?: boolean;
  promptId?: string;
}

const coreSourceLabels: Record<CoreQuestion["source"], string> = {
  hub: "허브 병원 정보",
  signal: "Signal 병원 소개",
  profile: "기본 병원 정보",
};

export default function PromptsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const requestedPromptId = useSearchParams().get("promptId");
  const openedDeepLink = useRef<string | null>(null);

  const { data: hospitalData } = useQuery({
    queryKey: ["hospital", hospitalId],
    queryFn: () => hospitalApi.get(hospitalId!).then((r) => r.data),
    enabled: !!hospitalId,
    staleTime: 60 * 1000,
  });

  const planType =
    hospitalData?.planType || (user as any)?.hospital?.planType || "FREE";
  const planLimits = getPlanLimits(planType);
  const MAX_PROMPTS =
    planLimits.maxPrompts === -1 ? 999 : planLimits.maxPrompts;
  const [newPrompt, setNewPrompt] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [showMatrix, setShowMatrix] = useState(false);
  const [selectedMatrixPrompts, setSelectedMatrixPrompts] = useState<
    Set<string>
  >(new Set());
  const [editingCoreQuery, setEditingCoreQuery] = useState<string | null>(null);
  const [coreDrafts, setCoreDrafts] = useState<Record<string, string>>({});
  const [replacingCoreQuery, setReplacingCoreQuery] = useState<string | null>(
    null,
  );
  const [replacementPromptId, setReplacementPromptId] = useState("");
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<
    "all" | "active" | "archived"
  >("all");

  // 프롬프트 목록 조회
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts", hospitalId],
    queryFn: () => promptsApi.list(hospitalId!, false).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: coreData, isLoading: coreLoading } = useQuery({
    queryKey: ["core-questions", hospitalId],
    queryFn: () =>
      queryTemplatesApi.coreQuestions(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
    staleTime: 60 * 1000,
  });

  // 질문 제안 조회
  const { data: suggestData, isLoading: isSuggestLoading } = useQuery({
    queryKey: ["suggestions", hospitalId],
    queryFn: () =>
      queryTemplatesApi.suggestQuestions(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showSuggestions,
  });

  // 매트릭스 미리보기
  const {
    data: matrixData,
    isLoading: isMatrixLoading,
    refetch: refetchMatrix,
  } = useQuery({
    queryKey: ["matrix-preview", hospitalId],
    queryFn: () =>
      schedulerApi.matrixPreview(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId && showMatrix,
  });

  // 프롬프트 추가
  const addMutation = useMutation({
    mutationFn: (promptText: string) =>
      promptsApi.create(hospitalId!, { promptText, promptType: "CUSTOM" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      setNewPrompt("");
      setEditingCoreQuery(null);
      setLibraryFilter("active");
      setSearchTerm("");
      toast.success("질문을 모니터링 목록에 추가했습니다.");
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === "PLAN_LIMIT_REACHED") {
        setUpgradeFeature("maxPrompts");
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || "질문 추가에 실패했습니다.");
      }
    },
  });

  // 제안/매트릭스 질문 일괄 추가
  const bulkAddMutation = useMutation({
    mutationFn: async (texts: string[]) => {
      let added = 0;
      for (const text of texts) {
        try {
          await promptsApi.create(hospitalId!, {
            promptText: text,
            promptType: "CUSTOM",
          });
          added++;
        } catch (err: any) {
          const errData = err.response?.data;
          if (errData?.error === "PLAN_LIMIT_REACHED") {
            toast.warning(`플랜 한도 도달! ${added}개만 추가되었습니다.`);
            break;
          }
        }
      }
      return added;
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["matrix-preview"] });
      setSelectedSuggestions(new Set());
      setSelectedMatrixPrompts(new Set());
      if (added > 0) {
        setLibraryFilter("active");
        setSearchTerm("");
        toast.success(`${added}개 질문이 추가되었습니다!`);
      }
    },
  });

  // 프롬프트 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => promptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
    },
  });

  // 활성화/비활성화
  const toggleMutation = useMutation({
    mutationFn: (id: string) => promptsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.message || "질문 상태를 변경하지 못했습니다.",
      ),
  });

  const replaceMutation = useMutation({
    mutationFn: ({
      replacePromptId,
      promptText,
    }: {
      replacePromptId: string;
      promptText: string;
    }) => promptsApi.replace(hospitalId!, { replacePromptId, promptText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", hospitalId] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      setReplacingCoreQuery(null);
      setReplacementPromptId("");
      setEditingCoreQuery(null);
      setLibraryFilter("active");
      setSearchTerm("");
      toast.success(
        "핵심 질문으로 교체했습니다. 이전 질문과 AI 답변은 기록에서 확인할 수 있습니다.",
      );
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.message || "질문을 교체하지 못했습니다.",
      ),
  });

  const editPromptMutation = useMutation({
    mutationFn: ({ id, promptText }: { id: string; promptText: string }) =>
      promptsApi.update(id, { promptText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", hospitalId] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      setEditingPromptId(null);
      toast.success(
        "질문이 수정되었습니다. 이전 AI 답변의 측정 당시 질문은 그대로 확인할 수 있습니다.",
      );
    },
    onError: (error: any) =>
      toast.error(
        error.response?.data?.message || "질문을 수정하지 못했습니다.",
      ),
  });

  // AI 연관 질문 생성
  const generateMutation = useMutation({
    mutationFn: (promptId: string) => promptsApi.generateFanouts(promptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      toast.success("AI가 연관 질문을 생성했습니다!");
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData?.error === "PLAN_UPGRADE_REQUIRED") {
        setUpgradeFeature("queryFanouts");
        setShowUpgradeModal(true);
      } else {
        toast.error(errData?.message || "질문 생성에 실패했습니다.");
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
    if (!text) {
      toast.warning("질문을 입력해주세요.");
      return;
    }
    if (!prompts) {
      toast.warning("등록된 질문을 확인하는 중입니다.");
      return;
    }
    const normalize = (value: string) =>
      value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
    const existing = prompts.find(
      (prompt: any) =>
        prompt.isActive && normalize(prompt.promptText) === normalize(text),
    );
    if (existing) {
      toast.info("이미 등록된 질문입니다. 연결된 답변을 확인해 주세요.");
      openTrackedQuestion(existing.id);
      return;
    }
    if (isAtLimit) {
      setReplacingCoreQuery(question.query);
      setReplacementPromptId("");
      return;
    }
    addMutation.mutate(text);
  };

  const handleReplaceCoreQuestion = (question: CoreQuestion) => {
    const text = (coreDrafts[question.query] ?? question.query).trim();
    if (!text) {
      toast.warning("질문을 입력해주세요.");
      return;
    }
    if (!replacementPromptId) {
      toast.warning("교체할 기존 질문을 선택해 주세요.");
      return;
    }
    replaceMutation.mutate({
      replacePromptId: replacementPromptId,
      promptText: text,
    });
  };

  const saveEditedPrompt = (id: string) => {
    const text = promptDraft.trim();
    if (!text) {
      toast.warning("질문을 입력해주세요.");
      return;
    }
    editPromptMutation.mutate({ id, promptText: text });
  };

  const openTrackedQuestion = useCallback((promptId: string) => {
    setSearchTerm("");
    setLibraryFilter("all");
    setExpandedPromptId(promptId);
    window.setTimeout(
      () =>
        document.getElementById(`question-${promptId}`)?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        }),
      100,
    );
  }, []);

  useEffect(() => {
    if (!hospitalId || !requestedPromptId || !prompts) return;
    const deepLinkKey = `${hospitalId}:${requestedPromptId}`;
    if (openedDeepLink.current === deepLinkKey) return;
    // Open only an ID returned by this hospital's own prompt list.
    if (
      !prompts.some((prompt: { id: string }) => prompt.id === requestedPromptId)
    )
      return;
    openedDeepLink.current = deepLinkKey;
    openTrackedQuestion(requestedPromptId);
  }, [hospitalId, requestedPromptId, prompts, openTrackedQuestion]);

  const filteredPrompts = prompts?.filter(
    (prompt: any) =>
      prompt.promptText.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (libraryFilter === "all" ||
        (libraryFilter === "active" ? prompt.isActive : !prompt.isActive)),
  );

  const toggleSuggestionSelect = (query: string) => {
    setSelectedSuggestions((prev) => {
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
    setSelectedMatrixPrompts((prev) => {
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
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const groupedSuggestions =
    suggestData?.suggestions?.reduce(
      (acc: Record<string, any[]>, s: any) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
      },
      {} as Record<string, any[]>,
    ) || {};

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
      const cats = new Set<string>(
        suggestData.suggestions.map((s: any) => s.category as string),
      );
      setExpandedCategories(cats);
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen bg-[#f1f1eb]">
        <Header
          title="질문 관리"
          description="병원에 맞는 질문으로 AI 답변을 살펴보세요"
        />
        <div className="mx-auto max-w-[1320px] p-5 sm:p-10">
          <div className="border-y border-[#d4d6cb] py-16">
            <span className="text-xs font-semibold tracking-[0.18em] text-[#72756a]">
              질문 관리
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#141512]">
              병원부터 알려주세요.
            </h2>
            <p className="mb-6 mt-3 text-sm text-[#72756a]">
              병원 소개와 주력 진료가 질문 설계의 출발점이 됩니다.
            </p>
            <Button onClick={() => (window.location.href = "/onboarding")}>
              병원 등록하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f1eb] text-[#141512]">
      <Header title="핵심 질문" description="질문과 측정 답변을 관리합니다" />
      <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-5 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#141512] pb-5">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
              핵심 질문
            </h1>
            <p className="mt-1.5 text-xs text-[#72756a]">
              추천 질문을 편집하고, 등록한 질문의 답변을 확인합니다.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <span>
              측정 중{" "}
              <strong className="ml-1 font-mono text-base">
                <AnimatedNumber value={activePrompts} />
              </strong>
              <span className="ml-1 text-[#72756a]">
                / {planLimits.maxPrompts === -1 ? "무제한" : MAX_PROMPTS}
              </span>
            </span>
            <span className="text-[#72756a]">
              보관{" "}
              <strong className="ml-1 font-mono text-[#141512]">
                <AnimatedNumber value={archivedPrompts} />
              </strong>
            </span>
          </div>
        </div>
        <div className="desk-panel mb-5 flex flex-col justify-between gap-3 border border-[#d4d6cb] bg-white px-4 py-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-semibold">
                {coreData?.profile?.name || hospitalData?.name || "우리 병원"}
              </p>
              <span className="border-l border-[#d4d6cb] pl-3 text-[10px] text-[#72756a]">
                {coreData?.hubConnected
                  ? "허브 정보 연결됨"
                  : "Signal 프로필 기준"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#72756a]">
              {[
                coreData?.profile?.region,
                ...(coreData?.profile?.treatments || []),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {hospitalData?.clinicIntroduction && (
              <p className="mt-1 line-clamp-2 max-w-4xl text-xs leading-5 text-[#525849]">
                {hospitalData.clinicIntroduction}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/settings"
            className="desk-action inline-flex shrink-0 items-center gap-2 self-start border-b border-[#141512] pb-1 text-[11px] font-medium"
          >
            소개 수정 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <section
            aria-labelledby="core-questions-title"
            className="desk-panel order-2 min-w-0 border border-[#d4d6cb] bg-white xl:order-1"
          >
            <div className="flex items-center justify-between border-b border-[#141512] bg-[#141512] px-4 py-3 text-white">
              <h2 id="core-questions-title" className="text-sm font-semibold">
                추천 인박스
              </h2>
              <span className="font-mono text-[11px] text-[#d0ff43]">
                {coreData?.coreQuestions?.length || 0}
              </span>
            </div>
            <div className="min-w-0">
              <div className="border-b border-[#d4d6cb] px-4 py-3">
                <p className="text-[11px] font-medium text-[#141512]">
                  병원 소개·주력 진료 기준
                </p>
                <span className="text-[10px] text-[#72756a]">
                  문장을 수정해 추가하거나 기존 질문과 교체하세요
                </span>
              </div>
              {coreLoading ? (
                <div className="flex items-center gap-2 p-10 text-sm text-[#72756a]">
                  <Loader2 className="h-4 w-4 animate-spin" /> 병원 정보를 읽고
                  있습니다
                </div>
              ) : !coreData?.coreQuestions?.length ? (
                <div className="px-7 py-12 text-sm leading-6 text-[#72756a]">
                  병원 소개와 주력 진료를 입력하면
                  <br />
                  이곳에 맞춤 질문을 추천합니다.
                </div>
              ) : (
                <div className="divide-y divide-[#d4d6cb]">
                  {(coreData.coreQuestions as CoreQuestion[]).map(
                    (question, index) => {
                      const editing = editingCoreQuery === question.query;
                      return (
                        <div
                          key={`${question.query}-${index}`}
                          className={`group relative px-4 py-4 transition-colors duration-200 ${editing || replacingCoreQuery === question.query ? "bg-[#d0ff43]/20 shadow-[inset_3px_0_0_#ff5d2a]" : "hover:bg-[#f1f1eb]/70"}`}
                        >
                          <div className="flex gap-3">
                            <span className="pt-0.5 font-mono text-xs tabular-nums text-[#72756a]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                                <span className="font-semibold text-[#141512]">
                                  {question.category}
                                </span>
                                <span className="text-[#72756a]">
                                  {coreSourceLabels[question.source] ||
                                    "병원 정보"}
                                </span>
                              </div>
                              {editing ? (
                                <Input
                                  autoFocus
                                  className="signal-panel-enter !border-[#141512] !ring-2 !ring-[#d0ff43]"
                                  aria-label="추천 질문 수정"
                                  value={
                                    coreDrafts[question.query] ?? question.query
                                  }
                                  onChange={(event) =>
                                    setCoreDrafts((previous) => ({
                                      ...previous,
                                      [question.query]: event.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) =>
                                    event.key === "Enter" &&
                                    handleAddCoreQuestion(question)
                                  }
                                />
                              ) : (
                                <p className="text-[13px] font-medium leading-6 tracking-[-0.01em]">
                                  {coreDrafts[question.query] ?? question.query}
                                </p>
                              )}
                              <p className="mt-1.5 text-xs leading-5 text-[#72756a]">
                                {question.reason}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                {question.alreadyTracked &&
                                question.promptId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openTrackedQuestion(question.promptId!)
                                    }
                                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#141512] hover:underline"
                                  >
                                    <Check className="h-3.5 w-3.5" /> 모니터링
                                    중 · 답변 읽기{" "}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={
                                        addMutation.isPending ||
                                        replaceMutation.isPending
                                      }
                                      onClick={() =>
                                        handleAddCoreQuestion(question)
                                      }
                                      className="signal-interactive inline-flex min-h-9 items-center gap-1.5 rounded-none bg-[#ff5d2a] px-3 text-xs font-semibold text-[#141512] transition-colors hover:bg-[#ff825c] disabled:opacity-40"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      {isAtLimit
                                        ? "기존 질문과 교체"
                                        : "모니터링에 추가"}
                                    </button>
                                    {editing ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCoreQuery(null);
                                          setCoreDrafts((previous) => {
                                            const next = { ...previous };
                                            delete next[question.query];
                                            return next;
                                          });
                                        }}
                                        className="min-h-8 text-xs text-[#72756a] hover:text-[#141512]"
                                      >
                                        수정 취소
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingCoreQuery(question.query)
                                        }
                                        className="inline-flex min-h-8 items-center gap-1.5 text-xs text-[#72756a] hover:text-[#141512]"
                                      >
                                        <Pencil className="h-3 w-3" />
                                        문장 수정
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              {replacingCoreQuery === question.query &&
                                !question.alreadyTracked && (
                                  <div className="signal-panel-enter mt-4 rounded-none border border-[#141512] bg-white p-4">
                                    <label
                                      htmlFor={`replace-prompt-${index}`}
                                      className="block text-xs font-semibold"
                                    >
                                      측정을 중단할 기존 질문 선택
                                    </label>
                                    <select
                                      id={`replace-prompt-${index}`}
                                      value={replacementPromptId}
                                      onChange={(event) =>
                                        setReplacementPromptId(
                                          event.target.value,
                                        )
                                      }
                                      className="mt-2 h-10 w-full min-w-0 rounded-none border border-[#d4d6cb] bg-white px-3 text-xs"
                                    >
                                      <option value="">
                                        기존 질문을 선택해 주세요
                                      </option>
                                      {prompts
                                        ?.filter(
                                          (prompt: any) => prompt.isActive,
                                        )
                                        .map((prompt: any) => (
                                          <option
                                            key={prompt.id}
                                            value={prompt.id}
                                          >
                                            {prompt.promptText} · 답변{" "}
                                            {prompt._count?.aiResponses || 0}개
                                          </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-[11px] leading-5 text-[#72756a]">
                                      교체 전 질문과 AI 답변은 기록으로
                                      보관됩니다.
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleReplaceCoreQuestion(question)
                                        }
                                        disabled={
                                          !replacementPromptId ||
                                          replaceMutation.isPending
                                        }
                                      >
                                        {replaceMutation.isPending ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" />
                                        )}{" "}
                                        질문 교체
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setReplacingCoreQuery(null);
                                          setReplacementPromptId("");
                                        }}
                                      >
                                        취소
                                      </Button>
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </section>

          <section
            aria-labelledby="question-library-title"
            className="order-1 min-w-0 xl:order-2"
          >
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2
                  id="question-library-title"
                  className="text-lg font-semibold tracking-[-0.025em]"
                >
                  모니터링 질문{" "}
                  <span className="ml-1 text-[#72756a]">{totalPrompts}</span>
                </h2>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-0 top-3 h-4 w-4 text-[#72756a]" />
                <input
                  aria-label="등록된 질문 검색"
                  placeholder="질문 검색"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full border-b border-[#b8bcab] bg-transparent pl-7 pr-3 text-sm outline-none placeholder:text-[#72756a] focus:border-[#141512] focus:ring-2 focus:ring-[#d0ff43]"
                />
              </div>
            </div>

            <div className="border-x border-t border-[#d4d6cb] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="new-monitoring-question"
                  className="text-xs font-semibold"
                >
                  새 질문 작성
                </label>
                <span className="text-[11px] text-[#72756a]">
                  {isAtLimit
                    ? "모니터링 한도에 도달했어요"
                    : planLimits.maxPrompts === -1
                      ? "질문을 자유롭게 추가하세요"
                      : `${remainingSlots}개 더 추가할 수 있어요`}
                </span>
              </div>
              {isAtLimit ? (
                <div className="flex items-start gap-3 border-l-2 border-[#d0ff43] bg-[#f1f1eb] px-4 py-3 text-xs leading-6 text-[#525849]">
                  <Layers className="mt-1 h-4 w-4 shrink-0" />
                  <p>
                    현재 {MAX_PROMPTS}개 질문을 모니터링 중입니다. 추천 질문으로
                    교체하거나 기존 질문의 측정을 중단하면 새 질문을 추가할 수
                    있습니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="new-monitoring-question"
                    className="min-w-0 flex-1"
                    placeholder={
                      specialtyPlaceholders[
                        hospitalData?.specialtyType || "DENTAL"
                      ] || specialtyPlaceholders.OTHER
                    }
                    value={newPrompt}
                    onChange={(event) => setNewPrompt(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && handleAddPrompt()
                    }
                  />
                  <Button
                    onClick={handleAddPrompt}
                    disabled={addMutation.isPending || !newPrompt.trim()}
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}{" "}
                    질문 추가
                  </Button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <span className="text-[#72756a]">다른 질문을 찾아볼까요?</span>
                <button
                  onClick={handleOpenSuggestions}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#141512] hover:underline"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> AI 질문 제안
                </button>
                <button
                  onClick={() => {
                    setShowMatrix(true);
                    setShowSuggestions(false);
                    setSelectedMatrixPrompts(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#141512] hover:underline"
                >
                  <Grid3X3 className="h-3.5 w-3.5" /> 다양한 질문 조합
                </button>
              </div>
            </div>

            {showMatrix && (
              <div className="signal-panel-enter border-x border-t border-[#d4d6cb] bg-[#e9ebe1] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-[#141512]">
                      질문 조합
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">
                      다양한 질문 조합
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#72756a]">
                      의도 · 시술 · 말투 · 시즌 · 지역을 조합한 질문입니다.
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refetchMatrix()}
                      disabled={isMatrixLoading}
                      aria-label="질문 조합 새로고침"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isMatrixLoading ? "animate-spin" : ""}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowMatrix(false);
                        setSelectedMatrixPrompts(new Set());
                      }}
                      aria-label="질문 조합 닫기"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isMatrixLoading ? (
                  <div className="flex items-center gap-2 py-10 text-sm text-[#72756a]">
                    <Loader2 className="h-4 w-4 animate-spin" /> 질문 후보를
                    준비하고 있습니다
                  </div>
                ) : matrixData ? (
                  <>
                    <div className="my-5 flex flex-wrap gap-x-6 gap-y-3 border-y border-[#d7dacd] py-4 text-xs">
                      <span className="text-[#72756a]">
                        전체 후보{" "}
                        <b className="ml-1 text-[#141512]">
                          {matrixData.matrix?.totalCandidates || 0}
                        </b>
                      </span>
                      {Object.entries(matrixData.matrix?.byIntent || {}).map(
                        ([intent, count]) => (
                          <span key={intent} className="text-[#72756a]">
                            {intentConfig[intent]?.label || intent}{" "}
                            <b className="ml-1 text-[#141512]">
                              {count as number}
                            </b>
                          </span>
                        ),
                      )}
                    </div>
                    {matrixData.matrix?.byProcedure && (
                      <div className="mb-5 flex flex-wrap gap-2">
                        {Object.entries(matrixData.matrix.byProcedure).map(
                          ([procedure, count]) => (
                            <span
                              key={procedure}
                              className="border border-[#d7dacd] px-2 py-1 text-[10px] text-[#525849]"
                            >
                              {procedure} · {count as number}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    <div className="max-h-[460px] divide-y divide-[#d4d6cb] overflow-y-auto border border-[#d4d6cb] bg-white">
                      {matrixData.todaySelection?.map(
                        (item: any, index: number) => {
                          const selected = selectedMatrixPrompts.has(item.text);
                          return (
                            <button
                              key={index}
                              onClick={() => toggleMatrixSelect(item.text)}
                              className={`flex w-full items-start gap-3 p-4 text-left transition-colors ${selected ? "bg-[#d0ff43]/25" : "hover:bg-[#f1f1eb]"}`}
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${selected ? "border-[#d0ff43] bg-[#d0ff43]" : "border-[#b8bcab]"}`}
                              >
                                {selected && (
                                  <Check className="h-3 w-3 text-[#141512]" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="text-sm leading-6">
                                  {item.text}
                                </span>
                                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#72756a]">
                                  <span>
                                    {intentConfig[item.intent]?.label ||
                                      item.intent}
                                  </span>
                                  <span>
                                    {toneLabels[item.tone] || item.tone}
                                  </span>
                                  {item.season && <span>{item.season}</span>}
                                  {item.procedure && (
                                    <span>{item.procedure}</span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#72756a]">
                        {matrixData.todayCount}개 추천 ·{" "}
                        {selectedMatrixPrompts.size}개 선택
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (selectedMatrixPrompts.size > 0)
                              setSelectedMatrixPrompts(new Set());
                            else
                              setSelectedMatrixPrompts(
                                new Set(
                                  (matrixData.todaySelection || [])
                                    .slice(0, Math.max(0, remainingSlots))
                                    .map((item: any) => item.text),
                                ),
                              );
                          }}
                        >
                          {selectedMatrixPrompts.size > 0
                            ? "선택 해제"
                            : "전체 선택"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleMatrixBulkAdd}
                          disabled={
                            selectedMatrixPrompts.size === 0 ||
                            bulkAddMutation.isPending
                          }
                        >
                          {bulkAddMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {selectedMatrixPrompts.size}개 추가
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="py-8 text-sm text-[#72756a]">
                    질문 조합을 불러올 수 없습니다.
                  </p>
                )}
              </div>
            )}

            {showSuggestions && (
              <div className="signal-panel-enter border-x border-t border-[#d4d6cb] bg-[#e9ebe1] p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-[#141512]">
                      추가 추천
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">
                      다음으로 물어볼 질문
                    </h3>
                    {suggestData?.hospital && (
                      <p className="mt-2 text-xs leading-5 text-[#72756a]">
                        {suggestData.hospital.name} ·{" "}
                        {suggestData.hospital.specialty} ·{" "}
                        {suggestData.hospital.region}
                      </p>
                    )}
                    {suggestData?.hospital?.procedures && (
                      <p className="mt-2 text-xs text-[#525849]">
                        {suggestData.hospital.procedures.join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowSuggestions(false);
                      setSelectedSuggestions(new Set());
                    }}
                    aria-label="AI 질문 제안 닫기"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isSuggestLoading ? (
                  <div className="flex items-center gap-2 py-10 text-sm text-[#72756a]">
                    <Loader2 className="h-4 w-4 animate-spin" /> 병원 정보를
                    바탕으로 질문을 만들고 있습니다
                  </div>
                ) : Object.keys(groupedSuggestions).length === 0 ? (
                  <p className="py-8 text-sm leading-6 text-[#72756a]">
                    추가로 추천할 질문이 없습니다. 직접 질문을 작성하거나 병원
                    소개를 보완해보세요.
                  </p>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto border border-[#d4d6cb] bg-white">
                    {(
                      Object.entries(groupedSuggestions) as [string, any[]][]
                    ).map(([category, items]) => {
                      const expanded = expandedCategories.has(category);
                      const selectedCount = items.filter((item) =>
                        selectedSuggestions.has(item.query),
                      ).length;
                      return (
                        <div
                          key={category}
                          className="border-b border-[#d4d6cb] last:border-b-0"
                        >
                          <button
                            onClick={() => toggleCategory(category)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                          >
                            <span className="text-sm font-semibold">
                              {category}
                              <span className="ml-2 text-xs font-normal text-[#72756a]">
                                {items.length}개
                                {selectedCount > 0
                                  ? ` · ${selectedCount}개 선택`
                                  : ""}
                              </span>
                            </span>
                            {expanded ? (
                              <ChevronUp className="h-4 w-4 text-[#72756a]" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-[#72756a]" />
                            )}
                          </button>
                          {expanded && (
                            <div className="border-t border-[#d4d6cb]">
                              {items.map((item: any) => {
                                const selected = selectedSuggestions.has(
                                  item.query,
                                );
                                return (
                                  <button
                                    key={item.query}
                                    onClick={() =>
                                      toggleSuggestionSelect(item.query)
                                    }
                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left ${selected ? "bg-[#d0ff43]/25" : "hover:bg-[#f1f1eb]"}`}
                                  >
                                    <span
                                      className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center border ${selected ? "border-[#d0ff43] bg-[#d0ff43]" : "border-[#b8bcab]"}`}
                                    >
                                      {selected && (
                                        <Check className="h-3 w-3 text-[#141512]" />
                                      )}
                                    </span>
                                    <span className="text-sm leading-6">
                                      {item.query}
                                    </span>
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
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#72756a]">
                      {suggestData.total}개 제안 · {selectedSuggestions.size}개
                      선택
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedSuggestions.size > 0)
                            setSelectedSuggestions(new Set());
                          else
                            setSelectedSuggestions(
                              new Set(
                                suggestData.suggestions
                                  .slice(0, Math.max(0, remainingSlots))
                                  .map((item: any) => item.query),
                              ),
                            );
                        }}
                      >
                        {selectedSuggestions.size > 0
                          ? "선택 해제"
                          : "전체 선택"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleBulkAdd}
                        disabled={
                          selectedSuggestions.size === 0 ||
                          bulkAddMutation.isPending
                        }
                      >
                        {bulkAddMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {selectedSuggestions.size}개 추가
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              className="flex flex-wrap gap-1 border-x border-t border-[#d4d6cb] bg-[#141512] p-2"
              aria-label="질문 상태 필터"
            >
              {(
                [
                  ["all", "전체", totalPrompts],
                  ["active", "측정 중", activePrompts],
                  ["archived", "보관", archivedPrompts],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={libraryFilter === value}
                  onClick={() => setLibraryFilter(value)}
                  className={`desk-tab inline-flex min-h-9 items-center gap-2 rounded-none px-4 text-xs font-semibold ${libraryFilter === value ? "desk-tab-active bg-[#d0ff43] text-[#141512]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                >
                  {label}
                  <span className="font-mono text-[10px] opacity-70">
                    {count}
                  </span>
                </button>
              ))}
            </div>
            <div className="border border-[#d4d6cb] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d4d6cb] bg-[#f1f1eb] px-5 py-3 sm:px-6">
                <p className="text-[10px] font-bold tracking-[0.1em] text-[#525849]">
                  질문 / 측정 기록
                </p>
                <p className="text-[11px] text-[#72756a]">
                  {activePrompts}개 측정 중
                  {archivedPrompts > 0
                    ? ` · ${archivedPrompts}개 기록 보관`
                    : ""}
                </p>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#141512]" />
                </div>
              ) : filteredPrompts?.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <MessageSquare className="mx-auto mb-4 h-7 w-7 text-[#b8bcab]" />
                  <p className="text-sm font-medium">
                    {searchTerm
                      ? "일치하는 질문이 없습니다"
                      : libraryFilter === "archived"
                        ? "보관된 질문이 없습니다"
                        : libraryFilter === "active"
                          ? "측정 중인 질문이 없습니다"
                          : "첫 질문을 추가해보세요"}
                  </p>
                  <p className="mt-2 text-xs text-[#72756a]">
                    {searchTerm
                      ? "다른 단어로 검색해보세요."
                      : "위에서 추천 질문을 선택하거나 직접 작성할 수 있습니다."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#d4d6cb]">
                  {filteredPrompts?.map((prompt: any, index: number) => (
                    <div
                      id={`question-${prompt.id}`}
                      key={prompt.id}
                      className={`relative scroll-mt-24 transition-colors duration-200 ${expandedPromptId === prompt.id ? "bg-[#d0ff43]/[0.04] shadow-[inset_3px_0_0_#d0ff43]" : prompt.isActive ? "hover:bg-[#fafaf6]" : "bg-[#f1f1eb]/60"}`}
                    >
                      <div className="px-5 py-5 sm:px-6">
                        <div className="flex gap-4">
                          <span className="pt-1 font-mono text-xs tabular-nums text-[#72756a]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                              <span
                                className={`inline-flex items-center gap-1.5 font-medium ${prompt.isActive ? "text-[#141512]" : "text-[#72756a]"}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${prompt.isActive ? "bg-[#d0ff43]" : "bg-[#989b8d]"}`}
                                />
                                {prompt.isActive ? "측정 중" : "기록 보관"}
                              </span>
                              <span className="text-[#72756a]">
                                {prompt.promptType === "PRESET"
                                  ? "추천 질문"
                                  : prompt.promptType === "AUTO_GENERATED"
                                    ? "AI 생성"
                                    : "직접 입력"}
                              </span>
                              {prompt.specialtyCategory && (
                                <span className="text-[#72756a]">
                                  {prompt.specialtyCategory}
                                </span>
                              )}
                            </div>
                            {editingPromptId === prompt.id ? (
                              <Input
                                autoFocus
                                className="signal-panel-enter !border-[#141512] focus:!ring-2 focus:!ring-[#d0ff43]"
                                aria-label="등록된 질문 수정"
                                value={promptDraft}
                                onChange={(event) =>
                                  setPromptDraft(event.target.value)
                                }
                                onKeyDown={(event) =>
                                  event.key === "Enter" &&
                                  saveEditedPrompt(prompt.id)
                                }
                              />
                            ) : (
                              <p
                                className={`text-[15px] font-medium leading-6 tracking-[-0.02em] sm:text-base ${prompt.isActive ? "text-[#141512]" : "text-[#72756a]"}`}
                              >
                                {prompt.promptText}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              {editingPromptId === prompt.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveEditedPrompt(prompt.id)}
                                    disabled={
                                      editPromptMutation.isPending ||
                                      !promptDraft.trim()
                                    }
                                  >
                                    {editPromptMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}{" "}
                                    저장
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingPromptId(null)}
                                  >
                                    취소
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      setExpandedPromptId((current) =>
                                        current === prompt.id
                                          ? null
                                          : prompt.id,
                                      )
                                    }
                                    aria-expanded={
                                      expandedPromptId === prompt.id
                                    }
                                    className={`signal-interactive inline-flex min-h-9 items-center gap-2 rounded-none px-3 text-xs font-semibold transition-colors ${expandedPromptId === prompt.id ? "bg-[#d0ff43] text-[#141512]" : "bg-[#d0ff43]/[0.06] text-[#141512] hover:bg-[#d0ff43]/10"}`}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />{" "}
                                    실측 답변{" "}
                                    <span className="font-mono">
                                      {prompt._count?.aiResponses || 0}
                                    </span>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 transition-transform ${expandedPromptId === prompt.id ? "rotate-180" : ""}`}
                                    />
                                  </button>
                                  <div className="-mr-2 flex flex-wrap items-center">
                                    {prompt.isActive && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingPromptId(prompt.id);
                                          setPromptDraft(prompt.promptText);
                                        }}
                                        title="질문 문장 수정"
                                        aria-label="질문 문장 수정"
                                        className="px-2"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {prompt.isActive && !isAtLimit && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="px-2"
                                        onClick={() => {
                                          if (
                                            !canUseFeature(
                                              planType,
                                              "queryFanouts",
                                            )
                                          ) {
                                            setUpgradeFeature("queryFanouts");
                                            setShowUpgradeModal(true);
                                            return;
                                          }
                                          generateMutation.mutate(prompt.id);
                                        }}
                                        disabled={generateMutation.isPending}
                                        title="AI로 연관 질문 생성"
                                        aria-label="AI로 연관 질문 생성"
                                      >
                                        <ArrowRight className="h-3.5 w-3.5" />
                                        {!canUseFeature(
                                          planType,
                                          "queryFanouts",
                                        ) && <Lock className="h-3 w-3" />}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="px-2"
                                      onClick={() =>
                                        toggleMutation.mutate(prompt.id)
                                      }
                                      disabled={
                                        (!prompt.isActive && isAtLimit) ||
                                        toggleMutation.isPending
                                      }
                                      title={
                                        prompt.isActive
                                          ? "측정 중단"
                                          : "측정 시작"
                                      }
                                      aria-label={
                                        prompt.isActive
                                          ? "측정 중단"
                                          : "측정 시작"
                                      }
                                    >
                                      {prompt.isActive ? (
                                        <ToggleRight className="h-5 w-5 text-[#141512]" />
                                      ) : (
                                        <ToggleLeft className="h-5 w-5" />
                                      )}
                                    </Button>
                                    {(prompt.isActive ||
                                      !prompt._count?.aiResponses) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="px-2 hover:text-[#A34F3F]"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              "이 질문을 삭제하시겠습니까?",
                                            )
                                          )
                                            deleteMutation.mutate(prompt.id);
                                        }}
                                        title="질문 삭제"
                                        aria-label="질문 삭제"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {expandedPromptId === prompt.id && (
                        <PromptAnswerPanel
                          hospitalId={hospitalId}
                          promptId={prompt.id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#72756a]">
              질문을 수정해도 지난 AI 답변에는 측정 당시 질문이 함께 남습니다.
            </p>
          </section>
        </div>
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
  summary: {
    total: number;
    mentioned: number;
    mentionRate: number;
    byPlatform: { platform: string; total: number; mentioned: number }[];
  };
  data: PromptResponse[];
  total: number;
  hasMore: boolean;
}

function PromptAnswerPanel({
  hospitalId,
  promptId,
}: {
  hospitalId: string;
  promptId: string;
}) {
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(
    null,
  );
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PromptResponsePage>({
    queryKey: ["prompt-responses", hospitalId, promptId],
    queryFn: ({ pageParam }) =>
      api
        .get(`/ai-crawler/prompt-responses/${hospitalId}/${promptId}`, {
          params: { limit: 20, offset: pageParam },
        })
        .then((res) => res.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((count, page) => count + page.data.length, 0)
        : undefined,
    staleTime: 60 * 1000,
  });
  const summary = data?.pages[0]?.summary;
  const responses = data?.pages.flatMap((page) => page.data) || [];
  const selectedResponse =
    responses.find((response) => response.id === selectedResponseId) ||
    responses[0];
  const selectedIndex = responses.findIndex(
    (response) => response.id === selectedResponse?.id,
  );
  const selectResponseAt = (index: number, moveFocus = false) => {
    const response = responses[index];
    if (!response) return;
    setSelectedResponseId(response.id);
    if (moveFocus)
      document
        .getElementById(`answer-choice-${promptId}-${response.id}`)
        ?.focus();
  };
  const platformLabels: Record<string, string> = {
    CHATGPT: "ChatGPT",
    CLAUDE: "Claude",
    PERPLEXITY: "Perplexity",
    GEMINI: "Gemini",
    CLOVA: "CLOVA X",
    CLOVA_X: "CLOVA X",
  };
  const formatDate = (response: PromptResponse) => {
    const dateValue = response.responseDate || response.createdAt;
    if (!dateValue || Number.isNaN(new Date(dateValue).getTime()))
      return "측정 시각 미확인";
    return new Date(dateValue).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="signal-panel-enter border-t border-[#141512] bg-[#f1f1eb] p-3 sm:p-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold tracking-tight">측정 답변</h4>
          <p className="mt-1 text-xs leading-5 text-[#72756a]">
            답변을 선택하면 측정 질문과 원문을 함께 읽을 수 있습니다.
          </p>
        </div>
        <Link
          href="/dashboard/responses"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#141512] hover:underline"
        >
          전체 AI 답변 <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[#72756a]">
          <Loader2 className="h-4 w-4 animate-spin" /> 답변을 불러오고 있습니다
        </div>
      ) : isError ? (
        <div className="border-l-2 border-[#A34F3F] bg-white p-5 text-sm text-[#A34F3F]">
          답변을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
            <span className="text-[#525849]">
              실측 답변{" "}
              <b className="ml-1 text-[#141512]">{summary?.total || 0}건</b>
            </span>
            <span className="text-[#525849]">
              우리 병원 언급{" "}
              <b className="ml-1 text-[#141512]">{summary?.mentioned || 0}건</b>
            </span>
            {(summary?.byPlatform || []).map((item) => (
              <span key={item.platform} className="text-[#72756a]">
                {platformLabels[item.platform] || item.platform}{" "}
                <span className="font-mono">
                  {item.mentioned}/{item.total}
                </span>
              </span>
            ))}
          </div>
          {responses.length === 0 ? (
            <div className="border border-dashed border-[#b8bcab] px-5 py-10 text-center text-sm leading-6 text-[#72756a]">
              아직 저장된 답변이 없습니다.
              <br />
              다음 측정이 끝나면 이 질문의 AI 답변이 연결됩니다.
            </div>
          ) : (
            <div className="grid min-w-0 overflow-hidden border border-[#d4d6cb] bg-white xl:grid-cols-[155px_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-[#d4d6cb] bg-[#fafaf6] xl:border-b-0 xl:border-r">
                <div className="border-b border-[#d4d6cb] px-4 py-3 text-[10px] font-semibold text-[#72756a]">
                  측정 기록 · 최신순
                </div>
                <div
                  className="flex max-h-[520px] gap-0 overflow-x-auto xl:block xl:overflow-x-hidden xl:overflow-y-auto"
                  aria-label="AI 답변 선택"
                  role="tablist"
                  onKeyDown={(event) => {
                    let target = selectedIndex;
                    if (event.key === "ArrowRight" || event.key === "ArrowDown")
                      target = Math.min(
                        responses.length - 1,
                        selectedIndex + 1,
                      );
                    else if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowUp"
                    )
                      target = Math.max(0, selectedIndex - 1);
                    else if (event.key === "Home") target = 0;
                    else if (event.key === "End") target = responses.length - 1;
                    else return;
                    event.preventDefault();
                    selectResponseAt(target, true);
                  }}
                >
                  {responses.map((response) => {
                    const selected = response.id === selectedResponse?.id;
                    return (
                      <button
                        key={response.id}
                        type="button"
                        id={`answer-choice-${promptId}-${response.id}`}
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`answer-content-${promptId}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setSelectedResponseId(response.id)}
                        className={`relative min-w-[165px] shrink-0 border-b border-r border-[#d4d6cb] px-3 py-3 text-left transition-colors duration-200 xl:w-full xl:min-w-0 xl:border-r-0 ${selected ? "bg-[#d0ff43] text-[#141512] shadow-[inset_3px_0_0_#ff5d2a]" : "hover:bg-[#e9ebe1]"}`}
                      >
                        <span className="flex items-center justify-between gap-4 text-xs font-semibold">
                          {platformLabels[response.aiPlatform] ||
                            response.aiPlatform}
                          {selected && (
                            <ArrowRight className="h-3.5 w-3.5 text-[#ff5d2a]" />
                          )}
                        </span>
                        <span
                          className={`mt-2 block text-[10px] ${selected ? "text-[#525849]" : "text-[#72756a]"}`}
                        >
                          {formatDate(response)}
                        </span>
                        <span
                          className={`mt-2 inline-flex items-center gap-1.5 text-[10px] ${selected ? "text-[#141512]" : response.isMentioned ? "text-[#141512]" : "text-[#72756a]"}`}
                        >
                          <span
                            className={`h-1 w-1 rounded-full ${selected ? "bg-[#ff5d2a]" : response.isMentioned ? "bg-[#d0ff43]" : "bg-[#989b8d]"}`}
                          />
                          {response.isMentioned
                            ? "우리 병원 언급"
                            : "우리 병원 미언급"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[#d4d6cb] px-3 py-3 text-[11px] font-medium text-[#141512] hover:bg-[#e9ebe1] disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}{" "}
                    이전 답변 더 보기
                  </button>
                )}
              </div>
              {selectedResponse && (
                <article
                  id={`answer-content-${promptId}`}
                  role="tabpanel"
                  aria-labelledby={`answer-choice-${promptId}-${selectedResponse.id}`}
                  tabIndex={0}
                  className="min-w-0 p-4 outline-none"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium text-[#72756a]">
                        {formatDate(selectedResponse)}
                      </p>
                      <h5 className="mt-1 text-lg font-semibold tracking-tight">
                        {platformLabels[selectedResponse.aiPlatform] ||
                          selectedResponse.aiPlatform}
                      </h5>
                    </div>
                    <span
                      className={`border px-2.5 py-1.5 text-[10px] font-medium ${selectedResponse.isMentioned ? "border-[#b8bcab] bg-[#e9ebe1] text-[#141512]" : "border-[#d4d6cb] bg-[#f1f1eb] text-[#72756a]"}`}
                    >
                      {selectedResponse.isMentioned
                        ? `우리 병원 언급${selectedResponse.mentionPosition ? ` · ${selectedResponse.mentionPosition}번째` : ""}`
                        : "우리 병원 미언급"}
                    </span>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-y border-[#d4d6cb] py-2">
                    <span className="font-mono text-[10px] text-[#72756a]">
                      {String(selectedIndex + 1).padStart(2, "0")} /{" "}
                      {String(responses.length).padStart(2, "0")}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="이전 AI 답변"
                        aria-disabled={selectedIndex <= 0}
                        className="aria-disabled:opacity-40"
                        onClick={() => selectResponseAt(selectedIndex - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" /> 이전
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="다음 AI 답변"
                        aria-disabled={selectedIndex >= responses.length - 1}
                        className="aria-disabled:opacity-40"
                        onClick={() => selectResponseAt(selectedIndex + 1)}
                      >
                        다음 <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div key={selectedResponse.id} className="signal-enter">
                    <blockquote className="mb-6 mt-6 border-l-2 border-[#ff5d2a] pl-4">
                      <p className="mb-1 text-[10px] font-semibold text-[#72756a]">
                        측정 당시 질문
                      </p>
                      <p className="break-words text-sm font-medium leading-6">
                        {selectedResponse.questionSnapshotAvailable &&
                        selectedResponse.measuredQuestion
                          ? selectedResponse.measuredQuestion
                          : "당시 질문 문구를 확인할 수 없습니다"}
                      </p>
                    </blockquote>
                    <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap break-words border-t border-[#d4d6cb] pt-5 text-[13px] leading-[1.95] text-[#33372c] sm:text-sm">
                      {selectedResponse.responseText || "답변 원문이 없습니다."}
                    </div>
                    {Array.isArray(selectedResponse.citedSources) &&
                      selectedResponse.citedSources.length > 0 && (
                        <p className="mt-5 border-t border-[#d4d6cb] pt-3 text-[10px] text-[#72756a]">
                          이 답변에 인용된 출처{" "}
                          {selectedResponse.citedSources.length}개
                        </p>
                      )}
                  </div>
                </article>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
