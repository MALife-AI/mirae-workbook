// mirae-workbook backend (web mode)
//
// 책임:
//   - GET  /api/me      → { username }   (nginx Basic Auth가 X-Remote-User 헤더로 전달)
//   - POST /api/check   → { results: bool[] }
//                         body: { checks: [{ type, path?, paths?, keyword? }, ...] }
//
// 미션 자동검증의 5가지 체크 타입은 src/components/MissionSlide.jsx 및
// src/lib/runtime.js와 동일한 의미론을 따른다.
//
// 보안:
//   - X-Remote-User가 없으면 401
//   - 사용자명은 [a-zA-Z0-9_-]+ 만 허용
//   - 모든 경로는 사용자 홈(/home/${user}) 안으로 정규화. .. 거부, 절대경로 거부
//
// 권한 모델:
//   - 이 프로세스는 workbook-readers 그룹 구성원이어야 사용자 홈을 읽을 수 있다.
//   - setup-server.sh가 chmod 750 + chgrp workbook-readers /home/userXX 처리.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const app = express();
// /api/file 본문(파일 내용)이 클 수 있어 1MB 까지 허용
app.use(express.json({ limit: "1mb" }));

// 스크립트 경로는 환경변수로 오버라이드 가능 (테스트 mock 용)
const WRITE_AS_USER_PATH = process.env.WRITE_AS_USER_PATH || "/opt/mirae-workbook-api/write-as-user.sh";
const ADMIN_ACTION_PATH = process.env.ADMIN_ACTION_PATH || "/opt/mirae-workbook-api/admin-action.sh";
const GRADE_MISSION_PATH = process.env.GRADE_MISSION_PATH || "/opt/mirae-workbook-api/grade-mission.sh";
const COACH_PATH = process.env.COACH_PATH || "/opt/mirae-workbook-api/coach.sh";
const SUDO_PATH = process.env.SUDO_PATH || "/usr/bin/sudo";

const PORT = parseInt(process.env.PORT || "6999", 10);
const USER_RE = /^[a-zA-Z0-9_-]+$/;
const ADMIN_USERS = new Set(["admin"]);
// 발표자 (강사) — 자유 이동 + 본인 슬라이드를 모든 학생에게 자동 전파
const PRESENTER_USERS = new Set(["user00"]);

// 진행 상태 영속화
const STATE_DIR = process.env.STATE_DIR || "/var/lib/mirae-workbook-api";
const PROGRESS_FILE = path.join(STATE_DIR, "progress.json");

let progressMap = {}; // { username: { ... } }
// 어드민이 통제하는 사용자별 목표 슬라이드 — 사용자는 폴링해서 강제 이동
let targetMap = {}; // { username: slideIndex }
// 강의 모드 (통제) on/off — 기본 ON
let lockMode = true;
// 사용자별 통제 모드 override (true=강제잠금, false=강제풀림, null=글로벌 따름)
let lockOverrides = {}; // { username: true|false }
// 차단된 사용자 — true이면 모든 /api 접근 거부 + ttyd 정지
let disabledUsers = {}; // { username: true }
// 사용자별 세션 버전 — 어드민이 reset하면 증가, 프론트가 보고 iframe reload
let sessionVersions = {}; // { username: number }

const TARGETS_FILE = path.join(STATE_DIR, "targets.json");
const LOCK_FILE = path.join(STATE_DIR, "lockmode.json");
const OVERRIDES_FILE = path.join(STATE_DIR, "lock-overrides.json");
const DISABLED_FILE = path.join(STATE_DIR, "disabled.json");
const SESSIONS_FILE = path.join(STATE_DIR, "sessions.json");

try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
} catch {}
try {
  if (fs.existsSync(PROGRESS_FILE)) {
    progressMap = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  }
} catch {
  progressMap = {};
}
try {
  if (fs.existsSync(TARGETS_FILE)) {
    targetMap = JSON.parse(fs.readFileSync(TARGETS_FILE, "utf8"));
  }
} catch {
  targetMap = {};
}
try {
  if (fs.existsSync(LOCK_FILE)) {
    const j = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
    if (typeof j.enabled === "boolean") lockMode = j.enabled;
  }
} catch {}
try {
  if (fs.existsSync(OVERRIDES_FILE)) {
    lockOverrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf8"));
  }
} catch { lockOverrides = {}; }
try {
  if (fs.existsSync(DISABLED_FILE)) {
    disabledUsers = JSON.parse(fs.readFileSync(DISABLED_FILE, "utf8"));
  }
} catch { disabledUsers = {}; }
try {
  if (fs.existsSync(SESSIONS_FILE)) {
    sessionVersions = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
  }
} catch { sessionVersions = {}; }

function saveLockMode() {
  try { fs.writeFileSync(LOCK_FILE, JSON.stringify({ enabled: lockMode }), "utf8"); } catch {}
}
function saveOverrides() {
  try { fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(lockOverrides), "utf8"); } catch {}
}
function saveDisabled() {
  try { fs.writeFileSync(DISABLED_FILE, JSON.stringify(disabledUsers), "utf8"); } catch {}
}
function saveSessions() {
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionVersions), "utf8"); } catch {}
}
function bumpSessionVersion(user) {
  sessionVersions[user] = (sessionVersions[user] || 0) + 1;
  saveSessions();
}

function isDisabled(user) {
  return !!disabledUsers[user];
}

// 사용자별 effective lock 상태 계산
function isLockedFor(user) {
  if (isPresenter(user)) return false;  // 발표자는 항상 자유
  if (lockOverrides[user] === true) return true;
  if (lockOverrides[user] === false) return false;
  return lockMode;
}

let saveTimer = null;
function saveProgressDebounced() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressMap), "utf8");
    } catch {}
  }, 500);
}

let saveTargetsTimer = null;
function saveTargetsDebounced() {
  if (saveTargetsTimer) return;
  saveTargetsTimer = setTimeout(() => {
    saveTargetsTimer = null;
    try {
      fs.writeFileSync(TARGETS_FILE, JSON.stringify(targetMap), "utf8");
    } catch {}
  }, 200);
}

// 알려진 사용자 모음 = 진행 보고가 있었던 사용자 + 타깃이 있는 사용자
function knownUsers() {
  const set = new Set([...Object.keys(progressMap), ...Object.keys(targetMap)]);
  return Array.from(set).sort();
}

