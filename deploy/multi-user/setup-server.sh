#!/bin/bash
# Mirae Workbook - Multi-user Server Setup
# 한 서버에 Claude Code를 설치하고 user01~user15 계정을 일괄 생성합니다.
# 사용법: sudo ./setup-server.sh [USER_COUNT]
#   USER_COUNT 기본값: 20

set -e

if [ "$EUID" -ne 0 ]; then
  echo "이 스크립트는 root 권한이 필요합니다. sudo로 실행하세요."
  exit 1
fi

USER_COUNT="${1:-20}"
USER_PREFIX="user"

echo "=========================================="
echo "  Mirae Workbook Multi-user Setup"
echo "=========================================="
echo "  사용자 수: $USER_COUNT"
echo ""

# ─── 1. 시스템 패키지 ───────────────────────────
echo "[1/8] 시스템 패키지 설치..."
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates git bash sudo \
  build-essential python3 python3-pip \
  quota quotatool \
  openssh-server \
  tmux

# ─── 2. Node.js 20 LTS ─────────────────────────
echo "[2/8] Node.js 20 LTS 설치..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

# ─── 3. Claude Code (전역 설치) ───────────────
echo "[3/8] Claude Code 전역 설치..."
npm install -g @anthropic-ai/claude-code
claude --version || echo "  (claude --version 일부 환경에서 오류 가능 — 무시)"

# ─── 4. 사용자 일괄 생성 ──────────────────────
echo "[4/8] 사용자 ${USER_COUNT}명 생성..."

# workbook-readers 그룹 — 백엔드가 사용자 홈을 읽기 전용으로 접근하기 위함
if ! getent group workbook-readers >/dev/null; then
  groupadd --system workbook-readers
  echo "  + workbook-readers 그룹 생성"
fi
CREDENTIALS_FILE="/root/workbook-credentials.txt"
echo "# Mirae Workbook 사용자 계정" > "$CREDENTIALS_FILE"
echo "# 생성일: $(date)" >> "$CREDENTIALS_FILE"
echo "" >> "$CREDENTIALS_FILE"

for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  # 비밀번호 = 아이디 (워크숍 단순화용). user00(강의자)만 별도 강한 비번.
  if [ "$USERNAME" = "user00" ]; then
    PASSWORD="asdf1234"
  else
    PASSWORD="${USERNAME}"
  fi

  if id "$USERNAME" >/dev/null 2>&1; then
    echo "  - $USERNAME (이미 존재, 스킵 — 자격 증명만 기록)"
    echo "${USERNAME}  ${PASSWORD}" >> "$CREDENTIALS_FILE"
    continue
  fi

  useradd -m -s /bin/bash "$USERNAME"
  echo "${USERNAME}:${PASSWORD}" | chpasswd
  # 750 + workbook-readers 그룹: 본인은 풀권한, 백엔드(workbook-api)는 읽기만, 그 외 0
  chmod 750 "/home/${USERNAME}"
  chgrp workbook-readers "/home/${USERNAME}"

  # .bashrc에 환영 메시지 + 토큰 모드 별 단축 명령
  cat >> "/home/${USERNAME}/.bashrc" <<'BASHRC'

# ── Mirae Workbook ─────────────────────────────
# 체험(짧은 응답) vs 실습(긴 출력) 별 토큰 한도 단축 명령
# claude       — 8K (기본, 체험용)
# claude-short — 4K (아주 짧게)
# claude-long  — 32K (실습·긴 출력용)
claude-short() { CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096  command claude "$@"; }
claude-long()  { CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768 command claude "$@"; }
export -f claude-short claude-long 2>/dev/null || true

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
    echo "🤖 Claude Code 준비 완료."
    echo "   체험: claude        (기본, 8K 토큰)"
    echo "   실습: claude-long   (32K 토큰, 긴 출력 가능)"
    echo ""
  fi
fi
BASHRC

  chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}"
  # 홈 디렉터리만 다시 그룹을 workbook-readers로 (재귀하면 내부 파일 권한 침범)
  chgrp workbook-readers "/home/${USERNAME}"
  chmod 750 "/home/${USERNAME}"

  # ACL — 백엔드(workbook-api in workbook-readers)가 사용자가 새로 만든
  # .claude/skills, hooks, commands 등도 자동으로 읽을 수 있도록 default ACL 부여.
  # (없으면 /api/list 가 EACCES 500 으로 깨짐)
  if command -v setfacl >/dev/null 2>&1; then
    setfacl -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
    setfacl -d -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
  fi

  echo "${USERNAME}  ${PASSWORD}" >> "$CREDENTIALS_FILE"
  echo "  + $USERNAME 생성됨"
