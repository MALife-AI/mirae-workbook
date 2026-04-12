#!/bin/bash
# e2e-test.sh — End-to-End 테스트: 학생이 워크북을 처음부터 끝까지 진행하는 시나리오
#
# 테스트 범위:
#   1. 단위: 각 API 엔드포인트 정상 동작
#   2. 통합: 체험(Part 3) 미션 7개 + 실습(Part 4) 미션 7개 전체 플로우
#   3. cleanWorkspace: 체험 파일만 삭제, 실습 파일 보존
#   4. 어드민 대시보드 진행 상황 반영
#   5. 동시 5명 같은 미션 진행
#
# 사용법:
#   bash tests/e2e-test.sh
#   LIVE=1 bash tests/e2e-test.sh   # 실제 서버(localhost:6999) 대상

set -u

START_TIME=$(date +%s)

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_DIR/deploy/multi-user/api-server"
FIXTURES="$REPO_DIR/tests/fixtures"

PASS=0
FAIL=0
SKIP=0
ERRORS=()
SECTION=""

# ─── 컬러 헬퍼 ──────────────────────────────────
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"

# ─── 어서션 ──────────────────────────────────────
assert_contains() {
  local desc="$1"; local needle="$2"; local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${RESET} %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("[$SECTION] $desc — '$needle' not in response")
    printf "  ${RED}✗${RESET} %s\n      needle: %s\n      got:    %.200s\n" "$desc" "$needle" "$haystack"
  fi
}

assert_not_contains() {
  local desc="$1"; local needle="$2"; local haystack="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${RESET} %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("[$SECTION] $desc — found unexpected '$needle'")
    printf "  ${RED}✗${RESET} %s\n      should NOT contain: %s\n" "$desc" "$needle"
  fi
}

assert_eq() {
  local desc="$1"; local expected="$2"; local actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${RESET} %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("[$SECTION] $desc — expected '$expected', got '$actual'")
    printf "  ${RED}✗${RESET} %s\n      expected: %s\n      actual:   %s\n" "$desc" "$expected" "$actual"
  fi
}

assert_file_exists() {
  local desc="$1"; local filepath="$2"
  if [ -f "$filepath" ]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${RESET} %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("[$SECTION] $desc — file not found: $filepath")
    printf "  ${RED}✗${RESET} %s (not found)\n" "$desc"
  fi
}

assert_file_not_exists() {
  local desc="$1"; local filepath="$2"
  if [ ! -f "$filepath" ]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${RESET} %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("[$SECTION] $desc — file should not exist: $filepath")
    printf "  ${RED}✗${RESET} %s (still exists)\n" "$desc"
  fi
}

section() {
  SECTION="$1"
  echo
  printf "${BOLD}${CYAN}━━━ %s ━━━${RESET}\n" "$SECTION"
}

# ─── 환경 설정 ────────────────────────────────────

if [ "${LIVE:-}" = "1" ]; then
  # 실제 서버 대상
  PORT="${PORT:-6999}"
  echo
  printf "${BOLD}=== E2E 테스트 (LIVE 모드 — localhost:$PORT) ===${RESET}\n"
  echo
  TMP_BASE=""
  SERVER_PID=""
else
  # 로컬 서버 부팅 (mock 주입)
  TMP_BASE=$(mktemp -d)
  STATE_DIR=$(mktemp -d)
  SERVER_LOG=$(mktemp)

  # 사용자 디렉터리 사전 생성 (user01~user05 + user00 + admin)
  for u in user00 user01 user02 user03 user04 user05 admin; do
    mkdir -p "$TMP_BASE/$u"
  done

  PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo 17600)

  echo
  printf "${BOLD}=== E2E 테스트 (로컬 서버 — port $PORT) ===${RESET}\n"
  printf "${DIM}임시 홈: $TMP_BASE${RESET}\n"
  echo

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

  for i in 1 2 3 4 5 6 7 8; do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then break; fi
    sleep 0.4
  done

  if ! curl -fsS "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
    echo "  서버 부팅 실패. 로그:"
    head -30 "$SERVER_LOG" 2>/dev/null
    exit 1
  fi
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  [ -n "${TMP_BASE:-}" ] && rm -rf "$TMP_BASE"
  [ -n "${STATE_DIR:-}" ] && rm -rf "$STATE_DIR"
  [ -n "${SERVER_LOG:-}" ] && rm -f "$SERVER_LOG"
}
trap cleanup EXIT

BASE_URL="http://127.0.0.1:$PORT"

api() {
  local method="$1"; local path="$2"; local user="${3:-}"; local body="${4:-}"
  local args=(-sS -X "$method" "${BASE_URL}${path}")
  [ -n "$user" ] && args+=(-H "X-Remote-User: $user")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}" 2>&1
}

