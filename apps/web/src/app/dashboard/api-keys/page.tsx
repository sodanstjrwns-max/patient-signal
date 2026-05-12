'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiKeyApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Code,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  BookOpen,
} from 'lucide-react';
import { toast } from '@/hooks/useToast';

export default function ApiKeysPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const hospitalId = user?.hospitalId;

  const [keyName, setKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // API Key 목록 조회
  const { data, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiKeyApi.list().then(res => res.data),
    enabled: !!hospitalId,
  });

  // API Key 발급
  const createMutation = useMutation({
    mutationFn: (name: string) => apiKeyApi.create({ name: name || '내 API Key' }),
    onSuccess: (res) => {
      setNewlyCreatedKey(res.data.key);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API Key가 발급되었습니다! 반드시 복사해두세요.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'API Key 발급에 실패했습니다');
    },
  });

  // API Key 삭제
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => apiKeyApi.revoke(keyId),
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API Key가 비활성화되었습니다');
    },
    onError: (err: any) => {
      setDeletingId(null);
      toast.error(err.response?.data?.message || '삭제에 실패했습니다');
    },
  });

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) setCopiedKeyId(id);
      toast.success('클립보드에 복사되었습니다');
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="API 연동" description="외부 서비스에 내 병원 AEO 데이터를 연동합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Key className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">병원 등록이 필요합니다</h3>
              <p className="text-slate-500 mb-4">API Key를 발급받으려면 먼저 병원 정보를 등록해주세요.</p>
              <Button onClick={() => window.location.href = '/onboarding'}>병원 등록하기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const keys = data?.keys || [];
  const meta = data?.meta || { total: 0, active: 0, maxAllowed: 3, remaining: 3 };

  return (
    <div className="min-h-screen">
      <Header title="API 연동" description="외부 서비스에 내 병원의 AI 가시성 데이터를 연동합니다" />

      <div className="p-6 space-y-6 max-w-5xl">

        {/* ==================== 새로 발급된 키 알림 ==================== */}
        {newlyCreatedKey && (
          <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-amber-900 mb-1">
                    🔑 API Key가 발급되었습니다
                  </h3>
                  <p className="text-sm text-amber-700 mb-3">
                    이 키는 <strong>지금 이 화면에서만</strong> 확인할 수 있습니다. 안전한 곳에 반드시 복사해두세요.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-amber-200">
                    <code className="flex-1 text-sm font-mono text-slate-800 break-all select-all">
                      {newlyCreatedKey}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(newlyCreatedKey, 'new')}
                      className="flex-shrink-0"
                    >
                      {copiedKeyId === 'new' ? (
                        <><Check className="h-4 w-4 mr-1" /> 복사됨</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> 복사</>
                      )}
                    </Button>
                  </div>
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="mt-3 text-xs text-amber-600 hover:text-amber-800 underline"
                  >
                    확인했습니다, 닫기
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ==================== API Key 발급 ==================== */}
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-indigo-600" />
              API Key 발급
            </CardTitle>
            <CardDescription>
              외부 서비스(Patient Pulse, 병원 홈페이지 등)에서 내 병원 AEO 데이터를 조회할 수 있는 키를 발급합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  키 이름 (선택)
                </label>
                <Input
                  placeholder="예: Patient Pulse 연동, 홈페이지 위젯"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      createMutation.mutate(keyName);
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate(keyName)}
                disabled={createMutation.isPending || meta.remaining <= 0}
                className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                API Key 발급
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              병원당 최대 {meta.maxAllowed}개 · 현재 {meta.active}개 사용 중 · {meta.remaining}개 남음
            </p>
          </CardContent>
        </Card>

        {/* ==================== 발급된 키 목록 ==================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              발급된 API Key
            </CardTitle>
            <CardDescription>
              발급된 키의 사용 현황을 확인하고 관리합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">아직 발급된 API Key가 없습니다</p>
                <p className="text-sm text-slate-400 mt-1">위에서 키를 발급해주세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((key: any) => (
                  <div
                    key={key.id}
                    className={`p-4 rounded-xl border transition-all ${
                      key.isActive
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-100 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 text-sm">{key.name}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            key.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {key.isActive ? '활성' : '비활성'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <code className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {key.keyPrefix}••••••••
                          </code>
                          <button
                            onClick={() => copyToClipboard(key.keyPrefix + '••••••••', key.id)}
                            className="text-slate-400 hover:text-slate-600"
                            title="프리픽스 복사"
                          >
                            {copiedKeyId === key.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {key.usageCount.toLocaleString()}회 사용
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {key.lastUsedAt
                              ? `마지막 사용: ${new Date(key.lastUsedAt).toLocaleDateString('ko-KR')}`
                              : '미사용'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {key.rateLimitPerMin}req/min
                          </span>
                        </div>
                      </div>
                      {key.isActive && (
                        <div>
                          {deletingId === key.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">정말 삭제?</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeMutation.mutate(key.id)}
                                disabled={revokeMutation.isPending}
                                className="h-7 px-2 text-xs"
                              >
                                {revokeMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : '삭제'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeletingId(null)}
                                className="h-7 px-2 text-xs"
                              >
                                취소
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingId(key.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              삭제
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==================== API 사용 가이드 ==================== */}
        <Card className="border-slate-200">
          <CardHeader>
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-slate-600" />
                  API 사용 가이드
                </CardTitle>
                <CardDescription>
                  외부 서비스에서 데이터를 가져오는 방법
                </CardDescription>
              </div>
              <div className={`transition-transform ${showDocs ? 'rotate-180' : ''}`}>
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </CardHeader>
          {showDocs && (
            <CardContent className="pt-0 space-y-6">
              {/* Base URL */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">📡 Base URL</h4>
                <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl">
                  <code className="text-sm font-mono text-green-400 flex-1">
                    https://patient-signal.onrender.com/api/public/v1
                  </code>
                  <button
                    onClick={() => copyToClipboard('https://patient-signal.onrender.com/api/public/v1', 'base')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKeyId === 'base' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 인증 방법 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">🔐 인증 방법</h4>
                <p className="text-sm text-slate-600 mb-2">
                  모든 API 요청에 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code> 헤더를 포함합니다.
                  키에 연결된 병원의 데이터만 자동으로 반환됩니다.
                </p>
                <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto">
                  <pre className="text-sm font-mono text-slate-300">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  https://patient-signal.onrender.com/api/public/v1/my/aeo-status`}
                  </pre>
                </div>
              </div>

              {/* 엔드포인트 목록 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">📋 엔드포인트</h4>
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/my/aeo-status', desc: '현재 AEO 점수, 순위, 뱃지, 플랫폼별 요약' },
                    { method: 'GET', path: '/my/score-history?days=30', desc: '일별 점수 추이 (최대 90일)' },
                    { method: 'GET', path: '/my/platform-breakdown', desc: 'ChatGPT/Claude/Gemini/Perplexity별 상세' },
                    { method: 'GET', path: '/my/intent-breakdown', desc: '예약/비교/정보/후기/공포 의도별 성과' },
                    { method: 'GET', path: '/my/competitors', desc: '경쟁사 비교 분석' },
                    { method: 'GET', path: '/rankings?limit=20', desc: '전체 병원 랭킹 (필터 가능)' },
                  ].map((ep) => (
                    <div key={ep.path} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-700 flex-shrink-0 mt-0.5">
                        {ep.method}
                      </span>
                      <div className="min-w-0 flex-1">
                        <code className="text-xs font-mono text-indigo-600">{ep.path}</code>
                        <p className="text-xs text-slate-500 mt-0.5">{ep.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 응답 예시 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">💡 응답 예시 — /my/aeo-status</h4>
                <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto">
                  <pre className="text-xs font-mono text-slate-300">
{`{
  "hospital": {
    "id": "uuid",
    "name": "서울비디치과의원",
    "specialty": "DENTAL",
    "region": "충청남도 천안시 서북구"
  },
  "score": {
    "current": 69,
    "change": +2,
    "weekAverage": 68,
    "monthAverage": 65
  },
  "ranking": { "rank": 5, "total": 65, "percentile": 8 },
  "platforms": { "claude": 64, "chatgpt": 36, ... },
  "badge": "GOLD"
}`}
                  </pre>
                </div>
              </div>

              {/* 보안 주의사항 */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 mb-1">보안 주의사항</p>
                    <ul className="text-red-700 space-y-1 text-xs">
                      <li>• API Key는 <strong>서버 사이드</strong>에서만 사용하세요 (환경변수 권장)</li>
                      <li>• 프론트엔드 JavaScript에 키를 직접 넣지 마세요</li>
                      <li>• 키가 노출되면 즉시 삭제하고 새로 발급받으세요</li>
                      <li>• Rate Limit: 분당 60회 요청 제한</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
