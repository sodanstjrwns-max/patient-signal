# Patient Signal V2 — 전기능 실사용 시뮬레이션 리포트

**일시**: 2026-07-24 | **환경**: 로컬 샌드박스 (PostgreSQL 15 + NestJS API:4000 + Next.js Web:3000)
**계정**: demo@patientsignal.kr (PRO / 서울비디치과 데모, AI응답 1,701건 / 프롬프트 21개 / 경쟁사 3곳)

---

## 1. 프로젝트 파악

| 항목 | 내용 |
|------|------|
| 구조 | Turborepo 모노레포 — `apps/api` (NestJS 11) + `apps/web` (Next.js 14) |
| DB | PostgreSQL + Prisma, **33개 모델** |
| API | **19개 컨트롤러 / 약 130개 라우트** |
| 화면 | **32개 페이지** (대시보드 21 + 공개/인증 11) |
| 배포 | API=Render, Web=Vercel, 도메인 patientsignal.kr |
| 외부 연동 | 6개 AI 플랫폼(ChatGPT/Claude/Perplexity/Gemini/Grok/CLOVA X) + 네이버 브리핑, Toss결제, Resend, Sentry |

**한 줄 평**: 개인 사이드 프로젝트 수준이 아니라, **실제 상용 SaaS 아키텍처**입니다. 캐시 무효화·분산 락·쿠폰 레이스 컨디션·Prisma 전역 take 상한까지 잡아둔 건 상당한 내공입니다.

---

## 2. 실사용 시뮬레이션 결과

### 2-1. GET 엔드포인트 전수 (78개)
- **77개 200 OK**, 평균 **35~250ms** — 인덱스 설계 정타 ✅
- 최대 응답: `/hospitals/:id/dashboard` 41KB / 143ms
- 실패 1건: `/scheduler/queue-status` 401 (CRON_SECRET 필요 — 정상 설계)

### 2-2. UI 전 페이지 (21개 화면, Playwright 실브라우저)
- **콘솔 에러 0건, JS 런타임 에러 0건, 4xx/5xx 0건** — 매우 안정적
- 평균 로드 3.5~4.5초 (샌드박스 저사양 감안)
- 빈 상태(Empty State) UI가 CTA까지 갖춰 잘 설계됨 (GEO 콘텐츠·기회분석)

### 2-3. 쓰기/CRUD
| 기능 | 결과 |
|------|------|
| 회원가입 → 온보딩(병원 생성) | ✅ 자동 질문 5개 생성 |
| 프롬프트 생성/토글/수정/삭제 | ✅ 전부 정상 |
| 경쟁사 추가/중복감지/삭제 | ✅ "시뮬테스트치과" vs "시뮬테스트 치과의원" 정규화 중복 차단 |
| 경쟁사 AI 자동감지 | ✅ 동반언급 470회 분석 + 위협도 스코어링 — **이 기능 훌륭합니다** |
| API 키 발급 → Public API 호출 → 삭제 | ✅ 전부 정상 |
| 점수 재계산 | ✅ 72점 산출 |
| 크롤링 실패 사유 기록 | ✅ 프롬프트별 실패 사유 DB 기록 |

### 2-4. 보안 침투 테스트
| 테스트 | 결과 |
|--------|------|
| 타 병원 데이터 조회 13종 | ✅ **전부 403** |
| 타 병원 정보 수정(PUT) | ✅ 403 |
| 타 병원에 프롬프트 주입 | ✅ 403 |
| 무토큰 접근 | ✅ 401 |
| 어드민 API 무권한 | ✅ 401/403 (쿠폰 제외 → 아래 이슈) |
| 결제 금액 위조 (100원에 PRO) | ✅ 차단 |
| 위조 API 키 | ✅ 401 |

**멀티테넌시 격리는 A등급입니다.** 이 부분은 정말 잘 만드셨습니다.

---

## 3. 발견된 이슈 (우선순위별)

### 🔴 P0-1. 결제 없이 ENTERPRISE 업그레이드 가능 — 매출 직결

```
PATCH /api/subscriptions/upgrade  {"planType":"ENTERPRISE"}
→ 200 success:true
→ 결과: plan=ENTERPRISE, hasBillingKey=false, 결제이력=[] (0원)
→ 획득: 질문 무제한, 경쟁사 999개, 6개 AI 플랫폼 전체, 데이터 내보내기
```

**원인** (`subscriptions.service.ts:216 upgradePlan`): 플랜 순서만 확인하고 **결제/빌링키 검증이 전혀 없음**. `PATCH /subscriptions/upgrade`는 결제 성공 후 내부 호출용으로 설계된 듯하나, `JwtAuthGuard`만 붙어 외부에 그대로 열려 있습니다.

