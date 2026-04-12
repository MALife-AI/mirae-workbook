export default function MissionProgressTracker({ missions, currentId, completedSet, onJump, M }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 0, padding: "14px 24px",
      background: `linear-gradient(180deg, ${M.bg3}, ${M.bg3}ee)`,
      borderTop: `1px solid ${M.bd}`,
      backdropFilter: "blur(8px)",
    }}>
      <style>{`
        @keyframes trackerPulse {
          0%, 100% { box-shadow: 0 0 4px ${M.or}44; }
          50% { box-shadow: 0 0 20px ${M.or}66; }
        }
        @keyframes trackerRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      {missions.map((m, i) => {
        const done = completedSet.has(m.id);
        const active = m.id === currentId;

        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center" }}>
            <div
              onClick={() => onJump && onJump(m.slideIndex)}
              title={`${m.label} ${done ? "(완료)" : active ? "(진행 중)" : ""}`}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done
                  ? `linear-gradient(135deg, ${M.or}, ${M.orD})`
                  : active ? `${M.or}22` : "transparent",
                border: `2px solid ${done ? M.or : active ? M.or : M.bd}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                transition: "all .3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                animation: active ? "trackerPulse 2s ease-in-out infinite" : "none",
                position: "relative",
              }}
              onMouseEnter={e => { if (!done && !active) e.currentTarget.style.borderColor = M.or + "88"; }}
              onMouseLeave={e => { if (!done && !active) e.currentTarget.style.borderColor = M.bd; }}
            >
              {/* Active ring animation */}
              {active && (
                <div style={{
                  position: "absolute", inset: -4,
                  borderRadius: "50%",
                  border: `2px solid ${M.or}44`,
                  animation: "trackerRing 2s ease-out infinite",
                }} />
              )}
              {done ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span style={{
                  color: active ? M.or : M.tx3,
                  fontSize: 12, fontWeight: 700,
                  fontFamily: "var(--workbook-mono)",
                }}>{m.stage}</span>
              )}
            </div>
            {/* Connector */}
            {i < missions.length - 1 && (
              <div style={{
                width: 24, height: 2, position: "relative",
                background: M.bd,
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(90deg, ${M.or}, ${M.orL})`,
                  transform: done ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform .5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }} />
              </div>
            )}
          </div>
        );
      })}
      <div style={{
        marginLeft: 16, fontSize: 12, fontWeight: 700,
        color: M.tx3, fontFamily: "var(--workbook-mono)",
        background: `${M.bg2}cc`, padding: "4px 10px", borderRadius: 8,
        border: `1px solid ${M.bd}`,
      }}>
        <span style={{ color: M.or }}>{[...completedSet].filter(id => missions.some(m => m.id === id)).length}</span>
        <span style={{ color: M.tx3 }}>/{missions.length}</span>
      </div>
    </div>
  );
}
