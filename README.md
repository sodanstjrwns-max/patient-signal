# 🏥 Patient Signal V2 (페이션트 시그널)

**병원 전문 AI 검색 가시성 추적 플랫폼 (AEO SaaS)**

13개 전체 진료과를 지원하는 한국 병원 전문 AI 검색 가시성 추적 서비스입니다.
ChatGPT, Perplexity, Claude, Gemini 4개 AI 플랫폼에서 병원이 어떻게 노출되고 추천되는지 
ABHS 5축 프레임워크로 정밀 분석합니다.

---

## 🎯 V2 업그레이드 요약 (2026.04.17)

### 핵심 변경사항
| 항목 | V1 | V2 |
|------|----|----|
| **진료과** | 6개 (치과 중심) | **13개 전체 진료과** |
| **온보딩** | 5단계 | **3-Step 강제 퍼널** |
| **브랜딩** | 일반적 | **병원 전문 AEO 플랫폼** |
| **시술 프리셋** | 7개 진료과 | **13개 진료과 × 8~13개 시술** |
| **신규 페이지** | - | **Citation, Opportunity** |
| **자동 질문** | 온보딩 1회 | **매일 10개 자동 생성** |
| **Golden Prompt** | 없음 | **ABHS 5축 기반 최적 질문 분석** |

---

## ✅ 완성된 기능

### Phase 1: 핵심 인프라
- **Backend (NestJS 10)**: JWT 인증, 병원 CRUD, 프롬프트 관리, AI 크롤링
- **Frontend (Next.js 14)**: 랜딩, 온보딩, 대시보드, 인사이트
- **Database (PostgreSQL + Prisma)**: 17개 테이블, 완전 관계형 스키마
- **AI 크롤링**: ChatGPT(웹검색), Claude(웹검색), Perplexity, Gemini(grounding)
- **ABHS 프레임워크**: 5축 평가 (SoV, Sentiment V2, Depth R0-R3, Platform Weight, Intent)

### Phase 2: V2 업그레이드 (NEW)
- **13개 진료과 지원**: 치과, 피부과, 성형외과, 정형외과, 한의원, 안과, 내과, 비뇨의학과, 이비인후과, 정신건강의학과, 산부인과, 소아청소년과, 기타
- **3-Step 온보딩 퍼널**: 기본정보 → 주력진료 → AI 분석 시작
- **Citation 페이지**: AI가 참고하는 인용 출처 추적 (도메인별/카테고리별)
- **Opportunity 페이지**: 경쟁사는 AI 추천O, 우리 병원 미언급인 기회 감지
- **Daily Prompt Refresh**: 매일 자동 질문 10개 생성 (시즌/트렌드/말투 변형)
- **Golden Prompt 분석**: ABHS 5축 기준 최고 성과 질문 패턴 식별

---

## 📑 페이지 목록 & URI

| 경로 | 설명 | 인증 |
|------|------|------|
| `/` | 랜딩 페이지 | 공개 |
| `/login` | 로그인 | 공개 |
| `/register` | 회원가입 | 공개 |
| `/onboarding` | 3-Step 병원 등록 | 로그인 |
| `/dashboard` | 메인 대시보드 (SoV 중심) | 로그인 |
| `/dashboard/report` | 주간 리포트 | 로그인 |
| `/dashboard/prompts` | 질문 관리 | 로그인 |
| `/dashboard/responses` | AI 응답 원문 | 로그인 |
| `/dashboard/live-query` | 실시간 질문 | 로그인 |
| `/dashboard/category-analysis` | 카테고리 성과 | 로그인 |
| `/dashboard/citations` | **인용 출처 분석** (NEW) | 로그인 |
| `/dashboard/opportunities` | **기회 분석** (NEW) | 로그인 |
| `/dashboard/insights` | AI 인사이트 | 로그인 |
| `/dashboard/analytics` | ABHS 분석 | 로그인 |
| `/dashboard/competitors` | 경쟁사 분석 | 로그인 |
| `/dashboard/billing` | 결제/구독 | 로그인 |
| `/dashboard/settings` | 설정 | 로그인 |
| `/pricing` | 요금제 | 공개 |
| `/guide` | 사용 가이드 | 공개 |