function getUser(req) {
  const u = req.header("x-remote-user") || "";
  if (!u || !USER_RE.test(u)) return null;
  return u;
}

function isAdmin(user) {
  return user && ADMIN_USERS.has(user);
}

function isPresenter(user) {
  return user && PRESENTER_USERS.has(user);
}

// 테스트 모드: HOME_BASE 환경변수로 사용자 홈 베이스 경로 오버라이드 가능 (기본 /home).
const HOME_BASE = process.env.HOME_BASE || "/home";
function userHome(user) {
  return `${HOME_BASE}/${user}`;
}

// 사용자 홈 안으로 경로를 정규화. 밖으로 벗어나면 null.
// 입력 path는 상대경로(예: ".claude/settings.local.json") 또는 ~/ 시작.
function safeJoin(user, p) {
  if (typeof p !== "string" || p.length === 0) return null;
  let rel = p.startsWith("~/") ? p.slice(2) : p;
  if (path.isAbsolute(rel)) return null;
  if (rel.includes("\0")) return null;
  const home = userHome(user);
  const resolved = path.resolve(home, rel);
  if (resolved !== home && !resolved.startsWith(home + path.sep)) return null;
  return resolved;
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fileContains(p, keyword) {
  try {
    // 32MB 상한 — 워크숍 설정 파일은 보통 KB 단위
    const stat = fs.statSync(p);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) return false;
    const content = fs.readFileSync(p, "utf8");
    return content.includes(keyword);
  } catch {
    return false;
  }
}

function runCheck(user, check) {
  if (!check || typeof check !== "object") return false;
  try {
    if (check.type === "file-exists") {
      const p = safeJoin(user, check.path);
      return p ? fileExists(p) : false;
    }
    if (check.type === "any-exists") {
      if (!Array.isArray(check.paths)) return false;
      return check.paths.some((rp) => {
        const p = safeJoin(user, rp);
        return p ? fileExists(p) : false;
      });
    }
    if (check.type === "file-contains") {
      const p = safeJoin(user, check.path);
      if (!p || !fileExists(p)) return false;
      return fileContains(p, String(check.keyword || ""));
    }
    if (check.type === "any-contains") {
      if (!Array.isArray(check.paths)) return false;
      const kw = String(check.keyword || "");
      return check.paths.some((rp) => {
        const p = safeJoin(user, rp);
        return !!p && fileExists(p) && fileContains(p, kw);
      });
    }
    if (check.type === "global-contains") {
      // ~/.claude.json 만 허용
      const p = path.join(userHome(user), ".claude.json");
      if (!fileExists(p)) return false;
      return fileContains(p, String(check.keyword || ""));
    }
  } catch {
    return false;
  }
  return false;
}

// ─── routes ──────────────────────────────────────────────────

// 사용자 차단 미들웨어 — admin은 면제, /api/admin/* 는 별도 처리
// /api/me 는 통과 (프론트가 disabled 상태를 받아서 lockout 화면 그려야 함)
app.use((req, res, next) => {
  const user = getUser(req);
  if (!user) return next();
  if (isAdmin(user)) return next();
  if (req.path.startsWith("/api/admin/")) return next();
  if (req.path === "/api/me") return next();
  if (isDisabled(user)) {
    return res.status(403).json({ error: "disabled", disabled: true });
  }
  next();
});

app.get("/api/me", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  // 차단 사용자는 위 미들웨어가 이미 처리하지만, /api/me 자체는 disabled 정보를 줘서
  // 프론트가 lockout 화면을 그릴 수 있게 함 → 미들웨어 우회 (admin은 통과)
  if (isAdmin(user)) return res.json({ username: user, admin: true });
  res.json({ username: user, disabled: isDisabled(user) });
});

app.post("/api/check", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  const checks = Array.isArray(req.body?.checks) ? req.body.checks : null;
  if (!checks) return res.status(400).json({ error: "checks must be array" });
  if (checks.length > 32) return res.status(400).json({ error: "too many checks" });
  const results = checks.map((c) => runCheck(user, c));
  res.json({ results });
});

