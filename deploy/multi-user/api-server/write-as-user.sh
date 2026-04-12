#!/bin/bash
# write-as-user.sh
# 백엔드(workbook-api)가 sudo로 호출하는 파일 쓰기 wrapper.
#
# 사용법 (백엔드만 호출 — 일반 사용자가 직접 호출하지 않음):
#   write-as-user.sh write  /home/userXX/path/file < content
#   write-as-user.sh append /home/userXX/path/file < content
#
# sudoers에서 workbook-api → userXX 로만 sudo 허용. 따라서 이 스크립트는
# 항상 대상 사용자(userXX) 권한으로 실행되며, 자신의 홈 밖으로는 쓸 수 없다.
#
# 안전장치:
#   - 첫 인자는 write|append 만 허용
#   - 두 번째 인자는 절대경로 + /home/$(whoami)/ 시작 강제
#   - 경로 정규화 (..  심볼릭링크 제거) 후 다시 검증
#   - 디렉터리 자동 생성 (mkdir -p)
#   - 32MB 입력 상한 (head -c 로 잘라 받음 → 본문이 더 길면 절단)

set -euo pipefail

ACTION="${1:-}"
TARGET="${2:-}"

if [ -z "$ACTION" ] || [ -z "$TARGET" ]; then
  echo "usage: $0 <write|append> <absolute-path>" >&2
  exit 2
fi

if [ "$ACTION" != "write" ] && [ "$ACTION" != "append" ]; then
  echo "ERROR: action must be 'write' or 'append'" >&2
  exit 2
fi

ME="$(whoami)"
HOME_DIR="/home/${ME}"

# 절대경로 강제
case "$TARGET" in
  /*) ;;
  *)
    echo "ERROR: target must be absolute path" >&2
    exit 2
    ;;
esac

# 상위 디렉터리 정규화 후 자기 홈 안인지 확인
PARENT="$(dirname -- "$TARGET")"
mkdir -p -- "$PARENT"
PARENT_REAL="$(readlink -f -- "$PARENT")"

case "$PARENT_REAL/" in
  "$HOME_DIR/"*) ;;
  *)
    echo "ERROR: target must be inside $HOME_DIR" >&2
    exit 3
    ;;
esac

FNAME="$(basename -- "$TARGET")"
case "$FNAME" in
  ""|"."|"..")
    echo "ERROR: invalid filename" >&2
    exit 2
    ;;
esac

REAL_TARGET="${PARENT_REAL}/${FNAME}"

# 본문 받기 (32MB 상한)
if [ "$ACTION" = "write" ]; then
  head -c 33554432 > "$REAL_TARGET"
else
  head -c 33554432 >> "$REAL_TARGET"
fi

# 일반 파일 권한 (소유자=현재 사용자, 660 대신 644 — 자기 홈은 750이라 외부 노출 없음)
chmod 644 "$REAL_TARGET" 2>/dev/null || true

echo "OK ${ACTION} ${REAL_TARGET}"
