#!/bin/bash
# Mirae Workbook - ttyd 브라우저 터미널 셋업
# 각 user01~user15에 대해 systemd 서비스로 ttyd를 띄우고 nginx로 라우팅합니다.
# 사용법: sudo ./setup-ttyd.sh [USER_COUNT]
set -e

if [ "$EUID" -ne 0 ]; then
  echo "이 스크립트는 root 권한이 필요합니다. sudo로 실행하세요."
  exit 1
fi

USER_COUNT="${1:-20}"
USER_PREFIX="user"
TTYD_BASE_PORT=7000        # 사용자용 ttyd: 7001..7015
TTYD_VIEW_BASE_PORT=8000   # 어드민 read-only viewer ttyd: 8001..8015
TTYD_VERSION="1.7.7"
# tmux 소켓 이름 — 사용자/뷰어 둘이 같은 세션에 접근하기 위한 namespace
TMUX_LABEL="wb"

echo "=========================================="
echo "  Mirae Workbook ttyd Setup"
echo "=========================================="

# ─── 0. tmux 워크숍 설정 — 스크롤백 50000 줄 ───
mkdir -p /etc/mirae-workbook
cat > /etc/mirae-workbook/tmux.conf <<'TMUXCONF'
# Mirae Workbook tmux 설정 — 스크롤백 충분히 확보
set -g history-limit 50000
set -g default-terminal "screen-256color"
set -g status off
set -g mouse on
# 셸 시작 시 subagent-mastery 폴더로 자동 이동 (있으면)
set -g default-command "[ -d $HOME/subagent-mastery ] && cd $HOME/subagent-mastery; exec bash --login"
TMUXCONF
chmod 644 /etc/mirae-workbook/tmux.conf

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
for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  PORT=$((TTYD_BASE_PORT + 10#$i))
  VIEW_PORT=$((TTYD_VIEW_BASE_PORT + 10#$i))

  if ! id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME 없음, 스킵 (먼저 setup-server.sh 실행)"
    continue
  fi

  # ─── 사용자 ttyd: tmux 세션으로 감싸서 viewer가 같은 화면을 attach할 수 있게 ───
  # user00 (강의자) 는 폰트 더 큼 — 시연 시 학생들이 잘 보이게
  if [ "$USERNAME" = "user00" ]; then
    USER_FONT_SIZE=22
  else
    USER_FONT_SIZE=17
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
# tmux new-session -A: 세션이 있으면 attach, 없으면 new — 재시작 시 같은 세션 유지
# -f /etc/mirae-workbook/tmux.conf: 워크숍 공통 설정 (history-limit 50000)
# ttyd -t scrollback=50000: 브라우저 xterm.js 스크롤백
ExecStart=/usr/local/bin/ttyd \\
  --writable \\
  --port ${PORT} \\
  --interface 127.0.0.1 \\
  --base-path /${USERNAME} \\
  -t fontSize=${USER_FONT_SIZE} \\
  -t scrollback=50000 \\
  -t titleFixed="Mirae Workbook - ${USERNAME}" \\
  -t 'theme={"background":"#0a0a0a","foreground":"#e5e5e5"}' \\
  /usr/bin/tmux -L ${TMUX_LABEL} -f /etc/mirae-workbook/tmux.conf new-session -A -s ${USERNAME} bash --login
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "ttyd-${USERNAME}.service" >/dev/null 2>&1
  systemctl restart "ttyd-${USERNAME}.service"
  echo "  + ttyd-${USERNAME}.service (port ${PORT}, tmux session=${USERNAME})"

  # ─── 어드민용 read-only viewer ttyd: 같은 tmux 세션에 attach -r ───
  cat > "/etc/systemd/system/ttyd-view-${USERNAME}.service" <<EOF
[Unit]
Description=ttyd read-only viewer for ${USERNAME}
After=ttyd-${USERNAME}.service

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=/home/${USERNAME}
# --readonly: 브라우저에서 키 입력 차단. tmux attach -r: tmux 자체도 read-only
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
RestartSec=1

[Install]
WantedBy=multi-user.target
EOF

  systemctl enable "ttyd-view-${USERNAME}.service" >/dev/null 2>&1
  systemctl restart "ttyd-view-${USERNAME}.service" || true
  echo "  + ttyd-view-${USERNAME}.service (port ${VIEW_PORT}, read-only viewer)"
done

# ─── 4. nginx 리버스 프록시 + Basic Auth ─────
echo "[4/4] nginx 리버스 프록시 설정..."

# .htpasswd 생성 (계정 파일 재사용)
HTPASSWD=/etc/nginx/.htpasswd-workbook
CREDENTIALS_FILE="/root/workbook-credentials.txt"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "  ! htpasswd 명령 없음. apache2-utils 설치 시도..."
  apt-get install -y -qq apache2-utils
fi

if [ ! -d /etc/nginx ]; then
  echo "  ! /etc/nginx 디렉터리 없음. nginx 재설치 시도..."
  apt-get install -y -qq nginx
fi

if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "  ! 자격 증명 파일이 없습니다: $CREDENTIALS_FILE"
  echo "    먼저 setup-server.sh를 실행하세요."
  exit 1
fi

rm -f "$HTPASSWD"
ENTRY_COUNT=0
while read -r username password; do
  [[ "$username" =~ ^# ]] && continue
  [ -z "$username" ] && continue
  if [ -f "$HTPASSWD" ]; then
    htpasswd -b "$HTPASSWD" "$username" "$password"
  else
    htpasswd -bc "$HTPASSWD" "$username" "$password"
  fi
  ENTRY_COUNT=$((ENTRY_COUNT + 1))
done < "$CREDENTIALS_FILE"

if [ ! -f "$HTPASSWD" ]; then
  echo "  ! .htpasswd 생성 실패. 자격 증명 파일 내용 확인:"
  cat "$CREDENTIALS_FILE"
  exit 1
fi

chmod 640 "$HTPASSWD"
chown root:www-data "$HTPASSWD" 2>/dev/null || true
echo "  + .htpasswd 생성됨 (${ENTRY_COUNT}개 항목, 계정 정보 = ssh와 동일)"

# nginx site
cat > /etc/nginx/sites-available/workbook <<'NGINX'
# Mirae Workbook - Multi-user web app + ttyd reverse proxy
# 포트 8443: 한국 ISP의 80/443 인바운드 차단을 우회
server {
    listen 8443;
    listen [::]:8443;
    server_name _;

    # 큰 파일 업로드/긴 응답 허용
    client_max_body_size 50m;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # 같은 origin 임베드 허용 (ttyd iframe 용)
    add_header X-Frame-Options SAMEORIGIN always;

    # ─── /api/ → 백엔드 (자동검증, 사용자 정보) ───
    location /api/ {
        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        proxy_set_header X-Remote-User $remote_user;
        proxy_set_header Host           $host;
        proxy_set_header X-Real-IP      $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_pass http://127.0.0.1:6999;
        proxy_http_version 1.1;
    }

    # ─── 어드민 read-only viewer: /admin/view/userXX/ → 127.0.0.1:80XX ───
    # admin 계정만 접근 가능 (Basic Auth + remote_user 검사)
    location ~ "^/admin/view/(user\d{2})(/.*)?$" {
        set $view_user $1;

        auth_basic           "Mirae Workbook Admin";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        if ($remote_user != "admin") {
            return 403;
        }

        set $view_port "";
        if ($view_user ~ "^user(\d{2})$") {
            set $view_port "80$1";
        }

        proxy_pass http://127.0.0.1:$view_port$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─── 사용자별 ttyd 라우팅: /user07/ → 127.0.0.1:7007, /test/ → 7100 ───
    # ttyd가 --base-path /userXX 로 떠 있으므로 원본 URI를 그대로 전달.
    # HTML 응답에 JS 주입: Ctrl+V (no shift)를 paste로 동작하게 함.
    location ~ "^/(user\d{2}|test)(/.*)?$" {
        set $user_name $1;

        # Basic Auth — 본인 계정만 본인 경로 접근
        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        # 인증된 사용자 이름과 URL의 user 일치 확인
        if ($remote_user != $user_name) {
            return 403;
        }

        # 사용자 번호 → 포트 (user01 → 7001, test → 7100)
        set $port "";
        if ($user_name ~ "^user(\d{2})$") {
            set $port "70$1";
        }
        if ($user_name = "test") {
            set $port "7100";
        }

        # ttyd의 gzip 비활성 — sub_filter가 동작하려면 평문 응답이 필요
        proxy_set_header Accept-Encoding "";

        # JS 주입:
        #  1) Ctrl+V (no shift)를 paste로 동작
        #  2) 부모의 darkMode를 postMessage로 받아 body 전체에 filter:invert 적용 (라이트 모드)
        #  3) iframe 준비되면 부모에 ready 신호 → 부모가 theme 재전송
        sub_filter '<head>' '<head><style id="theme-override"></style><script>(function(){var o=HTMLTextAreaElement.prototype.addEventListener;HTMLTextAreaElement.prototype.addEventListener=function(t,l,opts){if(t==="keydown"&&typeof l==="function"){var w=function(e){if(e.ctrlKey&&!e.shiftKey&&!e.altKey&&!e.metaKey&&(e.code==="KeyV"||e.key==="v"||e.key==="V")){return;}return l.apply(this,arguments);};return o.call(this,t,w,opts);}return o.call(this,t,l,opts);};var curDark=true;function applyTheme(dark){curDark=dark;var s=document.getElementById("theme-override");if(!s){s=document.createElement("style");s.id="theme-override";if(document.head)document.head.appendChild(s);else return;}if(dark){s.textContent="";}else{s.textContent="html,body{background:#000000 !important;}body{filter:invert(1) hue-rotate(180deg) !important;}";}}window.addEventListener("message",function(ev){if(ev.data&&ev.data.type==="theme"){applyTheme(ev.data.dark!==false);}});function notifyReady(){try{window.parent.postMessage({type:"ttyd-ready"},"*");}catch(e){}}if(document.readyState==="complete"){notifyReady();}else{window.addEventListener("load",notifyReady);}setTimeout(notifyReady,500);setTimeout(notifyReady,1500);})();</script>';
        sub_filter_once on;
        sub_filter_types text/html;

        # 변수를 쓰는 proxy_pass는 URI 자동 통과가 안 되므로 $request_uri 명시
        proxy_pass http://127.0.0.1:$port$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─── 정적 슬라이드 (vite build → /var/www/mirae-workbook) ───
    # 해시된 asset (index-XXXX.js, NativeTerminal-XXXX.js 등) 은 영구 캐시.
    # index.html은 매번 새로 받아와서 새 asset 해시를 즉시 가져오게 함.
    location ^~ /assets/ {
        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;
        root /var/www/mirae-workbook;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location / {
        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        root /var/www/mirae-workbook;
        index index.html;
        try_files $uri $uri/ /index.html;

        # SPA index.html — 캐시 절대 금지 (bfcache 포함)
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
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
echo "  접속 URL 예시 (포트 8443):"
echo "    http://$(hostname -I | awk '{print $1}'):8443/"
echo "    http://$(hostname -I | awk '{print $1}'):8443/user01/"
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
