#!/bin/bash
# mock-coach.sh — coach.sh 흉내. claude -p 호출 없이 캔드 JSON 응답.

PROMPT_FILE="${1:-}"
if [ -z "$PROMPT_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: prompt file required" >&2
  exit 2
fi

# claude --output-format=json envelope: { type, result }
# result 안에 우리 schema JSON 이 들어감
RESULT_JSON='{"status":"good","hint":"잘 진행되고 있어요. 조금만 더 가면 PLAN.md가 완성됩니다.","nextStep":"파일을 저장해달라고 한 번 더 요청해보세요"}'
ENV_JSON=$(cat <<EOF
{"type":"result","subtype":"success","is_error":false,"duration_ms":100,"result":$(echo "$RESULT_JSON" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")}
EOF
)
echo "$ENV_JSON"
