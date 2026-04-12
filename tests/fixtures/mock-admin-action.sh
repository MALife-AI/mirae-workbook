#!/bin/bash
# mock-admin-action.sh — admin-action.sh 흉내. 진짜 tmux/sudo 호출 없이 캔드 응답만.
# 사용: ADMIN_ACTION_PATH=$(realpath tests/fixtures/mock-admin-action.sh)

ACTION="${1:-}"

case "$ACTION" in
  capture-scrollback)
    USER="${2:-}"
    LINES="${3:-1000}"
    if [ -z "$USER" ]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    cat <<'EOF'
user01@workshop:~$ claude
> PLAN.md 만들어줘
✓ Created PLAN.md
user01@workshop:~$ ls
PLAN.md  README.md
EOF
    exit 0
    ;;
  clear-session)
    echo '{"ok":true,"action":"clear-session","user":"'"${2:-test}"'"}'
    ;;
  send-keys)
    head -c 32768 > /dev/null
    echo '{"ok":true,"action":"send-keys","user":"'"${2:-test}"'","len":0}'
    ;;
  set-demo-mode)
    echo '{"ok":true,"action":"set-demo-mode","user":"'"${2:-test}"'","mode":"'"${3:-normal}"'"}'
    ;;
  clean-workspace)
    echo '{"ok":true,"action":"clean-workspace","user":"'"${2:-test}"'"}'
    ;;
  stop-user|start-user)
    echo '{"ok":true,"action":"'"$ACTION"'","user":"'"${2:-test}"'"}'
    ;;
  refresh-creds)
    echo '{"ok":true,"action":"refresh-creds","count":'"${2:-20}"'}'
    ;;
  reset-sessions|reset-session)
    echo '{"ok":true,"action":"'"$ACTION"'","user":"'"${2:-all}"'"}'
    ;;
  claude-usage)
    echo 'Usage: 50% of daily limit'
    ;;
  clean-all-homes)
    echo '{"ok":true,"action":"clean-all-homes","count":'"${2:-20}"'}'
    ;;
  force-relogin)
    echo '{"ok":true,"action":"force-relogin"}'
    ;;
  *)
    echo "ERROR: mock unknown action '$ACTION'" >&2
    exit 2
    ;;
esac
