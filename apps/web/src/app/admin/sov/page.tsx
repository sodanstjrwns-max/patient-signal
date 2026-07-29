'use client';

/**
 * 【어드민 전용】전체 고객 병원 SoV 랭킹 보드
 *
 * - 시크릿 게이트 (ADMIN_SECRET) — 일반 고객에게 노출되지 않음
 * - 종합 랭킹: SoV / 언급 수 / 등판 시 평균 순번 / 순위 변동 정렬
 * - 날짜별 순위: 특정 날짜의 순위표 조회
 * - 병원 추이: 병원 클릭 → 일별 순위/SoV 그래프
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Shield, Eye, EyeOff, RefreshCw, TrendingUp, TrendingDown,
  Minus, Sparkles, ArrowUpDown, Calendar, LineChart as LineChartIcon, X,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ⚠️ 어드민 전용: ADMIN_SECRET이 설정된 Render 서비스는 patient-signal-1이다.
// (Render에 patient-signal / patient-signal-1 두 서비스가 공존 — 시크릿은 -1에만 있음)
// 일반 앱의 NEXT_PUBLIC_API_URL과 분리해 하드 지정한다.
const API_URL = 'https://patient-signal-1.onrender.com/api';

interface RankRow {
  rank: number;
  hospitalId: string;
  name: string;
  region: string | null;
  specialtyType: string | null;
  planType: string | null;
  totalResponses: number;
  mentionedResponses: number;
  sovPercent: number;
  avgMentionPosition: number | null;
  lowConfidence: boolean;
  prevRank: number | null;
  rankChange: number | null;
  prevSovPercent: number | null;
  sovChange: number | null;
}

interface DailyDay {
  date: string;
  hospitalCount: number;
  ranking: Array<{
    rank: number;
    hospitalId: string;
    name: string;
    totalResponses: number;
    mentionedResponses: number;
    sovPercent: number;
    avgMentionPosition: number | null;
  }>;
}

interface TrendPoint {
  date: string;
  rank: number | null;
  hospitalCount: number;
  sovPercent: number | null;
  avgMentionPosition: number | null;
  totalResponses: number;
}

type SortKey = 'sov' | 'mentions' | 'avgPos' | 'rankChange';

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600',
  STARTER: 'bg-blue-100 text-blue-700',
  STANDARD: 'bg-purple-100 text-purple-700',
  PRO: 'bg-orange-100 text-orange-700',
  ENTERPRISE: 'bg-red-100 text-red-700',
};

function RankChangeBadge({ change }: { change: number | null }) {
  if (change === null)
    return <span className="inline-flex items-center gap-0.5 text-xs text-violet-600"><Sparkles className="h-3 w-3" />신규</span>;
  if (change > 0)
    return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><TrendingUp className="h-3 w-3" />+{change}</span>;
  if (change < 0)
    return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500"><TrendingDown className="h-3 w-3" />{change}</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-slate-400"><Minus className="h-3 w-3" />0</span>;
}

export default function AdminSovPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  const [days, setDays] = useState(30);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('sov');
  const [search, setSearch] = useState('');

  const [view, setView] = useState<'overall' | 'daily'>('overall');
  const [dailyData, setDailyData] = useState<DailyDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [trendHospital, setTrendHospital] = useState<{ id: string; name: string } | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const secret = authenticated ? secretInput : '';

  // ---------- data fetch ----------
  const fetchRanking = async (s = secret, d = days) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/sov-ranking?days=${d}`, {
        headers: { 'x-admin-secret': s },
      });
      if (!res.ok) throw new Error('unauthorized');
      const data = await res.json();
      setRanking(data.ranking ?? []);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchDaily = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/sov-daily?days=${Math.min(days, 90)}`, {
        headers: { 'x-admin-secret': secret },
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const list: DailyDay[] = data.days ?? [];
      setDailyData(list);
      if (list.length > 0) setSelectedDate(list[list.length - 1].date);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async (hospitalId: string) => {
    setTrendLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/sov-daily?days=${Math.min(days, 90)}&hospitalId=${hospitalId}`,
        { headers: { 'x-admin-secret': secret } },
      );
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setTrend(data.series ?? []);
    } catch { /* noop */ } finally {
      setTrendLoading(false);
    }
  };

  const handleLogin = async () => {
    const ok = await fetchRanking(secretInput, days);
    if (ok) {
      setAuthenticated(true);
      sessionStorage.setItem('ps_admin_secret', secretInput);
    } else {
      alert('시크릿이 틀렸거나 서버 연결에 실패했습니다');
    }
  };

  // 세션 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('ps_admin_secret');
    if (saved) {
      setSecretInput(saved);
      fetchRanking(saved, days).then(ok => { if (ok) setAuthenticated(true); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    if (view === 'overall') fetchRanking();
    else fetchDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, view, authenticated]);

  useEffect(() => {
    if (trendHospital) fetchTrend(trendHospital.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendHospital]);

  // ---------- derived ----------
  const sorted = useMemo(() => {
    let rows = [...ranking];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.region ?? '').toLowerCase().includes(q));
    }
    switch (sortKey) {
      case 'mentions':
        rows.sort((a, b) => b.mentionedResponses - a.mentionedResponses);
        break;
      case 'avgPos':
        // 등판 시 평균 순번: 낮을수록 좋음. null(등판 0회)은 맨 뒤로
        rows.sort((a, b) => (a.avgMentionPosition ?? 999) - (b.avgMentionPosition ?? 999));
        break;
      case 'rankChange':
        rows.sort((a, b) => (b.rankChange ?? -999) - (a.rankChange ?? -999));
        break;
      default:
        rows.sort((a, b) => a.rank - b.rank);
    }
    return rows;
  }, [ranking, sortKey, search]);

  const selectedDay = dailyData.find(d => d.date === selectedDate);

  // ---------- login gate ----------
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SoV 랭킹 보드</h1>
            <p className="text-slate-400 text-sm mt-1">관리자 전용 — 전체 고객 병원 순위</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-6 border border-gray-800">
            <label className="block text-sm text-slate-400 mb-2">
              <Shield className="h-3.5 w-3.5 inline mr-1" />관리자 시크릿
            </label>
            <div className="relative">
              <input
                id="admin-secret-input"
                type={showSecret ? 'text' : 'password'}
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="ADMIN_SECRET"
              />
              <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={handleLogin}
              className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              입장
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- main board ----------
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h1 className="font-bold">SoV 랭킹 보드</h1>
            <span className="text-xs text-slate-500">관리자 전용</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 기간 선택 */}
            <select
              id="period-select"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs"
            >
              <option value={7}>최근 7일</option>
              <option value={14}>최근 14일</option>
              <option value={30}>최근 30일</option>
              <option value={60}>최근 60일</option>
              <option value={90}>최근 90일</option>
            </select>
            {/* 뷰 전환 */}
            <nav className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
              <button
                onClick={() => setView('overall')}
                className={`px-3 py-1.5 flex items-center gap-1 ${view === 'overall' ? 'bg-amber-500 text-gray-950 font-semibold' : 'bg-gray-950 text-slate-400'}`}
              >
                <ArrowUpDown className="h-3 w-3" />종합 랭킹
              </button>
              <button
                onClick={() => setView('daily')}
                className={`px-3 py-1.5 flex items-center gap-1 ${view === 'daily' ? 'bg-amber-500 text-gray-950 font-semibold' : 'bg-gray-950 text-slate-400'}`}
              >
                <Calendar className="h-3 w-3" />날짜별 순위
              </button>
            </nav>
            <button
              onClick={() => (view === 'overall' ? fetchRanking() : fetchDaily())}
              className="text-slate-400 hover:text-white"
              disabled={loading}
              aria-label="새로고침"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'overall' && (
          <section id="overall-ranking">
            {/* 정렬 탭 + 검색 */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <nav className="flex gap-1.5 flex-wrap text-xs">
                {([
                  ['sov', 'SoV(언급률) 순'],
                  ['mentions', '언급 수 순'],
                  ['avgPos', '등판 시 평균 순번'],
                  ['rankChange', '순위 변동 순'],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-3 py-1.5 rounded-full border ${sortKey === k ? 'bg-amber-500 text-gray-950 border-amber-500 font-semibold' : 'border-gray-700 text-slate-400 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <input
                id="hospital-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="병원명/지역 검색"
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:border-amber-500"
              />
            </div>

            <p className="text-xs text-slate-500 mb-3">
              SoV = 질문 100번 중 그 병원이 등판한 비율(언급률). 순위 변동은 직전 {days}일 대비. 병원 클릭 → 일별 추이.
            </p>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 text-xs">
                    <th className="px-3 py-2.5 text-left">#</th>
                    <th className="px-3 py-2.5 text-left">변동</th>
                    <th className="px-3 py-2.5 text-left">병원</th>
                    <th className="px-3 py-2.5 text-right">SoV</th>
                    <th className="px-3 py-2.5 text-right">SoV 변화</th>
                    <th className="px-3 py-2.5 text-right">언급/전체</th>
                    <th className="px-3 py-2.5 text-right">등판 시 평균 순번</th>
                    <th className="px-3 py-2.5 text-left">플랜</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(r => (
                    <tr
                      key={r.hospitalId}
                      onClick={() => setTrendHospital({ id: r.hospitalId, name: r.name })}
                      className="border-t border-gray-800/70 hover:bg-slate-900/60 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                      </td>
                      <td className="px-3 py-2"><RankChangeBadge change={r.rankChange} /></td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.name}</span>
                        {r.lowConfidence && <span className="ml-1.5 text-[10px] text-amber-500">표본부족</span>}
                        <span className="block text-[11px] text-slate-500">{r.region}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-300">{r.sovPercent}%</td>
                      <td className={`px-3 py-2 text-right text-xs ${(r.sovChange ?? 0) > 0 ? 'text-emerald-400' : (r.sovChange ?? 0) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {r.sovChange === null ? '—' : `${r.sovChange > 0 ? '+' : ''}${r.sovChange}%p`}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300 font-mono text-xs">
                        {r.mentionedResponses.toLocaleString()}/{r.totalResponses.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.avgMentionPosition !== null ? (
                          <span className={r.avgMentionPosition <= 2 ? 'text-emerald-400 font-semibold' : r.avgMentionPosition <= 3 ? 'text-slate-200' : 'text-slate-400'}>
                            {r.avgMentionPosition}위
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PLAN_COLORS[r.planType ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
                          {r.planType ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === 'daily' && (
          <section id="daily-ranking">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Calendar className="h-4 w-4 text-amber-400" />
              <select
                id="date-select"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs"
              >
                {dailyData.map(d => (
                  <option key={d.date} value={d.date}>{d.date} ({d.hospitalCount}개 병원)</option>
                ))}
              </select>
              <span className="text-xs text-slate-500">그날 수집된 응답만으로 계산한 당일 순위</span>
            </div>

            {selectedDay ? (
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-xs">
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">병원</th>
                      <th className="px-3 py-2.5 text-right">SoV</th>
                      <th className="px-3 py-2.5 text-right">언급/전체</th>
                      <th className="px-3 py-2.5 text-right">등판 시 평균 순번</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDay.ranking.map(r => (
                      <tr
                        key={r.hospitalId}
                        onClick={() => setTrendHospital({ id: r.hospitalId, name: r.name })}
                        className="border-t border-gray-800/70 hover:bg-slate-900/60 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-300">{r.sovPercent}%</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-mono text-xs">
                          {r.mentionedResponses}/{r.totalResponses}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.avgMentionPosition !== null ? `${r.avgMentionPosition}위` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">{loading ? '불러오는 중…' : '데이터가 없습니다'}</p>
            )}
          </section>
        )}
      </main>

      {/* 병원 추이 모달 */}
      {trendHospital && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setTrendHospital(null)}>
          <div
            className="bg-slate-900 border border-gray-700 rounded-2xl w-full max-w-3xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-amber-400" />
                {trendHospital.name} — 일별 순위 · SoV 추이 (최근 {Math.min(days, 90)}일)
              </h2>
              <button onClick={() => setTrendHospital(null)} className="text-slate-400 hover:text-white" aria-label="닫기">
                <X className="h-5 w-5" />
              </button>
            </div>

            {trendLoading ? (
              <p className="text-slate-500 text-sm py-16 text-center">불러오는 중…</p>
            ) : (
              <>
                <h3 className="text-xs text-slate-400 mb-1">일별 순위 (낮을수록 상위 — 축 반전)</h3>
                <div className="h-44 mb-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
                      <YAxis reversed allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[1, 'dataMax']} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v}위`, '순위']}
                      />
                      <Line type="monotone" dataKey="rank" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <h3 className="text-xs text-slate-400 mb-1">일별 SoV(%)</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v}%`, 'SoV']}
                      />
                      <Line type="monotone" dataKey="sovPercent" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
