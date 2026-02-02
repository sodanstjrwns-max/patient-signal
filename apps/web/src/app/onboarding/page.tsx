'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Building2, MapPin, Stethoscope, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const specialtyOptions = [
  { value: 'DENTAL', label: '치과', icon: '🦷' },
  { value: 'DERMATOLOGY', label: '피부과', icon: '💆' },
  { value: 'PLASTIC_SURGERY', label: '성형외과', icon: '✨' },
  { value: 'OPHTHALMOLOGY', label: '안과', icon: '👁️' },
  { value: 'KOREAN_MEDICINE', label: '한의원', icon: '🌿' },
  { value: 'OTHER', label: '기타', icon: '🏥' },
];

const dentalSubSpecialties = [
  '임플란트', '교정', '미백', '보철', '잇몸치료', '충치치료', '신경치료', '발치', '소아치과',
];

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
  });

  const handleSubSpecialtyToggle = (specialty: string) => {
    setFormData((prev) => ({
      ...prev,
      subSpecialties: prev.subSpecialties.includes(specialty)
        ? prev.subSpecialties.filter((s) => s !== specialty)
        : [...prev.subSpecialties, specialty],
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">병원 정보 등록</CardTitle>
          <CardDescription>
            AI 가시성 모니터링을 위한 병원 정보를 입력해주세요
          </CardDescription>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  병원명
                </label>
                <Input
                  placeholder="서울비디치과"
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
                      onClick={() => setFormData({ ...formData, specialtyType: option.value })}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        formData.specialtyType === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{option.icon}</span>
                      <p className="text-xs mt-1">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {formData.specialtyType === 'DENTAL' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    세부 진료과목 (복수 선택)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dentalSubSpecialties.map((specialty) => (
                      <button
                        key={specialty}
                        type="button"
                        onClick={() => handleSubSpecialtyToggle(specialty)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          formData.subSpecialties.includes(specialty)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {specialty}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.specialtyType}
              >
                다음 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: 위치 정보 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  위치 정보
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
                  이전
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep(3)}
                  disabled={!formData.regionSido || !formData.regionSigungu}
                >
                  다음 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: 추가 정보 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">웹사이트 URL (선택)</label>
                <Input
                  type="url"
                  placeholder="https://www.hospital.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">네이버 플레이스 ID (선택)</label>
                <Input
                  placeholder="12345678"
                  value={formData.naverPlaceId}
                  onChange={(e) => setFormData({ ...formData, naverPlaceId: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  네이버 지도에서 병원 검색 후 URL에서 확인할 수 있습니다
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">사업자등록번호 (선택)</label>
                <Input
                  placeholder="123-45-67890"
                  value={formData.businessNumber}
                  onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  이전
                </Button>
                <Button className="flex-1" onClick={handleSubmit} loading={loading}>
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