// ─── AI 채점 ──────────────────────────────────────────
// POST /api/grade-mission
//   body: { missionId, rubric, files: [path, ...], checklist: [string, ...] }
//
// 동작:
//   1. 학습자 홈에서 files[] 의 내용을 읽어와 컨텍스트 구성
//   2. claude -p --output-format=json --json-schema=... 로
//      사용자(user01..)의 .credentials.json 권한으로 1회 호출
//   3. 모델은 settings.json 의 sonnet, env CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192
//   4. 스키마 강제로 { score, passed, items: [{name, ok, comment}], summary } 반환
//   5. 8 KB 출력 + 30 초 타임아웃
//
// 보안: 사용자 권한으로 sudo -u 로 실행 → 자기 파일만 접근.
//       rubric 은 신뢰. files 경로는 safeJoin 으로 사용자 홈 안만.
app.post("/api/grade-mission", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.status(403).json({ error: "admin no grade" });

  const { missionId, rubric, files, checklist } = req.body || {};
  if (typeof missionId !== "string" || !missionId.match(/^[a-zA-Z0-9_-]+$/)) {
    return res.status(400).json({ error: "invalid missionId" });
  }
  if (typeof rubric !== "string" || rubric.length === 0 || rubric.length > 4000) {
    return res.status(400).json({ error: "invalid rubric" });
  }
  if (!Array.isArray(files) || files.length > 8) {
    return res.status(400).json({ error: "files must be 0..8" });
  }
  if (!Array.isArray(checklist) || checklist.length === 0 || checklist.length > 12) {
    return res.status(400).json({ error: "checklist must be 1..12" });
  }

  // 1) 터미널 출력 읽기 — tmux pipe-pane이 자동 기록한 파일
  const termLogPath = path.join(userHome(user), ".terminal-output.txt");
  let termText = "";
  try {
    const raw = fs.readFileSync(termLogPath, "utf8");
    termText = raw.length > 4000 ? raw.slice(-4000) : raw;
  } catch {
    // 파일 없으면 fallback: 실시간 캡처
    termText = await new Promise((resolve) => {
      const child = spawn(SUDO_PATH, ["-n", ADMIN_ACTION_PATH, "capture-scrollback", user, "500"], { timeout: 8_000 });
      let buf = "";
      child.stdout.on("data", (d) => { buf += d.toString(); if (buf.length > 32 * 1024) child.kill(); });
      child.on("close", () => resolve(buf.trim()));
      child.on("error", () => resolve(""));
    });
    if (termText.length > 4000) termText = termText.slice(-4000);
  }

  // 2) 산출물 파일 내용 수집
  const ctx = [];
  ctx.push(`### 터미널 출력 (최근)\n\n\`\`\`\n${termText || "(비어 있음)"}\n\`\`\``);
  for (const rel of files) {
    if (typeof rel !== "string") continue;
    const p = safeJoin(user, rel);
    if (!p) continue;
    let body = "(파일 없음)";
    try {
      const stat = fs.statSync(p);
      if (stat.isFile() && stat.size <= 64 * 1024) {
        body = fs.readFileSync(p, "utf8");
      } else if (stat.isFile()) {
        body = fs.readFileSync(p, "utf8").slice(0, 4096) + "\n(...잘림)";
      }
    } catch {
      body = "(파일 없음)";
    }
    ctx.push(`### 파일: ${rel}\n\n\`\`\`\n${body}\n\`\`\``);
  }

  // 3) 프롬프트 구성 — JSON 스키마로 강제
  const checklistStr = checklist.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const prompt = [
    "다음은 워크숍 학습자가 미션을 수행한 결과이다.",
    "터미널 출력과 산출물 파일을 종합적으로 보고 **관대하게** 채점해라.",
    "학습자가 미션 주제와 관련된 작업을 했으면 통과(ok:true)로 판정해라.",
    "정확한 형식이 아니더라도 비슷한 결과물이 있으면 통과다.",
    "터미널에 Claude가 응답한 흔적이 있으면 해당 미션은 수행한 것이다.",
    "각 항목별 짧은 격려 코멘트를 한국어로 작성. 사고 과정 노출 금지. 결과 JSON만 출력.",
    "",
    "## 루브릭",
    rubric,
    "",
    "## 체크리스트",
    checklistStr,
    "",
    "## 학습자 산출물",
    ctx.join("\n\n"),
  ].join("\n");

  const schema = JSON.stringify({
    type: "object",
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      passed: { type: "boolean" },
      summary: { type: "string", maxLength: 300 },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            ok: { type: "boolean" },
            comment: { type: "string", maxLength: 200 },
          },
          required: ["name", "ok", "comment"],
        },
      },
    },
    required: ["score", "passed", "summary", "items"],
  });

  // 3) sudo -u <user> grade-mission.sh <schema-file> <prompt-file>
  // 임시 파일에 schema 와 prompt 를 써서 스크립트가 stdin 경합 없이 읽게 한다.
  const tmpDir = "/tmp/mirae-workbook-grade";
  try { fs.mkdirSync(tmpDir, { recursive: true, mode: 0o777 }); } catch {}
  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const schemaFile = path.join(tmpDir, `schema-${user}-${stamp}.json`);
  const promptFile = path.join(tmpDir, `prompt-${user}-${stamp}.txt`);
  try {
    fs.writeFileSync(schemaFile, schema, { mode: 0o644 });
    fs.writeFileSync(promptFile, prompt, { mode: 0o644 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "tmp write failed: " + e.message });
  }

  const args = [
    "-u", user, "-H", "--",
    GRADE_MISSION_PATH,
    schemaFile,
    promptFile,
  ];
  const child = spawn(SUDO_PATH, args, { timeout: 70_000 });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); if (stdout.length > 32 * 1024) child.kill(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    // tmp 파일 정리 — 디버그 중이라 보존
    // try { fs.unlinkSync(schemaFile); } catch {}
    // try { fs.unlinkSync(promptFile); } catch {}

    if (code !== 0) {
      return res.status(500).json({
        ok: false,
        error: "claude grading failed",
        code,
        stderr: stderr.slice(0, 500),
      });
    }
    // claude -p --output-format=json envelope: { type: "result", result: "<text>", ... }
    let envelope, result;
    try {
      envelope = JSON.parse(stdout);
      // --json-schema → structured_output 우선, fallback → result 파싱
      if (envelope.structured_output && typeof envelope.structured_output === "object") {
        result = envelope.structured_output;
      } else if (typeof envelope.result === "string" && envelope.result.trim()) {
        result = JSON.parse(envelope.result);
      } else {
        return res.json({
          ok: true, missionId, score: 0, passed: false,
          summary: "AI 가 채점 결과를 생성하지 못했습니다. 다시 시도해주세요.",
          items: [],
        });
      }
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "parse failed",
        raw: stdout.slice(0, 500),
      });
    }
    res.json({ ok: true, missionId, ...result });
  });
});

// 사용자 홈 디렉터리 리스팅 — 파일 탐색기용
// GET /api/list?path=  → 상대 경로 (없으면 홈 루트)
app.get("/api/list", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.status(403).json({ error: "admin no home" });

  const rel = String(req.query.path || ".");
  const dir = rel === "." || rel === "" ? userHome(user) : safeJoin(user, rel);
  if (!dir) return res.status(400).json({ error: "invalid path" });

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const items = [];
    for (const e of entries) {
      // 숨김 파일 일부만 노출 (.claude, .mcp.json 정도)
      if (e.name.startsWith(".") && !["claude", "mcp.json", "claude.json"].some(p => e.name.includes(p))) {
        continue;
      }
      const full = path.join(dir, e.name);
      let size = 0;
      try { size = fs.statSync(full).size; } catch {}
      items.push({
        name: e.name,
        isDir: e.isDirectory(),
        size,
      });
    }
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({
      path: rel === "." || rel === "" ? "" : rel,
      items,
    });
  } catch (e) {
    // 디렉터리는 존재하지만 백엔드가 read 권한이 없을 때 — 빈 리스트로 응답
    // (사용자가 새로 만든 .claude/skills 등에서 ACL 적용 전에 자주 발생)
    if (e.code === "EACCES" || e.code === "EPERM") {
      return res.json({
        path: rel === "." || rel === "" ? "" : rel,
        items: [],
        warn: "access denied (ACL 미적용 디렉터리)",
      });
    }
    if (e.code === "ENOENT" || e.code === "ENOTDIR") {
      return res.json({
        path: rel === "." || rel === "" ? "" : rel,
        items: [],
      });
    }
    res.status(500).json({ error: "list failed: " + e.message });
  }
});

