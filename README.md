# Patient Signal V2 (페이션트 시그널)

**병원 전문 AI 검색 가시성 추적 플랫폼 (AEO SaaS)**

13개 전체 진료과를 지원하는 한국 병원 전문 AI 검색 가시성 추적 서비스입니다.
ChatGPT, Perplexity, Claude, Gemini 4개 AI 플랫폼에서 병원이 어떻게 노출되고 추천되는지 
ABHS 5축 프레임워크로 정밀 분석합니다.

---

## V2 업그레이드 요약 (2026.04.17)

### 핵심 변경사항
| 항목 | V1 | V2 |
|------|----|----|
| **진료과** | 6개 (치과 중심) | **13개 전체 진료과** |
| **온보딩** | 5단계 | **3-Step 강제 퍼널** |
| **브랜딩** | 일반적 | **병원 전문 AEO 플랫폼** |
| **시술 프리셋** | 7개 진료과 | **13개 진료과 x 8~13개 시술** |
| **신규 페이지** | - | **Citation, Opportunity** |
| **자동 질문** | 온보딩 1회 | **매일 10개 자동 생성** |
| **Golden Prompt** | 없음 | **ABHS 5축 기반 최적 질문 분석** |
| **대시보드** | 점수 나열 | **SoV North-Star Metric 중심** |
| **사이드바** | 13개 1자 나열 | **5그룹 접이식 네비게이션** |

---

## 완성된 기능

### Phase 1: 핵심 인프라
- **Backend (NestJS 10)**: JWT 인증, 병원 CRUD, 프롬프트 관리, AI 크롤링
- **Frontend (Next.js 14)**: 랜딩, 온보딩, 대시보드, 인사이트
- **Database (PostgreSQL + Prisma)**: 17개 테이블, 완전 관계형 스키마
- **AI 크롤링**: ChatGPT(웹검색), Claude(웹검색), Perplexity, Gemini(grounding)
- **ABHS 프레임워크**: 5축 평가 (SoV, Sentiment V2, Depth R0-R3, Platform Weight, Intent)

### Phase 2: V2 업그레이드
- **13개 진료과 지원**: 치과, 피부과, 성형외과, 정형외과, 한의원, 안과, 내과, 비뇨의학과, 이비인후과, 정신건강의학과, 산부인과, 소아청소년과, 기타
- **3-Step 온보딩 퍼널**: 기본정보 -> 주력진료 -> AI 분석 시작
- **Citation 페이지**: AI가 참고하는 인용 출처 추적 (도메인별/카테고리별)
- **Opportunity 페이지**: 경쟁사는 AI 추천O, 우리 병원 미언급인 기회 감지
- **Daily Prompt Refresh**: 매일 자동 질문 10개 생성 (시즌/트렌드/말투 변형)
- **Golden Prompt 분석**: ABHS 5축 기준 최고 성과 질문 패턴 식별

### Phase 3-C: SoV 대시보드 리디자인 (NEW)
- **SoV North-Star Hero**: Voice Share %를 최상단 초대형 표시 (Single North-Star Metric)
- **플랫폼별 SoV 미니카드**: ChatGPT/Perplexity/Claude/Gemini 각각의 멘션률 + 트렌드
- **핵심 지표 3칸 요약**: 감성분석 / 인용출처(NEW 뱃지) / 기회분석(NEW 뱃지)
- **사이드바 5그룹 네비게이션**: 개요 / 모니터링 / 분석 / 경쟁 / 관리
- **접이식 그룹**: 현재 페이지가 속한 그룹 자동 열림
- **NEW 뱃지**: 인용 출처, 기회 분석 메뉴에 NEW 표시로 발견성 향상
- **여정 네비게이터 간소화**: 5-Step compact 버전

---

## 페이지 목록 & URI

| 경로 | 설명 | 인증 |
|------|------|------|
| `/` | 랜딩 페이지 | 공개 |
| `/login` | 로그인 | 공개 |
| `/register` | 회원가입 | 공개 |
| `/onboarding` | 3-Step 병원 등록 | 로그인 |
| `/dashboard` | 메인 대시보드 (SoV North-Star) | 로그인 |
| `/dashboard/funnel` | **AI 환자 퍼널 진단** (NEW) | 로그인 |
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

