#!/bin/bash
# install-acl-timer.sh — fix-acl.sh를 1분마다 자동 실행하는 systemd timer 등록
#
# 문제: 사용자가 워크숍 중 claude /login 등을 실행하면 .claude.json 이 새로
#       만들어지면서 권한이 600으로 떨어져, 백엔드가 다시 못 읽게 된다.
# 해결: systemd timer 가 1분마다 fix-acl.sh 를 oneshot 으로 실행해 권한을 보정.
#
# 사용법: sudo bash deploy/multi-user/install-acl-timer.sh
# 제거:   sudo systemctl disable --now fix-acl.timer

set -e

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: sudo로 실행하세요" >&2
  exit 1
fi

# fix-acl.sh 위치 — 이 스크립트와 같은 디렉터리
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIX_SCRIPT="$SCRIPT_DIR/fix-acl.sh"
USER_COUNT="${1:-20}"

if [ ! -x "$FIX_SCRIPT" ]; then
  echo "ERROR: $FIX_SCRIPT 가 없거나 실행 권한 없음" >&2
  exit 2
fi

if ! command -v setfacl >/dev/null 2>&1; then
  echo "ERROR: setfacl 명령이 없습니다. 먼저 설치:" >&2
  echo "  apt update && apt install -y acl" >&2
  exit 3
fi

echo "[1/3] systemd service unit 생성"
cat > /etc/systemd/system/fix-acl.service <<EOF
[Unit]
Description=Mirae Workbook — refresh ACL on user homes (oneshot)
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash ${FIX_SCRIPT} ${USER_COUNT}
# stdout/stderr 는 journald 로 자동 수집됨
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOF

echo "[2/3] systemd timer unit 생성 (1분 간격)"
cat > /etc/systemd/system/fix-acl.timer <<'EOF'
[Unit]
Description=Run fix-acl.service every minute

[Timer]
# 부팅 후 30초 뒤 첫 실행, 그 다음 1분마다
OnBootSec=30s
OnUnitActiveSec=1min
AccuracySec=10s
Unit=fix-acl.service
Persistent=false

[Install]
WantedBy=timers.target
EOF

echo "[3/3] daemon-reload + enable + start"
systemctl daemon-reload
systemctl enable --now fix-acl.timer

echo ""
echo "=========================================="
echo "  fix-acl.timer 설치 완료"
echo "=========================================="
echo ""
echo "  상태:    systemctl status fix-acl.timer"
echo "  로그:    journalctl -u fix-acl.service -f"
echo "  다음 실행: systemctl list-timers fix-acl.timer"
echo ""
echo "  비활성화: sudo systemctl disable --now fix-acl.timer"
