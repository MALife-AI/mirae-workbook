#!/bin/bash
# coach.sh
# AI 어시스턴트 오버레이용 짧은 코칭 호출.
# grade-mission.sh 의 사촌. 차이:
#   - JSON 스키마 작아짐 (status/hint/nextStep)
#   - 채점 점수 없음 (실시간 코칭이라 짧고 가벼운 응답)
#   - 30초 타임아웃 (실시간 사용)
#   - 출력 토큰 1024 만 (말풍선이라 짧게)
#
# 호출 관례 (server.js 가 사용):
#   sudo -u userXX -H -- /opt/mirae-workbook-api/coach.sh <prompt-file>
#
# 출력: claude --output-format=json envelope 그대로 stdout 으로.

set -euo pipefail

PROMPT_FILE="${1:-}"

if [ -z "$PROMPT_FILE" ]; then
  echo "usage: $0 <prompt-file>" >&2
  exit 2
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: prompt file not found" >&2
  exit 2
fi

PROMPT_SIZE=$(stat -c%s "$PROMPT_FILE" 2>/dev/null || echo 0)
if [ "$PROMPT_SIZE" -gt 32768 ]; then
  echo "ERROR: prompt too large ($PROMPT_SIZE > 32KB)" >&2
  exit 2
fi

PROMPT="$(cat "$PROMPT_FILE")"

# 학습자 본인 셸 환경에서 claude 실행. PATH 보강.
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"
export HOME="/home/$(id -un)"
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=1024
export MAX_THINKING_TOKENS=0

# 질문-답변 스키마
SCHEMA='{
  "type": "object",
  "properties": {
    "answer": { "type": "string", "maxLength": 500 }
  },
  "required": ["answer"]
}'

# 30초 타임아웃 + 도구 차단.
exec timeout 30 claude \
  -p \
  --output-format=json \
  --json-schema "$SCHEMA" \
  --disallowedTools "Bash Write Edit Glob Grep Read WebFetch WebSearch" \
  --append-system-prompt "당신은 워크숍 학습자 옆에 앉은 친절한 도우미입니다. 학습자가 미션에 대해 질문합니다. 한국어로 짧고 친절하게 답하세요. 3문장 이내, 핵심만. 결과 JSON만 출력." \
  "$PROMPT" < /dev/null
