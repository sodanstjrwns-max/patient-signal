#!/bin/bash
# 전기능 실사용 시뮬레이션 - GET 엔드포인트 전수 점검
API=http://localhost:4000/api
EMAIL=demo@patientsignal.kr
PASS='demo1234!'

TOKEN=$(curl -s -m 15 -X POST $API/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
HID=$(curl -s -m 15 -X POST $API/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['hospitalId'])")

echo "TOKEN_OK=${#TOKEN} HID=$HID"
echo "======================================================"

check() {
  local path="$1"
  local url="$API$path"
  local start=$(date +%s%3N)
  local body=$(curl -s -m 30 -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer $TOKEN" "$url")
  local end=$(date +%s%3N)
  local code=$(echo "$body" | tail -1 | sed 's/__HTTP__//')
  local payload=$(echo "$body" | sed '$d')
  local size=${#payload}
  local ms=$((end-start))
  local flag="OK "
  if [ "$code" != "200" ] && [ "$code" != "201" ]; then flag="ERR"; fi
  # 빈 데이터 감지
  local empty=""
  if echo "$payload" | grep -qE '^\s*(\[\]|\{\}|null)\s*$'; then empty="[EMPTY]"; fi
  printf "%s %s %5sms %7sB %s %s\n" "$flag" "$code" "$ms" "$size" "$path" "$empty"
  if [ "$flag" = "ERR" ]; then echo "    └─ $(echo $payload | head -c 300)"; fi
}

echo "--- AUTH ---"
check "/auth/profile"

echo "--- HOSPITALS ---"
check "/hospitals/$HID"
check "/hospitals/$HID/dashboard"
check "/hospitals/active"

echo "--- PROMPTS ---"
check "/prompts/$HID"

echo "--- SCORES (대시보드 핵심) ---"
for p in funnel latest history platforms specialties weekly citations source-hints content-gaps opportunity-analysis prompt-heatmap ranking abhs abhs/competitive-share abhs/actions action-impacts benchmarks abhs/golden-prompts; do
  check "/scores/$HID/$p"
done

echo "--- AI CRAWLER / INSIGHTS ---"
check "/ai-crawler/status"
check "/ai-crawler/last-analysis/$HID"
check "/ai-crawler/first-crawl-status/$HID"
check "/ai-crawler/responses/$HID"
for p in mention-analysis trend sources sources-diagnostic positioning source-quality top-urls url-matrix breadth gemini-diet action-report; do
  check "/ai-crawler/insights/$p/$HID"
done
check "/ai-crawler/live-query/usage/$HID"
check "/ai-crawler/live-query/category-stats/$HID"
check "/ai-crawler/category-analysis/$HID"
check "/ai-crawler/prompt-performance/$HID"

echo "--- CITATION ANALYSIS ---"
check "/citation-analysis/$HID/recent"
check "/citation-analysis/$HID/stats"
check "/citation-analysis/$HID/calendar"

echo "--- COMPETITORS ---"
check "/competitors/$HID"
check "/competitors/$HID/inactive"
check "/competitors/$HID/comparison"

echo "--- SUBSCRIPTIONS / PAYMENTS ---"
check "/subscriptions/me"
check "/subscriptions/hospital/$HID"
check "/subscriptions/usage"
check "/subscriptions/plans/compare"
check "/subscriptions/plans/PRO/limits"
check "/payments/subscription/$HID"
check "/payments/user/history"
check "/payments/billing/$HID"

echo "--- SOURCE INTEL ---"
check "/source-intel/status/$HID"
check "/source-intel/top-sources/$HID"
check "/source-intel/new-channels/$HID"
check "/source-intel/instagram/$HID"
check "/source-intel/hint-keywords/$HID"
check "/source-intel/summary/$HID"

echo "--- GEO CONTENT ---"
check "/geo-content?hospitalId=$HID"
check "/geo-content/stats?hospitalId=$HID"

echo "--- QUERY TEMPLATES ---"
check "/query-templates/specialties"
check "/query-templates/specialties/DENTAL/procedures"
check "/query-templates/suggest/$HID"

echo "--- API KEYS ---"
check "/api-keys"

echo "--- SCHEDULER ---"
check "/scheduler/status"
check "/scheduler/queue-status"
check "/scheduler/matrix-preview/$HID"
