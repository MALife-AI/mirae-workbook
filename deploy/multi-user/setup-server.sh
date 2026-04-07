#!/bin/bash
# Mirae Workbook - Multi-user Server Setup
# 한 서버에 Claude Code를 설치하고 user01~user15 계정을 일괄 생성합니다.
# 사용법: sudo ./setup-server.sh [USER_COUNT]
#   USER_COUNT 기본값: 15

set -e

if [ "$EUID" -ne 0 ]; then
  echo "이 스크립트는 root 권한이 필요합니다. sudo로 실행하세요."
  exit 1
fi

USER_COUNT="${1:-15}"
USER_PREFIX="user"

echo "=========================================="
echo "  Mirae Workbook Multi-user Setup"
echo "=========================================="
echo "  사용자 수: $USER_COUNT"
echo ""

# ─── 1. 시스템 패키지 ───────────────────────────
echo "[1/6] 시스템 패키지 설치..."
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates git bash sudo \
  build-essential python3 python3-pip \
  quota quotatool

# ─── 2. Node.js 20 LTS ─────────────────────────
echo "[2/6] Node.js 20 LTS 설치..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

# ─── 3. Claude Code (전역 설치) ───────────────
echo "[3/6] Claude Code 전역 설치..."
npm install -g @anthropic-ai/claude-code
claude --version || echo "  (claude --version 일부 환경에서 오류 가능 — 무시)"

# ─── 4. 사용자 일괄 생성 ──────────────────────
echo "[4/6] 사용자 ${USER_COUNT}명 생성..."
CREDENTIALS_FILE="/root/workbook-credentials.txt"
echo "# Mirae Workbook 사용자 계정" > "$CREDENTIALS_FILE"
echo "# 생성일: $(date)" >> "$CREDENTIALS_FILE"
echo "" >> "$CREDENTIALS_FILE"

for i in $(seq -w 1 "$USER_COUNT"); do
  USERNAME="${USER_PREFIX}${i}"
  if id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME (이미 존재, 스킵)"
    continue
  fi

  # 16자 랜덤 비밀번호
  PASSWORD=$(openssl rand -base64 12)

  useradd -m -s /bin/bash "$USERNAME"
  echo "${USERNAME}:${PASSWORD}" | chpasswd
  chmod 700 "/home/${USERNAME}"

  # .bashrc에 환영 메시지
  cat >> "/home/${USERNAME}/.bashrc" <<'BASHRC'

# ── Mirae Workbook ─────────────────────────────
if [ -t 1 ] && [ -z "$WORKBOOK_GREETED" ]; then
  export WORKBOOK_GREETED=1
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""
    echo "🔐 처음 사용하시나요?"
    echo "   1) 'claude' 입력 후 엔터"
    echo "   2) '/login' 입력"
    echo "   3) 표시되는 URL을 본인 PC 브라우저에서 열기"
    echo "   4) Claude 계정으로 로그인 → 받은 코드를 여기 붙여넣기"
    echo ""
    echo "   다음부터는 'claude'만 입력하면 바로 시작됩니다."
    echo ""
  else
    echo ""
    echo "🤖 Claude Code 준비 완료. 시작: claude"
    echo ""
  fi
fi
BASHRC

  chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}"

  echo "${USERNAME}  ${PASSWORD}" >> "$CREDENTIALS_FILE"
  echo "  + $USERNAME 생성됨"
done

chmod 600 "$CREDENTIALS_FILE"
echo ""
echo "  계정 정보 저장 위치: $CREDENTIALS_FILE"

# ─── 5. 자원 제한 (systemd user slice) ───────
echo "[5/6] 사용자별 자원 제한 설정..."
mkdir -p /etc/systemd/system/user-.slice.d
cat > /etc/systemd/system/user-.slice.d/limits.conf <<'EOF'
# Mirae Workbook - per-user resource limits
[Slice]
CPUQuota=150%
MemoryMax=1500M
MemoryHigh=1200M
TasksMax=300
EOF
systemctl daemon-reload

# /proc 숨기기 (서로의 프로세스 못 보게)
if ! grep -q "hidepid=2" /etc/fstab; then
  echo "proc /proc proc defaults,hidepid=2,gid=0 0 0" >> /etc/fstab
  mount -o remount,hidepid=2,gid=0 /proc || true
fi

# ─── 6. SSH 활성화 ───────────────────────────
echo "[6/6] SSH 서비스 확인..."
if ! systemctl is-active --quiet ssh; then
  systemctl enable --now ssh || systemctl enable --now sshd
fi

# 비밀번호 인증 허용 (필요 시)
if [ -f /etc/ssh/sshd_config ]; then
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
  systemctl reload ssh || systemctl reload sshd || true
fi

echo ""
echo "=========================================="
echo "  설정 완료!"
echo "=========================================="
echo ""
echo "  - 사용자 ${USER_COUNT}명 생성"
echo "  - Claude Code 전역 설치 완료"
echo "  - 자원 제한: CPU 150%, RAM 1.5GB / 사용자"
echo "  - 계정 정보: $CREDENTIALS_FILE"
echo ""
echo "  사용자 접속 방법:"
echo "    ssh user01@$(hostname -I | awk '{print $1}')"
echo ""
echo "  다음 단계:"
echo "    ./setup-ttyd.sh   # 브라우저 터미널 추가"
echo ""