// 파일 읽기 — 사용자 홈 안만, 작은 텍스트만
app.get("/api/file", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  const rel = String(req.query.path || "");
  const p = safeJoin(user, rel);
  if (!p) return res.status(400).json({ error: "invalid path" });
  if (!fileExists(p)) return res.json({ exists: false, content: "" });
  try {
    const stat = fs.statSync(p);
    if (!stat.isFile() || stat.size > 1024 * 1024) {
      return res.status(413).json({ error: "file too large or not a file" });
    }
    const content = fs.readFileSync(p, "utf8");
    return res.json({ exists: true, content });
  } catch (e) {
    if (e.code === "EACCES" || e.code === "EPERM") {
      return res.status(403).json({ error: "권한 없음 — ACL 미적용 (관리자에 setfacl 요청 필요)" });
    }
    return res.status(500).json({ error: "read failed: " + e.message });
  }
});

// 파일 쓰기 / 추가 — sudo wrapper로 대상 사용자 권한 위임
//   body: { path, content, mode: "write" | "append" }
app.post("/api/file", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });

  const rel = String(req.body?.path || "");
  const content = String(req.body?.content ?? "");
  const mode = req.body?.mode === "append" ? "append" : "write";

  // 경로 검증 (사용자 홈 안)
  const targetAbs = safeJoin(user, rel);
  if (!targetAbs) return res.status(400).json({ error: "invalid path" });

  // 본문 길이 상한 1MB (express.json limit과 정합)
  if (content.length > 1024 * 1024) {
    return res.status(413).json({ error: "content too large" });
  }

  // sudo -u <user> /opt/.../write-as-user.sh <mode> <abs-path>
  const child = spawn(
    "sudo",
    ["-n", "-u", user, WRITE_AS_USER_PATH, mode, targetAbs],
    { stdio: ["pipe", "pipe", "pipe"] }
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    if (code === 0) {
      return res.json({ ok: true, output: stdout.trim() });
    }
    return res.status(500).json({
      ok: false,
      code,
      error: stderr.trim() || stdout.trim() || `exit ${code}`,
    });
  });
  child.on("error", (e) => {
    res.status(500).json({ ok: false, error: String(e) });
  });
  child.stdin.write(content);
  child.stdin.end();
});

// ─── Progress tracking ─────────────────────────────────────────
//
// 사용자 측 워크북이 슬라이드 이동/미션 완료 시마다 호출.
//   POST /api/progress
//     { slideIndex, slideTitle, sectionTitle,
//       isMissionSlide, currentMissionId, completedMissionIds }
//
// 어드민은 모든 사용자 상태를 한 번에 조회.
//   GET /api/admin/progress

app.post("/api/progress", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ ok: true, ignored: "admin" });

  const body = req.body || {};
  // 빈 데이터 보고는 무시 — 슬라이드 제목/섹션이 모두 비면 의미 없는 핑
  const titleStr = String(body.slideTitle || "").trim();
  const sectionStr = String(body.sectionTitle || "").trim();
  if (!titleStr && !sectionStr) {
    return res.json({ ok: true, ignored: "empty" });
  }
  const now = Date.now();
  const prev = progressMap[user] || {};
  const isMission = !!body.isMissionSlide;
  // 미션 슬라이드가 새로 시작됐는지 (slideIndex가 바뀌고 그게 미션이면)
  let missionEnteredAt = prev.missionEnteredAt || null;
  if (isMission && body.slideIndex !== prev.slideIndex) {
    missionEnteredAt = now;
  } else if (!isMission) {
    missionEnteredAt = null;
  }

  const newSlideIndex = Number(body.slideIndex) || 0;
  progressMap[user] = {
    slideIndex: newSlideIndex,
    slideTitle: String(body.slideTitle || "").slice(0, 200),
    sectionTitle: String(body.sectionTitle || "").slice(0, 100),
    isMissionSlide: isMission,
    currentMissionId: body.currentMissionId ? String(body.currentMissionId).slice(0, 50) : null,
    completedMissionIds: Array.isArray(body.completedMissionIds)
      ? body.completedMissionIds.slice(0, 100).map(String)
      : [],
    totalSlides: Number(body.totalSlides) || 0,
    totalMissions: Number(body.totalMissions) || 0,
    lastUpdate: now,
    missionEnteredAt,
  };
  saveProgressDebounced();

  // 발표자(user00)가 슬라이드를 바꾸면 모든 학생의 target을 같이 갱신 → 자동 따라옴
  if (isPresenter(user)) {
    let changed = false;
    for (const u of knownUsers()) {
      if (isAdmin(u) || isPresenter(u)) continue;
      if (targetMap[u] !== newSlideIndex) {
        targetMap[u] = newSlideIndex;
        changed = true;
      }
    }
    // 알려지지 않은 사용자(아직 첫 접속 안 한)는 첫 polling 시 자동 0 대신
    // 발표자의 슬라이드를 받게 됨 — 첫 폴링 시 target이 이미 newSlideIndex로 세팅돼 있음
    if (changed) saveTargetsDebounced();
  }

  res.json({ ok: true });
});

app.get("/api/admin/progress", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });

  // 모든 알려진 사용자 + 진행 데이터 합치기
  const now = Date.now();

  const usernames = knownUsers().filter((u) => !isAdmin(u));
  const rows = usernames.map((username) => {
    const p = progressMap[username] || {};
    const secondsSinceUpdate = p.lastUpdate
      ? Math.floor((now - p.lastUpdate) / 1000)
      : null;
    // 현재 slide의 미션 ID — completedMissionIds에 들어 있으면 "이 코스 완료"
    const completedSet = new Set(p.completedMissionIds || []);
    const missionDone =
      !!p.isMissionSlide &&
      !!p.currentMissionId &&
      completedSet.has(p.currentMissionId);
    return {
      username,
      slideIndex: p.slideIndex || 0,
      slideTitle: p.slideTitle || "",
      sectionTitle: p.sectionTitle || "",
      isMissionSlide: !!p.isMissionSlide,
      currentMissionId: p.currentMissionId || null,
      missionDone,
      completedCount: completedSet.size,
      totalSlides: p.totalSlides || 0,
      totalMissions: p.totalMissions || 0,
      lastUpdate: p.lastUpdate || null,
      secondsSinceUpdate,
      target: targetMap[username] ?? null,
      lockOverride: lockOverrides[username] ?? null,
      effectiveLocked: isLockedFor(username),
      disabled: isDisabled(username),
      isPresenter: isPresenter(username),
    };
  });

  rows.sort((a, b) => a.username.localeCompare(b.username));
  res.json({ users: rows, server_time: now, lockMode });
});

