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
  adminCleanAllHomes,
  adminSetLockMode,
  adminLockUser,
  adminResetAll,
  adminResetUser,
  adminDisableUser,
  adminOperatorAuthStatus,
  adminRefreshFromOperator,
  adminUsage,
  adminUsageRefresh,
  adminClaudeUsage,
  adminClaudeUsageRefresh,
  adminVncStatus,
  adminVncRecover,
  adminVncResetUser,
  adminVncRestartAll,
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

  // 운영자(user00) Claude 로그인 상태 — 만료되면 user00 VNC 에서 재로그인 필요.
  const [opAuth, setOpAuth] = useState(null);
  async function loadOpAuth() {
    try { setOpAuth(await adminOperatorAuthStatus()); } catch {}
  }
  useEffect(() => {
    loadOpAuth();
    const id = setInterval(loadOpAuth, 60_000); // 1분마다 재확인
    return () => clearInterval(id);
  }, []);
  const [opAuthGuideOpen, setOpAuthGuideOpen] = useState(false);

  async function refreshFromOp() {
    if (!confirm("user00 의 Claude 로그인 크리덴셜을 user01~ 에게 복사합니다. 진행할까요?")) return;
    setBusy("refresh-op"); setActionMsg("");
    try {
      const r = await adminRefreshFromOperator();
      setActionMsg(`✓ user00 → 전체 복사 완료 (${r.copied}명, 스킵 ${r.skipped})`);
    } catch (e) {
      setActionMsg(`✗ 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }

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

  // 전체 재시작: 모든 사용자 홈 파일 삭제 → user00 크레덴셜 재배포 →
  // 진행 상황 초기화 → VNC 체인 재기동(xstartup 재실행 = 한글 IME 재설정) →
  // 브라우저 재로그인 강제. "처음 상태 (프로그램 깔린 채)" 로 만드는 단일 버튼.
  async function fullRestart() {
    if (!confirm("⚠️ 전체 재시작: 모든 사용자 파일 삭제 → 크레덴셜 재배포 → 진행 초기화 → VNC 재기동 → 재로그인\n\n학습자 화면이 잠시 끊기고 처음 상태로 돌아갑니다. 진행할까요?")) return;
    setBusy("full-restart"); setActionMsg("🔄 전체 재시작 진행 중...");
    try {
      setActionMsg("🔄 1/5 — 파일 초기화...");
      await adminCleanAllHomes();
      setActionMsg("🔄 2/5 — user00 크레덴셜 복사...");
      // user00 로그인이 살아있으면 그걸 전체에 복사, 실패하면 슬롯 키 fallback
      try { await adminRefreshFromOperator(); }
      catch { await adminRefreshCredentials(); }
      setActionMsg("🔄 3/5 — 진행 초기화...");
      await adminResetAll();
      setActionMsg("🔄 4/5 — VNC 재기동 (한글 IME 재설정)...");
      await adminVncRestartAll();
      setActionMsg("🔄 5/5 — 재로그인 강제...");
      await adminForceRelogin();
      setActionMsg("✓ 전체 재시작 완료 — 모든 사용자가 처음 상태입니다");
      load();
      loadVncStatus();
    } catch (e) {
      setActionMsg(`✗ 전체 재시작 중 실패: ${e.message || e}`);
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
    if (next && !confirm(`${u} 의 접속을 차단합니다. 사용자는 데스크톱과 슬라이드에 접근할 수 없게 됩니다.`)) return;
    setBusy(`disable:${u}`);
    try { await adminDisableUser(u, next); setActionMsg(`✓ ${u} ${next ? "차단됨" : "허용됨"}`); load(); }
    catch (e) { setActionMsg(`✗ 실패: ${e.message || e}`); }
    finally { setBusy(""); }
  }

  // ─── VNC 복구/상태 ───
  // novnc-userXX 서비스가 재부팅 뒤 올라오지 않거나 죽는 사례가 반복됨 →
  // 현장에서 502가 뜨면 이 버튼으로 즉시 스윕.
  const [vncStatus, setVncStatus] = useState(null); // {total, dead, users:[{user, port, service_active, listening}]}
  async function loadVncStatus() {
    try { setVncStatus(await adminVncStatus()); } catch {}
  }
  useEffect(() => {
    loadVncStatus();
    const id = setInterval(loadVncStatus, 30000); // 30초 폴링 — 죽으면 조기 감지
    return () => clearInterval(id);
  }, []);
  async function recoverVnc() {
    if (!confirm("죽은 VNC 서비스(novnc-userXX)를 일괄 재기동합니다. 접속 중인 사용자는 잠깐 끊길 수 있습니다. 진행할까요?")) return;
    setBusy("vnc-recover"); setActionMsg("🔧 VNC 복구 진행 중...");
    try {
      const r = await adminVncRecover();
      const failedMsg = r.failed > 0 ? ` (실패: ${r.failed_users?.join(", ") || r.failed})` : "";
      setActionMsg(`✓ VNC 복구 — 재기동 ${r.recovered}명${failedMsg}`);
      loadVncStatus();
    } catch (e) {
      setActionMsg(`✗ VNC 복구 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  async function resetVncForUser(username) {
    if (!confirm(`${username} 의 VNC 세션(xfce + noVNC)을 재기동합니다. 해당 사용자 데스크톱이 잠깐 끊깁니다. 진행할까요?`)) return;
    setBusy(`vnc-reset:${username}`); setActionMsg(`🖥 ${username} VNC 재기동 중...`);
    try {
      const r = await adminVncResetUser(username);
      const live = r.service_active === "active" && r.listening;
      setActionMsg(`${live ? "✓" : "⚠️"} ${username} VNC 재기동 — ${r.service_active}, listening=${r.listening}`);
      loadVncStatus();
    } catch (e) {
      setActionMsg(`✗ ${username} VNC 재기동 실패: ${e.message || e}`);
    } finally { setBusy(""); }
  }
  // 특정 사용자의 VNC가 죽어있는지
  function vncDeadFor(username) {
    if (!vncStatus?.users) return false;
    const row = vncStatus.users.find((x) => x.user === username);
    if (!row) return false;
    return row.service_active !== "active" || !row.listening;
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
          {/* user00 Claude 로그인 상태 배지 — 풀리면 빨간 경고 + 가이드 모달 */}
          {(() => {
            if (!opAuth) return null;
            const s = opAuth.authStatus;
            const color = s === "expired" ? "#fca5a5" : s === "expiring" ? "#fbbf24" : s === "ok" ? "#86efac" : "#9ca3af";
            const bg = s === "expired" ? "#7f1d1d66" : s === "expiring" ? "#78350f66" : s === "ok" ? "#05966944" : M.bg3;
            const border = s === "expired" ? "#f87171" : s === "expiring" ? "#fbbf24" : s === "ok" ? "#86efac55" : M.bd;
            const label = s === "expired" ? "로그인 만료"
              : s === "expiring" ? `만료 임박 (${opAuth.daysLeft}일)`
              : s === "ok" ? (opAuth.daysLeft != null ? `user00 로그인 ✓ (${opAuth.daysLeft}일 남음)` : "user00 로그인 ✓")
              : s === "missing" ? "user00 미로그인"
              : s === "invalid" ? "user00 키 손상"
              : "user00 상태 확인 중";
            return (
              <button
                onClick={() => setOpAuthGuideOpen(true)}
                title="user00 의 Claude 로그인 상태 — 클릭하면 재로그인 가이드"
                style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {s === "expired" ? "⚠️" : s === "expiring" ? "⏰" : s === "ok" ? "👤" : "❓"} {label}
              </button>
            );
          })()}
          <button onClick={refreshFromOp} disabled={!!busy || opAuth?.authStatus === "expired" || opAuth?.authStatus === "missing"}
            title="user00 의 Claude 로그인 크리덴셜을 user01~ 에 복사"
            style={{
              background: M.bg3, border: `1px solid ${M.bd}`,
              color: busy === "refresh-op" ? M.tx3 : M.tx2,
              borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700,
              cursor: busy ? "wait" : (opAuth?.authStatus === "expired" || opAuth?.authStatus === "missing") ? "not-allowed" : "pointer",
              opacity: (opAuth?.authStatus === "expired" || opAuth?.authStatus === "missing") ? 0.5 : 1,
            }}
          >{busy === "refresh-op" ? "⏳" : "📋"} user00 → 전체 복사</button>
          {/* VNC 복구: 평소엔 회색, 죽은 서비스 있으면 빨간 경고색 + 개수 뱃지 */}
          <button
            onClick={recoverVnc}
            disabled={!!busy}
            title={vncStatus ? `novnc-userXX 서비스 중 ${vncStatus.dead}/${vncStatus.total} 죽음 — 누르면 일괄 재기동` : "VNC 서비스 상태 확인 중..."}
            style={{
              background: vncStatus?.dead > 0 ? "#7f1d1d66" : M.bg3,
              border: `1px solid ${vncStatus?.dead > 0 ? "#f87171" : M.bd}`,
              color: busy === "vnc-recover" ? M.tx3 : (vncStatus?.dead > 0 ? "#fca5a5" : M.tx2),
              borderRadius: 6, padding: "5px 10px", fontSize: 13, fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            {busy === "vnc-recover" ? "⏳" : "🔧"} VNC 복구
            {vncStatus && (
              <span style={{
                background: vncStatus.dead > 0 ? "#dc2626" : "#05966966",
                color: "#fff",
                borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800,
                fontFamily: "var(--workbook-mono)",
              }}>
                {vncStatus.total - vncStatus.dead}/{vncStatus.total}
              </span>
            )}
          </button>
          <button onClick={fullRestart} disabled={!!busy} title="전체 재시작: 파일 삭제 → 크레덴셜 재배포 → 진행 초기화 → VNC 재기동(한글 IME 포함) → 재로그인 강제"
            style={{ background: busy === "full-restart" ? "#7f1d1d44" : "linear-gradient(135deg, #dc2626, #991b1b)", border: "none", color: busy === "full-restart" ? M.tx3 : "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer", boxShadow: busy === "full-restart" ? "none" : "0 2px 8px #dc262644" }}
          >{busy === "full-restart" ? "⏳ 재시작 중..." : "🔄 전체 재시작"}</button>
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
                    <a
                      href={`/${u.username}/desktop/vnc.html?autoconnect=1&view_only=true&resize=remote&path=${u.username}/desktop/websockify`}
                      target="_blank" rel="noopener"
                      title={vncDeadFor(u.username) ? `${u.username} VNC 죽음 — 상단 "🔧 VNC 복구" 먼저 눌러주세요` : `${u.username} 데스크톱 화면 관찰 (read-only)`}
                      style={{
                        background: vncDeadFor(u.username) ? "#7f1d1d44" : M.bg3,
                        border: `1px solid ${vncDeadFor(u.username) ? "#f87171" : M.bd}`,
                        color: vncDeadFor(u.username) ? "#fca5a5" : M.tx2,
                        borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, textDecoration: "none",
                      }}
                    >🖥</a>
                    <button
                      onClick={() => resetVncForUser(u.username)}
                      disabled={busy === `vnc-reset:${u.username}`}
                      title={`${u.username} VNC 세션 재기동 (xfce + noVNC)`}
                      style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === `vnc-reset:${u.username}` ? M.tx3 : M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
                    >{busy === `vnc-reset:${u.username}` ? "⏳" : "🖥↻"}</button>
                    <button onClick={() => toggleUserLock(u.username, u.lockOverride)} style={{ background: u.lockOverride === true ? "#7f1d1d33" : u.lockOverride === false ? "#05966933" : M.bg3, border: `1px solid ${u.lockOverride === true ? "#f87171" : u.lockOverride === false ? "#86efac" : M.bd}`, color: u.lockOverride === true ? "#fca5a5" : u.lockOverride === false ? "#86efac" : M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{u.lockOverride === true ? "🔒" : u.lockOverride === false ? "🔓" : "🔁"}</button>
                    <button onClick={() => toggleUserDisable(u.username, u.disabled)} style={{ background: u.disabled ? "#7f1d1d44" : M.bg3, border: `1px solid ${u.disabled ? "#f87171" : M.bd}`, color: u.disabled ? "#fca5a5" : M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{u.disabled ? "🔌" : "⏻"}</button>
                    <button onClick={() => resetOneUser(u.username)} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 5, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }} title="진행 초기화">🗑</button>
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
                        href={`/${u.username}/desktop/vnc.html?autoconnect=1&view_only=true&resize=remote&path=${u.username}/desktop/websockify`}
                        target="_blank"
                        rel="noopener"
                        title={vncDeadFor(u.username) ? `${u.username} VNC 서비스 죽음 — 상단 "🔧 VNC 복구" 먼저 실행` : `${u.username}의 데스크톱 화면 보기 (read-only)`}
                        style={{
                          background: vncDeadFor(u.username) ? "#7f1d1d44" : M.bg3,
                          border: `1px solid ${vncDeadFor(u.username) ? "#f87171" : M.bd}`,
                          color: vncDeadFor(u.username) ? "#fca5a5" : M.tx2,
                          borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block", marginRight: 4,
                        }}
                      >🖥</a>
                      <button
                        onClick={() => resetVncForUser(u.username)}
                        disabled={busy === `vnc-reset:${u.username}`}
                        title={`${u.username} VNC 세션 재기동 (vnc → vnc-xfce → novnc)`}
                        style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: busy === `vnc-reset:${u.username}` ? M.tx3 : M.tx2, borderRadius: 5, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer", marginRight: 4 }}
                      >{busy === `vnc-reset:${u.username}` ? "⏳" : "🖥↻"}</button>
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

      {/* user00 재로그인 가이드 모달 */}
      {opAuthGuideOpen && (
        <div onClick={() => setOpAuthGuideOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 12,
            maxWidth: 620, width: "100%", maxHeight: "90vh", overflow: "auto",
            padding: 24, color: M.tx,
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: M.or, marginBottom: 12 }}>
              👤 user00 Claude 로그인 상태
            </div>
            {opAuth && (
              <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.8, background: M.bg3, padding: "12px 16px", borderRadius: 8, border: `1px solid ${M.bd}` }}>
                <div>상태: <strong style={{ color: opAuth.authStatus === "ok" ? "#86efac" : opAuth.authStatus === "expired" ? "#fca5a5" : opAuth.authStatus === "expiring" ? "#fbbf24" : M.tx2 }}>
                  {opAuth.authStatus === "ok" ? "✓ 정상" : opAuth.authStatus === "expired" ? "✗ 만료됨 — 재로그인 필요" : opAuth.authStatus === "expiring" ? "⏰ 곧 만료 (1일 이내)" : opAuth.authStatus === "missing" ? "✗ 크리덴셜 없음 — /login 필요" : opAuth.authStatus === "invalid" ? "✗ 파일 손상" : opAuth.authStatus}
                </strong></div>
                {opAuth.expiresAt && (
                  <div>만료일: <span style={{ fontFamily: "var(--workbook-mono)", color: M.tx2 }}>{new Date(opAuth.expiresAt).toLocaleString()}</span>
                    {opAuth.daysLeft != null && <span style={{ color: M.tx3, marginLeft: 8 }}>({opAuth.daysLeft >= 0 ? `${opAuth.daysLeft}일 남음` : `${-opAuth.daysLeft}일 지남`})</span>}
                  </div>
                )}
                {opAuth.mtime && (
                  <div>마지막 갱신: <span style={{ fontFamily: "var(--workbook-mono)", color: M.tx2 }}>{new Date(opAuth.mtime).toLocaleString()}</span></div>
                )}
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 800, color: M.tx, marginBottom: 10 }}>
              🔄 재로그인 방법 (로그인이 풀렸거나 만료된 경우)
            </div>
            <ol style={{ fontSize: 13, color: M.tx2, lineHeight: 1.9, paddingLeft: 20, marginBottom: 16 }}>
              <li>user00 의 VNC 데스크톱에 접속
                <div style={{ marginTop: 4 }}>
                  <a href="/user00/desktop/" target="_blank" rel="noopener" style={{ background: M.or, color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>🖥 user00 데스크톱 열기</a>
                </div>
              </li>
              <li>xfce4 데스크톱에서 터미널 열기 (바탕화면 우클릭 → Terminal)</li>
              <li>터미널에서 <code style={{ background: M.bg3, color: M.or, padding: "1px 6px", borderRadius: 3, fontFamily: "var(--workbook-mono)" }}>claude</code> 실행 → 이어서 <code style={{ background: M.bg3, color: M.or, padding: "1px 6px", borderRadius: 3, fontFamily: "var(--workbook-mono)" }}>/login</code> 입력</li>
              <li>브라우저 인증 흐름 완료 → 터미널로 돌아와 로그인 완료 메시지 확인</li>
              <li>이 창을 닫고 상단 <strong>📋 user00 → 전체 복사</strong> 버튼 클릭</li>
            </ol>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={loadOpAuth} style={{ background: M.bg3, border: `1px solid ${M.bd}`, color: M.tx2, borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🔄 상태 새로고침</button>
              <button onClick={() => setOpAuthGuideOpen(false)} style={{ background: M.or, border: "none", color: "#fff", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
}