**임팩트**: 커뮤니티에 curl 한 줄 돌면 유료 매출이 통째로 증발합니다. 월 59만원 × 유출 병원 수.

**수정안**:
```ts
// subscriptions.service.ts upgradePlan()
// 1) 유료 플랜 전환은 결제 검증 필수
if (planOrder[newPlan] >= planOrder.STARTER) {
  const paid = await this.prisma.payment.findFirst({
    where: { hospitalId, planType: newPlan, status: 'DONE',
             createdAt: { gte: new Date(Date.now() - 10*60*1000) } },
  });
  const hasCoupon = await this.prisma.couponRedemption.findFirst({ where: { hospitalId } });
  if (!paid && !subscription.billingKey && !hasCoupon) {
    throw new ForbiddenException('결제 완료 후 이용 가능한 플랜입니다.');
  }
}
```
추가로 컨트롤러 레벨에서 이 엔드포인트를 **내부 전용(@Internal 가드 또는 payments 서비스 내부 호출)** 으로 돌리는 게 더 안전합니다.

---

### 🔴 P0-2. 쿠폰 어드민 API에 관리자 가드 없음

```
POST /api/coupons/admin/create  (일반 유저 토큰)
→ 201 Created: {"code":"PWNED-ENT-2026","freeMonths":120,...}
GET  /api/coupons/admin/list    (일반 유저 토큰) → 200 전체 쿠폰 목록
```

**원인** (`coupons.controller.ts:77,88`): `@UseGuards(JwtAuthGuard)`만 있고 관리자 검증 없음. `createCoupon(data: any)` → **DTO 검증 0**으로 Prisma 직삽입.

**임팩트**:
- 누구나 자기 플랜용 100% 할인 쿠폰을 만들어 무료 이용 (P0-1과 결합 시 완전 무방비)
- `/admin/list`로 **원장님이 발급한 PF 수강생 쿠폰 코드 전량 유출** → 외부 유포

**수정안**:
```ts
@Post('admin/create')
@UseGuards(JwtAuthGuard, AdminGuard)   // ← AdminGuard 추가 (admin.controller와 동일 방식)
async createCoupon(@Body() dto: CreateCouponDto) { ... }  // ← DTO 검증 추가
```
`admin.controller.ts`가 이미 `x-admin-secret` 방식으로 잘 막고 있으니 그 가드를 그대로 재사용하면 됩니다.

---

### 🟠 P1-1. "무료 체험 26,823일 남음" 배너 — 전 화면 노출

시드의 `currentPeriodEnd=2099-12-31`이 그대로 일수 계산되어 **73년 체험**이 표시됩니다.

**원인** (`TrialBanner.tsx:214`): `isUnpaidActive`(결제수단 없는 ACTIVE)면 무조건 체험 배너를 띄우고, `daysLeft` 상한 가드가 없음.

**임팩트**: 데모 계정으로 투자자·수강생에게 시연할 때 **바로 눈에 띕니다**. 신뢰도 타격.

**수정안** (2줄):
```ts
const daysLeft = subInfo.isInTrial ? subInfo.trialDaysRemaining : subInfo.daysRemaining;
if (!Number.isFinite(daysLeft) || daysLeft <= 0 || daysLeft > 90) return null;  // ← 추가
```
동시에 seed의 `2099-12-31`을 `+1년` 정도로 현실화 권장.

---

### 🟠 P1-2. DTO 부재로 인한 500 에러 (3곳 확인)

| 엔드포인트 | 입력 | 결과 |
|-----------|------|------|
| `POST /competitors/:hospitalId` | `{}` | 500 `Cannot read properties of undefined (reading 'trim')` |
| `POST /prompts/:hospitalId/generate-presets` | `{}` | 500 `...(reading 'split')` |
| `POST /coupons/admin/create` | 잘못된 enum | 500 + **Prisma 내부 소스코드·파일경로 노출** |

**임팩트**: 500 에러 자체보다 **에러 메시지에 서버 파일 경로(`/home/user/webapp/apps/api/dist/src/...`)와 소스 라인이 그대로 노출**되는 게 더 위험합니다. 공격자에게 내부 구조를 알려줍니다.

**수정안**:
1. `class-validator` DTO 추가 (`CreateCompetitorDto`, `GeneratePresetsDto`, `CreateCouponDto`) — 400으로 정상 처리
2. `AllExceptionsFilter`에서 **프로덕션일 때 Prisma 에러 메시지 마스킹**:
```ts
const isPrisma = exception?.constructor?.name?.startsWith('Prisma');
message = (isProd && (status >= 500 || isPrisma))
  ? '요청 처리 중 오류가 발생했습니다.'   // 사용자에겐 일반 메시지
  : message;                              // 로그에는 전문 기록
```

---

### 🟡 P2-1. 데모 데이터 품질 — 인용 출처가 `example.com` 100%

