"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, hospitalApi, queryTemplatesApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import {
  Building,
  Globe,
  Shield,
  Loader2,
  Save,
  Sparkles,
  Check,
  RefreshCw,
  Eye,
  Plus,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/hooks/useToast";
import { ProcedureSelector, uniqueProcedures } from "@/components/settings/ProcedureSelector";

const specialtyNames: Record<string, string> = {
  DENTAL: "치과",
  DERMATOLOGY: "피부과",
  PLASTIC_SURGERY: "성형외과",
  ORTHOPEDICS: "정형외과",
  KOREAN_MEDICINE: "한의원",
  OPHTHALMOLOGY: "안과",
  INTERNAL_MEDICINE: "내과",
  UROLOGY: "비뇨기과",
  ENT: "이비인후과",
  PSYCHIATRY: "정신건강의학과",
  OBSTETRICS: "산부인과",
  PEDIATRICS: "소아과",
  OTHER: "기타",
};

const intentNames: Record<string, string> = {
  RESERVATION: "예약 의도",
  COMPARISON: "비교 의도",
  INFORMATION: "정보 탐색",
  REVIEW: "후기/리뷰",
  FEAR: "공포/걱정",
};

const intentWeights: Record<string, number> = {
  RESERVATION: 1.5,
  REVIEW: 1.3,
  FEAR: 1.2,
  COMPARISON: 1.1,
  INFORMATION: 1.0,
};

