#!/bin/bash
# Mirae Workbook - VNC + noVNC 브라우저 데스크톱 셋업
# 각 user01~user20, user00, user99에 대해 xfce4 + VNC + noVNC를 systemd 서비스로 띄우고
# nginx로 /userXX/desktop/ 경로에 라우팅합니다.
# 사용법: sudo ./setup-vnc.sh [USER_COUNT]
set -e

if [ "$EUID" -ne 0 ]; then
  echo "이 스크립트는 root 권한이 필요합니다. sudo로 실행하세요."
  exit 1
fi

USER_COUNT="${1:-20}"
USER_PREFIX="user"
VNC_BASE_PORT=5900       # user00=5900, user01=5901..user20=5920, user99=5999
NOVNC_BASE_PORT=6800     # user00=6800, user01=6801..user20=6820, user99=6899
VNC_RESOLUTION="1280x800"
VNC_DEPTH=24

echo "=========================================="
echo "  Mirae Workbook VNC Desktop Setup"
echo "=========================================="
echo "  사용자 수: ${USER_COUNT} + user00 + user99"
echo ""

# ─── 1. 패키지 설치 ───────────────────────────────
echo "[1/6] 데스크톱 패키지 설치..."
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq \
  xfce4 xfce4-terminal \
  tigervnc-standalone-server tigervnc-common \
  novnc python3-websockify \
  dbus-x11 x11-xserver-utils x11-utils \
  fonts-noto-cjk fonts-noto-color-emoji \
  locales

# 한국어 로케일 생성
if ! locale -a 2>/dev/null | grep -q "ko_KR.utf8"; then
  echo "  한국어 로케일 생성..."
  locale-gen ko_KR.UTF-8
fi

# 불필요한 xfce4 서비스 제거 (경량화)
apt-get remove -y -qq \
  xfce4-screensaver xfce4-power-manager xfce4-power-manager-plugins \
  light-locker xscreensaver \
  2>/dev/null || true

echo "  + xfce4, tigervnc, noVNC 설치 완료"

# ─── 2. noVNC 경로 확인 ──────────────────────────
echo "[2/6] noVNC 경로 확인..."

NOVNC_PATH=""
for p in /usr/share/novnc /usr/share/noVNC; do
  if [ -d "$p" ]; then
    NOVNC_PATH="$p"
    break
  fi
done
if [ -z "$NOVNC_PATH" ]; then
  echo "  ! noVNC 경로를 찾을 수 없습니다."
  exit 1
fi

# vnc.html → index.html 심볼릭 링크 (없으면 생성)
if [ ! -f "$NOVNC_PATH/index.html" ] && [ -f "$NOVNC_PATH/vnc.html" ]; then
  ln -sf vnc.html "$NOVNC_PATH/index.html"
fi

# websockify 실행 파일 경로 확인
WEBSOCKIFY_BIN=""
for wb in /usr/bin/websockify /usr/bin/python3-websockify; do
  if [ -x "$wb" ]; then
    WEBSOCKIFY_BIN="$wb"
    break
  fi
done
if [ -z "$WEBSOCKIFY_BIN" ]; then
  # python 모듈 방식
  WEBSOCKIFY_BIN="/usr/bin/python3 -m websockify"
fi

echo "  + noVNC 경로: $NOVNC_PATH"
echo "  + websockify: $WEBSOCKIFY_BIN"

# ─── 3. 공통 xfce4 시작 스크립트 ─────────────────
echo "[3/6] VNC xstartup 스크립트 생성..."
mkdir -p /etc/mirae-workbook

cat > /etc/mirae-workbook/vnc-xstartup <<'XSTARTUP'
#!/bin/bash
# Mirae Workbook VNC xstartup — 최소 xfce4 데스크톱
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS

export LANG=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=XFCE

# dbus 세션 시작
if command -v dbus-launch >/dev/null 2>&1; then
  eval "$(dbus-launch --sh-syntax)"
  export DBUS_SESSION_BUS_ADDRESS
