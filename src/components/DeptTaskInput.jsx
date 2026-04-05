import { useState, useEffect } from "react";

export default function DeptTaskInput({ M, onComplete }) {
  const [dept, setDept] = useState("");
  const [task, setTask] = useState("");
  const [step, setStep] = useState(0); // 0=인트로, 1=입력
  const [visible, setVisible] = useState(false);
  const [deptFocused, setDeptFocused] = useState(false);
  const [taskFocused, setTaskFocused] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const glass = {
    background: `linear-gradient(135deg, ${M.bg2}ee, ${M.bg2}cc)`,
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: `1px solid ${M.bd}88`,
    boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${M.bd}44, inset 0 1px 0 ${M.bd}44`,
  };

  const inputStyle = (value, focused) => ({
    width: "100%", padding: "14px 16px", borderRadius: 12,
    border: `2px solid ${focused ? M.or : value ? M.or + "66" : M.bd}`,
    background: focused ? M.bg + "cc" : M.bg,
    color: M.tx, fontSize: 16,
    outline: "none", boxSizing: "border-box",
    transition: "all .2s ease-out",
    boxShadow: focused ? `0 0 0 3px ${M.or}22` : "none",
  });

  if (step === 0) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: visible ? 1 : 0, transition: "opacity .4s ease-out",
      }}>
        <div style={{
          ...glass, borderRadius: 28, padding: "56px 48px",
          maxWidth: 520, width: "90%", textAlign: "center",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
          transition: "transform .5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity .4s ease-out",
          opacity: visible ? 1 : 0,
        }}>
          {/* Decorative glow */}
          <div style={{
            position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
            width: 120, height: 120, borderRadius: "50%",
            background: `radial-gradient(circle, ${M.or}33, transparent 70%)`,
            filter: "blur(40px)", pointerEvents: "none",
          }} />

          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
            background: `linear-gradient(135deg, ${M.or}22, ${M.or}08)`,
            border: `1px solid ${M.or}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={M.or} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l2 2" />
            </svg>
          </div>

          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, marginBottom: 12, lineHeight: 1.3, letterSpacing: -0.5 }}>
            나만의 AI 비서를<br /><span style={{ color: M.or }}>직접 만들어봅시다</span>
          </div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8, marginBottom: 36 }}>
            오늘 교육이 끝나면, 여러분의 부서에 맞는<br />
            문서 자동화 프로그램이 완성됩니다
          </div>

          <button
            onClick={() => { setVisible(false); setTimeout(() => { setStep(1); setVisible(true); }, 300); }}
            style={{
              background: `linear-gradient(135deg, ${M.or}, ${M.orD})`,
              color: "#fff", border: "none", borderRadius: 14,
              padding: "16px 56px", fontSize: 18, fontWeight: 800,
              cursor: "pointer", transition: "all .15s ease-out",
              boxShadow: `0 4px 16px ${M.or}44`,
              position: "relative", overflow: "hidden",
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.boxShadow = `0 2px 8px ${M.or}44`; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 16px ${M.or}44`; }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 6px 24px ${M.or}66`}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 16px ${M.or}44`; }}
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = dept.trim().length > 0 && task.trim().length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0, transition: "opacity .3s ease-out",
    }}>
      <div style={{
        ...glass, borderRadius: 28, padding: "44px 40px",
        maxWidth: 520, width: "90%",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
        transition: "transform .5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity .3s ease-out",
        opacity: visible ? 1 : 0,
      }}>
        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          <div style={{ height: 3, flex: 1, borderRadius: 2, background: M.or }} />
          <div style={{ height: 3, flex: 1, borderRadius: 2, background: M.or + (canSubmit ? "ff" : "33"), transition: "background .3s" }} />
        </div>

        <div style={{ fontSize: 24, fontWeight: 900, color: M.tx, marginBottom: 6, letterSpacing: -0.3 }}>
          내 업무 설정
        </div>
        <div style={{ fontSize: 14, color: M.tx2, marginBottom: 28, lineHeight: 1.6 }}>
          입력한 정보가 모든 체험 프롬프트에 자동 반영됩니다
        </div>

        {/* 부서명 */}
        <label style={{ display: "block", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: deptFocused ? M.or : M.tx2, marginBottom: 8, transition: "color .2s", letterSpacing: 0.5 }}>
            부서명
          </div>
          <input
            type="text"
            value={dept}
            onChange={e => setDept(e.target.value)}
            onFocus={() => setDeptFocused(true)}
            onBlur={() => setDeptFocused(false)}
            placeholder="예: 퇴직연금사업부"
            autoFocus
            style={inputStyle(dept, deptFocused)}
          />
        </label>

        {/* 업무 */}
        <label style={{ display: "block", marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: taskFocused ? M.or : M.tx2, marginBottom: 8, transition: "color .2s", letterSpacing: 0.5 }}>
            자동화하고 싶은 업무
          </div>
          <input
            type="text"
            value={task}
            onChange={e => setTask(e.target.value)}
            onFocus={() => setTaskFocused(true)}
            onBlur={() => setTaskFocused(false)}
            onKeyDown={e => { if (e.key === "Enter" && canSubmit) onComplete(dept.trim(), task.trim()); }}
            placeholder="예: 월간 수익률 보고서"
            style={inputStyle(task, taskFocused)}
          />
        </label>

        {/* 미리보기 */}
        <div style={{
          borderRadius: 14, padding: canSubmit ? "14px 18px" : "0px",
          maxHeight: canSubmit ? 120 : 0,
          overflow: "hidden",
          background: canSubmit ? `linear-gradient(135deg, ${M.bg3}, ${M.bg3}cc)` : "transparent",
          border: canSubmit ? `1px solid ${M.or}22` : "1px solid transparent",
          marginBottom: canSubmit ? 20 : 0,
          transition: "all .3s ease-out",
          opacity: canSubmit ? 1 : 0,
        }}>
          <div style={{ fontSize: 11, color: M.tx3, marginBottom: 6, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            프롬프트 미리보기
          </div>
          <div style={{ fontSize: 13, color: M.or, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.8 }}>
            CLAUDE.md 만들어줘. 우리 팀은{" "}
            <span style={{ color: "#86efac", fontWeight: 700, background: "#86efac11", padding: "1px 4px", borderRadius: 4 }}>{dept.trim()}</span>이고,{" "}
            <span style={{ color: "#86efac", fontWeight: 700, background: "#86efac11", padding: "1px 4px", borderRadius: 4 }}>{task.trim()}</span>를 자동화...
          </div>
        </div>

        <button
          onClick={() => { if (canSubmit) onComplete(dept.trim(), task.trim()); }}
          disabled={!canSubmit}
          style={{
            width: "100%",
            background: canSubmit ? `linear-gradient(135deg, ${M.or}, ${M.orD})` : M.bd,
            color: canSubmit ? "#fff" : M.tx3,
            border: "none", borderRadius: 14,
            padding: "16px", fontSize: 17, fontWeight: 800,
            cursor: canSubmit ? "pointer" : "default",
            transition: "all .25s ease-out",
            boxShadow: canSubmit ? `0 4px 16px ${M.or}44` : "none",
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          교육 시작하기
        </button>
      </div>
    </div>
  );
}
