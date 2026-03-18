'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, Building2, MapPin, Stethoscope, ArrowRight, ArrowLeft,
  Target, Users, Plus, X, Check, Lightbulb, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const TOTAL_STEPS = 5;

const specialtyOptions = [
  { value: 'DENTAL', label: '치과', icon: '🦷' },
  { value: 'DERMATOLOGY', label: '피부과', icon: '💆' },
  { value: 'PLASTIC_SURGERY', label: '성형외과', icon: '✨' },
  { value: 'OPHTHALMOLOGY', label: '안과', icon: '👁️' },
  { value: 'KOREAN_MEDICINE', label: '한의원', icon: '🌿' },
  { value: 'OTHER', label: '기타', icon: '🏥' },
];

// 진료과목별 추천 주력 진료
const suggestedTreatments: Record<string, string[]> = {
  DENTAL: ['임플란트', '치아교정', '라미네이트', '신경치료', '충치치료', '미백', '잇몸치료', '사랑니발치', '소아치과', '보철치료', '턱관절치료', '치아성형'],
  DERMATOLOGY: ['여드름치료', '레이저토닝', '기미잡티', '보톡스', '필러', '리프팅', '제모', '탈모치료', '아토피', '피부관리', '흉터치료', '모공치료'],
  PLASTIC_SURGERY: ['코성형', '눈성형', '안면윤곽', '지방흡입', '리프팅', '가슴성형', '쌍꺼풀', '지방이식', '턱성형', '이마성형', '보톡스', '필러'],
  OPHTHALMOLOGY: ['라식', '라섹', '스마일라식', '백내장', 'ICL렌즈삽입', '드림렌즈', '노안치료', '녹내장', '소아시력교정', '안구건조증'],
  KOREAN_MEDICINE: ['추나요법', '침치료', '한방다이어트', '교통사고치료', '디스크치료', '체형교정', '한방피부치료', '면역력강화', '한방부인과', '만성피로'],
  OTHER: ['건강검진', '내시경', '초음파', '예방접종', '만성질환관리'],
};

