import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from '@/hooks/useToast';

// Production API URL
const API_BASE_URL = 'https://patient-signal.onrender.com/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// Refresh Token 상태 관리 (중복 갱신 방지)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor - 토큰 추가
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - 401 시 자동 토큰 갱신
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401이고, 아직 재시도 안 한 요청이고, refresh 요청 자체는 아닌 경우
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      // 이미 다른 요청이 갱신 중이면 대기열에 추가
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Refresh Token으로 새 Access Token 발급
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken || refreshToken;

        // 새 토큰 저장
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Zustand store도 업데이트 (직접 접근)
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            parsed.state.accessToken = newAccessToken;
            parsed.state.refreshToken = newRefreshToken;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        } catch {}

        // 대기 중인 요청들에게 새 토큰 전달
        processQueue(null, newAccessToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh도 실패 → 로그아웃
        processQueue(refreshError, null);

        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('auth-storage');
          toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// 403 플랜 에러 전역 처리 (개별 컴포넌트에서 catch하지 않은 경우)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 403) {
      const data = error.response?.data as any;
      if (data?.error === 'PLAN_UPGRADE_REQUIRED' || data?.error === 'PLAN_LIMIT_REACHED' || data?.error === 'FEATURE_NOT_AVAILABLE' || data?.error === 'MONTHLY_CRAWL_LIMIT') {
        // 토스트로 안내 (컴포넌트에서 catch하지 않은 경우)
        toast.warning(data?.message || '플랜 업그레이드가 필요합니다.');
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string; isPfMember?: boolean }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  googleLogin: (idToken: string) =>
    api.post('/auth/google', { idToken }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  getProfile: () =>
    api.get('/auth/profile'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Hospital API
export const hospitalApi = {
  create: (data: any) =>
    api.post('/hospitals', data),
  get: (id: string) =>
    api.get(`/hospitals/${id}`),
  update: (id: string, data: any) =>
    api.put(`/hospitals/${id}`, data),
  getDashboard: (id: string) =>
    api.get(`/hospitals/${id}/dashboard`),
};

// Prompts API
export const promptsApi = {
  create: (hospitalId: string, data: any) =>
    api.post(`/prompts/${hospitalId}`, data),
  list: (hospitalId: string) =>
    api.get(`/prompts/${hospitalId}`),
  delete: (id: string) =>
    api.delete(`/prompts/${id}`),
  toggle: (id: string) =>
    api.post(`/prompts/${id}/toggle`),
  generateFanouts: (id: string) =>
    api.post(`/prompts/${id}/fanouts`),
};

// AI Crawler API
export const crawlerApi = {
  trigger: (hospitalId: string) =>
    api.post(`/ai-crawler/crawl/${hospitalId}`),
  getJobStatus: (jobId: string) =>
    api.get(`/ai-crawler/job/${jobId}`),
  getResponses: (hospitalId: string, params?: { platform?: string; limit?: number; offset?: number; mentioned?: string }) => {
    // undefined/null 파라미터 제거
    const cleanParams: Record<string, any> = { limit: 50 };
    if (params?.platform) cleanParams.platform = params.platform;
    if (params?.limit) cleanParams.limit = params.limit;
    if (params?.offset) cleanParams.offset = params.offset;
    if (params?.mentioned) cleanParams.mentioned = params.mentioned;
    return api.get(`/ai-crawler/responses/${hospitalId}`, { params: cleanParams });
  },
  calculateScore: (hospitalId: string) =>
    api.post(`/ai-crawler/score/${hospitalId}`),
  // Phase 1: 인사이트 분석
  getMentionAnalysis: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/mention-analysis/${hospitalId}`, { params: { days }, timeout: 60000 }),
  getResponseTrend: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/trend/${hospitalId}`, { params: { days }, timeout: 60000 }),
  getSourceAnalysis: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/sources/${hospitalId}`, { params: { days }, timeout: 60000 }),
  // ✅ 새로 추가: 상세 출처 분석
  getSourceDiagnostic: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/sources-diagnostic/${hospitalId}`, { params: { days }, timeout: 60000 }),
  getTopUrls: (hospitalId: string, days?: number, limit?: number) =>
    api.get(`/ai-crawler/insights/top-urls/${hospitalId}`, { params: { days, limit }, timeout: 60000 }),
  getUrlMatrix: (hospitalId: string, days?: number, topN?: number) =>
    api.get(`/ai-crawler/insights/url-matrix/${hospitalId}`, { params: { days, topN }, timeout: 60000 }),
  getBreadthInsights: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/breadth/${hospitalId}`, { params: { days }, timeout: 120000 }),
  // Phase 2: 심화 인사이트
  getPositioningMap: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/positioning/${hospitalId}`, { params: { days }, timeout: 60000 }),
  getSourceQuality: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/insights/source-quality/${hospitalId}`, { params: { days }, timeout: 60000 }),
  getActionReport: (hospitalId: string) =>
    api.get(`/ai-crawler/insights/action-report/${hospitalId}`, { timeout: 60000 }),
  // Phase 2: 콘텐츠 갭 분석
  analyzeContentGap: (hospitalId: string) =>
    api.post(`/ai-crawler/content-gap/${hospitalId}`),
  generateBlogDraft: (hospitalId: string, gapId: string) =>
    api.post(`/ai-crawler/content-gap/${hospitalId}/blog-draft/${gapId}`),
  // 실시간 AI 질문
  liveQuery: (hospitalId: string, data: { question: string; platforms?: string[] }) =>
    api.post(`/ai-crawler/live-query/${hospitalId}`, data, { timeout: 120000 }),
  getLiveQueryUsage: (hospitalId: string) =>
    api.get(`/ai-crawler/live-query/usage/${hospitalId}`),
  getLiveQueryCategoryStats: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/live-query/category-stats/${hospitalId}`, { params: { days } }),
  getCategoryAnalysis: (hospitalId: string, days?: number) =>
    api.get(`/ai-crawler/category-analysis/${hospitalId}`, { params: { days } }),
  // B4: 마지막 분석 시간 조회
  getLastAnalysis: (hospitalId: string) =>
    api.get(`/ai-crawler/last-analysis/${hospitalId}`),
};

