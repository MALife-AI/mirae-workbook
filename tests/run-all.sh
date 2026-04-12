#!/bin/bash
# run-all.sh — 전체 테스트 러너
# 1) 셸 스크립트 단위 테스트
# 2) server.js 라우트 통합 테스트 (mock 주입)
# 3) 프론트엔드 정적 검증 + 빌드
# 4) UI 렌더 새너티 + vite preview 스모크

set -u

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0
SUMMARY=()

run_suite() {
  local name="$1"; local script="$2"
  echo
  echo "─────────────────────────────────────────────"
  echo " ▶ $name"
  echo "─────────────────────────────────────────────"
  if bash "$script"; then
    SUMMARY+=("✓ $name")
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    SUMMARY+=("✗ $name")
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
}

run_suite "[1/6] 셸 스크립트 단위 테스트"          "$REPO_DIR/unit-shell-scripts.sh"
run_suite "[2/6] server.js 라우트 통합 테스트"     "$REPO_DIR/integration-server.sh"
run_suite "[3/6] 프론트엔드 정적 + 빌드 검증"      "$REPO_DIR/frontend-validation.sh"
run_suite "[4/6] UI 렌더 새너티 + preview 스모크"  "$REPO_DIR/ui-render-check.sh"
run_suite "[5/6] 학습자 여정 시뮬레이션 (user01)"  "$REPO_DIR/learner-journey.sh"
run_suite "[6/6] E2E 전체 플로우 테스트"           "$REPO_DIR/e2e-test.sh"

echo
echo "═════════════════════════════════════════════"
echo "  전체 결과"
echo "═════════════════════════════════════════════"
for line in "${SUMMARY[@]}"; do
  if [[ "$line" == ✓* ]]; then
    printf "  \033[32m%s\033[0m\n" "$line"
  else
    printf "  \033[31m%s\033[0m\n" "$line"
  fi
done
echo
printf "  스위트 통과 \033[32m%d\033[0m / 실패 \033[31m%d\033[0m\n" "$TOTAL_PASS" "$TOTAL_FAIL"
echo

[ $TOTAL_FAIL -eq 0 ]
