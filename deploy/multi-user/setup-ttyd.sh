#!/bin/bash
# Mirae Workbook - ttyd 브라우저 터미널 셋업
# 각 user01~user15에 대해 systemd 서비스로 ttyd를 띄우고 nginx로 라우팅합니다.
# 사용법: sudo ./setup-ttyd.sh [USER_COUNT]
set -e

if [ "$EUID" -ne 0 ]; then
  echo "이 스크립트는 root 권한이 필요합니다. sudo로 실행하세요."
  exit 1
fi

USER_COUNT="${1:-15}"
USER_PREFIX="user"
TTYD_BASE_PORT=7000
TTYD_VERSION="1.7.7"

echo "=========================================="
echo "  Mirae Workbook ttyd Setup"
echo "=========================================="

# ─── 1. ttyd 바이너리 ─────────────────────────
echo "[1/4] ttyd 바이너리 설치..."
if [ ! -f /usr/local/bin/ttyd ]; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) TTYD_ARCH="x86_64" ;;
    aarch64) TTYD_ARCH="aarch64" ;;
    *) echo "지원하지 않는 아키텍처: $ARCH"; exit 1 ;;
  esac
  curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}" \
    -o /usr/local/bin/ttyd
  chmod +x /usr/local/bin/ttyd
fi
ttyd --version

# ─── 2. nginx ─────────────────────────────────
echo "[2/4] nginx 설치..."
apt-get install -y -qq nginx apache2-utils

# ─── 3. 사용자별 systemd 서비스 ───────────────
echo "[3/4] 사용자별 ttyd systemd 서비스 생성..."
for i in $(seq -w 1 "$USER_COUNT"); do
  USERNAME="${USER_PREFIX}${i}"
  PORT=$((TTYD_BASE_PORT + 10#$i))

  if ! id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME 없음, 스킵 (먼저 setup-server.sh 실행)"
    continue
  fi

  cat > "/etc/systemd/system/ttyd-${USERNAME}.service" <<EOF
[Unit]
Description=ttyd for ${USERNAME}
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
  -t fontSize=14 \\
  -t titleFixed="Mirae Workbook - ${USERNAME}" \\
  -t 'theme={"background":"#0a0a0a","foreground":"#e5e5e5"}' \\
  /bin/bash --login
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "ttyd-${USERNAME}.service" >/dev/null 2>&1
  systemctl restart "ttyd-${USERNAME}.service"
  echo "  + ttyd-${USERNAME}.service (port ${PORT})"
done

# ─── 4. nginx 리버스 프록시 + Basic Auth ─────
echo "[4/4] nginx 리버스 프록시 설정..."

# .htpasswd 생성 (계정 파일 재사용)
HTPASSWD=/etc/nginx/.htpasswd-workbook
CREDENTIALS_FILE="/root/workbook-credentials.txt"
if [ -f "$CREDENTIALS_FILE" ]; then
  rm -f "$HTPASSWD"
  while read -r username password; do
    [[ "$username" =~ ^# ]] && continue
    [ -z "$username" ] && continue
    if [ -f "$HTPASSWD" ]; then
      htpasswd -b "$HTPASSWD" "$username" "$password" >/dev/null 2>&1
    else
      htpasswd -bc "$HTPASSWD" "$username" "$password" >/dev/null 2>&1
    fi
  done < "$CREDENTIALS_FILE"
  chmod 640 "$HTPASSWD"
  chown root:www-data "$HTPASSWD" 2>/dev/null || true
  echo "  + .htpasswd 생성됨 (계정 정보 = ssh와 동일)"
fi

# nginx site
cat > /etc/nginx/sites-available/workbook <<'NGINX'
# Mirae Workbook - Multi-user ttyd reverse proxy
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # 큰 파일 업로드/긴 응답 허용
    client_max_body_size 50m;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # 루트: 사용자 안내 페이지
    location = / {
        default_type text/html;
        return 200 '<!doctype html><html><head><meta charset="utf-8"><title>Mirae Workbook</title><style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:80px auto;padding:0 20px;color:#333}h1{color:#F58220}code{background:#f4f4f4;padding:2px 8px;border-radius:4px}</style></head><body><h1>Mirae Workbook</h1><p>각자에게 배정된 URL로 접속하세요:</p><p><code>https://이서버주소/userXX/</code></p><p>예: <code>https://이서버주소/user07/</code></p><p>접속 시 본인 ID/비밀번호를 입력합니다.</p></body></html>';
    }

    # 사용자별 ttyd 라우팅: /user07/ → 127.0.0.1:7007
    location ~ ^/(user\d{2})(/.*)?$ {
        set $user_name $1;
        set $sub_path  $2;

        # Basic Auth — 본인 계정만 본인 경로 접근
        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        # 인증된 사용자 이름과 URL의 user 일치 확인
        if ($remote_user != $user_name) {
            return 403;
        }

        # 사용자 번호 → 포트 (user01 → 7001)
        set $port "";
        if ($user_name ~ ^user(\d{2})$) {
            set $port "70$1";
        }

        proxy_pass http://127.0.0.1:$port$sub_path$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/workbook /etc/nginx/sites-enabled/workbook
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo ""
echo "=========================================="
echo "  ttyd 셋업 완료!"
echo "=========================================="
echo ""
echo "  접속 URL 예시:"
echo "    http://$(hostname -I | awk '{print $1}')/user01/"
echo "    http://$(hostname -I | awk '{print $1}')/user02/"
echo "    ..."
echo ""
echo "  ID/PW: /root/workbook-credentials.txt 참고"
echo ""
echo "  HTTPS가 필요하면:"
echo "    apt install certbot python3-certbot-nginx"
echo "    certbot --nginx -d workbook.example.com"
echo ""
echo "  서비스 상태 확인:"
echo "    systemctl status ttyd-user01"
echo "    journalctl -u ttyd-user01 -f"
echo ""
