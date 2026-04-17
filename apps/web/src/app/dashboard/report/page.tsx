'use client';

import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import {
  useABHS,
  useCompetitiveShare,
  useActionIntelligence,
  useWeeklyScore,
  useMentionInsight,
} from '@/hooks/useQueries';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Shield,
  AlertTriangle,
  Zap,
  Target,
  PieChart,
  Activity,
  Award,
  Calendar,
  BarChart3,
  Download,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT', CLAUDE: 'Claude', PERPLEXITY: 'Perplexity', GEMINI: 'Gemini',
};
const platformColors: Record<string, string> = {
  CHATGPT: '#10A37F', CLAUDE: '#CC785C', PERPLEXITY: '#3B82F6', GEMINI: '#8B5CF6',
};
const platformWeights: Record<string, number> = {
  CHATGPT: 1.3, CLAUDE: 1.0, PERPLEXITY: 1.4, GEMINI: 1.2,
};
const intentNames: Record<string, string> = {
  reservation: '예약 의도', comparison: '비교 의도', information: '정보 탐색',
  review: '후기/리뷰', fear: '공포/걱정',
};
const intentWeights: Record<string, number> = {
  reservation: 1.5, review: 1.3, fear: 1.2, comparison: 1.1, information: 1.0,
};
const depthNames: Record<string, string> = {
  R3: '단독 추천', R2: '상위 추천', R1: '단순 언급', R0: '미언급/부정',
};
const depthColors: Record<string, string> = {
  R3: 'bg-green-500', R2: 'bg-brand-500', R1: 'bg-yellow-500', R0: 'bg-red-400',
};
const sentimentLabel = (v: number) => {
  if (v >= 1.5) return { text: '매우 긍정', color: 'text-green-600', bg: 'bg-green-50' };
  if (v >= 0.5) return { text: '긍정', color: 'text-green-500', bg: 'bg-green-50' };
  if (v >= -0.5) return { text: '중립', color: 'text-slate-500', bg: 'bg-slate-50' };
  if (v >= -1.5) return { text: '부정', color: 'text-red-500', bg: 'bg-red-50' };
  return { text: '매우 부정', color: 'text-red-600', bg: 'bg-red-50' };
};

// 주간 날짜 범위 계산
const getWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek - 6); // 지난 월요일
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // 지난 일요일
  return {
    start: start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
    end: end.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
  };
};

