// AssistantOverlay.jsx
// 미션별 플로팅 챗봇 — 학습자가 질문하면 미션 컨텍스트를 주입해서 AI가 답변.
// 터미널 영역 우하단에 플로팅 버튼으로 표시.

import { useState, useEffect, useRef } from "react";
import { askMissionHelper } from "../lib/runtime.js";

export default function AssistantOverlay({ mission, M, position }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{role: "user"|"ai", text}]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // 미션 변경 시 대화 리셋
  useEffect(() => {
    setMessages([]);
    setInput("");
    setLoading(false);
  }, [mission.id]);

  // 새 메시지 시 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 열릴 때 인풋 포커스
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const r = await askMissionHelper({
        missionId: mission.id,
        goal: mission.goal || mission.description || "",
        mandatory: mission.mandatory || [],
        hints: mission.hints || [],
        question: q,
      });
      const answer = r?.answer || r?.hint || "답변을 받지 못했어요. 다시 시도해주세요.";
      setMessages(prev => [...prev, { role: "ai", text: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "오류가 발생했어요. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 50,
            width: 48, height: 48, borderRadius: "50%",
            background: `linear-gradient(135deg, ${M.or}, ${M.orD || "#e5730a"})`,
            color: "#fff", border: "none",
            fontSize: 22, fontWeight: 900,
            cursor: "pointer",
            boxShadow: `0 4px 16px ${M.or}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform .2s, box-shadow .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          title="막히면 질문해보세요!"
        >
          💬
        </button>
      )}

      {/* 챗 패널 */}
      {open && (
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 50,
          width: 320, maxHeight: 420,
          background: M.bg2, border: `1px solid ${M.bd}`,
          borderRadius: 14, overflow: "hidden",
          boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
          display: "flex", flexDirection: "column",
        }}>
          {/* 헤더 */}
          <div style={{
            padding: "10px 14px",
            background: `linear-gradient(135deg, ${M.or}, ${M.orD || "#e5730a"})`,
            color: "#fff", fontSize: 13, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>🤖 도우미 — {mission.label || "미션"}</span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
                borderRadius: 4, padding: "2px 8px", fontSize: 14,
                cursor: "pointer", fontWeight: 700,
              }}
            >✕</button>
          </div>

          {/* 메시지 영역 */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: "auto", padding: "10px 12px",
            minHeight: 180, maxHeight: 300,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {messages.length === 0 && !loading && (
              <div style={{ color: M.tx3, fontSize: 12, textAlign: "center", padding: "20px 0", lineHeight: 1.8 }}>
                이 미션에서 막히는 부분을<br/>자유롭게 질문해보세요!
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {["이게 뭘 해야 하는 건가요?", "어떻게 시작하나요?", "에러가 나요"].map(ex => (
                    <button key={ex} onClick={() => { setInput(ex); }} style={{
                      background: M.bg3, border: `1px solid ${M.bd}`, borderRadius: 6,
                      padding: "5px 10px", fontSize: 11, color: M.tx2,
                      cursor: "pointer", textAlign: "left",
                    }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "8px 12px",
                borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                background: m.role === "user" ? M.or : M.bg3,
                color: m.role === "user" ? "#fff" : M.tx,
                fontSize: 12, lineHeight: 1.6, wordBreak: "break-word",
                border: m.role === "ai" ? `1px solid ${M.bd}` : "none",
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: "flex-start", padding: "8px 12px",
                background: M.bg3, borderRadius: "12px 12px 12px 4px",
                border: `1px solid ${M.bd}`, fontSize: 12, color: M.tx3,
              }}>
                <span style={{ animation: "assistantDots 1.2s infinite" }}>생각하는 중...</span>
                <style>{`@keyframes assistantDots { 0%,100% { opacity: .3; } 50% { opacity: 1; } }`}</style>
              </div>
            )}
          </div>

          {/* 입력 */}
          <div style={{
            borderTop: `1px solid ${M.bd}`,
            padding: "8px 10px", display: "flex", gap: 6,
            background: M.bg3,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="질문을 입력하세요..."
              style={{
                flex: 1, background: M.bg2, color: M.tx,
                border: `1px solid ${M.bd}`, borderRadius: 8,
                padding: "8px 10px", fontSize: 12, outline: "none",
              }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? M.bg2 : M.or,
                color: loading || !input.trim() ? M.tx3 : "#fff",
                border: "none", borderRadius: 8,
                padding: "8px 14px", fontSize: 12, fontWeight: 800,
                cursor: loading || !input.trim() ? "default" : "pointer",
              }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}
