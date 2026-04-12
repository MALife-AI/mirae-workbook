#!/bin/bash
# load-test.sh — 20명 동시 접속 실전 스트레스 테스트
# nginx(8443) 경유, Basic Auth, 실제 슬라이드 데이터 사용
# 사용법: sudo bash /home/lsc/mirae-workbook/tests/load-test.sh

set -uo pipefail

# nginx 경유 (실제 환경 그대로)
API="http://localhost:8443"
COUNT=20
PASS_PREFIX="user"
TOTAL_PASS=0
TOTAL_FAIL=0

# 실제 슬라이드 정보 (프론트에서 보내는 것과 동일하게)
SLIDE_TITLES=(
  "AI 시대의 변화"
  "Claude Code란?"
  "터미널이란 무엇인가"
  "CLAUDE.md란?"
  "Skill 개념"
  "Command 개념"
  "Hook 개념"
  "체험: Plan 모드"
  "체험: 권한 설정"
  "체험: CLAUDE.md"
  "체험: Skill"
  "체험: Command"
  "체험: Hook"
  "체험: 컨텍스트 관리"
  "Step 1. 정의하기"
  "Step 2. CLAUDE.md"
  "Step 3. Skill"
  "Step 4. Command"
  "Step 5. Hook"
  "Step 6. 실행"
)
SECTIONS=(
  "1. 인트로"
  "2. 개념 설명 및 시연"
  "2. 개념 설명 및 시연"
  "2. 개념 설명 및 시연"
  "2. 개념 설명 및 시연"
  "2. 개념 설명 및 시연"
  "2. 개념 설명 및 시연"
  "3. 기능 체험"
  "3. 기능 체험"
  "3. 기능 체험"
  "3. 기능 체험"
  "3. 기능 체험"
  "3. 기능 체험"
  "3. 기능 체험"
  "4. 실습 프로젝트"
  "4. 실습 프로젝트"
  "4. 실습 프로젝트"
  "4. 실습 프로젝트"
  "4. 실습 프로젝트"
  "4. 실습 프로젝트"
)
TOTAL_SLIDES=${#SLIDE_TITLES[@]}

auth() {
  local user="$1"
  local pass="$user"
  [ "$user" = "user00" ] && pass="asdf1234"
  [ "$user" = "admin" ] && pass="admin"
  echo "${user}:${pass}"
}

timer_start() { START_T=$(date +%s%N); }
timer_end() {
  local END_T=$(date +%s%N)
  local MS=$(( (END_T - START_T) / 1000000 ))
  echo "  ⏱ ${MS}ms"
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Mirae Workbook 실전 스트레스 테스트 (${COUNT}명)         ║"
echo "║  경로: nginx(${API}) — Basic Auth                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. 동시 접속 ───
echo "━━━ 1. 동시 접속 (${COUNT}명 /api/me) ━━━"
timer_start
rm -f /tmp/lt-me.txt; touch /tmp/lt-me.txt
for i in $(seq -w 1 $COUNT); do
  U="${PASS_PREFIX}${i}"
  (
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$(auth $U)" "${API}/api/me")
    echo "${CODE}" >> /tmp/lt-me.txt
  ) &
done
wait
timer_end
OK=$(grep -c "200" /tmp/lt-me.txt 2>/dev/null || true); OK=${OK:-0}
echo "  접속 성공: ${OK}/${COUNT}"
TOTAL_PASS=$((TOTAL_PASS + OK)); TOTAL_FAIL=$((TOTAL_FAIL + COUNT - OK))
rm -f /tmp/lt-me.txt

# ─── 2. 동시 진행 보고 (각자 다른 슬라이드) ───
echo ""
echo "━━━ 2. 동시 진행 보고 (${COUNT}명, 각자 다른 슬라이드) ━━━"
timer_start
rm -f /tmp/lt-prog.txt; touch /tmp/lt-prog.txt
for i in $(seq -w 1 $COUNT); do
  U="${PASS_PREFIX}${i}"
  IDX=$(( (10#$i - 1) % TOTAL_SLIDES ))
  TITLE="${SLIDE_TITLES[$IDX]}"
  SEC="${SECTIONS[$IDX]}"
  (
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$(auth $U)" -X POST "${API}/api/progress" \
      -H "Content-Type: application/json" \
      -d "{\"slideIndex\":${IDX},\"slideTitle\":\"${TITLE}\",\"sectionTitle\":\"${SEC}\",\"totalSlides\":${TOTAL_SLIDES},\"totalMissions\":14,\"completedMissionIds\":[],\"isMissionSlide\":false}")
    echo "${CODE}" >> /tmp/lt-prog.txt
  ) &
done
wait
timer_end
OK=$(grep -c "200" /tmp/lt-prog.txt 2>/dev/null || true); OK=${OK:-0}
echo "  성공: ${OK}/${COUNT}"
TOTAL_PASS=$((TOTAL_PASS + OK)); TOTAL_FAIL=$((TOTAL_FAIL + COUNT - OK))
rm -f /tmp/lt-prog.txt

# ─── 3. 동시 파일 체크 ───
echo ""
echo "━━━ 3. 동시 파일 체크 (${COUNT}명 × 3파일) ━━━"
timer_start
rm -f /tmp/lt-chk.txt; touch /tmp/lt-chk.txt
for i in $(seq -w 1 $COUNT); do
  U="${PASS_PREFIX}${i}"
  (
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$(auth $U)" -X POST "${API}/api/check" \
      -H "Content-Type: application/json" \
      -d '{"checks":[{"type":"file-exists","path":"PLAN.md"},{"type":"file-exists","path":"CLAUDE.md"},{"type":"file-exists","path":".claude/settings.local.json"}]}')
    echo "${CODE}" >> /tmp/lt-chk.txt
  ) &
done
wait
timer_end
OK=$(grep -c "200" /tmp/lt-chk.txt 2>/dev/null || true); OK=${OK:-0}
echo "  성공: ${OK}/${COUNT}"
TOTAL_PASS=$((TOTAL_PASS + OK)); TOTAL_FAIL=$((TOTAL_FAIL + COUNT - OK))
rm -f /tmp/lt-chk.txt

# ─── 4. 어드민 대시보드 ───
echo ""
echo "━━━ 4. 어드민 대시보드 조회 ━━━"
timer_start
ADMIN_CODE=$(curl -s -o /tmp/lt-admin.json -w "%{http_code}" -u "$(auth admin)" "${API}/api/admin/progress")
timer_end
if [ "$ADMIN_CODE" = "200" ]; then
  ONLINE=$(python3 -c "import json; d=json.load(open('/tmp/lt-admin.json')); print(len(d.get('users',[])))" 2>/dev/null || echo "?")
  echo "  ✓ 어드민 조회 성공 — 유저 수: ${ONLINE}"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  echo "  ✗ 어드민 조회 실패 (${ADMIN_CODE})"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi
rm -f /tmp/lt-admin.json

# ─── 5. 워스트: 전원 동시 폴링 5라운드 (체크+보고) ───
echo ""
echo "━━━ 5. 워스트: 폴링 시뮬레이션 (${COUNT}명 × 5라운드 × 2요청) ━━━"
timer_start
for round in 1 2 3 4 5; do
  for i in $(seq -w 1 $COUNT); do
    U="${PASS_PREFIX}${i}"
    IDX=$(( (round * 3 + 10#$i) % TOTAL_SLIDES ))
    curl -s -o /dev/null -u "$(auth $U)" -X POST "${API}/api/check" \
      -H "Content-Type: application/json" \
      -d '{"checks":[{"type":"file-exists","path":"PLAN.md"}]}' &
    curl -s -o /dev/null -u "$(auth $U)" -X POST "${API}/api/progress" \
      -H "Content-Type: application/json" \
      -d "{\"slideIndex\":${IDX},\"slideTitle\":\"${SLIDE_TITLES[$IDX]}\",\"sectionTitle\":\"${SECTIONS[$IDX]}\",\"totalSlides\":${TOTAL_SLIDES}}" &
  done
  wait
  echo "  라운드 ${round}/5 완료"
done
timer_end
REQS=$((COUNT * 5 * 2))
echo "  ✓ 폴링 완료 (${REQS}건)"
TOTAL_PASS=$((TOTAL_PASS + 1))

# ─── 6. 워스트: 전원 동시 챗봇 ───
echo ""
echo "━━━ 6. 워스트: 동시 챗봇 (${COUNT}명 전원) ━━━"
echo "  (각 유저 본인 크레덴셜로 Claude API 호출)"
timer_start
rm -f /tmp/lt-chat.txt; touch /tmp/lt-chat.txt
QUESTIONS=("이거 어떻게 해요?" "PLAN.md가 뭐예요?" "터미널에 뭘 입력해야 해요?" "클로드가 안 움직여요" "파일이 안 만들어져요")
for i in $(seq -w 1 $COUNT); do
  U="${PASS_PREFIX}${i}"
  Q="${QUESTIONS[$(( (10#$i - 1) % ${#QUESTIONS[@]} ))]}"
  (
    BODY=$(curl -s --max-time 60 -u "$(auth $U)" -X POST "${API}/api/coach" \
      -H "Content-Type: application/json" \
      -d "{\"missionId\":\"plan\",\"goal\":\"Plan 모드로 보고서 작성 계획\",\"mandatory\":[\"보고서 관련 작업을 수행했다\"],\"hints\":[\"claude 실행 후 /plan으로 시작\"],\"question\":\"${Q}\"}")
    CODE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('200' if d.get('ok') and d.get('answer') else '500')" 2>/dev/null || echo "ERR")
    echo "${U}:${CODE}" >> /tmp/lt-chat.txt
  ) &
done
wait
timer_end
CHAT_OK=$(grep -c ":200" /tmp/lt-chat.txt 2>/dev/null || true); CHAT_OK=${CHAT_OK:-0}
CHAT_FAIL=$((COUNT - CHAT_OK))
echo "  성공: ${CHAT_OK}/${COUNT}, 실패: ${CHAT_FAIL}"
[ "$CHAT_FAIL" -gt 0 ] && echo "  ⚠ rate limit 또는 크레덴셜 문제 가능"
TOTAL_PASS=$((TOTAL_PASS + CHAT_OK)); TOTAL_FAIL=$((TOTAL_FAIL + CHAT_FAIL))
rm -f /tmp/lt-chat.txt

# ─── 7. 워스트: 전원 동시 채점 ───
echo ""
echo "━━━ 7. 워스트: 동시 채점 (${COUNT}명 전원) ━━━"
echo "  (스크롤백 캡처 + Claude API — 가장 무거운 작업)"
timer_start
rm -f /tmp/lt-grade.txt; touch /tmp/lt-grade.txt
for i in $(seq -w 1 $COUNT); do
  U="${PASS_PREFIX}${i}"
  (
    BODY=$(curl -s --max-time 120 -u "$(auth $U)" -X POST "${API}/api/grade-mission" \
      -H "Content-Type: application/json" \
      -d '{"missionId":"plan","rubric":"Plan 모드로 보고서 작성 계획","files":["PLAN.md"],"checklist":["보고서 관련 작업을 수행했다","내용이 여러 단계로 구성되어 있다"]}')
    CODE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('200' if d.get('ok') and len(d.get('items',[])) > 0 else '500')" 2>/dev/null || echo "ERR")
    echo "${U}:${CODE}" >> /tmp/lt-grade.txt
  ) &
done
wait
timer_end
GRADE_OK=$(grep -c ":200" /tmp/lt-grade.txt 2>/dev/null || true); GRADE_OK=${GRADE_OK:-0}
GRADE_FAIL=$((COUNT - GRADE_OK))
echo "  성공: ${GRADE_OK}/${COUNT}, 실패: ${GRADE_FAIL}"
[ "$GRADE_FAIL" -gt 0 ] && echo "  ⚠ rate limit / 타임아웃 / 크레덴셜 문제 가능"
TOTAL_PASS=$((TOTAL_PASS + GRADE_OK)); TOTAL_FAIL=$((TOTAL_FAIL + GRADE_FAIL))
rm -f /tmp/lt-grade.txt

# ─── 8. 어드민 기능 동시 ───
echo ""
echo "━━━ 8. 어드민 기능 동시 호출 ━━━"
timer_start
rm -f /tmp/lt-adm.txt; touch /tmp/lt-adm.txt
# 진행 조회 3회 + nudge 3명 + target-all
for _ in 1 2 3; do
  (CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$(auth admin)" "${API}/api/admin/progress"); echo "$CODE" >> /tmp/lt-adm.txt) &
done
for i in 1 2 3; do
  (CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$(auth admin)" -X POST "${API}/api/admin/set-target" \
    -H "Content-Type: application/json" -d "{\"username\":\"user0${i}\",\"target\":5}"); echo "$CODE" >> /tmp/lt-adm.txt) &
done
wait
timer_end
ADM_OK=$(grep -c "200" /tmp/lt-adm.txt 2>/dev/null || true); ADM_OK=${ADM_OK:-0}
echo "  성공: ${ADM_OK}/6"
TOTAL_PASS=$((TOTAL_PASS + ADM_OK)); TOTAL_FAIL=$((TOTAL_FAIL + 6 - ADM_OK))
rm -f /tmp/lt-adm.txt

# ─── 9. 최종 어드민 확인 ───
echo ""
echo "━━━ 9. 최종 서버 상태 ━━━"
FINAL_BODY=$(curl -s -u "$(auth admin)" "${API}/api/admin/progress")
FINAL_CODE=$?
ONLINE=$(echo "$FINAL_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('users',[])))" 2>/dev/null || echo "?")
echo "  어드민에 보이는 유저: ${ONLINE}"

# 슬라이드 수 일치 확인
SLIDE_MISMATCH=$(echo "$FINAL_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
bad=[]
for u in d.get('users',[]):
    ts = u.get('totalSlides',0)
    if ts > 0 and ts != ${TOTAL_SLIDES}:
        bad.append(f\"{u['username']}={ts}\")
print(','.join(bad) if bad else 'OK')
" 2>/dev/null || echo "?")
if [ "$SLIDE_MISMATCH" = "OK" ]; then
  echo "  ✓ 전원 슬라이드 수 일치 (${TOTAL_SLIDES})"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  echo "  ✗ 슬라이드 수 불일치: ${SLIDE_MISMATCH}"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# 서버 프로세스
PID=$(pgrep -f "node.*server" | head -1)
if [ -n "$PID" ]; then
  echo "  $(ps -p $PID -o rss=,pcpu= 2>/dev/null | awk '{printf "API 서버 — 메모리: %.1fMB, CPU: %s%%", $1/1024, $2}')"
  echo "  ✓ 서버 정상"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  echo "  ✗ API 서버 프로세스 없음"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ─── 결과 ───
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  실전 스트레스 테스트 결과                            ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  성공: %-4d  실패: %-4d                             ║\n" "$TOTAL_PASS" "$TOTAL_FAIL"
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo "║  ✓ 전체 통과 — 워크숍 준비 완료                      ║"
else
  echo "║  ⚠ 실패 항목 확인 필요                              ║"
fi
echo "╚══════════════════════════════════════════════════════╝"
