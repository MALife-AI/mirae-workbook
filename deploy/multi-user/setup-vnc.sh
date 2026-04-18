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

REQUIRED_PKGS=(
  xfce4 xfce4-terminal
  tigervnc-standalone-server tigervnc-common
  novnc python3-websockify
  dbus-x11 x11-xserver-utils x11-utils xsel xclip
  fonts-noto-cjk fonts-noto-color-emoji
  locales
  libreoffice-writer libreoffice-calc libreoffice-impress
  libreoffice-l10n-ko libreoffice-help-ko
  ibus ibus-hangul im-config
)

# 누락 패키지만 추려서 설치 (모두 설치되어 있으면 apt 전체를 스킵)
MISSING_PKGS=()
for pkg in "${REQUIRED_PKGS[@]}"; do
  if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
    MISSING_PKGS+=("$pkg")
  fi
done

# Firefox 상태도 같이 확인 (snap 래퍼가 아니어야 "설치됨"으로 간주)
FIREFOX_NEEDS_INSTALL=1
if command -v firefox >/dev/null 2>&1; then
  if ! readlink -f "$(command -v firefox)" 2>/dev/null | grep -q snap; then
    FIREFOX_NEEDS_INSTALL=0
  fi
fi

if [ ${#MISSING_PKGS[@]} -eq 0 ] && [ "$FIREFOX_NEEDS_INSTALL" = "0" ]; then
  echo "  + 필수 패키지 모두 설치됨 — apt 단계 건너뜀"
else
  if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo "  누락 패키지 ${#MISSING_PKGS[@]}개 설치: ${MISSING_PKGS[*]}"
    apt-get update -qq
    apt-get install -y -qq "${MISSING_PKGS[@]}"
  fi

  # 불필요한 xfce4 서비스 제거 (경량화) — xfce4 새로 설치한 경우에만
  if printf '%s\n' "${MISSING_PKGS[@]}" | grep -qx "xfce4"; then
    apt-get remove -y -qq \
      xfce4-screensaver xfce4-power-manager xfce4-power-manager-plugins \
      light-locker xscreensaver \
      2>/dev/null || true
  fi

  # ─── Firefox 설치 (Mozilla APT 저장소 — Ubuntu 24.04 snap 우회) ───
  # Ubuntu 24.04 의 `apt install firefox` 는 snap 전이 패키지라 VNC 안에서 실행이 불안정.
  # Mozilla 공식 deb 저장소를 추가해 네이티브 .deb 로 설치.
  if [ "$FIREFOX_NEEDS_INSTALL" = "1" ]; then
    echo "  Firefox (Mozilla deb) 설치..."
    apt-get install -y -qq wget gnupg ca-certificates >/dev/null 2>&1 || true
    install -d -m 0755 /etc/apt/keyrings
    if [ ! -s /etc/apt/keyrings/packages.mozilla.org.asc ]; then
      wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg \
        -O /etc/apt/keyrings/packages.mozilla.org.asc || true
    fi
    if [ -s /etc/apt/keyrings/packages.mozilla.org.asc ]; then
      echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" \
        > /etc/apt/sources.list.d/mozilla.list
      cat > /etc/apt/preferences.d/mozilla <<'PREF'
Package: *
Pin: origin packages.mozilla.org
Pin-Priority: 1000
PREF
      apt-get update -qq
      # snap 전이 패키지 제거 후 실제 deb 설치
      apt-get remove -y -qq firefox 2>/dev/null || true
      apt-get install -y -qq firefox firefox-l10n-ko || \
        echo "  ! Firefox 설치 실패 — 수동 확인: apt install firefox"
    else
      echo "  ! Mozilla 서명 키 다운로드 실패 — Firefox 설치 건너뜀"
    fi
  fi

  echo "  + xfce4, tigervnc, noVNC, LibreOffice(한국어), Firefox 설치 완료"
fi

# 한국어 로케일 생성 (빠른 체크)
if ! locale -a 2>/dev/null | grep -q "ko_KR.utf8"; then
  echo "  한국어 로케일 생성..."
  locale-gen ko_KR.UTF-8
fi

# ─── xfce4-terminal 붙여넣기 단축키: Ctrl+Shift+V → Ctrl+V ───
# 시스템 전역 XDG 경로(/etc/xdg/xfce4/terminal/)에 accels.scm 을 두면,
# 사용자 홈에 ~/.config/xfce4/terminal/accels.scm 이 없을 때 이게 로드됨.
# reset-all-users.sh 가 홈을 비워도 다음 xfce4-terminal 실행 시 이 기본이 적용된다.
#
# 주의: admin-action.sh 의 paste-text 액션이 xdotool 로 키를 주입하는데,
# 이 파일과 맞춰 ctrl+v 로 변경되어야 한다 (양쪽 동시 수정 필요).
mkdir -p /etc/xdg/xfce4/terminal
cat > /etc/xdg/xfce4/terminal/accels.scm <<'ACCELS'
; xfce4-terminal GtkAccelMap rc-file -*- scheme -*-
; 미래에셋 워크북 기본: Ctrl+V = paste (원본 Ctrl+Shift+V 대체)
; 복사는 원본 유지: Ctrl+Shift+C (셸의 Ctrl+C SIGINT 와 분리)
(gtk_accel_path "<Actions>/terminal-window/paste" "<Primary>v")
(gtk_accel_path "<Actions>/terminal-window/paste-selection" "")
ACCELS
chmod 644 /etc/xdg/xfce4/terminal/accels.scm

# ─── Firefox 를 시스템 기본 브라우저로 ───
# (1) update-alternatives: x-www-browser / gnome-www-browser 가 Firefox 를 가리키도록.
#     xdg-open 이 desktop 설정이 없을 때 이 쪽을 폴백으로 쓰므로 시스템 전역에 먼저 박음.
# (2) 기본 MIME: /etc/xdg/mimeapps.list 에 http/https/html 기본값을 firefox.desktop 으로.
if command -v firefox >/dev/null 2>&1; then
  FF_BIN="$(command -v firefox)"
  # x-www-browser / gnome-www-browser 양쪽 갱신
  update-alternatives --install /usr/bin/x-www-browser x-www-browser "$FF_BIN" 200 >/dev/null 2>&1 || true
  update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser "$FF_BIN" 200 >/dev/null 2>&1 || true
  update-alternatives --set x-www-browser "$FF_BIN" >/dev/null 2>&1 || true
  update-alternatives --set gnome-www-browser "$FF_BIN" >/dev/null 2>&1 || true

  mkdir -p /etc/xdg
  cat > /etc/xdg/mimeapps.list <<'MIMELIST'
[Default Applications]
text/html=firefox.desktop
application/xhtml+xml=firefox.desktop
x-scheme-handler/http=firefox.desktop
x-scheme-handler/https=firefox.desktop
x-scheme-handler/ftp=firefox.desktop
x-scheme-handler/chrome=firefox.desktop
x-scheme-handler/about=firefox.desktop
x-scheme-handler/unknown=firefox.desktop

[Added Associations]
text/html=firefox.desktop;
application/xhtml+xml=firefox.desktop;
x-scheme-handler/http=firefox.desktop;
x-scheme-handler/https=firefox.desktop;
MIMELIST
  echo "  + Firefox 를 시스템 기본 브라우저로 지정"
fi

# ─── 2. noVNC 경로 확인 ──────────────────────────
echo "[2/6] noVNC 경로 확인..."

NOVNC_PATH=""
# /opt/novnc (수동 설치 최신 버전)를 우선 확인 — apt의 1.3.0은
# ui.js와 vnc.html 간 clipboard 엘리먼트 불일치로 깨지는 경우가 있음
for p in /opt/novnc /usr/share/novnc /usr/share/noVNC; do
  if [ -d "$p" ] && [ -f "$p/vnc.html" ]; then
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
# Mirae Workbook VNC xstartup — xfce4 + 클립보드 브리지 + 한글 IME
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS

export LANG=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=XFCE

# IME(한글) 입력을 위한 환경변수 — ibus-hangul 사용
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus

# dbus 세션 시작 (ibus에 필요)
if command -v dbus-launch >/dev/null 2>&1; then
  eval "$(dbus-launch --sh-syntax)"
  export DBUS_SESSION_BUS_ADDRESS
fi

# VNC 클립보드 ↔ X11 CLIPBOARD/PRIMARY 양방향 브리지
# noVNC 사이드바의 Clipboard 패널과 데스크톱 앱 간 복붙이 가능해진다
#
# vncconfig 만 쓰면 VNC ↔ PRIMARY 만 동기화되고 GTK 앱들이 쓰는 CLIPBOARD
# selection 과는 분리된다. autocutsel 이 CLIPBOARD ↔ PRIMARY 를 추가로 동기화해
# 양쪽 모두 VNC 호스트와 완전히 왕복 가능해진다.
if command -v vncconfig >/dev/null 2>&1; then
  vncconfig -nowin &
fi
if command -v autocutsel >/dev/null 2>&1; then
  autocutsel -fork >/dev/null 2>&1 || true
  autocutsel -selection PRIMARY -fork >/dev/null 2>&1 || true
fi

# 한/영 키 매핑 — 오른쪽 Alt를 Hangul 키로, 오른쪽 Ctrl을 Hangul_Hanja 키로
# ibus triggers 에 'Hangul' 이 이미 포함되어 있어 Right Alt 누르면 한↔영 토글
if command -v setxkbmap >/dev/null 2>&1; then
  setxkbmap -layout us -option "korean:ralt_hangul,korean:rctrl_hanja" 2>/dev/null || true
fi

# 마우스 버튼 매핑 기본값(1=좌, 2=중, 3=우) 보장.
# 일부 노트북 드라이버/xkb option 이 엉켜 좌클릭이 사라지는 사례가 있어 방어적으로 리셋.
if command -v xmodmap >/dev/null 2>&1; then
  xmodmap -e "pointer = 1 2 3" 2>/dev/null || true
fi

# xfce4 "싱글 클릭" 모드 OFF — 데스크톱/파일매니저(thunar) 양쪽.
# 싱글클릭 모드에선 한 번 누르면 "선택만" 되고 "실행 안 됨"으로 보여 좌클릭이 먹지 않는
# 것처럼 오해됨. 특히 노VNC 첫 클릭이 canvas focus 에 소모되고 두 번째 클릭이 오기 전에
# hover 해제되면 시각 피드백이 없어 혼선이 큼.
if command -v xfconf-query >/dev/null 2>&1; then
  (sleep 3
   xfconf-query -c xfce4-desktop -p /desktop-icons/single-click -n -t bool -s false 2>/dev/null || true
   xfconf-query -c thunar -p /misc-single-click -n -t bool -s false 2>/dev/null || true
  ) &
fi

# 한글 IME 데몬 기동 — 한영키는 Shift+Space, Ctrl+Space, Ctrl+Hangul, Hangul(Right Alt)
# noVNC 는 브라우저 OS 별로 Right Alt 키심 전달이 불안정하므로 Shift+Space / Ctrl+Space 를
# 추가 트리거로 두고, 한국어 키보드 사용자는 Ctrl+한/영(=Ctrl+Hangul)도 쓸 수 있게.
#
# 설계: hangul 엔진 "하나만" preload + 전역 triggers 비움 + switch-keys 로만 토글.
#
#   ibus 는 두 층에서 키를 먹는다.
#     (A) org.freedesktop.ibus.general.hotkey.triggers
#         — 엔진 자체를 교체 (예: xkb:us::eng ↔ hangul).
#     (B) org.freedesktop.ibus.engine.hangul switch-keys
#         — 이미 hangul 엔진 안에서 "직접입력(영문) ↔ 한글조합" 모드 토글.
#
#   두 개 다 등록하면 (A) 가 먼저 소비돼서 엔진이 통째로 바뀐다. 엔진 내부
#   토글까지 내려올 기회가 없어 "한영키 누르면 ibus 전체가 바뀌는" 증상이 남.
#   그래서 preload 에 hangul 하나만 두고, (A) 는 비우고, (B) 만 활성화한다.
#   ibus-hangul 의 직접입력 모드가 영문 입력 그대로라 영어 타이핑에도 문제 없음.
#
# 주의: 키 이름은 `switch-keys` 이다. 과거 `hangul-keys` 로 썼다가 스키마에 없는 키라
# gsettings 가 조용히 실패(|| true 로 에러 삼킴)하고 기본값 'Hangul,Shift+space' 만
# 남는 버그가 있었다 — ibus-setup GUI 의 "Hangul Toggle Key" 에 Ctrl+space / Ctrl+Hangul
# 이 안 보이면 이 스키마 키 이름부터 확인.
#
# 순서도 중요: gsettings 를 먼저 동기로 끝낸 뒤 ibus-daemon 을 띄워야 새 값이 로드된다.
# 이전에 gsettings 를 백그라운드로 돌리고 ibus-daemon 을 병렬 기동했더니,
# Ctrl+Hangul 같이 뒤에 추가한 항목이 데몬에 반영되지 않는 레이스가 있었음.
if command -v ibus-daemon >/dev/null 2>&1; then
  gsettings set org.freedesktop.ibus.general preload-engines "['hangul']" 2>/dev/null || true
  gsettings set org.freedesktop.ibus.general.hotkey triggers "@as []" 2>/dev/null || true
  gsettings set org.freedesktop.ibus.engine.hangul switch-keys 'Hangul,Shift+space,Control+space,Control+Hangul' 2>/dev/null || true
  sync
  ibus-daemon -drx >/dev/null 2>&1 &
  (sleep 2 && ibus engine hangul) >/dev/null 2>&1 &
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

  # ─── Firefox 바탕화면 바로가기 + 기본 브라우저 지정 ───
  # xfce4 데스크톱에서 바로 실행 가능하도록 ~/Desktop/firefox.desktop 배치.
  # 실행 권한 (+x) 을 주면 xfdesktop 이 "실행 여부" 다이얼로그 없이 바로 띄움.
  # 또한 ~/.config/mimeapps.list 에 http/https 기본 핸들러를 firefox.desktop 으로 박아
  # xdg-open / 앱에서 링크 클릭 → 파이어폭스 로 뜨도록 보장.
  if command -v firefox >/dev/null 2>&1; then
    mkdir -p "${USER_HOME}/Desktop"
    cat > "${USER_HOME}/Desktop/firefox.desktop" <<'FFDESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=인터넷 (Firefox)
Name[en]=Firefox Web Browser
Comment=웹 브라우저로 인터넷 접속
Exec=firefox %u
Icon=firefox
Terminal=false
Categories=Network;WebBrowser;
StartupNotify=true
FFDESKTOP
    chmod +x "${USER_HOME}/Desktop/firefox.desktop"

    mkdir -p "${USER_HOME}/.config"
    cat > "${USER_HOME}/.config/mimeapps.list" <<'MIMEUSER'
[Default Applications]
text/html=firefox.desktop
application/xhtml+xml=firefox.desktop
x-scheme-handler/http=firefox.desktop
x-scheme-handler/https=firefox.desktop
x-scheme-handler/ftp=firefox.desktop
x-scheme-handler/chrome=firefox.desktop
x-scheme-handler/about=firefox.desktop
x-scheme-handler/unknown=firefox.desktop

[Added Associations]
text/html=firefox.desktop;
application/xhtml+xml=firefox.desktop;
x-scheme-handler/http=firefox.desktop;
x-scheme-handler/https=firefox.desktop;
MIMEUSER

    chown -R "${USERNAME}:${USERNAME}" "${USER_HOME}/Desktop" "${USER_HOME}/.config/mimeapps.list"
  fi

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
  -AlwaysShared \\
  -RemapKeys=0xffea-\\>0xff31,0xffe4-\\>0xff34

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
  # Requires+PartOf 조합: vnc 서버가 꺼지면 novnc도 같이 꺼지고(PartOf),
  # vnc 서버가 restart 되면 novnc 도 같이 restart 된다. BindsTo 만 쓰면
  # 단방향이라 vnc 재기동 후 novnc 가 되살아나지 않아 "검은 화면" 증상 발생.
  cat > "/etc/systemd/system/novnc-${USERNAME}.service" <<EOF
[Unit]
Description=noVNC WebSocket proxy for ${USERNAME}
After=vnc-${USERNAME}.service
Requires=vnc-${USERNAME}.service
PartOf=vnc-${USERNAME}.service

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

        # noVNC 자산 캐시 방지 — 버전 업그레이드 시 구 ui.js/vnc.html 캐시 충돌 방지
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        expires -1;
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
