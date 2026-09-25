'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Building2, MapPin, Stethoscope, ArrowRight, ArrowLeft,
  Target, Users, Plus, X, Check, Lightbulb, Star, Globe, Loader2,
  Search, Zap, BarChart3, ChevronDown, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PublicBrand } from '@/components/public/PublicBrand';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// ═══════════════════════════════════════════════════════
// V2: 3-Step 강제 퍼널 (Onthe AI 벤치마크 + 독자 프레임워크)
// Step 1: 병원 기본 정보 (이름 + 진료과 + 위치)
// Step 2: 주력 진료 + 강점 + 경쟁사
// Step 3: AI 분석 시작 (자동 질문 생성 미리보기 + 즉시 크롤링)
// ═══════════════════════════════════════════════════════

const TOTAL_STEPS = 3;

// ─── 13개 전체 진료과 (Prisma SpecialtyType 매핑) ───
const specialtyOptions = [
  { value: 'DENTAL', label: '치과', icon: '🦷', color: 'blue' },
  { value: 'DERMATOLOGY', label: '피부과', icon: '💆', color: 'pink' },
  { value: 'PLASTIC_SURGERY', label: '성형외과', icon: '✨', color: 'purple' },
  { value: 'ORTHOPEDICS', label: '정형외과', icon: '🦴', color: 'amber' },
  { value: 'KOREAN_MEDICINE', label: '한의원', icon: '🌿', color: 'green' },
  { value: 'OPHTHALMOLOGY', label: '안과', icon: '👁️', color: 'cyan' },
  { value: 'INTERNAL_MEDICINE', label: '내과', icon: '🩺', color: 'red' },
  { value: 'UROLOGY', label: '비뇨의학과', icon: '🏥', color: 'indigo' },
  { value: 'ENT', label: '이비인후과', icon: '👂', color: 'teal' },
  { value: 'PSYCHIATRY', label: '정신건강의학과', icon: '🧠', color: 'violet' },
  { value: 'OBSTETRICS', label: '산부인과', icon: '🤰', color: 'rose' },
  { value: 'PEDIATRICS', label: '소아청소년과', icon: '👶', color: 'orange' },
  { value: 'OTHER', label: '기타', icon: '🏥', color: 'gray' },
];

// ─── 13개 진료과별 추천 주력 진료 (25축 매트릭스 기반) ───
const suggestedTreatments: Record<string, string[]> = {
  DENTAL: ['임플란트', '치아교정', '라미네이트', '신경치료', '충치치료', '미백', '잇몸치료', '사랑니발치', '소아치과', '보철치료', '턱관절치료', '투명교정', '치아성형'],
  DERMATOLOGY: ['여드름치료', '레이저토닝', '기미잡티', '보톡스', '필러', '리프팅', '제모', '탈모치료', '아토피', '피부관리', '흉터치료', '모공치료', '점제거'],
  PLASTIC_SURGERY: ['코성형', '눈성형', '안면윤곽', '지방흡입', '리프팅', '가슴성형', '쌍꺼풀', '지방이식', '턱성형', '이마성형', '보톡스', '필러', '재수술'],
  ORTHOPEDICS: ['무릎관절', '척추치료', '어깨치료', '도수치료', '관절내시경', '체외충격파', '인공관절', '허리디스크', '목디스크', '손목터널', '골절치료', '스포츠재활'],
  KOREAN_MEDICINE: ['추나요법', '침치료', '한방다이어트', '교통사고치료', '디스크치료', '체형교정', '한방피부치료', '면역력강화', '한방부인과', '만성피로', '보약처방', '소아한방'],
  OPHTHALMOLOGY: ['라식', '라섹', '스마일라식', '백내장', 'ICL렌즈삽입', '드림렌즈', '노안치료', '녹내장', '소아시력교정', '안구건조증', '망막치료', '콘택트렌즈'],
  INTERNAL_MEDICINE: ['건강검진', '내시경', '만성질환관리', '당뇨관리', '고혈압관리', '갑상선', '간질환', '위장질환', '호흡기', '영양수액', '예방접종', '비만관리'],
  UROLOGY: ['전립선', '비뇨기검사', '요로결석', '남성비뇨기', '과민성방광', '혈뇨검사', '소변검사', '요로감염', '발기부전', '남성갱년기'],
  ENT: ['코골이수술', '비중격', '축농증', '편도선', '중이염', '어지럼증', '청력검사', '보청기', '알레르기비염', '음성치료', '수면무호흡'],
  PSYCHIATRY: ['우울증', '불안장애', '공황장애', '불면증', 'ADHD', '상담치료', '스트레스관리', '강박장애', '외상후스트레스', '중독치료', '인지행동치료'],
  OBSTETRICS: ['산전검사', '임신관리', '분만', '부인과검진', '자궁질환', '난소질환', '피임상담', '갱년기치료', '불임치료', '자궁경부암검사', '요실금치료'],
  PEDIATRICS: ['예방접종', '영유아검진', '소아감기', '아토피', '천식', '알레르기', '성장클리닉', '소아비만', '발달검사', '소아야뇨증'],
  OTHER: ['건강검진', '종합검진', '초음파', '예방접종', '만성질환관리', '통증치료'],
};

