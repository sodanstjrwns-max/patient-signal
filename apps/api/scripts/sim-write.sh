#!/bin/bash
API=http://localhost:4000/api
DEMO_H=407323e8-9e64-4a0f-a620-1925bd84fba8

login() { curl -s -m 20 -X POST $API/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }
T_DEMO=$(login demo@patientsignal.kr 'demo1234!' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

EM="sim$(date +%s)@test.kr"
R=$(curl -s -m 20 -X POST $API/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EM\",\"password\":\"Test1234!\",\"name\":\"시뮬원장2\",\"phone\":\"010-1111-2222\"}")
T_NEW=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
echo "신규 유저: $EM"

echo ""
echo "═══ 1. 온보딩 (병원 생성) ═══"
HOSP=$(curl -s -m 60 -X POST $API/hospitals -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{
  "name":"시뮬치과의원","specialtyType":"DENTAL","subSpecialties":["임플란트","교정"],
  "keyProcedures":["임플란트","교정","충치치료"],"regionSido":"서울특별시","regionSigungu":"송파구",
  "regionDong":"잠실동","websiteUrl":"https://sim-dental.example.kr"}')
echo "$HOSP" | head -c 500; echo
NEW_H=$(echo "$HOSP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "NEW_HOSPITAL=$NEW_H"

echo ""
echo "═══ 2. 자동 생성된 프롬프트 ═══"
curl -s -m 20 -H "Authorization: Bearer $T_NEW" $API/prompts/$NEW_H | python3 -c "
import sys,json
d=json.load(sys.stdin)
arr = d if isinstance(d,list) else d.get('prompts',d.get('data',[]))
print(f'자동 생성 질문 수: {len(arr)}')
for p in arr[:6]: print('  -', p.get('text',p.get('promptText',''))[:70], '|', p.get('category',''), '|', p.get('intentStage',''))
"

echo ""
echo "═══ 3. 신규 병원 대시보드(데이터 0 상태) ═══"
curl -s -m 30 -H "Authorization: Bearer $T_NEW" $API/hospitals/$NEW_H/dashboard | head -c 500; echo

echo ""
echo "═══ 4. 🔒 권한 검증: 신규유저가 데모 병원 데이터 접근 시도 ═══"
for path in "hospitals/$DEMO_H" "hospitals/$DEMO_H/dashboard" "prompts/$DEMO_H" "scores/$DEMO_H/latest" "ai-crawler/responses/$DEMO_H" "competitors/$DEMO_H" "subscriptions/hospital/$DEMO_H" "source-intel/summary/$DEMO_H" "citation-analysis/$DEMO_H/stats" "scores/$DEMO_H/abhs" "ai-crawler/insights/trend/$DEMO_H" "payments/billing/$DEMO_H" "scheduler/matrix-preview/$DEMO_H"; do
  code=$(curl -s -m 20 -o /tmp/o.json -w "%{http_code}" -H "Authorization: Bearer $T_NEW" "$API/$path")
  size=$(wc -c < /tmp/o.json)
  if [ "$code" = "200" ] && [ "$size" -gt 30 ]; then
    echo "🚨 LEAK  $code ${size}B  /$path"
    head -c 160 /tmp/o.json; echo
  else
    echo "✅ 차단  $code ${size}B  /$path"
  fi
done

echo ""
echo "═══ 5. 🔒 병원 수정 권한 (남의 병원 PUT) ═══"
code=$(curl -s -m 20 -o /tmp/o2.json -w "%{http_code}" -X PUT "$API/hospitals/$DEMO_H" -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"name":"해킹된치과"}')
echo "PUT /hospitals/$DEMO_H → $code : $(head -c 200 /tmp/o2.json)"

echo ""
echo "═══ 6. 🔒 남의 병원에 프롬프트 추가 시도 ═══"
code=$(curl -s -m 20 -o /tmp/o3.json -w "%{http_code}" -X POST "$API/prompts/$DEMO_H" -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"text":"침입 테스트 질문","category":"TREATMENT","intentStage":"AWARENESS"}')
echo "POST /prompts/$DEMO_H → $code : $(head -c 200 /tmp/o3.json)"

echo ""
echo "═══ 7. 🔒 어드민 API 무권한 접근 ═══"
for p in "admin/dashboard" "admin/users" "admin/hospitals" "admin/llm-costs" "subscriptions/admin/all" "coupons/admin/list"; do
  code=$(curl -s -m 15 -o /tmp/o4.json -w "%{http_code}" -H "Authorization: Bearer $T_NEW" "$API/$p")
  echo "  $code  /$p  $(head -c 90 /tmp/o4.json)"
done

echo ""
echo "═══ 8. 🔒 토큰 없이 접근 ═══"
for p in "hospitals/$DEMO_H/dashboard" "scores/$DEMO_H/latest" "prompts/$DEMO_H"; do
  code=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$API/$p")
  echo "  $code  (no token) /$p"
done

echo ""
echo "═══ 9. 정상 쓰기: 데모 계정 프롬프트 CRUD ═══"
CR=$(curl -s -m 20 -X POST "$API/prompts/$DEMO_H" -H "Authorization: Bearer $T_DEMO" -H "Content-Type: application/json" -d '{"text":"시뮬레이션 테스트 질문 - 잠실 임플란트 잘하는 곳","category":"TREATMENT","intentStage":"AWARENESS"}')
echo "생성: $(echo $CR | head -c 250)"
PID=$(echo "$CR" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$PID" ]; then
  echo "토글: $(curl -s -m 20 -X POST "$API/prompts/$PID/toggle" -H "Authorization: Bearer $T_DEMO" | head -c 150)"
  echo "수정: $(curl -s -m 20 -X PUT "$API/prompts/$PID" -H "Authorization: Bearer $T_DEMO" -H "Content-Type: application/json" -d '{"text":"수정된 시뮬 질문"}' | head -c 150)"
  echo "🔒 남의 프롬프트 삭제 시도: $(curl -s -m 20 -o /tmp/o5 -w '%{http_code}' -X DELETE "$API/prompts/$PID" -H "Authorization: Bearer $T_NEW") $(head -c 120 /tmp/o5)"
  echo "삭제: $(curl -s -m 20 -o /tmp/o6 -w '%{http_code}' -X DELETE "$API/prompts/$PID" -H "Authorization: Bearer $T_DEMO") $(head -c 120 /tmp/o6)"
fi

echo ""
echo "═══ 10. 경쟁사 추가/삭제 ═══"
CC=$(curl -s -m 30 -X POST "$API/competitors/$NEW_H" -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"name":"테스트경쟁치과","region":"송파구"}')
echo "$CC" | head -c 250; echo

echo ""
echo "═══ 11. 쿠폰 검증 ═══"
echo "존재하지 않는 쿠폰: $(curl -s -m 20 -X POST $API/coupons/validate -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"code":"NOTEXIST123"}' | head -c 200)"

echo ""
echo "═══ 12. 결제 금액 위조 시도 (100원에 PRO) ═══"
echo "$(curl -s -m 20 -X POST $API/payments/confirm -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"paymentKey":"fake_key","orderId":"fake_order_1","amount":100,"planType":"PRO"}' | head -c 300)"

echo ""
echo "═══ 13. API 키 발급/삭제 ═══"
AK=$(curl -s -m 20 -X POST $API/api-keys -H "Authorization: Bearer $T_DEMO" -H "Content-Type: application/json" -d '{"name":"sim-test-key"}')
echo "$AK" | head -c 300; echo
KEY=$(echo "$AK" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('key',d.get('apiKey','')))" 2>/dev/null)
KID=$(echo "$AK" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',d.get('keyId','')))" 2>/dev/null)
if [ -n "$KEY" ]; then
  echo "public API (x-api-key): $(curl -s -m 20 -H "x-api-key: $KEY" $API/public/v1/my/aeo-status | head -c 250)"
  echo "잘못된 키: $(curl -s -m 15 -o /tmp/o7 -w '%{http_code}' -H 'x-api-key: invalid_key_xxx' $API/public/v1/my/aeo-status) $(head -c 100 /tmp/o7)"
  [ -n "$KID" ] && echo "키 삭제: $(curl -s -m 15 -o /dev/null -w '%{http_code}' -X DELETE $API/api-keys/$KID -H "Authorization: Bearer $T_DEMO")"
fi

echo ""
echo "═══ 13-B. 🔒 P0 회귀 테스트 (2026-07-25 패치) ═══"
pass=0; fail=0
chk() { # chk "라벨" 기대코드 실제코드 본문
  if [ "$2" = "$3" ]; then echo "  ✅ PASS  $1  → $3"; pass=$((pass+1));
  else echo "  ❌ FAIL  $1  → 기대 $2, 실제 $3 : $(echo "$4" | head -c 150)"; fail=$((fail+1)); fi
}

# P0-1: 결제 근거 없는 유료 업그레이드 → 403 이어야 함
body=$(curl -s -m 15 -o /tmp/p01.json -w "%{http_code}" -X PATCH "$API/subscriptions/upgrade" \
  -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"planType":"ENTERPRISE"}')
chk "P0-1 무결제 ENTERPRISE 업그레이드 차단" 403 "$body" "$(cat /tmp/p01.json)"

# P0-1b: 존재하지 않는 플랜 타입 → 400 (DTO 검증)
body=$(curl -s -m 15 -o /tmp/p01b.json -w "%{http_code}" -X PATCH "$API/subscriptions/upgrade" \
  -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" -d '{"planType":"GODMODE"}')
chk "P0-1b 잘못된 planType DTO 거부" 400 "$body" "$(cat /tmp/p01b.json)"

# P0-2a: 일반 유저의 쿠폰 목록 조회 → 403
body=$(curl -s -m 15 -o /tmp/p02a.json -w "%{http_code}" "$API/coupons/admin/list" \
  -H "Authorization: Bearer $T_NEW")
chk "P0-2a 일반유저 쿠폰 목록 차단" 403 "$body" "$(cat /tmp/p02a.json)"

# P0-2b: 일반 유저의 쿠폰 생성 → 403
body=$(curl -s -m 15 -o /tmp/p02b.json -w "%{http_code}" -X POST "$API/coupons/admin/create" \
  -H "Authorization: Bearer $T_NEW" -H "Content-Type: application/json" \
  -d '{"code":"PWNED-ENT-2026","name":"hack","couponType":"FREE_PERIOD","freeMonths":120}')
chk "P0-2b 일반유저 쿠폰 생성 차단" 403 "$body" "$(cat /tmp/p02b.json)"

echo "  ── P0 회귀: PASS=$pass FAIL=$fail ──"

echo ""
echo "═══ 14. Rate limit 확인 (로그인 20연타) ═══"
for i in $(seq 1 20); do
  printf "%s " $(curl -s -m 10 -o /dev/null -w "%{http_code}" -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"demo@patientsignal.kr","password":"wrongpass"}')
done; echo

echo ""
echo "═══ 15. 정리: 시뮬 병원/유저 삭제 ═══"
echo "NEW_H=$NEW_H  EMAIL=$EM"
