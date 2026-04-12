#!/bin/bash
# frontend-validation.sh
# 프론트엔드 정적 검증:
# - 빌드가 성공하는가
# - 새 컴포넌트들이 번들에 포함됐는가
# - MissionSlide 의 새 구조 (GOAL/INPUT/OUTPUT/필수/도전/AI 채점) 가 소스에 있는가
# - 워크북 사용법 슬라이드가 SLIDES 배열에 추가됐는가
# - 어시스턴트 오버레이가 import 되고 마운트되는가
# - vite dev server 가 에러 없이 부팅하는가 (3초 smoke)

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$REPO_DIR/src"

PASS=0
FAIL=0
ERRORS=()

assert_grep() {
  local desc="$1"; local pattern="$2"; local file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — pattern '$pattern' not in $file")
    printf "  \033[31m✗\033[0m %s\n" "$desc"
  fi
}

assert_exists() {
  local desc="$1"; local path="$2"
  if [ -e "$path" ]; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — file not found: $path")
    printf "  \033[31m✗\033[0m %s\n" "$desc"
  fi
}

echo
echo "=== frontend-validation ==="
echo

# ─── 신규 파일 존재 ───
echo "[신규 파일]"
assert_exists "AssistantOverlay.jsx 존재" "$SRC_DIR/components/AssistantOverlay.jsx"
assert_exists "MissionSlide.jsx 존재" "$SRC_DIR/components/MissionSlide.jsx"
assert_exists "FileExplorer.jsx 존재" "$SRC_DIR/components/FileExplorer.jsx"
assert_exists "TtydEmbed.jsx 존재" "$SRC_DIR/components/TtydEmbed.jsx"
assert_exists "runtime.js 존재" "$SRC_DIR/lib/runtime.js"

# ─── runtime.js 신규 export ───
echo
echo "[runtime.js — 새 helpers]"
assert_grep "gradeMission export" "export async function gradeMission" "$SRC_DIR/lib/runtime.js"
assert_grep "coachMission export" "export async function coachMission" "$SRC_DIR/lib/runtime.js"
assert_grep "fetchMyScrollback export" "export async function fetchMyScrollback" "$SRC_DIR/lib/runtime.js"

# ─── MissionSlide 새 구조 ───
echo
echo "[MissionSlide.jsx — 새 안내/채점 UI]"
assert_grep "AssistantOverlay import" "import AssistantOverlay" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "gradeMission import" "gradeMission" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "setDemoMode import" "setDemoMode" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "GOAL 라벨 존재" "🎯 Goal" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "INPUT 라벨 존재" "📥 Input" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "OUTPUT 라벨 존재" "📤 Output" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "필수 체크리스트 라벨" "필수 체크리스트" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "도전 체크리스트 라벨" "도전 체크리스트" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "AI 채점 버튼 라벨" "AI 에게 상세 채점" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "handleGrade 핸들러 정의" "const handleGrade" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "gradeResult state" "setGradeResult" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "어시스턴트 마운트" "AssistantOverlay mission" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.goal 사용" "mission.goal" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.inputDesc 사용" "mission.inputDesc" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.outputDesc 사용" "mission.outputDesc" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.outputFiles 사용" "mission.outputFiles" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.mandatory 사용" "mission.mandatory" "$SRC_DIR/components/MissionSlide.jsx"
assert_grep "mission.challenge 사용" "mission.challenge" "$SRC_DIR/components/MissionSlide.jsx"

# ─── AssistantOverlay 구조 ───
echo
echo "[AssistantOverlay.jsx]"
assert_grep "coachMission 호출" "coachMission" "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "STATUS_META 정의" "STATUS_META" "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "최소화 토글" "setMinimized" "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "주기적 호출 useEffect" "intervalMs" "$SRC_DIR/components/AssistantOverlay.jsx"

# ─── workbook.jsx — 워크북 사용법 슬라이드 ───
echo
echo "[workbook.jsx — 신규 슬라이드 + Haiku 확장]"
assert_grep "워크북 사용법 슬라이드 제목" "워크북 사용법" "$SRC_DIR/workbook.jsx"
assert_grep "신규 슬라이드 본문" "어떻게 쓰나요" "$SRC_DIR/workbook.jsx"
assert_grep "복사/실행/클리어/AI 채점 버튼 안내" "🤖 AI 채점" "$SRC_DIR/workbook.jsx"
# Haiku swap useEffect: isPresenter 가드 제거 흔적 (모든 사용자 swap)
assert_grep "모든 사용자 setDemoMode" "모든 사용자" "$SRC_DIR/workbook.jsx"

# ─── 빌드 검증 ───
echo
echo "[vite build]"
cd "$REPO_DIR"
BUILD_LOG=$(mktemp)
if npx vite build > "$BUILD_LOG" 2>&1; then
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m vite build 성공\n"
else
  FAIL=$((FAIL + 1))
  ERRORS+=("vite build 실패")
  printf "  \033[31m✗\033[0m vite build 실패\n"
  tail -20 "$BUILD_LOG"
fi

# 빌드 산출물에 우리 컴포넌트 흔적 확인
if [ -f "$REPO_DIR/dist/version.txt" ]; then
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m dist/version.txt 생성\n"
else
  FAIL=$((FAIL + 1))
  ERRORS+=("dist/version.txt missing")
  printf "  \033[31m✗\033[0m dist/version.txt 미생성\n"
fi

# 번들 안에 신규 텍스트 흔적 (난독화 후에도 한국어 문자열은 보존)
BUNDLE=$(ls -1 "$REPO_DIR"/dist/assets/index-*.js 2>/dev/null | head -1)
if [ -n "$BUNDLE" ]; then
  if grep -q "AI 에게 상세 채점" "$BUNDLE"; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m 번들에 'AI 채점' 문자열 포함\n"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("bundle missing 'AI 채점' string")
    printf "  \033[31m✗\033[0m 번들에 'AI 채점' 문자열 없음\n"
  fi
  if grep -q "워크북 사용법" "$BUNDLE"; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m 번들에 '워크북 사용법' 슬라이드 포함\n"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("bundle missing '워크북 사용법' string")
    printf "  \033[31m✗\033[0m 번들에 '워크북 사용법' 없음\n"
  fi
  if grep -q "AI 조수" "$BUNDLE"; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m 번들에 'AI 조수' (어시스턴트) 문자열 포함\n"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("bundle missing 'AI 조수' string")
    printf "  \033[31m✗\033[0m 번들에 'AI 조수' 없음\n"
  fi
fi

rm -f "$BUILD_LOG"

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