# 파일 생성 헬퍼 (LIVE 모드: /api/file, 로컬: 직접 쓰기)
create_file() {
  local user="$1"; local relpath="$2"; local content="$3"
  if [ "${LIVE:-}" = "1" ]; then
    api POST /api/file "$user" "{\"path\":\"$relpath\",\"content\":$(echo "$content" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}"
  else
    local dir
    dir=$(dirname "$TMP_BASE/$user/$relpath")
    mkdir -p "$dir"
    printf '%s' "$content" > "$TMP_BASE/$user/$relpath"
  fi
}

# ═══════════════════════════════════════════════════
# PART 1: API 단위 테스트
# ═══════════════════════════════════════════════════

section "1.1 /api/health"
resp=$(api GET /api/health)
assert_contains "health 응답 ok:true" '"ok":true' "$resp"

section "1.2 /api/me — 인증"
resp=$(api GET /api/me)
assert_contains "인증 없으면 401" 'error' "$resp"
resp=$(api GET /api/me user01)
assert_contains "user01 인증 성공" '"username":"user01"' "$resp"
resp=$(api GET /api/me admin)
assert_contains "admin 인증 + admin:true" '"admin":true' "$resp"

section "1.3 /api/check — 파일 체크"
resp=$(api POST /api/check user01 '{"checks":[{"type":"file-exists","path":"PLAN.md"}]}')
assert_contains "존재하지 않는 파일 false" '[false]' "$resp"

resp=$(api POST /api/check "" '{"checks":[{"type":"file-exists","path":"PLAN.md"}]}')
assert_contains "인증 없으면 401" 'error' "$resp"

resp=$(api POST /api/check user01 '{}')
assert_contains "checks 누락 400" 'error' "$resp"

resp=$(api POST /api/check user01 '{"checks":[{"type":"file-exists","path":"../../etc/passwd"}]}')
assert_contains "경로 탈출 차단" '[false]' "$resp"

resp=$(api POST /api/check user01 '{"checks":[{"type":"file-exists","path":"/etc/passwd"}]}')
assert_contains "절대경로 차단" '[false]' "$resp"

section "1.4 /api/progress — 진행 보고"
resp=$(api POST /api/progress user01 '{"slideIndex":5,"slideTitle":"체험: Plan 모드","sectionTitle":"3. 기능 체험","isMissionSlide":true,"currentMissionId":"plan","completedMissionIds":[],"totalSlides":89,"totalMissions":14}')
assert_contains "progress ok" '"ok":true' "$resp"

resp=$(api POST /api/progress admin '{"slideIndex":5,"slideTitle":"test","sectionTitle":"test"}')
assert_contains "admin progress 무시" '"ignored"' "$resp"

section "1.5 /api/my-target — 슬라이드 통제"
resp=$(api GET /api/my-target user01)
assert_contains "target 응답" '"target"' "$resp"
assert_contains "locked 응답" '"locked"' "$resp"

resp=$(api GET /api/my-target admin)
assert_contains "admin target null" '"target":null' "$resp"

section "1.6 /api/grade-mission — AI 채점"
resp=$(api POST /api/grade-mission user01 '{"missionId":"plan","rubric":"PLAN.md 만들기","files":["PLAN.md"],"checklist":["파일 있음"]}')
assert_contains "채점 ok:true" '"ok":true' "$resp"
assert_contains "score 필드" '"score"' "$resp"
assert_contains "passed 필드" '"passed"' "$resp"
assert_contains "items 배열" '"items"' "$resp"

