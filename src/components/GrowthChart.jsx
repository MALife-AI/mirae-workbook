import { useEffect, useState } from "react";

export default function GrowthChart({ completedSet, M }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, []);

  const stages = [
    { id: "plan", label: "Plan", desc: "맨손", pct: 15, color: M.tx3 },
    { id: "claudemd", label: "+규칙서", desc: "CLAUDE.md", pct: 35, color: M.blM },
    { id: "skill", label: "+매뉴얼", desc: "Skill", pct: 55, color: M.ac },
    { id: "command", label: "+단축키", desc: "Command", pct: 75, color: M.or },
    { id: "hook", label: "+안전장치", desc: "Hook", pct: 95, color: "#86efac" },
  ];

  return (
    <div style={{
      background: `linear-gradient(135deg, ${M.bg2}ee, ${M.bg2}cc)`,
      backdropFilter: "blur(16px)",
      borderRadius: 20, padding: "28px 32px",
      border: `1px solid ${M.bd}88`,
      boxShadow: `0 8px 32px rgba(0,0,0,0.2)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${M.or}22, ${M.or}08)`,
          border: `1px solid ${M.or}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={M.or} strokeWidth="2" strokeLinecap="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx, letterSpacing: -0.3 }}>
            프로그램 성장 현황
          </div>
          <div style={{ fontSize: 12, color: M.tx3 }}>
            도구가 쌓일수록 결과가 달라집니다
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        gap: 10, height: 180, padding: "24px 0 0",
      }}>
        {stages.map((s, i) => {
          const done = completedSet.has(s.id);
          const barH = s.pct * 1.6;

          return (
            <div key={s.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              flex: 1, maxWidth: 72,
            }}>
              {/* Percentage label */}
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: done ? s.color : M.tx3 + "66",
                marginBottom: 6,
                opacity: animate ? 1 : 0,
                transform: animate ? "translateY(0)" : "translateY(8px)",
                transition: `all .4s ease-out ${i * 0.1 + 0.3}s`,
              }}>
                {done ? `${s.pct}%` : ""}
              </div>

              {/* Bar */}
              <div style={{
                width: "100%",
                height: animate && done ? barH : 8,
                background: done
                  ? `linear-gradient(180deg, ${s.color}, ${s.color}88)`
                  : `${M.bd}44`,
                borderRadius: 8,
                border: done ? "none" : `1px dashed ${M.tx3}33`,
                transition: `height .6s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.1}s, background .3s`,
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Shimmer effect */}
                {done && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent 50%)",
                    borderRadius: 8,
                  }} />
                )}
              </div>

              {/* Labels */}
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: done ? M.tx : M.tx3,
                marginTop: 8, textAlign: "center",
                lineHeight: 1.3,
              }}>
                {s.label}
              </div>
              <div style={{ fontSize: 10, color: M.tx3 + "88", marginTop: 2 }}>
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 20, marginTop: 20,
        fontSize: 11, color: M.tx3,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: `linear-gradient(135deg, ${M.or}, ${M.orD})` }} />
          완료
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: `1px dashed ${M.tx3}44` }} />
          대기
        </span>
      </div>
    </div>
  );
}
