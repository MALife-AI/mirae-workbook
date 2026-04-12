#!/bin/bash
# integration-server.sh
# server.js 라우트 핸들러 통합 테스트.
# - mock-sudo / mock-admin-action / mock-coach / mock-grade-mission 으로 주입
# - 무작위 빈 포트에 server.js 띄우고 curl 로 엔드포인트 검증
# - 응답 셰이프 + 검증 로직 + 권한 체크

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_DIR/deploy/multi-user/api-server"
FIXTURES="$REPO_DIR/tests/fixtures"

PASS=0
FAIL=0
ERRORS=()

assert_eq() {
  local desc="$1"; local expected="$2"; local actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — expected '$expected', got '$actual'")
    printf "  \033[31m✗\033[0m %s\n      expected: %s\n      actual:   %s\n" "$desc" "$expected" "$actual"
  fi
}

assert_contains() {
  local desc="$1"; local needle="$2"; local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — '$needle' not in response")
    printf "  \033[31m✗\033[0m %s\n      needle: %s\n      got:    %s\n" "$desc" "$needle" "$haystack"
  fi
}

# 빈 포트 찾기
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo 17000)
STATE_DIR="$(mktemp -d)"
SERVER_LOG="$(mktemp)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$STATE_DIR" "$SERVER_LOG"
}
trap cleanup EXIT

echo
echo "=== integration-server (port=$PORT) ==="
echo

# server.js 띄우기 (mocks 주입)
cd "$API_DIR"
PORT="$PORT" \
  STATE_DIR="$STATE_DIR" \
  SUDO_PATH="$FIXTURES/mock-sudo.sh" \
  ADMIN_ACTION_PATH="$FIXTURES/mock-admin-action.sh" \
  COACH_PATH="$FIXTURES/mock-coach.sh" \
  GRADE_MISSION_PATH="$FIXTURES/mock-grade-mission.sh" \
  node server.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# 헬스체크 대기 (최대 3초)
for i in 1 2 3 4 5 6; do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null; then
  echo "  서버 부팅 실패. 로그:"
  cat "$SERVER_LOG" | head -30
  exit 1
fi

# 헬퍼: curl with X-Remote-User 헤더
api() {
  local method="$1"; local path="$2"; local user="${3:-}"; local body="${4:-}"
  local args=(-sS -X "$method" "http://127.0.0.1:$PORT$path")
  [ -n "$user" ] && args+=(-H "X-Remote-User: $user")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}" 2>&1
}

# ─── /api/health ───
echo "[/api/health]"
resp=$(api GET /api/health)
assert_contains "health 200 ok:true" '"ok":true' "$resp"

# ─── /api/me ───
echo
echo "[/api/me]"
resp=$(api GET /api/me)
assert_contains "no auth → 401 error" 'error' "$resp"
resp=$(api GET /api/me user01)
assert_contains "with X-Remote-User → username" '"username":"user01"' "$resp"

# ─── /api/my-scrollback ───
echo
echo "[/api/my-scrollback]"
resp=$(api GET /api/my-scrollback "" "")
assert_contains "no auth → 401" 'error' "$resp"

resp=$(api GET /api/my-scrollback user01)
assert_contains "user → ok:true" '"ok":true' "$resp"
assert_contains "user → scrollback contains canned text" 'PLAN.md' "$resp"

# admin 은 빈 스크롤백 반환
resp=$(api GET /api/my-scrollback admin)
assert_contains "admin → ok:true (empty)" '"ok":true' "$resp"

# ─── /api/coach ───
echo
echo "[/api/coach]"

# no auth
resp=$(api POST /api/coach "" '{"missionId":"plan","goal":"x","mandatory":["a"]}')
assert_contains "no auth → 401" 'error' "$resp"

# admin denied
resp=$(api POST /api/coach admin '{"missionId":"plan","goal":"x","mandatory":["a"]}')
assert_contains "admin denied" 'admin no coach' "$resp"

# bad missionId
resp=$(api POST /api/coach user01 '{"missionId":"bad id with spaces","goal":"x","mandatory":["a"]}')
assert_contains "bad missionId 400" 'invalid missionId' "$resp"

# missing goal
resp=$(api POST /api/coach user01 '{"missionId":"plan","mandatory":["a"]}')
assert_contains "missing goal 400" 'invalid goal' "$resp"

# missing mandatory
resp=$(api POST /api/coach user01 '{"missionId":"plan","goal":"x"}')
assert_contains "missing mandatory 400" 'mandatory must be 1..10' "$resp"

# 정상 호출 (mock-coach 가 캔드 응답 반환)
resp=$(api POST /api/coach user01 '{"missionId":"plan","goal":"PLAN.md 생성","mandatory":["PLAN.md 가 있다","단계가 있다"]}')
assert_contains "valid call → ok:true" '"ok":true' "$resp"
assert_contains "valid call → status field" '"status"' "$resp"
assert_contains "valid call → hint field" '"hint"' "$resp"

# ─── /api/grade-mission ───
echo
echo "[/api/grade-mission]"

# no auth
resp=$(api POST /api/grade-mission "" '{"missionId":"plan","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "no auth → 401" 'error' "$resp"

# admin denied
resp=$(api POST /api/grade-mission admin '{"missionId":"plan","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "admin denied" 'admin no grade' "$resp"

# bad missionId
resp=$(api POST /api/grade-mission user01 '{"missionId":"bad id","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "bad missionId 400" 'invalid missionId' "$resp"

# missing rubric
resp=$(api POST /api/grade-mission user01 '{"missionId":"plan","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "missing rubric 400" 'invalid rubric' "$resp"

# 정상 호출 (mock 응답)
resp=$(api POST /api/grade-mission user01 '{"missionId":"plan","rubric":"PLAN.md 만들기","files":["PLAN.md"],"checklist":["파일 있음"]}')
assert_contains "valid call → ok:true" '"ok":true' "$resp"
assert_contains "valid call → score" '"score"' "$resp"
assert_contains "valid call → items" '"items"' "$resp"
assert_contains "valid call → passed" '"passed"' "$resp"

# ─── 결과 ───
echo
echo "─────────────────────────"
printf "통과 \033[32m%d\033[0m / 실패 \033[31m%d\033[0m\n" "$PASS" "$FAIL"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo
  echo "실패 항목:"
  for e in "${ERRORS[@]}"; do
    printf "  - %s\n" "$e"
  done
  echo
  echo "서버 로그 (마지막 20줄):"
  tail -20 "$SERVER_LOG"
fi

[ $FAIL -eq 0 ]
