import { useState, useEffect, useRef, lazy, Suspense } from "react";
import MissionProgressTracker from "./MissionProgressTracker.jsx";
import Confetti from "./Confetti.jsx";

const NativeTerminal = lazy(() => import("../NativeTerminal.jsx"));

export default function MissionSlide({
  mission, interpolate, onComplete, onPtyReady,
  allMissions, completedSet, onJump, termFontSize, darkMode, M,
}) {
  const [prompt, setPrompt] = useState("");
  const [checks, setChecks] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEntry, setShowEntry] = useState(true);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const localWriteRef = useRef(null);

  useEffect(() => {
    setPrompt(interpolate(mission.promptTemplate));
    setChecks(mission.checklist.map(() => false));
    setShowConfetti(false);
    setHintsOpen(false);
    setCopied(false);
    setSent(false);
    setShowEntry(true);
    const t = setTimeout(() => setShowEntry(false), 900);
    return () => clearTimeout(t);
  }, [mission.id, interpolate]);

  // 자동 체크: 3초 폴링으로 파일 존재/내용 감지
  useEffect(() => {
    if (!mission.autoChecks || mission.autoChecks.length === 0) return;

    let cancelled = false;

    async function runAutoChecks() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const results = await Promise.all(
          mission.autoChecks.map(async (check) => {
            try {
              if (check.type === "file-exists") {
                const result = await invoke("run_shell", { command: `test -e "${check.path}" && echo "YES" || echo "NO"` });
                return result.trim() === "YES";
              }
              if (check.type === "any-exists") {
                const tests = check.paths.map(p => `test -e "${p}"`).join(" || ");
                const result = await invoke("run_shell", { command: `(${tests}) && echo "YES" || echo "NO"` });
                return result.trim() === "YES";
              }
              if (check.type === "file-contains") {
                const result = await invoke("run_shell", { command: `grep -l "${check.keyword}" "${check.path}" 2>/dev/null && echo "YES" || echo "NO"` });
                return result.trim().includes("YES");
              }
              if (check.type === "any-contains") {
                const greps = check.paths.map(p => `grep -l "${check.keyword}" "${p}" 2>/dev/null`).join(" || ");
                const result = await invoke("run_shell", { command: `(${greps}) && echo "YES" || echo "NO"` });
                return result.trim().includes("YES");
              }
              if (check.type === "global-contains") {
                // 홈 디렉토리의 글로벌 설정 파일에서 키워드 검색
                const result = await invoke("run_shell", { command: `grep -l "${check.keyword}" ~/".claude.json" 2>/dev/null && echo "YES" || echo "NO"` });
                return result.trim().includes("YES");
              }
              return false;
            } catch {
              return false;
            }
          })
        );
        if (!cancelled) {
          setChecks(results);
        }
      } catch {}
    }

    // 즉시 1회 + 3초 폴링
    runAutoChecks();
    const interval = setInterval(runAutoChecks, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mission.id, mission.autoChecks]);

  const allChecked = checks.length > 0 && checks.every(Boolean);
  const alreadyDone = completedSet.has(mission.id);
  const missionNumber = allMissions.findIndex(m => m.id === mission.id) + 1;

  // 자동 체크 모두 통과 시 자동 완료
  useEffect(() => {
    if (allChecked && !alreadyDone) {
      const t = setTimeout(() => {
        setShowConfetti(true);
        onComplete(mission.id);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [allChecked, alreadyDone, mission.id, onComplete]);

  const handleComplete = () => {
    if (!alreadyDone) {
      setShowConfetti(true);
      onComplete(mission.id);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSend = () => {
    if (localWriteRef.current && prompt.trim()) {
      localWriteRef.current(prompt + "\r");
      setSent(true);
    }
  };

  // autoChecks가 없는 체험: 실행 버튼 클릭 후 15초 대기 → 자동 완료
  useEffect(() => {
    if (mission.autoChecks || !sent || alreadyDone) return;
    setChecks([false]); // "실행 중..." 표시
    const t = setTimeout(() => {
      setChecks([true]);
    }, 15000);
    return () => clearTimeout(t);
  }, [sent, mission.autoChecks, alreadyDone, mission.id]);

  const glass = {
    background: `${M.bg2}dd`,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
      <Confetti active={showConfetti} />

      {/* Entry overlay */}
      {showEntry && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: `${M.bg}f0`,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "missionEntryFade 0.9s ease-out forwards",
        }}>
          <style>{`
            @keyframes missionEntryFade {
              0% { opacity: 1; }
              50% { opacity: 1; }
              100% { opacity: 0; pointer-events: none; }
            }
            @keyframes missionBounceIn {
              0% { transform: scale(0.6) translateY(20px); opacity: 0; }
              60% { transform: scale(1.05) translateY(-4px); opacity: 1; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}</style>
          <div style={{ textAlign: "center", animation: "missionBounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: "0 auto 16px",
              background: `linear-gradient(135deg, ${M.or}22, ${M.or}08)`,
              border: `2px solid ${M.or}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 40px ${M.or}22`,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={M.or} strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div style={{ fontSize: 13, color: M.or, fontWeight: 700, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>
              Mission {missionNumber}/{allMissions.length}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, letterSpacing: -0.5 }}>
              {mission.label}
            </div>
          </div>
        </div>
      )}

      {/* Mission banner */}
      <div style={{
        background: `linear-gradient(90deg, ${M.or}14, transparent)`,
        borderBottom: `1px solid ${M.or}33`,
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${M.or}, ${M.orD})`,
          color: "#fff", borderRadius: 8,
          padding: "4px 12px", fontSize: 12, fontWeight: 800,
          letterSpacing: 0.5,
          boxShadow: `0 2px 8px ${M.or}44`,
        }}>
          MISSION {missionNumber}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: M.tx, letterSpacing: -0.3 }}>
          {mission.label}
        </div>
        <div style={{ fontSize: 13, color: M.tx2, flex: 1 }}>
          {mission.description}
        </div>
        {alreadyDone && (
          <div style={{
            background: `linear-gradient(135deg, #059669, #10b981)`,
            color: "#fff", borderRadius: 8,
            padding: "4px 12px", fontSize: 12, fontWeight: 700,
            boxShadow: "0 2px 8px #05966944",
          }}>
            CLEAR
          </div>
        )}
      </div>

      {/* Main: briefing (35%) + terminal (65%) */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* Left: briefing */}
        <div style={{
          width: "35%", minWidth: 280, maxWidth: 420,
          borderRight: `1px solid ${M.bd}`,
          display: "flex", flexDirection: "column",
          overflowY: "auto", background: M.bg,
        }}>
          <div style={{ padding: "20px 20px", flex: 1 }}>
            {/* Prompt area */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: M.or, marginBottom: 10,
              letterSpacing: 2, textTransform: "uppercase",
            }}>
              Prompt
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              style={{
                width: "100%", minHeight: 120, resize: "vertical",
                background: `${M.bg3}cc`, color: M.or,
                border: `1px solid ${M.or}33`,
                borderRadius: 12, padding: "14px 16px",
                fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                lineHeight: 1.8, outline: "none", boxSizing: "border-box",
                transition: "border-color .2s, box-shadow .2s",
              }}
              onFocus={e => { e.target.style.borderColor = M.or + "88"; e.target.style.boxShadow = `0 0 0 3px ${M.or}18`; }}
              onBlur={e => { e.target.style.borderColor = M.or + "33"; e.target.style.boxShadow = "none"; }}
            />

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleCopy} style={{
                flex: 1, ...glass,
                color: copied ? "#86efac" : M.tx,
                border: `1px solid ${copied ? "#86efac44" : M.bd}`,
                borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700,
                cursor: "pointer", transition: "all .2s ease-out",
              }}>
                {copied ? "✓ 복사됨" : "복사"}
              </button>
              <button onClick={handleSend} style={{
                flex: 1,
                background: `linear-gradient(135deg, ${M.or}, ${M.orD})`,
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px", fontSize: 13, fontWeight: 800,
                cursor: "pointer", transition: "all .15s ease-out",
                boxShadow: `0 2px 12px ${M.or}44`,
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              >
                ▶ 실행
              </button>
            </div>

            {/* Hints */}
            {mission.hints && mission.hints.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <button onClick={() => setHintsOpen(!hintsOpen)} style={{
                  background: "none", border: "none", color: M.tx3,
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6, padding: 0,
                  transition: "color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = M.tx2}
                onMouseLeave={e => e.currentTarget.style.color = M.tx3}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                    transition: "transform .2s", transform: hintsOpen ? "rotate(90deg)" : "rotate(0)",
                  }}>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  힌트 {hintsOpen ? "접기" : "보기"}
                </button>
                <div style={{
                  maxHeight: hintsOpen ? 200 : 0, overflow: "hidden",
                  transition: "max-height .3s ease-out, opacity .2s",
                  opacity: hintsOpen ? 1 : 0,
                }}>
                  <div style={{
                    marginTop: 8, ...glass, borderRadius: 10,
                    padding: "12px 14px", border: `1px solid ${M.bd}`,
                  }}>
                    {mission.hints.map((h, i) => (
                      <div key={i} style={{ fontSize: 13, color: M.tx2, lineHeight: 1.8, display: "flex", gap: 8 }}>
                        <span style={{ color: M.or, flexShrink: 0 }}>*</span> {h}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div style={{ marginTop: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: M.tx3, marginBottom: 10,
                letterSpacing: 2, textTransform: "uppercase",
              }}>
                Checklist
              </div>
              {mission.checklist.map((item, i) => (
                <label key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", cursor: mission.autoChecks ? "default" : "pointer", fontSize: 13, color: M.tx2,
                  borderRadius: 8, marginBottom: 4,
                  background: checks[i] ? `${M.or}08` : "transparent",
                  transition: "background .2s",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${checks[i] ? M.or : M.bd}`,
                    background: checks[i] ? M.or : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease-out",
                  }}>
                    {checks[i] && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={checks[i] || false}
                    readOnly={!!mission.autoChecks}
                    onChange={!mission.autoChecks ? () => setChecks(prev => { const n = [...prev]; n[i] = !n[i]; return n; }) : undefined}
                    style={{ display: "none" }}
                  />
                  <span style={{
                    textDecoration: checks[i] ? "line-through" : "none",
                    color: checks[i] ? M.tx3 : M.tx2,
                    transition: "color .2s",
                  }}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Complete button */}
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${M.bd}` }}>
            <button
              onClick={handleComplete}
              disabled={alreadyDone}
              style={{
                width: "100%",
                background: alreadyDone
                  ? `linear-gradient(135deg, #059669, #10b981)`
                  : allChecked
                  ? `linear-gradient(135deg, #059669, #10b981)`
                  : `${M.bg2}`,
                color: alreadyDone || allChecked ? "#fff" : M.tx3,
                border: alreadyDone || allChecked ? "none" : `1px solid ${M.bd}`,
                borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 800,
                cursor: alreadyDone ? "default" : "pointer",
                transition: "all .3s ease-out",
                boxShadow: alreadyDone || allChecked ? "0 4px 16px #05966944" : "none",
              }}
            >
              {alreadyDone ? "✓ CLEAR" : allChecked ? "완료하기" : "체크리스트를 완료해주세요"}
            </button>
          </div>
        </div>

        {/* Right: terminal (65%) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Suspense fallback={
            <div style={{
              color: M.tx3, padding: 24, fontFamily: "monospace",
              background: M.bg3, height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${M.or}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                터미널 준비 중...
              </div>
            </div>
          }>
            <NativeTerminal
              style={{ height: "100%", borderRadius: 0, border: "none" }}
              fontSize={termFontSize}
              darkMode={darkMode}
              onPtyReady={({ write }) => {
                localWriteRef.current = write;
                if (onPtyReady) onPtyReady({ write });
              }}
            />
          </Suspense>
        </div>
      </div>

      {/* Bottom tracker */}
      <MissionProgressTracker
        missions={allMissions}
        currentId={mission.id}
        completedSet={completedSet}
        onJump={onJump}
        M={M}
      />
    </div>
  );
}