---

## 🔌 API 엔드포인트

### Scores API
| Method | Path | 설명 |
|--------|------|------|
| GET | `/scores/:hospitalId/latest` | 최신 점수 |
| GET | `/scores/:hospitalId/history?days=30` | 점수 히스토리 |
| GET | `/scores/:hospitalId/platforms` | 플랫폼별 분석 |
| GET | `/scores/:hospitalId/weekly` | 주간 하이라이트 |
| GET | `/scores/:hospitalId/citations` | 인용 출처 분석 |
| GET | `/scores/:hospitalId/source-hints` | 소스 힌트 상세 (NEW) |
| GET | `/scores/:hospitalId/content-gaps` | Content Gap 목록 (NEW) |
| GET | `/scores/:hospitalId/opportunity-analysis` | 기회 분석 (NEW) |
| GET | `/scores/:hospitalId/prompt-heatmap` | 프롬프트 히트맵 |
| GET | `/scores/:hospitalId/abhs` | ABHS 종합 점수 |
| GET | `/scores/:hospitalId/abhs/competitive-share` | 경쟁사 점유율 |
| GET | `/scores/:hospitalId/abhs/actions` | 액션 인텔리전스 |
| GET | `/scores/:hospitalId/abhs/golden-prompts` | Golden Prompt 분석 (NEW) |

### Scheduler API
| Method | Path | 설명 |
|--------|------|------|
| POST | `/scheduler/daily-crawl` | 자동 크롤링 (Cron) |
| POST | `/scheduler/daily-prompt-refresh` | 일일 자동 질문 생성 (NEW) |
| GET | `/scheduler/status` | 스케줄러 상태 |

---

## 🏗️ 기술 스택

**Frontend**: Next.js 14 + TypeScript + Tailwind CSS + TanStack Query + Zustand + Recharts
**Backend**: NestJS 10 + Prisma ORM + PostgreSQL 15 + JWT/Passport
**AI 연동**: OpenAI API, Anthropic API, Perplexity API, Google Gemini API
**결제**: 토스페이먼츠

---

## 🚀 독자 프레임워크

### ABHS (AI-Based Hospital Score) 5축 평가
1. **Voice Share (SoV)**: AI 응답에서 병원이 언급되는 비율
2. **Sentiment V2**: 언급 시 감성 분류 (-2강한부정 ~ +2강한긍정)
3. **Recommendation Depth**: R0(미언급)~R3(단독추천) 깊이
4. **Platform Weight**: Perplexity 1.4, ChatGPT 1.3, Gemini 1.2, Claude 1.0
5. **Intent Match**: 예약(×1.5), 후기(×1.3), 공포(×1.2), 비교(×1.1), 정보(×1.0)

### Golden Prompt
- ABHS 5축 기여분이 가장 높은 질문 패턴 자동 식별
- Golden Score = SoV × (1 + Sentiment/2) × (1 + R3Rate/100) × IntentMultiplier

---

## 📋 다음 단계

- [ ] 대시보드 SoV 중심 리디자인 (Single North-Star Metric)
- [ ] 네이버 Cue 스크래핑 추가
- [ ] BullMQ 백그라운드 크롤링
- [ ] 카카오톡 알림톡 연동
- [ ] 월간 PDF 리포트 자동 생성·발송
- [ ] GEO 콘텐츠 생성 (반말 스타일)
- [ ] 25축 매트릭스 시각화 대시보드
- [ ] 요금제별 Feature Gate 강화

---

*Patient Signal by 페이션트퍼널 · 2026.04.17 V2 Update*