// GEO Content API
export const geoContentApi = {
  list: (params?: { status?: string; funnelStage?: string; limit?: number; offset?: number }) =>
    api.get('/geo-content', { params }),
  getStats: () =>
    api.get('/geo-content/stats'),
  getOne: (id: string) =>
    api.get(`/geo-content/${id}`),
  generate: (data: {
    topic: string;
    funnelStage: string;
    contentTone?: string;
    targetKeywords?: string[];
    procedure?: string;
    relatedPromptIds?: string[];
    additionalInstructions?: string;
  }) =>
    api.post('/geo-content/generate', data, { timeout: 120000 }),
  update: (id: string, data: any) =>
    api.patch(`/geo-content/${id}`, data),
  delete: (id: string) =>
    api.delete(`/geo-content/${id}`),
  publish: (id: string, data: { platform: string; publishedUrl?: string; scheduledAt?: string }) =>
    api.post(`/geo-content/${id}/publish`, data),
};

// Citation Analysis & Content Calendar API
export const citationApi = {
  // 인용 역분석
  analyze: (hospitalId: string, data: { query: string; maxPages?: number }) =>
    api.post(`/citation-analysis/${hospitalId}/analyze`, data, { timeout: 120000 }),
  analyzeBulk: (hospitalId: string, data?: { limit?: number }) =>
    api.post(`/citation-analysis/${hospitalId}/analyze-bulk`, data || {}, { timeout: 300000 }),
  getRecent: (hospitalId: string, limit?: number) =>
    api.get(`/citation-analysis/${hospitalId}/recent`, { params: { limit } }),
  getStats: (hospitalId: string) =>
    api.get(`/citation-analysis/${hospitalId}/stats`),
  getGeoPrompt: (hospitalId: string, targetKeyword: string) =>
    api.post(`/citation-analysis/${hospitalId}/geo-prompt`, { targetKeyword }, { timeout: 120000 }),
  // 56주 콘텐츠 캘린더
  generateCalendar: (hospitalId: string) =>
    api.post(`/citation-analysis/${hospitalId}/calendar`, {}, { timeout: 120000 }),
  getCalendar: (hospitalId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    api.get(`/citation-analysis/${hospitalId}/calendar`, { params }),
  analyzeCalendarWeek: (hospitalId: string, weekNumber: number) =>
    api.post(`/citation-analysis/${hospitalId}/calendar/${weekNumber}/analyze`, {}, { timeout: 120000 }),
  updateCalendarItem: (hospitalId: string, weekNumber: number, data: any) =>
    api.patch(`/citation-analysis/${hospitalId}/calendar/${weekNumber}`, data),
};

// Scores API
export const scoresApi = {
  getLatest: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/latest`),
  getHistory: (hospitalId: string, days?: number) =>
    api.get(`/scores/${hospitalId}/history`, { params: { days } }),
  getPlatforms: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/platforms`),
  getSpecialties: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/specialties`),
  getWeekly: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/weekly`),
  // 전체 순위 + 상위 % + 등급 뱃지
  getRanking: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/ranking`),
  // 초고도화 ABHS
  getABHS: (hospitalId: string, days?: number) =>
    api.get(`/scores/${hospitalId}/abhs`, { params: { days } }),
  getCompetitiveShare: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/abhs/competitive-share`),
  getActionIntelligence: (hospitalId: string) =>
    api.get(`/scores/${hospitalId}/abhs/actions`),
};

