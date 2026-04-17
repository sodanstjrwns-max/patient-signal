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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    coreTreatments: [] as string[],
    targetRegions: [] as string[],
    competitorNames: [] as string[],
    hospitalStrengths: [] as string[],
  });

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
    if (trimmed && !formData.competitorNames.includes(trimmed) && formData.competitorNames.length < 5) {
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
      };
      const { data } = await hospitalApi.create(cleanData);
      updateUser({ hospitalId: data.id, hospital: data });
      
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
              <Search className="h-10 w-10 text-blue-600 animate-bounce" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            AI 분석을 시작합니다
          </h2>
          <p className="text-gray-500 mb-6">
            {formData.name}의 AI 검색 가시성을<br />
            4개 플랫폼에서 자동으로 확인합니다
          </p>
          <div className="space-y-3">
            {['모니터링 질문 자동 생성 중...', '4개 AI 플랫폼 연결 중...', '대시보드 준비 중...'].map((text, i) => (
              <div key={i} className="flex items-center gap-3 justify-center text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {step === 1 && '병원 정보 등록'}
            {step === 2 && '주력 진료 설정'}
            {step === 3 && 'AI 분석 시작'}
          </CardTitle>
          <CardDescription>
            {step === 1 && '3분이면 AI가 우리 병원을 어떻게 추천하는지 확인할 수 있습니다'}
            {step === 2 && '환자가 AI에 검색할 때 쓰는 핵심 키워드를 선택해주세요'}
            {step === 3 && '입력하신 정보를 바탕으로 AI 모니터링을 시작합니다'}
          </CardDescription>
          
          {/* Progress Bar */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-300 ${
                  s < step 
                    ? 'bg-blue-600 text-white' 
                    : s === step 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {s < step ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < TOTAL_STEPS && (
                  <div className={`w-12 h-1 rounded-full transition-all duration-300 ${
                    s < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-2 max-w-[280px] mx-auto">
            <span>기본 정보</span>
            <span>주력 진료</span>
            <span>분석 시작</span>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* ═══ Step 1: 기본 정보 (병원명 + 진료과 + 위치) ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 병원명 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  병원명
                </label>
                <Input
                  placeholder="예: 서울비디치과의원"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* 진료과목 - 13개 전체 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  진료과목
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {visibleSpecialties.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, specialtyType: option.value, coreTreatments: [] })}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        formData.specialtyType === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <p className="text-[11px] mt-0.5 font-medium">{option.label}</p>
                    </button>
                  ))}
                </div>
                {!showAllSpecialties && (
                  <button 
                    type="button"
                    onClick={() => setShowAllSpecialties(true)}
                    className="w-full text-center text-xs text-blue-600 hover:text-blue-700 py-1 flex items-center justify-center gap-1"
                  >
                    <ChevronDown className="h-3 w-3" />
                    전체 진료과 보기 (+7개)
                  </button>
                )}
              </div>

              {/* 위치 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  병원 위치
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.regionSido}
                    onChange={(e) => setFormData({ ...formData, regionSido: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">시/도 선택</option>
                    {SIDO_LIST.map(sido => (
                      <option key={sido} value={sido}>{sido}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="시/군/구 (강남구)"
                    value={formData.regionSigungu}
                    onChange={(e) => setFormData({ ...formData, regionSigungu: e.target.value })}
                    required
                  />
                </div>
                <Input
                  placeholder="동/읍/면 (역삼동) - 선택"
                  value={formData.regionDong}
                  onChange={(e) => setFormData({ ...formData, regionDong: e.target.value })}
                />
              </div>

              {/* 웹사이트 URL (선택) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  병원 웹사이트
                  <span className="text-xs text-gray-400 font-normal">(선택)</span>
                </label>
                <Input
                  placeholder="https://www.example.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
                <p className="text-[11px] text-gray-400">
                  입력하시면 AI가 병원 웹사이트를 인용하는지도 추적합니다
                </p>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500"
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
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  주력 진료 / 시술
                  <span className="text-xs text-gray-400 font-normal">(1~10개 선택)</span>
                </label>
                <div className="bg-blue-50 rounded-lg p-3 mb-2">
                  <p className="text-xs text-blue-700">
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
                      onClick={() => handleTreatmentToggle(treatment)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        formData.coreTreatments.includes(treatment)
                          ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
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
                    placeholder="직접 입력 (예: 투명교정)"
                    value={customTreatment}
                    onChange={(e) => setCustomTreatment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTreatment())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCustomTreatment}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.coreTreatments.length > 0 && (
                  <p className="text-xs text-blue-600 font-medium">
                    ✓ {formData.coreTreatments.length}개 선택됨
                    {formData.coreTreatments.length >= 10 && ' (최대)'}
                  </p>
                )}
              </div>

              {/* 병원 강점 */}
              <div className="border-t pt-4 space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  우리 병원 강점
                  <span className="text-xs text-gray-400 font-normal">(선택, 복수 가능)</span>
                </label>
                <p className="text-xs text-gray-500">
                  강점 키워드에 맞는 AI 모니터링 질문이 추가됩니다
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getStrengthOptions(formData.specialtyType).map((strength) => (
                    <button
                      key={strength}
                      type="button"
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
                          ? 'border-yellow-500 bg-yellow-500 text-white shadow-sm'
                          : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
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
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  경쟁 병원
                  <span className="text-xs text-gray-400 font-normal">(선택, 최대 5개)</span>
                </label>
                <p className="text-xs text-gray-500">
                  AI가 우리 대신 추천하는 경쟁 병원을 자동으로 추적합니다
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="경쟁 병원명 (예: ABC의원)"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                    disabled={formData.competitorNames.length >= 5}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleAddCompetitor}
                    disabled={formData.competitorNames.length >= 5 || !competitorInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.competitorNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.competitorNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 text-sm rounded-full border border-orange-200"
                      >
                        {name}
                        <button onClick={() => handleRemoveCompetitor(name)}>
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500"
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
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{formData.name}</p>
                      <p className="text-sm text-gray-600">
                        {specialtyOptions.find(o => o.value === formData.specialtyType)?.icon}{' '}
                        {specialtyOptions.find(o => o.value === formData.specialtyType)?.label}
                        {' · '}📍 {formData.regionSido} {formData.regionSigungu} {formData.regionDong}
                      </p>
                    </div>
                    <button 
                      onClick={() => setStep(1)} 
                      className="text-xs text-blue-600 hover:underline"
                    >
                      수정
                    </button>
                  </div>
                </div>

                {formData.coreTreatments.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1.5 font-medium">🎯 주력 진료 ({formData.coreTreatments.length}개)</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.coreTreatments.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI 분석 미리보기 */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-bold text-blue-800">시작하면 이렇게 분석됩니다</p>
                </div>
                
                <div className="space-y-2.5">
                  {/* 자동 생성 질문 미리보기 */}
                  <div className="bg-white/80 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-blue-500" />
                      자동 생성될 모니터링 질문 예시
                    </p>
                    <div className="space-y-1">
                      {generatePreviewQuestions(formData).slice(0, 5).map((q, i) => (
                        <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>"{q}"</span>
                        </p>
                      ))}
                    </div>
                    <p className="text-[11px] text-blue-500 font-medium mt-2">
                      + 증상·가격·후기·공포해소 등 다양한 패턴 질문 자동 포함
                    </p>
                  </div>

                  {/* 분석 항목 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/80 rounded-lg p-2.5 text-center">
                      <BarChart3 className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                      <p className="text-[11px] font-medium text-gray-700">4개 AI 플랫폼</p>
                      <p className="text-[10px] text-gray-400">ChatGPT·Perplexity·Claude·Gemini</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2.5 text-center">
                      <Target className="h-5 w-5 text-green-500 mx-auto mb-1" />
                      <p className="text-[11px] font-medium text-gray-700">SoV 점수 산출</p>
                      <p className="text-[10px] text-gray-400">Voice Share 기반 가시성</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="w-[100px]" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25" 
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

              <p className="text-center text-[11px] text-gray-400">
                7일 무료 체험 · 신용카드 불필요 · 언제든 취소 가능
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
