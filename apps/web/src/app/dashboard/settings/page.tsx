'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hospitalApi, queryTemplatesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Settings,
  Building,
  MapPin,
  Globe,
  CreditCard,

  Shield,
  Loader2,
  Save,
  Sparkles,
  Check,
  Zap,
  Crown,
  Stethoscope,
  RefreshCw,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { toast } from '@/hooks/useToast';

const specialtyNames: Record<string, string> = {
  DENTAL: '치과', DERMATOLOGY: '피부과', PLASTIC_SURGERY: '성형외과',
  ORTHOPEDICS: '정형외과', KOREAN_MEDICINE: '한의원', OPHTHALMOLOGY: '안과',
  INTERNAL_MEDICINE: '내과', UROLOGY: '비뇨기과', ENT: '이비인후과',
  PSYCHIATRY: '정신건강의학과', OBSTETRICS: '산부인과', PEDIATRICS: '소아과', OTHER: '기타',
};

const intentNames: Record<string, string> = {
  RESERVATION: '예약 의도', COMPARISON: '비교 의도', INFORMATION: '정보 탐색',
  REVIEW: '후기/리뷰', FEAR: '공포/걱정',
};

const intentColors: Record<string, string> = {
  RESERVATION: 'bg-blue-100 text-blue-800', COMPARISON: 'bg-purple-100 text-purple-800',
  INFORMATION: 'bg-gray-100 text-gray-800', REVIEW: 'bg-green-100 text-green-800',
  FEAR: 'bg-red-100 text-red-800',
};

const intentWeights: Record<string, number> = {
  RESERVATION: 1.5, REVIEW: 1.3, FEAR: 1.2, COMPARISON: 1.1, INFORMATION: 1.0,
};

