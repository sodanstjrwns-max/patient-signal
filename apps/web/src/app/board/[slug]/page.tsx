'use client';

/**
 * 【원장용】병원 전용 AI 검색 가시성 대시보드
 *
 * - 병원별 접근코드 게이트 (HMAC 기반 — 해당 병원 데이터만 열람 가능)
 * - 사이드바 미등록 숨은 경로: /board/[slug]
 * - slug: 예쁜 별칭(isol 등) 또는 병원 UUID 직접 사용
 * - 경쟁 병원은 익명 라벨로만 표시 (타 고객사 보호)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Trophy, Shield, Eye, EyeOff, RefreshCw, TrendingUp, TrendingDown,
  Minus, Sparkles, Crown, Target, Smile, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

// ⚠️ ADMIN_SECRET이 설정된 Render 서비스는 patient-signal-1이다 (admin/sov와 동일 사유로 하드 지정)
const API_URL = 'https://patient-signal-1.onrender.com/api';

// 예쁜 URL 별칭 → 병원 UUID (신규 병원은 여기에 한 줄 추가)
const SLUG_MAP: Record<string, string> = {
  isol: '5ead9625-6a69-4440-b925-8d9e4bf80ceb', // 이솔치과의원
};

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  CHATGPT: { label: 'ChatGPT', color: '#10b981' },
  PERPLEXITY: { label: 'Perplexity', color: '#0ea5e9' },
  CLAUDE: { label: 'Claude', color: '#f97316' },
  GEMINI: { label: 'Gemini', color: '#8b5cf6' },
  GROK: { label: 'Grok', color: '#d946ef' },
  CLOVA_X: { label: 'CLOVA X', color: '#22c55e' },
};

interface PlatformStat {
  total: number;
  mentioned: number;
  sov: number;
}

interface DailyPoint {
  date: string;
  rank: number | null;
  hospitalCount: number;
  sovPercent: number | null;
  avgMentionPosition: number | null;
  totalResponses: number;
}

interface NearbyRow {
  rank: number;
  name: string;
  isMe: boolean;
  sovPercent: number;
  avgMentionPosition: number | null;
  firstPlaceRate: number | null;
  rankChange: number | null;
}

interface BoardData {
  success: boolean;
  error?: string;
  periodDays: number;
  hospital: { id: string; name: string; region: string | null };
  rank: number;
  hospitalCount: number;
  percentile: number;
  prevRank: number | null;
  rankChange: number | null;
  sovPercent: number;
  prevSovPercent: number | null;
  sovChange: number | null;
  totalResponses: number;
  mentionedResponses: number;
  avgMentionPosition: number | null;
  firstPlaceCount: number;
  firstPlaceRate: number | null;
  avgSentiment: number | null;
  platforms: Record<string, PlatformStat>;
  lowConfidence: boolean;
  daily: DailyPoint[];
  nearby: NearbyRow[];
}

function sentimentFace(s: number | null): string {
  if (s === null) return '—';
  if (s >= 0.5) return '😄 매우 긍정';
  if (s >= 0.2) return '😊 긍정';
  if (s >= -0.2) return '😐 중립';
  return '😟 개선 필요';
}

function RankChangeBadge({ change }: { change: number | null }) {
  if (change === null)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300">
        <Sparkles className="w-3 h-3" /> NEW
      </span>
    );
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
        <TrendingUp className="w-3.5 h-3.5" /> {change}계단 상승
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
        <TrendingDown className="w-3.5 h-3.5" /> {Math.abs(change)}계단
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
      <Minus className="w-3.5 h-3.5" /> 유지
    </span>
  );
}

export default function HospitalBoardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const hospitalId = SLUG_MAP[slug] ?? slug;

  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BoardData | null>(null);
  const [days, setDays] = useState(30);

  const fetchBoard = useCallback(
    async (c: string, d: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/admin/hospital-board?hospitalId=${hospitalId}&days=${d}`,
          { headers: { 'x-board-code': c } },
        );
        if (res.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(`ps_board_${slug}`);
          setError('접근코드가 올바르지 않습니다');
          return;
        }
        const json: BoardData = await res.json();
        if (!json.success) {
          setError(json.error ?? '데이터를 불러오지 못했습니다');
          return;
        }
        setData(json);
        setAuthed(true);
        sessionStorage.setItem(`ps_board_${slug}`, c);
      } catch {
        setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요 (첫 접속은 30초 정도 걸릴 수 있어요)');
      } finally {
        setLoading(false);
      }
    },
    [hospitalId, slug],
  );

  // 세션에 저장된 코드 자동 복원
  useEffect(() => {
    const saved = sessionStorage.getItem(`ps_board_${slug}`);
    if (saved) {
      setCode(saved);
      fetchBoard(saved, days);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleDays = (d: number) => {
    setDays(d);
    if (authed && code) fetchBoard(code, d);
  };

  // ===== 접근코드 게이트 =====
  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-6">
        <section className="w-full max-w-md bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">원장님 전용 대시보드</h1>
              <p className="text-xs text-slate-400">Patient Signal — AI 검색 가시성 리포트</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 mt-4 mb-5 leading-relaxed">
            발급받으신 접근코드를 입력해주세요.
            <br />
            <span className="text-slate-500 text-xs">이 페이지는 원장님 병원의 데이터만 표시됩니다.</span>
          </p>
          <div className="relative mb-4">
            <input
              id="board-code-input"
              type={showCode ? 'text' : 'password'}
              value={code}
              onChange={e => setCode(e.target.value.trim())}
              onKeyDown={e => e.key === 'Enter' && code && fetchBoard(code, days)}
              placeholder="접근코드"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/60 text-sm tracking-wider"
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="코드 표시 전환"
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-rose-400 text-xs mb-4">{error}</p>}
          <button
            onClick={() => code && fetchBoard(code, days)}
            disabled={!code || loading}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 disabled:opacity-40 text-slate-900 font-bold rounded-xl py-3 text-sm transition-all"
          >
            {loading ? '확인 중… (첫 접속은 30초 정도 걸릴 수 있어요)' : '대시보드 입장'}
          </button>
        </section>
      </main>
    );
  }

  if (!data) return null;

  const rankedDaily = data.daily.filter(d => d.rank !== null);
  const platformEntries = Object.entries(data.platforms).sort(
    (a, b) => b[1].sov - a[1].sov,
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white pb-16">
      {/* ===== 헤더 ===== */}
      <header className="max-w-6xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-amber-400 text-xs font-bold tracking-widest mb-1">
              PATIENT SIGNAL · 원장님 전용
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold">
              {data.hospital.name}{' '}
              <span className="text-slate-400 font-medium text-base">
                AI 검색 가시성 대시보드
              </span>
            </h1>
            {data.hospital.region && (
              <p className="text-slate-500 text-sm mt-1">{data.hospital.region}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => handleDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  days === d
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {d}일
              </button>
            ))}
            <button
              onClick={() => fetchBoard(code, days)}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
              aria-label="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== 히어로: 순위 배지 ===== */}
      <section id="rank-hero" className="max-w-6xl mx-auto px-6 mb-8">
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-400/25 rounded-2xl p-6 md:p-8 flex flex-wrap items-center gap-6 md:gap-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-semibold">전국 AI 검색 순위 (최근 {data.periodDays}일)</p>
              <p className="text-4xl font-black text-amber-300">
                {data.rank}위
                <span className="text-lg text-slate-400 font-semibold"> / {data.hospitalCount}개 병원</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-sm font-bold">
              전국 상위 {data.percentile}%
            </span>
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm">
              <RankChangeBadge change={data.rankChange} />
            </span>
            {data.sovChange !== null && (
              <span className={`px-4 py-2 rounded-full border text-sm font-semibold ${
                data.sovChange >= 0
                  ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}>
                SoV {data.sovChange >= 0 ? '+' : ''}{data.sovChange}%p (직전 {data.periodDays}일 대비)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ===== KPI 카드 6장 ===== */}
      <section id="kpi-cards" className="max-w-6xl mx-auto px-6 mb-10 grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            icon: <BarChart3 className="w-5 h-5 text-sky-400" />,
            label: 'AI 언급률 (SoV)',
            value: `${data.sovPercent}%`,
            sub: `AI 답변 ${data.totalResponses}건 중 ${data.mentionedResponses}건 등판`,
          },
          {
            icon: <Crown className="w-5 h-5 text-amber-400" />,
            label: '1위 호명률',
            value: data.firstPlaceRate !== null ? `${data.firstPlaceRate}%` : '—',
            sub: `등판 시 ${data.firstPlaceCount}번은 가장 먼저 추천됨`,
          },
          {
            icon: <Target className="w-5 h-5 text-violet-400" />,
            label: '등판 시 평균 순번',
            value: data.avgMentionPosition !== null ? `${data.avgMentionPosition}번째` : '—',
            sub: '언급될 때 추천 리스트 내 평균 위치',
          },
          {
            icon: <Smile className="w-5 h-5 text-emerald-400" />,
            label: 'AI 감성 평가',
            value: sentimentFace(data.avgSentiment),
            sub: data.avgSentiment !== null ? `감성 점수 ${data.avgSentiment > 0 ? '+' : ''}${data.avgSentiment} (−1~+1)` : '데이터 수집 중',
          },
          {
            icon: <Sparkles className="w-5 h-5 text-fuchsia-400" />,
            label: '분석 표본',
            value: `${data.totalResponses}건`,
            sub: `최근 ${data.periodDays}일 실제 AI 응답 전수 분석`,
          },
          {
            icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
            label: '직전 기간 순위',
            value: data.prevRank !== null ? `${data.prevRank}위 → ${data.rank}위` : '신규 진입',
            sub: '동일 길이 직전 기간과 비교',
          },
        ].map(card => (
          <article
            key={card.label}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition"
          >
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              {card.icon} {card.label}
            </div>
            <p className="text-xl md:text-2xl font-extrabold">{card.value}</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{card.sub}</p>
          </article>
        ))}
      </section>

      {/* ===== 차트: 일별 순위 + SoV ===== */}
      <section id="trend-charts" className="max-w-6xl mx-auto px-6 mb-10 grid md:grid-cols-2 gap-6">
        <article className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">일별 전국 순위 추이</h2>
          <p className="text-[11px] text-slate-500 mb-4">위로 갈수록 상위권 (1위가 최상단)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rankedDaily} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis reversed domain={[1, 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(v) => [`${v}위`, '순위']}
                />
                <Line type="monotone" dataKey="rank" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: '#fbbf24' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">일별 AI 언급률 (SoV %)</h2>
          <p className="text-[11px] text-slate-500 mb-4">AI가 우리 병원을 답변에 포함한 비율</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="sovFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(v) => [`${v}%`, 'SoV']}
                />
                <Area type="monotone" dataKey="sovPercent" stroke="#38bdf8" strokeWidth={2} fill="url(#sovFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {/* ===== 플랫폼별 SoV ===== */}
      <section id="platform-breakdown" className="max-w-6xl mx-auto px-6 mb-10">
        <article className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">AI 플랫폼별 언급률</h2>
          <p className="text-[11px] text-slate-500 mb-5">
            어떤 AI가 우리 병원을 얼마나 자주 추천하는지 — 낮은 플랫폼은 곧 성장 기회입니다
          </p>
          <div className="space-y-3">
            {platformEntries.map(([key, stat]) => {
              const meta = PLATFORM_LABELS[key] ?? { label: key, color: '#64748b' };
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-semibold text-slate-300 shrink-0">{meta.label}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all"
                      style={{ width: `${Math.max(stat.sov, 2)}%`, background: meta.color }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs text-slate-300 shrink-0">
                    <b className="text-white">{stat.sov}%</b>
                    <span className="text-slate-500"> ({stat.mentioned}/{stat.total})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {/* ===== 주변 경쟁 구간 ===== */}
      <section id="nearby-competitors" className="max-w-6xl mx-auto px-6 mb-10">
        <article className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-1">우리 병원 주변 경쟁 구간</h2>
          <p className="text-[11px] text-slate-500 mb-4">
            개인정보 보호를 위해 타 병원은 익명 처리됩니다
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/10">
                  <th className="text-left py-2 pr-4 font-semibold">순위</th>
                  <th className="text-left py-2 pr-4 font-semibold">병원</th>
                  <th className="text-right py-2 pr-4 font-semibold">SoV</th>
                  <th className="text-right py-2 pr-4 font-semibold">평균 순번</th>
                  <th className="text-right py-2 font-semibold">변동</th>
                </tr>
              </thead>
              <tbody>
                {data.nearby.map(row => (
                  <tr
                    key={`${row.rank}-${row.name}`}
                    className={`border-b border-white/5 ${
                      row.isMe ? 'bg-amber-400/10' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-bold">
                      {row.rank}위
                    </td>
                    <td className={`py-2.5 pr-4 ${row.isMe ? 'font-extrabold text-amber-300' : 'text-slate-400'}`}>
                      {row.name} {row.isMe && '⭐'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold">{row.sovPercent}%</td>
                    <td className="py-2.5 pr-4 text-right text-slate-400">
                      {row.avgMentionPosition !== null ? `${row.avgMentionPosition}번째` : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <RankChangeBadge change={row.rankChange} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <footer className="max-w-6xl mx-auto px-6 text-center text-[11px] text-slate-600">
        Patient Signal · 실제 AI 응답 전수 분석 기반 · 데이터는 크롤링 주기에 따라 갱신됩니다
      </footer>
    </main>
  );
}