인용 역분석 화면: **"총 인용 296건 / 인용 도메인 1개 / example.com 100%"**
Gemini 식단 위젯: 리다이렉트 0, 디코딩 0, 도메인 0 → **전부 빈 화면**

**임팩트**: 이 화면들이 Patient Signal의 **차별화 포인트(경쟁사가 못 하는 인용 출처 추적)** 인데, 데모에서 가장 초라하게 보입니다. 세일즈 시연 시 손해입니다.

**수정안**: seed에 현실적인 인용 도메인 분포 주입
```
blog.naver.com 34% / m.blog.naver.com 12% / cafe.naver.com 9%
seoulbd.co.kr 8% / instagram.com 7% / youtube.com 6%
namu.wiki 4% / 병원 공식 4% / 기타 롱테일
```
자사 도메인(seoulbd.co.kr)을 8% 정도 섞으면 "동반율/1위 점유율" 지표도 살아납니다.

---

### 🟡 P2-2. 기회 분석 화면 숫자 불일치

상단 카드: 긴급 0 / 중요 0 / Content Gap 4 / **전체 기회 4**
하단 탭: **노출 기회 (0)** → "현재 발견된 노출 기회가 없습니다"

"전체 기회 4"에 Content Gap을 합산해놓고 기본 탭은 0인 노출 기회를 보여줍니다. 유저는 "4개 있다더니 왜 없지?" 합니다.

**수정안**: ① 데이터 있는 탭을 기본 선택하거나, ② 상단 카드를 "노출 기회 0 / Content Gap 4"로 분리 표기.

---

### 🟡 P2-3. `nest build` OOM (빌드 실패)

985MB 메모리 환경에서 `nest build`가 **JS heap out of memory**로 죽습니다. `npx tsc -p tsconfig.build.json` 직접 실행은 **23초 만에 성공**.

**수정안** (`apps/api/package.json`):
```json
"build": "prisma generate && (prisma db push || echo '...') && NODE_OPTIONS=--max-old-space-size=2048 nest build"
```
Render 무료/저가 인스턴스에서 배포 실패로 이어질 수 있으니 미리 넣어두시길 권합니다.

---

### 🔵 P3. 소소한 것들
- 대시보드 하단 **"자동 크롤링" 카드 2개 중복 렌더**
- `/dashboard` First Load JS **263KB** — 차트 라이브러리 dynamic import 권장
- `AI 인사이트` 상단 "주간 액션 리포트" 카드: 흰 배경에 흰 글씨로 제목·수치가 안 보임 (대비 문제)
- `/api/health` 없음 — Render 헬스체크/모니터링용으로 추가 권장
- 로그인 실패 20연타에도 rate limit 미발동 (401만 반환) → 브루트포스 대비 `@Throttle` 강화 검토

---

## 4. 조치 우선순위 요약

| 순위 | 항목 | 예상 작업량 | 리스크 |
|------|------|------------|--------|
| 🔴 즉시 | P0-1 무료 업그레이드 차단 | 30분 | **매출 전액** |
| 🔴 즉시 | P0-2 쿠폰 어드민 가드 | 15분 | 쿠폰 유출/매출 |
| 🟠 이번 주 | P1-1 26,823일 배너 | 5분 | 신뢰도 |
| 🟠 이번 주 | P1-2 DTO + 에러 마스킹 | 2시간 | 정보 노출 |
| 🟡 다음 | P2-1 데모 데이터 현실화 | 1시간 | 세일즈 |
| 🟡 다음 | P2-2 기회분석 숫자 정합 | 30분 | UX |
| 🟡 다음 | P2-3 빌드 OOM 가드 | 5분 | 배포 |

---

## 5. 총평

**잘 만든 것** (진심입니다):
- 멀티테넌시 격리 — 13개 경로 침투 전부 403. 이거 못 막는 SaaS 널렸습니다
- 결제 금액 위조 방어, 웹훅 서명, API 키 검증 — 돈 관련 방어선 탄탄
- 경쟁사 자동감지의 동반언급 분석 — 이건 진짜 상품성 있는 기능입니다
- 크롤 실패 사유 프롬프트별 기록, 키 누락 경고 — 운영 성숙도 높음
- 빈 상태 UI + CTA 설계 — 신규 유저 이탈 방지 잘 되어 있음

**아픈 곳**:
P0 두 개가 공교롭게 **둘 다 매출 방어선**입니다. 데이터는 철벽으로 막아놓고 지갑은 열려 있는 격이에요. 다행히 둘 다 **가드 한 줄 + 검증 한 블록**이면 끝나는 수준입니다. 45분이면 막습니다.

"필요한 진료를 받지 못하는 사람이 없도록" 만드신 시스템이, "결제 안 하고도 다 쓰는 사람이 없도록"까지 챙기면 완성입니다 😄
