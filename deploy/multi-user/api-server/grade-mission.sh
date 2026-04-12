#!/bin/bash
# grade-mission.sh
# 백엔드(workbook-api)가 sudo로 사용자 권한으로 호출하는 AI 채점 wrapper.
#
# 호출 관례 (server.js 가 사용):
#   sudo -u userXX -H -- /opt/mirae-workbook-api/grade-mission.sh
#       <schema-file> <prompt-file>
#
# - schema-file : json schema (claude --json-schema 인자)
# - prompt-file : 사용자 프롬프트 텍스트 (claude -p 의 마지막 위치 인자)
# 두 파일 모두 /tmp 에서 백엔드가 만든 임시 파일이며, 우리는 읽기만 한다.
#
# 출력: stdout 으로 claude --output-format=json envelope 그대로.
# 안전장치:
#   - 무조건 자기(=학습자) 권한으로 실행
#   - 60초 타임아웃
#   - --bare 모드: hooks / CLAUDE.md 자동 로딩 끔 → 학습자 환경 영향 없음
#   - 모든 출력 도구 비허용 (--disallowedTools 로 Write/Edit/Bash 차단)
#   - 메모리 끄고, 서브에이전트 끄고, MCP 끄기

set -euo pipefail

SCHEMA_FILE="${1:-}"
PROMPT_FILE="${2:-}"

if [ -z "$SCHEMA_FILE" ] || [ -z "$PROMPT_FILE" ]; then
  echo "usage: $0 <schema-file> <prompt-file>" >&2
  exit 2
fi

if [ ! -f "$SCHEMA_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: schema or prompt file not found" >&2
  exit 2
fi

# 사이즈 상한
SCHEMA_SIZE=$(stat -c%s "$SCHEMA_FILE" 2>/dev/null || echo 0)
PROMPT_SIZE=$(stat -c%s "$PROMPT_FILE" 2>/dev/null || echo 0)
if [ "$SCHEMA_SIZE" -gt 8192 ]; then
  echo "ERROR: schema too large ($SCHEMA_SIZE > 8KB)" >&2
  exit 2
fi
if [ "$PROMPT_SIZE" -gt 65536 ]; then
  echo "ERROR: prompt too large ($PROMPT_SIZE > 64KB)" >&2
  exit 2
fi

SCHEMA="$(cat "$SCHEMA_FILE")"
PROMPT="$(cat "$PROMPT_FILE")"

# 학습자 본인 셸 환경에서 claude 실행. PATH 보강.
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"
export HOME="/home/$(id -un)"
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096
export MAX_THINKING_TOKENS=0

# 60초 타임아웃 + 채점에 필요 없는 모든 도구 차단.
# claude 는 자체 settings.json 의 모델(sonnet) 사용.
# < /dev/null 필수: claude -p 가 stdin 을 기다려서 3s warning 후 비정상 종료하는 문제 방지.
exec timeout 60 claude \
  -p \
  --output-format=json \
  --json-schema "$SCHEMA" \
  --disallowedTools "Bash Write Edit Glob Grep Read WebFetch WebSearch" \
  --append-system-prompt "당신은 워크숍 미션 채점관입니다. 사고 과정 노출 금지. 결과 JSON 만 출력. 한국어로 친절하게 피드백." \
  "$PROMPT" < /dev/null
