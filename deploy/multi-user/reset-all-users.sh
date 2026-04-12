#!/bin/bash
# reset-all-users.sh — 전체 유저 홈 초기화 + .bashrc 복구
# 사용법: sudo bash /home/lsc/mirae-workbook/deploy/multi-user/reset-all-users.sh

set -euo pipefail

USER_PREFIX="user"

for i in $(seq -w 0 20) 99; do
  U="${USER_PREFIX}${i}"
  H="/home/${U}"
  id "$U" >/dev/null 2>&1 || continue

  # 1) 인증/설정 백업
  CRED_BAK=""; SET_BAK=""; CFG_BAK=""
  [ -f "$H/.claude/.credentials.json" ] && CRED_BAK="$(cat "$H/.claude/.credentials.json")"
  [ -f "$H/.claude/settings.json" ] && SET_BAK="$(cat "$H/.claude/settings.json")"
  [ -f "$H/.claude.json" ] && CFG_BAK="$(cat "$H/.claude.json")"

  # 홈 안 전부 삭제
  rm -rf "$H"/* "$H"/.[!.]* "$H"/..?* 2>/dev/null || true

  # 복원
  mkdir -p "$H/.claude"
  [ -n "$CRED_BAK" ] && echo "$CRED_BAK" > "$H/.claude/.credentials.json"
  [ -n "$SET_BAK" ] && echo "$SET_BAK" > "$H/.claude/settings.json"
  [ -n "$CFG_BAK" ] && echo "$CFG_BAK" > "$H/.claude.json"
  : > "$H/.bash_history"

  # 2) .bashrc 복구
  cp /etc/skel/.bashrc "$H/.bashrc"
  cat >> "$H/.bashrc" <<'BASHRC'

# ── Mirae Workbook ─────────────────────────────
claude-short() { CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096  command claude "$@"; }
claude-long()  { CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768 command claude "$@"; }
export -f claude-short claude-long 2>/dev/null || true

if [ -t 1 ] && [ -z "$WORKBOOK_GREETED" ]; then
  export WORKBOOK_GREETED=1
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""
    echo "🔐 claude 입력 후 /login 으로 시작하세요"
    echo ""
  else
    echo ""
    echo "🤖 Claude Code 준비 완료."
    echo "   체험: claude        (기본)"
    echo "   실습: claude-long   (긴 출력)"
    echo ""
  fi
fi
BASHRC

  # 3) .profile, .bash_logout 복구
  cp /etc/skel/.profile "$H/.profile" 2>/dev/null || true
  cp /etc/skel/.bash_logout "$H/.bash_logout" 2>/dev/null || true
  : > "$H/.bash_history"

  # 4) 소유권 + ACL
  chown -R "${U}:${U}" "$H"
  chgrp workbook-readers "$H"
  chmod 750 "$H"
  if command -v setfacl >/dev/null 2>&1; then
    setfacl -m g:workbook-readers:rX "$H" "$H/.claude" 2>/dev/null || true
    setfacl -d -m g:workbook-readers:rX "$H" "$H/.claude" 2>/dev/null || true
    setfacl -R -m g:workbook-readers:rX "$H" "$H/.claude" 2>/dev/null || true
  fi

  echo "✓ $U 초기화 완료"
done

echo "=== 전체 완료 ==="