fi

# xfce4 세션 시작
exec startxfce4
XSTARTUP
chmod 755 /etc/mirae-workbook/vnc-xstartup

# Xtigervnc 실행 경로 확인
XTIGERVNC_BIN=""
for xb in /usr/libexec/tigervnc/Xtigervnc /usr/bin/Xtigervnc /usr/lib/tigervnc/Xtigervnc; do
  if [ -x "$xb" ]; then
    XTIGERVNC_BIN="$xb"
    break
  fi
done
if [ -z "$XTIGERVNC_BIN" ]; then
  # fallback: find it
  XTIGERVNC_BIN=$(find /usr -name Xtigervnc -type f 2>/dev/null | head -1)
fi
if [ -z "$XTIGERVNC_BIN" ]; then
  echo "  ! Xtigervnc 바이너리를 찾을 수 없습니다."
  echo "    tigervnc-standalone-server 패키지가 설치되었는지 확인하세요."
  exit 1
fi
echo "  + Xtigervnc: $XTIGERVNC_BIN"

# ─── 4. 사용자별 VNC + noVNC systemd 서비스 생성 ──
echo "[4/6] 사용자별 VNC + noVNC systemd 서비스 생성..."

for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  USER_NUM=$((10#$i))

  # 포트 계산
  VNC_PORT=$((VNC_BASE_PORT + USER_NUM))
  NOVNC_PORT=$((NOVNC_BASE_PORT + USER_NUM))
  VNC_DISPLAY=$((VNC_PORT - 5900))

  if ! id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME 없음, 스킵"
    continue
  fi

  USER_HOME="/home/${USERNAME}"

  # ─── VNC 비밀번호 설정 ───
  VNC_DIR="${USER_HOME}/.vnc"
  mkdir -p "$VNC_DIR"

  if [ "$USERNAME" = "user00" ]; then
    VNC_PASSWORD="asdf1234"
  else
    VNC_PASSWORD="${USERNAME}"
  fi

  # vncpasswd -f: stdin에서 읽어서 stdout으로 암호화된 비밀번호 출력
  echo "$VNC_PASSWORD" | vncpasswd -f > "${VNC_DIR}/passwd"
  chmod 600 "${VNC_DIR}/passwd"

  # xstartup 복사
  cp /etc/mirae-workbook/vnc-xstartup "${VNC_DIR}/xstartup"
  chmod 755 "${VNC_DIR}/xstartup"

  chown -R "${USERNAME}:${USERNAME}" "$VNC_DIR"

  # ─── xfce4 최소 설정 (불필요한 자동 시작 서비스 제거) ───
  XFCE_AUTOSTART="${USER_HOME}/.config/autostart"
  mkdir -p "$XFCE_AUTOSTART"

  for DESKTOP_FILE in xfce4-power-manager xfce4-screensaver xscreensaver light-locker; do
    cat > "${XFCE_AUTOSTART}/${DESKTOP_FILE}.desktop" <<AUTOSTART
[Desktop Entry]
Hidden=true
AUTOSTART
  done
  chown -R "${USERNAME}:${USERNAME}" "${USER_HOME}/.config"

  # ─── VNC 서버 systemd 서비스 ───
  # Xtigervnc 직접 실행 (Type=simple) — vncserver 래퍼의 -fg 호환성 문제 우회
  # 각 유저의 xstartup을 별도 스크립트로 실행
  cat > "/etc/systemd/system/vnc-${USERNAME}.service" <<EOF
[Unit]
Description=VNC Server for ${USERNAME} (:${VNC_DISPLAY})
After=network.target

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=${USER_HOME}

# 시작 전 기존 lock 파일 정리
ExecStartPre=-/bin/sh -c 'rm -f /tmp/.X${VNC_DISPLAY}-lock /tmp/.X11-unix/X${VNC_DISPLAY}'

# Xtigervnc 직접 실행: systemd가 프로세스를 직접 관리
ExecStart=${XTIGERVNC_BIN} :${VNC_DISPLAY} \\
  -geometry ${VNC_RESOLUTION} \\
  -depth ${VNC_DEPTH} \\
  -rfbport ${VNC_PORT} \\
  -rfbauth ${VNC_DIR}/passwd \\
  -desktop "${USERNAME} Desktop" \\
  -localhost \\
  -SecurityTypes VncAuth \\
  -pn \\
  -AlwaysShared

ExecStop=-/bin/sh -c 'kill \$MAINPID 2>/dev/null; rm -f /tmp/.X${VNC_DISPLAY}-lock /tmp/.X11-unix/X${VNC_DISPLAY}'

Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  # ─── xfce4 세션 systemd 서비스 (VNC 서버 위에서 실행) ───
  cat > "/etc/systemd/system/vnc-xfce-${USERNAME}.service" <<EOF
[Unit]
Description=XFCE4 session for ${USERNAME} on VNC :${VNC_DISPLAY}
After=vnc-${USERNAME}.service
Requires=vnc-${USERNAME}.service

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=${USER_HOME}
Environment=DISPLAY=:${VNC_DISPLAY}
Environment=HOME=${USER_HOME}
Environment=LANG=ko_KR.UTF-8
Environment=LC_ALL=ko_KR.UTF-8
Environment=XDG_SESSION_TYPE=x11
Environment=XDG_CURRENT_DESKTOP=XFCE

ExecStart=${VNC_DIR}/xstartup
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  # ─── noVNC websockify systemd 서비스 ───
  cat > "/etc/systemd/system/novnc-${USERNAME}.service" <<EOF
[Unit]
Description=noVNC WebSocket proxy for ${USERNAME}
After=vnc-${USERNAME}.service
BindsTo=vnc-${USERNAME}.service

[Service]
Type=simple
User=${USERNAME}
Group=${USERNAME}
WorkingDirectory=${USER_HOME}

ExecStart=${WEBSOCKIFY_BIN} \\
  --web ${NOVNC_PATH} \\
  --heartbeat 30 \\
  ${NOVNC_PORT} \\
  localhost:${VNC_PORT}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  # 서비스 활성화 + 시작
  systemctl daemon-reload
  systemctl enable "vnc-${USERNAME}.service" >/dev/null 2>&1
  systemctl enable "vnc-xfce-${USERNAME}.service" >/dev/null 2>&1
  systemctl enable "novnc-${USERNAME}.service" >/dev/null 2>&1

  systemctl restart "vnc-${USERNAME}.service" || echo "  ! vnc-${USERNAME} 시작 실패"
  sleep 1
  systemctl restart "vnc-xfce-${USERNAME}.service" || echo "  ! vnc-xfce-${USERNAME} 시작 실패"
  systemctl restart "novnc-${USERNAME}.service" || echo "  ! novnc-${USERNAME} 시작 실패"

  echo "  + ${USERNAME}: VNC :${VNC_DISPLAY} (port ${VNC_PORT}), noVNC ws://localhost:${NOVNC_PORT}"
done

# ─── 5. nginx 설정 업데이트 ─────────────────────
echo "[5/6] nginx 설정에 데스크톱 라우팅 추가..."

NGINX_CONF="/etc/nginx/sites-available/workbook"

if [ ! -f "$NGINX_CONF" ]; then
  echo "  ! nginx 설정 파일 없음: $NGINX_CONF"
  echo "    먼저 setup-ttyd.sh를 실행하세요."
  exit 1
fi

# 기존 desktop 블록 제거 (마커 기반, 재실행 시 idempotent)
if grep -q "BEGIN VNC DESKTOP" "$NGINX_CONF"; then
  echo "  - 기존 데스크톱 라우팅 발견, 교체합니다..."
  sed -i '/# ─── BEGIN VNC DESKTOP ───/,/# ─── END VNC DESKTOP ───/d' "$NGINX_CONF"
fi

# desktop 라우팅 블록 — ttyd 라우팅보다 앞에 삽입해야 함
# (nginx regex location은 순서대로 매칭하므로 /userXX/desktop/ 이 /userXX/ 보다 먼저 와야)
# ttyd 라우팅 위치 = "사용자별 ttyd 라우팅" 주석 또는 "^/(user\d{2}|test)(/.*)?$" 패턴 앞
DESKTOP_BLOCK='
    # ─── BEGIN VNC DESKTOP ───
    # noVNC 데스크톱: /userXX/desktop/ → websockify (noVNC)
    # WebSocket 전용 경로 (noVNC의 websockify 연결)
    location ~ "^/(user\d{2})/desktop/websockify$" {
        set $desktop_user $1;

        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        # 본인 계정만 접근 (admin은 모든 데스크톱 접근 가능)
        set $desktop_auth "deny";
        if ($remote_user = $desktop_user) {
            set $desktop_auth "allow";
        }
        if ($remote_user = "admin") {
            set $desktop_auth "allow";
        }
        if ($desktop_auth != "allow") {
            return 403;
        }

        set $novnc_port "";
        if ($desktop_user ~ "^user(\d{2})$") {
            set $novnc_port "68$1";
        }

        proxy_pass http://127.0.0.1:$novnc_port/websockify;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # noVNC 정적 파일 + vnc.html 서빙
    location ~ "^/(user\d{2})/desktop(/.*)?$" {
        set $desktop_user $1;
        set $desktop_path $2;

        auth_basic           "Mirae Workbook";
        auth_basic_user_file /etc/nginx/.htpasswd-workbook;

        set $desktop_auth "deny";
        if ($remote_user = $desktop_user) {
            set $desktop_auth "allow";
        }
        if ($remote_user = "admin") {
            set $desktop_auth "allow";
        }
        if ($desktop_auth != "allow") {
            return 403;
        }

        set $novnc_port "";
        if ($desktop_user ~ "^user(\d{2})$") {
            set $novnc_port "68$1";
        }

        # /userXX/desktop/ → / , /userXX/desktop/foo → /foo
        # 빈 경로면 vnc.html로 리다이렉트 (auto-connect 파라미터 포함)
        if ($desktop_path = "") {
            return 302 /$desktop_user/desktop/vnc.html?autoconnect=true&resize=scale&path=$desktop_user/desktop/websockify;
        }
        if ($desktop_path = "/") {
            return 302 /$desktop_user/desktop/vnc.html?autoconnect=true&resize=scale&path=$desktop_user/desktop/websockify;
        }

        # URI에서 /userXX/desktop 접두사를 제거하여 프록시
        rewrite "^/(user\d{2})/desktop(/.*)?$" $2 break;

        proxy_pass http://127.0.0.1:$novnc_port;
        proxy_http_version 1.1;
        proxy_set_header Host       $host;
        proxy_set_header X-Real-IP  $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # ─── END VNC DESKTOP ───
'

# ttyd 라우팅 직전에 삽입 (regex location 순서가 중요)
# "사용자별 ttyd 라우팅" 주석 또는 "(user\d{2}|test)" 패턴을 찾아서 그 앞에 삽입
python3 - "$NGINX_CONF" "$DESKTOP_BLOCK" <<'PYSCRIPT'
import sys

conf_path = sys.argv[1]
block = sys.argv[2]

with open(conf_path, 'r') as f:
    lines = f.readlines()

# ttyd 라우팅 블록 시작 위치 찾기
insert_idx = None
for idx, line in enumerate(lines):
    # "사용자별 ttyd 라우팅" 주석 또는 "(user\d{2}|test)" regex location
    if 'user\\d{2}|test' in line or '사용자별 ttyd 라우팅' in line:
        insert_idx = idx
        break

if insert_idx is None:
    # fallback: server 블록의 마지막 } 앞에 삽입
    for idx in range(len(lines) - 1, -1, -1):
        if lines[idx].strip() == '}':
            insert_idx = idx
            break

if insert_idx is None:
    print("  ! 삽입 위치를 찾을 수 없습니다")
    sys.exit(1)

new_lines = lines[:insert_idx] + [block + '\n'] + lines[insert_idx:]

with open(conf_path, 'w') as f:
    f.writelines(new_lines)

print(f"  + 데스크톱 라우팅을 라인 {insert_idx + 1} 앞에 삽입")
PYSCRIPT

# nginx 설정 테스트
if nginx -t 2>&1; then
  systemctl reload nginx
  echo "  + nginx 설정 업데이트 + 리로드 완료"
else
  echo "  ! nginx 설정 오류 — 수동 확인 필요"
  echo "    nginx -t 로 확인하세요"
  echo "    설정 파일: $NGINX_CONF"
fi

# ─── 6. Claude Desktop 설치 (선택) ───────────────
echo "[6/6] Claude Desktop 설치 확인..."

if command -v claude-desktop >/dev/null 2>&1; then
  echo "  + Claude Desktop 이미 설치됨"
else
  # Anthropic 공식 .deb (amd64)
  CLAUDE_DEB="/tmp/claude-desktop.deb"
  echo "  Claude Desktop .deb 설치 시도..."
  # 여러 가능한 URL 시도
  INSTALLED=false
  for CLAUDE_URL in \
    "https://storage.googleapis.com/anthropic-public/claude-desktop/claude-desktop-latest-amd64.deb" \
    "https://github.com/anthropics/claude-desktop/releases/latest/download/claude-desktop_amd64.deb"; do
    if curl -fsSL "$CLAUDE_URL" -o "$CLAUDE_DEB" 2>/dev/null; then
      dpkg -i "$CLAUDE_DEB" 2>/dev/null || apt-get install -f -y -qq 2>/dev/null
      rm -f "$CLAUDE_DEB"
      if command -v claude-desktop >/dev/null 2>&1; then
        echo "  + Claude Desktop 설치 완료"
        INSTALLED=true
        break
      fi
    fi
  done
  if [ "$INSTALLED" = "false" ]; then
    echo "  - Claude Desktop 설치 실패 (선택사항이므로 계속 진행)"
    echo "    수동 설치: https://claude.ai/download"
  fi
fi

# ─── 완료 ────────────────────────────────────────
echo ""
echo "=========================================="
echo "  VNC 데스크톱 셋업 완료!"
echo "=========================================="
echo ""
echo "  접속 URL 예시 (포트 8443):"
echo "    http://$(hostname -I | awk '{print $1}'):8443/user01/desktop/"
echo "    http://$(hostname -I | awk '{print $1}'):8443/user00/desktop/"
echo ""
echo "  포트 할당:"
echo "    user00 → VNC :0 (5900), noVNC ws 6800"
echo "    user01 → VNC :1 (5901), noVNC ws 6801"
echo "    ...     ...                            "
echo "    user20 → VNC :20 (5920), noVNC ws 6820"
echo "    user99 → VNC :99 (5999), noVNC ws 6899"
echo ""
echo "  서비스 상태 확인:"
echo "    systemctl status vnc-user01"
echo "    systemctl status vnc-xfce-user01"
echo "    systemctl status novnc-user01"
echo "    journalctl -u vnc-user01 -f"
echo ""
echo "  전체 VNC 서비스 재시작:"
echo "    systemctl restart 'vnc-user*.service'"
echo "    systemctl restart 'vnc-xfce-user*.service'"
echo "    systemctl restart 'novnc-user*.service'"
echo ""
echo "  VNC 비밀번호: 유저 ID와 동일 (user00은 asdf1234)"
echo ""
