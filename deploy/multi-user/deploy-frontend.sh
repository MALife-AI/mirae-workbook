#!/bin/bash
# deploy-frontend.sh
# 로컬에서 vite build → 결과를 서버 /var/www/mirae-workbook/로 rsync.
#
# 사용법:
#   ./deploy-frontend.sh user@server                    # 기본 경로 /var/www/mirae-workbook
#   ./deploy-frontend.sh user@server /opt/web           # 경로 지정
#
# 사전 준비:
#   - 로컬: node + npm 설치 (vite build 가능)
#   - 원격: setup-server.sh가 /var/www/mirae-workbook을 만들어 둠
#   - 원격: ssh 키 인증 또는 ssh-agent

set -e

if [ -z "$1" ]; then
  echo "사용법: $0 <user@server> [원격경로]"
  echo "예:    $0 root@workbook.example.com"
  echo "       $0 admin@10.0.0.5 /var/www/mirae-workbook"
  exit 1
fi

REMOTE="$1"
REMOTE_DIR="${2:-/var/www/mirae-workbook}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "=========================================="
echo "  Mirae Workbook Frontend Deploy"
echo "=========================================="
echo "  대상: ${REMOTE}:${REMOTE_DIR}"
echo ""

# 1. 빌드
echo "[1/3] vite build..."
npm run build:web

if [ ! -d dist ]; then
  echo "  ! dist/ 디렉터리가 없습니다. 빌드 실패?"
  exit 1
fi

# 2. rsync (sudo 가능하도록 --rsync-path 옵션 — 원격이 root가 아닐 때)
echo "[2/3] rsync 업로드..."
rsync -avz --delete \
  --rsync-path="sudo rsync" \
  dist/ \
  "${REMOTE}:${REMOTE_DIR}/"

# 3. 권한 보정
echo "[3/3] 원격 권한 보정..."
ssh "$REMOTE" "sudo chown -R www-data:www-data ${REMOTE_DIR} 2>/dev/null || true"

echo ""
echo "=========================================="
echo "  배포 완료!"
echo "=========================================="
echo ""
echo "  확인:"
echo "    curl -u user01:user01 http://${REMOTE#*@}/ | head"
echo ""
