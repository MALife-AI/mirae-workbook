#!/bin/bash
# mock-grade-mission.sh — grade-mission.sh 흉내. claude -p 호출 없이 캔드 JSON.

SCHEMA_FILE="${1:-}"
PROMPT_FILE="${2:-}"

if [ -z "$SCHEMA_FILE" ] || [ -z "$PROMPT_FILE" ]; then
  echo "ERROR: schema and prompt file required" >&2
  exit 2
fi
if [ ! -f "$SCHEMA_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: file not found" >&2
  exit 2
fi

# 캔드 채점 결과
RESULT_JSON='{"score":85,"passed":true,"summary":"잘 작성된 PLAN.md 입니다. 단계가 명확합니다.","items":[{"name":"PLAN.md 파일이 프로젝트 루트에 생성되었다","ok":true,"comment":"확인됨"},{"name":"보고서 생성 단계가 3개 이상 있다","ok":true,"comment":"5단계 명시"},{"name":"각 단계가 무엇을 하는지 한국어로 설명되어 있다","ok":true,"comment":"한국어 설명 포함"}]}'
ENV_JSON=$(cat <<EOF
{"type":"result","subtype":"success","is_error":false,"duration_ms":150,"result":$(echo "$RESULT_JSON" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")}
EOF
)
echo "$ENV_JSON"
