'use client';

// 【2026-09-14】요즘 AI가 좋아하는 병원 — 전 고객 병원의 AI 응답에서 언급된 병원명을 전국 단위로 합산한 리더보드.
// 내 경쟁사로 등록하지 않았어도 AI가 자주 추천하는 병원을 진료과·지역·기간으로 본다.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { WorkspaceIntro } from '@/components/dashboard/WorkspaceIntro';
import { Card, CardContent } from '@/components/ui/card';
import { competitorsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Sparkles, TrendingUp, TrendingDown, Minus, Flame, MapPin, Info, Loader2, Shield } from 'lucide-react';

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
    : r.deltaRate > 0.3 ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c0c4c7]"><TrendingUp className="w-3 h-3" />+{r.deltaRate}%p</span>
    : r.deltaRate < -0.3 ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"><TrendingDown className="w-3 h-3" />{r.deltaRate}%p</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#959c9f]"><Minus className="w-3 h-3" />유지</span>;

  return (
    <div className="flex-1 min-h-screen">
      <Header title="AI 답변 등장률" description="전국 고객 병원의 AI 답변에 어떤 병원명이 얼마나 자주 나오는지 관찰한 통계 — 품질 순위가 아닙니다" onRefresh={() => refetch()} refreshing={isRefetching} />
      <main className="mx-auto max-w-[1440px] space-y-7 px-5 py-7 sm:px-8 xl:px-10">
        <WorkspaceIntro eyebrow="AI MENTION TRENDS" title="AI 답변에 자주 등장한 병원." description="진료과와 질문 지역을 선택해 등록 고객의 AI 답변에서 관찰된 병원명 등장 추이를 확인하세요." />
        {data && (
          <section className="grid grid-cols-2 gap-y-5 border-b border-[#30343a] pb-7 sm:grid-cols-4" aria-label="집계 범위">
            <div className="border-r border-[#30343a] pr-5"><p className="text-[10px] font-medium text-[#959c9f]">집계 기간</p><p className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#f5f5ef]">{data.period.days}<span className="ml-1 text-sm font-normal text-[#959c9f]">일</span></p><p className="mt-1 text-[10px] text-[#959c9f]">{data.period.since} ~ {data.period.until}</p></div>
            <div className="pl-5 sm:border-r sm:border-[#30343a]"><p className="text-[10px] font-medium text-[#959c9f]">질문 병원</p><p className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#f5f5ef]">{(data.askingHospitals || 0).toLocaleString()}<span className="ml-1 text-sm font-normal text-[#959c9f]">곳</span></p></div>
            <div className="border-r border-[#30343a] pr-5 sm:pl-5"><p className="text-[10px] font-medium text-[#959c9f]">집계한 답변</p><p className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#f5f5ef]">{(data.responsesTotal || 0).toLocaleString()}<span className="ml-1 text-sm font-normal text-[#959c9f]">건</span></p></div>
            <div className="pl-5"><p className="text-[10px] font-medium text-[#959c9f]">등장한 병원명</p><p className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#c0c4c7]">{data.totalNames.toLocaleString()}<span className="ml-1 text-sm font-normal text-[#959c9f]">개</span></p></div>
          </section>
        )}
        <Card className="border border-[#30343a] shadow-none">
          <CardContent className="grid grid-cols-1 items-end gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_auto_auto]">
            <label className="text-xs font-semibold text-[#c0c4c7]">진료과
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-2 block w-full rounded-md border border-[#30343a] px-3 py-2 text-sm bg-[#111315]">
                {SPECIALTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <label className="text-xs font-semibold text-[#c0c4c7]">지역 (물어본 병원 기준)
              <select value={sido} onChange={(e) => setSido(e.target.value)} className="mt-2 block w-full rounded-md border border-[#30343a] px-3 py-2 text-sm bg-[#111315]">
                <option value="">전국</option>{SIDOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <div className="text-xs font-semibold text-[#c0c4c7]">기간
              <div className="mt-2 inline-flex rounded-md border border-[#30343a] overflow-hidden">
                {[30, 90].map((d) => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={`px-3 py-2 text-sm font-semibold ${days === d ? 'bg-[#08090a] text-white' : 'bg-[#111315] text-[#c0c4c7]'}`}>{d}일</button>)}
              </div></div>
            <div className="text-xs font-semibold text-[#c0c4c7]">순위 기준
              <div className="mt-2 inline-flex rounded-md border border-[#30343a] overflow-hidden">
                <button onClick={() => setSort('rate')} aria-pressed={sort === 'rate'} title="질문한 병원마다 응답 중 등장 비율을 구해 평균 — 기본" className={`px-3 py-2 text-sm font-semibold ${sort === 'rate' ? 'bg-[#08090a] text-white' : 'bg-[#111315] text-[#c0c4c7]'}`}>등장률</button>
                <button onClick={() => setSort('mentions')} aria-pressed={sort === 'mentions'} className={`px-3 py-2 text-sm font-semibold ${sort === 'mentions' ? 'bg-[#08090a] text-white' : 'bg-[#111315] text-[#c0c4c7]'}`}>언급 수</button>
                <button onClick={() => setSort('hospitals')} aria-pressed={sort === 'hospitals'} title="한 병원의 질문량에 쏠리지 않게, 몇 곳의 질문에서 나왔는지로 정렬" className={`px-3 py-2 text-sm font-semibold ${sort === 'hospitals' ? 'bg-[#08090a] text-white' : 'bg-[#111315] text-[#c0c4c7]'}`}>물어본 병원 수</button>
              </div></div>
          </CardContent>
        </Card>

        {isLoading && <div className="flex items-center gap-2 text-[#959c9f] text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" />전국 응답을 합산하는 중… (처음 한 번은 수십 초 걸릴 수 있어요)</div>}
        {isError && <div className="text-sm text-rose-600 p-6">불러오지 못했습니다. 새로고침을 눌러주세요.</div>}

        {data && data.risers.length > 0 && (
          <Card className="border border-[#30343a] shadow-none bg-[#08090a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f5f5ef] mb-3"><Flame className="w-4 h-4" />새로 뜬 병원 <span className="text-xs font-normal text-[#959c9f]">직전 {data.period.days}일엔 없었는데 이번에 5건 이상</span></div>
              <div className="flex flex-wrap gap-2">{data.risers.map((r) => <span key={r.name} className="px-2.5 py-1 rounded-md bg-[#111315] border border-[#30343a] text-xs font-semibold text-[#c0c4c7]">{r.name} <span className="text-[#c0c4c7]">{r.rate}%</span></span>)}</div>
            </CardContent>
          </Card>
        )}

        {data && (
          <Card className="border border-[#30343a] shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#08090a] text-[11px] uppercase tracking-wide text-[#959c9f]">
                  <tr><th className="text-left px-4 py-3.5 w-12">No.</th><th className="text-left px-3 py-3.5">병원</th><th className="text-right px-3 py-3.5" title="질문 병원별 등장 비율의 평균">등장률</th><th className="text-right px-3 py-3.5" title="전체 응답 중 이 병원명이 나온 비율">전체 비율</th><th className="text-right px-3 py-3.5">언급</th><th className="text-left px-3 py-3.5">직전 대비</th><th className="text-right px-3 py-3.5">물어본 병원</th><th className="text-left px-3 py-3.5">주 플랫폼</th><th className="text-left px-3 py-3.5">주 지역</th></tr>
                </thead>
                <tbody>
                  {data.list.map((r) => {
                    const mine = myKey && r.name.replace(/\s+/g, '').includes(myKey.replace(/(치과|의원|병원)$/, '').slice(0, 4));
                    return (
                      <tr key={r.name} className={`border-t border-[#30343a] ${mine ? 'bg-[#ff6a24]/20' : ''}`}>
                        <td className="px-4 py-3.5 tabular-nums text-[#959c9f]">{r.rank}</td>
                        <td className="px-3 py-3.5">
                          <div className="font-semibold text-[#f5f5ef] flex items-center gap-2">{r.name}
                            {r.isCustomer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#352115] text-[#ff9565] font-bold" title={r.customerRegion || ''}>시그널 고객</span>}
                            {mine && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff6a24] text-[#c0c4c7] font-bold">우리 병원</span>}
                          </div>
                          {r.variants.length > 1 && <div className="text-[11px] text-[#959c9f] truncate max-w-xs">표기: {r.variants.join(' · ')}</div>}
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold tabular-nums text-[#f5f5ef]">{r.rate}%</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-[#c0c4c7]">{r.share}%</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-[#959c9f]">{r.mentions.toLocaleString()}</td>
                        <td className="px-3 py-3.5">{delta(r)}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-[#c0c4c7]">{r.askedBy}곳</td>
                        <td className="px-3 py-3.5 text-[#c0c4c7]">{r.topPlatform ? PLATFORM_KO[r.topPlatform] || r.topPlatform : '—'} <span className="text-[11px] text-[#959c9f]">/{r.platforms}</span></td>
                        <td className="px-3 py-3.5 text-[#c0c4c7]"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-[#959c9f]" />{r.topSido || '—'}</span></td>
                      </tr>
                    );
                  })}
                  {data.list.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-[#959c9f]">이 조건에는 아직 합산할 응답이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-[11px] text-[#959c9f] space-y-1.5 border-t border-[#30343a]">
              <div className="flex items-start gap-2"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{data.method} 등장률 예: 3.2% = 질문 병원들의 AI 답변 100건 중 평균 3.2건에 이 병원이 나옴. 지역은 "질문한 병원"의 시·도라서 답변 속 병원의 실제 소재지와 다를 수 있습니다.</span></div>
              <div className="flex items-start gap-2 text-[#c0c4c7]"><Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span><b>이 통계는 의료 품질·실력 순위가 아니라 AI 답변 관찰 결과입니다.</b> 의료광고·홍보에 인용하는 것은 병원의 책임이며 의료법상 의료광고 심의 대상이 될 수 있습니다. 화면 캡처·외부 게시를 금합니다. 계약 병원의 내부 경영 참고용으로만 제공됩니다.</span></div>
            </div>
          </Card>
        )}
        {!isLoading && !data && !isError && <div className="text-sm text-[#959c9f] p-6 flex items-center gap-2"><Sparkles className="w-4 h-4" />조건을 고르면 등장률 표가 나옵니다.</div>}
      </main>
    </div>
  );
}