done

echo ""
echo "  계정 정보 저장 위치: $CREDENTIALS_FILE"

# 어드민 계정 — 워크숍 운영자가 진행 모니터링용으로 사용
# 시스템 사용자는 만들지 않음 (ttyd 셸 필요 없음). htpasswd 항목만 있으면 nginx Basic Auth 통과
ADMIN_PASS="${ADMIN_PASS:-asdf1234}"
echo "admin  ${ADMIN_PASS}" >> "$CREDENTIALS_FILE"
echo "  + admin 계정 (htpasswd 전용, password=${ADMIN_PASS}) — 진행 모니터링 대시보드"

chmod 600 "$CREDENTIALS_FILE"

# /home 자체를 711로 — 사용자가 ls /home 못 하게 (defense-in-depth)
chmod 711 /home 2>/dev/null || true

# 기존 사용자도 포함해서 모든 userXX 홈에 750 + workbook-readers 그룹 일괄 적용
# (이전 실행에서 만들어졌지만 아직 그룹이 없는 사용자 보정)
for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  if id "$USERNAME" >/dev/null 2>&1; then
    chgrp workbook-readers "/home/${USERNAME}" 2>/dev/null || true
    chmod 750 "/home/${USERNAME}" 2>/dev/null || true
    # ACL — 기존 사용자에게도 동일하게 default ACL + 재귀 적용
    if command -v setfacl >/dev/null 2>&1; then
      setfacl -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
      setfacl -d -m g:workbook-readers:rX "/home/${USERNAME}" 2>/dev/null || true
      # 이미 만들어진 .claude / subagent-mastery 등에 재귀 적용
      [ -d "/home/${USERNAME}/.claude" ] && setfacl -R -m g:workbook-readers:rX "/home/${USERNAME}/.claude" 2>/dev/null || true
      [ -d "/home/${USERNAME}/subagent-mastery" ] && setfacl -R -m g:workbook-readers:rX "/home/${USERNAME}/subagent-mastery" 2>/dev/null || true
    fi
  fi
done

# acl 패키지가 없으면 안내
if ! command -v setfacl >/dev/null 2>&1; then
  echo "  ⚠ setfacl 명령이 없습니다. apt install -y acl 후 setup-server.sh를 다시 실행하세요."
  echo "    (없으면 사용자가 새로 만든 .claude/* 파일을 백엔드가 못 읽어 /api/list 500 발생)"
fi

# ─── 5. 자원 제한 (systemd user slice) ───────
echo "[5/8] 사용자별 자원 제한 설정..."
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
echo "[6/8] SSH 서비스 확인..."
SSH_UNIT=""
if systemctl list-unit-files ssh.service >/dev/null 2>&1 && systemctl cat ssh.service >/dev/null 2>&1; then
  SSH_UNIT="ssh"
elif systemctl list-unit-files sshd.service >/dev/null 2>&1 && systemctl cat sshd.service >/dev/null 2>&1; then
  SSH_UNIT="sshd"
fi

if [ -n "$SSH_UNIT" ]; then
  systemctl enable --now "$SSH_UNIT" || echo "  (경고: $SSH_UNIT enable 실패 — 무시하고 진행)"
  # 비밀번호 인증 허용
  if [ -f /etc/ssh/sshd_config ]; then
    sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
    systemctl reload "$SSH_UNIT" || true
  fi
else
  echo "  (경고: ssh/sshd 서비스 유닛 없음 — SSH 건너뜀. ttyd 브라우저 접속만 가능)"
fi

# ─── 7. 웹 모드 백엔드 (mirae-workbook-api) ─────
echo "[7/8] 웹 모드 백엔드 (mirae-workbook-api) 설치..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_SRC="$SCRIPT_DIR/api-server"
API_DEST="/opt/mirae-workbook-api"

if [ ! -d "$API_SRC" ]; then
  echo "  (경고: $API_SRC 없음 — 백엔드 설치 건너뜀)"
