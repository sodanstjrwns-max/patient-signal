# 🏥 Patient Signal (페이션트 시그널)

**병원 AI 검색 가시성 추적 SaaS**

한국 병원 전문 AI 검색 가시성 추적 서비스입니다. ChatGPT, Perplexity, Claude, Gemini, 네이버 Cue 등 주요 AI 플랫폼에서 병원이 어떻게 노출되는지 추적하고 분석합니다.

## 🎯 주요 기능

### ✅ 완성된 기능 (Phase 1)

**Backend (NestJS)**
- 🔐 JWT 기반 인증 시스템 (회원가입/로그인)
- 🏥 병원 등록 및 관리
- 💬 모니터링 질문 관리 (CRUD, 변형 생성)
- 🤖 AI 플랫폼 크롤링 서비스 (ChatGPT, Perplexity, Claude, Gemini)
- 📊 AI 가시성 점수 계산 엔진
- 👥 경쟁사 분석 및 비교
- 📈 일일/주간 통계 및 인사이트

**Frontend (Next.js 14)**
- 🏠 랜딩 페이지 (가격 정책, 기능 소개)
- 🔑 로그인/회원가입 페이지
- 📋 병원 온보딩 (3단계 등록 프로세스)
- 📊 대시보드 (점수 카드, 차트, 플랫폼별 분석)
- 💡 주간 인사이트 카드
- 🏆 경쟁사 비교 차트

**Database (PostgreSQL + Prisma)**
- 사용자, 병원, 프롬프트, AI 응답, 점수 등 17개 테이블
- 완전한 관계형 스키마 설계

### 🔜 구현 예정 (Phase 2-3)
- 네이버 Cue 스크래핑
- BullMQ 기반 백그라운드 크롤링
- 카카오톡 알림톡 연동
- 500+ 의료 질문 라이브러리
- 월간 PDF 리포트 생성
- 감성 분석 고도화

## 🛠 기술 스택

### Frontend
- **Next.js 14** - React 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **TanStack Query** - 서버 상태 관리
- **Zustand** - 클라이언트 상태 관리
- **Recharts** - 차트 라이브러리

### Backend
- **NestJS 10** - Node.js 프레임워크
- **Prisma 7** - ORM
- **PostgreSQL 15** - 데이터베이스
- **JWT/Passport** - 인증

### AI 연동
- **OpenAI API** - ChatGPT
- **Anthropic API** - Claude
- **Perplexity API** - Perplexity
- **Google AI API** - Gemini

## 📁 프로젝트 구조

```
patient-signal/
├── apps/
│   ├── api/                    # NestJS 백엔드
│   │   ├── src/
│   │   │   ├── auth/           # 인증 모듈
│   │   │   ├── hospitals/      # 병원 관리
│   │   │   ├── prompts/        # 질문 관리
│   │   │   ├── ai-crawler/     # AI 크롤링
│   │   │   ├── competitors/    # 경쟁사 분석
│   │   │   ├── scores/         # 점수 통계
│   │   │   └── common/         # 공통 모듈 (Prisma)
│   │   └── prisma/
│   │       └── schema.prisma   # DB 스키마
│   │
│   └── web/                    # Next.js 프론트엔드
│       └── src/
│           ├── app/            # 페이지
│           ├── components/     # UI 컴포넌트
│           ├── lib/            # API 클라이언트
│           ├── stores/         # 상태 관리
│           └── types/          # TypeScript 타입
│
├── package.json                # 모노레포 설정
└── turbo.json                  # Turborepo 설정
```

## 🚀 시작하기

### 1. 환경 설정

```bash
# 백엔드 환경 변수
cp apps/api/.env.example apps/api/.env

# 프론트엔드 환경 변수
cp apps/web/.env.example apps/web/.env.local
```

**apps/api/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/patient_signal"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
PERPLEXITY_API_KEY="pplx-..."
GEMINI_API_KEY="..."
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 데이터베이스 설정

```bash
cd apps/api
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
# 터미널 1 - 백엔드 (포트 4000)
cd apps/api && npm run start:dev

# 터미널 2 - 프론트엔드 (포트 3000)
cd apps/web && npm run dev
```

## 📡 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/auth/register` | POST | 회원가입 |
| `/api/auth/login` | POST | 로그인 |
| `/api/auth/profile` | GET | 프로필 조회 |
| `/api/hospitals` | POST | 병원 등록 |
| `/api/hospitals/:id/dashboard` | GET | 대시보드 데이터 |
| `/api/prompts/:hospitalId` | GET/POST | 질문 관리 |
| `/api/ai-crawler/crawl/:hospitalId` | POST | 크롤링 실행 |
| `/api/scores/:hospitalId/weekly` | GET | 주간 하이라이트 |
| `/api/competitors/:hospitalId` | GET/POST | 경쟁사 관리 |

**Swagger 문서:** `http://localhost:4000/api/docs`

## 💰 가격 정책

| 플랜 | 월 가격 | 질문 수 | 경쟁사 | AI 플랫폼 |
|------|---------|---------|--------|-----------|
| Starter | 19만원 | 30개 | 3개 | 4개 |
| Standard | 39만원 | 80개 | 5개 | 5개 |
| Pro | 79만원 | 200개 | 10개 | 6개 (Cue 포함) |

## 📊 AI 가시성 점수 계산

```
종합 점수 = 언급률 × 0.4 + 포지션 점수 × 0.3 + 감성 점수 × 0.2 + 인용 점수 × 0.1
```

- **언급률**: AI 응답에서 병원이 언급된 비율
- **포지션 점수**: 추천 목록에서의 순위 (1위=100점, 2위=80점...)
- **감성 점수**: 긍정/부정 감성 분석
- **인용 점수**: 인용 소스 존재 여부

## 🔒 배포 상태

- **프론트엔드**: 준비 중
- **백엔드**: 준비 중
- **데이터베이스**: PostgreSQL (로컬)

## 👥 팀

- **페이션트퍼널** - 병원 경영 교육
- **서울비디치과** - 임상 파트너
- **개발**: Genspark 풀스택

## 📝 라이선스

Private - All Rights Reserved

---

**© 2026 페이션트퍼널 / 서울비디치과**
