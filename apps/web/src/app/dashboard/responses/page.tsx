'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { crawlerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Bot,
  Search,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  Clock,
  Award,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const platformColors: Record<string, string> = {
  CHATGPT: 'bg-green-100 text-green-800',
  CLAUDE: 'bg-orange-100 text-orange-800',
  PERPLEXITY: 'bg-blue-100 text-blue-800',
  GEMINI: 'bg-purple-100 text-purple-800',
};

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
};

// 데모 데이터 - 실제 크롤링 결과 예시
const DEMO_RESPONSES = [
  {
    id: 'demo-1',
    aiPlatform: 'CHATGPT',
    responseDate: new Date().toISOString(),
    isMentioned: true,
    mentionPosition: 2,
    sentimentLabel: 'POSITIVE',
    prompt: { promptText: '강남역 근처 임플란트 잘하는 치과 추천해줘' },
    responseText: `강남역 근처에서 임플란트로 유명한 치과들을 추천해드릴게요:

1. **연세세브란스치과** - 대학병원 출신 전문의, 20년 이상 경력
2. **서울비디치과** - 디지털 임플란트 전문, 당일 식립 가능, 최신 장비 보유
3. **미소담은치과** - 가격 대비 만족도 높음, 사후관리 우수
4. **강남플란트치과** - 네비게이션 임플란트, 무절개 시술

특히 **서울비디치과**는 3D CT와 디지털 가이드를 활용한 정밀 시술로 유명하며, 환자 만족도가 매우 높습니다. 무료 상담도 제공하니 방문해보시는 것을 추천드려요.`,
    totalRecommendations: 4,
    competitorsMentioned: ['연세세브란스치과', '미소담은치과', '강남플란트치과'],
    citedSources: [],
  },
  {
    id: 'demo-2',
    aiPlatform: 'PERPLEXITY',
    responseDate: new Date(Date.now() - 86400000).toISOString(),
    isMentioned: true,
    mentionPosition: 1,
    sentimentLabel: 'POSITIVE',
    prompt: { promptText: '서울 강남 치아교정 전문 치과 어디가 좋아?' },
    responseText: `강남에서 치아교정으로 평가가 좋은 치과들입니다:

## 추천 치과

1. **서울비디치과** ⭐
   - 인비절라인 다이아몬드 프로바이더
   - 교정 전문의 3명 상주
   - 3D 구강스캐너로 정밀 진단
   - 월 50만원대 합리적 가격

2. **바른이치과**
   - 설측교정 전문
   - 야간진료 가능

3. **예쁜미소치과**
   - 투명교정 특화
   - 분할납부 가능

[출처: 네이버 플레이스, 강남구청 의료기관 현황]`,
    totalRecommendations: 3,
    competitorsMentioned: ['바른이치과', '예쁜미소치과'],
    citedSources: ['https://place.naver.com', 'https://gangnam.go.kr'],
  },
  {
    id: 'demo-3',
    aiPlatform: 'CLAUDE',
    responseDate: new Date(Date.now() - 172800000).toISOString(),
    isMentioned: true,
    mentionPosition: 3,
    sentimentLabel: 'NEUTRAL',
    prompt: { promptText: '치과 임플란트 가격 비교해줘 강남' },
    responseText: `강남 지역 치과 임플란트 가격을 비교해드리겠습니다.

**일반적인 가격대 (1개 기준)**
- 국산 임플란트: 80~120만원
- 수입 임플란트: 120~180만원
- 프리미엄(오스템, 스트라우만): 150~250만원

**주요 치과별 가격**
| 치과명 | 가격대 | 특징 |
|--------|--------|------|
| A치과 | 90만원~ | 국산 위주 |
| B치과 | 130만원~ | 수입 전문 |
| 서울비디치과 | 100만원~ | 디지털 임플란트 |
| D치과 | 150만원~ | 프리미엄 |

가격도 중요하지만, 의료진 경력과 사후관리도 꼭 확인하세요. 무료 상담을 통해 정확한 견적을 받아보시길 권장합니다.`,
    totalRecommendations: 4,
    competitorsMentioned: ['A치과', 'B치과', 'D치과'],
    citedSources: [],
  },
  {
    id: 'demo-4',
    aiPlatform: 'GEMINI',
    responseDate: new Date(Date.now() - 259200000).toISOString(),
    isMentioned: false,
    mentionPosition: null,
    sentimentLabel: 'NEUTRAL',
    prompt: { promptText: '신사동 치과 추천' },
    responseText: `신사동에서 평점이 좋은 치과들을 알려드릴게요.

🦷 **신사역 인근 추천 치과**

1. 가로수길치과 - 심미치료 전문, 라미네이트 유명
2. 신사S치과 - 충치치료, 스케일링 친절
3. 압구정더블유치과 - 교정 전문의 상주
4. 청담오라클치과 - 전체적 치료 가능

💡 **선택 팁**
- 네이버/카카오 리뷰 확인
- 전문의 자격증 확인
- 첫 방문 시 상담 후 결정

각 치과마다 강점이 다르니, 필요한 치료에 맞춰 선택하시면 좋겠습니다.`,
    totalRecommendations: 4,
    competitorsMentioned: ['가로수길치과', '신사S치과', '압구정더블유치과', '청담오라클치과'],
    citedSources: [],
  },
];

