# 🔴 Render Cron 3-Way 분리 가이드 (원장님 수동 작업)

## 📌 배경
- 활성 병원: 92곳
- 1잡 평균 duration: 81초 (B안 이후, 5/31 측정)
- 24분 budget으로 1세션당 최대 32곳 (p90 안전 기준)
- **3-way 분리하면 96곳 커버 가능** → 92곳 전부 처리 OK

## 🔧 작업 순서

### 1) Render 대시보드 접속
URL: https://dashboard.render.com  
Workspace에서 `patient-signal-daily-crawl` Cron Job 찾기

### 2) 현재 Cron 확인 (보통 1개만 있음)
```
Name: patient-signal-daily-crawl
Schedule: 0 9 * * *  (매일 KST 9시 = UTC 0시)
Command: curl -X POST https://patient-signal-1.onrender.com/api/scheduler/daily-crawl -H "x-cron-secret: $CRON_SECRET"
```

### 3) 기존 Cron을 morning으로 수정
| 항목 | 값 |
|---|---|
| Name | `patient-signal-daily-crawl-morning` |
| Schedule | `0 0 * * *` (UTC, = KST 09:00) |
| Command | 아래 ⬇️ |

```bash
curl -X POST "https://patient-signal-1.onrender.com/api/scheduler/daily-crawl?session=morning" -H "x-cron-secret: $CRON_SECRET"
```

### 4) afternoon Cron 신규 생성
**[+ New Cron Job]** 클릭

| 항목 | 값 |
|---|---|
| Name | `patient-signal-daily-crawl-afternoon` |
| Schedule | `0 5 * * *` (UTC, = KST 14:00) |
| Command | 아래 ⬇️ |
| Environment Variable | `CRON_SECRET` (기존과 동일) |

```bash
curl -X POST "https://patient-signal-1.onrender.com/api/scheduler/daily-crawl?session=afternoon" -H "x-cron-secret: $CRON_SECRET"
```

### 5) evening Cron 신규 생성
| 항목 | 값 |
|---|---|
| Name | `patient-signal-daily-crawl-evening` |
| Schedule | `0 10 * * *` (UTC, = KST 19:00) |
| Command | 아래 ⬇️ |
| Environment Variable | `CRON_SECRET` (기존과 동일) |

```bash
curl -X POST "https://patient-signal-1.onrender.com/api/scheduler/daily-crawl?session=evening&includeCompetitors=true" -H "x-cron-secret: $CRON_SECRET"
```

### 6) zombie-cleanup Cron 신규 생성 (옵션, 강추!)
응급 청소용 — 매일 새벽 4시 KST (= UTC 19시) 자동 청소

| 항목 | 값 |
|---|---|
| Name | `patient-signal-zombie-cleanup` |
| Schedule | `0 19 * * *` (UTC, = KST 04:00) |
| Command | 아래 ⬇️ |

```bash
curl -X POST "https://patient-signal-1.onrender.com/api/scheduler/cleanup-zombies" -H "x-cron-secret: $CRON_SECRET"
```

## ⚠️ CRON_SECRET 값 확인
- Render 환경변수에서 `CRON_SECRET` 값을 복사
- 모든 Cron Job의 환경변수에 동일하게 설정
- 우리가 시도한 `patient-signal-cron-secret-2024`가 401 UNAUTHORIZED 받았으므로, 다른 값일 가능성 높음

## ✅ 완료 후 검증 방법

원장님 직접 확인:
```
1. 내일 KST 09:00 ~ 09:30 사이 → 일부 병원 처리 확인
2. 내일 KST 14:00 ~ 14:30 사이 → 추가 병원 처리
3. 내일 KST 19:00 ~ 19:30 사이 → 나머지 + 경쟁사 분석
4. 5/06 (1일 후) DailyScore 92곳 전체 생성 확인
```

저한테 보내실 신호:
- "원장님 cron 3개 다 설정됐어요!" → 제가 다음날 데이터로 효과 검증
- "secret이 OOO이에요" → 제가 직접 트리거 테스트 가능

## 🎯 기대 효과
| 지표 | 5/30 (이전) | 6/01 (적용 후 예상) |
|---|---|---|
| 일일 처리 병원 | 18곳 | **92곳** ✅ |
| 좀비 잡 누적 | 매일 +70개 | **0개** ✅ |
| TOP 20 커버리지 | 일부만 | **전체 정확** ✅ |