// 요금제 정보
const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    priceText: "무료",
    description: "무료 체험 - 기본 모니터링",
    features: [
      "모니터링 질문 1개",
      "1개 AI 플랫폼 (Perplexity)",
      "주 1회 크롤링 (월 4회)",
      "ABHS 기본 점수",
    ],
    notIncluded: [
      "경쟁사 분석",
      "ChatGPT / Claude / Gemini 분석",
      "AI 질문 변형 생성",
      "Content Gap 분석",
      "데이터 내보내기",
    ],
    isPopular: false,
    badge: "",
  },
  {
    id: "STARTER",
    name: "S",
    price: 99000,
    priceText: "9.9만원/월",
    description: "소규모 · 1인 원장 (1~15명)",
    features: [
      "모니터링 질문 5개",
      "4개 AI 플랫폼 + 티저 (Grok·CLOVA X 맛보기)",
      "주 2회 크롤링",
      "경쟁 병원 3개 비교 분석",
      "ABHS 점수",
      "주간 리포트",
    ],
    notIncluded: [
      "매일 크롤링",
      "AI 질문 변형 생성",
      "Content Gap 분석",
      "데이터 내보내기",
    ],
    isPopular: false,
    badge: "",
  },
  {
    id: "STANDARD",
    name: "M",
    price: 290000,
    priceText: "29만원/월",
    description: "주력 플랜 (16~30명)",
    features: [
      "모니터링 질문 15개",
      "7개 AI 플랫폼 전체 (CLOVA X·네이버 AI 브리핑 포함)",
      "매일 크롤링",
      "ABHS 점수",
      "주간 리포트",
      "경쟁 병원 10개 비교 분석",
      "AI 질문 변형 생성",
      "경쟁사 AEO 측정",
      "자동 액션 인텔리전스",
      "데이터 내보내기",
    ],
    notIncluded: ["Content Gap 분석"],
    isPopular: true,
    badge: "주력",
  },
  {
    id: "PRO",
    name: "L",
    price: 490000,
    priceText: "49만원/월",
    description: "대형 · 다진료과 (31~80명)",
    features: [
      "모니터링 질문 35개",
      "7개 AI 플랫폼 전체 (CLOVA X·네이버 AI 브리핑 포함)",
      "매일 크롤링",
      "ABHS 점수",
      "주간 + 월간 딥리포트",
      "경쟁 병원 20개 비교 분석",
      "AI 질문 변형 생성",
      "경쟁사 AEO 측정",
      "Content Gap 분석",
      "자동 액션 인텔리전스",
      "데이터 내보내기",
      "우선 지원",
    ],
    notIncluded: [],
    isPopular: false,
    badge: "L",
  },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const proceduresDirty = useRef(false);
  const procedureHospitalId = useRef<string>();
  const [isSavingProcedures, setIsSavingProcedures] = useState(false);
  const [showQueryPreview, setShowQueryPreview] = useState(false);
  const [introDraft, setIntroDraft] = useState("");
  const [introEditing, setIntroEditing] = useState(false);
  const [hubTreatmentsImported, setHubTreatmentsImported] = useState(false);

  // 병원 정보 조회
  const { data: hospital, isLoading } = useQuery({
    queryKey: ["hospital", hospitalId],
    queryFn: () => hospitalApi.get(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const { data: hubIntroStatus } = useQuery({
    queryKey: ["hub-introduction-status", hospitalId],
    queryFn: () => hospitalApi.hubIntroduction().then((res) => res.data),
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // 진료과별 시술 목록
  const { data: procedures, isLoading: proceduresLoading, isError: proceduresError, refetch: refetchProcedures } = useQuery({
    queryKey: ["procedures", hospital?.specialtyType],
    queryFn: () =>
      queryTemplatesApi
        .getSpecialtyProcedures(hospital!.specialtyType)
        .then((res) => res.data),
    enabled: !!hospital?.specialtyType,
  });

  // 쿼리 미리보기
  const { data: queryPreview, refetch: refetchPreview } = useQuery({
    queryKey: [
      "queryPreview",
      hospital?.regionSido,
      hospital?.regionSigungu,
      hospital?.specialtyType,
      selectedProcedures,
    ],
    queryFn: () =>
      queryTemplatesApi
        .previewQueries({
          region: `${hospital!.regionSido} ${hospital!.regionSigungu}`,
          specialtyType: hospital!.specialtyType,
          procedures: selectedProcedures,
        })
        .then((res) => res.data),
    enabled: !!hospital && selectedProcedures.length > 0 && showQueryPreview,
  });

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    websiteUrl: "",
    naverPlaceId: "",
    specialtyType: "",
    regionSido: "",
    regionSigungu: "",
    regionDong: "",
  });
  const [nameAliases, setNameAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");

  // 허브 프로필에서 채워 내려온 필드 목록 (API가 빈 필드만 채워서 내려줌 — DB 저장 전 상태)
  const hubPrefilledFields: string[] = hospital?.hubPrefill?.fields || [];
  const hubFieldLabels: Record<string, string> = {
    specialtyType: "진료과목",
    regionSido: "지역(시/도)",
    regionSigungu: "지역(시/군/구)",
    regionDong: "지역(동)",
    coreTreatments: "주력 진료",
    clinicIntroduction: "병원 소개",
  };

  useEffect(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || "",
        address: hospital.address || "",
        websiteUrl: hospital.websiteUrl || "",
        naverPlaceId: hospital.naverPlaceId || "",
        specialtyType: hospital.specialtyType || "",
        regionSido: hospital.regionSido || "",
        regionSigungu: hospital.regionSigungu || "",
        regionDong: hospital.regionDong || "",
      });
      setNameAliases(hospital.nameAliases || []);
      if (!introEditing) setIntroDraft(hospital.clinicIntroduction || "");
    }
  }, [hospital, introEditing]);

  useEffect(() => {
    if (!hospital) return;
    if (procedureHospitalId.current !== hospital.id) {
      procedureHospitalId.current = hospital.id;
      proceduresDirty.current = false;
    }
    if (!proceduresDirty.current) {
      setSelectedProcedures(uniqueProcedures(
        hospital.keyProcedures?.length ? hospital.keyProcedures : hospital.coreTreatments || [],
      ));
    }
  }, [hospital]);

  const changeProcedures = (next: string[]) => {
    proceduresDirty.current = true;
    setSelectedProcedures(uniqueProcedures(next));
  };

  const importIntroductionMutation = useMutation({
    mutationFn: () => hospitalApi.hubIntroduction(true).then((res) => res.data),
    onSuccess: (data: any) => {
      if (!data?.enabled) {
        toast.warning("허브 연동이 설정되지 않았습니다.");
        return;
      }
      if (!data?.connected) {
        toast.warning(
          "허브 프로필에 연결할 수 없습니다. 계정 연결 상태를 확인해주세요.",
        );
        return;
      }
      if (!data?.introduction) {
        toast.warning(
          "허브에 병원 소개에 사용할 정보가 없습니다. 직접 작성할 수 있습니다.",
        );
        return;
      }
      setIntroDraft(data.introduction);
      setIntroEditing(true);
      queryClient.setQueryData(["hub-introduction-status", hospitalId], data);
      toast.success(
        "허브 내용을 편집 화면에 가져왔습니다. 확인 후 저장하면 반영됩니다.",
      );
    },
    onError: () => toast.error("허브 병원 소개를 가져오지 못했습니다."),
  });

  const saveIntroductionMutation = useMutation({
    mutationFn: () =>
      hospitalApi.update(hospitalId!, {
        clinicIntroduction: introDraft.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital", hospitalId] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      setIntroEditing(false);
      toast.success("병원 소개가 저장되었습니다. 핵심 질문 추천에 반영됩니다.");
    },
    onError: () => toast.error("병원 소개를 저장하지 못했습니다."),
  });

  // 별칭 추가
  const addAlias = () => {
    const trimmed = newAlias.trim();
    if (!trimmed) return;
    if (nameAliases.includes(trimmed)) {
      toast.warning("이미 등록된 별칭입니다.");
      return;
    }
    if (nameAliases.length >= 10) {
      toast.warning("별칭은 최대 10개까지 등록 가능합니다.");
      return;
    }
    setNameAliases([...nameAliases, trimmed]);
    setNewAlias("");
  };

  // 별칭 삭제
  const removeAlias = (alias: string) => {
    setNameAliases(nameAliases.filter((a) => a !== alias));
  };

  // 별칭 저장
  const saveAliasesMutation = useMutation({
    mutationFn: () => hospitalApi.update(hospitalId!, { nameAliases }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
      toast.success(
        "병원 별칭이 저장되었습니다. 다음 크롤링/실시간 질문부터 반영됩니다.",
      );
    },
    onError: () => {
      toast.error("별칭 저장에 실패했습니다.");
    },
  });

  // 허브 프로필에서 다시 가져오기 — 허브 값(병원명·진료과목·지역·주력 진료)으로 폼을 덮어 채움
  // (폼에만 채워짐 — 사용자가 확인·수정 후 [저장]을 눌러야 DB 반영)
  const hubRefetchMutation = useMutation({
    mutationFn: () => hospitalApi.hubPrefill(true).then((res) => res.data),
    onSuccess: (data: any) => {
      if (!data?.enabled) {
        toast.warning("허브 연동이 설정되지 않았습니다.");
        return;
      }
      const prefill = data?.prefill;
      if (!prefill) {
        toast.warning(
          "허브에서 가져올 프로필이 없습니다. Patient Hub 계정 연결 상태를 확인해주세요.",
        );
        return;
      }
      setFormData((prev) => ({
        ...prev,
        name: prefill.name || prev.name,
        specialtyType: prefill.specialtyType || prev.specialtyType,
        regionSido: prefill.regionSido || prev.regionSido,
        regionSigungu: prefill.regionSigungu || prev.regionSigungu,
        regionDong: prefill.regionDong || prev.regionDong,
      }));
      if (prefill.coreTreatments?.length > 0) {
        changeProcedures(prefill.coreTreatments);
        setHubTreatmentsImported(true);
      }
      setIsEditing(true);
      toast.success(
        "허브 프로필 값으로 채웠습니다. 확인 후 [저장]을 눌러야 반영됩니다.",
      );
    },
    onError: () => toast.error("허브 프로필을 가져오지 못했습니다."),
  });

  const handleHubRefetch = () => {
    if (
      !window.confirm(
        "Patient Hub 프로필 값으로 병원명·진료과목·지역·주력 진료를 덮어씁니다.\n(폼에만 채워지며, [저장]을 눌러야 실제 반영됩니다)\n계속할까요?",
      )
    )
      return;
    hubRefetchMutation.mutate();
  };

  // 병원 정보 업데이트
  const updateMutation = useMutation({
    mutationFn: (data: any) => hospitalApi.update(hospitalId!, data),
    onSuccess: (_response, saved) => {
      if (saved.keyProcedures) proceduresDirty.current = false;
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
      queryClient.invalidateQueries({
        queryKey: ["core-questions", hospitalId],
      });
      setIsEditing(false);
      setHubTreatmentsImported(false);
      toast.success("병원 정보가 업데이트되었습니다.");
    },
  });

  // 쿼리 자동 생성
  const generateMutation = useMutation({
    mutationFn: () =>
      queryTemplatesApi.generateQueries(
        hospitalId!,
        hospital?.planType === "PRO" ? true : false,
      ),
    onSuccess: (res) => {
      toast.success(`${res.data.created}개의 모니터링 쿼리가 생성되었습니다!`);
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
    onError: () => toast.error("핵심 진료는 저장됐지만 질문 생성에 실패했습니다. 다시 시도해주세요."),
  });

  // 시술 저장 + 쿼리 생성
  const handleSaveProcedures = async () => {
    if (selectedProcedures.length === 0 || selectedProcedures.length > 3) {
      toast.warning("핵심 진료는 1개부터 최대 3개까지 선택해주세요.");
      return;
    }
    if (isSavingProcedures || generateMutation.isPending) return;
    setIsSavingProcedures(true);
    try {
      await hospitalApi.update(hospitalId!, {
        keyProcedures: selectedProcedures,
        coreTreatments: selectedProcedures,
      });
      proceduresDirty.current = false;
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
      queryClient.invalidateQueries({ queryKey: ["core-questions", hospitalId] });
      generateMutation.mutate();
    } catch {
      toast.error("핵심 진료를 저장하지 못했습니다. 선택은 유지됩니다. 다시 시도해주세요.");
    } finally {
      setIsSavingProcedures(false);
    }
  };

  const handleSave = () => {
    const saveSelectedTreatments = hubTreatmentsImported ||
      (hubPrefilledFields.includes("coreTreatments") && hospital?.coreTreatments?.length > 0);
    if (saveSelectedTreatments && (selectedProcedures.length === 0 || selectedProcedures.length > 3)) {
      toast.warning("가져온 핵심 진료를 1개부터 최대 3개까지 선택한 후 저장해주세요.");
      return;
    }
    // 필수 필드(진료과·지역)는 빈 값으로 덮어쓰지 않도록 비어 있으면 payload에서 제외
    const payload: any = {
      name: formData.name,
      address: formData.address,
      websiteUrl: formData.websiteUrl,
      naverPlaceId: formData.naverPlaceId,
      nameAliases,
    };
    if (formData.specialtyType) payload.specialtyType = formData.specialtyType;
    if (formData.regionSido.trim())
      payload.regionSido = formData.regionSido.trim();
    if (formData.regionSigungu.trim())
      payload.regionSigungu = formData.regionSigungu.trim();
    if (formData.regionDong.trim())
      payload.regionDong = formData.regionDong.trim();
    // 허브에서 다시 가져온 주력 진료는 사용자가 확인한 현재 선택값으로 함께 저장
    if (saveSelectedTreatments) {
      payload.coreTreatments = selectedProcedures;
      payload.keyProcedures = selectedProcedures;
    }
    updateMutation.mutate(payload);
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header
          title="병원 프로필"
          description="질문 추천의 기준이 되는 병원 정보"
        />
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <Building className="mx-auto mb-5 h-10 w-10 text-[#c0c4c7]" />
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            병원 등록부터 시작하세요
          </h2>
          <p className="mb-6 mt-3 text-sm text-[#959c9f]">
            병원 정보를 등록하면 소개와 질문 추천을 설정할 수 있습니다.
          </p>
          <Button onClick={() => (window.location.href = "/onboarding")}>
            병원 등록하기 <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#c0c4c7]" />
      </div>
    );

  return (
    <div className="min-h-screen text-[#f5f5ef]">
      <Header
        title="병원 프로필"
        description="질문 추천에 사용할 병원 정보"
      />
      <div className="mx-auto max-w-[1480px] space-y-8 px-5 pb-12 pt-7 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-[10px] font-bold tracking-[0.2em] text-[#959c9f]">
              01 / 병원 정보
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] sm:text-[38px]">
              병원 소개
            </h1>
            <p className="mt-3 text-sm text-[#959c9f]">
              병원 소개와 주력 진료를 연결해 환자분의 핵심 질문을 찾습니다.
            </p>
          </div>
          <Link
            href="/dashboard/prompts"
            className="inline-flex items-center gap-2 border-b border-[#30343a] pb-1.5 text-sm font-semibold"
          >
            추천 질문 확인 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden border border-[#30343a] bg-[#111315]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#30343a] px-6 py-6 sm:px-8">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">
                  추천에 사용할 정보
                </p>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  소개 원문
                </h2>
              </div>
              <span className="border border-[#30343a] bg-[#181b1e] px-3 py-1.5 text-[10px] font-medium text-[#ff9565]">
                핵심 질문 추천의 기준
              </span>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <label
                htmlFor="clinic-introduction"
                className="mb-3 block text-xs font-medium text-[#959c9f]"
              >
                주요 진료 · 진료 철학 · 지역 환자분께 알려야 할 특징
              </label>
              {introEditing ? (
                <textarea
                  id="clinic-introduction"
                  value={introDraft}
                  onChange={(e) => setIntroDraft(e.target.value)}
                  maxLength={2000}
                  rows={9}
                  placeholder="우리 병원의 주요 진료와 특징을 사실에 맞게 작성하세요."
                  className="min-h-[280px] w-full resize-y rounded-xl border border-[#30343a] bg-[#111315] p-5 text-base leading-8 text-[#f5f5ef] outline-none placeholder:text-[#959c9f] focus:border-[#30343a] focus:ring-2 focus:ring-[#d9ff43]/50"
                />
              ) : (
                <div
                  id="clinic-introduction"
                  className="min-h-[140px] whitespace-pre-wrap break-words py-2 text-base leading-8 text-[#c0c4c7] sm:text-lg sm:leading-9"
                >
                  {introDraft || (
                    <div className="flex min-h-[140px] flex-col items-start justify-center">
                      <p className="text-xl font-medium text-[#f5f5ef]">
                        병원 소개를 채워주세요.
                      </p>
                      <p className="mt-3 max-w-md text-sm leading-7 text-[#959c9f]">
                        Hub에 입력한 정보를 가져오거나, 우리 병원의 진료와
                        특징을 직접 작성할 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#959c9f]">
                <span>
                  {hubPrefilledFields.includes("clinicIntroduction")
                    ? "Hub에서 가져온 초안 · 저장 전"
                    : hospital?.clinicIntroduction
                      ? "Signal에 저장한 소개"
                      : "저장 후 질문 추천에 반영됩니다"}
                </span>
                {introEditing && <span>{introDraft.length} / 2,000자</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#30343a] bg-[#111315] px-6 py-4 sm:px-8">
              <Button
                variant="ghost"
                onClick={() => importIntroductionMutation.mutate()}
                disabled={importIntroductionMutation.isPending}
              >
                {importIntroductionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}{" "}
                Hub에서 가져오기
              </Button>
              <div className="flex gap-2">
                {introEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIntroDraft(hospital?.clinicIntroduction || "");
                        setIntroEditing(false);
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => saveIntroductionMutation.mutate()}
                      disabled={saveIntroductionMutation.isPending}
                    >
                      {saveIntroductionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}{" "}
                      소개 저장
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIntroEditing(true)}>
                    소개 편집 <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </section>
          <aside className="space-y-5">
            <section className="border border-[#30343a] bg-[#08090a] p-6 text-white">
              <p className="mb-7 flex items-center gap-2 text-xs font-medium text-[#ff6a24]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a24]" />{" "}
                PATIENT HUB
              </p>
              <h2 className="font-display text-xl font-medium leading-8 tracking-tight">
                Hub 연결
              </h2>
              <p className="mt-4 text-xs leading-6 text-[#b8bcab]">
                Hub의 병원 정보에서 소개 초안을 가져옵니다. 우리 병원에 맞게
                확인하고 수정한 내용이 질문 추천의 기준이 됩니다.
              </p>
              <div className="mt-6 border-t border-white/15 pt-4">
                <p className="flex items-center gap-2 text-xs text-[#c0c4c7]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${hubIntroStatus?.connected ? "bg-[#ff6a24]" : "bg-[#989b8d]"}`}
                  />
                  {hubIntroStatus?.connected
                    ? "병원 정보 수신 완료"
                    : hubIntroStatus?.enabled === false
                      ? "Hub 연동 미설정"
                      : hubIntroStatus?.enabled
                        ? "병원 정보 연결 안 됨"
                        : "연결 상태 확인 중"}
                </p>
              </div>
            </section>
            <div className="px-1">
              <p className="text-xs font-semibold">
                작성 기준
              </p>
              <ol className="mt-4 space-y-4">
                {[
                  "실제 제공하는 주력 진료를 구체적으로",
                  "우리 병원만의 진료 방식과 철학을 사실대로",
                  "지역 환자분이 알아야 할 정보를 간결하게",
                ].map((item, index) => (
                  <li
                    key={item}
                    className="flex gap-3 text-xs leading-6 text-[#959c9f]"
                  >
                    <span className="font-medium tabular-nums text-[#c0c4c7]">
                      0{index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
              <Link
                href="/dashboard/competitors"
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#c0c4c7]"
              >
                경쟁 병원도 설정하기 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>

        <section className="grid gap-6 border-t border-[#30343a] pt-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">
              02 / CLINIC DETAILS
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              병원 기본 정보
            </h2>
            <p className="mt-3 text-xs leading-6 text-[#959c9f]">
              지역과 진료과를 정확히 알려주면
              <br className="hidden lg:block" /> 질문 추천이 더 구체적이 됩니다.
            </p>
          </div>
          <div className="min-w-0 rounded-sm border border-[#30343a] bg-[#111315] p-5 sm:p-7">
            {hubPrefilledFields.length > 0 && (
              <div className="mb-6 border-l-2 border-[#989b8d] bg-[#111315] p-4 text-xs leading-6 text-[#c0c4c7]">
                <p className="font-semibold">
                  Hub에서 가져온 정보를 확인해 주세요.
                </p>
                <p>
                  {hubPrefilledFields
                    .map((f) => hubFieldLabels[f] || f)
                    .join(", ")}{" "}
                  · 수정 후 저장하면 반영됩니다.
                </p>
              </div>
            )}
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <Label>병원명</Label>
                <Input
                  value={isEditing ? formData.name : hospital?.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label>진료과목</Label>
                {isEditing ? (
                  <select
                    value={formData.specialtyType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialtyType: e.target.value,
                      })
                    }
                    className="flex h-10 w-full rounded-xl border border-[#30343a] bg-[#111315] px-3 py-2 text-sm outline-none focus:border-[#d9ff43]"
                  >
                    <option value="" disabled>
                      진료과목 선택
                    </option>
                    {Object.entries(specialtyNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={
                      specialtyNames[hospital?.specialtyType] ||
                      hospital?.specialtyType ||
                      ""
                    }
                    disabled
                  />
                )}
              </div>
              <div>
                <Label>지역</Label>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={formData.regionSido}
                      onChange={(e) =>
                        setFormData({ ...formData, regionSido: e.target.value })
                      }
                      placeholder="시/도"
                    />
                    <Input
                      value={formData.regionSigungu}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          regionSigungu: e.target.value,
                        })
                      }
                      placeholder="시/군/구"
                    />
                  </div>
                ) : (
                  <Input
                    value={`${hospital?.regionSido || ""} ${hospital?.regionSigungu || ""}`.trim()}
                    disabled
                  />
                )}
              </div>
              <div>
                <Label>상세 주소</Label>
                <Input
                  value={isEditing ? formData.address : hospital?.address || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  disabled={!isEditing}
                  placeholder="상세 주소 입력"
                />
              </div>
              <div>
                <Label>웹사이트</Label>
                <Input
                  value={
                    isEditing ? formData.websiteUrl : hospital?.websiteUrl || ""
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, websiteUrl: e.target.value })
                  }
                  disabled={!isEditing}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>네이버 플레이스 ID</Label>
                <Input
                  value={
                    isEditing
                      ? formData.naverPlaceId
                      : hospital?.naverPlaceId || ""
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, naverPlaceId: e.target.value })
                  }
                  disabled={!isEditing}
                  placeholder="플레이스 ID"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#30343a] pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleHubRefetch}
                disabled={hubRefetchMutation.isPending}
              >
                {hubRefetchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}{" "}
                Hub 프로필 다시 가져오기
              </Button>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setHubTreatmentsImported(false);
                        setSelectedProcedures(
                          hospital?.keyProcedures?.length
                            ? hospital.keyProcedures
                            : hospital?.coreTreatments || [],
                        );
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}{" "}
                      저장
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        name: hospital?.name || "",
                        address: hospital?.address || "",
                        websiteUrl: hospital?.websiteUrl || "",
                        naverPlaceId: hospital?.naverPlaceId || "",
                        specialtyType: hospital?.specialtyType || "",
                        regionSido: hospital?.regionSido || "",
                        regionSigungu: hospital?.regionSigungu || "",
                        regionDong: hospital?.regionDong || "",
                      });
                      setIsEditing(true);
                    }}
                  >
                    정보 수정
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-[#30343a] pt-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">
              03 / FOCUS AREAS
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">핵심 시술</h2>
            <p className="mt-3 text-xs leading-6 text-[#959c9f]">
              {specialtyNames[hospital?.specialtyType] || "등록된 진료과"}에 맞는 주력 진료를 최대 3개 선택하세요.
              <br />
              기존에 등록한 진료도 선택 목록에서 해제할 수 있습니다.
            </p>
            <p className="mt-4 text-3xl font-medium tracking-tight">
              {selectedProcedures.length}
              <span className="ml-2 text-sm text-[#959c9f]">/ 3 선택</span>
            </p>
          </div>
          <div className="min-w-0 rounded-sm border border-[#30343a] bg-[#111315] p-5 sm:p-7">
            <ProcedureSelector
              options={procedures || []}
              selected={selectedProcedures}
              onChange={changeProcedures}
              specialtyName={specialtyNames[hospital?.specialtyType] || "등록된 진료과"}
              loading={proceduresLoading}
              error={proceduresError}
              onRetry={() => void refetchProcedures()}
              disabled={isSavingProcedures || generateMutation.isPending}
            />
            {isEditing && formData.specialtyType !== hospital?.specialtyType && (
              <p className="mt-4 text-xs leading-6 text-[#ff6a24]">
                변경한 진료과는 병원 기본 정보를 저장한 후 이 목록에 반영됩니다.
              </p>
            )}
            <p className="mt-5 text-xs leading-6 text-[#959c9f]">
              선택한 진료로 질문 후보를 만듭니다. 실제 등록 수는 요금제의 남은 질문 한도에 따라 달라집니다.
              기존 자동 생성 질문은 새 질문으로 교체됩니다.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#30343a] pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowQueryPreview(!showQueryPreview);
                  if (!showQueryPreview) refetchPreview();
                }}
                disabled={selectedProcedures.length === 0}
              >
                <Eye className="h-4 w-4" />
                {showQueryPreview ? "미리보기 닫기" : "질문 미리보기"}
              </Button>
              <Button
                onClick={handleSaveProcedures}
                disabled={
                  selectedProcedures.length === 0 || selectedProcedures.length > 3 || isSavingProcedures || generateMutation.isPending
                }
              >
                {isSavingProcedures || generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}{" "}
                저장하고 질문 생성
              </Button>
            </div>
            {showQueryPreview && queryPreview && (
              <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-[#30343a] bg-[#111315] p-4">
                <h3 className="mb-4 text-sm font-semibold">
                  질문 후보 {queryPreview.total}개
                </h3>
                <div className="divide-y divide-[#30343a]">
                  {queryPreview.queries
                    ?.slice(0, 30)
                    .map((q: any, idx: number) => (
                      <div key={idx} className="py-3 first:pt-0">
                        <p className="mb-1 text-[10px] text-[#c0c4c7]">
                          {intentNames[q.intent] || q.intent}
                          {intentWeights[q.intent] > 1 &&
                            ` ×${intentWeights[q.intent]}`}
                          {q.platform && ` · ${q.platform}`}
                        </p>
                        <p className="text-sm leading-6 text-[#c0c4c7]">
                          {q.query}
                        </p>
                      </div>
                    ))}
                  {queryPreview.total > 30 && (
                    <p className="pt-4 text-center text-xs text-[#959c9f]">
                      외 {queryPreview.total - 30}개
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 border-t border-[#30343a] pt-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">
              04 / NAME RECOGNITION
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">병원 별칭</h2>
            <p className="mt-3 text-xs leading-6 text-[#959c9f]">
              AI가 다른 이름으로 답변해도
              <br className="hidden lg:block" /> 우리 병원으로 알아볼 수 있게
              합니다.
            </p>
          </div>
          <div className="rounded-sm border border-[#30343a] bg-[#111315] p-5 sm:p-7">
            <p className="text-xs text-[#959c9f]">
              공식 이름{" "}
              <strong className="ml-2 font-semibold text-[#f5f5ef]">
                {hospital?.name}
              </strong>
            </p>
            <p className="mt-3 text-xs leading-6 text-[#959c9f]">
              약칭이나 자주 쓰는 변형 명칭을 등록하세요. 예를 들어 공식 이름이
              &quot;바른얼굴치과교정과치과의원&quot;이면
              &quot;바른얼굴교정치과&quot;를 별칭으로 사용할 수 있습니다.
            </p>
            {nameAliases.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {nameAliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-2 rounded-full border border-[#30343a] bg-[#181b1e] px-3 py-1.5 text-xs text-[#c0c4c7]"
                  >
                    {alias}
                    <button
                      onClick={() => removeAlias(alias)}
                      aria-label={`${alias} 별칭 삭제`}
                      className="rounded-full p-0.5 hover:bg-[#d7dacd]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Input
                placeholder="새 별칭 입력"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAlias();
                  }
                }}
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                onClick={addAlias}
                disabled={!newAlias.trim()}
              >
                <Plus className="h-4 w-4" /> 추가
              </Button>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#30343a] pt-5">
              <p className="text-xs text-[#959c9f]">
                {nameAliases.length} / 10개 등록
              </p>
              <Button
                size="sm"
                onClick={() => saveAliasesMutation.mutate()}
                disabled={saveAliasesMutation.isPending}
              >
                {saveAliasesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{" "}
                별칭 저장
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-[#30343a] pt-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#959c9f]">
              05 / WORKSPACE
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              구독과 계정
            </h2>
            <p className="mt-3 text-xs leading-6 text-[#959c9f]">
              사용 범위와 연결 계정을
              <br className="hidden lg:block" /> 한곳에서 관리합니다.
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            <details className="group overflow-hidden border border-[#30343a] bg-[#111315]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:px-7">
                <div>
                  <p className="text-sm font-semibold">요금제</p>
                  <p className="mt-1 text-xs text-[#959c9f]">
                    현재{" "}
                    {PLANS.find((p) => p.id === (hospital?.planType || "FREE"))
                      ?.name || hospital?.planType}{" "}
                    플랜 · 사용 범위와 플랜 비교
                  </p>
                </div>
                <Plus className="h-4 w-4 shrink-0 group-open:rotate-45" />
              </summary>
              <div className="grid border-t border-[#30343a] sm:grid-cols-2">
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === (hospital?.planType || "FREE");
                  const isActiveSub =
                    hospital?.subscriptionStatus === "ACTIVE" ||
                    hospital?.subscriptionStatus === "TRIAL";
                  return (
                    <div
                      key={plan.id}
                      className={`border-b border-r border-[#30343a] p-5 sm:p-6 ${isCurrent && isActiveSub ? "bg-[#111315]" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        {isCurrent && isActiveSub ? (
                          <span className="text-[10px] font-semibold text-[#c0c4c7]">
                            현재 이용 중
                          </span>
                        ) : (
                          plan.isPopular && (
                            <span className="rounded-full bg-[#281a13] px-2.5 py-1 text-[10px] font-semibold text-[#ff9565]">
                              추천 플랜
                            </span>
                          )
                        )}
                      </div>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">
                        {plan.priceText}
                      </p>
                      <p className="mt-2 text-[11px] text-[#959c9f]">
                        {plan.description}
                      </p>
                      <ul className="my-5 space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li
                            key={idx}
                            className="flex gap-2 text-xs leading-5 text-[#c0c4c7]"
                          >
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c0c4c7]" />
                            {feature}
                          </li>
                        ))}
                        {plan.notIncluded.map((feature, idx) => (
                          <li
                            key={`no-${idx}`}
                            className="flex gap-2 text-[11px] leading-5 text-[#959c9f]"
                          >
                            <span className="w-3.5 shrink-0 text-center">
                              −
                            </span>
                            <span>{feature} 제외</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={
                          isCurrent && isActiveSub
                            ? "outline"
                            : plan.isPopular
                              ? "default"
                              : "outline"
                        }
                        disabled={isCurrent && isActiveSub}
                        onClick={() => {
                          if (!(isCurrent && isActiveSub))
                            window.location.href = `/dashboard/billing?plan=${plan.id}`;
                        }}
                      >
                        {isCurrent && isActiveSub
                          ? "현재 이용 중"
                          : "플랜 선택"}
                      </Button>
                      <a
                        href={`/dashboard/billing?plan=${plan.id}&coupon=true`}
                        className="mt-3 block text-center text-[11px] text-[#959c9f] underline underline-offset-4"
                      >
                        쿠폰 적용
                      </a>
                    </div>
                  );
                })}
              </div>
            </details>
            <HubLinkCard />
            <section className="rounded-sm border border-[#30343a] bg-[#111315] p-5 sm:p-7">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-[#959c9f]" /> 계정 보안
              </h3>
              <div className="divide-y divide-[#30343a]">
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#959c9f]">이메일</p>
                    <p className="mt-1 break-all text-sm">{user?.email}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    변경
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-xs text-[#959c9f]">비밀번호</p>
                    <p className="mt-1 text-sm tracking-widest">••••••••</p>
                  </div>
                  <Button variant="outline" size="sm">
                    변경
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

// Hub account linking stays separate from importing clinic profile values.
function HubLinkCard() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string>("");
  const profileQ = useQuery({
    queryKey: ["auth-profile-hub"],
    queryFn: () => api.get("/auth/profile").then((r) => r.data),
  });
  const unlinkM = useMutation({
    mutationFn: () => api.delete("/auth/hub/link"),
    onSuccess: () => {
      setNotice("연결을 해제했습니다.");
      queryClient.invalidateQueries({ queryKey: ["auth-profile-hub"] });
    },
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("hub_linked") === "1") {
      setNotice(
        `Patient Hub 계정(${q.get("hub_email") || ""})과 연결됐습니다. 이제 허브에서 시그널로 바로 들어올 수 있어요.`,
      );
      window.history.replaceState({}, "", "/dashboard/settings");
      queryClient.invalidateQueries({ queryKey: ["auth-profile-hub"] });
    }
  }, [queryClient]);
  const linked = !!profileQ.data?.hubLinked;
  const hubEmail = profileQ.data?.hubEmail as string | null | undefined;
  const apiBase = (
    process.env.NEXT_PUBLIC_API_URL || "https://api.patientsignal.kr/api"
  ).replace(/\/+$/, "");
  return (
    <section className="rounded-sm border border-[#30343a] bg-[#111315] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-[#959c9f]" /> Patient Hub 계정
          </h3>
          <p className="mt-2 break-all text-xs leading-6 text-[#959c9f]">
            {profileQ.isLoading
              ? "연결 상태 확인 중"
              : linked
                ? `연결됨 · ${hubEmail || ""}`
                : "Hub 계정 하나로 페이션트 시리즈를 이용하세요."}
          </p>
        </div>
        {linked ? (
          <Button
            variant="outline"
            size="sm"
            disabled={unlinkM.isPending}
            onClick={() => {
              if (
                confirm(
                  "허브 연결을 해제할까요? 해제해도 시그널 데이터는 그대로입니다.",
                )
              )
                unlinkM.mutate();
            }}
          >
            연결 해제
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `${apiBase}/auth/hub?mode=link`;
            }}
          >
            계정 연결 <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {notice && (
        <p className="mt-4 rounded-xl bg-[#181b1e] p-3 text-xs leading-6 text-[#c0c4c7]">
          {notice}
        </p>
      )}
      <p className="mt-4 border-t border-[#30343a] pt-3 text-[11px] leading-6 text-[#959c9f]">
        다른 이메일로 가입했어도 연결할 수 있습니다. 연결 중 Hub 로그인이
        표시되면 해당 계정으로 로그인하세요. 계정이 없다면
        hub.patientfunnel.kr에서 먼저 만들어 주세요. 기존 리포트·설정·구독은
        유지됩니다.
      </p>
    </section>
  );
}
