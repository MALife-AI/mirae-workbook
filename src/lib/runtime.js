// runtime.js — Tauri/Web dual-mode adapter
//
// 이 모듈은 워크북이 Tauri 데스크톱 앱과 웹 브라우저 양쪽에서 동작하도록
// 모든 환경별 분기를 한 곳에 모은다. 컴포넌트 코드는 이 모듈만 import하면 된다.
//
// - Tauri 모드: @tauri-apps/api/core의 invoke()로 Rust 백엔드 호출
// - Web 모드:   nginx 뒤의 Node.js Express 백엔드(/api/*)로 fetch
//
// 새로운 호출이 필요하면 여기 함수를 추가하고, 양쪽 구현을 모두 제공할 것.

// ─────────────────────────────────────────────────────────────
// 클립보드 — HTTP(non-secure) 컨텍스트에서도 동작하는 폴백 포함
// ─────────────────────────────────────────────────────────────
//
// navigator.clipboard 는 secure context (HTTPS / localhost) 에서만 노출되므로
// HTTP로 외부 접속하면 navigator.clipboard 자체가 undefined 다. 워크숍은 사내
// HTTP 운영이 흔하므로 document.execCommand("copy") 로 폴백한다.

export function copyToClipboard(text) {
  if (text == null) return false;
  // 1) 최신 비동기 API (HTTPS / localhost)
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text)).catch(() => {});
      return true;
    }
  } catch {}
  // 2) 폴백: 임시 textarea + execCommand("copy")
  try {
    const ta = document.createElement("textarea");
    ta.value = String(text);
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 환경 감지
// ─────────────────────────────────────────────────────────────

export function isTauri() {
  return (
    typeof window !== "undefined" &&
    (window.__TAURI__ || window.__TAURI_INTERNALS__)
  );
}

export function isWeb() {
  return !isTauri();
}

// 내부: Tauri invoke 동적 로더 (웹 빌드에서 dead-code-elimination 되도록)
async function tauriInvoke(cmd, args) {
  if (!isTauri()) throw new Error("Not Tauri");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

// 내부: 웹 백엔드 fetch 헬퍼
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// 사용자 정보
// ─────────────────────────────────────────────────────────────

let _cachedUser = null;

export async function getCurrentUser() {
  if (_cachedUser) return _cachedUser;
  if (isTauri()) {
    // Tauri 모드: 사용자명은 의미가 약함 — OS 사용자명 또는 단순 placeholder
    try {
      const home = await tauriInvoke("run_shell", { command: "echo $USER" });
      _cachedUser = { username: home.trim() || "local" };
    } catch {
      _cachedUser = { username: "local" };
    }
  } else {
    try {
      const data = await apiFetch("/api/me");
      _cachedUser = { username: data.username || "" };
    } catch {
      _cachedUser = { username: "" };
    }
  }
  return _cachedUser;
}

// ─────────────────────────────────────────────────────────────
// 미션 자동검증 (5가지 check type)
// ─────────────────────────────────────────────────────────────
//
// autoChecks 스키마 (MissionSlide.jsx와 동일):
//   { type: "file-exists",     path: string }
//   { type: "any-exists",      paths: string[] }
//   { type: "file-contains",   path: string,    keyword: string }
//   { type: "any-contains",    paths: string[], keyword: string }
//   { type: "global-contains", keyword: string }       // ~/.claude.json 검색
//
// 반환: boolean[] (autoChecks와 같은 길이)

export async function runMissionChecks(autoChecks) {
  if (!autoChecks || autoChecks.length === 0) return [];
  if (isTauri()) return runMissionChecksTauri(autoChecks);
  return runMissionChecksWeb(autoChecks);
}

async function runMissionChecksTauri(autoChecks) {
  return Promise.all(
    autoChecks.map(async (check) => {
      try {
        if (check.type === "file-exists") {
          const r = await tauriInvoke("run_shell", {
            command: `test -e "${check.path}" && echo "YES" || echo "NO"`,
          });
          return r.trim() === "YES";
        }
        if (check.type === "any-exists") {
          const tests = check.paths.map((p) => `test -e "${p}"`).join(" || ");
          const r = await tauriInvoke("run_shell", {
            command: `(${tests}) && echo "YES" || echo "NO"`,
          });
          return r.trim() === "YES";
        }
        if (check.type === "file-contains") {
          const r = await tauriInvoke("run_shell", {
            command: `grep -l "${check.keyword}" "${check.path}" 2>/dev/null && echo "YES" || echo "NO"`,
          });
          return r.trim().includes("YES");
        }
        if (check.type === "any-contains") {
          const greps = check.paths
            .map((p) => `grep -l "${check.keyword}" "${p}" 2>/dev/null`)
            .join(" || ");
          const r = await tauriInvoke("run_shell", {
            command: `(${greps}) && echo "YES" || echo "NO"`,
          });
          return r.trim().includes("YES");
        }
        if (check.type === "global-contains") {
          const r = await tauriInvoke("run_shell", {
            command: `grep -l "${check.keyword}" ~/".claude.json" 2>/dev/null && echo "YES" || echo "NO"`,
          });
          return r.trim().includes("YES");
        }
        return false;
      } catch {
        return false;
      }
    })
  );
}

async function runMissionChecksWeb(autoChecks) {
  try {
    const data = await apiFetch("/api/check", {
      method: "POST",
      body: JSON.stringify({ checks: autoChecks }),
    });
    return Array.isArray(data.results) ? data.results : autoChecks.map(() => false);
  } catch {
    return autoChecks.map(() => false);
  }
}

// 발표자(user00) 전용: 시연 슬라이드 진입 시 Haiku 4.5 + 1024 토큰으로 강제 전환.
// 일반 슬라이드로 돌아가면 Sonnet 4.6 + 8192 토큰 복원.
// settings.json 만 swap 하므로 다음 claude 호출부터 적용 (보통 clearMySession 과 함께).
export async function setDemoMode(mode) {
  if (isTauri()) return null;
  try {
    return await apiFetch("/api/set-demo-mode", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  } catch {
    return null;
  }
}

// AI 채점 — 백엔드가 학습자 권한으로 claude -p 호출.
// 응답: { ok, score, passed, summary, items: [{name, ok, comment}] }
// Tauri 모드는 미지원 (워크숍 환경 전용 기능).
export async function gradeMission({ missionId, rubric, files, checklist }) {
  if (isTauri()) return { ok: false, error: "tauri unsupported" };
  try {
    const data = await apiFetch("/api/grade-mission", {
      method: "POST",
      body: JSON.stringify({ missionId, rubric, files, checklist }),
    });
    return data;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// AI 코칭 — 어시스턴트 오버레이 전용. 짧고 가벼운 호출.
// 백엔드가 학습자 스크롤백 + 산출 파일을 자동 캡처해서 짧은 힌트 한 줄 반환.
// 응답: { ok, status: "good"|"almost"|"stuck"|"empty", hint: string, nextStep?: string }
// 30초 타임아웃 / 1024 토큰. Tauri 모드 미지원.
export async function askMissionHelper({ missionId, goal, mandatory, hints, question }) {
  if (isTauri()) return { ok: false, error: "tauri unsupported" };
  try {
    const data = await apiFetch("/api/coach", {
      method: "POST",
      body: JSON.stringify({ missionId, goal, mandatory, hints, question }),
    });
    return data;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 학습자 본인 tmux 스크롤백 (plain text). 디버그/표시용.
// 응답: { ok, scrollback, lines }
export async function fetchMyScrollback(lines = 1000) {
  if (isTauri()) return { ok: false, error: "tauri unsupported" };
  try {
    const data = await apiFetch(`/api/my-scrollback?lines=${encodeURIComponent(lines)}`);
    return data;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ─────────────────────────────────────────────────────────────
// 셸 실행 — Tauri 전용. 웹에선 미지원 (호출 측에서 isTauri() 가드).
// ─────────────────────────────────────────────────────────────

export async function runShell(command) {
  if (isTauri()) return tauriInvoke("run_shell", { command });
  // 웹 모드에선 임의 셸 실행을 허용하지 않음 — 호출 측에서 ttyd 안내로 대체
  return null;
}

// ─────────────────────────────────────────────────────────────
// 프로젝트 파일 I/O — Tauri 전용. 웹에선 ttyd 셸로 사용자가 직접.
// ─────────────────────────────────────────────────────────────

export async function readProjectFile(path) {
  if (isTauri()) return tauriInvoke("read_project_file", { path });
  // 웹: 백엔드 /api/file?path=
  const data = await apiFetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!data.exists) throw new Error("file not found");
  return data.content;
}

// 사용자 홈 디렉터리 리스팅 (파일 탐색기용)
export async function listProjectDir(path = "") {
  if (isTauri()) {
    // Tauri 모드: 미구현 (원하면 추가 가능)
    return { path, items: [] };
  }
  return apiFetch(`/api/list?path=${encodeURIComponent(path)}`);
}

export async function writeProjectFile(path, content) {
  if (isTauri()) return tauriInvoke("write_project_file", { path, content });
  return webWriteFile(path, content, "write");
}

export async function appendProjectFile(path, content) {
  if (isTauri()) {
    // Tauri: 기존 파일 읽고 합쳐서 다시 쓰기 (write_project_file은 덮어쓰기만)
    let current = "";
    try { current = await tauriInvoke("read_project_file", { path }); } catch {}
    return tauriInvoke("write_project_file", { path, content: current + content });
  }
  return webWriteFile(path, content, "append");
}

async function webWriteFile(p, content, mode) {
  const data = await apiFetch("/api/file", {
    method: "POST",
    body: JSON.stringify({ path: p, content, mode }),
  });
  if (data && data.ok === false) throw new Error(data.error || "write failed");
  return data;
}

// ─────────────────────────────────────────────────────────────
// 진행 보고 / 어드민 모니터링 (웹 모드 전용)
// ─────────────────────────────────────────────────────────────

let _lastProgressKey = "";
export async function reportProgress(state) {
  if (isTauri()) return; // 데스크톱 솔로 모드는 모니터링 대상 아님
  // 동일 상태 중복 보고 방지 (slideIndex + completed 길이 변화만 보냄)
  const key = `${state.slideIndex}|${(state.completedMissionIds || []).length}|${state.currentMissionId || ""}`;
  if (key === _lastProgressKey) return;
  _lastProgressKey = key;
  try {
    await apiFetch("/api/progress", {
      method: "POST",
      body: JSON.stringify(state),
    });
  } catch {
    // 보고 실패는 사용자 경험에 영향 없음 — 조용히 무시
  }
}

export async function fetchAdminProgress() {
  const data = await apiFetch("/api/admin/progress");
  return data;
}

// 사용자 측: 자기 target 조회 — locked가 true면 어드민 통제 모드
export async function fetchMyTarget() {
  if (isTauri()) return { target: null, locked: false };
  try {
    return await apiFetch("/api/my-target");
  } catch {
    return { target: null, locked: false };
  }
}

// 어드민: 특정 사용자의 target 설정 (절대값)
export async function adminSetTarget(username, slideIndex) {
  return apiFetch("/api/admin/target", {
    method: "POST",
    body: JSON.stringify({ username, slideIndex }),
  });
}

// 어드민: 특정 사용자 상대 이동
export async function adminAdvance(username, delta = 1) {
  return apiFetch("/api/admin/advance", {
    method: "POST",
    body: JSON.stringify({ username, delta }),
  });
}

// 어드민: 모든 사용자에게 적용 (slideIndex 또는 delta 중 하나)
export async function adminTargetAll({ slideIndex, delta } = {}) {
  return apiFetch("/api/admin/target-all", {
    method: "POST",
    body: JSON.stringify(slideIndex != null ? { slideIndex } : { delta }),
  });
}

// 어드민: 운영자 키를 사용자에게 재적용. username 주면 해당 유저만, 없으면 전체.
export async function adminRefreshCredentials(usernameOrOpts) {
  const body = typeof usernameOrOpts === "string"
    ? { username: usernameOrOpts }
    : { userCount: (usernameOrOpts && usernameOrOpts.userCount) || 20 };
  return apiFetch("/api/admin/refresh-credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 어드민: 마스터 키 슬롯 상태 (a/b 각각 채워져 있는지)
export async function adminKeyStatus() {
  return apiFetch("/api/admin/key-status");
}

// 어드민: 운영자(user00) Claude 로그인 상태 — 만료 여부 + 남은 일수
export async function adminOperatorAuthStatus() {
  return apiFetch("/api/admin/operator-auth-status");
}

// 어드민: user00 크리덴셜을 다른 사용자에게 복사. username 주면 단일, 없으면 전체.
export async function adminRefreshFromOperator(usernameOrNothing) {
  const body = typeof usernameOrNothing === "string"
    ? { username: usernameOrNothing }
    : { userCount: 20 };
  return apiFetch("/api/admin/refresh-from-operator", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 어드민: 마스터 키 직접 등록 (운영자 본인 PC에서 claude /login 후 JSON 붙여넣기)
export async function adminSaveKey(slot, credentials, claudeJson) {
  return apiFetch("/api/admin/save-key", {
    method: "POST",
    body: JSON.stringify({ slot, credentials, claudeJson }),
  });
}

// 어드민: Anthropic API 토큰 사용량 (rate limit headers — Console API key 필요)
export async function adminUsage() {
  return apiFetch("/api/admin/usage");
}
export async function adminUsageRefresh() {
  return apiFetch("/api/admin/usage/refresh", { method: "POST" });
}

// 어드민: Claude Max 구독 사용량 (운영자 lsc 컨텍스트에서 `claude /usage` 실행)
export async function adminClaudeUsage() {
  return apiFetch("/api/admin/claude-usage");
}
export async function adminClaudeUsageRefresh() {
  return apiFetch("/api/admin/claude-usage/refresh", { method: "POST" });
}

// 어드민: tmux 세션 리셋 (전체 또는 특정 사용자)
export async function adminResetSessions(username = null) {
  return apiFetch("/api/admin/reset-sessions", {
    method: "POST",
    body: JSON.stringify(username ? { username } : {}),
  });
}

// 어드민: 글로벌 통제 모드 on/off
export async function adminSetLockMode(enabled) {
  return apiFetch("/api/admin/lock-mode", {
    method: "POST",
    body: JSON.stringify({ enabled: !!enabled }),
  });
}

// 어드민: 사용자별 통제 override (true=강제잠금, false=강제풀림, null=글로벌 따름)
export async function adminLockUser(username, locked) {
  return apiFetch("/api/admin/lock-user", {
    method: "POST",
    body: JSON.stringify({ username, locked }),
  });
}

// 어드민: 전체 진행/타깃/override 초기화 (disabled는 보존)
export async function adminCleanHome(username) {
  return apiFetch("/api/admin/clean-home", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function adminCleanAllHomes() {
  return apiFetch("/api/admin/clean-all-homes", { method: "POST" });
}

export async function adminForceRelogin() {
  return apiFetch("/api/admin/force-relogin", { method: "POST" });
}

// 어드민: VNC 상태 조회 (novnc-userXX 서비스별 active/listening)
export async function adminVncStatus() {
  return apiFetch("/api/admin/vnc-status");
}

// 어드민: 죽은 novnc-userXX 서비스 일괄 복구
export async function adminVncRecover() {
  return apiFetch("/api/admin/vnc-recover", { method: "POST" });
}

// 어드민: 전체 사용자 VNC 체인 일괄 재기동 (xstartup 재실행 → 한글 IME 재설정)
export async function adminVncRestartAll() {
  return apiFetch("/api/admin/vnc-restart-all", { method: "POST" });
}

// 어드민: 개별 사용자 VNC 체인(vnc → vnc-xfce → novnc) 전체 재기동
export async function adminVncResetUser(username) {
  return apiFetch("/api/admin/vnc-reset-user", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function adminResetAll() {
  return apiFetch("/api/admin/reset-all", { method: "POST" });
}

// 어드민: 개별 사용자 진행 초기화
export async function adminResetUser(username) {
  return apiFetch("/api/admin/reset-user", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

// 어드민: 사용자 접속 차단/허용 (ttyd 서비스도 같이 stop/start)
export async function adminDisableUser(username, disabled) {
  return apiFetch("/api/admin/disable-user", {
    method: "POST",
    body: JSON.stringify({ username, disabled: !!disabled }),
  });
}

// 사용자 작업 폴더 초기화 — 체험 산출물 삭제 (실습 Part 4 진입 시)
export async function cleanWorkspace() {
  if (isTauri()) return null;
  try {
    return await apiFetch("/api/clean-workspace", { method: "POST" });
  } catch {
    return null;
  }
}

// 사용자 본인 tmux 세션 화면 클리어 (스크롤백 포함)
export async function clearMySession() {
  if (isTauri()) return null;
  try {
    return await apiFetch("/api/clear-my-session", { method: "POST" });
  } catch {
    return null;
  }
}

// 사용자 본인 VNC 터미널에 텍스트 자동 붙여넣기 — xclip + Ctrl+Shift+V.
// send-to-my-terminal(type) 은 한 글자씩 치기라 느림. 긴 프롬프트는 이걸로.
// Enter 는 안 누름 — 사용자가 검토 후 직접.
export async function pasteToMyTerminal(text) {
  if (isTauri()) return null;
  try {
    return await apiFetch("/api/paste-to-my-terminal", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    throw e;
  }
}

// 사용자 본인 tmux 세션에 텍스트 직접 입력 (클립보드 우회).
// Enter는 누르지 않으므로, 사용자가 검토 후 Enter 직접.
export async function sendToMyTerminal(text) {
  if (isTauri()) return null;
  try {
    return await apiFetch("/api/send-to-my-terminal", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    throw e;
  }
}

export async function copyTemplatesToProject() {
  if (isTauri()) return tauriInvoke("copy_templates_to_project", {});
  return null; // 웹 모드: 사용자 홈에 워크숍 스켈레톤이 미리 준비되어 있음
}

export async function setProjectDir(path) {
  if (isTauri()) return tauriInvoke("set_project_dir", { path });
  return null;
}

export async function listOutput() {
  if (isTauri()) return tauriInvoke("list_output");
  return [];
}

export async function previewFile(filename) {
  if (isTauri()) return tauriInvoke("preview_file", { filename });
  throw new Error("previewFile: web mode not supported");
}

export async function openFile(filename) {
  if (isTauri()) return tauriInvoke("open_file", { filename });
  return null;
}

export async function resetProject() {
  if (isTauri()) return tauriInvoke("reset_project");
  return "웹 모드: 워크숍 운영자가 서버에서 정리합니다.";
}

// ─────────────────────────────────────────────────────────────
// 의존성 체크/설치 — 웹에선 항상 "준비됨".
// ─────────────────────────────────────────────────────────────

export async function checkNode() {
  if (isTauri()) return tauriInvoke("check_node");
  return "node (server)";
}

export async function checkClaude() {
  if (isTauri()) return tauriInvoke("check_claude");
  return "claude (server)";
}

export async function installNode() {
  if (isTauri()) return tauriInvoke("install_node");
  return "이미 설치되어 있습니다 (서버).";
}

export async function installClaude() {
  if (isTauri()) return tauriInvoke("install_claude_code");
  return "이미 설치되어 있습니다 (서버).";
}

export async function checkAuthStatus() {
  if (isTauri()) return tauriInvoke("check_auth_status");
  // 웹 모드: 사용자가 ttyd에서 `claude /login` 실행 — 슬라이드에서 안내
  return "manual";
}

// ─────────────────────────────────────────────────────────────
// API 키 — 워크숍은 `claude /login` 흐름이므로 웹에선 사실상 미사용.
// ─────────────────────────────────────────────────────────────

export async function loadApiKey() {
  if (isTauri()) return tauriInvoke("load_api_key");
  return "";
}

export async function saveApiKey(key) {
  if (isTauri()) return tauriInvoke("save_api_key", { key });
  return null;
}

// ─────────────────────────────────────────────────────────────
// 호환 레이어 — 점진적 마이그레이션용.
// 기존 workbook.jsx의 tauriInvoke(cmd, args) 직접 호출을 한 번에
// 다 바꿀 수 없을 때, 같은 시그니처로 노출해 둔다.
// 웹 모드에서 호출되면 throw → 호출 측 isTauri() 가드로 보호되어야 함.
// ─────────────────────────────────────────────────────────────

export async function legacyInvoke(cmd, args) {
  if (!isTauri()) {
    throw new Error(`legacyInvoke(${cmd}): not available in web mode`);
  }
  return tauriInvoke(cmd, args);
}
