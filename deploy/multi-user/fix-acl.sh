#!/bin/bash
# fix-acl.sh — 사용자 홈 ACL 핫픽스
#
# 증상: 슬라이드 파일 탐색기에서 .claude 폴더 클릭 시
#       "API /api/list?path=.claude 500" 또는 "권한 없음" 에러
#
# 원인: 사용자가 만든 .claude/skills, .claude/commands 등에 대해
#       백엔드(workbook-api in workbook-readers 그룹)가 read 권한 없음
#
# 해결: setfacl 로 default ACL + 재귀 적용
#
# 사용법: sudo bash deploy/multi-user/fix-acl.sh
#         또는 sudo bash deploy/multi-user/fix-acl.sh 20  (사용자 수)

set -e
USER_COUNT="${1:-20}"
USER_PREFIX="user"

if ! command -v setfacl >/dev/null 2>&1; then
  echo "setfacl 명령이 없습니다. 먼저 설치하세요:"
  echo "  apt update && apt install -y acl"
  exit 1
fi

if ! getent group workbook-readers >/dev/null; then
  echo "workbook-readers 그룹이 없습니다. setup-server.sh 를 먼저 실행하세요."
  exit 2
fi

echo "[*] workbook-readers 그룹에 ACL 부여 중..."

count=0
for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
  USERNAME="${USER_PREFIX}${i}"
  HOME_DIR="/home/${USERNAME}"
  if ! id "$USERNAME" >/dev/null 2>&1; then continue; fi
  if [ ! -d "$HOME_DIR" ]; then continue; fi

  # 홈 자체에 default ACL — 새로 만들어지는 모든 파일/폴더에 자동 상속
  setfacl -m g:workbook-readers:rX "$HOME_DIR" 2>/dev/null || true
  setfacl -d -m g:workbook-readers:rX "$HOME_DIR" 2>/dev/null || true

  # 이미 만들어진 .claude / subagent-mastery 안에 재귀 적용
  for sub in .claude subagent-mastery; do
    if [ -d "$HOME_DIR/$sub" ]; then
      setfacl -R -m g:workbook-readers:rX "$HOME_DIR/$sub" 2>/dev/null || true
      setfacl -d -m g:workbook-readers:rX "$HOME_DIR/$sub" 2>/dev/null || true
    fi
  done

  # 이미 존재하는 개별 파일들 — default ACL 상속 안 됐을 가능성이 높아 명시적으로 처리
  # .claude.json, .credentials.json, .mcp.json, CLAUDE.md 등
  for f in .claude.json .mcp.json CLAUDE.md .claude/.credentials.json .claude/settings.json .claude/settings.local.json .claude/history.jsonl; do
    if [ -e "$HOME_DIR/$f" ]; then
      chgrp workbook-readers "$HOME_DIR/$f" 2>/dev/null || true
      chmod g+r "$HOME_DIR/$f" 2>/dev/null || true
      setfacl -m g:workbook-readers:r "$HOME_DIR/$f" 2>/dev/null || true
    fi
  done

  count=$((count + 1))
  echo "  + $USERNAME"
done

echo ""
echo "[*] 완료: $count 개 사용자 홈에 ACL 적용"
echo ""
echo "확인: getfacl /home/user01/.claude"
