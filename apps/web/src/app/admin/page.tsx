'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Building2, Ticket, BarChart3, Shield, Eye, EyeOff,
  RefreshCw, ChevronDown, ChevronUp, Clock, Mail
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://patient-signal.onrender.com/api';
const ADMIN_SECRET = 'pf-admin-2026';

interface DashboardStats {
  stats: {
    totalUsers: number;
    totalHospitals: number;
    totalCouponsUsed: number;
    planDistribution: Record<string, number>;
  };
  recentUsers: Array<{ id: string; name: string; email: string; createdAt: string }>;
  recentHospitals: Array<{ id: string; name: string; specialtyType: string; planType: string; createdAt: string }>;
}

interface UserData {
  total: number;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    isPfMember: boolean;
    createdAt: string;
    hospital: { id: string; name: string; planType: string; specialtyType: string; regionSido: string; regionSigungu: string } | null;
  }>;
}

interface HospitalData {
  total: number;
  hospitals: Array<{
    id: string;
    name: string;
    specialtyType: string;
    planType: string;
    subscriptionStatus: string;
    regionSido: string;
    regionSigungu: string;
    regionDong: string | null;
    createdAt: string;
    _count: { users: number; prompts: number; competitors: number; crawlJobs: number };
  }>;
}

interface CouponData {
  total: number;
  coupons: Array<{
    code: string;
    name: string;
    type: string;
    maxUses: number;
    currentUses: number;
    remaining: number | string;
    expiresAt: string;
    redemptions: Array<{ user: string; email: string; hospital: string; date: string }>;
  }>;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-700',
  STARTER: 'bg-blue-100 text-brand-700',
  STANDARD: 'bg-purple-100 text-purple-700',
  PRO: 'bg-orange-100 text-orange-700',
  ENTERPRISE: 'bg-red-100 text-red-700',
};

