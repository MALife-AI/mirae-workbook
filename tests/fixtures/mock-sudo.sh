#!/bin/bash
# mock-sudo.sh — sudo 흉내. 실제 권한 변경 없이 -u/-H/--/-n 플래그를 무시하고 나머지를 그대로 실행.
# 사용: SUDO_PATH=$(realpath tests/fixtures/mock-sudo.sh)

# sudo 인자 파싱: -n, -u USER, -H, -- 플래그를 건너뛰고 실제 명령만 추출
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|-H) shift ;;
    -u) shift; shift ;;  # -u USER
    --) shift; break ;;
    *) break ;;
  esac
done

# 남은 인자가 실제 명령. 그대로 실행.
exec "$@"
