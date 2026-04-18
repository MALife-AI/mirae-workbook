#!/bin/bash
# admin-action.sh
# 어드민 권한이 필요한 작업을 백엔드(workbook-api)가 sudo로 호출하기 위한 wrapper.
#
# 사용법 (sudoers NOPASSWD로만 호출 — 일반 사용자가 직접 호출 불가):
#   admin-action.sh refresh-creds [USER_COUNT]
#       /home/lsc/.claude/{.credentials.json,.claude.json} 을 user01..userN 에게 복사 +
#       settings.json (Haiku 4.5 + 사전 권한) 작성 + tmux 세션 리셋
#
#   admin-action.sh reset-sessions [USER_COUNT]
#       모든 user01..userN 의 tmux 세션 종료 (다음 ttyd 접속 시 새 셸)
#
#   admin-action.sh reset-session USERNAME
#       특정 사용자 한 명의 tmux 세션 종료
#
# 결과는 마지막 줄에 JSON으로 출력 — 백엔드가 파싱.

set -euo pipefail

ACTION="${1:-}"
USER_PREFIX="user"
DEFAULT_SOURCE_HOME="/home/lsc"
DEFAULT_USER_COUNT=20
TMUX_LABEL="wb"
TEAMS_CONF="/etc/mirae-workbook/teams.conf"
KEYS_DIR="/etc/mirae-workbook/keys"

# 팀 설정 — 두 슬롯(A, B). 각 슬롯은 사용자 번호 범위에 적용됨.
# 슬롯 파일 구조: $KEYS_DIR/<slot>/credentials.json, $KEYS_DIR/<slot>/claude.json
# 슬롯 파일이 없으면 fallback으로 /home/lsc/.claude/.credentials.json + /home/lsc/.claude.json 사용
KEY_A_FROM=1
KEY_A_TO="$DEFAULT_USER_COUNT"
KEY_B_FROM=0
KEY_B_TO=0
if [ -f "$TEAMS_CONF" ]; then
  # shellcheck disable=SC1090
  . "$TEAMS_CONF"
fi

# 슬롯 (a/b) → 두 파일 경로 셋팅. 슬롯 파일 없으면 lsc fallback.
slot_paths() {
  local slot="$1"
  local cred="$KEYS_DIR/$slot/credentials.json"
  local cfg="$KEYS_DIR/$slot/claude.json"
  if [ -f "$cred" ] && [ -f "$cfg" ]; then
    echo "$cred|$cfg"
    return
  fi
  # Fallback: 운영자 lsc의 현재 로그인 사용
  echo "$DEFAULT_SOURCE_HOME/.claude/.credentials.json|$DEFAULT_SOURCE_HOME/.claude.json"
}

# 사용자 번호(10진수) → 어느 슬롯에 속하는지 (a 또는 b)
slot_for_user_num() {
  local n="$1"
  if [ "$KEY_B_FROM" -gt 0 ] && [ "$n" -ge "$KEY_B_FROM" ] && [ "$n" -le "$KEY_B_TO" ]; then
    echo "b"
    return
  fi
  if [ "$n" -ge "$KEY_A_FROM" ] && [ "$n" -le "$KEY_A_TO" ]; then
    echo "a"
    return
  fi
  echo "a"
}