const SPECIALTY_NAMES: Record<string, string> = {
  DENTAL: '🦷 치과',
  DERMATOLOGY: '💆 피부과',
  PLASTIC_SURGERY: '✨ 성형외과',
  OPHTHALMOLOGY: '👁️ 안과',
  KOREAN_MEDICINE: '🌿 한의원',
  OTHER: '🏥 기타',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'hospitals' | 'coupons'>('dashboard');
  const [loading, setLoading] = useState(false);
  
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserData | null>(null);
  const [hospitals, setHospitals] = useState<HospitalData | null>(null);
  const [coupons, setCoupons] = useState<CouponData | null>(null);
  const [expandedCoupon, setExpandedCoupon] = useState<string | null>(null);

  const secret = authenticated ? secretInput : '';

  const fetchData = async (tab: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/${tab}?secret=${secret}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      
      switch (tab) {
        case 'dashboard': setDashboard(data); break;
        case 'users': setUsers(data); break;
        case 'hospitals': setHospitals(data); break;
        case 'coupons': setCoupons(data); break;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard?secret=${secretInput}`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        setAuthenticated(true);
      } else {
        alert('비밀번호가 틀렸습니다');
      }
    } catch {
      alert('서버 연결 실패');
    }
  };

  useEffect(() => {
    if (authenticated) fetchData(activeTab);
  }, [activeTab, authenticated]);

  // 로그인 화면
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Patient Signal</h1>
            <p className="text-slate-400 text-sm mt-1">관리자 대시보드</p>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-6 border border-gray-800">
            <label className="text-sm text-slate-400 block mb-2">관리자 비밀번호</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="비밀번호 입력"
                className="w-full bg-slate-800 text-white border border-gray-700 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={handleLogin}
              className="w-full mt-4 bg-gradient-to-r from-brand-500 to-purple-600 text-white font-medium py-3 rounded-lg hover:from-brand-600 hover:to-purple-700 transition-all"
            >
              로그인
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 메인 대시보드
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <div className="border-b border-gray-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-bold text-lg">Patient Signal Admin</h1>
          </div>
          <button onClick={() => fetchData(activeTab)} className="text-slate-400 hover:text-white transition-colors" disabled={loading}>
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl w-fit">
          {[
            { key: 'dashboard', label: '대시보드', icon: BarChart3 },
            { key: 'users', label: '유저', icon: Users },
            { key: 'hospitals', label: '병원', icon: Building2 },
            { key: 'coupons', label: '쿠폰', icon: Ticket },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )}

        {/* ═══ 대시보드 탭 ═══ */}
        {!loading && activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="전체 유저" value={dashboard.stats.totalUsers} icon={Users} color="blue" />
              <StatCard label="전체 병원" value={dashboard.stats.totalHospitals} icon={Building2} color="green" />
              <StatCard label="쿠폰 사용" value={dashboard.stats.totalCouponsUsed} icon={Ticket} color="purple" />
              <StatCard label="플랜 종류" value={Object.keys(dashboard.stats.planDistribution).length} icon={BarChart3} color="orange" />
            </div>

            {/* 플랜 분포 */}
            <div className="bg-slate-900 rounded-xl p-5 border border-gray-800">
              <h3 className="font-semibold text-slate-300 mb-4">플랜 분포</h3>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(dashboard.stats.planDistribution).map(([plan, count]) => (
                  <div key={plan} className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${PLAN_COLORS[plan] || 'bg-slate-100 text-slate-700'}`}>
                      {plan}
                    </span>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 최근 가입 */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-xl p-5 border border-gray-800">
                <h3 className="font-semibold text-slate-300 mb-3">최근 가입 유저</h3>
                <div className="space-y-2">
                  {dashboard.recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                      <span className="text-xs text-slate-500">{timeAgo(u.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-5 border border-gray-800">
                <h3 className="font-semibold text-slate-300 mb-3">최근 등록 병원</h3>
                <div className="space-y-2">
                  {dashboard.recentHospitals.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{h.name}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-500">{SPECIALTY_NAMES[h.specialtyType] || h.specialtyType}</span>
                          <span className={`text-xs px-1.5 rounded ${PLAN_COLORS[h.planType]}`}>{h.planType}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{timeAgo(h.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 유저 탭 ═══ */}
        {!loading && activeTab === 'users' && users && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">전체 유저 <span className="text-blue-400">{users.total}명</span></h2>
            </div>
            <div className="bg-slate-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3">이름</th>
                      <th className="text-left px-4 py-3">이메일</th>
                      <th className="text-left px-4 py-3">병원</th>
                      <th className="text-left px-4 py-3">플랜</th>
                      <th className="text-left px-4 py-3">PF수강생</th>
                      <th className="text-left px-4 py-3">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.users.map((u) => (
                      <tr key={u.id} className="border-t border-gray-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-slate-400">{u.email}</td>
                        <td className="px-4 py-3">
                          {u.hospital ? (
                            <div>
                              <p className="text-sm">{u.hospital.name}</p>
                              <p className="text-xs text-slate-500">{u.hospital.regionSido} {u.hospital.regionSigungu}</p>
                            </div>
                          ) : (
                            <span className="text-slate-600">미등록</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[u.hospital?.planType || 'FREE']}`}>
                            {u.hospital?.planType || 'FREE'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.isPfMember ? (
                            <span className="text-green-400 text-xs font-medium">✓ 수강생</span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 병원 탭 ═══ */}
        {!loading && activeTab === 'hospitals' && hospitals && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">전체 병원 <span className="text-green-400">{hospitals.total}개</span></h2>
            </div>
            <div className="bg-slate-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3">병원명</th>
                      <th className="text-left px-4 py-3">진료과목</th>
                      <th className="text-left px-4 py-3">지역</th>
                      <th className="text-left px-4 py-3">플랜</th>
                      <th className="text-left px-4 py-3">질문</th>
                      <th className="text-left px-4 py-3">경쟁사</th>
                      <th className="text-left px-4 py-3">크롤링</th>
                      <th className="text-left px-4 py-3">등록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.hospitals.map((h) => (
                      <tr key={h.id} className="border-t border-gray-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium">{h.name}</td>
                        <td className="px-4 py-3 text-sm">{SPECIALTY_NAMES[h.specialtyType] || h.specialtyType}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{h.regionSido} {h.regionSigungu} {h.regionDong || ''}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[h.planType]}`}>
                            {h.planType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{h._count.prompts}</td>
                        <td className="px-4 py-3 text-center">{h._count.competitors}</td>
                        <td className="px-4 py-3 text-center">{h._count.crawlJobs}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(h.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 쿠폰 탭 ═══ */}
        {!loading && activeTab === 'coupons' && coupons && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">쿠폰 현황 <span className="text-purple-400">{coupons.total}개</span></h2>
            </div>
            <div className="space-y-4">
              {coupons.coupons.map((c) => (
                <div key={c.code} className="bg-slate-900 rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedCoupon(expandedCoupon === c.code ? null : c.code)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Ticket className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{c.code}</p>
                        <p className="text-xs text-slate-400">{c.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-mono">
                          <span className="text-blue-400">{c.currentUses}</span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-slate-400">{c.maxUses > 0 ? c.maxUses : '∞'}</span>
                        </p>
                        <p className="text-xs text-slate-500">사용 / 한도</p>
                      </div>
                      {expandedCoupon === c.code ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </div>
                  </button>

                  {expandedCoupon === c.code && c.redemptions.length > 0 && (
                    <div className="border-t border-gray-800 px-5 py-3">
                      <p className="text-xs text-slate-500 mb-2">사용 내역</p>
                      {c.redemptions.map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{r.user}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Mail className="h-3 w-3" />{r.email}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400">{r.hospital}</p>
                            <p className="text-xs text-slate-600 flex items-center gap-1 justify-end">
                              <Clock className="h-3 w-3" />{formatDate(r.date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedCoupon === c.code && c.redemptions.length === 0 && (
                    <div className="border-t border-gray-800 px-5 py-6 text-center">
                      <p className="text-sm text-slate-600">아직 사용 내역이 없습니다</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-brand-500/20 to-brand-600/10 border-brand-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  };
  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <Icon className={`h-5 w-5 ${iconColors[color]}`} />
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