// 전체 초기화 — 진행 + 통제 override 클리어. target 은 어드민 의도이므로 보존.
//                disabled 도 그대로 (명시적 차단 유지)
app.post("/api/admin/reset-all", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  progressMap = {};
  lockOverrides = {};
  saveProgressDebounced();
  saveOverrides();
  res.json({ ok: true });
});

// 개별 사용자 초기화 — progress + 그 사용자의 lockOverride 만. target 보존.
app.post("/api/admin/reset-user", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const target = req.body?.username;
  if (!target || !USER_RE.test(target)) return res.status(400).json({ error: "bad username" });
  delete progressMap[target];
  delete lockOverrides[target];
  saveProgressDebounced();
  saveOverrides();
  res.json({ ok: true, username: target });
});

// 개별 통제 override
app.post("/api/admin/lock-user", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const target = req.body?.username;
  const locked = req.body?.locked; // true | false | null
  if (!target || !USER_RE.test(target)) return res.status(400).json({ error: "bad username" });
  if (locked === null || locked === undefined) {
    delete lockOverrides[target];
  } else {
    lockOverrides[target] = !!locked;
  }
  saveOverrides();
  res.json({ ok: true, username: target, lockOverride: lockOverrides[target] ?? null });
});

// 개별 사용자 접속 차단/허용 — 차단 시 ttyd도 정지
app.post("/api/admin/disable-user", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const target = req.body?.username;
  const disabled = !!req.body?.disabled;
  if (!target || !USER_RE.test(target)) return res.status(400).json({ error: "bad username" });

  if (disabled) {
    disabledUsers[target] = true;
  } else {
    delete disabledUsers[target];
  }
  saveDisabled();

  // ttyd 서비스도 함께 stop/start
  const action = disabled ? "stop-user" : "start-user";
  const r = await runAdminAction([action, target]);
  res.json({
    ok: r.code === 0,
    username: target,
    disabled,
    serviceResult: r.parsed || (r.stderr || "").trim(),
  });
});

// ─── 슬라이드 통제 (어드민이 사용자를 강제 이동) ────────────────
//
// 어드민이 사용자별 목표 슬라이드를 설정. 사용자 측에서 GET /api/my-target 폴링하여 강제 이동.
//
// 정책: target이 한 번도 설정 안 된 사용자는 첫 진입 시 target=0으로 자동 잠김.
//      → 사용자가 임의로 다음 슬라이드로 못 감. 항상 어드민이 push 해야 함.

app.get("/api/my-target", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ target: null, locked: false });
  // 발표자(user00)는 target 안 받음 — 자유롭게 이동, 본인이 broadcast 주체
  if (isPresenter(user)) {
    return res.json({
      target: null,
      locked: false,
      sessionVersion: sessionVersions[user] || 0,
    });
  }
  // 첫 접속 시 target = 0 (어드민이 따로 advance 안 했으면 기본 시작 슬라이드)
  if (targetMap[user] == null) {
    targetMap[user] = 0;
    saveTargetsDebounced();
  }
  // 사용자별 override가 있으면 그게 우선, 없으면 글로벌 lockMode
  // sessionVersion: 어드민이 reset 할 때마다 증가 → 프론트가 iframe reload
  res.json({
    target: targetMap[user],
    locked: isLockedFor(user),
    sessionVersion: sessionVersions[user] || 0,
  });
});

// 통제 모드 on/off
app.get("/api/admin/lock-mode", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  res.json({ enabled: lockMode });
});

app.post("/api/admin/lock-mode", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const enabled = !!req.body?.enabled;
  lockMode = enabled;
  saveLockMode();
  res.json({ ok: true, enabled: lockMode });
});

// 어드민이 특정 사용자의 target 설정 (절대값)
app.post("/api/admin/target", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const { username, slideIndex } = req.body || {};
  if (!username || !USER_RE.test(username)) return res.status(400).json({ error: "bad username" });
  if (typeof slideIndex !== "number" || slideIndex < 0) return res.status(400).json({ error: "bad slideIndex" });
  targetMap[username] = Math.floor(slideIndex);
  saveTargetsDebounced();
  res.json({ ok: true, username, target: targetMap[username] });
});

// 어드민이 특정 사용자를 상대 이동 (delta 만큼)
app.post("/api/admin/advance", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const { username, delta } = req.body || {};
  if (!username || !USER_RE.test(username)) return res.status(400).json({ error: "bad username" });
  const d = typeof delta === "number" ? Math.floor(delta) : 1;
  // 현재 사용자의 보고된 위치를 기준으로 이동 (사용자가 이미 그 위치라면 일관성 유지)
  const cur = targetMap[username] ?? progressMap[username]?.slideIndex ?? 0;
  const next = Math.max(0, cur + d);
  targetMap[username] = next;
  saveTargetsDebounced();
  res.json({ ok: true, username, target: next });
});

// 어드민이 모든 사용자에게 한 번에 적용 (절대값 또는 상대 이동)
app.post("/api/admin/target-all", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const { slideIndex, delta } = req.body || {};
  const usernames = knownUsers().filter((u) => !isAdmin(u));
  const results = [];
  for (const u of usernames) {
    if (typeof slideIndex === "number") {
      targetMap[u] = Math.max(0, Math.floor(slideIndex));
    } else if (typeof delta === "number") {
      const cur = targetMap[u] ?? progressMap[u]?.slideIndex ?? 0;
      targetMap[u] = Math.max(0, cur + Math.floor(delta));
    } else {
      continue;
    }
    results.push({ username: u, target: targetMap[u] });
  }
  saveTargetsDebounced();
  res.json({ ok: true, results });
});

// ─── 어드민 권한 액션 (sudo wrapper) ────────────────
//
// 두 가지: 키 재적용 (refresh-creds), 세션 리셋 (reset-sessions / reset-session)
// 모두 admin-action.sh를 sudo로 호출. 결과 마지막 줄(JSON)을 클라이언트에 반환.