// ─── 진료과별 병원 강점 옵션 (공통 + 특화) ───
function getStrengthOptions(specialtyType: string): string[] {
  const common = ['친절', '상담꼼꼼', '가격합리적', '최신장비', '야간진료', '주말진료', '주차편리', '역세권', '경력풍부', '전문의', '대기시간짧음', '원장직접진료'];

  const specialtyStrengths: Record<string, string[]> = {
    DENTAL: ['무통치료', '수면치료', '소아전문', '감염관리', '디지털진료', '대학병원급', '원데이치료'],
    DERMATOLOGY: ['자연스러운결과', '남녀전용', '피부맞춤상담', '시술후관리', '피부과전문의'],
    PLASTIC_SURGERY: ['자연스러운결과', '재수술전문', '안전마취', '사후관리', '수술경력풍부'],
    ORTHOPEDICS: ['비수술치료', '재활전문', '스포츠의학', '척추전문', '관절전문'],
    KOREAN_MEDICINE: ['한양방협진', '맞춤처방', '체질분석', '통증특화', '한약처방전문'],
    OPHTHALMOLOGY: ['정밀검사', '부작용관리', '최신레이저', '사후관리', '소아전문'],
    INTERNAL_MEDICINE: ['정밀검진', '수면내시경', '만성질환전문', '당일결과', '종합시스템'],
    UROLOGY: ['남성전문', '비뇨기전문의', '최소침습', '정밀검사', '프라이버시보장'],
    ENT: ['수면검사', '음성전문', '소아전문', '내시경검사', '알레르기전문'],
    PSYCHIATRY: ['프라이버시보장', '심리검사전문', '인지치료전문', '약물최소화', '장기케어'],
    OBSTETRICS: ['여의사진료', '산전관리전문', '불임전문', '최소침습수술', '산후케어'],
    PEDIATRICS: ['소아전문의', '영유아전문', '야간응급', '감염관리', '아이친화'],
  };

  return [...(specialtyStrengths[specialtyType] || []), ...common];
}

