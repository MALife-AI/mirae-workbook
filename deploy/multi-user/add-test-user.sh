#!/bin/bash
# add-test-user.sh — 'test' 테스트 계정 추가 (id=test, pw=test)
#
# 일반 user01..userN과 별도로, 시연/QA용 계정.
# - 시스템 사용자: test
# - ttyd 포트: 7100 (일반 사용자 7000~7099와 분리)
# - viewer 포트: 8100
# - nginx 라우팅: /test/ → 127.0.0.1:7100
# - htpasswd: test:test
# - workbook-readers 그룹 + ACL 적용
#
# 사용법: sudo bash deploy/multi-user/add-test-user.sh

set -e

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: sudo로 실행하세요" >&2
  exit 1
fi

USERNAME="test"
PASSWORD="test"
PORT=7100
VIEW_PORT=8100
TMUX_LABEL="workbook"
HTPASSWD=/etc/nginx/.htpasswd-workbook
CREDENTIALS_FILE="/root/workbook-credentials.txt"

echo "[1/6] 시스템 사용자 생성"
if id "$USERNAME" >/dev/null 2>&1; then
  echo "  - 이미 존재: $USERNAME (스킵)"
else
  useradd -m -s /bin/bash "$USERNAME"
  echo "${USERNAME}:${PASSWORD}" | chpasswd
  echo "  + 사용자 생성"
fi

# workbook-readers 그룹이 없으면 만들어 둠 (setup-server.sh가 만들지만 안전망)
if ! getent group workbook-readers >/dev/null; then
  groupadd --system workbook-readers
fi

echo "[2/6] 권한 + ACL"
chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}"
chgrp workbook-readers "/home/${USERNAME}"
chmod 750 "/home/${USERNAME}"
if command -v setfacl >/dev/null 2>&1; then
  setfacl -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
  setfacl -d -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
else
  echo "  ⚠ setfacl 없음 — apt install -y acl 필요"
fi

echo "[3/6] ttyd systemd unit (writer + viewer)"
cat > "/etc/systemd/system/ttyd-${USERNAME}.service" <<EOF
[Unit]
Description=ttyd for ${USERNAME} (test account)
After=network.target

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=/home/${USERNAME}
ExecStart=/usr/local/bin/ttyd \\
  --writable \\
  --port ${PORT} \\
  --interface 127.0.0.1 \\
  --base-path /${USERNAME} \\
  -t fontSize=17 \\
  -t scrollback=50000 \\
  -t titleFixed="Mirae Workbook - ${USERNAME}" \\
  -t 'theme={"background":"#0a0a0a","foreground":"#e5e5e5"}' \\
  /usr/bin/tmux -L ${TMUX_LABEL} -f /etc/mirae-workbook/tmux.conf new-session -A -s ${USERNAME} bash --login
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/ttyd-view-${USERNAME}.service" <<EOF
[Unit]
Description=ttyd read-only viewer for ${USERNAME}
After=ttyd-${USERNAME}.service

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=/home/${USERNAME}
ExecStart=/usr/local/bin/ttyd \\
  --readonly \\
  --port ${VIEW_PORT} \\
  --interface 127.0.0.1 \\
  --base-path /admin/view/${USERNAME} \\
  -t fontSize=15 \\
  -t scrollback=50000 \\
  -t titleFixed="View - ${USERNAME}" \\
  -t 'theme={"background":"#000000","foreground":"#86efac"}' \\
  /usr/bin/tmux -L ${TMUX_LABEL} -f /etc/mirae-workbook/tmux.conf attach-session -t ${USERNAME} -r
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "ttyd-${USERNAME}.service" >/dev/null 2>&1
systemctl restart "ttyd-${USERNAME}.service"
systemctl enable "ttyd-view-${USERNAME}.service" >/dev/null 2>&1
systemctl restart "ttyd-view-${USERNAME}.service" || true
echo "  + ttyd-${USERNAME}.service (port ${PORT})"
echo "  + ttyd-view-${USERNAME}.service (port ${VIEW_PORT})"

echo "[4/6] credentials + htpasswd"
# 자격 증명 파일에서 기존 test 라인 제거 후 다시 추가
if [ -f "$CREDENTIALS_FILE" ]; then
  sed -i '/^test[[:space:]]/d' "$CREDENTIALS_FILE"
fi
echo "${USERNAME}  ${PASSWORD}" >> "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"
htpasswd -b "$HTPASSWD" "$USERNAME" "$PASSWORD"
echo "  + htpasswd / credentials 갱신"

echo "[5/6] nginx 설정 — /test/ 라우팅이 이미 정규식에 포함되어 있는지 확인"
NGINX_CONF=/etc/nginx/sites-available/workbook
if grep -q "user\\\\d{2}|test" "$NGINX_CONF" 2>/dev/null; then
  echo "  + 이미 적용됨"
else
  echo "  ! nginx 설정에 test 라우팅이 없음. setup-ttyd.sh를 다시 실행하거나 수동 patch 필요."
  echo "    location ~ \"^/(user\\d{2}|test)(/.*)?\$\" 형태로 정규식 확장하세요."
fi
nginx -t && systemctl reload nginx
echo "  + nginx reload"

echo "[6/6] 첫 실습 폴더 자동 클론 (실패해도 무시)"
sudo -u "$USERNAME" git clone --depth 1 \
  https://github.com/MALife-AI/subagent-mastery.git \
  "/home/${USERNAME}/subagent-mastery" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  test 계정 준비 완료"
echo "=========================================="
echo "  ID:       test"
echo "  PW:       test"
echo "  접속 URL: http://<서버IP>:8443/  (Basic Auth: test / test)"
echo ""
echo "  진단:"
echo "    systemctl status ttyd-test"
echo "    journalctl -u ttyd-test -f"
