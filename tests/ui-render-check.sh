#!/bin/bash
# ui-render-check.sh
# 시각적 깨짐 정적 검증 + vite preview 스모크.
# 헤드리스 브라우저가 없어서 (chromium 미설치) 다음을 검사:
# 1. 새 컴포넌트 / 슬라이드의 핵심 레이아웃 토큰 (gridTemplateColumns, position, flex, ...)
# 2. 음수 여백 / 0 사이즈 등 깨짐 패턴
# 3. dist/index.html 이 정상 마크업
# 4. vite preview 가 200 OK 로 / 를 응답 (3초 smoke)
# 5. preview 응답 본문에 #root 마운트 노드 + 빌드 산출물 script 태그 존재

set -u

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$REPO_DIR/src"
DIST_DIR="$REPO_DIR/dist"

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

assert_no_grep() {
  local desc="$1"; local pattern="$2"; local file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc — found unexpected pattern '$pattern' in $file")
    printf "  \033[31m✗\033[0m %s (안티패턴 발견)\n" "$desc"
  else
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m %s\n" "$desc"
  fi
}

echo
echo "=== ui-render-check ==="
echo

# ─── 핵심 레이아웃 토큰 — 깨짐 방지 ───
echo "[레이아웃 토큰]"

# AssistantOverlay 위치 (오른쪽 하단 absolute, 터미널 위)
assert_grep "AssistantOverlay position absolute" 'position: "absolute"' "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "AssistantOverlay right 위치" 'right: 16' "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "AssistantOverlay bottom 위치" 'bottom: 16' "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "AssistantOverlay zIndex 충분히 높음" 'zIndex: 90' "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "AssistantOverlay 너비 (320 고정)" 'width: 320' "$SRC_DIR/components/AssistantOverlay.jsx"
assert_grep "AssistantOverlay maxHeight (overflow 방지)" 'maxHeight' "$SRC_DIR/components/AssistantOverlay.jsx"

# MissionSlide 의 우측 영역에 position: relative 설정 (overlay 의 absolute 기준점)
assert_grep "터미널 영역 position relative (overlay 기준)" 'minWidth: 0, position: "relative"' "$SRC_DIR/components/MissionSlide.jsx"

# MissionSlide 좌우 분할: 35% / 65%
assert_grep "좌측 briefing 35% width" 'width: "35%"' "$SRC_DIR/components/MissionSlide.jsx"

# 워크북 사용법 슬라이드의 grid 35/65 컬럼
assert_grep "워크북 슬라이드 grid 35/65" '"35% 65%"' "$SRC_DIR/workbook.jsx"

# MissionSlide 의 좌측 패널 overflowY auto (긴 콘텐츠 스크롤)
assert_grep "좌측 briefing overflowY auto" 'overflowY: "auto"' "$SRC_DIR/components/MissionSlide.jsx"

# ─── 안티패턴 — 깨짐 방지 ───
echo
echo "[안티패턴 검사]"

# 음수 width / height 없어야 함
assert_no_grep "MissionSlide 음수 width 없음" 'width: -' "$SRC_DIR/components/MissionSlide.jsx"
assert_no_grep "AssistantOverlay 음수 width 없음" 'width: -' "$SRC_DIR/components/AssistantOverlay.jsx"

# 0 width 컨테이너 없음 (의도적 placeholder 제외)
assert_no_grep "MissionSlide 0 width 컨테이너 없음" 'width: 0,' "$SRC_DIR/components/MissionSlide.jsx"

# JSX 균형은 vite build 가 권위 있게 검증함 — 여기선 생략 (self-closing 태그 false positive 방지)

# ─── dist/index.html ───
echo
echo "[dist 산출물]"
if [ ! -d "$DIST_DIR" ]; then
  echo "  (dist 가 없음 → vite build 먼저 실행)"
  cd "$REPO_DIR" && npx vite build > /dev/null 2>&1
fi
assert_grep "index.html 에 root div" '<div id="root"' "$DIST_DIR/index.html"
assert_grep "index.html 에 module script" 'type="module"' "$DIST_DIR/index.html"
assert_grep "index.html 에 stylesheet" 'rel="stylesheet"' "$DIST_DIR/index.html"

# ─── vite preview smoke ───
echo
echo "[vite preview smoke]"
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo 17173)

cd "$REPO_DIR"
PREVIEW_LOG=$(mktemp)
npx vite preview --port "$PORT" --strictPort --host 127.0.0.1 > "$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!
trap 'kill $PREVIEW_PID 2>/dev/null; rm -f "$PREVIEW_LOG"' EXIT

# 부팅 대기
for i in 1 2 3 4 5 6 8; do
  if curl -fsS "http://127.0.0.1:$PORT/" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

resp=$(curl -fsS "http://127.0.0.1:$PORT/" 2>&1)
if [ -n "$resp" ]; then
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m preview 응답 200\n"
else
  FAIL=$((FAIL + 1))
  ERRORS+=("preview / 응답 없음")
  printf "  \033[31m✗\033[0m preview / 응답 없음\n"
  cat "$PREVIEW_LOG" | head -20
fi

if echo "$resp" | grep -q '<div id="root"'; then
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m preview HTML 에 #root\n"
else
  FAIL=$((FAIL + 1))
  printf "  \033[31m✗\033[0m preview HTML 에 #root 없음\n"
fi

if echo "$resp" | grep -qE 'src="/assets/index-[a-z0-9]+\.js"'; then
  PASS=$((PASS + 1))
  printf "  \033[32m✓\033[0m preview HTML 이 빌드 번들 참조\n"
else
  FAIL=$((FAIL + 1))
  printf "  \033[31m✗\033[0m preview HTML 이 번들 참조 안 함\n"
fi

# 번들 자체도 200 응답하는가
BUNDLE_PATH=$(echo "$resp" | grep -oE '/assets/index-[a-z0-9]+\.js' | head -1)
if [ -n "$BUNDLE_PATH" ]; then
  if curl -fsS "http://127.0.0.1:$PORT$BUNDLE_PATH" > /dev/null; then
    PASS=$((PASS + 1))
    printf "  \033[32m✓\033[0m 번들 %s 응답 OK\n" "$BUNDLE_PATH"
  else
    FAIL=$((FAIL + 1))
    printf "  \033[31m✗\033[0m 번들 %s 응답 실패\n" "$BUNDLE_PATH"
  fi
fi

kill $PREVIEW_PID 2>/dev/null || true
wait $PREVIEW_PID 2>/dev/null || true

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
