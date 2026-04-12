#!/bin/bash
# learner-journey.sh
# user01 가정: 한 미션 (Plan 모드) 전체 흐름을 API 레벨로 시뮬레이션.
#
# 시나리오:
#   1. /api/me 인증 → username 확인
#   2. /api/check (autoChecks 폴링) → 파일 없음 → false
#   3. ~/PLAN.md 직접 생성 (학습자가 claude로 만들었다고 가정)
#   4. /api/check 재호출 → true (파일 감지)
#   5. /api/list (FileExplorer 같은 거) → PLAN.md 보임
#   6. /api/file?path=PLAN.md → 내용 확인
#   7. /api/grade-mission → 채점 결과 (mock)
#   8. /api/coach → 코칭 응답 (mock)
#   9. /api/my-scrollback → 스크롤백 (mock)
#  10. /api/clear-my-session → 세션 초기화 (mock)
#
# HOME_BASE 환경변수로 사용자 홈을 임시 디렉터리로 우회.

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_DIR/deploy/multi-user/api-server"
FIXTURES="$REPO_DIR/tests/fixtures"

PASS=0
FAIL=0
ERRORS=()

assert_contains() {
  local desc="$1"; local needle="$2"; local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — '$needle' not in response")
    printf "  \033[31m✗\033[0m %s\n      needle: %s\n      got:    %s\n" "$desc" "$needle" "${haystack:0:200}"
  fi
}

assert_not_contains() {
  local desc="$1"; local needle="$2"; local haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — found unexpected '$needle'")
    printf "  \033[31m✗\033[0m %s\n      should NOT contain: %s\n" "$desc" "$needle"
  fi
}

# 임시 홈 베이스 + 가짜 사용자 디렉터리 + state dir
TMP_BASE=$(mktemp -d)
mkdir -p "$TMP_BASE/user01"
STATE_DIR=$(mktemp -d)
SERVER_LOG=$(mktemp)

PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo 17500)

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_BASE" "$STATE_DIR" "$SERVER_LOG"
}
trap cleanup EXIT

echo
echo "=== learner-journey (user01 시뮬레이션) ==="
echo
echo "임시 홈: $TMP_BASE/user01"
echo "포트: $PORT"
echo

# 서버 부팅
cd "$API_DIR"
PORT="$PORT" \
  STATE_DIR="$STATE_DIR" \
  HOME_BASE="$TMP_BASE" \
  SUDO_PATH="$FIXTURES/mock-sudo.sh" \
  ADMIN_ACTION_PATH="$FIXTURES/mock-admin-action.sh" \
  COACH_PATH="$FIXTURES/mock-coach.sh" \
  GRADE_MISSION_PATH="$FIXTURES/mock-grade-mission.sh" \
  node server.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in 1 2 3 4 5 6; do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then break; fi
  sleep 0.4
done

if ! curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null; then
  echo "  서버 부팅 실패. 로그:"
  cat "$SERVER_LOG" | head -20
  exit 1
fi

api() {
  local method="$1"; local path="$2"; local user="${3:-}"; local body="${4:-}"
  local args=(-sS -X "$method" "http://127.0.0.1:$PORT$path")
  [ -n "$user" ] && args+=(-H "X-Remote-User: $user")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}" 2>&1
}

# ─── 1. 인증 ───
echo "[Step 1] /api/me — user01 인증"
resp=$(api GET /api/me user01)
assert_contains "username 응답" '"username":"user01"' "$resp"

# ─── 2. autoChecks 초기 (파일 없음) ───
echo
echo "[Step 2] /api/check — PLAN.md 아직 없음"
CHECK_BODY='{"checks":[{"type":"file-exists","path":"PLAN.md"}]}'
resp=$(api POST /api/check user01 "$CHECK_BODY")
assert_contains "checks 응답" '"results"' "$resp"
assert_contains "처음엔 false" '[false]' "$resp"

# ─── 3. PLAN.md 생성 (학습자 시뮬레이션) ───
echo
echo "[Step 3] ~/PLAN.md 생성 (학습자가 claude 로 만들었다고 가정)"
cat > "$TMP_BASE/user01/PLAN.md" <<'EOF'
# AI 추진 계획 보고서 워크플로우

## 단계
1. 추진 배경·목표 정리
2. 적용 사례 리서치
3. 도입 로드맵 작성
4. 위험·기대효과 정리
5. 최종 보고서(.docx) 출력
EOF
ls -la "$TMP_BASE/user01/PLAN.md" > /dev/null && {
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m PLAN.md 파일 작성됨\n"
} || {
  FAIL=$((FAIL + 1))
  printf "  \033[31m✗\033[0m PLAN.md 작성 실패\n"
}