### 사이드바 그룹 구조
```
개요        → 대시보드, 주간 리포트
모니터링    → 질문 관리, AI 응답, 실시간 질문
분석        → ABHS 분석, 카테고리 성과, 인용 출처(NEW), 기회 분석(NEW), AI 인사이트
경쟁        → 경쟁사
관리        → 결제/구독, 설정
```

---

## API 엔드포인트

### Scores API
| Method | Path | 설명 |
|--------|------|------|
| GET | `/scores/:hospitalId/latest` | 최신 점수 |
| GET | `/scores/:hospitalId/history?days=30` | 점수 히스토리 |
| GET | `/scores/:hospitalId/platforms` | 플랫폼별 분석 |
| GET | `/scores/:hospitalId/weekly` | 주간 하이라이트 |
| GET | `/scores/:hospitalId/citations` | 인용 출처 분석 |
| GET | `/scores/:hospitalId/source-hints` | 소스 힌트 상세 |
| GET | `/scores/:hospitalId/content-gaps` | Content Gap 목록 |
| GET | `/scores/:hospitalId/opportunity-analysis` | 기회 분석 |
| GET | `/scores/:hospitalId/prompt-heatmap` | 프롬프트 히트맵 |
| GET | `/scores/:hospitalId/abhs` | ABHS 종합 점수 |
| GET | `/scores/:hospitalId/abhs/competitive-share` | 경쟁사 점유율 |
| GET | `/scores/:hospitalId/abhs/actions` | 액션 인텔리전스 |
| GET | `/scores/:hospitalId/abhs/golden-prompts` | Golden Prompt 분석 |
| GET | `/scores/:hospitalId/funnel` | **AI 환자 퍼널 진단** (단계별 SoV + 누수 + 신환 임팩트) |

### Scheduler API
| Method | Path | 설명 |
|--------|------|------|
| POST | `/scheduler/daily-crawl` | 자동 크롤링 (Cron) |
| POST | `/scheduler/daily-prompt-refresh` | 일일 자동 질문 생성 |
| GET | `/scheduler/status` | 스케줄러 상태 |

---

## 기술 스택

**Frontend**: Next.js 14 + TypeScript + Tailwind CSS + TanStack Query + Zustand + Recharts
**Backend**: NestJS 10 + Prisma ORM + PostgreSQL 15 + JWT/Passport
**AI 연동**: OpenAI API, Anthropic API, Perplexity API, Google Gemini API
**결제**: 토스페이먼츠

---

## 독자 프레임워크

### ABHS (AI-Based Hospital Score) 5축 평가
1. **Voice Share (SoV)**: AI 응답에서 병원이 언급되는 비율 ← North-Star Metric
2. **Sentiment V2**: 언급 시 감성 분류 (-2 강한부정 ~ +2 강한긍정)
3. **Recommendation Depth**: R0(미언급)~R3(단독추천) 깊이
4. **Platform Weight**: Perplexity 1.4, ChatGPT 1.3, Gemini 1.2, Claude 1.0
5. **Intent Match**: 예약(x1.5), 후기(x1.3), 공포(x1.2), 비교(x1.1), 정보(x1.0)

### AI 환자 퍼널 진단 (NEW — Patient Funnel × AEO)
범용 AEO 툴과의 결정적 차별점. 질문 의도(QueryIntent)를 환자 여정 4단계로 매핑:
1. **인지(AWARENESS)** ← INFORMATION — "이 시술이 뭐지? 가격은?"
2. **탐색·비교(COMPARISON)** ← COMPARISON — "우리 동네에서 어디가 잘하지?"
3. **신뢰 검증(TRUST)** ← REVIEW + FEAR — "이 병원 진짜 괜찮을까?"
4. **결정·예약(DECISION)** ← RESERVATION — "지금 예약 가능한 곳은?"

- 단계별 SoV vs 벤치마크 → 누수(Leak) 단계 자동 감지
- 13개 진료과별 객단가 × 보수적 전환율(3%) → **월간 신환/매출 기회손실 환산**
- 단계별 병원 전문 액션 플레이북 (플레이스 리뷰, 모두닥 프로필, 후기 콘텐츠, 예약 연동 처방)
- 퍼널 건강 점수(0~100) + A~D 등급

### Golden Prompt
- ABHS 5축 기여분이 가장 높은 질문 패턴 자동 식별
- Golden Score = SoV x (1 + Sentiment/2) x (1 + R3Rate/100) x IntentMultiplier

---

