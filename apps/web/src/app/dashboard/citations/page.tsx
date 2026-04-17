'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { queryKeys } from '@/lib/queryKeys';
import { 
  Globe, Link as LinkIcon, ExternalLink, FileText, 
  BarChart3, TrendingUp, ArrowUpRight, Search,
  Layers, Eye, Filter, ChevronRight,
} from 'lucide-react';

// ─── API 호출 ───
const fetchCitationData = async (hospitalId: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scores/${hospitalId}/citations`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!res.ok) throw new Error('인용 데이터를 불러올 수 없습니다');
  return res.json();
};

// ─── 도메인 추출 헬퍼 ───
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ─── 도메인 카테고리 분류 ───
function categorizeDomain(domain: string): { category: string; color: string; label: string } {
  if (domain.includes('naver') || domain.includes('blog.naver')) {
    return { category: 'blog', color: 'green', label: '네이버 블로그' };
  }
  if (domain.includes('tistory')) {
    return { category: 'blog', color: 'orange', label: '티스토리' };
  }
  if (domain.includes('youtube')) {
    return { category: 'video', color: 'red', label: 'YouTube' };
  }
  if (domain.includes('place.naver') || domain.includes('map.naver')) {
    return { category: 'map', color: 'emerald', label: '네이버 플레이스' };
  }
  if (domain.includes('gangnam') || domain.includes('hospital') || domain.includes('clinic') || domain.includes('dental')) {
    return { category: 'hospital', color: 'blue', label: '병원 웹사이트' };
  }
  if (domain.includes('news') || domain.includes('chosun') || domain.includes('donga') || domain.includes('joongang')) {
    return { category: 'news', color: 'gray', label: '뉴스' };
  }
  if (domain.includes('cafe.naver') || domain.includes('community')) {
    return { category: 'community', color: 'purple', label: '커뮤니티' };
  }
  return { category: 'other', color: 'slate', label: '기타' };
}

interface SourceEntry {
  url: string;
  title?: string;
  type?: string;
  platform?: string;
}

type TabType = 'domains' | 'pages' | 'platforms';

export default function CitationsPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [activeTab, setActiveTab] = useState<TabType>('domains');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 실제 API 호출 (기존 scores 서비스의 getCitationAnalysis 활용)
  const { data: citationRaw, isLoading, error } = useQuery({
    queryKey: ['citations', hospitalId || ''],
    queryFn: () => fetchCitationData(hospitalId || ''),
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // sourceHints 기반 AI응답에서 직접 가져오기 (fallback)
  const { data: responsesData } = useQuery({
    queryKey: ['source-hints', hospitalId || ''],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scores/${hospitalId}/source-hints`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return { sources: [] };
      return res.json();
    },
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── 데이터 가공 ───
  const processedData = useMemo(() => {
    // citations API or source-hints 사용
    const rawDomains: Record<string, number> = citationRaw?.domains || {};
    const rawSources: SourceEntry[] = responsesData?.sources || [];

    // 도메인별 집계
    const domainMap = new Map<string, { count: number; urls: string[]; category: ReturnType<typeof categorizeDomain> }>();
    
    // citations API 데이터
    for (const [domain, count] of Object.entries(rawDomains)) {
      const category = categorizeDomain(domain);
      domainMap.set(domain, { count: count as number, urls: [], category });
    }

    // source-hints 데이터 병합
    for (const source of rawSources) {
      if (!source.url) continue;
      const domain = extractDomain(source.url);
      const existing = domainMap.get(domain);
      if (existing) {
        existing.count++;
        if (!existing.urls.includes(source.url)) existing.urls.push(source.url);
      } else {
        domainMap.set(domain, { count: 1, urls: [source.url], category: categorizeDomain(domain) });
      }
    }

    // 정렬
    const domains = Array.from(domainMap.entries())
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.count - a.count);

    // 카테고리 집계
    const categories = new Map<string, { count: number; label: string; color: string }>();
    for (const d of domains) {
      const key = d.category.category;
      const existing = categories.get(key);
      if (existing) {
        existing.count += d.count;
      } else {
        categories.set(key, { count: d.count, label: d.category.label, color: d.category.color });
      }
    }

    const totalCitations = domains.reduce((sum, d) => sum + d.count, 0);

    return {
      domains,
      categories: Array.from(categories.entries())
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => b.count - a.count),
      totalCitations,
      uniqueDomains: domains.length,
    };
  }, [citationRaw, responsesData]);

  const filteredDomains = filterCategory === 'all' 
    ? processedData.domains 
    : processedData.domains.filter(d => d.category.category === filterCategory);

  // ─── Loading / Error ───
  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <Header title="인용 출처 분석" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <Header title="인용 출처 분석" subtitle="AI가 우리 병원을 추천할 때 참고하는 출처를 추적합니다" />

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <LinkIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 인용 횟수</p>
                <p className="text-2xl font-bold text-gray-900">{processedData.totalCitations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Globe className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">고유 도메인 수</p>
                <p className="text-2xl font-bold text-gray-900">{processedData.uniqueDomains}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">출처 유형</p>
                <p className="text-2xl font-bold text-gray-900">{processedData.categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-2 border-b pb-2">
        {[
          { key: 'domains' as TabType, label: '도메인별', icon: Globe },
          { key: 'pages' as TabType, label: '카테고리별', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 도메인별 탭 */}
      {activeTab === 'domains' && (
        <div className="space-y-4">
          {/* 카테고리 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-gray-400" />
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                filterCategory === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              전체
            </button>
            {processedData.categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFilterCategory(cat.key)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  filterCategory === cat.key ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          {/* 도메인 리스트 */}
          <div className="space-y-2">
            {filteredDomains.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">아직 인용 출처 데이터가 없습니다</p>
                  <p className="text-gray-400 text-xs mt-1">AI 크롤링이 진행되면 인용 출처가 자동으로 수집됩니다</p>
                </CardContent>
              </Card>
            ) : (
              filteredDomains.map((domain, i) => {
                const percentage = processedData.totalCitations > 0 
                  ? Math.round((domain.count / processedData.totalCitations) * 100) 
                  : 0;
                return (
                  <Card key={domain.domain} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-xs font-bold text-gray-500 flex-shrink-0">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{domain.domain}</p>
                              <span className={`px-2 py-0.5 text-[10px] rounded-full bg-${domain.category.color}-50 text-${domain.category.color}-600 border border-${domain.category.color}-200 flex-shrink-0`}>
                                {domain.category.label}
                              </span>
                            </div>
                            {domain.urls.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {domain.urls[0]}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{domain.count}</p>
                            <p className="text-[10px] text-gray-400">{percentage}%</p>
                          </div>
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all" 
                              style={{ width: `${Math.min(percentage * 2, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 카테고리별 탭 */}
      {activeTab === 'pages' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {processedData.categories.length === 0 ? (
            <Card className="col-span-2">
              <CardContent className="p-8 text-center">
                <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">아직 카테고리 데이터가 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            processedData.categories.map((cat) => {
              const percentage = processedData.totalCitations > 0 
                ? Math.round((cat.count / processedData.totalCitations) * 100) 
                : 0;
              const domainsInCategory = processedData.domains.filter(d => d.category.category === cat.key);
              return (
                <Card key={cat.key} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{cat.label}</h3>
                        <p className="text-xs text-gray-400">{domainsInCategory.length}개 도메인</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{cat.count}</p>
                        <p className="text-xs text-gray-400">{percentage}% 비중</p>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div 
                        className={`h-full bg-${cat.color}-500 rounded-full transition-all`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="space-y-1">
                      {domainsInCategory.slice(0, 3).map((d) => (
                        <div key={d.domain} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate max-w-[180px]">{d.domain}</span>
                          <span className="text-gray-400">{d.count}회</span>
                        </div>
                      ))}
                      {domainsInCategory.length > 3 && (
                        <p className="text-[10px] text-blue-500 cursor-pointer hover:underline" onClick={() => { setActiveTab('domains'); setFilterCategory(cat.key); }}>
                          +{domainsInCategory.length - 3}개 더 보기
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* 하단 안내 */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">인용 출처 관리 팁</p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                AI가 자주 인용하는 출처(네이버 블로그, 병원 웹사이트 등)의 콘텐츠를 최신 상태로 유지하면 
                AI 추천 품질이 높아집니다. 특히 <strong>병원 웹사이트</strong>와 <strong>네이버 플레이스</strong> 정보가 
                AI의 주요 참고 소스입니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