export default function OnboardingPage() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  
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
    // 신규 필드
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
        : [...prev.coreTreatments, treatment],
    }));
  };
  const handleAddCustomTreatment = () => {
    const trimmed = customTreatment.trim();
    if (trimmed && !formData.coreTreatments.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        coreTreatments: [...prev.coreTreatments, trimmed],
      }));
      setCustomTreatment('');
    }
  };

  // 내원 지역
  const [regionInput, setRegionInput] = useState('');
  const handleAddRegion = () => {
    const trimmed = regionInput.trim();
    if (trimmed && !formData.targetRegions.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        targetRegions: [...prev.targetRegions, trimmed],
      }));
      setRegionInput('');
    }
  };
  const handleRemoveRegion = (region: string) => {
    setFormData((prev) => ({
      ...prev,
      targetRegions: prev.targetRegions.filter((r) => r !== region),
    }));
  };

  // 경쟁 병원
  const [competitorInput, setCompetitorInput] = useState('');
  const handleAddCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !formData.competitorNames.includes(trimmed)) {
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

    try {
      const { data } = await hospitalApi.create(formData);
      updateUser({ hospitalId: data.id, hospital: data });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || '병원 등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.name && formData.specialtyType;
      case 2: return formData.regionSido && formData.regionSigungu;
      case 3: return true; // 선택사항
      case 4: return true; // 선택사항
      case 5: return true; // 확인 스텝
      default: return false;
    }
  };

  const currentSuggestions = suggestedTreatments[formData.specialtyType] || suggestedTreatments.OTHER;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">병원 정보 등록</CardTitle>
          <CardDescription>
            {step === 1 && 'AI 가시성 모니터링을 위한 기본 정보를 입력해주세요'}
            {step === 2 && '병원 위치를 알려주세요'}
            {step === 3 && '주력 진료와 환자 내원 지역을 알려주세요'}
            {step === 4 && '비교 분석할 경쟁 병원을 입력해주세요'}
            {step === 5 && '입력하신 정보를 확인해주세요'}
          </CardDescription>
          {/* Progress */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s < step ? 'w-6 bg-blue-600' : s === step ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{step} / {TOTAL_STEPS}</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* ═══ Step 1: 기본 정보 ═══ */}
          {step === 1 && (
            <div className="space-y-4">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  진료과목
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {specialtyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, specialtyType: option.value, coreTreatments: [] })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        formData.specialtyType === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{option.icon}</span>
                      <p className="text-xs mt-1">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!canProceed()}
              >
                다음 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ═══ Step 2: 위치 정보 ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  병원 위치
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="시/도 (서울특별시)"
                    value={formData.regionSido}
                    onChange={(e) => setFormData({ ...formData, regionSido: e.target.value })}
                    required
                  />
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
                <Input
                  placeholder="상세 주소 - 선택"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                >
                  다음 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 3: 주력 진료 + 내원 지역 ═══ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* 주력 진료 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  주력 진료 / 시술
                  <span className="text-xs text-gray-400 font-normal">(복수 선택)</span>
                </label>
                <div className="bg-blue-50 rounded-lg p-3 mb-2">
                  <p className="text-xs text-blue-700">
                    <Lightbulb className="inline h-3 w-3 mr-1" />
                    환자가 AI에 검색할 때 가장 많이 물어보는 진료를 선택해주세요.
                    이걸 기반으로 모니터링 질문이 자동 생성됩니다.
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
                {/* 직접 입력 */}
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
                  </p>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t pt-4">
                {/* 내원 지역 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    주요 내원 지역
                    <span className="text-xs text-gray-400 font-normal">(선택)</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    환자가 주로 어디에서 오시나요? 역세권, 동네 이름 등을 입력해주세요.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="예: 강남역, 선릉역, 역삼동"
                      value={regionInput}
                      onChange={(e) => setRegionInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRegion())}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddRegion}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.targetRegions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.targetRegions.map((region) => (
                        <span
                          key={region}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-sm rounded-full border border-green-200"
                        >
                          {region}
                          <button onClick={() => handleRemoveRegion(region)}>
                            <X className="h-3 w-3 text-green-500 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t pt-4">
                {/* 병원 강점 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    우리 병원 강점
                    <span className="text-xs text-gray-400 font-normal">(복수 선택)</span>
                  </label>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-700">
                      <Lightbulb className="inline h-3 w-3 mr-1" />
                      선택한 강점에 맞는 AI 모니터링 질문이 추가 생성됩니다.
                      예: &quot;무통치료&quot; 선택 → &quot;무통으로 치료해주는 치과 있어?&quot; 질문 자동 추가
                    </p>
                  </div>
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
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                          formData.hospitalStrengths.includes(strength)
                            ? 'border-yellow-500 bg-yellow-500 text-white shadow-sm'
                            : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                        }`}
                      >
                        {formData.hospitalStrengths.includes(strength) && (
                          <Check className="inline h-3 w-3 mr-1" />
                        )}
                        {strength}
                      </button>
                    ))}
                  </div>
                  {formData.hospitalStrengths.length > 0 && (
                    <p className="text-xs text-yellow-600 font-medium">
                      ⭐ {formData.hospitalStrengths.length}개 강점 선택됨
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)}>
                  다음 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 4: 경쟁 병원 ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  경쟁 병원
                  <span className="text-xs text-gray-400 font-normal">(최대 5개)</span>
                </label>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-orange-700">
                    <Lightbulb className="inline h-3 w-3 mr-1" />
                    AI가 우리 대신 경쟁 병원을 추천하는지 모니터링합니다.
                    가장 신경 쓰이는 경쟁 병원을 입력해주세요.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="경쟁 병원명 입력 (예: ABC치과의원)"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                    disabled={formData.competitorNames.length >= 5}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddCompetitor}
                    disabled={formData.competitorNames.length >= 5 || !competitorInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.competitorNames.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {formData.competitorNames.map((name, idx) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCompetitor(name)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">아직 등록된 경쟁 병원이 없습니다</p>
                    <p className="text-xs mt-1">나중에 대시보드에서도 추가할 수 있어요</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button className="flex-1" onClick={() => setStep(5)}>
                  다음 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 5: 확인 & 시작 ═══ */}
          {step === 5 && (
            <div className="space-y-4">
              {/* 요약 카드 */}
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">병원 정보</p>
                  <p className="font-semibold text-gray-900">{formData.name}</p>
                  <p className="text-sm text-gray-600">
                    {specialtyOptions.find(o => o.value === formData.specialtyType)?.icon}{' '}
                    {specialtyOptions.find(o => o.value === formData.specialtyType)?.label}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    📍 {formData.regionSido} {formData.regionSigungu} {formData.regionDong}
                  </p>
                </div>

                {formData.coreTreatments.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1.5">🎯 주력 진료</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.coreTreatments.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {formData.targetRegions.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1.5">📍 주요 내원 지역</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.targetRegions.map((r) => (
                        <span key={r} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {formData.competitorNames.length > 0 && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 mb-1.5">🏥 경쟁 병원</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.competitorNames.map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {formData.hospitalStrengths.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-600 mb-1.5">⭐ 병원 강점</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.hospitalStrengths.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 예상 생성 질문 미리보기 */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <p className="text-xs font-medium text-blue-700 mb-2">
                  ✨ 이 정보를 바탕으로 AI 모니터링 질문이 자동 생성됩니다
                </p>
                <div className="space-y-1.5">
                  {generatePreviewQuestions(formData).slice(0, 6).map((q, i) => (
                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className={`text-xs mt-0.5 ${
                        i < 2 ? 'text-blue-500' : i < 4 ? 'text-green-500' : 'text-orange-400'
                      }`}>•</span>
                      <span>"{q}"</span>
                    </p>
                  ))}
                  <p className="text-xs text-blue-500 font-medium mt-2">
                    + 증상/상황, 가격, 후기, 공포 해소 등 다양한 패턴 포함
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> 이전
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" 
                  onClick={handleSubmit} 
                  loading={loading}
                >
                  시작하기 <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 미리보기용 고퀄리티 질문 생성 (7가지 의도 기반)
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
    OPHTHALMOLOGY: '안과', KOREAN_MEDICINE: '한의원', OTHER: '병원',
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

  // ② 비교 평가
  if (t0 && t1) {
    questions.push(`${t0}이랑 ${t1} 같이 하려는데 ${region} ${name} 어디가 좋아?`);
  } else {
    questions.push(`${region} ${name} 비교해서 알려줘`);
  }

  // ③ 가격/비용
  if (t0) {
    questions.push(`${region} ${t0} 가격 합리적인 ${name} 추천해줘`);
  }

  // ④ 증상/상황 (진료과목별)
  const symptomMap: Record<string, string> = {
    DENTAL: `이가 너무 아픈데 ${region} ${name} 어디 가면 좋을까?`,
    DERMATOLOGY: `얼굴에 여드름이 계속 나는데 ${region} ${name} 추천해줘`,
    PLASTIC_SURGERY: `코가 낮아서 고민인데 ${region} ${name} 자연스럽게 잘하는 곳 추천해줘`,
    OPHTHALMOLOGY: `시력 나빠서 라식이나 라섹 하고 싶은데 ${region} ${name} 어디가 좋아?`,
    KOREAN_MEDICINE: `허리가 너무 아픈데 ${region} ${name} 추천해줘`,
  };
  questions.push(symptomMap[formData.specialtyType] || `${region} ${name} 잘하는 곳 알려줘`);

  // ⑥ 후기/평판
  questions.push(`${region} ${name} 후기 좋은 곳 알려줘`);

  // ⑦ 조건 필터
  questions.push(`${region} ${name} 야간 진료 되는 곳 있어?`);

  // ⑧ 내원 지역 특화
  if (r0 && t0) {
    questions.push(`${r0} 근처 ${t0} 잘하는 ${name} 있어?`);
  }

  return [...new Set(questions)];
}

/**
 * 진료과목별 병원 강점 옵션
 */
function getStrengthOptions(specialtyType: string): string[] {
  const common = ['친절', '상담꼼꼼', '가격합리적', '최신장비', '야간진료', '주말진료', '주차편리', '역세권', '경력풍부', '전문의', '대기시간짧음'];
  
  const specialtyStrengths: Record<string, string[]> = {
    DENTAL: ['무통치료', '수면치료', '소아전문', '원장직접진료', '감염관리', '디지털진료', '대학병원급'],
    DERMATOLOGY: ['자연스러운결과', '원장직접진료', '남녀전용', '피부맞춤상담', '시술후관리'],
    PLASTIC_SURGERY: ['자연스러운결과', '원장직접진료', '재수술전문', '안전마취', '사후관리'],
    OPHTHALMOLOGY: ['정밀검사', '원장직접진료', '부작용관리', '최신레이저', '사후관리'],
    KOREAN_MEDICINE: ['원장직접진료', '한양방협진', '맞춤처방', '체질분석', '통증특화'],
  };

  return [...(specialtyStrengths[specialtyType] || []), ...common];
}