export default function WeeklyReportPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const weekRange = getWeekRange();

  // 【캐싱 통합 완료】공유 훅으로 교체 → 대시보드/분석 페이지와 캐시 100% 공유
  const { data: abhs, isLoading: abhsLoading } = useABHS();
  const { data: competitiveShare } = useCompetitiveShare();
  const { data: actions } = useActionIntelligence();
  const { data: weekly } = useWeeklyScore();
  const { data: mentionInsight } = useMentionInsight();

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="주간 리포트" description="AI 가시성 주간 리포트" />
        <div className="p-6">
          <Card><CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">병원 등록이 필요합니다</h3>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  if (abhsLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  const criticalActions = (actions || []).filter((a: any) => a.severity === 'critical');
  const warningActions = (actions || []).filter((a: any) => a.severity === 'warning');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="주간 ABHS 리포트" description={`${weekRange.start} ~ ${weekRange.end} · AI-Based Hospital Score`} />

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* 리포트 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-brand-200 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> 주간 리포트 · {weekRange.start} ~ {weekRange.end}
              </p>
              <h2 className="text-2xl font-bold mt-1">AI 가시성 종합 분석</h2>
            </div>
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
              <Download className="h-4 w-4 mr-1" /> PDF 다운로드
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-brand-200">ABHS 종합</p>
              <p className="text-3xl font-bold">{abhs?.abhsScore ?? 0}</p>
              <p className="text-xs text-brand-200">/100</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-brand-200">Voice Share</p>
              <p className="text-3xl font-bold">{abhs?.sovPercent ?? 0}%</p>
              <p className="text-xs text-brand-200">언급 점유율</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-brand-200">평균 감성</p>
              <p className="text-3xl font-bold">
                {(abhs?.avgSentimentV2 ?? 0) > 0 ? '+' : ''}{(abhs?.avgSentimentV2 ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-brand-200">{sentimentLabel(abhs?.avgSentimentV2 ?? 0).text}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-brand-200">경쟁 점유율</p>
              <p className="text-3xl font-bold">{competitiveShare?.mySharePercent ?? 0}%</p>
              <p className="text-xs text-brand-200">Weighted Share</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-brand-200">긴급 알림</p>
              <p className="text-3xl font-bold text-red-300">{criticalActions.length}</p>
              <p className="text-xs text-brand-200">즉시 조치 필요</p>
            </div>
          </div>
        </div>

        {/* 긴급 액션 (있는 경우) */}
        {criticalActions.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" /> 긴급 조치 필요 ({criticalActions.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalActions.map((action: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-red-200">
                    <p className="font-medium text-red-800">{action.message}</p>
                    <p className="text-sm text-red-600 mt-1">💡 {action.suggestedAction}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 플랫폼별 기여도 + 추천 깊이 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" /> 플랫폼별 ABHS 기여도
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(abhs?.platformContributions || {}).map(([platform, data]: [string, any]) => (
                  <div key={platform} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{platformNames[platform.toUpperCase()] || platform}</span>
                        <span className="text-xs text-slate-400">×{platformWeights[platform.toUpperCase()] || data.weight}</span>
                      </div>
                      <span className="font-semibold text-sm">{Math.round(data.contribution)}점</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-3">
                      <div className="rounded-full h-3 transition-all" style={{
                        width: `${Math.min(100, data.contribution)}%`,
                        backgroundColor: platformColors[platform.toUpperCase()] || '#6B7280',
                      }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>SoV {data.sovPercent}% · 깊이 {data.avgDepth}</span>
                      <span>{data.responseCount}개 응답</span>
                    </div>
                  </div>
                ))}
                {Object.keys(abhs?.platformContributions || {}).length === 0 && (
                  <p className="text-center text-slate-400 py-4">아직 데이터가 없습니다</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieChart className="h-4 w-4" /> 추천 깊이 분포
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['R3', 'R2', 'R1', 'R0'].map((depth) => {
                  const count = abhs?.depthDistribution?.[depth] ?? 0;
                  const total = Object.values(abhs?.depthDistribution || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={depth}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${depthColors[depth]}`} />
                          <span className="text-sm font-medium">{depth}</span>
                          <span className="text-xs text-slate-400">{depthNames[depth]}</span>
                        </div>
                        <span className="text-sm font-semibold">{count}건 ({percent}%)</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2">
                        <div className={`${depthColors[depth]} rounded-full h-2`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 의도별 점수 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> 질문 의도별 AI 가시성
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(abhs?.intentScores || {}).map(([intent, score]: [string, any]) => {
                const weight = intentWeights[intent] || 1.0;
                return (
                  <div key={intent} className={`p-4 rounded-2xl border ${weight > 1 ? 'border-brand-200 bg-brand-50' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{intentNames[intent] || intent}</span>
                      {weight > 1 && <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">×{weight}</span>}
                    </div>
                    <p className={`text-2xl font-bold ${score >= 60 ? 'text-green-600' : score >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {score}
                    </p>
                    <div className="bg-slate-200 rounded-full h-1.5 mt-2">
                      <div className={`rounded-full h-1.5 ${score >= 60 ? 'bg-green-500' : score >= 30 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 경쟁사 비교 */}
        {competitiveShare && competitiveShare.competitorShares?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4" /> Weighted Competitive Share
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-28 text-sm font-semibold text-brand-600">우리 병원</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-5">
                    <div className="bg-brand-500 rounded-full h-5 flex items-center justify-end pr-2" style={{ width: `${Math.max(5, competitiveShare.mySharePercent)}%` }}>
                      <span className="text-xs text-white font-medium">{competitiveShare.mySharePercent}%</span>
                    </div>
                  </div>
                  <div className="w-14 text-right text-sm font-bold">{competitiveShare.myABHS}점</div>
                </div>
                {competitiveShare.competitorShares.map((cs: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-28 text-sm text-slate-600 truncate">{cs.name}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-5">
                      <div className="bg-slate-400 rounded-full h-5 flex items-center justify-end pr-2" style={{ width: `${Math.max(5, cs.sharePercent)}%` }}>
                        <span className="text-xs text-white font-medium">{cs.sharePercent}%</span>
                      </div>
                    </div>
                    <div className="w-14 text-right text-sm">{cs.abhsEstimate}점</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 주의사항 (있는 경우) */}
        {warningActions.length > 0 && (
          <Card className="border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-yellow-700">
                <Zap className="h-4 w-4" /> 액션 인텔리전스 ({warningActions.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {warningActions.map((action: any, idx: number) => (
                  <div key={idx} className="p-3 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <p className="text-sm font-medium text-yellow-800">{action.message}</p>
                    <p className="text-xs text-yellow-600 mt-1">💡 {action.suggestedAction}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 인사이트 */}
        {weekly?.insights?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">💡 이번 주 핵심 인사이트</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {weekly.insights.map((insight: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-500 mt-0.5">•</span>
                    <span className="text-slate-600">{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 추천 키워드 요약 */}
        {mentionInsight?.recommendationKeywords?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Quote className="h-4 w-4" /> AI 추천 키워드 TOP 5
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mentionInsight.recommendationKeywords.slice(0, 5).map((kw: any) => (
                  <span key={kw.keyword} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">
                    {kw.keyword}
                    <span className="text-xs bg-brand-100 px-1.5 py-0.5 rounded-full">{kw.count}회</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 다음 단계 가이드 */}
        <Card className="border-brand-200 bg-brand-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-brand-700">
              <Lightbulb className="h-4 w-4" /> 이번 주 추천 액션
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link href="/dashboard/insights">
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-brand-100 hover:shadow-card-hover transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                    <span className="text-sm font-semibold text-slate-900">AI 인사이트 확인</span>
                  </div>
                  <p className="text-xs text-slate-500">추천 키워드와 트렌드를 분석하고 콘텐츠 갭을 파악하세요.</p>
                  <span className="text-xs text-brand-600 mt-2 inline-flex items-center gap-1">
                    바로가기 <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
              <Link href="/dashboard/analytics">
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-brand-100 hover:shadow-card-hover transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-900">ABHS 심층 분석</span>
                  </div>
                  <p className="text-xs text-slate-500">플랫폼별 기여도와 추천 깊이를 자세히 확인하세요.</p>
                  <span className="text-xs text-indigo-600 mt-2 inline-flex items-center gap-1">
                    바로가기 <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
              <Link href="/dashboard/competitors">
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-brand-100 hover:shadow-card-hover transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-semibold text-slate-900">경쟁사 비교</span>
                  </div>
                  <p className="text-xs text-slate-500">경쟁 병원 대비 포지셔닝을 점검하세요.</p>
                  <span className="text-xs text-orange-600 mt-2 inline-flex items-center gap-1">
                    바로가기 <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 리포트 푸터 */}
        <div className="text-center py-6 text-xs text-slate-400">
          <p>Patient Signal · AI-Based Hospital Score (ABHS) Weekly Report</p>
          <p className="mt-1">Perplexity ×1.4 · ChatGPT ×1.3 · Gemini ×1.2 · Claude ×1.0</p>
          <p className="mt-1">예약 ×1.5 · 후기 ×1.3 · 공포 ×1.2 · 비교 ×1.1 · 정보 ×1.0</p>
        </div>
      </div>
    </div>
  );
}