else
  # 백엔드 전용 사용자 (홈 없음, 로그인 불가)
  if ! id workbook-api >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin \
      --gid workbook-readers workbook-api
    echo "  + workbook-api 시스템 사용자 생성"
  fi

  # 배포
  mkdir -p "$API_DEST"
  cp -r "$API_SRC"/* "$API_DEST/"
  chown -R root:root "$API_DEST"
  chmod 755 "$API_DEST"
  # write-as-user.sh, admin-action.sh, grade-mission.sh, coach.sh 는 sudo로 실행됨 — root 소유 + 755
  chmod 755 "$API_DEST/write-as-user.sh" 2>/dev/null || true
  chmod 755 "$API_DEST/admin-action.sh" 2>/dev/null || true
  chmod 755 "$API_DEST/grade-mission.sh" 2>/dev/null || true
  chmod 755 "$API_DEST/coach.sh" 2>/dev/null || true

  # 의존성 (offline-friendly: 이미 설치돼 있으면 스킵)
  (cd "$API_DEST" && npm install --omit=dev --no-audit --no-fund)

  # sudoers — workbook-api 권한 위임
  SUDOERS_FILE="/etc/sudoers.d/mirae-workbook-api"
  {
    echo "# Mirae Workbook backend — privileged action delegation"
    echo "# 자동 생성 — 수정하지 마세요. setup-server.sh 가 덮어씁니다."
    echo "Defaults!${API_DEST}/write-as-user.sh !requiretty"
    echo "Defaults!${API_DEST}/admin-action.sh !requiretty"
    echo "Defaults!${API_DEST}/grade-mission.sh !requiretty"
    echo "Defaults!${API_DEST}/coach.sh !requiretty"
    USER_LIST=""
    for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
      [ -n "$USER_LIST" ] && USER_LIST="${USER_LIST},"
      USER_LIST="${USER_LIST}${USER_PREFIX}${i}"
    done
    echo "workbook-api ALL=(${USER_LIST}) NOPASSWD: ${API_DEST}/write-as-user.sh"
    echo "workbook-api ALL=(${USER_LIST}) NOPASSWD: ${API_DEST}/grade-mission.sh"
    echo "workbook-api ALL=(${USER_LIST}) NOPASSWD: ${API_DEST}/coach.sh"
    echo "workbook-api ALL=(root) NOPASSWD: ${API_DEST}/admin-action.sh"
    # admin-action.sh가 자식 sudo로 사용자 tmux를 죽이기 위해 root → userXX 도 허용
    echo "root ALL=(${USER_LIST}) NOPASSWD: /usr/bin/tmux"
    # admin-action.sh claude-usage 가 운영자(lsc)로 claude 실행해야 함 — root → lsc 셸
    echo "root ALL=(lsc) NOPASSWD: /bin/bash"
  } > "$SUDOERS_FILE.tmp"
  chmod 440 "$SUDOERS_FILE.tmp"
  if visudo -c -f "$SUDOERS_FILE.tmp" >/dev/null 2>&1; then
    mv "$SUDOERS_FILE.tmp" "$SUDOERS_FILE"
    echo "  + sudoers 룰 설치: workbook-api → ${USER_PREFIX}01..${USER_PREFIX}${USER_COUNT}"
  else
    rm -f "$SUDOERS_FILE.tmp"
    echo "  ! sudoers 검증 실패 — 설치 안 됨. 수동 확인 필요."
  fi

  # systemd unit
  install -m 644 "$API_DEST/mirae-workbook-api.service" \
    /etc/systemd/system/mirae-workbook-api.service
  systemctl daemon-reload
  systemctl enable mirae-workbook-api.service >/dev/null 2>&1 || true
  # 새 코드가 반영되도록 항상 재시작
  systemctl restart mirae-workbook-api.service || \
    echo "  (경고: mirae-workbook-api 재시작 실패 — journalctl -u mirae-workbook-api 확인)"

  echo "  + 백엔드: http://127.0.0.1:6999  (nginx /api/ 로 노출, 재시작 완료)"

  # 키 슬롯 디렉터리 + 팀 분할 설정 — 처음 한 번만 생성
  # 백엔드(workbook-api)가 admin UI에서 직접 키를 쓸 수 있도록 그룹 + 770
  mkdir -p /etc/mirae-workbook/keys/a /etc/mirae-workbook/keys/b
  chgrp -R workbook-api /etc/mirae-workbook/keys 2>/dev/null || true
  chmod 770 /etc/mirae-workbook/keys
  chmod 770 /etc/mirae-workbook/keys/a /etc/mirae-workbook/keys/b
  TEAMS_CONF=/etc/mirae-workbook/teams.conf
  if [ ! -f "$TEAMS_CONF" ]; then
    cat > "$TEAMS_CONF" <<'TEAMS'
# Mirae Workbook — 키 슬롯 분배
# 두 개의 Claude 키를 슬롯 a / b 에 저장하고, 사용자 번호 범위를 매핑.
#
# 키 저장 (운영자 셸에서):
#   1) claude /login  (계정 A)
#   2) sudo /opt/mirae-workbook-api/save-key.sh a
#   3) rm ~/.claude/.credentials.json   (강제 로그아웃)
#   4) claude /login  (계정 B)
#   5) sudo /opt/mirae-workbook-api/save-key.sh b
#   6) 어드민 대시보드에서 "🔑 키 재적용" 클릭
#
# 키 슬롯 b 가 비어 있으면 (= 단일 키 모드) 모든 사용자가 슬롯 a 사용.
# 슬롯 a 도 비어 있으면 fallback으로 /home/lsc/.claude 의 현재 로그인 사용.

KEY_A_FROM=1
KEY_A_TO=10

KEY_B_FROM=11
KEY_B_TO=20
TEAMS
    chmod 644 "$TEAMS_CONF"
    echo "  + 키 슬롯 분배 설정: $TEAMS_CONF"
  fi

  # 운영자가 자기 셸에서 직접 호출할 wrapper (sudo 필요)
  cat > /opt/mirae-workbook-api/save-key.sh <<'SAVEKEY'
#!/bin/bash
# 운영자(lsc)가 현재 로그인한 Claude 키를 슬롯 a 또는 b 에 저장.
# 사용법: sudo /opt/mirae-workbook-api/save-key.sh a
exec /opt/mirae-workbook-api/admin-action.sh save-key "$@"
SAVEKEY
  chmod 755 /opt/mirae-workbook-api/save-key.sh

  # ─── 워크숍 데모용 환율 MCP 서버 ───
  MCP_SRC="$API_SRC/mcp"
  MCP_DEST="/opt/mirae-workbook-mcp"
  if [ -d "$MCP_SRC" ]; then
    mkdir -p "$MCP_DEST"
    cp -r "$MCP_SRC"/* "$MCP_DEST/"
    chown -R root:root "$MCP_DEST"
    chmod 755 "$MCP_DEST"
    chmod 755 "$MCP_DEST"/*.js 2>/dev/null || true
    (cd "$MCP_DEST" && npm install --omit=dev --no-audit --no-fund) >/dev/null 2>&1 || \
      echo "  (경고: MCP 의존성 설치 실패 — 인터넷 확인)"
    echo "  + 환율 MCP: $MCP_DEST/exchange-rate-mcp.js (워크숍 사용자가 claude mcp add 로 등록)"
  fi
fi

# ─── 8. 슬라이드 정적 호스팅 디렉터리 ────────
echo "[8/8] 정적 슬라이드 호스팅 위치 준비..."
mkdir -p /var/www/mirae-workbook
chown -R www-data:www-data /var/www/mirae-workbook 2>/dev/null || true
echo "  + /var/www/mirae-workbook (vite build 결과를 여기에 배포)"

echo ""
echo "=========================================="
echo "  설정 완료!"
echo "=========================================="
echo ""
echo "  - 사용자 ${USER_COUNT}명 생성 (홈 750, 그룹 workbook-readers)"
echo "  - Claude Code 전역 설치 완료"
echo "  - 자원 제한: CPU 150%, RAM 1.5GB / 사용자"
echo "  - 계정 정보: $CREDENTIALS_FILE"
echo "  - 백엔드: mirae-workbook-api (127.0.0.1:6999)"
echo "  - 정적 웹루트: /var/www/mirae-workbook"
echo ""
echo "  사용자 접속 방법:"
echo "    ssh user01@$(hostname -I | awk '{print $1}')"
echo ""
echo "  다음 단계:"
echo "    ./setup-ttyd.sh           # 브라우저 터미널 + nginx 라우팅"
echo "    ./deploy-frontend.sh      # vite build 결과를 /var/www/mirae-workbook에 배포"
echo ""
