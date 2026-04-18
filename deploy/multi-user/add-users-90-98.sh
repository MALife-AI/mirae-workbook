#!/bin/bash
# add-users-90-98.sh — user85~user98 계정 추가 (기존 서버에 추가)
# 사용법: sudo bash /home/lsc/mirae-workbook/deploy/multi-user/add-users-90-98.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "sudo로 실행하세요."; exit 1
fi

TMUX_LABEL="wb"
TMUX_CONF="/etc/mirae-workbook/tmux.conf"
HTPASSWD="/etc/nginx/.htpasswd-workbook"
SUDOERS="/etc/sudoers.d/mirae-workbook-api"

echo "=== user85~user98 계정 생성 ==="

for i in $(seq 85 98); do
  U="user${i}"
  PORT=$((7000 + i))
  VIEW_PORT=$((8000 + i))

  # 1) 계정 생성
  if id "$U" >/dev/null 2>&1; then
    echo "  - $U 이미 존재, 스킵"
  else
    useradd -m -s /bin/bash "$U"
    echo "${U}:${U}" | chpasswd
    chmod 750 "/home/${U}"
    chgrp workbook-readers "/home/${U}"

    # .bashrc
    cat >> "/home/${U}/.bashrc" <<'BASHRC'

# ── Mirae Workbook ─────────────────────────────
claude-short() { CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096  command claude "$@"; }
claude-long()  { CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768 command claude "$@"; }
export -f claude-short claude-long 2>/dev/null || true
if [ -t 1 ] && [ -z "$WORKBOOK_GREETED" ]; then
  export WORKBOOK_GREETED=1
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""; echo "🔐 claude 입력 후 /login 으로 시작하세요"; echo ""
  else
    echo ""; echo "🤖 Claude Code 준비 완료."; echo "   체험: claude   실습: claude-long"; echo ""
  fi
fi
BASHRC

    chown -R "${U}:${U}" "/home/${U}"
    chgrp workbook-readers "/home/${U}"
    chmod 750 "/home/${U}"

    # ACL
    if command -v setfacl >/dev/null 2>&1; then
      setfacl -m g:workbook-readers:rX "/home/${U}" 2>/dev/null || true
      setfacl -d -m g:workbook-readers:rX "/home/${U}" 2>/dev/null || true
    fi

    echo "  + $U 생성됨"
  fi

  # 2) htpasswd 추가
  if ! grep -q "^${U}:" "$HTPASSWD" 2>/dev/null; then
    htpasswd -b "$HTPASSWD" "$U" "$U"
    echo "  + $U htpasswd 추가"
  fi

  # 3) ttyd 서비스 (사용자용)
  cat > "/etc/systemd/system/ttyd-${U}.service" <<EOF
[Unit]
Description=ttyd for ${U}
After=network.target

[Service]
Type=simple
User=${U}
Group=${U}
WorkingDirectory=/home/${U}
ExecStart=/usr/local/bin/ttyd \\
  --writable \\
  --port ${PORT} \\
  --interface 127.0.0.1 \\
  --base-path /${U} \\
  -t fontSize=15 \\
  -t scrollback=50000 \\
  -t titleFixed="Mirae Workbook - ${U}" \\
  -t 'theme={"background":"#0a0a0a","foreground":"#e5e5e5"}' \\
  /usr/bin/tmux -L ${TMUX_LABEL} -f ${TMUX_CONF} new-session -A -s ${U} bash --login
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

  # 4) ttyd 서비스 (어드민 뷰어용)
  cat > "/etc/systemd/system/ttyd-view-${U}.service" <<EOF
[Unit]
Description=ttyd viewer for ${U}
After=network.target

[Service]
Type=simple
User=${U}
Group=${U}
WorkingDirectory=/home/${U}
ExecStart=/usr/local/bin/ttyd \\
  --port ${VIEW_PORT} \\
  --interface 127.0.0.1 \\
  --base-path /admin/view/${U} \\
  -t fontSize=14 \\
  -t scrollback=50000 \\
  -t titleFixed="[VIEW] ${U}" \\
  -t 'theme={"background":"#0a0a0a","foreground":"#e5e5e5"}' \\
  /usr/bin/tmux -L ${TMUX_LABEL} -f ${TMUX_CONF} new-session -A -s ${U} bash --login
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

  # 5) 서비스 시작
  systemctl daemon-reload
  systemctl enable "ttyd-${U}.service" 2>/dev/null || true
  systemctl enable "ttyd-view-${U}.service" 2>/dev/null || true
  systemctl start "ttyd-${U}.service" 2>/dev/null || true
  systemctl start "ttyd-view-${U}.service" 2>/dev/null || true

  echo "  + $U ttyd 서비스 시작 (포트 ${PORT}/${VIEW_PORT})"
done

# 6) sudoers 업데이트 — user90~98 추가
echo ""
echo "=== sudoers 업데이트 ==="
# 기존 sudoers에서 유저 목록 추출 후 user90~98 추가
if [ -f "$SUDOERS" ]; then
  for i in $(seq 85 98); do
    U="user${i}"
    if ! grep -q "$U" "$SUDOERS"; then
      # write-as-user.sh 줄에 추가
      sed -i "s/user99)/user99,${U})/g" "$SUDOERS" 2>/dev/null || true
    fi
  done
  echo "  sudoers에 user90~98 추가 완료"
  visudo -c -f "$SUDOERS" && echo "  sudoers 문법 검증 OK" || echo "  ⚠ sudoers 문법 오류 — 수동 확인 필요"
fi

# 7) nginx 리로드 (htpasswd 반영)
nginx -t 2>/dev/null && systemctl reload nginx
echo ""
echo "=== 완료 ==="
echo "user85~user98 생성됨. 비밀번호 = 아이디."
echo "접속: https://서버:8443 에서 로그인"