// 요금제 정보
const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 120000,
    priceText: '12만원/월',
    description: '기본 AI 가시성 모니터링',
    features: [
      '모니터링 질문 5개',
      '2개 AI 플랫폼 (Perplexity, Gemini)',
      '월 4회 크롤링 (주 1회)',
      '경쟁사 1개 비교 분석',
      'ABHS 점수',
      '주간 리포트',
    ],
    notIncluded: [
      'ChatGPT / Claude 분석',
      'AI 질문 변형 생성',
      'Content Gap 분석',
      '데이터 내보내기',
    ],
    isPopular: false,
    badge: '',
  },
  {
    id: 'STANDARD',
    name: 'Standard',
    price: 290000,
    priceText: '29만원/월',
    description: '개원의를 위한 핵심 플랜',
    features: [
      '모니터링 질문 15개',
      '4개 AI 플랫폼 (ChatGPT, Claude, Perplexity, Gemini)',
      '월 8회 크롤링 (주 2회)',
      'ABHS 점수',
      '주간 리포트',
      '경쟁사 5개 비교 분석',
      'AI 질문 변형 생성',
      '경쟁사 AEO 측정',
      '자동 액션 인텔리전스',
      '데이터 내보내기',
    ],
    notIncluded: [
      'Content Gap 분석',
    ],
    isPopular: true,
    badge: '인기',
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 590000,
    priceText: '59만원/월',
    description: '데이터 드리븐 원장을 위한 프로 플랜',
    features: [
      '모니터링 질문 35개',
      '4개 AI 플랫폼 (ChatGPT, Claude, Perplexity, Gemini)',
      '매일 크롤링 (월 30회)',
      'ABHS 점수',
      '주간 + 월간 딥리포트',
      '경쟁사 10개 비교 분석',
      'AI 질문 변형 생성',
      '경쟁사 AEO 측정',
      'Content Gap 분석',
      '자동 액션 인텔리전스',
      '데이터 내보내기',
      '우선 지원',
    ],
    notIncluded: [],
    isPopular: false,
    badge: 'Pro',
  },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [showQueryPreview, setShowQueryPreview] = useState(false);

  // 병원 정보 조회
  const { data: hospital, isLoading } = useQuery({
    queryKey: ['hospital', hospitalId],
    queryFn: () => hospitalApi.get(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 진료과별 시술 목록
  const { data: procedures } = useQuery({
    queryKey: ['procedures', hospital?.specialtyType],
    queryFn: () => queryTemplatesApi.getSpecialtyProcedures(hospital!.specialtyType).then((res) => res.data),
    enabled: !!hospital?.specialtyType,
  });

  // 쿼리 미리보기
  const { data: queryPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['queryPreview', hospital?.regionSido, hospital?.regionSigungu, hospital?.specialtyType, selectedProcedures],
    queryFn: () => queryTemplatesApi.previewQueries({
      region: `${hospital!.regionSido} ${hospital!.regionSigungu}`,
      specialtyType: hospital!.specialtyType,
      procedures: selectedProcedures,
    }).then((res) => res.data),
    enabled: !!hospital && selectedProcedures.length > 0 && showQueryPreview,
  });

  const [formData, setFormData] = useState({
    name: '', address: '', websiteUrl: '', naverPlaceId: '',
  });

  useEffect(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || '', address: hospital.address || '',
        websiteUrl: hospital.websiteUrl || '', naverPlaceId: hospital.naverPlaceId || '',
      });
      if (hospital.keyProcedures?.length > 0) {
        setSelectedProcedures(hospital.keyProcedures);
      }
    }
  }, [hospital]);

  // 병원 정보 업데이트
  const updateMutation = useMutation({
    mutationFn: (data: any) => hospitalApi.update(hospitalId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      setIsEditing(false);
      toast.success('병원 정보가 업데이트되었습니다.');
    },
  });

  // 쿼리 자동 생성
  const generateMutation = useMutation({
    mutationFn: () => queryTemplatesApi.generateQueries(hospitalId!, hospital?.planType === 'PRO' ? true : false),
    onSuccess: (res) => {
      toast.success(`${res.data.created}개의 모니터링 쿼리가 생성되었습니다!`);
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });

  // 시술 선택 토글
  const toggleProcedure = (name: string) => {
    setSelectedProcedures(prev => {
      if (prev.includes(name)) return prev.filter(p => p !== name);
      if (prev.length >= 3) { toast.warning('핵심 시술은 최대 3개까지 선택 가능합니다.'); return prev; }
      return [...prev, name];
    });
  };

  // 시술 저장 + 쿼리 생성
  const handleSaveProcedures = async () => {
    if (selectedProcedures.length === 0) { toast.warning('최소 1개의 핵심 시술을 선택해주세요.'); return; }
    await hospitalApi.update(hospitalId!, { keyProcedures: selectedProcedures });
    queryClient.invalidateQueries({ queryKey: ['hospital'] });
    generateMutation.mutate();
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="설정" description="병원 및 계정 설정을 관리합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">병원 등록이 필요합니다</h3>
              <p className="text-gray-500 mb-4">설정을 관리하려면 먼저 병원 정보를 등록해주세요.</p>
              <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen">
      <Header title="설정" description="병원 설정, 핵심 시술 관리, 요금제를 관리합니다" />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* ==================== 병원 정보 ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> 병원 정보</CardTitle>
            <CardDescription>기본 병원 정보를 관리합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>병원명</Label>
                <Input value={isEditing ? formData.name : hospital?.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={!isEditing} />
              </div>
              <div>
                <Label>진료과목</Label>
                <Input value={specialtyNames[hospital?.specialtyType] || hospital?.specialtyType || ''} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>지역</Label>
                <Input value={`${hospital?.regionSido || ''} ${hospital?.regionSigungu || ''}`} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>상세 주소</Label>
                <Input value={isEditing ? formData.address : hospital?.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={!isEditing} placeholder="상세 주소 입력" />
              </div>
              <div>
                <Label>웹사이트</Label>
                <Input value={isEditing ? formData.websiteUrl : hospital?.websiteUrl || ''} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} disabled={!isEditing} placeholder="https://example.com" />
              </div>
              <div>
                <Label>네이버 플레이스 ID</Label>
                <Input value={isEditing ? formData.naverPlaceId : hospital?.naverPlaceId || ''} onChange={(e) => setFormData({ ...formData, naverPlaceId: e.target.value })} disabled={!isEditing} placeholder="네이버 플레이스 ID" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>취소</Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    저장
                  </Button>
                </>
              ) : (
                <Button onClick={() => { setFormData({ name: hospital?.name || '', address: hospital?.address || '', websiteUrl: hospital?.websiteUrl || '', naverPlaceId: hospital?.naverPlaceId || '' }); setIsEditing(true); }}>
                  수정
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ==================== 핵심 시술 설정 + 쿼리 자동 생성 ==================== */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-600" />
              핵심 시술 설정
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">중요</span>
            </CardTitle>
            <CardDescription>
              핵심 시술 최대 3개를 선택하면 {hospital?.planType === 'PRO' ? '34' : '14'}개의 AI 모니터링 쿼리가 자동 생성됩니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 현재 선택된 시술 */}
            {selectedProcedures.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">선택된 시술:</span>
                {selectedProcedures.map((proc) => (
                  <span key={proc} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> {proc}
                  </span>
                ))}
                <span className="text-xs text-gray-400">
                  → {selectedProcedures.length * (hospital?.planType === 'PRO' ? 34 : 14)}개 쿼리 생성
                </span>
              </div>
            )}

            {/* 시술 선택 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(procedures || []).map((proc: any) => {
                const isSelected = selectedProcedures.includes(proc.name);
                return (
                  <button
                    key={proc.name}
                    onClick={() => toggleProcedure(proc.name)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                        {proc.name}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {proc.isPopular && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">인기</span>
                      )}
                      <span className="text-xs text-gray-400">{proc.category === 'core' ? '핵심' : proc.category === 'cosmetic' ? '미용' : '일반'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowQueryPreview(!showQueryPreview); if (!showQueryPreview) refetchPreview(); }}
                disabled={selectedProcedures.length === 0}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showQueryPreview ? '미리보기 닫기' : '생성될 쿼리 미리보기'}
              </Button>
              <Button
                onClick={handleSaveProcedures}
                disabled={selectedProcedures.length === 0 || generateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                시술 저장 & 쿼리 자동 생성
              </Button>
            </div>

            {/* 쿼리 미리보기 */}
            {showQueryPreview && queryPreview && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-100 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-gray-800">
                    생성될 쿼리 ({queryPreview.total}개)
                  </h4>
                </div>
                <div className="space-y-2">
                  {queryPreview.queries?.slice(0, 30).map((q: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${intentColors[q.intent] || 'bg-gray-100'}`}>
                        {intentNames[q.intent] || q.intent}
                        {intentWeights[q.intent] > 1 && ` ×${intentWeights[q.intent]}`}
                      </span>
                      <span className="text-gray-600">{q.query}</span>
                      {q.platform && (
                        <span className="text-xs text-gray-400 flex-shrink-0">[{q.platform}]</span>
                      )}
                    </div>
                  ))}
                  {queryPreview.total > 30 && (
                    <p className="text-xs text-gray-400 text-center pt-2">... 외 {queryPreview.total - 30}개</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==================== 요금제 ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              요금제
            </CardTitle>
            <CardDescription>
              "AI 시대, 우리 병원이 AI에게 어떻게 추천되는지 원장님은 알아야 합니다"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = (
                  plan.id === (hospital?.planType || 'STARTER')
                );
                const isActiveSub = hospital?.subscriptionStatus === 'ACTIVE' || hospital?.subscriptionStatus === 'TRIAL';
                return (
                  <div
                    key={plan.id}
                    className={`relative p-5 rounded-xl border-2 transition-all ${
                      plan.isPopular
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : isCurrent && isActiveSub
                        ? 'border-green-500 bg-green-50/30'
                        : 'border-gray-200'
                    }`}
                  >
                    {plan.isPopular && !isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    )}
                    {isCurrent && isActiveSub && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        현재 플랜
                      </span>
                    )}

                    <div className="text-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-3xl font-bold mt-2">
                        {plan.priceText}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                      {plan.notIncluded.map((feature, idx) => (
                        <li key={`no-${idx}`} className="flex items-start gap-2 text-sm opacity-40">
                          <span className="h-4 w-4 flex-shrink-0 mt-0.5 text-center">-</span>
                          <span className="text-gray-400 line-through">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrent && isActiveSub ? 'outline' : plan.isPopular ? 'default' : 'outline'}
                      disabled={isCurrent && isActiveSub}
                      onClick={() => {
                        if (!(isCurrent && isActiveSub)) {
                          window.location.href = `/dashboard/billing?plan=${plan.id}`;
                        }
                      }}
                    >
                      {isCurrent && isActiveSub ? '현재 이용 중' : '시작하기'}
                    </Button>

                    <p className="text-xs text-center text-gray-400 mt-2">
                      쿠폰 코드가 있으신가요?{' '}
                      <a href={`/dashboard/billing?plan=${plan.id}&coupon=true`} className="text-blue-500 underline">
                        쿠폰 적용
                      </a>
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ==================== 계정 보안 ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> 계정 보안</CardTitle>
            <CardDescription>비밀번호 및 보안 설정을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">이메일</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <Button variant="outline" size="sm" disabled>변경</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">비밀번호</p>
                  <p className="text-sm text-gray-500">********</p>
                </div>
                <Button variant="outline" size="sm">변경</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