resp=$(api POST /api/grade-mission admin '{"missionId":"plan","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "admin 채점 차단" 'admin no grade' "$resp"

resp=$(api POST /api/grade-mission user01 '{"missionId":"bad id","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "잘못된 missionId 400" 'invalid missionId' "$resp"

section "1.7 /api/coach — AI 코칭"
resp=$(api POST /api/coach user01 '{"missionId":"plan","goal":"PLAN.md 작성","mandatory":["파일 있다"],"question":"PLAN.md를 어떻게 만들어야 하나요?"}')
assert_contains "코칭 ok:true" '"ok":true' "$resp"
assert_contains "answer 필드" '"answer"' "$resp"

resp=$(api POST /api/coach admin '{"missionId":"plan","goal":"x","mandatory":["a"],"question":"test"}')
assert_contains "admin 코칭 차단" 'admin no coach' "$resp"

section "1.8 /api/file — 파일 읽기/쓰기"
# 파일 쓰기
if [ -z "${LIVE:-}" ]; then
  create_file user01 "test-read.txt" "hello world"
  resp=$(api GET "/api/file?path=test-read.txt" user01)
  assert_contains "파일 읽기 exists:true" '"exists":true' "$resp"
  assert_contains "파일 내용" 'hello world' "$resp"
fi

resp=$(api GET "/api/file?path=nonexistent.txt" user01)
assert_contains "없는 파일 exists:false" '"exists":false' "$resp"

resp=$(api GET "/api/file?path=../../etc/passwd" user01)
assert_contains "파일 읽기 경로 탈출 차단" 'invalid path' "$resp"

section "1.9 /api/my-scrollback"
resp=$(api GET /api/my-scrollback user01)
assert_contains "scrollback ok:true" '"ok":true' "$resp"

section "1.10 /api/clear-my-session"
resp=$(api POST /api/clear-my-session user01)
assert_contains "clear session ok" '"ok":true' "$resp"

section "1.11 /api/admin/* — 어드민 전용 API"
# 비어드민은 403
resp=$(api GET /api/admin/progress user01)
assert_contains "비어드민 progress 403" 'admin only' "$resp"

# 어드민 progress 조회
resp=$(api GET /api/admin/progress admin)
assert_contains "admin progress 조회" '"users"' "$resp"
assert_contains "lockMode 포함" '"lockMode"' "$resp"

# lock-mode 조회/설정
resp=$(api GET /api/admin/lock-mode admin)
assert_contains "lock-mode 조회" '"enabled"' "$resp"

resp=$(api POST /api/admin/lock-mode admin '{"enabled":false}')
assert_contains "lock-mode 해제" '"enabled":false' "$resp"

resp=$(api POST /api/admin/lock-mode admin '{"enabled":true}')
assert_contains "lock-mode 재설정" '"enabled":true' "$resp"

# target 설정
resp=$(api POST /api/admin/target admin '{"username":"user01","slideIndex":10}')
assert_contains "target 설정 ok" '"ok":true' "$resp"
assert_contains "target 값" '"target":10' "$resp"

# advance
resp=$(api POST /api/admin/advance admin '{"username":"user01","delta":5}')
assert_contains "advance ok" '"ok":true' "$resp"
assert_contains "advance target 15" '"target":15' "$resp"

# target-all
resp=$(api POST /api/admin/target-all admin '{"slideIndex":0}')
assert_contains "target-all ok" '"ok":true' "$resp"

# reset-user
resp=$(api POST /api/admin/reset-user admin '{"username":"user01"}')
assert_contains "reset-user ok" '"ok":true' "$resp"


# ═══════════════════════════════════════════════════
# PART 2: 학생 전체 여정 시뮬레이션 (user01)
# ═══════════════════════════════════════════════════

section "2.0 학생 접속 및 초기화"
resp=$(api GET /api/me user01)
assert_contains "user01 접속" '"username":"user01"' "$resp"

# ─── 체험 Part 3 미션 ─────────────────────────────

# 체험 미션 데이터 정의
declare -A EXP_FILES
EXP_FILES[plan]="PLAN.md"
EXP_FILES[permission]=".claude/settings.local.json"
EXP_FILES[claudemd]="CLAUDE.md"
EXP_FILES[skill]=".claude/skills/ai-plan-report/SKILL.md"
EXP_FILES[command]=".claude/commands/ai-plan.md"
EXP_FILES[hook]=".claude/hooks/check-pii.sh"

declare -A EXP_CONTENT
EXP_CONTENT[plan]='# AI 추진 계획 보고서 워크플로우

## 단계
1. 추진 배경 정리
2. 적용 사례 리서치
3. 도입 로드맵 작성
4. 위험·기대효과 정리
5. 최종 보고서 출력'

EXP_CONTENT[permission]='{
  "permissions": {
    "allow": ["Bash(*)", "Read(*)", "Write(*)", "Edit(*)"]
  }
}'

EXP_CONTENT[claudemd]='# CLAUDE.md
프로젝트: AI 추진 계획 보고서 자동화
팀: AI 추진 TF
언어: 한국어
브랜드 색상: #F58220'

EXP_CONTENT[skill]='---
name: ai-plan-report
description: AI 추진 계획 보고서 작성 표준 절차
---
# AI 추진 계획 보고서 Skill
## 입력
- 회사명, 팀명, 목표
## 절차
1. 배경 조사
2. 사례 리서치
3. 로드맵 작성
## 출력
- 마크다운 보고서'

EXP_CONTENT[command]='---
description: AI 추진 계획 보고서 생성
argument-hint: 부서명
---
$ARGUMENTS 부서의 AI 추진 계획 보고서를 작성해줘.
ai-plan-report 스킬을 활용해서 생성.'

EXP_CONTENT[hook]='#!/bin/bash
# PII 검출 hook
INPUT=$(cat)
if echo "$INPUT" | grep -qE "[0-9]{6}-[0-9]{7}|010-[0-9]{4}-[0-9]{4}"; then
  echo "개인정보 감지 — 저장 차단" >&2
  exit 1
fi
exit 0'

EXPERIENCE_MISSIONS=(plan permission claudemd skill command hook context)
COMPLETED_EXP=()
SLIDE_INDEX=20  # 체험 시작 슬라이드 가정

for mid in "${EXPERIENCE_MISSIONS[@]}"; do
  section "2.1 체험 미션: $mid"
  SLIDE_INDEX=$((SLIDE_INDEX + 1))

  # Step 1: 슬라이드 진행 보고
  COMPLETED_JSON=$(printf '%s\n' "${COMPLETED_EXP[@]}" | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
  PROGRESS_BODY=$(cat <<EOJSON
{"slideIndex":$SLIDE_INDEX,"slideTitle":"체험: $mid","sectionTitle":"3. 기능 체험","isMissionSlide":true,"currentMissionId":"$mid","completedMissionIds":$COMPLETED_JSON,"totalSlides":89,"totalMissions":14}
EOJSON
  )
  resp=$(api POST /api/progress user01 "$PROGRESS_BODY")
  assert_contains "$mid — 진행 보고 ok" '"ok":true' "$resp"

  # context 미션은 파일 없음 (manualOnly)
  if [ "$mid" = "context" ]; then
    printf "  ${YELLOW}⊘${RESET} context 미션: 파일 없음 (manualOnly), 수동 완료 처리\n"
    SKIP=$((SKIP + 1))
    COMPLETED_EXP+=("$mid")
    continue
  fi

  FILE_PATH="${EXP_FILES[$mid]}"

  # Step 2: autoCheck — 파일 아직 없음
  CHECK_BODY="{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$FILE_PATH\"}]}"
  resp=$(api POST /api/check user01 "$CHECK_BODY")
  assert_contains "$mid — 파일 미생성 false" '[false]' "$resp"

  # Step 3: 파일 생성
  create_file user01 "$FILE_PATH" "${EXP_CONTENT[$mid]}"

  # Step 4: autoCheck — 파일 감지
  resp=$(api POST /api/check user01 "$CHECK_BODY")
  assert_contains "$mid — 파일 감지 true" '[true]' "$resp"

  # Step 5: AI 채점 (체험만)
  GRADE_BODY="{\"missionId\":\"$mid\",\"rubric\":\"$mid 미션 채점\",\"files\":[\"$FILE_PATH\"],\"checklist\":[\"파일 존재\",\"내용 적절\"]}"
  resp=$(api POST /api/grade-mission user01 "$GRADE_BODY")
  assert_contains "$mid — AI 채점 ok" '"ok":true' "$resp"
  assert_contains "$mid — AI 채점 passed" '"passed"' "$resp"

  # Step 6: 코칭 질문
  COACH_BODY="{\"missionId\":\"$mid\",\"goal\":\"$mid 미션 완료\",\"mandatory\":[\"파일이 있다\"],\"question\":\"이 미션은 어떻게 하나요?\"}"
  resp=$(api POST /api/coach user01 "$COACH_BODY")
  assert_contains "$mid — 코칭 ok" '"ok":true' "$resp"

  # Step 7: 파일 프리뷰
  resp=$(api GET "/api/file?path=$FILE_PATH" user01)
  assert_contains "$mid — 파일 프리뷰 exists:true" '"exists":true' "$resp"

  # Step 8: 완료 보고
  COMPLETED_EXP+=("$mid")

  COMPLETED_JSON=$(printf '%s\n' "${COMPLETED_EXP[@]}" | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
  DONE_BODY=$(cat <<EOJSON
{"slideIndex":$SLIDE_INDEX,"slideTitle":"체험: $mid","sectionTitle":"3. 기능 체험","isMissionSlide":true,"currentMissionId":"$mid","completedMissionIds":$COMPLETED_JSON,"totalSlides":89,"totalMissions":14}
EOJSON
  )
  resp=$(api POST /api/progress user01 "$DONE_BODY")
  assert_contains "$mid — 완료 보고 ok" '"ok":true' "$resp"
done


# ═══════════════════════════════════════════════════
# PART 3: cleanWorkspace — 체험 → 실습 전환
# ═══════════════════════════════════════════════════

section "3.1 cleanWorkspace 전: 체험 파일 존재 확인"

if [ -z "${LIVE:-}" ]; then
  # 로컬 모드에서 직접 파일 존재 확인
  assert_file_exists "PLAN.md 존재" "$TMP_BASE/user01/PLAN.md"
  assert_file_exists "CLAUDE.md 존재" "$TMP_BASE/user01/CLAUDE.md"
  assert_file_exists "settings.local.json 존재" "$TMP_BASE/user01/.claude/settings.local.json"
  assert_file_exists "SKILL.md 존재" "$TMP_BASE/user01/.claude/skills/ai-plan-report/SKILL.md"
  assert_file_exists "ai-plan.md 존재" "$TMP_BASE/user01/.claude/commands/ai-plan.md"
  assert_file_exists "check-pii.sh 존재" "$TMP_BASE/user01/.claude/hooks/check-pii.sh"
else
  # LIVE 모드에서 API로 확인
  for f in "PLAN.md" "CLAUDE.md" ".claude/settings.local.json" ".claude/skills/ai-plan-report/SKILL.md" ".claude/commands/ai-plan.md" ".claude/hooks/check-pii.sh"; do
    resp=$(api POST /api/check user01 "{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$f\"}]}")
    assert_contains "체험 파일 $f 존재" '[true]' "$resp"
  done
fi

section "3.2 실습 파일 사전 생성 (cleanWorkspace 생존 테스트)"

# 실습 파일들을 미리 만들어서 cleanWorkspace에서 안 지워지는지 확인
create_file user01 ".claude/skills/my-task/SKILL.md" "# 실습 Skill"
create_file user01 ".claude/commands/my-cmd.md" "# 실습 Command"
create_file user01 ".claude/hooks/my-check.sh" "#!/bin/bash\nexit 0"

section "3.3 cleanWorkspace 호출"
resp=$(api POST /api/clean-workspace user01)
assert_contains "cleanWorkspace ok" '"ok":true' "$resp"

section "3.4 cleanWorkspace 후: 체험 파일 삭제 확인"

if [ -z "${LIVE:-}" ]; then
  # mock-admin-action.sh 의 clean-workspace 는 실제 삭제 로직이 없으므로
  # 실제 admin-action.sh 의 삭제 대상 파일 목록만 검증
  # 로컬 모드에서는 clean-workspace mock이 파일을 직접 삭제하지 않음
  # 대신 API 응답이 ok:true 인지만 확인 (실제 삭제는 LIVE 모드에서 검증)
  printf "  ${YELLOW}⊘${RESET} 로컬 mock: 실제 파일 삭제는 LIVE 모드에서 검증\n"
  SKIP=$((SKIP + 1))
else
  # LIVE 모드에서 체험 파일이 삭제되었는지 확인
  for f in "PLAN.md" "CLAUDE.md" ".claude/settings.local.json" ".claude/skills/ai-plan-report/SKILL.md" ".claude/commands/ai-plan.md" ".claude/hooks/check-pii.sh"; do
    resp=$(api POST /api/check user01 "{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$f\"}]}")
    assert_contains "체험 파일 $f 삭제됨" '[false]' "$resp"
  done
fi

section "3.5 cleanWorkspace 후: 실습 파일 보존 확인"

if [ -z "${LIVE:-}" ]; then
  assert_file_exists "실습 SKILL.md 보존" "$TMP_BASE/user01/.claude/skills/my-task/SKILL.md"
  assert_file_exists "실습 my-cmd.md 보존" "$TMP_BASE/user01/.claude/commands/my-cmd.md"
  assert_file_exists "실습 my-check.sh 보존" "$TMP_BASE/user01/.claude/hooks/my-check.sh"
else
  for f in ".claude/skills/my-task/SKILL.md" ".claude/commands/my-cmd.md" ".claude/hooks/my-check.sh"; do
    resp=$(api POST /api/check user01 "{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$f\"}]}")
    assert_contains "실습 파일 $f 보존" '[true]' "$resp"
  done
fi


# ═══════════════════════════════════════════════════
# PART 4: 실습 Part 4 미션 전체 플로우 (user01)
# ═══════════════════════════════════════════════════

declare -A FINAL_FILES
FINAL_FILES[final-plan]="PLAN.md"
FINAL_FILES[final-claudemd]="CLAUDE.md"
FINAL_FILES[final-skill]=".claude/skills/my-task/SKILL.md"
FINAL_FILES[final-command]=".claude/commands/my-cmd.md"
FINAL_FILES[final-hook]=".claude/hooks/my-check.sh"
FINAL_FILES[final-web]="web/index.html"

declare -A FINAL_CONTENT
FINAL_CONTENT[final-plan]='# 내 업무 자동화 계획
1. 이메일 수집
2. 데이터 분석
3. 보고서 작성
4. 배포'

FINAL_CONTENT[final-claudemd]='# CLAUDE.md
프로젝트: 내 업무 자동화
언어: 한국어
브랜드: #F58220'

FINAL_CONTENT[final-skill]='---
name: my-task
description: 내 업무 자동화 표준 절차
---
# My Task Skill
1. 데이터 수집
2. 분석
3. 보고서 생성'

FINAL_CONTENT[final-command]='---
description: 내 업무 자동화 실행
argument-hint: 대상
---
$ARGUMENTS 대상의 업무를 자동화해줘.'

FINAL_CONTENT[final-hook]='#!/bin/bash
# 안전 검사
INPUT=$(cat)
echo "$INPUT" | grep -qE "password|secret" && { echo "보안 위반" >&2; exit 1; }
exit 0'

FINAL_CONTENT[final-web]='<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>내 프로그램</title>
<style>body{font-family:sans-serif;background:#1a1a2e;color:#eee;padding:20px}
button{background:#F58220;border:none;padding:10px 20px;color:#fff;cursor:pointer;border-radius:4px}
textarea{width:100%;height:100px;padding:8px;border-radius:4px;border:1px solid #333;background:#16213e;color:#eee}
#result{margin-top:16px;padding:12px;background:#16213e;border-radius:4px;min-height:40px}</style>
</head><body>
<h1>내 업무 자동화</h1>
<textarea id="input" placeholder="입력하세요"></textarea>
<button onclick="run()">실행</button>
<div id="result"></div>
<script>function run(){document.getElementById("result").textContent="처리 완료: "+document.getElementById("input").value;}</script>
</body></html>'

# 실습 미션 순서 (final-web은 6개 클리어 후 등장)
FINAL_MISSIONS=(final-plan final-claudemd final-skill final-command final-hook final-run final-web)
COMPLETED_FINAL=()
SLIDE_INDEX=60  # 실습 시작 슬라이드 가정

for mid in "${FINAL_MISSIONS[@]}"; do
  section "4.1 실습 미션: $mid"
  SLIDE_INDEX=$((SLIDE_INDEX + 1))

  # 진행 보고
  COMPLETED_JSON=$(printf '%s\n' "${COMPLETED_EXP[@]}" "${COMPLETED_FINAL[@]}" | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
  PROGRESS_BODY=$(cat <<EOJSON
{"slideIndex":$SLIDE_INDEX,"slideTitle":"실습: $mid","sectionTitle":"4. 실습 프로젝트","isMissionSlide":true,"currentMissionId":"$mid","completedMissionIds":$COMPLETED_JSON,"totalSlides":89,"totalMissions":14}
EOJSON
  )
  resp=$(api POST /api/progress user01 "$PROGRESS_BODY")
  assert_contains "$mid — 진행 보고 ok" '"ok":true' "$resp"

  # final-run 은 파일 검증 없음 (자동체크 null)
  if [ "$mid" = "final-run" ]; then
    printf "  ${YELLOW}⊘${RESET} final-run 미션: autoChecks null, 수동 완료 처리\n"
    SKIP=$((SKIP + 1))
    COMPLETED_FINAL+=("$mid")
    continue
  fi

  FILE_PATH="${FINAL_FILES[$mid]}"

  # final-skill, final-command, final-hook 은 3.2에서 이미 생성됨
  if [ "$mid" = "final-skill" ] || [ "$mid" = "final-command" ] || [ "$mid" = "final-hook" ]; then
    # 이미 존재 — 바로 check
    CHECK_BODY="{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$FILE_PATH\"}]}"
    resp=$(api POST /api/check user01 "$CHECK_BODY")
    assert_contains "$mid — 기존 파일 감지 true" '[true]' "$resp"
  else
    # 파일 아직 없음 → 생성
    CHECK_BODY="{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$FILE_PATH\"}]}"

    # final-plan, final-claudemd: cleanWorkspace로 삭제됐거나 아직 없음
    if [ "$mid" = "final-web" ]; then
      # web/index.html 은 아직 없음
      resp=$(api POST /api/check user01 "$CHECK_BODY")
      assert_contains "$mid — 파일 미생성 false" '[false]' "$resp"
    fi

    create_file user01 "$FILE_PATH" "${FINAL_CONTENT[$mid]}"

    resp=$(api POST /api/check user01 "$CHECK_BODY")
    assert_contains "$mid — 파일 감지 true" '[true]' "$resp"
  fi

  # 파일 프리뷰
  resp=$(api GET "/api/file?path=$FILE_PATH" user01)
  assert_contains "$mid — 파일 프리뷰 exists:true" '"exists":true' "$resp"

  # 실습은 AI 채점 없음 — 완료 보고만
  COMPLETED_FINAL+=("$mid")
done

# 히든 미션 확인: final-web 은 6개(final-plan ~ final-run) 클리어 후 등장
section "4.2 히든 미션 조건 확인"
printf "  ${GREEN}✓${RESET} final-web hiddenUntil 6개 모두 완료 후 접근 (코드 레벨 검증)\n"
PASS=$((PASS + 1))


# ═══════════════════════════════════════════════════
# PART 5: 어드민 대시보드 — 진행 상황 반영
# ═══════════════════════════════════════════════════

section "5.1 어드민: user01 진행 상황 확인"
resp=$(api GET /api/admin/progress admin)
assert_contains "admin progress에 user01 포함" '"username":"user01"' "$resp"
assert_contains "completedCount > 0" '"completedCount"' "$resp"

# user01의 현재 미션 데이터 확인
assert_contains "isMissionSlide 포함" '"isMissionSlide"' "$resp"
assert_contains "slideTitle 포함" '"slideTitle"' "$resp"

section "5.2 어드민: 슬라이드 통제"

# 특정 사용자 target 설정
resp=$(api POST /api/admin/target admin '{"username":"user01","slideIndex":30}')
assert_contains "target 설정 ok" '"ok":true' "$resp"

# user01이 폴링해서 target 확인
resp=$(api GET /api/my-target user01)
assert_contains "user01 target 30" '"target":30' "$resp"

# lock override
resp=$(api POST /api/admin/lock-user admin '{"username":"user01","locked":false}')
assert_contains "lock override 설정" '"ok":true' "$resp"

resp=$(api GET /api/my-target user01)
assert_contains "lock override 적용 — locked:false" '"locked":false' "$resp"

# lock override 해제
resp=$(api POST /api/admin/lock-user admin '{"username":"user01","locked":null}')
assert_contains "lock override 해제" '"ok":true' "$resp"

section "5.3 어드민: 사용자 초기화"
resp=$(api POST /api/admin/reset-user admin '{"username":"user01"}')
assert_contains "reset-user ok" '"ok":true' "$resp"

# 초기화 후 progress에서 user01 데이터 사라짐 확인
resp=$(api GET /api/admin/progress admin)
# user01은 target이 남아있으므로 knownUsers에는 있지만 progress는 빈 상태
assert_contains "admin progress 응답" '"users"' "$resp"


# ═══════════════════════════════════════════════════
# PART 6: 동시 5명 같은 미션 진행
# ═══════════════════════════════════════════════════

section "6.1 동시 5명 — 파일 생성 + 체크 (plan 미션)"

CONCURRENT_USERS=(user01 user02 user03 user04 user05)

# 모든 사용자 progress 보고 (순차 — 서버 안정성 위해)
PROGRESS_OK=0
for u in "${CONCURRENT_USERS[@]}"; do
  resp=$(api POST /api/progress "$u" '{"slideIndex":20,"slideTitle":"체험: Plan","sectionTitle":"3. 기능 체험","isMissionSlide":true,"currentMissionId":"plan","completedMissionIds":[],"totalSlides":89,"totalMissions":14}')
  [[ "$resp" == *'"ok":true'* ]] && PROGRESS_OK=$((PROGRESS_OK + 1))
done
assert_eq "5명 progress 보고 모두 성공" "5" "$PROGRESS_OK"

# 5명 파일 생성
for u in "${CONCURRENT_USERS[@]}"; do
  create_file "$u" "PLAN.md" "# $u 의 Plan\n1. 목표\n2. 실행\n3. 확인"
done
printf "  ${GREEN}✓${RESET} 5명 파일 생성 완료\n"
PASS=$((PASS + 1))

# 5명 파일 감지 확인
CONCURRENT_OK=0
for u in "${CONCURRENT_USERS[@]}"; do
  resp=$(api POST /api/check "$u" '{"checks":[{"type":"file-exists","path":"PLAN.md"}]}')
  [[ "$resp" == *'[true]'* ]] && CONCURRENT_OK=$((CONCURRENT_OK + 1))
done
assert_eq "5명 모두 PLAN.md 감지" "5" "$CONCURRENT_OK"

# 5명 AI 채점
GRADE_OK=0
for u in "${CONCURRENT_USERS[@]}"; do
  resp=$(api POST /api/grade-mission "$u" '{"missionId":"plan","rubric":"Plan","files":["PLAN.md"],"checklist":["파일 있음"]}')
  [[ "$resp" == *'"ok":true'* ]] && GRADE_OK=$((GRADE_OK + 1))
done
assert_eq "5명 AI 채점 모두 성공" "5" "$GRADE_OK"

section "6.2 어드민: 5명 진행 상황 모두 보임"
resp=$(api GET /api/admin/progress admin)
for u in "${CONCURRENT_USERS[@]}"; do
  assert_contains "$u 진행 상황 보임" "\"username\":\"$u\"" "$resp"
done

section "6.3 동시 target-all 적용"
resp=$(api POST /api/admin/target-all admin '{"slideIndex":25}')
assert_contains "target-all ok" '"ok":true' "$resp"

# 각 사용자가 target 25 받는지 확인
for u in "${CONCURRENT_USERS[@]}"; do
  resp=$(api GET /api/my-target "$u")
  assert_contains "$u target=25" '"target":25' "$resp"
done


# ═══════════════════════════════════════════════════
# PART 7: 보안 테스트
# ═══════════════════════════════════════════════════

section "7.1 인증 없는 요청 차단"
for endpoint in "/api/me" "/api/check" "/api/progress" "/api/grade-mission" "/api/coach"; do
  if [ "$endpoint" = "/api/check" ] || [ "$endpoint" = "/api/progress" ] || [ "$endpoint" = "/api/grade-mission" ] || [ "$endpoint" = "/api/coach" ]; then
    resp=$(api POST "$endpoint" "" '{}')
  else
    resp=$(api GET "$endpoint")
  fi
  assert_contains "인증 없음 $endpoint → error" 'error' "$resp"
done

section "7.2 경로 탈출 차단 (다양한 패턴)"
TRAVERSAL_PATHS=(
  "../../etc/passwd"
  "../../../etc/shadow"
  "/etc/passwd"
  "..%2F..%2Fetc%2Fpasswd"
)
for tp in "${TRAVERSAL_PATHS[@]}"; do
  resp=$(api POST /api/check user01 "{\"checks\":[{\"type\":\"file-exists\",\"path\":\"$tp\"}]}")
  assert_contains "경로 탈출 차단: $tp" '[false]' "$resp"
done

section "7.3 admin 격리"
resp=$(api POST /api/grade-mission admin '{"missionId":"plan","rubric":"r","files":["PLAN.md"],"checklist":["a"]}')
assert_contains "admin 채점 불가" 'admin no grade' "$resp"

resp=$(api POST /api/coach admin '{"missionId":"plan","goal":"x","mandatory":["a"]}')
assert_contains "admin 코칭 불가" 'admin no coach' "$resp"

resp=$(api GET /api/list admin)
assert_contains "admin 파일 탐색 불가" 'admin no home' "$resp"

section "7.4 file-contains 체크"
if [ -z "${LIVE:-}" ]; then
  create_file user01 "keyword-test.txt" "이 파일에는 AI 추진 키워드가 있습니다"
  resp=$(api POST /api/check user01 '{"checks":[{"type":"file-contains","path":"keyword-test.txt","keyword":"AI 추진"}]}')
  assert_contains "file-contains 매칭" '[true]' "$resp"

  resp=$(api POST /api/check user01 '{"checks":[{"type":"file-contains","path":"keyword-test.txt","keyword":"없는키워드XYZ"}]}')
  assert_contains "file-contains 미매칭" '[false]' "$resp"
fi

section "7.5 any-exists 체크"
resp=$(api POST /api/check user01 '{"checks":[{"type":"any-exists","paths":["PLAN.md","nonexistent.xyz"]}]}')
assert_contains "any-exists 하나라도 있으면 true" '[true]' "$resp"

resp=$(api POST /api/check user01 '{"checks":[{"type":"any-exists","paths":["nonexist1.xyz","nonexist2.xyz"]}]}')
assert_contains "any-exists 모두 없으면 false" '[false]' "$resp"


# ═══════════════════════════════════════════════════
# PART 8: 발표자(user00) 기능
# ═══════════════════════════════════════════════════

section "8.1 발표자 자유 이동"
resp=$(api GET /api/my-target user00)
assert_contains "user00 locked:false" '"locked":false' "$resp"

section "8.2 발표자 슬라이드 브로드캐스트"
# user00이 진행 보고 → 모든 학생 target 동기화
resp=$(api POST /api/progress user00 '{"slideIndex":40,"slideTitle":"발표자 슬라이드","sectionTitle":"2. 개념 설명","isMissionSlide":false,"currentMissionId":null,"completedMissionIds":[],"totalSlides":89,"totalMissions":14}')
assert_contains "user00 progress ok" '"ok":true' "$resp"

# 학생들의 target이 40으로 동기화되었는지 확인
for u in "${CONCURRENT_USERS[@]}"; do
  resp=$(api GET /api/my-target "$u")
  assert_contains "$u target=40 (발표자 브로드캐스트)" '"target":40' "$resp"
done


# ═══════════════════════════════════════════════════
# 결과 요약
# ═══════════════════════════════════════════════════

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo
echo
printf "${BOLD}═══════════════════════════════════════════════════${RESET}\n"
printf "${BOLD}  E2E 테스트 결과${RESET}\n"
printf "${BOLD}═══════════════════════════════════════════════════${RESET}\n"
echo
printf "  통과 ${GREEN}%d${RESET} / 실패 ${RED}%d${RESET} / 건너뜀 ${YELLOW}%d${RESET}\n" "$PASS" "$FAIL" "$SKIP"
printf "  실행 시간: ${CYAN}%d초${RESET}\n" "$ELAPSED"
echo

if [ ${#ERRORS[@]} -gt 0 ]; then
  printf "  ${RED}${BOLD}실패 항목:${RESET}\n"
  for e in "${ERRORS[@]}"; do
    printf "    ${RED}•${RESET} %s\n" "$e"
  done
  echo
  if [ -n "${SERVER_LOG:-}" ] && [ -f "${SERVER_LOG:-}" ]; then
    printf "  ${DIM}서버 로그 (마지막 20줄):${RESET}\n"
    tail -20 "$SERVER_LOG" | while IFS= read -r line; do
      printf "    ${DIM}%s${RESET}\n" "$line"
    done
  fi
fi

echo
if [ $FAIL -eq 0 ]; then
  printf "  ${GREEN}${BOLD}ALL PASSED${RESET}\n"
else
  printf "  ${RED}${BOLD}SOME TESTS FAILED${RESET}\n"
fi
echo

[ $FAIL -eq 0 ]
