'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { competitorsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Plus,
  Trash2,
  Users,
  Sparkles,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Building,
  MapPin,
} from 'lucide-react';

export default function CompetitorsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 경쟁사 목록 조회
  const { data: competitors, isLoading } = useQuery({
    queryKey: ['competitors', hospitalId],
    queryFn: () => competitorsApi.list(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 경쟁사 비교 데이터
  const { data: comparison } = useQuery({
    queryKey: ['comparison', hospitalId],
    queryFn: () => competitorsApi.getComparison(hospitalId!).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 경쟁사 추가
  const addMutation = useMutation({
    mutationFn: () =>
      competitorsApi.add(hospitalId!, {
        competitorName: newCompetitor,
        competitorRegion: newRegion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
      setNewCompetitor('');
      setNewRegion('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '경쟁사 추가에 실패했습니다.');
    },
  });

  // 경쟁사 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: string) => competitorsApi.remove(id, hospitalId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
    },
  });

  // AI 자동 감지
  const autoDetectMutation = useMutation({
    mutationFn: () => competitorsApi.autoDetect(hospitalId!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] });
      const count = response.data?.detected?.length || 0;
      alert(`AI가 ${count}개의 경쟁사를 발견했습니다!`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '자동 감지에 실패했습니다.');
    },
  });

  const handleAddCompetitor = () => {
    if (!newCompetitor.trim()) return;
    addMutation.mutate();
  };

  const filteredCompetitors = competitors?.filter((c: any) =>
    c.competitorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScoreTrend = (competitor: any) => {
    const compData = comparison?.competitors?.find(
      (c: any) => c.name === competitor.competitorName
    );
    if (!compData) return null;
    
    const myScore = comparison?.myHospital?.score || 0;
    const diff = myScore - compData.score;
    
    if (diff > 5) return { icon: <TrendingUp className="h-4 w-4 text-green-500" />, text: '우위' };
    if (diff < -5) return { icon: <TrendingDown className="h-4 w-4 text-red-500" />, text: '열세' };
    return { icon: <Minus className="h-4 w-4 text-gray-400" />, text: '비슷' };
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="경쟁사 관리" description="경쟁사를 추가하고 비교합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                경쟁사를 관리하려면 먼저 병원 정보를 등록해주세요.
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
      <Header title="경쟁사 관리" description="경쟁사를 추가하고 비교 분석합니다" />

      <div className="p-6 space-y-6">
        {/* 경쟁사 추가 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              경쟁사 추가
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="경쟁 병원 이름"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="지역 (선택)"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                className="w-40"
              />
              <Button
                onClick={handleAddCompetitor}
                disabled={addMutation.isPending || !newCompetitor.trim()}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                추가
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="outline"
                onClick={() => autoDetectMutation.mutate()}
                disabled={autoDetectMutation.isPending}
              >
                {autoDetectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                )}
                AI 자동 감지
              </Button>
              <p className="text-sm text-gray-500">
                AI가 크롤링 결과에서 자주 언급되는 경쟁사를 자동으로 찾아줍니다
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 검색 */}
        <div className="flex justify-between items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="경쟁사 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <p className="text-sm text-gray-500">
            총 {filteredCompetitors?.length || 0}개 경쟁사
          </p>
        </div>

        {/* 경쟁사 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredCompetitors?.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다' : '등록된 경쟁사가 없습니다'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    경쟁사를 추가하거나 AI 자동 감지를 사용해보세요
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredCompetitors?.map((competitor: any) => {
              const trend = getScoreTrend(competitor);
              const compScore = comparison?.competitors?.find(
                (c: any) => c.name === competitor.competitorName
              )?.score;

              return (
                <Card key={competitor.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-orange-100">
                          <Building className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {competitor.competitorName}
                          </h3>
                          {competitor.competitorRegion && (
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {competitor.competitorRegion}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('이 경쟁사를 삭제하시겠습니까?')) {
                            deleteMutation.mutate(competitor.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* 점수 비교 */}
                    {compScore !== undefined && (
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">AI 가시성 점수</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {compScore}점
                            </span>
                            {trend && (
                              <span className="flex items-center gap-1 text-sm">
                                {trend.icon}
                                <span className="text-gray-500">{trend.text}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 배지 */}
                    <div className="flex gap-2 mt-3">
                      {competitor.isAutoDetected && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          AI 감지
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        competitor.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {competitor.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* 비교 요약 */}
        {comparison && comparison.competitors?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                경쟁사 점수 비교
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 내 병원 */}
                <div className="flex items-center gap-3">
                  <div className="w-32 font-medium text-blue-600">
                    {comparison.myHospital?.name || '우리 병원'}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-blue-500 rounded-full h-4 transition-all"
                      style={{ width: `${comparison.myHospital?.score || 0}%` }}
                    />
                  </div>
                  <div className="w-12 text-right font-semibold">
                    {comparison.myHospital?.score || 0}점
                  </div>
                </div>

                {/* 경쟁사들 */}
                {comparison.competitors?.map((comp: any, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-gray-600 truncate">
                      {comp.name}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div
                        className="bg-orange-400 rounded-full h-4 transition-all"
                        style={{ width: `${comp.score || 0}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm">
                      {comp.score || 0}점
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
