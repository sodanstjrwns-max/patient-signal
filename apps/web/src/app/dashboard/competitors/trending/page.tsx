'use client';

// 【2026-09-14】요즘 AI가 좋아하는 병원 — 전 고객 병원의 AI 응답에서 언급된 병원명을 전국 단위로 합산한 리더보드.
// 내 경쟁사로 등록하지 않았어도 AI가 자주 추천하는 병원을 진료과·지역·기간으로 본다.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { competitorsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Sparkles, TrendingUp, TrendingDown, Minus, Flame, MapPin, Info, Loader2 } from 'lucide-react';

const SPECIALTIES: Array<[string, string]> = [
  ['DENTAL', '치과'], ['DERMATOLOGY', '피부과'], ['PLASTIC_SURGERY', '성형외과'], ['ORTHOPEDICS', '정형외과'], ['KOREAN_MEDICINE', '한의원'],
  ['OPHTHALMOLOGY', '안과'], ['INTERNAL_MEDICINE', '내과'], ['UROLOGY', '비뇨기과'], ['ENT', '이비인후과'], ['PSYCHIATRY', '정신건강의학과'],
  ['OBSTETRICS', '산부인과'], ['PEDIATRICS', '소아과'], ['OTHER', '기타'],
];
const SIDOS = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
const PLATFORM_KO: Record<string, string> = { CHATGPT: 'ChatGPT', CLAUDE: 'Claude', PERPLEXITY: 'Perplexity', GEMINI: 'Gemini', GROK: 'Grok', CLOVA_X: 'CLOVA X', NAVER_AI_BRIEFING: '네이버 AI' };

interface TrendRow { rank: number; name: string; mentions: number; rate: number; share: number; prevMentions: number; prevRate: number | null; deltaRate: number | null; deltaPct: number | null; askedBy: number; platforms: number; topPlatform: string | null; topSido: string | null; variants: string[]; isCustomer: boolean; customerRegion: string | null }
interface TrendData { period: { days: number; since: string; until: string }; filters: { specialty: string | null; sido: string | null; sort?: string }; totalNames: number; totalMentions: number; askingHospitals?: number; responsesTotal?: number; list: TrendRow[]; risers: TrendRow[]; method: string }