function runAdminAction(args) {
  return new Promise((resolve) => {
    const child = spawn(SUDO_PATH, ["-n", ADMIN_ACTION_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      // 마지막 JSON 라인 추출
      const lines = stdout.trim().split("\n");
      const last = lines[lines.length - 1] || "";
      let parsed = null;
      try { parsed = JSON.parse(last); } catch {}
      resolve({ code, stdout, stderr, parsed });
    });
    child.on("error", (e) => {
      resolve({ code: -1, stdout: "", stderr: String(e), parsed: null });
    });
  });
}

// 키 슬롯 상태 조회 — 어드민 대시보드에서 어떤 슬롯이 채워져 있는지 표시
const KEYS_DIR = "/etc/mirae-workbook/keys";
const VALID_SLOTS = ["a", "b"];

function readSlotStatus(slot) {
  const dir = path.join(KEYS_DIR, slot);
  const credPath = path.join(dir, "credentials.json");
  const cfgPath = path.join(dir, "claude.json");
  const out = { slot, hasCredentials: false, hasClaudeJson: false, mtime: null, hasOAuth: false };
  try {
    if (fs.existsSync(credPath)) {
      const stat = fs.statSync(credPath);
      out.hasCredentials = stat.size > 50;
      out.mtime = stat.mtimeMs;
    }
  } catch {}
  try {
    if (fs.existsSync(cfgPath)) {
      const j = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      out.hasClaudeJson = true;
      out.hasOAuth = !!(j.oauthAccount && j.userID);
    }
  } catch {}
  return out;
}

// Anthropic API 토큰 사용량 — ANTHROPIC_API_KEY 환경변수가 있으면 5분마다 ping
let usageState = {
  lastCheck: null,
  ok: false,
  error: null,
  requestsLimit: null,
  requestsRemaining: null,
  requestsReset: null,
  inputTokensLimit: null,
  inputTokensRemaining: null,
  outputTokensLimit: null,
  outputTokensRemaining: null,
};

async function checkUsage() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    usageState = { ...usageState, lastCheck: Date.now(), ok: false, error: "ANTHROPIC_API_KEY 미설정" };
    return;
  }
  try {
    // 가장 가벼운 호출 — count_tokens 는 LLM을 호출하지 않으면서도 rate limit 헤더를 반환
    const r = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const h = r.headers;
    usageState = {
      lastCheck: Date.now(),
      ok: r.ok,
      error: r.ok ? null : `HTTP ${r.status}`,
      requestsLimit: h.get("anthropic-ratelimit-requests-limit"),
      requestsRemaining: h.get("anthropic-ratelimit-requests-remaining"),
      requestsReset: h.get("anthropic-ratelimit-requests-reset"),
      inputTokensLimit: h.get("anthropic-ratelimit-input-tokens-limit"),
      inputTokensRemaining: h.get("anthropic-ratelimit-input-tokens-remaining"),
      outputTokensLimit: h.get("anthropic-ratelimit-output-tokens-limit"),
      outputTokensRemaining: h.get("anthropic-ratelimit-output-tokens-remaining"),
    };
  } catch (e) {
    usageState = { ...usageState, lastCheck: Date.now(), ok: false, error: String(e.message || e) };
  }
}

// 첫 호출 + 5분마다 갱신
checkUsage();
setInterval(checkUsage, 5 * 60 * 1000);

app.get("/api/admin/usage", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  res.json(usageState);
});

app.post("/api/admin/usage/refresh", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  await checkUsage();
  res.json(usageState);
});

// Claude Max 구독 사용량 — `claude /usage` 슬래시 커맨드 출력
let claudeUsageCache = { lastCheck: null, output: "", error: null };
async function fetchClaudeUsage() {
  return new Promise((resolve) => {
    const child = spawn("sudo", ["-n", ADMIN_ACTION_PATH, "claude-usage"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      claudeUsageCache = {
        lastCheck: Date.now(),
        output: stdout,
        error: code !== 0 ? (stderr.trim() || `exit ${code}`) : null,
      };
      resolve(claudeUsageCache);
    });
    child.on("error", (e) => {
      claudeUsageCache = { lastCheck: Date.now(), output: "", error: String(e) };
      resolve(claudeUsageCache);
    });
  });
}

app.get("/api/admin/claude-usage", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  res.json(claudeUsageCache);
});

app.post("/api/admin/claude-usage/refresh", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const r = await fetchClaudeUsage();
  res.json(r);
});

app.get("/api/admin/key-status", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const slots = VALID_SLOTS.map(readSlotStatus);
  res.json({ slots });
});

// 어드민이 마스터 키를 직접 업로드 (운영자 본인 PC에서 claude /login 후 JSON 붙여넣기)
app.post("/api/admin/save-key", (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });

  const slot = String(req.body?.slot || "");
  if (!VALID_SLOTS.includes(slot)) return res.status(400).json({ error: "slot must be a or b" });

  const credentialsRaw = req.body?.credentials;
  const claudeJsonRaw = req.body?.claudeJson;

  if (!credentialsRaw) return res.status(400).json({ error: "credentials required" });

  // credentials는 JSON 객체이거나 문자열(JSON)일 수 있음
  let credentialsObj;
  try {
    credentialsObj = typeof credentialsRaw === "string" ? JSON.parse(credentialsRaw) : credentialsRaw;
  } catch (e) {
    return res.status(400).json({ error: "credentials JSON parse failed: " + e.message });
  }
  if (!credentialsObj || typeof credentialsObj !== "object") {
    return res.status(400).json({ error: "credentials must be JSON object" });
  }

  let claudeJsonObj = null;
  if (claudeJsonRaw) {
    try {
      claudeJsonObj = typeof claudeJsonRaw === "string" ? JSON.parse(claudeJsonRaw) : claudeJsonRaw;
    } catch (e) {
      return res.status(400).json({ error: "claudeJson parse failed: " + e.message });
    }
    // 인증 관련 키만 추출 — 운영자 프로젝트/히스토리는 저장 안 함
    const AUTH_KEYS = ["userID", "oauthAccount", "hasCompletedOnboarding", "lastOnboardingVersion", "subscriptionNoticeCount", "claudeCodeFirstTokenDate"];
    const filtered = {};
    for (const k of AUTH_KEYS) {
      if (claudeJsonObj[k] !== undefined) filtered[k] = claudeJsonObj[k];
    }
    claudeJsonObj = filtered;
  }

  try {
    const dir = path.join(KEYS_DIR, slot);
    fs.mkdirSync(dir, { recursive: true });
    const credPath = path.join(dir, "credentials.json");
    fs.writeFileSync(credPath, JSON.stringify(credentialsObj, null, 2));
    fs.chmodSync(credPath, 0o600);

    if (claudeJsonObj) {
      const cfgPath = path.join(dir, "claude.json");
      fs.writeFileSync(cfgPath, JSON.stringify(claudeJsonObj, null, 2));
      fs.chmodSync(cfgPath, 0o600);
    }

    return res.json({
      ok: true,
      slot,
      hasCredentials: true,
      hasClaudeJson: !!claudeJsonObj,
    });
  } catch (e) {
    return res.status(500).json({ error: "write failed: " + e.message });
  }
});