// Competitors API
export const competitorsApi = {
  list: (hospitalId: string) =>
    api.get(`/competitors/${hospitalId}`),
  add: (hospitalId: string, data: { competitorName: string; competitorRegion?: string }) =>
    api.post(`/competitors/${hospitalId}`, data),
  remove: (id: string, hospitalId: string) =>
    api.delete(`/competitors/${id}/${hospitalId}`),
  suggest: (hospitalId: string) =>
    api.post(`/competitors/${hospitalId}/suggest`),
  acceptSuggestion: (hospitalId: string, data: { competitorName: string; competitorRegion?: string }) =>
    api.post(`/competitors/${hospitalId}/accept-suggestion`, data),
  getComparison: (hospitalId: string) =>
    api.get(`/competitors/${hospitalId}/comparison`),
  getInactive: (hospitalId: string) =>
    api.get(`/competitors/${hospitalId}/inactive`),
  restoreAll: (hospitalId: string) =>
    api.post(`/competitors/${hospitalId}/restore-all`),
  restoreOne: (hospitalId: string, competitorId: string) =>
    api.post(`/competitors/${hospitalId}/restore/${competitorId}`),
};

// Query Templates API (쿼리 템플릿 & 진료과 프리셋)
export const queryTemplatesApi = {
  // 진료과 목록 (공개)
  getAllSpecialties: () =>
    api.get('/query-templates/specialties'),
  // 진료과별 시술 목록 (공개)
  getSpecialtyProcedures: (type: string) =>
    api.get(`/query-templates/specialties/${type}/procedures`),
  // 쿼리 미리보기 (공개)
  previewQueries: (data: { region: string; specialtyType: string; procedures: string[]; includeMonthly?: boolean }) =>
    api.post('/query-templates/preview', data),
  // 병원 맞춤 쿼리 자동 생성 (인증 필요)
  generateQueries: (hospitalId: string, includeMonthly?: boolean) =>
    api.post(`/query-templates/generate/${hospitalId}`, null, { params: { includeMonthly } }),
  // 병원 맞춤 질문 제안
  suggestQuestions: (hospitalId: string) =>
    api.get(`/query-templates/suggest/${hospitalId}`),
  // 시드 데이터 (관리자)
  seedPresets: () =>
    api.post('/query-templates/seed/presets'),
  seedTemplates: () =>
    api.post('/query-templates/seed/templates'),
};

// Scheduler / Matrix API
export const schedulerApi = {
  // 매트릭스 미리보기 (저장 없이)
  matrixPreview: (hospitalId: string) =>
    api.get(`/scheduler/matrix-preview/${hospitalId}`),
  // 스케줄러 상태
  status: () =>
    api.get('/scheduler/status'),
};

// Subscriptions API
export const subscriptionsApi = {
  getMySubscription: () =>
    api.get('/subscriptions/me'),
  getUsage: () =>
    api.get('/subscriptions/usage'),
  cancel: () =>
    api.post('/subscriptions/cancel'),
  reactivate: () =>
    api.post('/subscriptions/reactivate'),
  upgrade: (planType: string) =>
    api.patch('/subscriptions/upgrade', { planType }),
  getPlanLimits: (planType: string) =>
    api.get(`/subscriptions/plans/${planType}/limits`),
  comparePlans: () =>
    api.get('/subscriptions/plans/compare'),
};

// Coupons API
export const couponsApi = {
  validate: (code: string, planType: string) =>
    api.post('/coupons/validate', { code, planType }),
  apply: (code: string, planType: string) =>
    api.post('/coupons/apply', { code, planType }),
};

// API Key 관리 API
export const apiKeyApi = {
  create: (data: { name?: string }) =>
    api.post('/api-keys', data),
  list: () =>
    api.get('/api-keys'),
  revoke: (keyId: string) =>
    api.delete(`/api-keys/${keyId}`),
};

// Payments API
export const paymentsApi = {
  confirm: (data: { paymentKey: string; orderId: string; amount: number; hospitalId?: string; userId?: string }) =>
    api.post('/payments/confirm', data),
  save: (data: any) =>
    api.post('/payments/save', data),
  getPayment: (orderId: string) =>
    api.get(`/payments/${orderId}`),
  getSubscriptionStatus: (hospitalId: string) =>
    api.get(`/payments/subscription/${hospitalId}`),
  getMyPayments: () =>
    api.get('/payments/user/history'),
  issueBillingKey: (data: { authKey: string; customerKey: string; hospitalId: string; planType?: string }) =>
    api.post('/payments/billing/issue', data),
  deleteBillingKey: (hospitalId: string) =>
    api.post('/payments/billing/delete', { hospitalId }),
  getBillingInfo: (hospitalId: string) =>
    api.get(`/payments/billing/${hospitalId}`),
};