# ─── 4. autoChecks 재호출 (파일 감지) ───
echo
echo "[Step 4] /api/check — PLAN.md 감지되어야 함"
resp=$(api POST /api/check user01 "$CHECK_BODY")
assert_contains "이제 true" '[true]' "$resp"

# any-exists 도 테스트
ANY_BODY='{"checks":[{"type":"any-exists","paths":["PLAN.md","subagent-mastery/PLAN.md"]}]}'
resp=$(api POST /api/check user01 "$ANY_BODY")
assert_contains "any-exists 도 true" '[true]' "$resp"

# file-contains 테스트
CONTAINS_BODY='{"checks":[{"type":"file-contains","path":"PLAN.md","keyword":"AI 추진"}]}'
resp=$(api POST /api/check user01 "$CONTAINS_BODY")
assert_contains "file-contains 키워드 매칭 true" '[true]' "$resp"

# ─── 5. 파일 탐색기 리스팅 ───
echo
echo "[Step 5] /api/list — 홈 디렉터리 PLAN.md 표시"
resp=$(api GET /api/list user01)
assert_contains "PLAN.md 가 리스팅에 포함" 'PLAN.md' "$resp"

# ─── 6. 파일 내용 미리보기 ───
echo
echo "[Step 6] /api/file?path=PLAN.md — 내용 미리보기"
resp=$(api GET "/api/file?path=PLAN.md" user01)
assert_contains "파일 내용에 단계 포함" '추진 배경' "$resp"
assert_contains "exists true" '"exists":true' "$resp"

# ─── 7. AI 채점 ───
echo
echo "[Step 7] /api/grade-mission — AI 채점 (mock)"
GRADE_BODY='{"missionId":"plan","rubric":"PLAN.md 만들기","files":["PLAN.md"],"checklist":["PLAN.md 가 있다","단계가 3개 이상","한국어 설명"]}'
resp=$(api POST /api/grade-mission user01 "$GRADE_BODY")
assert_contains "ok:true" '"ok":true' "$resp"
assert_contains "score 필드" '"score"' "$resp"
assert_contains "passed 필드" '"passed"' "$resp"
assert_contains "items 배열" '"items"' "$resp"
assert_contains "summary 필드" '"summary"' "$resp"

# ─── 8. AI 코칭 ───
echo
echo "[Step 8] /api/coach — 어시스턴트 오버레이 코칭 (mock)"
COACH_BODY='{"missionId":"plan","goal":"PLAN.md 작성","mandatory":["파일이 있다","단계가 명확"]}'
resp=$(api POST /api/coach user01 "$COACH_BODY")
assert_contains "코칭 ok:true" '"ok":true' "$resp"
assert_contains "status 필드" '"status"' "$resp"
assert_contains "hint 필드" '"hint"' "$resp"

# ─── 9. 스크롤백 ───
echo
echo "[Step 9] /api/my-scrollback — 터미널 스크롤백 (mock)"
resp=$(api GET /api/my-scrollback user01)
assert_contains "scrollback ok" '"ok":true' "$resp"
assert_contains "캔드 텍스트 포함" 'PLAN.md' "$resp"

# ─── 10. 세션 초기화 ───
echo
echo "[Step 10] /api/clear-my-session — 다음 미션 진입 전 초기화"
resp=$(api POST /api/clear-my-session user01)
assert_contains "clear ok" '"ok":true' "$resp"

# ─── 11. 보안 — admin 은 학습자 엔드포인트 접근 금지 ───
echo
echo "[Step 11] 보안 검사 — admin 격리"
resp=$(api POST /api/grade-mission admin "$GRADE_BODY")
assert_contains "admin 채점 차단" 'admin no grade' "$resp"
resp=$(api POST /api/coach admin "$COACH_BODY")
assert_contains "admin 코칭 차단" 'admin no coach' "$resp"

# ─── 12. 보안 — 경로 탈출 차단 ───
echo
echo "[Step 12] 보안 검사 — path traversal 차단"
TRAVERSE_BODY='{"checks":[{"type":"file-exists","path":"../../etc/passwd"}]}'
resp=$(api POST /api/check user01 "$TRAVERSE_BODY")
assert_contains "경로 탈출은 false" '[false]' "$resp"

ABS_BODY='{"checks":[{"type":"file-exists","path":"/etc/passwd"}]}'
resp=$(api POST /api/check user01 "$ABS_BODY")
assert_contains "절대경로는 false" '[false]' "$resp"

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