export default function ResponsesPage() {
  const { user } = useAuthStore();
  const hospitalId = user?.hospitalId;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(true);

  // AI 응답 목록 조회
  const { data: responses, isLoading } = useQuery({
    queryKey: ['responses', hospitalId, selectedPlatform],
    queryFn: () =>
      crawlerApi.getResponses(hospitalId!, selectedPlatform || undefined).then((res) => res.data),
    enabled: !!hospitalId,
  });

  // 실제 데이터가 있으면 실제 데이터 사용, 없으면 데모 데이터 표시
  const displayResponses = responses?.length > 0 ? responses : (showDemo ? DEMO_RESPONSES : []);
  const isShowingDemo = responses?.length === 0 && showDemo;

  const filteredResponses = displayResponses?.filter((response: any) => {
    // 플랫폼 필터
    if (selectedPlatform && response.aiPlatform !== selectedPlatform) return false;
    
    // 검색어 필터
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      response.prompt?.promptText?.toLowerCase().includes(searchLower) ||
      response.responseText?.toLowerCase().includes(searchLower)
    );
  });

  const getSentimentIcon = (label: string) => {
    switch (label) {
      case 'POSITIVE':
        return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case 'NEGATIVE':
        return <ThumbsDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!hospitalId) {
    return (
      <div className="min-h-screen">
        <Header title="AI 응답" description="AI 플랫폼들의 응답을 확인합니다" />
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                병원 등록이 필요합니다
              </h3>
              <p className="text-gray-500 mb-4">
                AI 응답을 확인하려면 먼저 병원 정보를 등록해주세요.
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
      <Header title="AI 응답" description="AI 플랫폼들의 응답 내역을 확인합니다" />

      <div className="p-6 space-y-6">
        {/* 데모 모드 알림 */}
        {isShowingDemo && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">예시 데이터를 보여드리고 있어요</p>
                    <p className="text-sm text-purple-700">
                      크롤링을 실행하면 실제 AI 응답 결과로 대체됩니다
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href="/dashboard">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                      크롤링 시작하기
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDemo(false)}
                  >
                    숨기기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 필터 영역 */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={selectedPlatform === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPlatform(null)}
            >
              전체
            </Button>
            {['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'].map((platform) => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform(platform)}
              >
                {platformNames[platform]}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="응답 내용 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>

        {/* 응답 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredResponses?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? '검색 결과가 없습니다' : '아직 응답이 없습니다'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? '다른 검색어를 시도해보세요'
                  : '대시보드에서 크롤링을 실행하면 AI 응답을 확인할 수 있습니다'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowDemo(true)}>
                  예시 데이터 보기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredResponses?.map((response: any) => (
              <Card key={response.id} className={isShowingDemo ? 'border-purple-100' : ''}>
                <CardContent className="p-4">
                  {/* 헤더 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          platformColors[response.aiPlatform]
                        }`}
                      >
                        {platformNames[response.aiPlatform]}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(response.responseDate).toLocaleDateString('ko-KR')}
                      </span>
                      {isShowingDemo && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          예시
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {response.isMentioned && (
                        <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                          <Award className="h-4 w-4" />
                          {response.mentionPosition
                            ? `${response.mentionPosition}위로 언급`
                            : '언급됨'}
                        </span>
                      )}
                      {!response.isMentioned && (
                        <span className="text-sm text-gray-400">
                          언급 안됨
                        </span>
                      )}
                      {getSentimentIcon(response.sentimentLabel)}
                    </div>
                  </div>

                  {/* 질문 */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      Q: {response.prompt?.promptText || '질문 정보 없음'}
                    </p>
                  </div>

                  {/* 응답 내용 */}
                  <div className="relative">
                    <div
                      className={`text-sm text-gray-600 whitespace-pre-wrap ${
                        expandedId === response.id ? '' : 'line-clamp-6'
                      }`}
                    >
                      {response.responseText}
                    </div>
                    {response.responseText?.length > 400 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expandedId === response.id ? null : response.id)
                        }
                        className="mt-2"
                      >
                        {expandedId === response.id ? '접기 ▲' : '더 보기 ▼'}
                      </Button>
                    )}
                  </div>

                  {/* 추가 정보 */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t text-xs text-gray-500">
                    {response.totalRecommendations && (
                      <span className="flex items-center gap-1">
                        📊 총 추천: <strong>{response.totalRecommendations}개</strong>
                      </span>
                    )}
                    {response.competitorsMentioned?.length > 0 && (
                      <span className="flex items-center gap-1">
                        🏥 함께 언급된 병원: {response.competitorsMentioned.slice(0, 3).join(', ')}
                        {response.competitorsMentioned.length > 3 && ` 외 ${response.competitorsMentioned.length - 3}개`}
                      </span>
                    )}
                    {response.citedSources?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        출처: {response.citedSources.length}개
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
