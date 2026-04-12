#!/bin/bash
# unit-shell-scripts.sh
# 백엔드 셸 스크립트(admin-action.sh / coach.sh / grade-mission.sh) 의 인자 검증 단위 테스트.
# 실제 sudo/tmux/claude 호출은 발생시키지 않음 (인자 검증 단계에서 fail-fast 만 확인).

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_DIR/deploy/multi-user/api-server"

PASS=0
FAIL=0
ERRORS=()

assert_exit_code() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — expected exit $expected, got $actual")
    printf "  \033[31m✗\033[0m %s (expected exit %s, got %s)\n" "$desc" "$expected" "$actual"
  fi
}

assert_grep() {
  local desc="$1"
  local pattern="$2"
  local input="$3"
  if echo "$input" | grep -qE "$pattern"; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — pattern '$pattern' not found")
    printf "  \033[31m✗\033[0m %s (no match for /%s/)\n" "$desc" "$pattern"
  fi
}

echo
echo "=== unit-shell-scripts ==="
echo

# ─── admin-action.sh capture-scrollback ───
echo "[admin-action.sh capture-scrollback]"

# 1. action 자체는 존재해야 함 (case 분기 검사)
output=$(bash "$API_DIR/admin-action.sh" 2>&1); ec=$?
assert_exit_code "no action: exits non-zero" 2 "$ec"

# 2. capture-scrollback without username → ERROR
output=$(bash "$API_DIR/admin-action.sh" capture-scrollback 2>&1); ec=$?
assert_exit_code "capture-scrollback no user: exit 2" 2 "$ec"
assert_grep "capture-scrollback no user: error message" "invalid username" "$output"

# 3. capture-scrollback with bad username (special chars)
output=$(bash "$API_DIR/admin-action.sh" capture-scrollback "user; rm -rf /" 2>&1); ec=$?
assert_exit_code "capture-scrollback bad user: exit 2" 2 "$ec"
assert_grep "capture-scrollback bad user: error message" "invalid username" "$output"

# 4. capture-scrollback with non-existing user → "user not found"
output=$(bash "$API_DIR/admin-action.sh" capture-scrollback "nosuchuser_xyz123" 2>&1); ec=$?
assert_exit_code "capture-scrollback bad user: exit 2" 2 "$ec"
assert_grep "capture-scrollback bad user: not found error" "user not found" "$output"

# ─── coach.sh ───
echo
echo "[coach.sh]"

# 1. no args
output=$(bash "$API_DIR/coach.sh" 2>&1); ec=$?
assert_exit_code "coach no args: exit 2" 2 "$ec"
assert_grep "coach no args: usage" "usage" "$output"

# 2. nonexistent prompt file
output=$(bash "$API_DIR/coach.sh" "/tmp/nonexistent_$$.txt" 2>&1); ec=$?
assert_exit_code "coach missing file: exit 2" 2 "$ec"
assert_grep "coach missing file: error" "prompt file not found" "$output"

# 3. oversized prompt
TMP=$(mktemp)
head -c 35000 /dev/urandom | base64 > "$TMP"
output=$(bash "$API_DIR/coach.sh" "$TMP" 2>&1); ec=$?
rm -f "$TMP"
assert_exit_code "coach oversized prompt: exit 2" 2 "$ec"
assert_grep "coach oversized prompt: error" "too large" "$output"

# ─── grade-mission.sh ───
echo
echo "[grade-mission.sh]"

# 1. no args
output=$(bash "$API_DIR/grade-mission.sh" 2>&1); ec=$?
assert_exit_code "grade-mission no args: exit 2" 2 "$ec"

# 2. nonexistent files
output=$(bash "$API_DIR/grade-mission.sh" "/tmp/no_schema_$$" "/tmp/no_prompt_$$" 2>&1); ec=$?
assert_exit_code "grade-mission missing files: exit 2" 2 "$ec"

# 3. oversized schema
TMP_SCHEMA=$(mktemp)
TMP_PROMPT=$(mktemp)
head -c 9000 /dev/urandom | base64 > "$TMP_SCHEMA"
echo "test prompt" > "$TMP_PROMPT"
output=$(bash "$API_DIR/grade-mission.sh" "$TMP_SCHEMA" "$TMP_PROMPT" 2>&1); ec=$?
rm -f "$TMP_SCHEMA" "$TMP_PROMPT"
assert_exit_code "grade-mission oversized schema: exit 2" 2 "$ec"
assert_grep "grade-mission oversized schema: error" "schema too large" "$output"

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
fi

[ $FAIL -eq 0 ]