app.post("/api/admin/refresh-credentials", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const userCount = Number(req.body?.userCount) || 20;
  const r = await runAdminAction(["refresh-creds", String(userCount)]);
  if (r.code === 0) {
    for (const u of knownUsers()) {
      if (!isAdmin(u)) bumpSessionVersion(u);
    }
  }
  if (r.code === 0 && r.parsed) return res.json(r.parsed);
  res.status(500).json({ ok: false, code: r.code, error: r.stderr.trim() || "action failed" });
});

app.post("/api/admin/force-relogin", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const child = spawn(SUDO_PATH, ["-n", ADMIN_ACTION_PATH, "force-relogin"], { timeout: 10_000 });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "force-relogin failed", code, stderr: stderr.slice(0, 500) });
    try { res.json(JSON.parse(stdout)); } catch { res.json({ ok: true }); }
  });
  child.on("error", (e) => res.status(500).json({ error: "spawn failed: " + e.message }));
});

app.post("/api/admin/clean-home", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const target = req.body?.username;
  if (!target || !USER_RE.test(target)) return res.status(400).json({ error: "bad username" });
  const r = await runAdminAction(["clean-home", target]);
  if (r.code === 0 && r.parsed) return res.json(r.parsed);
  res.status(500).json({ ok: false, code: r.code, error: r.stderr.trim().slice(0, 500) || "action failed" });
});

app.post("/api/admin/clean-all-homes", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const r = await runAdminAction(["clean-all-homes", "20"]);
  if (r.code === 0 && r.parsed) return res.json(r.parsed);
  res.status(500).json({ ok: false, code: r.code, error: r.stderr.trim().slice(0, 500) || "action failed" });
});

app.post("/api/admin/reset-sessions", async (req, res) => {
  const user = getUser(req);
  if (!isAdmin(user)) return res.status(403).json({ error: "admin only" });
  const target = req.body?.username;
  let r;
  if (target) {
    if (!USER_RE.test(target)) return res.status(400).json({ error: "bad username" });
    r = await runAdminAction(["reset-session", target]);
    if (r.code === 0) bumpSessionVersion(target);
  } else {
    const userCount = Number(req.body?.userCount) || 20;
    r = await runAdminAction(["reset-sessions", String(userCount)]);
    // 모든 알려진 사용자 sessionVersion bump
    if (r.code === 0) {
      for (const u of knownUsers()) {
        if (!isAdmin(u)) bumpSessionVersion(u);
      }
    }
  }
  if (r.code === 0 && r.parsed) return res.json(r.parsed);
  res.status(500).json({ ok: false, code: r.code, error: r.stderr.trim() || "action failed" });
});

// 발표자 전용: 시연 슬라이드 진입 시 settings.json 을 Haiku/Sonnet 사이로 swap.
// 실제 적용은 다음 claude 호출부터 — 보통 clear-my-session 과 함께 호출되어
// tmux kill 후 재기동 시 새 settings 가 자동 로드된다.
app.post("/api/set-demo-mode", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (!PRESENTER_USERS.has(user)) {
    return res.status(403).json({ error: "presenter only" });
  }
  const mode = req.body?.mode === "demo" ? "demo" : "normal";
  const r = await runAdminAction(["set-demo-mode", user, mode]);
  if (r.code === 0 && r.parsed) return res.json(r.parsed);
  res.status(500).json({ ok: false, error: r.stderr.trim() || "set-demo-mode failed" });
});

// 사용자가 본인 tmux 세션의 화면을 클리어 (스크롤백 포함)
app.post("/api/clear-my-session", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ ok: true, ignored: "admin" });
  const r = await runAdminAction(["clear-session", user]);
  if (r.code === 0 && r.parsed) {
    bumpSessionVersion(user);
    return res.json(r.parsed);
  }
  res.status(500).json({ ok: false, error: r.stderr.trim() || "clear failed" });
});

// 사용자 본인 tmux 세션의 스크롤백 (마지막 N 줄, plain text) — AI 어시스턴트가 학습자
// 진행 상태 코칭할 때 사용. lines 쿼리는 100..5000 범위로 클램프.
app.get("/api/my-scrollback", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ ok: true, scrollback: "" });
  let lines = parseInt(req.query.lines || "1000", 10);
  if (!Number.isFinite(lines) || lines < 100) lines = 1000;
  if (lines > 5000) lines = 5000;
  const child = spawn(SUDO_PATH, ["-n", ADMIN_ACTION_PATH, "capture-scrollback", user, String(lines)], {
    timeout: 10_000,
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); if (stdout.length > 256 * 1024) child.kill(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    if (code === 0) {
      return res.json({ ok: true, scrollback: stdout, lines });
    }
    res.status(500).json({ ok: false, error: stderr.trim() || "capture failed" });
  });
  child.on("error", (e) => res.status(500).json({ ok: false, error: String(e) }));
});

