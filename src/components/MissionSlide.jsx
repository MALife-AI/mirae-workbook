import { useState, useEffect, useRef, lazy, Suspense } from "react";
import MissionProgressTracker from "./MissionProgressTracker.jsx";
import Confetti from "./Confetti.jsx";
import FileExplorer from "./FileExplorer.jsx";
import AssistantOverlay from "./AssistantOverlay.jsx";
import { isTauri, runMissionChecks, copyToClipboard, clearMySession, sendToMyTerminal, pasteToMyTerminal, setDemoMode, gradeMission, readProjectFile, cleanWorkspace } from "../lib/runtime.js";

const NativeTerminal = lazy(() => import("../NativeTerminal.jsx"));
const TtydEmbed = lazy(() => import("./TtydEmbed.jsx"));
const Terminal = isTauri() ? NativeTerminal : TtydEmbed;

export default function MissionSlide({
  mission, section, interpolate, onComplete, onPtyReady, onAdvance,
  allMissions, completedSet, onJump, termFontSize, setTermFontSize, darkMode, M,
}) {
  const [panelZoom, setPanelZoom] = useState(100); // %
  const [termZoom, setTermZoom] = useState(100); // %
  // 브리핑(안내) 패널 접기 — 접으면 터미널/VNC 풀폭. 미션 전환 시 기본값(펼침) 유지.
  const [briefingCollapsed, setBriefingCollapsed] = useState(false);
  // 체험(3.) 페이지는 프롬프트 그대로 노출 / 실습(4.)은 모범답안으로 접힘
  const isExperience = section && section.startsWith("3.");

  // autoChecks 의 path 들을 추출 → FileExplorer 자동 탐색·강조
  const checkPaths = (mission.autoChecks || [])
    .map(c => c?.path)
    .filter(Boolean);
  const explorerInitial = checkPaths[0] || "";
  const [prompt, setPrompt] = useState("");
  const [checks, setChecks] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEntry, setShowEntry] = useState(true);
  const [hintsOpen, setHintsOpen] = useState(true);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  // 체험 → 실습 전환 시점에만 세션 리셋. 그 외에는 iframe 유지.
  const [termReady, setTermReady] = useState(true);
  const [termKey, setTermKey] = useState(0);
  const remountTimerRef = useRef(null);
  const prevIsExperienceRef = useRef(null);
  const localWriteRef = useRef(null);
  // AI 채점 상태
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null); // { score, passed, summary, items: [{name, ok, comment}] }
  const [gradeError, setGradeError] = useState("");
  // command 미션 파일 생성 시 재시작 안내 팝업
  const [showRestartPopup, setShowRestartPopup] = useState(false);
  // 파일 생성 토스트 — autoChecks 가 false→true 로 바뀌는 순간 표시
  const [fileToast, setFileToast] = useState(null); // { files: [path] } | null
  const prevAllCheckedRef = useRef(false);
  const initialCheckDoneRef = useRef(false); // 첫 폴링 무시용
  // 산출물 파일 프리뷰 — outputFiles 의 내용을 직접 보여줌
  const [filePreviews, setFilePreviews] = useState({}); // { path: { content, error, loading } }
  const [previewOpen, setPreviewOpen] = useState(null); // 현재 열려있는 파일 path (null=닫힘)

  useEffect(() => {
    setPrompt(interpolate(mission.promptTemplate));
    setChecks(mission.checklist.map(() => false));
    setShowConfetti(false);
    setHintsOpen(false);
    setAnswerOpen(false);  // 새 미션마다 모범답안 자동 접힘
    setCopied(false);
    setSent(false);
    setShowEntry(true);
    setHintsOpen(false);  // 새 미션마다 힌트 접힘 (프롬프트와 동일)
    // 새 미션마다 AI 채점 결과 초기화
    setGradeResult(null);
    setGradeError("");
    setGrading(false);
    setFileToast(null);
    setShowRestartPopup(false);
    setFilePreviews({});
    setFileExists({});
    setPreviewOpen(null);
    prevAllCheckedRef.current = false;
    initialCheckDoneRef.current = false;
    const t = setTimeout(() => setShowEntry(false), 900);
    // 체험 슬라이드 간에는 세션 유지. 체험 → 실습 전환 시 한 번만 리셋.
    if (!isTauri()) {
      setDemoMode("normal").catch(() => {});
      const wasExperience = prevIsExperienceRef.current;
      if (wasExperience === true && !isExperience) {
        // 체험 → 실습: 세션 + 파일 초기화 후 iframe 재마운트
        setTermReady(false);
        clearMySession().catch(() => {});
        cleanWorkspace().catch(() => {});
        if (remountTimerRef.current) clearTimeout(remountTimerRef.current);
        remountTimerRef.current = setTimeout(() => {
          remountTimerRef.current = null;
          setTermKey(k => k + 1);
          setTermReady(true);
        }, 2500);
      }
      prevIsExperienceRef.current = isExperience;
    }
    return () => {
      clearTimeout(t);
    };
  }, [mission.id, interpolate]);

  // 자동 체크: 3초 폴링으로 파일 존재/내용 감지
  // Tauri 모드: invoke("run_shell")로 로컬 검사
  // Web 모드:  /api/check 백엔드로 사용자 홈에서 검사
  useEffect(() => {
    if (!mission.autoChecks || mission.autoChecks.length === 0) return;

    let cancelled = false;

    async function tick() {
      try {
        const results = await runMissionChecks(mission.autoChecks);
        if (!cancelled) setChecks(results);
      } catch {}
    }

    // 즉시 1회 + 3초 폴링
    tick();
    const interval = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [mission.id, mission.autoChecks]);

  const allChecked = checks.length > 0 && checks.every(Boolean);
  const alreadyDone = completedSet.has(mission.id);
  const missionNumber = allMissions.findIndex(m => m.id === mission.id) + 1;

  // outputFiles 존재 여부를 별도 폴링 — 전부 발견되면 폴링 중지
  const [fileExists, setFileExists] = useState({});
  useEffect(() => {
    if (isTauri()) return;
    const files = mission.outputFiles || [];
    if (files.length === 0) return;
    let cancelled = false;
    let intervalId = null;
    async function checkFiles() {
      const checks = files.map(f => ({ type: "file-exists", path: f }));
      try {
        const results = await runMissionChecks(checks);
        if (cancelled) return;
        const map = {};
        files.forEach((f, i) => { map[f] = results[i]; });
        setFileExists(map);
        if (results.every(Boolean) && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch {}
    }
    checkFiles();
    intervalId = setInterval(checkFiles, 3000);
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [mission.id, mission.outputFiles]);

  // false → true 전환 감지 → 파일 생성 토스트
  // 미션 진입 직후 첫 폴링 결과는 무시 (이미 파일이 있는 경우 토스트 안 뜨게)
  useEffect(() => {
    if (!initialCheckDoneRef.current) {
      // 첫 폴링 결과 — 초기 상태만 기록하고 토스트 안 띄움
      initialCheckDoneRef.current = true;
      prevAllCheckedRef.current = allChecked;
      return;
    }
    if (allChecked && !prevAllCheckedRef.current) {
      const files = (mission.outputFiles && mission.outputFiles.length > 0)
        ? mission.outputFiles
        : (checkPaths || []);
      if (files.length > 0) {
        setFileToast({ files });
        // command 미션이면 재시작 안내 팝업
        if (mission.id === "command" || mission.id === "final-command") {
          setShowRestartPopup(true);
        }
        const t = setTimeout(() => setFileToast(null), 4500);
        prevAllCheckedRef.current = true;
        return () => clearTimeout(t);
      }
    }
    prevAllCheckedRef.current = allChecked;
  }, [allChecked, mission.outputFiles, checkPaths]);

  // 자동 클리어 없음 — 완료하기 버튼으로만 클리어

  const handleComplete = () => {
    if (!alreadyDone) {
      setShowConfetti(true);
      onComplete(mission.id);
    }
  };

  // 브라우저 클립보드 + VNC iframe(들)에 postMessage → noVNC bridge 가
  // rfb.clipboardPasteFrom(text) + 사이드바 클립보드 텍스트필드 채움.
  // 사용자는 VNC 안 터미널에서 Ctrl+Shift+V 로 붙여넣기.
  const pushToVncClipboard = (text) => {
    if (isTauri()) return;
    try {
      document.querySelectorAll("iframe").forEach((f) => {
        try { f.contentWindow?.postMessage({ type: "vnc-paste", text }, "*"); } catch {}
      });
    } catch {}
  };

  const handleCopy = () => {
    copyToClipboard(prompt);
    pushToVncClipboard(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Tauri 모드 로컬 PTY 실행 — 웹 모드에선 안 씀 (복사 버튼이 모든 걸 처리).
  const handleSend = () => {
    if (!prompt.trim()) return;
    if (isTauri() && localWriteRef.current) {
      localWriteRef.current(prompt + "\r");
      setSent(true);
    } else {
      handleCopy();
      setSent(true);
    }
  };

  // AI 채점 — 학습자 본인 크리덴셜로 claude -p --json-schema 호출
  // rubric = goal + inputDesc + outputDesc 조합
  // checklist = [...mandatory, ...challenge]
  // files = outputFiles
  const handleGrade = async () => {
    if (grading) return;
    const mandatory = mission.mandatory || [];
    const challenge = mission.challenge || [];
    const outputFiles = mission.outputFiles || [];
    const checklist = [...mandatory, ...challenge]; // 필수+도전 모두 채점 (도전은 체크만, 의견 안 남김)
    if (checklist.length === 0) {
      setGradeError("이 미션은 AI 채점을 지원하지 않습니다");
      return;
    }
    const rubric = [
      mission.goal && `목표: ${mission.goal}`,
      mission.inputDesc && `입력 방법: ${mission.inputDesc}`,
      mission.outputDesc && `예상 산출물: ${mission.outputDesc}`,
    ].filter(Boolean).join("\n");
    setGrading(true);
    setGradeError("");
    setGradeResult(null);
    try {
      const r = await gradeMission({
        missionId: mission.id,
        rubric: rubric || mission.description || mission.label,
        files: outputFiles,
        checklist,
      });
      if (r && r.ok !== false && Array.isArray(r.items)) {
        setGradeResult(r);
        const mandatoryNames = new Set(mandatory);
        const matchedMandatory = r.items.filter(it => mandatoryNames.has(it.name));
        const mandatoryAllOk = matchedMandatory.length > 0 && matchedMandatory.every(it => it.ok);
        // AI 채점 통과 여부만 표시 — 완료는 수동 버튼으로
        // 필수 항목 중 실패한 것만 터미널에 피드백
        const failedMandatory = r.items.filter(it => !it.ok && mandatoryNames.has(it.name));
        if (failedMandatory.length > 0) {
          const msg = [
            "",
            "━━━ 🤖 AI 채점 피드백 ━━━",
            "보강이 필요한 부분:",
            ...failedMandatory.map(it => `  ✗ ${it.name}${it.comment ? ` — ${it.comment}` : ""}`),
            r.summary ? `\n💡 ${r.summary}` : "",
            "━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
          ].filter(Boolean).join("\n");
          sendToMyTerminal(msg).catch(() => {});
        }
      } else {
        setGradeError(r?.error || "채점 실패 — 잠시 후 다시 시도해주세요");
      }
    } catch (e) {
      setGradeError(String(e?.message || e));
    } finally {
      setGrading(false);
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

      {/* Command 생성 후 재시작 안내 팝업 */}
      {showRestartPopup && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: M.bg2, border: `1px solid ${M.or}44`,
            borderRadius: 16, padding: "32px 36px",
            maxWidth: 400, textAlign: "center",
            boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔄</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: M.tx, marginBottom: 10 }}>
              커맨드 파일이 생성되었습니다!
            </div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.8, marginBottom: 20 }}>
              새 커맨드를 사용하려면 터미널에서<br/>
              <code style={{ background: M.bg3, padding: "3px 10px", borderRadius: 6, color: M.or, fontSize: 15, fontWeight: 700 }}>/exit</code>
              <span> 입력 후 </span>
              <code style={{ background: M.bg3, padding: "3px 10px", borderRadius: 6, color: M.or, fontSize: 15, fontWeight: 700 }}>claude</code>
              <span> 로 재시작하세요.</span>
            </div>
            <button
              onClick={() => setShowRestartPopup(false)}
              style={{
                background: `linear-gradient(135deg, ${M.or}, ${M.orD || "#e5730a"})`,
                color: "#fff", border: "none", borderRadius: 10,
                padding: "12px 40px", fontSize: 15, fontWeight: 800,
                cursor: "pointer", boxShadow: `0 4px 16px ${M.or}44`,
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 산출물 프리뷰 모달 — 파일 내용 직접 보기 + 다운로드 */}
      {previewOpen && filePreviews[previewOpen] && (
        <div
          onClick={() => setPreviewOpen(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9998, padding: 30,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: M.bg2,
              border: `1px solid ${M.bd}`,
              borderRadius: 14,
              padding: 0,
              width: "min(800px, 95%)",
              maxHeight: "85vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            {/* 헤더 — 파일명 + 탭 + 다운로드 + 닫기 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 16px",
              borderBottom: `1px solid ${M.bd}`,
              background: M.bg3,
            }}>
              {(mission.outputFiles || []).map(f => (
                <button
                  key={f}
                  onClick={() => {
                    setPreviewOpen(f);
                    if (!filePreviews[f]) {
                      setFilePreviews(prev => ({ ...prev, [f]: { loading: true, content: "", error: null } }));
                      readProjectFile(f)
                        .then(c => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: c || "(빈 파일)", error: null } })))
                        .catch(e => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: "", error: String(e?.message || e) } })));
                    }
                  }}
                  style={{
                    background: previewOpen === f ? `${M.or}22` : "transparent",
                    border: `1px solid ${previewOpen === f ? M.or + "55" : M.bd}`,
                    borderRadius: 6, padding: "5px 12px",
                    color: previewOpen === f ? M.or : M.tx2,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--workbook-mono)",
                  }}
                >📄 {f}</button>
              ))}
              <div style={{ flex: 1 }} />
              <a
                href={`/api/download?path=${encodeURIComponent(previewOpen)}`}
                download
                style={{
                  background: M.gd, color: "#1a1a2e",
                  border: "none", borderRadius: 6, padding: "5px 14px",
                  fontSize: 12, fontWeight: 800, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
                title="내 PC 로 다운로드"
              >⬇ 다운로드</a>
              <button
                onClick={() => {
                  // 새로고침
                  const f = previewOpen;
                  setFilePreviews(prev => ({ ...prev, [f]: { loading: true, content: "", error: null } }));
                  readProjectFile(f)
                    .then(c => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: c || "(빈 파일)", error: null } })))
                    .catch(e => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: "", error: String(e?.message || e) } })));
                }}
                style={{
                  background: "transparent", border: `1px solid ${M.bd}`,
                  color: M.tx2, borderRadius: 6, padding: "5px 10px",
                  fontSize: 13, cursor: "pointer",
                }}
                title="새로고침"
              >🔄</button>
              <button
                onClick={() => setPreviewOpen(null)}
                style={{
                  background: "transparent", border: "none",
                  color: M.tx3, fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1,
                }}
              >✕</button>
            </div>
            {/* 내용 */}
            <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
              {filePreviews[previewOpen]?.loading ? (
                <div style={{ padding: 24, textAlign: "center", color: M.tx3, fontSize: 13 }}>
                  <div style={{ width: 20, height: 20, border: `2px solid ${M.or}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                  파일 읽는 중...
                </div>
              ) : filePreviews[previewOpen]?.error ? (
                <div style={{ padding: 24, color: "#ef4444", fontSize: 13 }}>
                  파일을 읽을 수 없습니다: {filePreviews[previewOpen].error}
                  <div style={{ marginTop: 8, color: M.tx3, fontSize: 11 }}>
                    바이너리 파일(.docx, .pptx)은 미리보기가 안 됩니다. ⬇ 다운로드로 직접 여세요.
                  </div>
                </div>
              ) : (
                <pre style={{
                  margin: 0, padding: 16,
                  background: "#0a0a0f", color: "#e5e8ec",
                  fontSize: 13, fontFamily: "var(--workbook-mono)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  minHeight: 200,
                }}>
                  {filePreviews[previewOpen]?.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

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
              {missionNumber} / {allMissions.length}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, letterSpacing: -0.5 }}>
              {mission.label}
            </div>
          </div>
        </div>
      )}

      {/* 슬라이드 제목 줄 (Mission 배너 대신 간결하게) */}
      <div style={{
        borderBottom: `1px solid ${M.bd}`,
        padding: "14px 22px",
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        background: M.bg2,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: M.tx, letterSpacing: -0.3 }}>
          {mission.label}
        </div>
        <div style={{ fontSize: 15, color: M.tx2, flex: 1 }}>
          {mission.description}
        </div>
        {alreadyDone && (
          <div style={{
            background: `linear-gradient(135deg, #059669, #10b981)`,
            color: "#fff", borderRadius: 8,
            padding: "5px 14px", fontSize: 13, fontWeight: 700,
            boxShadow: "0 2px 8px #05966944",
          }}>
            CLEAR
          </div>
        )}
      </div>

      {/* Main: briefing (35%) + terminal (65%) */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* 접혔을 때 — 좁은 스트립 + 펼침 버튼 */}
        {briefingCollapsed && (
          <button
            onClick={() => setBriefingCollapsed(false)}
            title="안내 패널 펼치기"
            style={{
              width: 28, flexShrink: 0,
              borderRight: `1px solid ${M.bd}`,
              background: `linear-gradient(180deg, ${M.bg3}, ${M.bg2})`,
              border: "none", borderLeft: 0, borderTop: 0, borderBottom: 0,
              cursor: "pointer", padding: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10,
              color: M.tx2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(180deg, ${M.or}22, ${M.bg3})`; e.currentTarget.style.color = M.or; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(180deg, ${M.bg3}, ${M.bg2})`; e.currentTarget.style.color = M.tx2; }}
          >
            <span style={{ fontSize: 16, fontWeight: 900 }}>▶</span>
            <span style={{ writingMode: "vertical-rl", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>안내 펼치기</span>
          </button>
        )}

        {/* Left: briefing */}
        <div style={{
          width: briefingCollapsed ? 0 : "35%",
          minWidth: briefingCollapsed ? 0 : 280,
          maxWidth: briefingCollapsed ? 0 : 420,
          borderRight: briefingCollapsed ? "none" : `1px solid ${M.bd}`,
          display: briefingCollapsed ? "none" : "flex", flexDirection: "column",
          overflowY: "auto", background: M.bg,
          position: "relative",
        }}>
          {/* 접기 버튼 — 오른쪽 보더에 걸쳐있어 눈에 띔 */}
          <button
            onClick={() => setBriefingCollapsed(true)}
            title="안내 패널 접기 (터미널 풀폭)"
            style={{
              position: "absolute", top: 18, right: -14, zIndex: 20,
              width: 28, height: 52,
              background: `linear-gradient(135deg, ${M.or}, ${M.orD || "#CB6015"})`,
              color: "#fff",
              border: `2px solid ${M.bg2}`,
              borderRadius: "8px",
              boxShadow: `0 3px 10px ${M.or}66, 0 0 0 1px ${M.or}33`,
              cursor: "pointer",
              fontSize: 14, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, lineHeight: 1,
              transition: "transform .15s ease-out, box-shadow .15s ease-out",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = `0 4px 14px ${M.or}88, 0 0 0 2px ${M.or}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 3px 10px ${M.or}66, 0 0 0 1px ${M.or}33`; }}
          >
            ◀
          </button>
          {/* 글씨 크기 조절 바 */}
          <div style={{
            padding: "4px 14px", display: "flex", alignItems: "center", gap: 10,
            borderBottom: `1px solid ${M.bd}`, background: M.bg3, flexShrink: 0,
            fontSize: 11, color: M.tx3,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>안내</span>
            <button onClick={() => setPanelZoom(z => Math.max(70, z - 10))} disabled={panelZoom <= 70} style={{ background: "transparent", border: `1px solid ${M.bd}`, color: panelZoom <= 70 ? M.tx3 : M.tx2, borderRadius: 3, width: 18, height: 18, cursor: panelZoom <= 70 ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 10, color: M.or, fontFamily: "var(--workbook-mono)", minWidth: 24, textAlign: "center" }}>{panelZoom}%</span>
            <button onClick={() => setPanelZoom(z => Math.min(150, z + 10))} disabled={panelZoom >= 150} style={{ background: "transparent", border: `1px solid ${M.bd}`, color: panelZoom >= 150 ? M.tx3 : M.tx2, borderRadius: 3, width: 18, height: 18, cursor: panelZoom >= 150 ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            <span style={{ borderLeft: `1px solid ${M.bd}`, height: 14 }} />
            <span>터미널</span>
            <button onClick={() => setTermZoom(z => Math.max(70, z - 10))} disabled={termZoom <= 70} style={{ background: "transparent", border: `1px solid ${M.bd}`, color: termZoom <= 70 ? M.tx3 : M.tx2, borderRadius: 3, width: 18, height: 18, cursor: termZoom <= 70 ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontSize: 10, color: M.or, fontFamily: "var(--workbook-mono)", minWidth: 24, textAlign: "center" }}>{termZoom}%</span>
            <button onClick={() => setTermZoom(z => Math.min(150, z + 10))} disabled={termZoom >= 150} style={{ background: "transparent", border: `1px solid ${M.bd}`, color: termZoom >= 150 ? M.tx3 : M.tx2, borderRadius: 3, width: 18, height: 18, cursor: termZoom >= 150 ? "default" : "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
          <div style={{ padding: "20px 20px", flex: 1, zoom: panelZoom / 100 }}>
            {/* GOAL — 이 미션에서 배우는 것 */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: M.gd, marginBottom: 8,
              letterSpacing: 2, textTransform: "uppercase",
            }}>
              🎯 Goal
            </div>
            <div style={{
              ...glass, borderRadius: 12,
              padding: "12px 14px",
              border: `1px solid ${M.gd}33`,
              fontSize: 13, color: M.tx, lineHeight: 1.6,
              marginBottom: 14,
            }}>
              {mission.goal || mission.description}
            </div>

            {/* INPUT 안내 — 내가 무엇을 입력해야 하는가 */}
            {mission.inputDesc && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.or, marginBottom: 8,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  📥 Input — 내가 입력
                </div>
                <div style={{
                  ...glass, borderRadius: 12,
                  padding: "12px 14px",
                  border: `1px solid ${M.or}33`,
                  fontSize: 13, color: M.tx2, lineHeight: 1.6,
                  marginBottom: 14,
                }}>
                  {mission.inputDesc}
                </div>
              </>
            )}

            {/* OUTPUT 안내 — 무엇이 나와야 하는가 + 파일 칩 */}
            {(mission.outputDesc || (mission.outputFiles && mission.outputFiles.length > 0)) && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.blM, marginBottom: 8,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  📤 Output — 예상 산출물
                </div>
                <div style={{
                  ...glass, borderRadius: 12,
                  padding: "12px 14px",
                  border: `1px solid ${M.blM}33`,
                  fontSize: 13, color: M.tx2, lineHeight: 1.6,
                  marginBottom: 14,
                }}>
                  {mission.outputDesc && (
                    <div style={{ marginBottom: mission.outputFiles?.length ? 8 : 0 }}>{mission.outputDesc}</div>
                  )}
                  {mission.outputFiles && mission.outputFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {mission.outputFiles.map(f => {
                        const exists = allChecked;
                        return (
                          <span key={f} style={{
                            fontSize: 11, fontFamily: "var(--workbook-mono)",
                            background: exists ? `${M.gd}22` : `${M.blM}18`,
                            color: exists ? M.gd : M.blM,
                            border: `1px solid ${exists ? M.gd : M.blM}55`,
                            borderRadius: 6, padding: "3px 10px",
                            display: "inline-flex", alignItems: "center", gap: 4,
                            transition: "all 0.4s ease-out",
                            transform: exists ? "scale(1.02)" : "scale(1)",
                            boxShadow: exists ? `0 0 12px ${M.gd}33` : "none",
                          }}>
                            {exists ? "✓" : "📄"} {f}
                            {exists && !isTauri() && (
                              <a
                                href={`/api/download?path=${encodeURIComponent(f)}`}
                                download
                                onClick={e => e.stopPropagation()}
                                title="내 PC 로 다운로드"
                                style={{
                                  marginLeft: 4, color: M.gd,
                                  textDecoration: "none", fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >⬇</a>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {(isExperience || mission.showPromptDirect) ? (
              <>
                {/* INPUT — 체험 페이지 / showPromptDirect: 프롬프트 그대로 노출 */}
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.or, marginBottom: 10,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  💬 Input — 프롬프트
                </div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  style={{
                    width: "100%", minHeight: 120, resize: "vertical",
                    background: `${M.bg3}cc`, color: M.or,
                    border: `1px solid ${M.or}33`,
                    borderRadius: 12, padding: "14px 16px",
                    fontFamily: "var(--workbook-mono)", fontSize: 13,
                    lineHeight: 1.8, outline: "none", boxSizing: "border-box",
                    transition: "border-color .2s, box-shadow .2s",
                  }}
                  onFocus={e => { e.target.style.borderColor = M.or + "88"; e.target.style.boxShadow = `0 0 0 3px ${M.or}18`; }}
                  onBlur={e => { e.target.style.borderColor = M.or + "33"; e.target.style.boxShadow = "none"; }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={handleCopy} style={{
                    flex: 1,
                    background: copied ? `${M.bg2}dd` : `linear-gradient(135deg, ${M.or}, ${M.orD})`,
                    color: copied ? "#86efac" : "#fff",
                    border: copied ? `1px solid #86efac44` : "none",
                    borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 800,
                    cursor: "pointer", transition: "all .2s ease-out",
                    boxShadow: copied ? "none" : `0 2px 12px ${M.or}44`,
                  }}>
                    {copied ? "✓ VNC 클립보드로 전송됨 — 터미널에서 붙여넣기" : "📋 복사 → VNC 클립보드"}
                  </button>
                  {isTauri() && (
                    <button onClick={handleSend} style={{
                      flex: 1,
                      background: sent ? `${M.bg2}dd` : `linear-gradient(135deg, ${M.or}, ${M.orD})`,
                      color: sent ? "#86efac" : "#fff",
                      border: sent ? `1px solid #86efac44` : "none",
                      borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 800,
                      cursor: "pointer", transition: "all .2s ease-out",
                      boxShadow: sent ? "none" : `0 2px 12px ${M.or}44`,
                    }}>{sent ? "✓ 실행됨" : "▶ 실행"}</button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* INPUT — 실습 페이지: 직접 작성 유도 */}
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.or, marginBottom: 10,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  💬 Input — 직접 프롬프트 작성
                </div>
                <div style={{
                  ...glass, borderRadius: 12,
                  padding: "12px 14px",
                  border: `1px solid ${M.or}33`,
                  fontSize: 13, color: M.tx2, lineHeight: 1.6,
                }}>
                  힌트를 참고해 <strong style={{ color: M.or }}>직접 프롬프트를 작성</strong>해서 터미널에 입력해보세요. 막히면 아래 모범답안을 펼쳐 참고하세요.
                </div>
              </>
            )}

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
                  maxHeight: hintsOpen ? 240 : 0, overflow: "hidden",
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

            {/* 모범답안 — 힌트 아래, 기본 접힘 (실습 페이지에서만; showPromptDirect는 위에서 이미 노출) */}
            {!isExperience && !mission.showPromptDirect && mission.promptTemplate && (
              <div style={{ marginTop: 14 }}>
                <button onClick={() => setAnswerOpen(!answerOpen)} style={{
                  background: "none", border: "none", color: M.tx3,
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6, padding: 0,
                  transition: "color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = M.tx2}
                onMouseLeave={e => e.currentTarget.style.color = M.tx3}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                    transition: "transform .2s", transform: answerOpen ? "rotate(90deg)" : "rotate(0)",
                  }}>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  모범답안 {answerOpen ? "접기" : "펼치기"}
                </button>
                <div style={{
                  maxHeight: answerOpen ? 720 : 0, overflow: "hidden",
                  transition: "max-height .3s ease-out, opacity .2s",
                  opacity: answerOpen ? 1 : 0,
                }}>
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      style={{
                        width: "100%", minHeight: 120, resize: "vertical",
                        background: `${M.bg3}cc`, color: M.or,
                        border: `1px solid ${M.or}33`,
                        borderRadius: 12, padding: "14px 16px",
                        fontFamily: "var(--workbook-mono)", fontSize: 13,
                        lineHeight: 1.8, outline: "none", boxSizing: "border-box",
                        transition: "border-color .2s, box-shadow .2s",
                      }}
                      onFocus={e => { e.target.style.borderColor = M.or + "88"; e.target.style.boxShadow = `0 0 0 3px ${M.or}18`; }}
                      onBlur={e => { e.target.style.borderColor = M.or + "33"; e.target.style.boxShadow = "none"; }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={handleCopy} style={{
                        flex: 1,
                        background: copied ? `${M.bg2}dd` : `linear-gradient(135deg, ${M.or}, ${M.orD})`,
                        color: copied ? "#86efac" : "#fff",
                        border: copied ? `1px solid #86efac44` : "none",
                        borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 800,
                        cursor: "pointer", transition: "all .2s ease-out",
                        boxShadow: copied ? "none" : `0 2px 12px ${M.or}44`,
                      }}>
                        {copied ? "✓ VNC 클립보드로 전송됨 — 터미널에서 붙여넣기" : "📋 복사 → VNC 클립보드"}
                      </button>
                      {isTauri() && (
                        <button onClick={handleSend} style={{
                          flex: 1,
                          background: sent ? `${M.bg2}dd` : `linear-gradient(135deg, ${M.or}, ${M.orD})`,
                          color: sent ? "#86efac" : "#fff",
                          border: sent ? `1px solid #86efac44` : "none",
                          borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 800,
                          cursor: "pointer", transition: "all .2s ease-out",
                          boxShadow: sent ? "none" : `0 2px 12px ${M.or}44`,
                        }}>{sent ? "✓ 실행됨" : "▶ 실행"}</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 결과 확인 — mandatory 있으면 채점 UI, checklist 있으면 레거시, 둘 다 없으면 안 그림 */}
            {mission.mandatory && mission.mandatory.length > 0 ? (
              <>
                {/* (자동 파일 검증 박스는 제거 — OUTPUT 칩이 회색→녹색으로 동일 정보 전달) */}

                {/* 필수 체크리스트 (mandatory) */}
                <div style={{ marginTop: 20 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: M.gd, marginBottom: 8,
                    letterSpacing: 2, textTransform: "uppercase",
                  }}>
                    ✅ 필수 체크리스트
                  </div>
                  {mission.mandatory.map((item, i) => {
                    const result = gradeResult?.items?.find(it => it.name === item) || null;
                    const ok = result?.ok === true;
                    const ng = !!gradeResult && result && result.ok === false;
                    const borderColor = ok ? M.gd : ng ? "#ef4444" : M.bd;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "8px 12px", fontSize: 13,
                        borderRadius: 8, marginBottom: 4,
                        background: ok ? `${M.gd}10` : ng ? "#ef444410" : "transparent",
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${borderColor}`,
                          background: ok ? M.gd : ng ? "#ef4444" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginTop: 1,
                        }}>
                          {ok && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {ng && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 2l6 6M8 2l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: ok || ng ? M.tx2 : M.tx3, lineHeight: 1.5 }}>{item}</div>
                          {result?.comment && (
                            <div style={{
                              marginTop: 4, fontSize: 11, color: M.tx3, fontStyle: "italic", lineHeight: 1.5,
                            }}>
                              💭 {result.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 도전 체크리스트 (challenge) — 선택 */}
                {mission.challenge && mission.challenge.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: M.or, marginBottom: 8,
                      letterSpacing: 2, textTransform: "uppercase",
                    }}>
                      ⭐ 도전 체크리스트 (선택)
                    </div>
                    {mission.challenge.map((item, i) => {
                      const result = gradeResult?.items?.find(it => it.name === item) || null;
                      const ok = result?.ok === true;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "8px 12px", fontSize: 13,
                          borderRadius: 8, marginBottom: 4,
                          background: ok ? `${M.or}10` : "transparent",
                        }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                            border: `2px solid ${ok ? M.or : M.bd}`,
                            background: ok ? M.or : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginTop: 1,
                          }}>
                            {ok && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: ok ? M.tx2 : M.tx3, lineHeight: 1.5 }}>{item}</div>
                            {result?.comment && (
                              <div style={{
                                marginTop: 4, fontSize: 11, color: M.tx3, fontStyle: "italic", lineHeight: 1.5,
                              }}>
                                💭 {result.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI 채점 버튼 + 결과 배지 */}
                {(mission.mandatory?.length > 0 || mission.challenge?.length > 0) && (
                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={handleGrade}
                      disabled={grading}
                      title="AI 가 산출물을 읽고 상세 평가합니다"
                      style={{
                        width: "100%",
                        background: grading ? M.bg2 : `linear-gradient(135deg, ${M.blM}, ${M.bl})`,
                        color: grading ? M.tx2 : "#fff",
                        border: "none",
                        borderRadius: 10, padding: "12px",
                        fontSize: 13, fontWeight: 800,
                        cursor: grading ? "default" : "pointer",
                        boxShadow: grading ? "none" : `0 2px 12px ${M.blM}44`,
                        transition: "all .2s",
                      }}
                    >
                      {grading ? "🤖 AI 채점 중... (최대 60초)" : gradeResult ? "🔄 다시 채점" : "🤖 AI 에게 상세 채점 받기"}
                    </button>
                    {gradeResult && gradeResult.items && gradeResult.items.length > 0 && (() => {
                      // PASS/FAIL은 필수 항목만으로 판정
                      const mandatoryNames = new Set(mission.mandatory || []);
                      const matchedM = gradeResult.items.filter(it => mandatoryNames.has(it.name));
                      const mandatoryAllOk = matchedM.length > 0 && matchedM.every(it => it.ok);
                      return (
                        <div style={{
                          marginTop: 10, padding: "10px 14px", borderRadius: 10,
                          background: mandatoryAllOk ? `${M.gd}12` : `${M.or}12`,
                          border: `1px solid ${mandatoryAllOk ? M.gd : M.or}44`,
                        }}>
                          <div style={{
                            padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                            background: mandatoryAllOk ? M.gd : M.or, color: "#fff",
                            display: "inline-block", marginBottom: 8,
                          }}>
                            {mandatoryAllOk ? "✓ 잘 했어요!" : "△ 보강할 부분이 있어요"}
                          </div>
                          {gradeResult.summary && (
                            <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.6 }}>{gradeResult.summary}</div>
                          )}
                        </div>
                      );
                    })()}
                    {gradeResult && (!gradeResult.items || gradeResult.items.length === 0) && (
                      <div style={{
                        marginTop: 8, padding: "8px 12px", borderRadius: 8,
                        background: "#f59e0b12", border: "1px solid #f59e0b44",
                        fontSize: 12, color: "#f59e0b",
                      }}>
                        ⚠ {gradeResult.summary || "채점 결과를 받지 못했어요. 다시 시도해주세요."}
                      </div>
                    )}
                    {gradeError && (
                      <div style={{
                        marginTop: 8, padding: "8px 12px", borderRadius: 8,
                        background: "#ef444412",
                        border: "1px solid #ef444444",
                        fontSize: 12, color: "#ef4444",
                      }}>
                        ⚠ {gradeError}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Legacy: mandatory 없는 미션 — 기존 단순 체크리스트 (checklist 비어있으면 안 보임) */
              mission.checklist && mission.checklist.length > 0 && <div style={{ marginTop: 24 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.blM, marginBottom: 10,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  ✅ 결과 확인
                </div>
                {mission.checklist.map((item, i) => {
                  const itemPath = checkPaths[i] || null;
                  return (
                    <label key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
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
                        marginTop: 1,
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          textDecoration: checks[i] ? "line-through" : "none",
                          color: checks[i] ? M.tx3 : M.tx2,
                          transition: "color .2s",
                        }}>
                          {item}
                        </div>
                        {itemPath && (
                          <div style={{
                            marginTop: 3, fontSize: 11, color: M.or,
                            fontFamily: "var(--workbook-mono)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            📄 {itemPath}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* 산출물 프리뷰 버튼 — 파일이 감지되면 즉시 열어보기 가능 */}
            {!isTauri() && mission.outputFiles && mission.outputFiles.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {mission.outputFiles.map((f, fi) => {
                  const pv = filePreviews[f];
                  const exists = fileExists[f];
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        if (!exists) return;
                        const isHtml = /\.html?$/i.test(f);
                        if (isHtml) {
                          window.open(`/api/preview?path=${encodeURIComponent(f)}`, "_blank", "width=800,height=600");
                          return;
                        }
                        setPreviewOpen(f);
                        setFilePreviews(prev => ({ ...prev, [f]: { loading: true, content: "", error: null } }));
                        readProjectFile(f)
                          .then(c => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: c || "(빈 파일)", error: null } })))
                          .catch(e => setFilePreviews(prev => ({ ...prev, [f]: { loading: false, content: "", error: String(e?.message || e) } })));
                      }}
                      style={{
                        width: "100%",
                        background: exists ? `${M.gd}12` : M.bg2,
                        color: exists ? M.gd : M.tx3,
                        border: `1px solid ${exists ? M.gd + "44" : M.bd}`,
                        borderRadius: 10, padding: "10px 14px",
                        fontSize: 12, fontWeight: 700,
                        cursor: exists ? "pointer" : "default",
                        display: "flex", alignItems: "center", gap: 8,
                        transition: "all .2s",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{exists ? (/\.html?$/i.test(f) ? "🌐" : "📄") : "⏳"}</span>
                      <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--workbook-mono)" }}>{f}</span>
                      {exists && <span style={{ fontSize: 11, color: M.gd }}>{/\.html?$/i.test(f) ? "미리보기 →" : "열어보기 →"}</span>}
                      {exists && (
                        <a
                          href={`/api/download?path=${encodeURIComponent(f)}`}
                          download
                          onClick={e => e.stopPropagation()}
                          style={{ color: M.gd, textDecoration: "none", fontSize: 13, padding: "2px 6px", background: `${M.gd}22`, borderRadius: 4 }}
                          title="PC로 다운로드"
                        >⬇</a>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 예시 답안 — 학생들이 옆 사람과 비교할 수 있는 기준 */}
            {mission.exampleOutput && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: M.tx3, marginBottom: 8,
                  letterSpacing: 2, textTransform: "uppercase",
                }}>
                  예시 답안 (참고용)
                </div>
                <div style={{
                  ...glass, borderRadius: 10, padding: "12px 14px",
                  border: `1px solid ${M.bd}`,
                  fontSize: 13, color: M.tx2, lineHeight: 1.7,
                  whiteSpace: "pre-wrap", fontFamily: "var(--workbook-mono)",
                }}>
                  {mission.exampleOutput}
                </div>
              </div>
            )}
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

        {/* Right: terminal (65%) + AI 어시스턴트 오버레이 + 파일 생성 토스트 */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", zoom: termZoom / 100 }}>
          {/* 파일 생성 토스트 — autoChecks 가 false→true 로 바뀌면 4.5초 표시 */}
          {fileToast && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 100,
              background: `linear-gradient(135deg, ${M.gd}, #059669)`,
              color: "#fff",
              padding: "14px 22px",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(16,185,129,0.45), 0 0 0 1px #10b98166",
              fontSize: 14, fontWeight: 800,
              display: "flex", alignItems: "center", gap: 12,
              animation: "fileToastPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              maxWidth: "80%",
            }}>
              <style>{`
                @keyframes fileToastPop {
                  0% { transform: translate(-50%, -20px) scale(0.85); opacity: 0; }
                  60% { transform: translate(-50%, 4px) scale(1.05); opacity: 1; }
                  100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                }
                @keyframes fileToastShine {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(200%); }
                }
              `}</style>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                fontSize: 20,
              }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, letterSpacing: 1, textTransform: "uppercase" }}>
                  파일 생성 완료
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 800, marginTop: 2,
                  fontFamily: "var(--workbook-mono)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {fileToast.files.join(" · ")}
                </div>
              </div>
            </div>
          )}

          {/* AI 도우미 챗봇 — 터미널 영역 우하단 플로팅 */}
          {!isTauri() && (
            <AssistantOverlay mission={mission} M={M} />
          )}
          <Suspense fallback={
            <div style={{
              color: M.tx3, padding: 24, fontFamily: "var(--workbook-mono)",
              background: M.bg3, height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${M.or}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                터미널 준비 중...
              </div>
            </div>
          }>
            {termReady ? (
              <Terminal
                key={`term-${mission.id}-${termKey}`}
                bustKey={termKey}
                style={{ height: "100%", borderRadius: 0, border: "none" }}
                fontSize={termFontSize}
                darkMode={darkMode}
                onPtyReady={({ write }) => {
                  localWriteRef.current = write;
                  if (onPtyReady) onPtyReady({ write });
                }}
              />
            ) : (
              <div style={{
                color: M.tx3, padding: 24, fontFamily: "var(--workbook-mono)",
                background: M.bg3, height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${M.or}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                  터미널 초기화 중...
                </div>
              </div>
            )}
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
