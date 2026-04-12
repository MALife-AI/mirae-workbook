#!/bin/bash
# prelogin-copy.sh
# 운영자가 미리 로그인해 둔 ~/.claude/.credentials.json을
# user01~userN의 홈에 복사해서, 워크숍 사용자가 'claude /login' 없이
# 바로 'claude' 한 줄로 시작할 수 있게 한다.
#
# 사용법:
#   sudo ./prelogin-copy.sh                       # 기본: 15명, 원본 = /home/lsc
#   sudo ./prelogin-copy.sh 15                    # 사용자 수 명시
#   sudo ./prelogin-copy.sh 15 /home/admin        # 원본 홈 디렉터리 명시
#
# 주의:
#   - .credentials.json은 OAuth 토큰. 토큰이 만료/회수되면 모든 사용자가 동시에 깨짐.
#   - .claude.json (글로벌 설정·히스토리)은 운영자 개인정보가 들어있어 복사하지 않음.
#   - 토큰 1개를 15명이 공유 → API 호출 로그가 한 계정에 집중. Console 한도 확인 필수.

set -e

if [ "$EUID" -ne 0 ]; then
  echo "sudo로 실행하세요: sudo $0 [USER_COUNT] [SOURCE_HOME]"
  exit 1
fi

USER_COUNT="${1:-20}"
SOURCE_HOME="${2:-/home/lsc}"
SOURCE_CRED="$SOURCE_HOME/.claude/.credentials.json"
SOURCE_CFG="$SOURCE_HOME/.claude.json"
USER_PREFIX="user"

echo "=========================================="
echo "  Mirae Workbook — Pre-login Credential Copy"
echo "=========================================="
echo "  원본 토큰: $SOURCE_CRED"
echo "  대상     : ${USER_PREFIX}01 ~ ${USER_PREFIX}${USER_COUNT}"
echo ""

if [ ! -f "$SOURCE_CRED" ]; then
  echo "ERROR: 원본 토큰 파일이 없습니다: $SOURCE_CRED"
  echo "  먼저 운영자 계정($SOURCE_HOME)으로 'claude' 실행 → '/login' 완료해 주세요."
  exit 1
fi

if [ ! -f "$SOURCE_CFG" ]; then
  echo "ERROR: 운영자 .claude.json 없음: $SOURCE_CFG"
  echo "  먼저 운영자 계정으로 claude를 한 번 정상 실행해 주세요."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node가 필요합니다 (.claude.json 병합용)."
  exit 1
fi

# 토큰 파일 크기 정상성 체크 (보통 300~2KB)
SIZE=$(stat -c '%s' "$SOURCE_CRED")
if [ "$SIZE" -lt 100 ] || [ "$SIZE" -gt 10240 ]; then
  echo "WARN: $SOURCE_CRED 크기가 비정상적입니다 ($SIZE bytes). 그래도 진행합니다."
fi

COPIED=0
SKIPPED=0
for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  if ! id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME 없음, 스킵"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  TARGET_DIR="/home/${USERNAME}/.claude"
  TARGET_CRED="${TARGET_DIR}/.credentials.json"
  TARGET_CFG="/home/${USERNAME}/.claude.json"

  # 1) .credentials.json (OAuth 토큰) — 그대로 복사 (권한은 step 4에서 일괄 적용)
  mkdir -p "$TARGET_DIR"
  cp "$SOURCE_CRED" "$TARGET_CRED"

  # 2) .claude.json — 운영자 파일에서 인증 관련 키만 추출해서 사용자 파일에 머지.
  #    사용자의 기존 theme/firstStartTime 등은 보존. 운영자의 projects/history는 복사 안 함.
  SRC_CFG="$SOURCE_CFG" DST_CFG="$TARGET_CFG" node -e '
    const fs = require("fs");
    const src = JSON.parse(fs.readFileSync(process.env.SRC_CFG, "utf8"));
    let dst = {};
    try { dst = JSON.parse(fs.readFileSync(process.env.DST_CFG, "utf8")); } catch {}
    // Claude Code가 "로그인됨"으로 인식하는 데 필요한 최소 키 셋
    const AUTH_KEYS = [
      "userID",
      "oauthAccount",
      "hasCompletedOnboarding",
      "lastOnboardingVersion",
      "subscriptionNoticeCount",
      "claudeCodeFirstTokenDate",
    ];
    for (const k of AUTH_KEYS) {
      if (src[k] !== undefined) dst[k] = src[k];
    }
    fs.writeFileSync(process.env.DST_CFG, JSON.stringify(dst, null, 2));
  '

  # 3) ~/.claude/settings.json — Sonnet 4.6 + 사전 권한
  # 기본 출력 토큰 = 8192 (체험용). 실습 페이지에선 `claude-long` 으로 32K 사용.
  TARGET_SETTINGS="${TARGET_DIR}/settings.json"
  cat > "$TARGET_SETTINGS" <<'SETTINGS'
{
  "model": "claude-sonnet-4-6",
  "env": {
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "8192",
    "MAX_THINKING_TOKENS": "0",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)",
      "mcp__exchange-rate"
    ],
    "deny": []
  }
}
SETTINGS

  # 4) 권한 + 소유권 — 백엔드(workbook-api in workbook-readers 그룹)가 read 가능
  chown -R "${USERNAME}:${USERNAME}" "$TARGET_DIR"
  chown "${USERNAME}:${USERNAME}" "$TARGET_CFG"
  chgrp workbook-readers "$TARGET_DIR" "$TARGET_CRED" "$TARGET_CFG" 2>/dev/null || true
  chmod 750 "$TARGET_DIR"
  chmod 640 "$TARGET_CRED"
  chmod 640 "$TARGET_CFG"
  chmod 644 "$TARGET_SETTINGS"

  # 5) 기존 tmux 세션 종료 — 사용자가 다음 접속 시 새 settings.json/bashrc로 시작
  sudo -u "$USERNAME" tmux -L wb kill-server 2>/dev/null || true

  echo "  + $USERNAME 자격 증명 + 인증 키 + 빠른 모델 설정 + tmux 리셋 완료"
  COPIED=$((COPIED + 1))
done

echo ""
echo "=========================================="
echo "  완료: ${COPIED}명 복사, ${SKIPPED}명 스킵"
echo "=========================================="
echo ""
echo "  사용자가 ttyd 터미널에서 'claude' 만 입력하면 바로 시작합니다."
echo "  (첫 실행 시 ~/.claude.json 등 나머지 설정은 Claude가 자동 생성)"
echo ""
echo "  토큰이 만료되면 운영자 계정에서 다시 'claude /login' 후 이 스크립트 재실행."
echo ""