// AI 코칭 — 어시스턴트 오버레이 전용 짧은 호출.
// body: { missionId, goal, mandatory: [string], outputFiles?: [path] }
// 동작:
//   1. 학습자 스크롤백 캡처 (1000줄)
//   2. outputFiles 있으면 내용 읽기 (없는 파일은 "(없음)")
//   3. coach.sh (sudo -u user) → claude -p --json-schema → { status, hint, nextStep }
//   4. 30초 타임아웃, 1024 토큰
// 권한: 학습자 본인 크리덴셜로 호출됨 (gradeMission 과 동일 모델).
app.post("/api/coach", async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.status(403).json({ error: "admin no coach" });

  const { missionId, goal, mandatory, hints, question } = req.body || {};
  if (typeof missionId !== "string" || !missionId.match(/^[a-zA-Z0-9_-]+$/)) {
    return res.status(400).json({ error: "invalid missionId" });
  }
  if (typeof question !== "string" || question.trim().length === 0 || question.length > 500) {
    return res.status(400).json({ error: "question required (max 500)" });
  }

  const mandatoryStr = Array.isArray(mandatory) ? mandatory.map((m, i) => `${i + 1}. ${m}`).join("\n") : "";
  const hintsStr = Array.isArray(hints) ? hints.map((h, i) => `- ${h}`).join("\n") : "";

  const prompt = [
    "당신은 워크숍 학습자 옆에 앉은 친절한 조수입니다.",
    "학습자가 현재 미션에 대해 질문합니다. 한국어로 짧고 친절하게 답하세요.",
    "3문장 이내로 핵심만. 코드 예시가 필요하면 1-2줄만.",
    "",
    "## 현재 미션",
    goal || "",
    "",
    mandatoryStr ? "## 완료 조건\n" + mandatoryStr : "",
    hintsStr ? "## 힌트\n" + hintsStr : "",
    "",
    "## 학습자 질문",
    question.trim(),
  ].filter(Boolean).join("\n");

  const tmpDir = "/tmp/mirae-workbook-grade";
  try { fs.mkdirSync(tmpDir, { recursive: true, mode: 0o777 }); } catch {}
  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const promptFile = path.join(tmpDir, `coach-${user}-${stamp}.txt`);
  try {
    fs.writeFileSync(promptFile, prompt, { mode: 0o644 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "tmp write failed: " + e.message });
  }

  const args = ["-u", user, "-H", "--", COACH_PATH, promptFile];
  const child = spawn(SUDO_PATH, args, { timeout: 40_000 });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); if (stdout.length > 16 * 1024) child.kill(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    try { fs.unlinkSync(promptFile); } catch {}
    if (code !== 0) {
      return res.status(500).json({ ok: false, error: "claude coaching failed", stderr: stderr.trim().slice(0, 500) });
    }
    try {
      const env = JSON.parse(stdout);
      // --json-schema 사용 시 structured_output에 결과가 들어옴
      const inner = env.structured_output || (typeof env.result === "string" && env.result.trim() ? JSON.parse(env.result) : null);
      if (!inner) {
        return res.json({ ok: true, answer: "답변을 생성하지 못했어요. 다시 시도해주세요." });
      }
      return res.json({ ok: true, answer: inner.answer || inner.hint || JSON.stringify(inner) });
    } catch (e) {
      // JSON 파싱 실패 — raw text를 답변으로
      const raw = stdout.replace(/^.*?"result"\s*:\s*"?/s, "").replace(/"?\s*\}?\s*$/s, "").trim();
      return res.json({ ok: true, answer: raw || "답변을 처리하지 못했어요." });
    }
  });
  child.on("error", (e) => res.status(500).json({ ok: false, error: String(e) }));
});

// 사용자 작업 폴더 초기화 — 체험(Part 3) 산출물 삭제. 실습(Part 4) 진입 시 호출.
app.post("/api/clean-workspace", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ ok: true, ignored: "admin" });
  const child = spawn(SUDO_PATH, ["-n", ADMIN_ACTION_PATH, "clean-workspace", user], { timeout: 10_000 });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    if (code === 0) {
      try { return res.json(JSON.parse(stdout.trim().split("\n").pop() || "{}")); }
      catch { return res.json({ ok: true }); }
    }
    res.status(500).json({ ok: false, error: stderr.trim() || "clean failed" });
  });
  child.on("error", (e) => res.status(500).json({ ok: false, error: String(e) }));
});

// 사용자가 본인 tmux 세션에 텍스트 직접 입력 (Enter 안 누름 → 검토 후 직접)
app.post("/api/send-to-my-terminal", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.json({ ignored: "admin" });
  const text = String(req.body?.text || "");
  if (!text) return res.status(400).json({ error: "no text" });
  if (text.length > 32 * 1024) return res.status(413).json({ error: "text too large" });

  const child = spawn("sudo", ["-n", ADMIN_ACTION_PATH, "send-keys", user], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("close", (code) => {
    if (code === 0) {
      try { return res.json(JSON.parse(stdout.trim().split("\n").pop() || "{}")); }
      catch { return res.json({ ok: true }); }
    }
    res.status(500).json({ ok: false, error: stderr.trim() || "send failed" });
  });
  child.on("error", (e) => res.status(500).json({ ok: false, error: String(e) }));
  child.stdin.write(text);
  child.stdin.end();
});

// 산출물 파일 다운로드 — 학습자가 브라우저에서 직접 파일 받기
// GET /api/preview?path=web/index.html
// 유저의 파일을 적절한 Content-Type으로 서빙 (HTML 렌더링, 이미지 표시 등)
app.get("/api/preview", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });

  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ error: "path required" });

  const p = safeJoin(user, rel);
  if (!p) return res.status(400).json({ error: "invalid path" });

  try {
    const stat = fs.statSync(p);
    if (!stat.isFile()) return res.status(400).json({ error: "not a file" });
    if (stat.size > 10 * 1024 * 1024) return res.status(413).json({ error: "file too large" });

    const ext = path.extname(p).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".htm": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".txt": "text/plain; charset=utf-8",
      ".md": "text/plain; charset=utf-8",
      ".csv": "text/csv; charset=utf-8",
    };
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(p).pipe(res);
  } catch {
    res.status(404).json({ error: "file not found" });
  }
});

// GET /api/download?path=outputs/report.docx
// 터미널 안 거치고 파일을 본인 PC 에서 열 수 있게.
app.get("/api/download", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "no user" });
  if (isAdmin(user)) return res.status(403).json({ error: "admin no download" });

  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ error: "path required" });

  const p = safeJoin(user, rel);
  if (!p) return res.status(400).json({ error: "invalid path" });

  try {
    const stat = fs.statSync(p);
    if (!stat.isFile()) return res.status(400).json({ error: "not a file" });
    if (stat.size > 50 * 1024 * 1024) return res.status(413).json({ error: "file too large (50MB limit)" });

    const filename = path.basename(p);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.status(404).json({ error: "file not found" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ error: "not found", path: req.path });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[mirae-workbook-api] listening on 127.0.0.1:${PORT}`);
});
