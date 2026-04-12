// AdminDashboard.jsx
// 워크숍 진행 상황 모니터링 — 어드민(admin) 계정으로 접속 시 슬라이드 대신 표시.
//
// 5초마다 /api/admin/progress 폴링 → 사용자별 행 렌더.
// 정체(stuck): 미션 슬라이드에서 5분 이상 머무름 → 빨간 표시.

import { useEffect, useState } from "react";
import {
  fetchAdminProgress,
  adminAdvance,
  adminSetTarget,
  adminTargetAll,
  adminRefreshCredentials,
  adminForceRelogin,
  adminCleanHome,
  adminCleanAllHomes,
  adminResetSessions,
  adminSetLockMode,
  adminLockUser,
  adminResetAll,
  adminResetUser,
  adminDisableUser,
  adminKeyStatus,
  adminSaveKey,
  adminUsage,
  adminUsageRefresh,
  adminClaudeUsage,
  adminClaudeUsageRefresh,
} from "../lib/runtime.js";

const POLL_INTERVAL_MS = 5000;

function fmtElapsed(s) {
  if (s == null) return "-";
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function AdminDashboard({ M }) {
  const [users, setUsers] = useState([]);
  const [lockMode, setLockMode] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const isMobile = useIsMobile();

  // 마스터 키 슬롯 상태
  const [keyStatus, setKeyStatus] = useState({ slots: [] });
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyModalSlot, setKeyModalSlot] = useState("a");
  const [keyModalCred, setKeyModalCred] = useState("");
  const [keyModalCfg, setKeyModalCfg] = useState("");
  const [keyModalBusy, setKeyModalBusy] = useState(false);
  const [keyModalMsg, setKeyModalMsg] = useState("");

  async function loadKeyStatus() {
    try {
      const r = await adminKeyStatus();
      setKeyStatus(r);
    } catch {}
  }
  useEffect(() => { loadKeyStatus(); }, []);

  // Anthropic 토큰 사용량
  const [usage, setUsage] = useState(null);
  async function loadUsage() {
    try { setUsage(await adminUsage()); } catch {}
  }
  useEffect(() => {
    loadUsage();
    const id = setInterval(loadUsage, 60000); // 1분마다 갱신 (백엔드는 5분 ping)
    return () => clearInterval(id);
  }, []);

  // Claude Max 사용량 (claude /usage 출력)
  const [claudeUsage, setClaudeUsage] = useState(null);
  const [claudeUsageOpen, setClaudeUsageOpen] = useState(false);
  const [claudeUsageBusy, setClaudeUsageBusy] = useState(false);
  async function refreshClaudeUsage() {
    setClaudeUsageBusy(true);
    try { setClaudeUsage(await adminClaudeUsageRefresh()); }
    catch (e) { setClaudeUsage({ error: String(e.message || e) }); }
    finally { setClaudeUsageBusy(false); }
  }
  useEffect(() => { adminClaudeUsage().then(setClaudeUsage).catch(() => {}); }, []);

  async function handleSaveKey() {
    setKeyModalBusy(true);
    setKeyModalMsg("");
    try {
      const r = await adminSaveKey(keyModalSlot, keyModalCred.trim(), keyModalCfg.trim() || undefined);
      setKeyModalMsg(`✓ 슬롯 ${keyModalSlot} 저장됨 (credentials${r.hasClaudeJson ? " + claude.json" : ""})`);
      setKeyModalCred("");
      setKeyModalCfg("");
      loadKeyStatus();
      // 자동 재적용 묻기
      if (confirm("키가 저장됐습니다. 지금 모든 사용자에게 재적용할까요?")) {
        try {
          const rr = await adminRefreshCredentials();
          setActionMsg(`✓ 키 재적용 완료 (${rr.copied}명)`);
          setKeyModalOpen(false);
        } catch (e) {
          setKeyModalMsg(`키는 저장됐지만 재적용 실패: ${e.message || e}`);
        }
      }
    } catch (e) {
      setKeyModalMsg(`✗ 실패: ${e.message || e}`);
    } finally {
      setKeyModalBusy(false);
    }
  }

  async function load() {
    try {
      const data = await fetchAdminProgress();
      setUsers(data.users || []);
      if (typeof data.lockMode === "boolean") setLockMode(data.lockMode);
      setLastFetch(new Date());
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function toggleLockMode() {
    const next = !lockMode;
    try {
      await adminSetLockMode(next);
      setLockMode(next);
      setActionMsg(next ? "✓ 통제 모드 ON — 사용자 자유 이동 차단" : "✓ 통제 모드 OFF — 사용자 자유 이동 허용");
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    }
  }

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const totalUsers = users.length;
  const doneCount = users.filter((u) => u.missionDone).length;
  // 활동중: 진행 보고 + 슬라이드 정보 + 30초 이내
  const activeCount = users.filter(
    (u) => u.secondsSinceUpdate != null && u.secondsSinceUpdate < 30 && u.slideTitle
  ).length;

  // 사용자 nav 액션
  async function nudge(username, delta) {
    try {
      await adminAdvance(username, delta);
      load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function jumpTo(username, slideIndex) {
    try {
      await adminSetTarget(username, slideIndex);
      load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function bulkAdvance(delta) {
    try {
      await adminTargetAll({ delta });
      load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }
  async function bulkJump(slideIndex) {
    try {
      await adminTargetAll({ slideIndex });
      load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const [busy, setBusy] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  async function refreshCreds() {
    if (!confirm("운영자 Claude 로그인 키를 모든 사용자에게 재적용하고 tmux 세션을 리셋합니다. 진행할까요?")) return;
    setBusy("refresh"); setActionMsg("");
    try {
      const r = await adminRefreshCredentials();
      setActionMsg(`✓ 키 재적용 완료 (${r.copied}명, 스킵 ${r.skipped})`);
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function masterReset() {
    if (!confirm("⚠️ 완전 초기화: 파일 삭제 → 진행 초기화 → 세션 리셋 → 재로그인 강제\n\n모든 사용자의 상태가 처음으로 돌아갑니다. 진행할까요?")) return;
    setBusy("master"); setActionMsg("🔄 완전 초기화 진행 중...");
    try {
      setActionMsg("🔄 1/5 — 파일 초기화...");
      await adminCleanAllHomes();
      setActionMsg("🔄 2/5 — 키 재적용...");
      await adminRefreshCredentials();
      setActionMsg("🔄 3/5 — 진행 초기화...");
      await adminResetAll();
      setActionMsg("🔄 4/5 — 세션 리셋...");
      await adminResetSessions();
      setActionMsg("🔄 5/5 — 재로그인 강제...");
      await adminForceRelogin();
      setActionMsg("✓ 완전 초기화 완료 — 모든 사용자가 처음 상태입니다");
      load();
    } catch (e) {
      setActionMsg(`✗ 완전 초기화 중 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function cleanAllHomes() {
    if (!confirm("모든 사용자의 홈 폴더를 초기화합니다 (인증만 보존). 진행할까요?")) return;
    setBusy("clean-homes"); setActionMsg("");
    try {
      const r = await adminCleanAllHomes();
      setActionMsg(`✓ 전체 홈 폴더 초기화 완료 (${r.count || "?"}명)`);
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function forceRelogin() {
    if (!confirm("모든 브라우저의 로그인을 무효화합니다. 모든 사용자가 다시 로그인해야 합니다. 진행할까요?")) return;
    setBusy("relogin"); setActionMsg("");
    try {
      await adminForceRelogin();
      setActionMsg("✓ 전체 재로그인 강제 완료 — 사용자들이 새로고침 시 로그인 창이 뜹니다");
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function resetAllSessions() {
    if (!confirm("모든 사용자의 tmux 셸 세션을 종료합니다. 사용자가 다음 접속 시 새 셸로 시작합니다. 진행할까요?")) return;
    setBusy("reset"); setActionMsg("");
    try {
      const r = await adminResetSessions();
      setActionMsg(`✓ 세션 리셋 완료 (${r.count}명)`);
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function cleanOneHome(username) {
    setBusy(`clean:${username}`); setActionMsg("");
    try {
      await adminCleanHome(username);
      setActionMsg(`✓ ${username} 파일 초기화 완료`);
      load();
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function resetOneSession(username) {
    setBusy(`reset:${username}`); setActionMsg("");
    try {
      await adminResetSessions(username);
      setActionMsg(`✓ ${username} 세션 종료`);
      load();
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }

  async function resetAll() {
    if (!confirm("모든 사용자의 진행 상황과 통제 override를 초기화합니다 (차단 상태는 유지). 진행할까요?")) return;
    setBusy("reset-all"); setActionMsg("");
    try {
      await adminResetAll();
      setActionMsg("✓ 전체 진행 초기화 완료");
      load();
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function resetOneUser(u) {
    if (!confirm(`${u} 의 진행 상황을 초기화합니다.`)) return;
    setBusy(`resetuser:${u}`);
    try { await adminResetUser(u); setActionMsg(`✓ ${u} 진행 초기화`); load(); }
    catch (e) { setActionMsg(`✗ 실패: ${e.message || e}`); }
    finally { setBusy(""); }
  }
  async function toggleUserLock(u, current) {
    // current: true (강제 lock), false (강제 unlock), null (글로벌 따름)
    // 순환: null → true → false → null
    let next;
    if (current === null || current === undefined) next = true;
    else if (current === true) next = false;
    else next = null;
    setBusy(`lock:${u}`);
    try { await adminLockUser(u, next); setActionMsg(`✓ ${u} 통제 → ${next === true ? "강제 잠금" : next === false ? "강제 풀림" : "글로벌"}`); load(); }
    catch (e) { setActionMsg(`✗ 실패: ${e.message || e}`); }
    finally { setBusy(""); }
  }
  async function toggleUserDisable(u, currentlyDisabled) {
    const next = !currentlyDisabled;
    if (next && !confirm(`${u} 의 접속을 차단합니다. 사용자는 ttyd와 슬라이드에 접근할 수 없게 됩니다.`)) return;
    setBusy(`disable:${u}`);
    try { await adminDisableUser(u, next); setActionMsg(`✓ ${u} ${next ? "차단됨" : "허용됨"}`); load(); }
    catch (e) { setActionMsg(`✗ 실패: ${e.message || e}`); }
    finally { setBusy(""); }
  }

  return (
    <div style={{ height: "100vh", background: M.bg, color: M.tx, fontFamily: "var(--workbook-font)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 헤더 */}
      <div style={{
        padding: isMobile ? "10px 12px" : "14px 24px",
        borderBottom: `1px solid ${M.bd}`,
        background: M.bg2,
        display: "flex", alignItems: "center", gap: isMobile ? 8 : 16,
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: M.or, letterSpacing: -0.3 }}>
          🎯 {isMobile ? "Admin" : "Mirae Workbook — Admin"}
        </div>
        <div style={{ display: "flex", gap: isMobile ? 10 : 16, marginLeft: isMobile ? 0 : 24, fontSize: isMobile ? 12 : 14 }}>
          <div style={{ color: M.tx2 }}>
            <span style={{ color: M.tx3 }}>전체</span>{" "}
            <strong style={{ color: M.tx, fontSize: 18 }}>{totalUsers}</strong>
          </div>
          <div style={{ color: M.tx2 }}>
            <span style={{ color: M.tx3 }}>활동중(30초)</span>{" "}
            <strong style={{ color: "#86efac", fontSize: 18 }}>{activeCount}</strong>
          </div>
          <div style={{ color: M.tx2 }}>
            <span style={{ color: M.tx3 }}>현재 미션 완료</span>{" "}
            <strong style={{ color: doneCount > 0 ? "#86efac" : M.tx, fontSize: 18 }}>{doneCount}/{totalUsers}</strong>
          </div>
          {usage && usage.ok && (
            <div style={{ color: M.tx2, paddingLeft: 14, borderLeft: `1px solid ${M.bd}` }} title="Anthropic API rate limit (5분마다 갱신)">
              <span style={{ color: M.tx3 }}>API</span>{" "}
              <strong style={{ color: M.tx, fontSize: isMobile ? 12 : 14 }}>
                req {usage.requestsRemaining ?? "?"}/{usage.requestsLimit ?? "?"}
              </strong>{" "}
              <strong style={{ color: M.tx, fontSize: isMobile ? 12 : 14 }}>
                tok {usage.outputTokensRemaining ?? "?"}/{usage.outputTokensLimit ?? "?"}
              </strong>
              <button onClick={async () => { try { setUsage(await adminUsageRefresh()); } catch {} }}
                title="새로고침"
                style={{ background: "transparent", border: "none", color: M.tx3, cursor: "pointer", marginLeft: 4, fontSize: 12 }}
              >🔄</button>
            </div>
          )}
          {usage && !usage.ok && (
            <div style={{ color: "#fca5a5", paddingLeft: 14, borderLeft: `1px solid ${M.bd}`, fontSize: isMobile ? 11 : 12 }} title={usage.error || "오류"}>
              API ✗ {usage.error?.includes("미설정") ? "키 미설정" : "오류"}
            </div>
          )}
          <button onClick={() => { setClaudeUsageOpen(true); if (!claudeUsage?.lastCheck) refreshClaudeUsage(); }}
            title="운영자(lsc) 계정의 Claude Max 구독 사용량 (claude /usage)"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: isMobile ? 11 : 12, fontWeight: 700, cursor: "pointer" }}
          >📊 Claude Max</button>
        </div>
        <div style={{ flex: 1 }} />
        {/* 통제 모드 토글 */}
        <button onClick={toggleLockMode} title="통제 모드: ON이면 사용자가 임의로 슬라이드 이동 불가"
          style={{
            background: lockMode ? "#7f1d1d44" : "#05966944",
            border: `1px solid ${lockMode ? "#f8717155" : "#86efac55"}`,
            color: lockMode ? "#fca5a5" : "#86efac",
            borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}
        >
          {lockMode ? "🔒 통제 ON" : "🔓 통제 OFF"}
        </button>

        {/* 운영 액션 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: `1px solid ${M.bd}`, marginRight: 6 }}>
          <button onClick={() => { setKeyModalOpen(true); setKeyModalMsg(""); }} title="마스터 Claude 로그인 키를 직접 등록/갱신 (운영자가 PC에서 claude /login 후 JSON 붙여넣기)"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >🔐 키 등록 {keyStatus.slots && keyStatus.slots.map(s => (
              <span key={s.slot} style={{ marginLeft: 4, color: s.hasCredentials ? "#86efac" : "#f87171" }}>
                {s.slot.toUpperCase()}{s.hasCredentials ? "✓" : "✗"}
              </span>
            ))}</button>
          <button onClick={refreshCreds} disabled={!!busy} title="저장된 마스터 키를 모든 사용자에게 재적용 + tmux 리셋"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === "refresh" ? M.tx3 : M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >{busy === "refresh" ? "⏳" : "🔑"} 키 재적용</button>
          <button onClick={resetAllSessions} disabled={!!busy} title="모든 사용자의 tmux 셸 세션 종료"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === "reset" ? M.tx3 : M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >{busy === "reset" ? "⏳" : "♻"} 전체 세션 리셋</button>
          <button onClick={resetAll} disabled={!!busy} title="모든 사용자의 진행 상황을 초기화 (슬라이드 0번으로)"
            style={{ background: "#7f1d1d44", border: `1px solid #f8717155`, color: busy === "reset-all" ? M.tx3 : "#fca5a5", borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >{busy === "reset-all" ? "⏳" : "🗑"} 전체 진행 초기화</button>
          <button onClick={cleanAllHomes} disabled={!!busy} title="모든 사용자의 홈 폴더 파일 삭제 (인증만 보존)"
            style={{ background: "#7f1d1d44", border: `1px solid #f8717155`, color: busy === "clean-homes" ? M.tx3 : "#fca5a5", borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >{busy === "clean-homes" ? "⏳" : "🧹"} 전체 파일 초기화</button>
          <button onClick={forceRelogin} disabled={!!busy} title="모든 브라우저의 로그인을 무효화하여 재로그인 강제"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === "relogin" ? M.tx3 : M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >{busy === "relogin" ? "⏳" : "🔐"} 전체 재로그인</button>
          <button onClick={masterReset} disabled={!!busy} title="파일+진행+세션+재로그인 한번에 완전 초기화"
            style={{ background: busy === "master" ? "#7f1d1d44" : "linear-gradient(135deg, #dc2626, #991b1b)", border: "none", color: busy === "master" ? M.tx3 : "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer", boxShadow: busy === "master" ? "none" : "0 2px 8px #dc262644" }}
          >{busy === "master" ? "⏳ 초기화 중..." : "💣 완전 초기화"}</button>
        </div>

        {/* 일괄 진행 컨트롤 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: `1px solid ${M.bd}`, marginRight: 6 }}>
          <span style={{ fontSize: 12, color: M.tx3 }}>전체</span>
          <button onClick={() => bulkAdvance(-1)} title="모두 한 슬라이드 뒤로"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >← 이전</button>
          <button onClick={() => bulkAdvance(1)} title="모두 한 슬라이드 앞으로"
            style={{ background: M.or, border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >다음 →</button>
          <button onClick={() => { const v = prompt("모두 이동할 슬라이드 번호 (1부터)"); if (v != null) { const n = parseInt(v, 10); if (Number.isFinite(n) && n >= 1) bulkJump(n - 1); } }} title="모두 특정 슬라이드로"
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >⇥ 점프</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: M.tx3, cursor: "pointer" }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          5초 자동 새로고침
        </label>
        <button
          onClick={load}
          style={{ background: M.bg3, color: M.tx2, border: `1px solid ${M.bd}`, borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          🔄
        </button>
        {lastFetch && (
          <span style={{ fontSize: 12, color: M.tx3 }}>
            {lastFetch.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {error && (
          <div style={{ background: "#7f1d1d44", border: "1px solid #f8717155", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", marginBottom: 16, fontSize: 14 }}>
            오류: {error}
          </div>
        )}

        {actionMsg && (
          <div style={{ background: actionMsg.startsWith("✓") ? "#05966944" : "#7f1d1d44", border: `1px solid ${actionMsg.startsWith("✓") ? "#86efac55" : "#f8717155"}`, borderRadius: 8, padding: "8px 14px", color: actionMsg.startsWith("✓") ? "#86efac" : "#fca5a5", marginBottom: 16, fontSize: 14 }}>
            {actionMsg}
          </div>
        )}

        {users.length === 0 && !error && (
          <div style={{ color: M.tx3, padding: 40, textAlign: "center", fontSize: 14 }}>
            아직 진행 보고가 없습니다. 사용자가 슬라이드를 한 번 이상 넘겨야 표시됩니다.
          </div>
        )}

        {users.length > 0 && isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((u) => {
              const hasProgress = !!u.slideTitle;
              const isActive = hasProgress && u.secondsSinceUpdate != null && u.secondsSinceUpdate < 30;
              const isOffline = !hasProgress || (u.secondsSinceUpdate != null && u.secondsSinceUpdate > 600);
              const slideProgress = !hasProgress ? "-" : u.totalSlides > 0 ? `${u.slideIndex + 1}/${u.totalSlides}` : `${u.slideIndex + 1}`;
              const missionProgress = u.totalMissions > 0 ? `${u.completedCount}/${u.totalMissions}` : `${u.completedCount}`;
              return (
                <div key={u.username} style={{
                  background: u.disabled ? "#7f1d1d33" : u.missionDone ? "#05966922" : M.bg2,
                  border: `1px solid ${M.bd}`,
                  borderRadius: 10, padding: "12px 14px",
                  opacity: u.disabled ? 0.6 : 1,
                }}>
                  {/* 제목 줄 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: u.isPresenter ? M.blM : M.or, fontSize: 16, fontFamily: "var(--workbook-mono)" }}>
                      {u.isPresenter && <span title="발표자" style={{ marginRight: 4 }}>🎤</span>}
                      {u.username}
                    </div>
                    {isOffline ? (
                      <span style={{ background: M.bg3, color: M.tx3, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, border: `1px solid ${M.bd}` }}>오프라인</span>
                    ) : isActive ? (
                      <span style={{ background: "#059669", color: "#fff", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>활동중</span>
                    ) : (
                      <span style={{ background: M.bg3, color: M.tx2, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, border: `1px solid ${M.bd}` }}>대기</span>
                    )}
                    {u.isMissionSlide && u.missionDone && (
                      <span style={{ background: "#059669", color: "#fff", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>✓ 미션 완료</span>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 11, color: M.tx3, fontFamily: "var(--workbook-mono)" }}>{slideProgress} · 미션 {missionProgress}</div>
                  </div>
                  {/* 슬라이드 정보 */}
                  <div style={{ fontSize: 13, color: M.tx2, marginBottom: 4 }}>
                    {u.sectionTitle || <span style={{ color: M.tx3, fontStyle: "italic" }}>대기 중</span>}
                  </div>
                  <div style={{ fontSize: 14, color: M.tx, marginBottom: 10 }}>
                    {u.isMissionSlide && <span style={{ color: M.or, marginRight: 4 }}>🎯</span>}
                    {u.slideTitle || <span style={{ color: M.tx3, fontStyle: "italic" }}>접속 전</span>}
                  </div>
                  {/* 액션 버튼 — wrap */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button onClick={() => nudge(u.username, -1)} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← 이전</button>
                    <button onClick={() => nudge(u.username, 1)} style={{ background: M.or, border: "none", color: "#fff", borderRadius: 5, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>다음 →</button>
                    <button onClick={() => { const v = prompt(`${u.username} 이동할 슬라이드 번호`, String((u.target ?? u.slideIndex) + 1)); if (v != null) { const n = parseInt(v, 10); if (Number.isFinite(n) && n >= 1) jumpTo(u.username, n - 1); } }} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⇥</button>
                    <a href={`/admin/view/${u.username}/`} target="_blank" rel="noopener" style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>👁</a>
                    <button onClick={() => toggleUserLock(u.username, u.lockOverride)} style={{ background: u.lockOverride === true ? "#7f1d1d33" : u.lockOverride === false ? "#05966933" : M.bg3, border: `1px solid ${u.lockOverride === true ? "#f87171" : u.lockOverride === false ? "#86efac" : M.bd}`, color: u.lockOverride === true ? "#fca5a5" : u.lockOverride === false ? "#86efac" : M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{u.lockOverride === true ? "🔒" : u.lockOverride === false ? "🔓" : "🔁"}</button>
                    <button onClick={() => toggleUserDisable(u.username, u.disabled)} style={{ background: u.disabled ? "#7f1d1d44" : M.bg3, border: `1px solid ${u.disabled ? "#f87171" : M.bd}`, color: u.disabled ? "#fca5a5" : M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{u.disabled ? "🔌" : "⏻"}</button>
                    <button onClick={() => cleanOneHome(u.username)} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }} title="파일 초기화">🧹</button>
                    <button onClick={() => resetOneSession(u.username)} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>♻</button>
                    <button onClick={() => resetOneUser(u.username)} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {users.length > 0 && !isMobile && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${M.bd}`, color: M.tx3, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>사용자</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>섹션</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>현재 슬라이드</th>
                <th style={{ textAlign: "right", padding: "10px 12px" }}>슬라이드</th>
                <th style={{ textAlign: "right", padding: "10px 12px" }}>미션 클리어</th>
                <th style={{ textAlign: "center", padding: "10px 12px" }}>현재 미션</th>
                <th style={{ textAlign: "right", padding: "10px 12px" }}>마지막 활동</th>
                <th style={{ textAlign: "center", padding: "10px 12px" }}>상태</th>
                <th style={{ textAlign: "center", padding: "10px 12px" }}>진행 통제</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const hasProgress = !!u.slideTitle;
                const slideProgress = !hasProgress
                  ? "-"
                  : u.totalSlides > 0
                  ? `${u.slideIndex + 1}/${u.totalSlides}`
                  : `${u.slideIndex + 1}`;
                const missionProgress = u.totalMissions > 0
                  ? `${u.completedCount}/${u.totalMissions}`
                  : `${u.completedCount}`;
                const isActive = hasProgress && u.secondsSinceUpdate != null && u.secondsSinceUpdate < 30;
                const isOffline = !hasProgress || (u.secondsSinceUpdate != null && u.secondsSinceUpdate > 600);
                return (
                  <tr key={u.username} style={{
                    borderBottom: `1px solid ${M.bd}`,
                    background: u.disabled ? "#7f1d1d33" : u.missionDone ? "#05966922" : "transparent",
                    color: u.disabled ? M.tx3 : isOffline ? M.tx3 : M.tx,
                    opacity: u.disabled ? 0.6 : 1,
                  }}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, fontFamily: "var(--workbook-mono)", color: u.isPresenter ? M.blM : M.or }}>
                      {u.isPresenter && <span title="발표자" style={{ marginRight: 4 }}>🎤</span>}
                      {u.username}
                    </td>
                    <td style={{ padding: "10px 12px", color: M.tx2 }}>
                      {u.sectionTitle || <span style={{ color: M.tx3, fontStyle: "italic" }}>대기 중</span>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {u.isMissionSlide && <span style={{ color: M.or, marginRight: 4 }}>🎯</span>}
                      {u.slideTitle || <span style={{ color: M.tx3, fontStyle: "italic" }}>접속 전</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--workbook-mono)" }}>
                      {slideProgress}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--workbook-mono)", color: u.completedCount > 0 ? "#86efac" : M.tx3 }}>
                      {missionProgress}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {u.isMissionSlide ? (
                        u.missionDone ? (
                          <span style={{ background: "#059669", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>
                            ✓ 완료
                          </span>
                        ) : (
                          <span style={{ background: M.bg3, color: M.tx2, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, border: `1px solid ${M.bd}` }}>
                            진행중
                          </span>
                        )
                      ) : (
                        <span style={{ color: M.tx3, fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: isOffline ? "#f87171" : isActive ? "#86efac" : M.tx3 }}>
                      {fmtElapsed(u.secondsSinceUpdate)} 전
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {isOffline ? (
                        <span style={{ background: M.bg3, color: M.tx3, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, border: `1px solid ${M.bd}` }}>
                          오프라인
                        </span>
                      ) : isActive ? (
                        <span style={{ background: "#059669", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          활동중
                        </span>
                      ) : (
                        <span style={{ background: M.bg3, color: M.tx2, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, border: `1px solid ${M.bd}` }}>
                          대기
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => nudge(u.username, -1)} title="한 슬라이드 뒤로"
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginRight: 4 }}
                      >←</button>
                      <button onClick={() => nudge(u.username, 1)} title="한 슬라이드 앞으로"
                        style={{ background: M.or, border: "none", color: "#fff", borderRadius: 5, padding: "4px 11px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginRight: 4 }}
                      >→</button>
                      <button onClick={() => { const v = prompt(`${u.username} 이동할 슬라이드 번호 (1부터)`, String((u.target ?? u.slideIndex) + 1)); if (v != null) { const n = parseInt(v, 10); if (Number.isFinite(n) && n >= 1) jumpTo(u.username, n - 1); } }} title="특정 슬라이드로"
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 6 }}
                      >⇥</button>
                      <a
                        href={`/admin/view/${u.username}/`}
                        target="_blank"
                        rel="noopener"
                        title={`${u.username}의 터미널 화면 보기 (read-only)`}
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", marginRight: 4 }}
                      >👁</a>
                      <button
                        onClick={() => toggleUserLock(u.username, u.lockOverride)}
                        title={`통제: ${u.lockOverride === true ? "강제 잠금" : u.lockOverride === false ? "강제 풀림" : "글로벌 따름"} (클릭으로 순환)`}
                        style={{ background: u.lockOverride === true ? "#7f1d1d33" : u.lockOverride === false ? "#05966933" : M.bg3, border: `1px solid ${u.lockOverride === true ? "#f87171" : u.lockOverride === false ? "#86efac" : M.bd}`, color: u.lockOverride === true ? "#fca5a5" : u.lockOverride === false ? "#86efac" : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 4 }}
                      >{u.lockOverride === true ? "🔒" : u.lockOverride === false ? "🔓" : "🔁"}</button>
                      <button
                        onClick={() => toggleUserDisable(u.username, u.disabled)}
                        title={u.disabled ? `${u.username} 접속 허용` : `${u.username} 접속 차단`}
                        style={{ background: u.disabled ? "#7f1d1d44" : M.bg3, border: `1px solid ${u.disabled ? "#f87171" : M.bd}`, color: u.disabled ? "#fca5a5" : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 4 }}
                      >{u.disabled ? "🔌" : "⏻"}</button>
                      <button
                        onClick={() => cleanOneHome(u.username)}
                        disabled={busy === `clean:${u.username}`}
                        title={`${u.username}의 파일 초기화`}
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === `clean:${u.username}` ? M.tx3 : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer", marginRight: 4 }}
                      >🧹</button>
                      <button
                        onClick={() => resetOneSession(u.username)}
                        disabled={busy === `reset:${u.username}`}
                        title={`${u.username}의 tmux 세션 종료`}
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === `reset:${u.username}` ? M.tx3 : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer", marginRight: 4 }}
                      >♻</button>
                      <button
                        onClick={() => resetOneUser(u.username)}
                        disabled={busy === `resetuser:${u.username}`}
                        title={`${u.username}의 진행 상황 초기화`}
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === `resetuser:${u.username}` ? M.tx3 : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
                      >🗑</button>
                      {u.target != null && u.target !== u.slideIndex && (
                        <div style={{ fontSize: 11, color: M.tx3, marginTop: 4, fontFamily: "var(--workbook-mono)" }}>
                          target: {u.target + 1}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Claude Max 사용량 모달 */}
      {claudeUsageOpen && (
        <div onClick={() => setClaudeUsageOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 14,
            padding: "24px 28px", maxWidth: 720, width: "100%",
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: M.tx, flex: 1 }}>📊 Claude Max 사용량</div>
              <button onClick={refreshClaudeUsage} disabled={claudeUsageBusy}
                style={{ background: M.or, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: claudeUsageBusy ? "wait" : "pointer", marginRight: 8 }}>
                {claudeUsageBusy ? "조회 중..." : "🔄 새로고침"}
              </button>
              <button onClick={() => setClaudeUsageOpen(false)}
                style={{ background: "transparent", border: "none", color: M.tx3, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: M.tx3, marginBottom: 10 }}>
              운영자(lsc) 계정에서 <code>claude /usage</code> 슬래시 커맨드 출력 — 새로고침은 약 10초 소요
            </div>
            {claudeUsage?.lastCheck && (
              <div style={{ fontSize: 11, color: M.tx3, marginBottom: 10 }}>
                마지막 조회: {new Date(claudeUsage.lastCheck).toLocaleTimeString()}
              </div>
            )}
            {claudeUsage?.error && (
              <div style={{ background: "#7f1d1d44", color: "#fca5a5", border: "1px solid #f8717155", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 13 }}>
                오류: {claudeUsage.error}
              </div>
            )}
            <pre style={{
              background: "#0a0a0a", color: "#e5e5e5",
              padding: "16px", borderRadius: 8,
              fontSize: 12, fontFamily: "var(--workbook-mono)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: "60vh", overflowY: "auto",
              border: `1px solid ${M.bd}`,
              margin: 0,
            }}>
              {claudeUsage?.output || "(출력 없음 — 새로고침 클릭)"}
            </pre>
          </div>
        </div>
      )}

      {/* 마스터 키 등록 모달 */}
      {keyModalOpen && (
        <div onClick={() => !keyModalBusy && setKeyModalOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 14,
            padding: "24px 28px", maxWidth: 640, width: "100%",
            maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: M.tx, flex: 1 }}>🔐 마스터 키 등록 / 갱신</div>
              <button onClick={() => !keyModalBusy && setKeyModalOpen(false)} disabled={keyModalBusy}
                style={{ background: "transparent", border: "none", color: M.tx3, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7, marginBottom: 16, background: M.bg3, padding: "12px 14px", borderRadius: 8, border: `1px solid ${M.bd}` }}>
              <strong>1.</strong> 운영자 PC에서 <code style={{ background: M.bg, padding: "1px 6px", borderRadius: 4, color: M.or }}>claude /login</code> 수행<br />
              <strong>2.</strong> <code style={{ background: M.bg, padding: "1px 6px", borderRadius: 4 }}>~/.claude/.credentials.json</code> 파일 내용을 복사 → 아래 첫 번째 칸에 붙여넣기<br />
              <strong>3.</strong> (선택) <code style={{ background: M.bg, padding: "1px 6px", borderRadius: 4 }}>~/.claude.json</code> 파일 내용도 복사 → 두 번째 칸에 붙여넣기 (인증 키만 추출됨)<br />
              <strong>4.</strong> 슬롯 선택 후 저장 → 모든 사용자에게 자동 재적용 옵션
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              {["a", "b"].map((s) => {
                const status = keyStatus.slots?.find(x => x.slot === s);
                const filled = status?.hasCredentials;
                return (
                  <button key={s} onClick={() => setKeyModalSlot(s)}
                    style={{
                      flex: 1, padding: "10px",
                      background: keyModalSlot === s ? M.or : M.bg3,
                      border: `1px solid ${keyModalSlot === s ? M.or : M.bd}`,
                      color: keyModalSlot === s ? "#fff" : M.tx2,
                      borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    슬롯 {s.toUpperCase()} {filled && <span style={{ color: keyModalSlot === s ? "#fff" : "#86efac", marginLeft: 6 }}>✓ 등록됨</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: M.tx2, marginBottom: 6 }}>
                <code>.credentials.json</code> 내용 (필수)
              </div>
              <textarea
                value={keyModalCred}
                onChange={(e) => setKeyModalCred(e.target.value)}
                placeholder='{"claudeAiOauth":{"accessToken":"...","refreshToken":"..."}}'
                disabled={keyModalBusy}
                style={{
                  width: "100%", minHeight: 100, padding: "10px 12px",
                  background: M.bg, color: M.tx, border: `1px solid ${M.bd}`,
                  borderRadius: 8, fontSize: 12, fontFamily: "var(--workbook-mono)",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: M.tx2, marginBottom: 6 }}>
                <code>.claude.json</code> 내용 (선택 — 인증 관련 키만 추출됨)
              </div>
              <textarea
                value={keyModalCfg}
                onChange={(e) => setKeyModalCfg(e.target.value)}
                placeholder='{"userID":"...","oauthAccount":{...}}'
                disabled={keyModalBusy}
                style={{
                  width: "100%", minHeight: 80, padding: "10px 12px",
                  background: M.bg, color: M.tx, border: `1px solid ${M.bd}`,
                  borderRadius: 8, fontSize: 12, fontFamily: "var(--workbook-mono)",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            {keyModalMsg && (
              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: keyModalMsg.startsWith("✓") ? "#05966944" : "#7f1d1d44",
                color: keyModalMsg.startsWith("✓") ? "#86efac" : "#fca5a5",
                border: `1px solid ${keyModalMsg.startsWith("✓") ? "#86efac55" : "#f8717155"}`,
              }}>{keyModalMsg}</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => !keyModalBusy && setKeyModalOpen(false)} disabled={keyModalBusy}
                style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: keyModalBusy ? "wait" : "pointer" }}
              >취소</button>
              <button onClick={handleSaveKey} disabled={keyModalBusy || !keyModalCred.trim()}
                style={{ background: keyModalBusy || !keyModalCred.trim() ? M.bg3 : M.or, border: "none", color: keyModalBusy || !keyModalCred.trim() ? M.tx3 : "#fff", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 800, cursor: keyModalBusy || !keyModalCred.trim() ? "default" : "pointer" }}
              >{keyModalBusy ? "저장 중..." : "💾 슬롯 " + keyModalSlot.toUpperCase() + "에 저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
