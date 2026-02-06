'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hospitalApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Settings,
  Building,
  MapPin,
  Globe,
  CreditCard,
  Bell,
  Shield,
  Loader2,
  Save,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const [isEditing, setIsEditing] = useState(false);

  // 병원 정보 조회
  const { data: hospital, isLoading } = useQuery({
    queryKey: ['hospital', hospitalId],
    queryFn: () => hospitalApi.get(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    websiteUrl: '',
    naverPlaceId: '',
  });

  // 폼 데이터 초기화
  useState(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || '',
        address: hospital.address || '',
        websiteUrl: hospital.websiteUrl || '',
        naverPlaceId: hospital.naverPlaceId || '',
      });
    }
  });

  // 병원 정보 업데이트
  const updateMutation = useMutation({
    mutationFn: (data: any) => hospitalApi.update(hospitalId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      setIsEditing(false);
      alert('병원 정보가 업데이트되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '업데이트에 실패했습니다.');
    },
  });

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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                설정을 관리하려면 먼저 병원 정보를 등록해주세요.
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="설정" description="병원 및 계정 설정을 관리합니다" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* 병원 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              병원 정보
            </CardTitle>
            <CardDescription>
              기본 병원 정보를 관리합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>병원명</Label>
                <Input
                  value={isEditing ? formData.name : hospital?.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label>진료과목</Label>
                <Input
                  value={hospital?.specialtyType || ''}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>지역</Label>
                <Input
                  value={`${hospital?.regionSido || ''} ${hospital?.regionSigungu || ''}`}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>상세 주소</Label>
                <Input
                  value={isEditing ? formData.address : hospital?.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!isEditing}
                  placeholder="상세 주소 입력"
                />
              </div>
              <div>
                <Label>웹사이트</Label>
                <Input
                  value={isEditing ? formData.websiteUrl : hospital?.websiteUrl || ''}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  disabled={!isEditing}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>네이버 플레이스 ID</Label>
                <Input
                  value={isEditing ? formData.naverPlaceId : hospital?.naverPlaceId || ''}
                  onChange={(e) => setFormData({ ...formData, naverPlaceId: e.target.value })}
                  disabled={!isEditing}
                  placeholder="네이버 플레이스 ID"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    취소
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    저장
                  </Button>
                </>
              ) : (
                <Button onClick={() => {
                  setFormData({
                    name: hospital?.name || '',
                    address: hospital?.address || '',
                    websiteUrl: hospital?.websiteUrl || '',
                    naverPlaceId: hospital?.naverPlaceId || '',
                  });
                  setIsEditing(true);
                }}>
                  수정
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 구독 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              구독 정보
            </CardTitle>
            <CardDescription>
              현재 구독 플랜과 결제 정보를 확인합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-semibold text-blue-900">
                  {hospital?.planType || 'STARTER'} 플랜
                </p>
                <p className="text-sm text-blue-700">
                  {hospital?.subscriptionStatus === 'TRIAL'
                    ? '7일 무료 체험 중'
                    : hospital?.subscriptionStatus === 'ACTIVE'
                    ? '활성 구독'
                    : '구독 필요'}
                </p>
              </div>
              <Link href="/pricing">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  플랜 변경
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 알림 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              알림 설정
            </CardTitle>
            <CardDescription>
              이메일 및 푸시 알림을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">주간 리포트</p>
                  <p className="text-sm text-gray-500">매주 AI 가시성 리포트를 이메일로 받습니다</p>
                </div>
                <Button variant="outline" size="sm">설정</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">순위 변동 알림</p>
                  <p className="text-sm text-gray-500">순위가 크게 변동되면 알림을 받습니다</p>
                </div>
                <Button variant="outline" size="sm">설정</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">경쟁사 이상 감지</p>
                  <p className="text-sm text-gray-500">경쟁사 점수가 급상승하면 알림을 받습니다</p>
                </div>
                <Button variant="outline" size="sm">설정</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 계정 보안 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              계정 보안
            </CardTitle>
            <CardDescription>
              비밀번호 및 보안 설정을 관리합니다
            </CardDescription>
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