## 2026.07 P0/P1 대개편 (보안 + 인프라)

### P0 — 보안 (전 항목 완료)
| 항목 | 내용 |
|------|------|
| **IDOR 차단** | `HospitalOwnershipGuard` 신설 — `:hospitalId` 파라미터가 로그인 유저 소유 병원과 일치하는지 전 컨트롤러(11개)에서 검증. 완전 개방돼 있던 2개 라우트(subscriptions, matrix-preview)도 잠금 |
| **DB 안전 배포** | build 스크립트에서 `--accept-data-loss` 제거. Prisma migrations 체계 도입 (`db:migrate:deploy`, `db:migrate:status`) |
| **시크릿 하드닝** | 하드코딩 폴백 시크릿 전부 제거 (`ADMIN_SECRET`/`CRON_SECRET` 미설정 시 요청 차단, `JWT_SECRET` 미설정 시 프로덕션 부팅 실패) |
| **레포 정리** | 마케팅 자산 37개 파일 untrack + .gitignore 확장 |

### P1 — 인프라 (전 항목 완료)
| 항목 | 내용 |
|------|------|
| **P1-4 크롤 큐** | Bull(Redis) 기반 크롤 잡 큐 — `REDIS_URL` 설정 시 병원별 잡을 큐로 처리(잡당 15분 타임아웃, 2회 재시도, 세션 중복 방지 jobId). 미설정 시 기존 인라인 방식 자동 fallback. 모니터링: `GET /scheduler/queue-status` |
| **P1-5 크롤러 분해** | `ai-crawler/strategies/`에 6개 플랫폼 전략 클래스 (ChatGPT/Claude/Perplexity/Gemini/Grok/CLOVA X). 서비스 3,690줄 → 3,084줄. 새 플랫폼 추가 = 클래스 1개 + 등록 1줄 |
| **P1-6 LLM 비용 추적** | 6개 플랫폼 전부 벤더 usage(토큰) 캡처 → `ai_responses`에 input/output 토큰 + 예상 원가(USD) 저장. 운영자 전용 `GET /admin/llm-costs?secret=...&days=30` (플랫폼별/병원별/모델별 집계) |
| **P1-7 캐싱** | `CacheService` (Redis 또는 인메모리) + `@CacheTTL` HTTP 캐시 인터셉터. scores API 10분 캐시. 크롤 완료 시 해당 병원 캐시 자동 무효화 |
| **비용 정보 보호** | 전역 `StripInternalFieldsInterceptor` — 원가 필드(`inputTokens`/`outputTokens`/`estimatedCostUsd`)는 `/api/admin` 외 모든 응답에서 강제 제거 (고객 병원에게 절대 노출 안 됨) |

### 배포 전 필수 체크리스트 (Render)
```bash
# 1. 환경변수 설정 (필수 — 없으면 해당 기능 차단됨)
ADMIN_SECRET=<강력한 랜덤 문자열>       # admin API 보호
CRON_SECRET=<강력한 랜덤 문자열>        # Render Cron 인증
ADMIN_EMAILS=admin@example.com          # IDOR 가드 우회 허용 운영자 이메일 (쉼표 구분)
JWT_SECRET=<강력한 랜덤 문자열>         # 미설정 시 프로덕션 부팅 실패
REDIS_URL=redis://...                   # (선택) 설정 시 크롤 큐 + Redis 캐시 활성

# 2. 비용 추적 컬럼 마이그레이션 (1회)
cd apps/api && npm run db:migrate:deploy
```

---

## 다음 단계

- [x] ~~대시보드 SoV 중심 리디자인 (Single North-Star Metric)~~ Phase 3-C 완료
- [x] ~~BullMQ 백그라운드 크롤링~~ 2026.07 P1-4 완료 (REDIS_URL 설정 시 활성)
- [x] ~~LLM 비용 추적 + 관리자 대시보드 API~~ 2026.07 P1-6 완료
- [ ] 네이버 Cue 스크래핑 추가
- [ ] 카카오톡 알림톡 연동
- [ ] 월간 PDF 리포트 자동 생성/발송
- [ ] GEO 콘텐츠 생성 (반말 스타일)
- [ ] 25축 매트릭스 시각화 대시보드
- [ ] 요금제별 Feature Gate 강화

---

*Patient Signal by 페이션트퍼널 | 2026.07.02 P0/P1 보안·인프라 대개편*