export default function TrendingPage() {
  const { user } = useAuthStore();
  const [specialty, setSpecialty] = useState<string>(user?.hospital?.specialtyType || 'DENTAL');
  const [sido, setSido] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [sort, setSort] = useState<'rate' | 'mentions' | 'hospitals'>('rate');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<TrendData>({
    queryKey: ['competitors-trending', specialty, sido, days, sort],
    queryFn: async () => (await competitorsApi.trending({ specialty: specialty || undefined, sido: sido || undefined, days, limit: 50, sort })).data,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const myKey = (user?.hospital?.name || '').replace(/\s+/g, '');
  // 직전 기간 대비: 등장률 차이(%p) 기준
  const delta = (r: TrendRow) => r.deltaRate === null
    ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><Flame className="w-3 h-3" />NEW</span>
    : r.deltaRate > 0.3 ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><TrendingUp className="w-3 h-3" />+{r.deltaRate}%p</span>
    : r.deltaRate < -0.3 ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"><TrendingDown className="w-3 h-3" />{r.deltaRate}%p</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Minus className="w-3 h-3" />유지</span>;

  return (
    <div className="flex-1 min-h-screen">
      <Header title="AI가 좋아하는 병원" description="전국 고객 병원의 AI 답변에서 자주 추천된 병원 — 내 경쟁사가 아니어도 보입니다" onRefresh={() => refetch()} refreshing={isRefetching} />
      <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">진료과
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                {SPECIALTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <label className="text-xs font-semibold text-slate-600">지역 (물어본 병원 기준)
              <select value={sido} onChange={(e) => setSido(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">
                <option value="">전국</option>{SIDOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <div className="text-xs font-semibold text-slate-600">기간
              <div className="mt-1 inline-flex rounded-lg border border-slate-200 overflow-hidden">
                {[30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-sm font-semibold ${days === d ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>{d}일</button>)}
              </div></div>
            <div className="text-xs font-semibold text-slate-600">순위 기준
              <div className="mt-1 inline-flex rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setSort('rate')} title="질문한 병원마다 응답 중 등장 비율을 구해 평균 — 기본" className={`px-3 py-2 text-sm font-semibold ${sort === 'rate' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>등장률</button>
                <button onClick={() => setSort('mentions')} className={`px-3 py-2 text-sm font-semibold ${sort === 'mentions' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>언급 수</button>
                <button onClick={() => setSort('hospitals')} title="한 병원의 질문량에 쏠리지 않게, 몇 곳의 질문에서 나왔는지로 정렬" className={`px-3 py-2 text-sm font-semibold ${sort === 'hospitals' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>물어본 병원 수</button>
              </div></div>
            {data && <div className="ml-auto text-xs text-slate-500">{data.period.since} ~ {data.period.until} · 질문 병원 {(data.askingHospitals || 0).toLocaleString()}곳 · 응답 {(data.responsesTotal || 0).toLocaleString()}건 · 병원명 {data.totalNames.toLocaleString()}개</div>}
          </CardContent>
        </Card>

        {isLoading && <div className="flex items-center gap-2 text-slate-500 text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" />전국 응답을 합산하는 중… (처음 한 번은 수십 초 걸릴 수 있어요)</div>}
        {isError && <div className="text-sm text-rose-600 p-6">불러오지 못했습니다. 새로고침을 눌러주세요.</div>}

        {data && data.risers.length > 0 && (
          <Card className="border-0 shadow-sm bg-amber-50/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-2"><Flame className="w-4 h-4" />새로 뜬 병원 <span className="text-xs font-normal text-amber-700">직전 {data.period.days}일엔 없었는데 이번에 5건 이상</span></div>
              <div className="flex flex-wrap gap-2">{data.risers.map((r) => <span key={r.name} className="px-2.5 py-1 rounded-full bg-white border border-amber-200 text-xs font-semibold text-slate-700">{r.name} <span className="text-amber-700">{r.rate}%</span></span>)}</div>
            </CardContent>
          </Card>
        )}

        {data && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="text-left px-4 py-2.5 w-12">순위</th><th className="text-left px-3 py-2.5">병원</th><th className="text-right px-3 py-2.5" title="질문 병원별 등장 비율의 평균">등장률</th><th className="text-right px-3 py-2.5" title="전체 응답 중 이 병원명이 나온 비율">전체 비율</th><th className="text-right px-3 py-2.5">언급</th><th className="text-left px-3 py-2.5">직전 대비</th><th className="text-right px-3 py-2.5">물어본 병원</th><th className="text-left px-3 py-2.5">주 플랫폼</th><th className="text-left px-3 py-2.5">주 지역</th></tr>
                </thead>
                <tbody>
                  {data.list.map((r) => {
                    const mine = myKey && r.name.replace(/\s+/g, '').includes(myKey.replace(/(치과|의원|병원)$/, '').slice(0, 4));
                    return (
                      <tr key={r.name} className={`border-t border-slate-100 ${mine ? 'bg-brand-50/60' : ''}`}>
                        <td className="px-4 py-2.5 font-black text-slate-400">{r.rank <= 3 ? <span className="text-amber-500">#{r.rank}</span> : `#${r.rank}`}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-2">{r.name}
                            {r.isCustomer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-bold" title={r.customerRegion || ''}>시그널 고객</span>}
                            {mine && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">우리 병원</span>}
                          </div>
                          {r.variants.length > 1 && <div className="text-[11px] text-slate-400 truncate max-w-xs">표기: {r.variants.join(' · ')}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">{r.rate}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.share}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.mentions.toLocaleString()}</td>
                        <td className="px-3 py-2.5">{delta(r)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.askedBy}곳</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.topPlatform ? PLATFORM_KO[r.topPlatform] || r.topPlatform : '—'} <span className="text-[11px] text-slate-400">/{r.platforms}</span></td>
                        <td className="px-3 py-2.5 text-slate-600"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{r.topSido || '—'}</span></td>
                      </tr>
                    );
                  })}
                  {data.list.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">이 조건에는 아직 합산할 응답이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-[11px] text-slate-500 flex items-start gap-2 border-t border-slate-100"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{data.method} 등장률 예: 3.2% = 질문 병원들의 AI 답변 100건 중 평균 3.2건에 이 병원이 나옴. 지역은 "질문한 병원"의 시·도라서 답변 속 병원의 실제 소재지와 다를 수 있습니다. 광고·홍보 목적의 순위가 아니라 AI 답변 관찰 통계입니다.</span></div>
          </Card>
        )}
        {!isLoading && !data && !isError && <div className="text-sm text-slate-500 p-6 flex items-center gap-2"><Sparkles className="w-4 h-4" />조건을 고르면 리더보드가 나옵니다.</div>}
      </main>
    </div>
  );
}