// ─── 시/도 목록 ───
const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [showAllSpecialties, setShowAllSpecialties] = useState(false);
  const [analyzingAnimation, setAnalyzingAnimation] = useState(false);
  const [hubPrefilled, setHubPrefilled] = useState(false); // 허브 프로필 프리필 적용 여부
  const [hubIntroductionConnected, setHubIntroductionConnected] = useState(false);
  const introductionEdited = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    specialtyType: '',
    subSpecialties: [] as string[],
    regionSido: '',
    regionSigungu: '',
    regionDong: '',
    address: '',
    websiteUrl: '',
    naverPlaceId: '',
    businessNumber: '',
    clinicIntroduction: '',
    coreTreatments: [] as string[],
    targetRegions: [] as string[],
    competitorNames: [] as string[],
    hospitalStrengths: [] as string[],
  });

  // ─── 허브 프로필 프리필 ───
  // Patient Hub에 이미 입력된 병원 정보(병원명·진료과·지역·주력진료)를 받아
  // "빈 필드만" 미리 채운다. 미연동·키 미설정·실패 시 아무것도 하지 않음 (기존 흐름 100%).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) SSO로 넘어온 허브 병원명 (콜백에서 보관)
      let pendingName: string | null = null;
      try {
        pendingName = localStorage.getItem('hub_pending_hospital_name');
      } catch {}

      // 2) 허브 프로필 (서버 프록시 — 키는 서버에만)
      let prefill: any = null;
      try {
        const { data } = await hospitalApi.hubPrefill();
        if (data?.enabled && data?.prefill) prefill = data.prefill;
      } catch {}

      if (cancelled || (!pendingName && !prefill)) return;

      setFormData((prev) => {
        const next = { ...prev };
        let filled = false;
        if (!prev.name && pendingName) {
          next.name = pendingName;
          filled = true;
        }
        if (prefill) {
          if (!prev.specialtyType && prefill.specialtyType) {
            next.specialtyType = prefill.specialtyType;
            filled = true;
          }
          if (!prev.regionSido && prefill.regionSido) {
            next.regionSido = prefill.regionSido;
            filled = true;
          }
          if (!prev.regionSigungu && prefill.regionSigungu) {
            next.regionSigungu = prefill.regionSigungu;
            filled = true;
          }
          if (!prev.regionDong && prefill.regionDong) {
            next.regionDong = prefill.regionDong;
            filled = true;
          }
          if (
            prev.coreTreatments.length === 0 &&
            Array.isArray(prefill.coreTreatments) &&
            prefill.coreTreatments.length > 0
          ) {
            next.coreTreatments = prefill.coreTreatments.slice(0, 10);
            filled = true;
          }
        }
        if (filled) setHubPrefilled(true);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 소개는 별도 Hub 조회 API에서 가져온다. 사용자가 편집하기 시작했다면 늦게 온 응답으로 덮어쓰지 않는다.
  useEffect(() => {
    let cancelled = false;
    hospitalApi.hubIntroduction()
      .then(({ data }) => {
        if (cancelled || !data?.connected) return;
        setHubIntroductionConnected(true);
        if (typeof data.introduction === 'string' && data.introduction.trim() && !introductionEdited.current) {
          setFormData((prev) => introductionEdited.current || prev.clinicIntroduction
            ? prev
            : { ...prev, clinicIntroduction: data.introduction.slice(0, 2000) });
          setHubPrefilled(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 주력 진료 토글
  const [customTreatment, setCustomTreatment] = useState('');
  const handleTreatmentToggle = (treatment: string) => {
    setFormData((prev) => ({
      ...prev,
      coreTreatments: prev.coreTreatments.includes(treatment)
        ? prev.coreTreatments.filter((t) => t !== treatment)
        : prev.coreTreatments.length < 10
          ? [...prev.coreTreatments, treatment]
          : prev.coreTreatments,
    }));
  };
  const handleAddCustomTreatment = () => {
    const trimmed = customTreatment.trim();
    if (trimmed && !formData.coreTreatments.includes(trimmed) && formData.coreTreatments.length < 10) {
      setFormData((prev) => ({
        ...prev,
        coreTreatments: [...prev.coreTreatments, trimmed],
      }));
      setCustomTreatment('');
    }
  };

  // 경쟁 병원
  const [competitorInput, setCompetitorInput] = useState('');
  const handleAddCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !formData.competitorNames.includes(trimmed) && formData.competitorNames.length < 3) {
      setFormData((prev) => ({
        ...prev,
        competitorNames: [...prev.competitorNames, trimmed],
      }));
      setCompetitorInput('');
    }
  };
  const handleRemoveCompetitor = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      competitorNames: prev.competitorNames.filter((n) => n !== name),
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    setAnalyzingAnimation(true);

    try {
      const cleanData = {
        ...formData,
        businessNumber: formData.businessNumber?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        websiteUrl: formData.websiteUrl?.trim() || undefined,
        naverPlaceId: formData.naverPlaceId?.trim() || undefined,
        regionDong: formData.regionDong?.trim() || undefined,
        // 허브 응답이 늦거나 실패한 미편집 소개는 null로 남겨 이후 프리필을 허용한다.
        // 사용자가 직접 지운 경우에만 빈 문자열을 보내 의도를 보존한다.
        clinicIntroduction: formData.clinicIntroduction.trim() || (introductionEdited.current ? '' : undefined),
      };
      const { data } = await hospitalApi.create(cleanData);
      updateUser({ hospitalId: data.id, hospital: data });

      // 병원 생성 완료 → 보관해 둔 허브 병원명 제거
      try {
        localStorage.removeItem('hub_pending_hospital_name');
      } catch {}

      // 분석 시작 애니메이션 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || '병원 등록에 실패했습니다');
      setAnalyzingAnimation(false);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.name && formData.specialtyType && formData.regionSido && formData.regionSigungu;
      case 2: return formData.coreTreatments.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const currentSuggestions = suggestedTreatments[formData.specialtyType] || suggestedTreatments.OTHER;

  // 분석 시작 애니메이션 화면
  if (analyzingAnimation) {
    return (
      <div className="min-h-screen bg-[#F4F5EF] flex items-center justify-center p-5">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-[22px] bg-[#D8F36A]" />
            <div className="absolute inset-2 rounded-[16px] bg-white flex items-center justify-center">
              <Search className="h-9 w-9 text-[#36765A]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            AI 분석을 시작합니다
          </h2>
          <p className="text-slate-500 mb-6">
            {formData.name}의 AI 검색 가시성을<br />
            이용 가능한 플랫폼에서 확인합니다
          </p>
          <div className="space-y-3">
            {['모니터링 질문 자동 생성 중...', 'AI 플랫폼 연결 중...', '대시보드 준비 중...'].map((text, i) => (
              <div key={i} className="flex items-center gap-3 justify-center text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 진료과 표시 (기본 6개, 전체보기 시 13개)
  const visibleSpecialties = showAllSpecialties
    ? specialtyOptions
    : specialtyOptions.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#F4F5EF] text-[#15231B]">
      <header className="flex h-[76px] items-center justify-between border-b border-[#DEE4D9] px-5 sm:px-10 lg:px-14"><PublicBrand /><span className="text-[10px] font-medium tracking-[0.14em] text-[#778378]">WORKSPACE SETUP</span></header>
      <div className="mx-auto grid max-w-[1320px] lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="border-b border-[#DEE4D9] px-5 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:py-14">
          <div className="lg:sticky lg:top-12">
            <p className="mb-5 text-[10px] font-semibold tracking-[0.18em] text-[#36765A]">LET'S FIND YOUR SIGNAL</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-[-0.065em] sm:text-4xl lg:text-5xl">우리 병원을<br className="hidden lg:block" /> 알려주세요.</h1>
            <p className="mt-4 max-w-xs text-sm leading-7 text-[#637167]">병원 소개를 바탕으로 의미 있는 질문을 찾습니다. 입력한 내용은 언제든 수정할 수 있습니다.</p>
            <ol className="mt-7 grid grid-cols-3 gap-3 lg:mt-12 lg:block lg:space-y-0">
              {['병원 기본 정보', '주력 진료와 경쟁 병원', '확인하고 시작'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={`flex flex-col gap-2 border-t py-4 lg:flex-row lg:items-center lg:gap-5 lg:py-6 ${step === i + 1 ? 'border-[#15231B] text-[#15231B]' : 'border-[#DEE4D9] text-[#778378]'}`}><span className={`flex h-7 w-7 items-center justify-center text-xs font-medium ${step === i + 1 ? 'bg-[#D8F36A]' : ''}`}>{step > i + 1 ? <Check className="h-4 w-4" /> : `0${i + 1}`}</span><span className="text-[11px] font-medium lg:text-sm">{label}</span>{step === i + 1 && <ArrowRight className="ml-auto hidden h-4 w-4 lg:block" />}</li>)}
            </ol>
          </div>
        </aside>
        <main className="min-w-0 bg-white px-5 py-8 sm:px-10 lg:px-14 lg:py-14">
          <div className="mb-8 border-b border-[#DEE4D9] pb-7"><p className="text-[10px] font-semibold tracking-[0.16em] text-[#778378]">STEP {String(step).padStart(2, '0')} / {String(TOTAL_STEPS).padStart(2, '0')}</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">{step === 1 ? '병원의 이야기부터.' : step === 2 ? '어떤 진료에 집중할까요?' : '이제 시그널을 켤 준비가 됐어요.'}</h2></div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl mb-4">
              {error}
            </div>
          )}

          {/* ═══ Step 1: 기본 정보 (병원명 + 진료과 + 위치) ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 허브 프리필 안내 — 빈 필드만 채웠고 모두 수정 가능 */}
              {hubPrefilled && (
                <div className="flex items-center gap-2 rounded-[4px] border border-[#DEE4D9] bg-[#F4F5EF] p-3">
                  <Sparkles className="h-4 w-4 text-[#36765A] shrink-0" />
                  <p className="text-xs text-[#36765A]">
                    Patient Hub 프로필에서 가져와 미리 채웠어요. 수정할 수 있어요.
                  </p>
                </div>
              )}
              {/* 병원명 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  병원명
                </label>
                <Input
                  aria-label="병원명"
                  placeholder="예: 서울비디치과의원"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* 진료과목 - 13개 전체 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  진료과목
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {visibleSpecialties.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={formData.specialtyType === option.value}
                      onClick={() => setFormData({ ...formData, specialtyType: option.value, coreTreatments: [] })}
                      className={`p-2.5 rounded-[4px] border text-center transition-colors ${
                        formData.specialtyType === option.value
                          ? 'border-[#36765A] bg-[#EDF2E1] text-[#13251D]'
                          : 'border-[#DEE4D9] bg-white hover:border-[#A6BAA1]'
                      }`}
                    >
                      <span className={`mx-auto mb-2 block h-1 w-5 ${formData.specialtyType === option.value ? 'bg-[#36765A]' : 'bg-[#DEE4D9]'}`} />
                      <p className="text-[11px] mt-0.5 font-medium">{option.label}</p>
                    </button>
                  ))}
                </div>
                {!showAllSpecialties && (
                  <button
                    type="button"
                    onClick={() => setShowAllSpecialties(true)}
                    className="w-full text-center text-xs text-brand-600 hover:text-brand-700 py-1 flex items-center justify-center gap-1"
                  >
                    <ChevronDown className="h-3 w-3" />
                    전체 진료과 보기 (+7개)
                  </button>
                )}
              </div>

              {/* 위치 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  병원 위치
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="시/도"
                    value={formData.regionSido}
                    onChange={(e) => setFormData({ ...formData, regionSido: e.target.value })}
                    className="w-full h-11 px-3 rounded-[4px] border border-[#DEE4D9] bg-white text-sm focus:border-[#36765A] focus:outline-none focus:ring-2 focus:ring-[#36765A]/15"
                  >
                    <option value="">시/도 선택</option>
                    {SIDO_LIST.map(sido => (
                      <option key={sido} value={sido}>{sido}</option>
                    ))}
                  </select>
                  <Input
                    aria-label="시/군/구"
                    placeholder="시/군/구 (강남구)"
                    value={formData.regionSigungu}
                    onChange={(e) => setFormData({ ...formData, regionSigungu: e.target.value })}
                    required
                  />
                </div>
                <Input
                  aria-label="동/읍/면 (선택)"
                  placeholder="동/읍/면 (역삼동) - 선택"
                  value={formData.regionDong}
                  onChange={(e) => setFormData({ ...formData, regionDong: e.target.value })}
                />
              </div>

              {/* 웹사이트 URL (선택) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  병원 웹사이트
                  <span className="text-xs text-slate-400 font-normal">(선택)</span>
                </label>
                <Input
                  aria-label="병원 웹사이트"
                  placeholder="https://www.example.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
                <p className="text-[11px] text-slate-400">
                  입력하시면 AI가 병원 웹사이트를 인용하는지도 추적합니다
                </p>
              </div>

              <div className="space-y-2 border-t border-[#DEE4D9] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="clinic-introduction" className="flex items-center gap-2 text-sm font-semibold text-[#15231B]">
                    <Sparkles className="h-4 w-4 text-[#36765A]" />
                    병원 소개
                  </label>
                  {hubIntroductionConnected && (
                    <span className="rounded-full bg-[#EDF2E1] px-2.5 py-1 text-[11px] font-semibold text-[#36765A]">Hub 연결됨</span>
                  )}
                </div>
                <p className="text-xs leading-5 text-[#637167]">
                  {hubIntroductionConnected
                    ? 'Patient Hub의 정보를 초안으로 가져왔습니다. 내용은 이곳에서 자유롭게 수정할 수 있습니다.'
                    : '병원의 진료와 특징을 적어 주세요. 이 정보를 바탕으로 더 관련 있는 핵심 질문을 추천합니다.'}
                </p>
                <textarea
                  id="clinic-introduction"
                  value={formData.clinicIntroduction}
                  onChange={(e) => {
                    introductionEdited.current = true;
                    setFormData((prev) => ({ ...prev, clinicIntroduction: e.target.value }));
                  }}
                  maxLength={2000}
                  rows={5}
                  placeholder="주력 진료, 환자분께 설명하고 싶은 특징, 진료 방식을 적어 주세요."
                  className="w-full resize-y rounded-[4px] border border-[#DEE4D9] bg-white px-3.5 py-3 text-sm leading-6 text-[#15231B] placeholder:text-[#778378] focus:border-[#36765A] focus:outline-none focus:ring-2 focus:ring-[#36765A]/15"
                />
                <p className="text-right text-[11px] text-[#778378]">{formData.clinicIntroduction.length}/2000</p>
              </div>

              <Button
                className="w-full bg-[#36765A] hover:bg-[#13251D] text-white"
                onClick={() => setStep(2)}
                disabled={!canProceed()}
              >
                다음: 주력 진료 설정 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ═══ Step 2: 주력 진료 + 강점 + 경쟁사 ═══ */}
          {step === 2 && (
            <div className="space-y-5">
              {/* 주력 진료 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-brand-600" />
                  주력 진료 / 시술
                  <span className="text-xs text-slate-400 font-normal">(1~10개 선택)</span>
                </label>
                <div className="rounded-[4px] border border-[#DEE4D9] bg-[#F4F5EF] p-3 mb-2">
                  <p className="text-xs text-brand-700">
                    <Lightbulb className="inline h-3 w-3 mr-1" />
                    선택한 진료별로 AI 모니터링 질문이 자동 생성됩니다.
                    <strong> 가장 신환을 많이 유치하고 싶은 진료</strong>를 먼저 선택해주세요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentSuggestions.map((treatment) => (
                    <button
                      key={treatment}
                      type="button"
                      aria-pressed={formData.coreTreatments.includes(treatment)}
                      onClick={() => handleTreatmentToggle(treatment)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        formData.coreTreatments.includes(treatment)
                          ? 'border-[#36765A] bg-[#36765A] text-white'
                          : 'border-[#DEE4D9] bg-white hover:border-[#A6BAA1] hover:bg-[#EDF2E1]'
                      }`}
                    >
                      {formData.coreTreatments.includes(treatment) && (
                        <Check className="inline h-3 w-3 mr-1" />
                      )}
                      {treatment}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    aria-label="주력 진료 직접 입력"
                    placeholder="직접 입력 (예: 투명교정)"
                    value={customTreatment}
                    onChange={(e) => setCustomTreatment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTreatment())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomTreatment} aria-label="주력 진료 추가">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.coreTreatments.length > 0 && (
                  <p className="text-xs text-brand-600 font-medium">
                    ✓ {formData.coreTreatments.length}개 선택됨
                    {formData.coreTreatments.length >= 10 && ' (최대)'}
                  </p>
                )}
              </div>

              {/* 병원 강점 */}
              <div className="border-t pt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  우리 병원 강점
                  <span className="text-xs text-slate-400 font-normal">(선택, 복수 가능)</span>
                </label>
                <p className="text-xs text-slate-500">
                  강점 키워드에 맞는 AI 모니터링 질문이 추가됩니다
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getStrengthOptions(formData.specialtyType).map((strength) => (
                    <button
                      key={strength}
                      type="button"
                      aria-pressed={formData.hospitalStrengths.includes(strength)}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          hospitalStrengths: prev.hospitalStrengths.includes(strength)
                            ? prev.hospitalStrengths.filter((s) => s !== strength)
                            : [...prev.hospitalStrengths, strength],
                        }));
                      }}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                        formData.hospitalStrengths.includes(strength)
                          ? 'border-[#36765A] bg-[#EDF2E1] text-[#13251D]'
                          : 'border-[#DEE4D9] bg-white hover:border-[#A6BAA1] hover:bg-[#EDF2E1]'
                      }`}
                    >
                      {formData.hospitalStrengths.includes(strength) && (
                        <Check className="inline h-2.5 w-2.5 mr-0.5" />
                      )}
                      {strength}
                    </button>
                  ))}
                </div>
              </div>

              {/* 경쟁 병원 */}
              <div className="border-t pt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  경쟁 병원
                  <span className="text-xs text-slate-400 font-normal">(선택, 시작 플랜 최대 3개)</span>
                </label>
                <p className="text-xs text-slate-500">
                  비교할 병원을 직접 추가하세요. 이후에도 경쟁 병원 화면에서 수정할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <Input
                    aria-label="추가할 경쟁 병원명"
                    placeholder="경쟁 병원명 (예: ABC의원)"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                    disabled={formData.competitorNames.length >= 3}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCompetitor}
                    aria-label="경쟁 병원 추가"
                    disabled={formData.competitorNames.length >= 3 || !competitorInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.competitorNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.competitorNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EDF2E1] text-[#13251D] text-sm rounded-full border border-[#DEE4D9]"
                      >
                        {name}
                        <button aria-label={`${name} 삭제`} onClick={() => handleRemoveCompetitor(name)}>
                          <X className="h-3 w-3 text-orange-500 hover:text-red-500" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button
                  className="flex-1 bg-[#36765A] hover:bg-[#13251D] text-white"
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                >
                  다음: 분석 시작 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 3: AI 분석 시작 (미리보기 + 즉시 시작) ═══ */}
          {step === 3 && (
            <div className="space-y-4">
              {/* 등록 요약 */}
              <div className="space-y-3">
                <div className="rounded-[4px] border border-[#DEE4D9] bg-[#F4F5EF] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{formData.name}</p>
                      <p className="text-sm text-slate-600">
                        {specialtyOptions.find(o => o.value === formData.specialtyType)?.icon}{' '}
                        {specialtyOptions.find(o => o.value === formData.specialtyType)?.label}
                        {' · '}📍 {formData.regionSido} {formData.regionSigungu} {formData.regionDong}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      수정
                    </button>
                  </div>
                </div>

                {formData.coreTreatments.length > 0 && (
                  <div className="rounded-[4px] border border-[#DEE4D9] bg-[#F4F5EF] p-4">
                    <p className="text-xs text-[#36765A] mb-1.5 font-semibold">주력 진료 ({formData.coreTreatments.length}개)</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.coreTreatments.map((t) => (
                        <span key={t} className="rounded-full border border-[#DEE4D9] bg-white px-2 py-0.5 text-xs text-[#13251D]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {formData.clinicIntroduction.trim() && (
                  <div className="rounded-[4px] border border-[#DEE4D9] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-[#526175]">병원 소개</p>
                      <button onClick={() => setStep(1)} className="text-xs font-semibold text-[#36765A] hover:underline">수정</button>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-[#637167]">{formData.clinicIntroduction}</p>
                  </div>
                )}
              </div>

              {/* AI 분석 미리보기 */}
              <div className="rounded-[14px] border border-[#DEE4D9] bg-[#F4F5EF] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-brand-600" />
                  <p className="text-sm font-bold text-[#15231B]">시작하면 이런 질문을 추적합니다</p>
                </div>

                <div className="space-y-2.5">
                  {/* 자동 생성 질문 미리보기 */}
                  <div className="rounded-[4px] border border-[#DEE4D9] bg-white p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-brand-500" />
                      입력한 정보로 만든 질문 예시
                    </p>
                    <div className="space-y-1">
                      {generatePreviewQuestions(formData).slice(0, 5).map((q, i) => (
                        <p key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-[#36765A] mt-0.5">•</span>
                          <span>"{q}"</span>
                        </p>
                      ))}
                    </div>
                    <p className="text-[11px] text-brand-500 font-medium mt-2">
                      + 증상·가격·후기·공포해소 등 다양한 패턴 질문 자동 포함
                    </p>
                  </div>

                  {/* 분석 항목 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[4px] border border-[#DEE4D9] bg-white p-2.5 text-center">
                      <BarChart3 className="h-5 w-5 text-brand-500 mx-auto mb-1" />
                      <p className="text-[11px] font-medium text-slate-700">6개 AI 플랫폼</p>
                      <p className="text-[10px] text-slate-400">ChatGPT·Perplexity·Claude·Gemini·Grok·CLOVA X</p>
                    </div>
                    <div className="rounded-[4px] border border-[#DEE4D9] bg-white p-2.5 text-center">
                      <Target className="h-5 w-5 text-green-500 mx-auto mb-1" />
                      <p className="text-[11px] font-medium text-slate-700">SoV 점수 산출</p>
                      <p className="text-[10px] text-slate-400">Voice Share 기반 가시성</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="w-[100px]" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button
                  className="flex-1 bg-[#36765A] hover:bg-[#13251D] text-white"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      분석 시작 중...
                    </>
                  ) : (
                    <>
                      AI 분석 시작하기 <Sparkles className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-center text-[11px] text-slate-400">
                14일 무료 체험 · 신용카드 불필요
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * 미리보기용 질문 생성 (7가지 의도 기반)
 */
function generatePreviewQuestions(formData: {
  specialtyType: string;
  regionSigungu: string;
  regionDong?: string;
  coreTreatments: string[];
  targetRegions: string[];
}) {
  const specialtyNames: Record<string, string> = {
    DENTAL: '치과', DERMATOLOGY: '피부과', PLASTIC_SURGERY: '성형외과',
    ORTHOPEDICS: '정형외과', KOREAN_MEDICINE: '한의원', OPHTHALMOLOGY: '안과',
    INTERNAL_MEDICINE: '내과', UROLOGY: '비뇨의학과', ENT: '이비인후과',
    PSYCHIATRY: '정신건강의학과', OBSTETRICS: '산부인과', PEDIATRICS: '소아청소년과',
    OTHER: '병원',
  };
  const name = specialtyNames[formData.specialtyType] || '병원';
  const region = formData.regionSigungu?.replace(/[시군구]$/, '') || '지역';
  const t0 = formData.coreTreatments[0];
  const t1 = formData.coreTreatments[1];
  const r0 = formData.targetRegions[0];
  const questions: string[] = [];

  // ① 추천 탐색
  if (t0) {
    questions.push(`${r0 || region}에서 ${t0} 잘하는 ${name} 추천해줘`);
    questions.push(`${t0} 전문 ${name} ${region} 근처에 있어?`);
  } else {
    questions.push(`${region} ${name} 추천해줘`);
  }

  // ② 비교
  if (t0 && t1) {
    questions.push(`${t0}이랑 ${t1} 같이 하려는데 ${region} ${name} 어디가 좋아?`);
  } else {
    questions.push(`${region} ${name} 비교해서 알려줘`);
  }

  // ③ 가격
  if (t0) {
    questions.push(`${region} ${t0} 가격 합리적인 ${name} 추천해줘`);
  }

  // ④ 후기
  questions.push(`${region} ${name} 후기 좋은 곳 알려줘`);

  // ⑤ 조건
  questions.push(`${region} ${name} 야간 진료 되는 곳 있어?`);

  // ⑥ 지역 특화
  if (r0 && t0) {
    questions.push(`${r0} 근처 ${t0} 잘하는 ${name} 있어?`);
  }

  return Array.from(new Set(questions));
}
