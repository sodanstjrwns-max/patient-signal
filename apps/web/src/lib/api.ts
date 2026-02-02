import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor - 에러 처리
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 시 로그아웃
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
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
  getResponses: (hospitalId: string, platform?: string) =>
    api.get(`/ai-crawler/responses/${hospitalId}`, { params: { platform } }),
  calculateScore: (hospitalId: string) =>
    api.post(`/ai-crawler/score/${hospitalId}`),
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
};

// Competitors API
export const competitorsApi = {
  list: (hospitalId: string) =>
    api.get(`/competitors/${hospitalId}`),
  add: (hospitalId: string, data: { competitorName: string; competitorRegion?: string }) =>
    api.post(`/competitors/${hospitalId}`, data),
  remove: (id: string, hospitalId: string) =>
    api.delete(`/competitors/${id}/${hospitalId}`),
  autoDetect: (hospitalId: string) =>
    api.post(`/competitors/${hospitalId}/auto-detect`),
  getComparison: (hospitalId: string) =>
    api.get(`/competitors/${hospitalId}/comparison`),
};