# 헬퍼: 한 사용자의 셸 환경 + 워크숍 작업 파일을 완전히 초기화 (race-free)
do_reset_one() {
  local U="$1"
  local H="/home/${U}"

  # 1) ttyd 먼저 정지 — 더 이상 새 tmux 클라이언트 생성 못 하게
  systemctl stop "ttyd-${U}.service" 2>/dev/null || true
  systemctl stop "ttyd-view-${U}.service" 2>/dev/null || true

  # 2) tmux server 강제 종료
  sudo -u "$U" /usr/bin/tmux -L "$TMUX_LABEL" kill-server 2>/dev/null || true

  # 3) 잔여 사용자 프로세스 정리 (잠깐 기다림)
  sleep 0.3

  # 4-5) 홈 디렉토리 전체 비우기
  #    보존: .claude/.credentials.json, .claude/settings.json, .claude.json
  #    임시 디렉토리로 백업 후 삭제 → 복원

  local TMP_BAK="/tmp/mirae-reset-${U}-$$"
  mkdir -p "$TMP_BAK"
  [ -f "${H}/.claude/.credentials.json" ] && cp "${H}/.claude/.credentials.json" "$TMP_BAK/cred.json"
  [ -f "${H}/.claude/settings.json" ] && cp "${H}/.claude/settings.json" "$TMP_BAK/settings.json"
  [ -f "${H}/.claude.json" ] && cp "${H}/.claude.json" "$TMP_BAK/claude.json"
  [ -f "${H}/.claude/CLAUDE.md" ] && cp "${H}/.claude/CLAUDE.md" "$TMP_BAK/global-claude.md"
  # VNC 세션 설정 (xstartup, passwd) 보존 — 날리면 vnc-xfce 서비스가 203/EXEC 로 죽음.
  [ -d "${H}/.vnc" ] && cp -a "${H}/.vnc" "$TMP_BAK/vnc" 2>/dev/null || true

  # 홈 안의 모든 파일/폴더 삭제 (숨김 포함)
  rm -rf "${H}"/* "${H}"/.[!.]* "${H}"/..?* 2>/dev/null || true

  # 복원
  mkdir -p "${H}/.claude"
  [ -f "$TMP_BAK/cred.json" ] && cp "$TMP_BAK/cred.json" "${H}/.claude/.credentials.json"
  [ -f "$TMP_BAK/settings.json" ] && cp "$TMP_BAK/settings.json" "${H}/.claude/settings.json"
  [ -f "$TMP_BAK/claude.json" ] && cp "$TMP_BAK/claude.json" "${H}/.claude.json"
  [ -f "$TMP_BAK/global-claude.md" ] && cp "$TMP_BAK/global-claude.md" "${H}/.claude/CLAUDE.md"
  [ -d "$TMP_BAK/vnc" ] && cp -a "$TMP_BAK/vnc" "${H}/.vnc"
  rm -rf "$TMP_BAK"
  : > "${H}/.bash_history"

  # 6.5) ACL 설정 — 백엔드(workbook-readers 그룹)가 .claude / 작업 폴더 안의
  #      새 파일/디렉터리도 자동으로 읽을 수 있게 default ACL 부여.
  #      (이게 없으면 사용자가 만든 .claude/skills 등에 대해 /api/list가 EACCES로 500.)
  if command -v setfacl >/dev/null 2>&1; then
    for d in "${H}" "${H}/.claude" "${H}/subagent-mastery"; do
      [ -d "$d" ] || continue
      setfacl -m g:workbook-readers:rX "$d" 2>/dev/null || true
      setfacl -d -m g:workbook-readers:rX "$d" 2>/dev/null || true
      setfacl -R -m g:workbook-readers:rX "$d" 2>/dev/null || true
    done
  fi

  # 7) ttyd 다시 시작 — 새 tmux server + 새 세션이 깨끗한 상태로 생성됨
  systemctl start "ttyd-${U}.service" 2>/dev/null || true
  systemctl start "ttyd-view-${U}.service" 2>/dev/null || true
}

# 헬퍼: 운영자(lsc)의 현재 로그인을 슬롯에 스냅샷
save_key_to_slot() {
  local slot="$1"
  if [ -z "$slot" ]; then echo "ERROR: slot required" >&2; exit 2; fi
  local src_cred="$DEFAULT_SOURCE_HOME/.claude/.credentials.json"
  local src_cfg="$DEFAULT_SOURCE_HOME/.claude.json"
  if [ ! -f "$src_cred" ] || [ ! -f "$src_cfg" ]; then
    echo "ERROR: no current login at $DEFAULT_SOURCE_HOME — claude /login 먼저" >&2
    exit 3
  fi
  local dst_dir="$KEYS_DIR/$slot"
  mkdir -p "$dst_dir"
  cp "$src_cred" "$dst_dir/credentials.json"
  cp "$src_cfg" "$dst_dir/claude.json"
  chmod 700 "$dst_dir"
  chmod 600 "$dst_dir/credentials.json" "$dst_dir/claude.json"
  echo "{\"ok\":true,\"action\":\"save-key\",\"slot\":\"$slot\"}"
}

# nginx Basic Auth realm 회전 → 모든 브라우저에 캐시된 자격증명 무효화
# nginx 의 auth_basic 문자열에 " v<N>" 접미사를 붙이고 매번 N 증가.
# realm 이 바뀌면 브라우저는 새 챌린지로 인식해서 재로그인 프롬프트.
rotate_nginx_realm() {
  local CFG="/etc/nginx/sites-available/workbook"
  local STATE_FILE="/var/lib/mirae-workbook-api/realm-version"

  [ -f "$CFG" ] || return 0

  local VER=1
  if [ -f "$STATE_FILE" ]; then
    local OLD
    OLD="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"
    case "$OLD" in
      ''|*[!0-9]*) OLD=0 ;;
    esac
    VER=$((OLD + 1))
  fi

  # 1) 기존 " v<num>" 접미사 제거 → 2) 새 접미사 추가
  #    sed -i가 /etc/nginx에서 실패할 수 있으므로 tmp 경유
  local TMP="/tmp/nginx-realm-$$"
  sed -E '
    s/(auth_basic[[:space:]]+"[^"]*) v[0-9]+";/\1";/g;
    s/(auth_basic[[:space:]]+"[^"]*)";/\1 v'"$VER"'";/g
  ' "$CFG" > "$TMP" && cp "$TMP" "$CFG" && rm -f "$TMP"

  # nginx 검증 후 reload
  if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
  fi

  mkdir -p "$(dirname "$STATE_FILE")"
  echo "$VER" > "$STATE_FILE"
  echo "  + nginx realm 회전 → v$VER (모든 브라우저 재로그인 강제)" >&2
}

resolve_user_count() {
  local n="${1:-$DEFAULT_USER_COUNT}"
  case "$n" in
    ''|*[!0-9]*) n="$DEFAULT_USER_COUNT" ;;
  esac
  if [ "$n" -lt 1 ]; then n=1; fi
  if [ "$n" -gt 100 ]; then n=100; fi
  echo "$n"
}

case "$ACTION" in
  vnc-status)
    # 모든 novnc-userXX 서비스 상태 수집. JSON 한 줄로 출력.
    # 각 항목: {user, port, service_active, listening}
    # listening = 68XX 포트 실제 LISTEN 여부 (ss 체크)
    USERS_JSON=""
    FIRST=1
    DEAD=0
    TOTAL=0
    for UNIT in $(systemctl list-unit-files 'novnc-user*.service' --no-pager 2>/dev/null | awk '/novnc-user[0-9]+\.service/{print $1}'); do
      U="${UNIT#novnc-}"; U="${U%.service}"
      NUM="${U#user}"
      PORT="68${NUM}"
      ACTIVE="inactive"
      if systemctl is-active --quiet "$UNIT"; then ACTIVE="active"; fi
      LISTEN="false"
      if ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q LISTEN; then LISTEN="true"; fi
      if [ "$ACTIVE" != "active" ] || [ "$LISTEN" != "true" ]; then DEAD=$((DEAD+1)); fi
      TOTAL=$((TOTAL+1))
      ITEM="{\"user\":\"$U\",\"port\":$PORT,\"service_active\":\"$ACTIVE\",\"listening\":$LISTEN}"
      if [ $FIRST -eq 1 ]; then USERS_JSON="$ITEM"; FIRST=0; else USERS_JSON="$USERS_JSON,$ITEM"; fi
    done
    echo "{\"ok\":true,\"total\":$TOTAL,\"dead\":$DEAD,\"users\":[$USERS_JSON]}"
    ;;

  vnc-reset-user)
    # 단일 사용자의 VNC 세션을 완전 재기동.
    # 순서: vnc-USER (Xtigervnc) → vnc-xfce-USER (xfce 세션) → novnc-USER (ws 프록시)
    # 학습자 데스크톱이 멎거나 좀비 창이 남은 경우 admin 이 한 명만 깨끗이 리셋.
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    NUM="${TARGET//[^0-9]/}"
    [ -z "$NUM" ] && NUM=0
    DISP=$((10#$NUM))
    PORT="68${NUM}"
    # X lock 파일은 systemd ExecStartPre 가 치우지만, xfce 세션이 먼저 죽어야
    # Xtigervnc 도 깔끔히 교체되므로 상위부터 stop
    systemctl stop "novnc-${TARGET}.service" 2>/dev/null || true
    systemctl stop "vnc-xfce-${TARGET}.service" 2>/dev/null || true
    systemctl stop "vnc-${TARGET}.service" 2>/dev/null || true
    # X lock/socket 잔재 정리 (ExecStartPre 중복이지만 안전장치)
    rm -f "/tmp/.X${DISP}-lock" "/tmp/.X11-unix/X${DISP}" 2>/dev/null || true
    systemctl enable "vnc-${TARGET}.service" "vnc-xfce-${TARGET}.service" "novnc-${TARGET}.service" >/dev/null 2>&1 || true
    systemctl start "vnc-${TARGET}.service" 2>/dev/null || true
    sleep 1
    systemctl start "vnc-xfce-${TARGET}.service" 2>/dev/null || true
    systemctl start "novnc-${TARGET}.service" 2>/dev/null || true
    sleep 0.5
    ACTIVE="inactive"; LISTEN="false"
    systemctl is-active --quiet "novnc-${TARGET}.service" && ACTIVE="active"
    ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q LISTEN && LISTEN="true"
    echo "{\"ok\":true,\"action\":\"vnc-reset-user\",\"user\":\"$TARGET\",\"service_active\":\"$ACTIVE\",\"listening\":$LISTEN}"
    ;;

  vnc-recover)
    # 죽은 novnc-userXX만 재기동. vnc-userXX(Xtigervnc)가 먼저 올라와 있어야 하므로
    # 필요 시 그것도 함께 재기동. enable도 걸어 재부팅 이후 자동 기동 보장.
    RECOVERED=0
    FAILED=0
    FAILED_LIST=""
    for UNIT in $(systemctl list-unit-files 'novnc-user*.service' --no-pager 2>/dev/null | awk '/novnc-user[0-9]+\.service/{print $1}'); do
      U="${UNIT#novnc-}"; U="${U%.service}"
      NUM="${U#user}"
      PORT="68${NUM}"
      OK=1
      if systemctl is-active --quiet "$UNIT" && ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q LISTEN; then
        continue
      fi
      # 의존 VNC (Xtigervnc) 먼저 보장
      systemctl is-active --quiet "vnc-${U}.service" || systemctl restart "vnc-${U}.service" 2>/dev/null || OK=0
      systemctl enable "$UNIT" >/dev/null 2>&1 || true
      systemctl restart "$UNIT" 2>/dev/null || OK=0
      sleep 0.3
      if systemctl is-active --quiet "$UNIT" && ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q LISTEN; then
        RECOVERED=$((RECOVERED+1))
      else
        FAILED=$((FAILED+1))
        if [ -z "$FAILED_LIST" ]; then FAILED_LIST="\"$U\""; else FAILED_LIST="$FAILED_LIST,\"$U\""; fi
        OK=0
      fi
    done
    echo "{\"ok\":true,\"recovered\":$RECOVERED,\"failed\":$FAILED,\"failed_users\":[$FAILED_LIST]}"
    ;;

  vnc-restart-all)
    # 모든 사용자의 VNC 체인 재기동 (vnc → vnc-xfce → novnc).
    # "전체 재시작" 에서 호출 — xstartup 이 다시 실행돼 ibus-hangul gsettings
    # 재적용 = 한글 IME 가 "처음 상태"로 돌아간다.
    # vnc-recover 는 "죽은 것만" 살리지만 이건 전부 교체이므로, 접속 중인 사용자는
    # 한 번 끊기고 재연결된다.
    RESTARTED=0
    FAILED=0
    FAILED_LIST=""
    for UNIT in $(systemctl list-unit-files 'vnc-user*.service' --no-pager 2>/dev/null | awk '/^vnc-user[0-9]+\.service/{print $1}'); do
      U="${UNIT#vnc-}"; U="${U%.service}"
      NUM="${U#user}"
      DISP=$((10#$NUM))
      PORT="68${NUM}"
      # 상위부터 stop (xfce → vnc), 그 다음 bottom-up start
      systemctl stop "novnc-${U}.service" 2>/dev/null || true
      systemctl stop "vnc-xfce-${U}.service" 2>/dev/null || true
      systemctl stop "vnc-${U}.service" 2>/dev/null || true
      rm -f "/tmp/.X${DISP}-lock" "/tmp/.X11-unix/X${DISP}" 2>/dev/null || true
      systemctl enable "vnc-${U}.service" "vnc-xfce-${U}.service" "novnc-${U}.service" >/dev/null 2>&1 || true
      systemctl start "vnc-${U}.service" 2>/dev/null || true
      sleep 0.4
      systemctl start "vnc-xfce-${U}.service" 2>/dev/null || true
      systemctl start "novnc-${U}.service" 2>/dev/null || true
      sleep 0.3
      if systemctl is-active --quiet "novnc-${U}.service" \
         && ss -tlnH "sport = :${PORT}" 2>/dev/null | grep -q LISTEN; then
        RESTARTED=$((RESTARTED+1))
      else
        FAILED=$((FAILED+1))
        if [ -z "$FAILED_LIST" ]; then FAILED_LIST="\"$U\""; else FAILED_LIST="$FAILED_LIST,\"$U\""; fi
      fi
    done
    echo "{\"ok\":true,\"action\":\"vnc-restart-all\",\"restarted\":$RESTARTED,\"failed\":$FAILED,\"failed_users\":[$FAILED_LIST]}"
    ;;

  refresh-creds)
    # arg $2: 숫자면 USER_COUNT(전체 루프), userNN 형태면 단일 유저 모드.
    SINGLE_USER=""
    if [ -n "${2:-}" ] && [[ "$2" =~ ^${USER_PREFIX}[0-9]+$ ]]; then
      SINGLE_USER="$2"
    else
      USER_COUNT="$(resolve_user_count "${2:-}")"
    fi

    if [ -n "$SINGLE_USER" ]; then
      USER_LIST="$SINGLE_USER"
    else
      USER_LIST=""
      for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
        USER_LIST="$USER_LIST ${USER_PREFIX}${i}"
      done
    fi

    COPIED=0
    SKIPPED=0
    for USERNAME in $USER_LIST; do
      if ! id "$USERNAME" >/dev/null 2>&1; then
        SKIPPED=$((SKIPPED + 1))
        continue
      fi

      # 사용자 번호에 따라 슬롯 결정 → 키 파일 경로
      USER_NUM=$((10#$(echo "$USERNAME" | sed 's/[^0-9]//g' | head -c 3)))
      SLOT="$(slot_for_user_num "$USER_NUM")"
      PATHS="$(slot_paths "$SLOT")"
      SRC_CRED="${PATHS%|*}"
      SRC_CFG="${PATHS#*|}"

      if [ ! -f "$SRC_CRED" ] || [ ! -f "$SRC_CFG" ]; then
        echo "WARN: $USERNAME slot=$SLOT 키 없음 — 스킵" >&2
        SKIPPED=$((SKIPPED + 1))
        continue
      fi

      TARGET_DIR="/home/${USERNAME}/.claude"
      TARGET_CRED="$TARGET_DIR/.credentials.json"
      TARGET_CFG="/home/${USERNAME}/.claude.json"
      TARGET_SETTINGS="$TARGET_DIR/settings.json"

      mkdir -p "$TARGET_DIR"
      cp "$SRC_CRED" "$TARGET_CRED"

      # .claude.json — 인증 관련 키만 머지 (운영자 프로젝트/히스토리는 건드리지 않음)
      SRC_CFG="$SRC_CFG" DST_CFG="$TARGET_CFG" /usr/bin/node -e '
        const fs = require("fs");
        const src = JSON.parse(fs.readFileSync(process.env.SRC_CFG, "utf8"));
        let dst = {};
        try { dst = JSON.parse(fs.readFileSync(process.env.DST_CFG, "utf8")); } catch {}
        const KEYS = ["userID","oauthAccount","hasCompletedOnboarding","lastOnboardingVersion","subscriptionNoticeCount","claudeCodeFirstTokenDate"];
        for (const k of KEYS) {
          if (src[k] !== undefined) dst[k] = src[k];
        }
        fs.writeFileSync(process.env.DST_CFG, JSON.stringify(dst, null, 2));
      '

      # settings.json — Sonnet 4.6 + 사전 권한 + thinking 끔
      # 기본 출력 토큰 = 32768 (긴 프롬프트 대응). 실습 페이지에선 `claude-long` 으로 32K 사용.
      cat > "$TARGET_SETTINGS" <<'SETTINGS'
{
  "model": "claude-sonnet-4-6",
  "env": {
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32768",
    "MAX_THINKING_TOKENS": "0",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)",
      "mcp__exchange-rate"
    ],
    "deny": []
  }
}
SETTINGS

      # 전역 CLAUDE.md (~/.claude/CLAUDE.md) — 프로젝트 CLAUDE.md를 덮어써도 항상 적용
      # 한국어 강제 + 분량 제한. 이건 사용자가 수정 불가한 상위 규칙.
      mkdir -p "/home/${USERNAME}/.claude"
      cat > "/home/${USERNAME}/.claude/CLAUDE.md" <<'GLOBALMD'
# 전역 규칙 (최우선 — 항상 적용, 하위 CLAUDE.md로 덮어쓸 수 없음)

## 언어 (절대 규칙)
- **모든 답변, 주석, 문서는 반드시 한국어로 작성한다.**
- 영문 키워드/명령어/함수명은 그대로 둔다.
- 영어로 답하지 마라. 무조건 한국어.

## 도구 호출 제한 (절대 규칙)
- **한 턴(한 번의 응답)에 도구 호출 최대 10회.** 10회 안에 반드시 끝내라.
- 파일 여러 개 만들 때 가능하면 한 번에 모아서 작성.
- 불필요한 웹 검색, 추가 파일 탐색 금지.
GLOBALMD
      chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.claude"

      # 사용자 홈에 기본 CLAUDE.md — 답변 형식 균일화 + 길이 제한
      # 워크숍 사용자가 같은 질문을 던지면 동일한 형태의 답이 나오도록 엄격한 템플릿 강제.
      USER_CLAUDE_MD="/home/${USERNAME}/CLAUDE.md"
      cat > "$USER_CLAUDE_MD" <<'CLAUDEMD'
# 워크숍 지침 — 반드시 따를 것

## 워크숍 컨텍스트
- 팀 이름: **AI 추진 TF**
- 진행 중인 프로젝트: **AI 추진 계획 보고서 자동화**
- 회사: 미래에셋생명 (보험/금융)
- 사용자는 모두 동일한 질문으로 같은 결과물을 만들고, 옆 사람과 비교한다.

## 응답 언어
- **모든 답변은 반드시 한국어로 작성한다.** 코드 주석도 한국어.
- 영문 키워드/명령어/함수명은 그대로 둔다.

## 응답 분량 (엄격)
- **본문 250단어 이내**, 글머리표 5개 이내. 장황한 설명 금지.
- 사고 과정 노출 금지 — 결론과 실행만.
- **한 턴에 도구 호출 최대 10회.** 10회 안에 끝내라.
- 불필요한 추가 검색·웹 fetch 금지.
- 중복된 사례나 비슷한 항목 반복하지 않는다.

## 응답 형식 (모든 작업에 적용)
1. **결론 한 줄** — 무엇을 만들지/했는지
2. **단계** — 번호 매긴 3-5개 (각 한 줄)
3. **확인 방법** — 사용자가 결과를 어떻게 검증하는지 한 줄
4. (필요 시) **다음 액션** — 한 줄

## 파일 작성 규칙
- CLAUDE.md, SKILL.md, command 파일 등을 만들 때:
  - 메타 헤더 → 본문 → 끝. 잡설 금지.
  - "AI 추진 TF" 와 "AI 추진 계획 보고서" 를 항상 명시.
- 한 번에 한 파일만 수정. 불필요한 곁가지 파일 만들지 말 것.

## 금지
- "추가로 도와드릴까요?", "다른 궁금한 점은?" 같은 마무리 멘트 금지.
- 사용자가 묻지 않은 부수 작업 (테스트, 린트, 추가 파일 생성 등) 금지.
CLAUDEMD
      chmod 644 "$USER_CLAUDE_MD"

      # 권한 + 소유권
      # .claude 디렉터리: 750 + workbook-readers 그룹 → 백엔드(workbook-api)가 list/read 가능
      # .credentials.json / .claude.json: 640 + workbook-readers → 본인 + 백엔드만 읽기
      chown -R "${USERNAME}:${USERNAME}" "$TARGET_DIR"
      chown "${USERNAME}:${USERNAME}" "$TARGET_CFG"
      chgrp workbook-readers "$TARGET_DIR" "$TARGET_CRED" "$TARGET_CFG" 2>/dev/null || true
      chmod 750 "$TARGET_DIR"
      chmod 640 "$TARGET_CRED"
      chmod 640 "$TARGET_CFG"
      chmod 644 "$TARGET_SETTINGS"
      [ -f "$USER_CLAUDE_MD" ] && chown "${USERNAME}:${USERNAME}" "$USER_CLAUDE_MD"

      # ttyd만 재시작 (홈 비우지 않음 — 방금 쓴 크레덴셜 보호)
      systemctl stop "ttyd-${USERNAME}.service" 2>/dev/null || true
      systemctl stop "ttyd-view-${USERNAME}.service" 2>/dev/null || true
      sudo -u "$USERNAME" /usr/bin/tmux -L "$TMUX_LABEL" kill-server 2>/dev/null || true
      sleep 0.2
      systemctl start "ttyd-${USERNAME}.service" 2>/dev/null || true
      systemctl start "ttyd-view-${USERNAME}.service" 2>/dev/null || true

      COPIED=$((COPIED + 1))
    done

    if [ -n "$SINGLE_USER" ]; then
      echo "{\"ok\":true,\"action\":\"refresh-creds\",\"user\":\"$SINGLE_USER\",\"copied\":$COPIED,\"skipped\":$SKIPPED}"
    else
      echo "{\"ok\":true,\"action\":\"refresh-creds\",\"copied\":$COPIED,\"skipped\":$SKIPPED}"
    fi
    ;;

  reset-sessions)
    USER_COUNT="$(resolve_user_count "${2:-}")"
    COUNT=0
    for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
      USERNAME="${USER_PREFIX}${i}"
      if id "$USERNAME" >/dev/null 2>&1; then
        do_reset_one "$USERNAME"
        COUNT=$((COUNT + 1))
      fi
    done
    # 모든 브라우저에 캐시된 Basic Auth 자격증명도 무효화
    rotate_nginx_realm
    echo "{\"ok\":true,\"action\":\"reset-sessions\",\"count\":$COUNT,\"relogin\":true}"
    ;;

  reset-session)
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    do_reset_one "$TARGET"
    # 단일 사용자 리셋: realm 은 회전하지 않음 (모든 사용자가 로그아웃되어 버림).
    # 해당 사용자만 브라우저 자격증명도 비우고 싶다면 그 사용자에게 페이지 reload 요청만 보냄.
    echo "{\"ok\":true,\"action\":\"reset-session\",\"user\":\"$TARGET\"}"
    ;;

  force-relogin)
    # 명시적으로 realm 만 회전 (세션 데이터는 건드리지 않음)
    rotate_nginx_realm
    echo "{\"ok\":true,\"action\":\"force-relogin\"}"
    ;;

  set-demo-mode)
    # 발표자(user00) 의 settings.json 을 시연용 ↔ 일반용으로 swap.
    # 시연용  : Haiku 4.5 + max_output_tokens 32768 → 모델만 빠른 Haiku, 출력 길이는 풀
    # 일반용  : Sonnet 4.6 + 32768                    → 풀 품질
    # 다음 claude 호출부터 적용 — kill-session 과 함께 호출되면 즉시 전환.
    TARGET="${2:-}"
    MODE_NAME="${3:-normal}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    if [ "$MODE_NAME" != "demo" ] && [ "$MODE_NAME" != "normal" ]; then
      echo "ERROR: mode must be 'demo' or 'normal'" >&2
      exit 2
    fi

    TARGET_DIR="/home/${TARGET}/.claude"
    SETTINGS="${TARGET_DIR}/settings.json"
    mkdir -p "$TARGET_DIR"

    if [ "$MODE_NAME" = "demo" ]; then
      cat > "$SETTINGS" <<'DEMO_SETTINGS'
{
  "model": "claude-haiku-4-5-20251001",
  "env": {
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32768",
    "MAX_THINKING_TOKENS": "0",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)",
      "mcp__exchange-rate"
    ],
    "deny": []
  }
}
DEMO_SETTINGS
    else
      cat > "$SETTINGS" <<'NORMAL_SETTINGS'
{
  "model": "claude-sonnet-4-6",
  "env": {
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32768",
    "MAX_THINKING_TOKENS": "0",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  },
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)",
      "mcp__exchange-rate"
    ],
    "deny": []
  }
}
NORMAL_SETTINGS
    fi
    chown "${TARGET}:${TARGET}" "$SETTINGS"
    chmod 644 "$SETTINGS"
    echo "{\"ok\":true,\"action\":\"set-demo-mode\",\"user\":\"${TARGET}\",\"mode\":\"${MODE_NAME}\"}"
    ;;

  stop-user)
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    systemctl stop "ttyd-${TARGET}.service" 2>/dev/null || true
    systemctl stop "ttyd-view-${TARGET}.service" 2>/dev/null || true
    sudo -u "$TARGET" /usr/bin/tmux -L "$TMUX_LABEL" kill-server 2>/dev/null || true
    echo "{\"ok\":true,\"action\":\"stop-user\",\"user\":\"$TARGET\"}"
    ;;

  start-user)
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    systemctl start "ttyd-${TARGET}.service" 2>/dev/null || true
    systemctl start "ttyd-view-${TARGET}.service" 2>/dev/null || true
    echo "{\"ok\":true,\"action\":\"start-user\",\"user\":\"$TARGET\"}"
    ;;

  clear-session)
    # 사용자 터미널 완전 초기화 — ttyd 프로세스 자체를 재시작.
    # tmux kill-session 만으로는 ttyd(WebSocket)가 안 죽어서 xterm.js 버퍼 잔존.
    # systemctl restart ttyd-USER → ttyd 죽음 → WebSocket 끊김 → systemd 재시작 → 새 tmux 세션.
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    # tmux 세션 먼저 kill (실행 중이던 claude 등 정리)
    sudo -u "$TARGET" /usr/bin/tmux -L "$TMUX_LABEL" kill-session -t "$TARGET" 2>/dev/null || true
    # ttyd 프로세스 자체 재시작 → WebSocket 완전 끊김 → 새 프로세스 → 새 세션
    systemctl restart "ttyd-${TARGET}.service" 2>/dev/null || true
    echo "{\"ok\":true,\"action\":\"clear-session\",\"user\":\"$TARGET\"}"
    ;;

  paste-text)
    # 긴 텍스트 자동 붙여넣기 — xclip 으로 CLIPBOARD 세팅 후 터미널 창에 Ctrl+Shift+V.
    # type 과 달리 한글/특수문자/긴 문자열 즉시 삽입. 사용자 직접 Ctrl+Shift+V 불필요.
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    NUM="${TARGET//[^0-9]/}"
    [ -z "$NUM" ] && { echo "ERROR: display" >&2; exit 2; }
    DISP=":$((10#$NUM))"
    [ ! -S "/tmp/.X11-unix/X$((10#$NUM))" ] && { echo "ERROR: X $DISP not running" >&2; exit 3; }
    TEXT="$(head -c 262144)"
    [ -z "$TEXT" ] && { echo "ERROR: empty text" >&2; exit 2; }

    # 터미널 창 찾기 / 없으면 자동 실행
    find_terminal() {
      local ids
      ids="$(sudo -u "$TARGET" env DISPLAY="$DISP" xdotool search --onlyvisible --class 'xfce4-terminal|Xfce4-terminal|XTerm|xterm' 2>/dev/null)" || true
      echo "$ids" | tail -1
    }
    WID="$(find_terminal)"
    if [ -z "$WID" ]; then
      sudo -u "$TARGET" env DISPLAY="$DISP" /usr/local/bin/wb-terminal --maximize &>/dev/null &
      for _ in $(seq 1 20); do
        sleep 0.3
        WID="$(find_terminal)"
        [ -n "$WID" ] && break
      done
    fi
    [ -z "$WID" ] && { echo "ERROR: no terminal window" >&2; exit 4; }

    # CLIPBOARD + PRIMARY 양쪽에 텍스트 세팅 후 터미널 활성화 + Ctrl+Shift+V
    printf '%s' "$TEXT" | sudo -u "$TARGET" env DISPLAY="$DISP" xclip -selection clipboard -in 2>/dev/null || {
      echo "ERROR: xclip clipboard failed" >&2
      exit 5
    }
    printf '%s' "$TEXT" | sudo -u "$TARGET" env DISPLAY="$DISP" xclip -selection primary -in 2>/dev/null || true
    sudo -u "$TARGET" env DISPLAY="$DISP" xdotool windowactivate --sync "$WID" 2>/dev/null || true
    # Ctrl+V 주입 — setup-vnc.sh 의 /etc/xdg/xfce4/terminal/accels.scm 에서
    # paste 단축키를 Ctrl+V 로 재매핑했으므로 여기도 맞춰야 한다.
    sudo -u "$TARGET" env DISPLAY="$DISP" xdotool key --window "$WID" --clearmodifiers ctrl+v 2>/dev/null || {
      echo "ERROR: xdotool paste key failed" >&2
      exit 6
    }
    echo "{\"ok\":true,\"action\":\"paste-text\",\"user\":\"$TARGET\",\"len\":${#TEXT},\"wid\":\"$WID\"}"
    ;;

  send-keys)
    # VNC 안의 활성 터미널 창에 유니코드 텍스트를 xdotool 로 직접 type.
    # 브라우저 IME/paste 우회 — 한글 조합 완료 후 이 경로로 xterm 에 주입.
    # Enter 는 누르지 않음 — 사용자가 검토 후 직접 누름.
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    # userNN → DISPLAY :NN (user00=:0, user01=:1, …, user99=:99)
    NUM="${TARGET//[^0-9]/}"
    if [ -z "$NUM" ]; then
      echo "ERROR: cannot derive DISPLAY from username" >&2
      exit 2
    fi
    DISP=":$((10#$NUM))"
    if [ ! -S "/tmp/.X11-unix/X$((10#$NUM))" ]; then
      echo "ERROR: X display $DISP not running" >&2
      exit 3
    fi
    # stdin에서 텍스트 읽기 (최대 32KB)
    TEXT="$(head -c 32768)"
    if [ -z "$TEXT" ]; then
      echo "ERROR: empty text" >&2
      exit 2
    fi
    # xfce4-terminal / xterm 창을 찾아 활성화. 없으면 xfce4-terminal 자동 실행.
    find_terminal() {
      local ids
      ids="$(sudo -u "$TARGET" env DISPLAY="$DISP" xdotool search --onlyvisible --class 'xfce4-terminal|Xfce4-terminal|XTerm|xterm' 2>/dev/null)" || true
      echo "$ids" | tail -1
    }
    WID="$(find_terminal)"
    if [ -z "$WID" ]; then
      # IME 환경 강제 주입 wrapper (sudo가 GTK_IM_MODULE / QT_IM_MODULE 를 날리므로).
      sudo -u "$TARGET" env DISPLAY="$DISP" /usr/local/bin/wb-terminal --maximize &>/dev/null &
      for _ in $(seq 1 20); do
        sleep 0.3
        WID="$(find_terminal)"
        [ -n "$WID" ] && break
      done
    fi
    if [ -n "$WID" ]; then
      sudo -u "$TARGET" env DISPLAY="$DISP" xdotool windowactivate --sync "$WID" 2>/dev/null || true
      sudo -u "$TARGET" env DISPLAY="$DISP" xdotool type --window "$WID" --clearmodifiers --delay 0 -- "$TEXT" 2>/dev/null || {
        echo "ERROR: xdotool type failed" >&2
        exit 4
      }
    else
      echo "ERROR: no terminal window found and could not launch one" >&2
      exit 4
    fi
    echo "{\"ok\":true,\"action\":\"send-keys\",\"user\":\"$TARGET\",\"len\":${#TEXT},\"wid\":\"${WID:-none}\"}"
    ;;

  clean-workspace)
    # 체험(Part 3) 산출물만 삭제 — 실습(Part 4) 파일은 보존
    # 체험 경로: ai-plan-report, ai-plan, check-pii, settings.local.json
    # 실습 경로: my-task, my-cmd, my-check (보존)
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    HOME_DIR="/home/${TARGET}"

    # 체험 전용 파일만 삭제
    rm -f  "${HOME_DIR}/PLAN.md" 2>/dev/null || true
    rm -f  "${HOME_DIR}/CLAUDE.md" 2>/dev/null || true
    rm -f  "${HOME_DIR}/.claude/settings.local.json" 2>/dev/null || true
    rm -rf "${HOME_DIR}/.claude/skills/ai-plan-report" 2>/dev/null || true
    rm -f  "${HOME_DIR}/.claude/commands/ai-plan.md" 2>/dev/null || true
    rm -rf "${HOME_DIR}/.claude/hooks/check-pii.sh" 2>/dev/null || true
    rm -rf "${HOME_DIR}/subagent-mastery" 2>/dev/null || true

    echo "{\"ok\":true,\"action\":\"clean-workspace\",\"user\":\"$TARGET\"}"
    ;;

  capture-scrollback)
    # 사용자 본인 tmux 세션의 스크롤백을 stdout 으로 (plain text).
    # AI 어시스턴트 오버레이가 학습자의 현재 진행 상태를 코칭할 때 사용.
    # 기본 1000 줄 (인자로 변경 가능, 최대 5000).
    TARGET="${2:-}"
    LINES="${3:-1000}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    if ! [[ "$LINES" =~ ^[0-9]+$ ]] || [ "$LINES" -gt 5000 ]; then
      LINES=1000
    fi
    # tmux capture-pane: -p stdout, -S -N scrollback start, -J join wrapped lines
    sudo -u "$TARGET" /usr/bin/tmux -L "$TMUX_LABEL" capture-pane -p -J -S "-${LINES}" -t "$TARGET" 2>/dev/null || {
      echo ""  # 세션 없으면 빈 문자열
      exit 0
    }
    ;;

  save-scrollback)
    # 사용자 터미널 스크롤백을 ~/.terminal-output.txt 로 저장
    TARGET="${2:-}"
    LINES="${3:-500}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2
      exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2
      exit 2
    fi
    if ! [[ "$LINES" =~ ^[0-9]+$ ]] || [ "$LINES" -gt 5000 ]; then
      LINES=500
    fi
    OUTFILE="/home/${TARGET}/.terminal-output.txt"
    sudo -u "$TARGET" /usr/bin/tmux -L "$TMUX_LABEL" capture-pane -p -J -S "-${LINES}" -t "$TARGET" > "$OUTFILE" 2>/dev/null || echo "" > "$OUTFILE"
    chown "${TARGET}:${TARGET}" "$OUTFILE" 2>/dev/null || true
    chmod 644 "$OUTFILE" 2>/dev/null || true
    echo "{\"ok\":true,\"action\":\"save-scrollback\",\"user\":\"$TARGET\",\"file\":\"$OUTFILE\"}"
    ;;

  clean-home)
    # 단일 유저 홈 파일 삭제 (인증/설정만 보존) + .bashrc 복구
    TARGET="${2:-}"
    if [ -z "$TARGET" ] || [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+$ ]]; then
      echo "ERROR: invalid username" >&2; exit 2
    fi
    if ! id "$TARGET" >/dev/null 2>&1; then
      echo "ERROR: user not found: $TARGET" >&2; exit 2
    fi
    H="/home/${TARGET}"

    # xdg-desktop-portal FUSE 마운트 (.cache/doc) 언마운트 — 그대로 두면
    # rm / chown 이 Permission denied 로 실패함. VNC 세션이 살아있어도 안전.
    fusermount3 -u "${H}/.cache/doc" 2>/dev/null || \
      sudo -u "$TARGET" fusermount3 -u "${H}/.cache/doc" 2>/dev/null || true

    TMP_BAK="/tmp/mirae-clean-${TARGET}-$$"
    mkdir -p "$TMP_BAK"
    [ -f "${H}/.claude/.credentials.json" ] && cp "${H}/.claude/.credentials.json" "$TMP_BAK/cred.json"
    [ -f "${H}/.claude/settings.json" ] && cp "${H}/.claude/settings.json" "$TMP_BAK/settings.json"
    [ -f "${H}/.claude.json" ] && cp "${H}/.claude.json" "$TMP_BAK/claude.json"
    [ -f "${H}/.claude/CLAUDE.md" ] && cp "${H}/.claude/CLAUDE.md" "$TMP_BAK/global-claude.md"
    # VNC 세션 설정 보존
    [ -d "${H}/.vnc" ] && cp -a "${H}/.vnc" "$TMP_BAK/vnc" 2>/dev/null || true

    rm -rf "${H}"/* "${H}"/.[!.]* "${H}"/..?* 2>/dev/null || true

    mkdir -p "${H}/.claude"
    [ -f "$TMP_BAK/cred.json" ] && cp "$TMP_BAK/cred.json" "${H}/.claude/.credentials.json"
    [ -f "$TMP_BAK/settings.json" ] && cp "$TMP_BAK/settings.json" "${H}/.claude/settings.json"
    [ -f "$TMP_BAK/claude.json" ] && cp "$TMP_BAK/claude.json" "${H}/.claude.json"
    [ -f "$TMP_BAK/global-claude.md" ] && cp "$TMP_BAK/global-claude.md" "${H}/.claude/CLAUDE.md"
    [ -d "$TMP_BAK/vnc" ] && cp -a "$TMP_BAK/vnc" "${H}/.vnc"
    rm -rf "$TMP_BAK"

    cp /etc/skel/.bashrc "${H}/.bashrc" 2>/dev/null || true
    cat >> "${H}/.bashrc" <<'WBBASHRC'

# ── Mirae Workbook ─────────────────────────────
claude-short() { CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096  command claude "$@"; }
claude-long()  { CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768 command claude "$@"; }
export -f claude-short claude-long 2>/dev/null || true
if [ -t 1 ] && [ -z "$WORKBOOK_GREETED" ]; then
  export WORKBOOK_GREETED=1
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""; echo "🔐 claude 입력 후 /login 으로 시작하세요"; echo ""
  else
    echo ""; echo "🤖 Claude Code 준비 완료."; echo "   체험: claude   실습: claude-long"; echo ""
  fi
fi
WBBASHRC
    cp /etc/skel/.profile "${H}/.profile" 2>/dev/null || true
    cp /etc/skel/.bash_logout "${H}/.bash_logout" 2>/dev/null || true
    : > "${H}/.bash_history"

    chown -R "${TARGET}:${TARGET}" "${H}"
    chgrp workbook-readers "${H}"
    chmod 750 "${H}"
    if command -v setfacl >/dev/null 2>&1; then
      setfacl -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
      setfacl -d -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
      setfacl -R -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
    fi
    echo "{\"ok\":true,\"action\":\"clean-home\",\"user\":\"$TARGET\"}"
    ;;

  clean-all-homes)
    # 전체 유저 홈 파일 삭제 (인증/설정만 보존) + .bashrc 복구
    USER_COUNT="$(resolve_user_count "${2:-}")"
    COUNT=0
    for i in $(seq -w 0 "$USER_COUNT"; echo 99); do
      U="${USER_PREFIX}${i}"
      H="/home/${U}"
      id "$U" >/dev/null 2>&1 || continue

      # xdg-desktop-portal FUSE 마운트(.cache/doc) 언마운트 — VNC 세션이 살아있는
      # 상태로 clean-all-homes 를 호출하면 chown/rm 이 Permission denied 로 죽음.
      fusermount3 -u "${H}/.cache/doc" 2>/dev/null || \
        sudo -u "$U" fusermount3 -u "${H}/.cache/doc" 2>/dev/null || true

      # 인증 백업 (임시 파일로 — JSON 특수문자 보존)
      TMP_BAK="/tmp/mirae-clean-${U}-$$"
      mkdir -p "$TMP_BAK"
      [ -f "${H}/.claude/.credentials.json" ] && cp "${H}/.claude/.credentials.json" "$TMP_BAK/cred.json"
      [ -f "${H}/.claude/settings.json" ] && cp "${H}/.claude/settings.json" "$TMP_BAK/settings.json"
      [ -f "${H}/.claude.json" ] && cp "${H}/.claude.json" "$TMP_BAK/claude.json"
      [ -f "${H}/.claude/CLAUDE.md" ] && cp "${H}/.claude/CLAUDE.md" "$TMP_BAK/global-claude.md"
      # VNC 세션 설정 보존
      [ -d "${H}/.vnc" ] && cp -a "${H}/.vnc" "$TMP_BAK/vnc" 2>/dev/null || true

      # 전부 삭제
      rm -rf "${H}"/* "${H}"/.[!.]* "${H}"/..?* 2>/dev/null || true

      # 복원
      mkdir -p "${H}/.claude"
      [ -f "$TMP_BAK/cred.json" ] && cp "$TMP_BAK/cred.json" "${H}/.claude/.credentials.json"
      [ -f "$TMP_BAK/settings.json" ] && cp "$TMP_BAK/settings.json" "${H}/.claude/settings.json"
      [ -f "$TMP_BAK/claude.json" ] && cp "$TMP_BAK/claude.json" "${H}/.claude.json"
      [ -f "$TMP_BAK/global-claude.md" ] && cp "$TMP_BAK/global-claude.md" "${H}/.claude/CLAUDE.md"
      [ -d "$TMP_BAK/vnc" ] && cp -a "$TMP_BAK/vnc" "${H}/.vnc"
      rm -rf "$TMP_BAK"

      # .bashrc 복구
      cp /etc/skel/.bashrc "${H}/.bashrc" 2>/dev/null || true
      cat >> "${H}/.bashrc" <<'WBBASHRC'

# ── Mirae Workbook ─────────────────────────────
claude-short() { CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096  command claude "$@"; }
claude-long()  { CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768 command claude "$@"; }
export -f claude-short claude-long 2>/dev/null || true
if [ -t 1 ] && [ -z "$WORKBOOK_GREETED" ]; then
  export WORKBOOK_GREETED=1
  if [ ! -f "$HOME/.claude/.credentials.json" ]; then
    echo ""; echo "🔐 claude 입력 후 /login 으로 시작하세요"; echo ""
  else
    echo ""; echo "🤖 Claude Code 준비 완료."; echo "   체험: claude   실습: claude-long"; echo ""
  fi
fi
WBBASHRC
      cp /etc/skel/.profile "${H}/.profile" 2>/dev/null || true
      cp /etc/skel/.bash_logout "${H}/.bash_logout" 2>/dev/null || true
      : > "${H}/.bash_history"

      # 소유권 + ACL
      chown -R "${U}:${U}" "${H}"
      chgrp workbook-readers "${H}"
      chmod 750 "${H}"
      if command -v setfacl >/dev/null 2>&1; then
        setfacl -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
        setfacl -d -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
        setfacl -R -m g:workbook-readers:rX "${H}" "${H}/.claude" 2>/dev/null || true
      fi

      COUNT=$((COUNT + 1))
    done
    echo "{\"ok\":true,\"action\":\"clean-all-homes\",\"count\":$COUNT}"
    ;;

  save-key)
    SLOT="${2:-}"
    if [[ ! "$SLOT" =~ ^[ab]$ ]]; then
      echo "ERROR: slot must be 'a' or 'b'" >&2
      exit 2
    fi
    save_key_to_slot "$SLOT"
    ;;

  refresh-from-operator)
    # user00 의 /home/user00/.claude/.credentials.json + /home/user00/.claude.json 을
    # user01..userNN 에 복사. 운영자가 user00 VNC 에서 `claude /login` 한 뒤 이 액션 호출.
    # arg $2: 숫자면 전체 루프(USER_COUNT), userNN 이면 단일 유저.
    SRC_CRED="/home/user00/.claude/.credentials.json"
    SRC_CFG="/home/user00/.claude.json"
    if [ ! -f "$SRC_CRED" ]; then
      echo "ERROR: $SRC_CRED 없음 — user00 에서 claude /login 먼저" >&2
      exit 3
    fi
    # claude /login 이 600 으로 생성하므로 API 서버(workbook-readers)가 읽을 수 있게 ACL 복원
    setfacl -m g:workbook-readers:r,mask::r "$SRC_CRED" 2>/dev/null || true
    setfacl -d -m g:workbook-readers:r /home/user00/.claude 2>/dev/null || true

    SINGLE_USER=""
    if [ -n "${2:-}" ] && [[ "$2" =~ ^${USER_PREFIX}[0-9]+$ ]]; then
      SINGLE_USER="$2"
    else
      USER_COUNT="$(resolve_user_count "${2:-}")"
    fi

    if [ -n "$SINGLE_USER" ]; then
      USER_LIST="$SINGLE_USER"
    else
      USER_LIST=""
      for i in $(seq -w 1 "$USER_COUNT"; echo 99); do
        USER_LIST="$USER_LIST ${USER_PREFIX}${i}"
      done
    fi

    COPIED=0
    SKIPPED=0
    for USERNAME in $USER_LIST; do
      if [ "$USERNAME" = "user00" ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
      fi
      if ! id "$USERNAME" >/dev/null 2>&1; then
        SKIPPED=$((SKIPPED + 1))
        continue
      fi
      TARGET_DIR="/home/${USERNAME}/.claude"
      TARGET_CRED="$TARGET_DIR/.credentials.json"
      TARGET_CFG="/home/${USERNAME}/.claude.json"
      mkdir -p "$TARGET_DIR"
      cp "$SRC_CRED" "$TARGET_CRED"

      # .claude.json 는 있으면 머지, 없으면 새로 씀
      if [ -f "$SRC_CFG" ]; then
        SRC_CFG="$SRC_CFG" DST_CFG="$TARGET_CFG" /usr/bin/node -e '
          const fs = require("fs");
          const src = JSON.parse(fs.readFileSync(process.env.SRC_CFG, "utf8"));
          let dst = {};
          try { dst = JSON.parse(fs.readFileSync(process.env.DST_CFG, "utf8")); } catch {}
          const KEYS = ["userID","oauthAccount","hasCompletedOnboarding","lastOnboardingVersion","subscriptionNoticeCount","claudeCodeFirstTokenDate"];
          for (const k of KEYS) {
            if (src[k] !== undefined) dst[k] = src[k];
          }
          fs.writeFileSync(process.env.DST_CFG, JSON.stringify(dst, null, 2));
        '
      fi

      chown -R "${USERNAME}:${USERNAME}" "$TARGET_DIR"
      [ -f "$TARGET_CFG" ] && chown "${USERNAME}:${USERNAME}" "$TARGET_CFG"
      chgrp workbook-readers "$TARGET_DIR" "$TARGET_CRED" "$TARGET_CFG" 2>/dev/null || true
      chmod 750 "$TARGET_DIR"
      chmod 640 "$TARGET_CRED"
      [ -f "$TARGET_CFG" ] && chmod 640 "$TARGET_CFG"
      COPIED=$((COPIED + 1))
    done

    if [ -n "$SINGLE_USER" ]; then
      echo "{\"ok\":true,\"action\":\"refresh-from-operator\",\"user\":\"$SINGLE_USER\",\"copied\":$COPIED,\"skipped\":$SKIPPED}"
    else
      echo "{\"ok\":true,\"action\":\"refresh-from-operator\",\"copied\":$COPIED,\"skipped\":$SKIPPED}"
    fi
    ;;

  claude-usage)
    # 운영자(lsc) 권한으로 `claude /usage` 슬래시 커맨드 실행 후 출력을 stdout으로 그대로.
    # 백엔드(server.js)가 stdout 텍스트를 JSON으로 감싸서 클라이언트에 전달.
    # 슬래시 커맨드는 인터랙티브 모드에서만 동작 — stdin으로 명령 + /exit 전송
    OPERATOR="${OPERATOR_USER:-lsc}"
    if ! id "$OPERATOR" >/dev/null 2>&1; then
      echo "ERROR: operator user '$OPERATOR' not found" >&2
      exit 3
    fi
    sudo -u "$OPERATOR" -H bash -c "cd ~ && (printf '/usage\n'; sleep 2; printf '/exit\n') | timeout 10 claude 2>&1" || true
    ;;

  *)
    echo "ERROR: unknown action '$ACTION'" >&2
    echo "usage: $0 {refresh-creds|reset-sessions|reset-session|vnc-status|vnc-recover|vnc-reset-user|vnc-restart-all} [arg]" >&2
    exit 2
    ;;
esac
