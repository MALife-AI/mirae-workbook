import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

// xterm.js + Tauri 연동 내장 터미널
export default function NativeTerminal({ style, fontSize: fontSizeProp, darkMode = true, onSessionId }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const sessionRef = useRef(null);
  const unlistenRef = useRef(null);
  const koInputRef = useRef(null);
  const invokeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [koMode, setKoMode] = useState(false);
  const [koText, setKoText] = useState("");

  // 한글 입력 바에서 Enter 시 PTY에 전송
  function sendKorean() {
    if (koText && sessionRef.current != null && invokeRef.current) {
      invokeRef.current("pty_write", { sessionId: sessionRef.current, data: koText + "\n" }).catch(() => {});
    }
    setKoText("");
    setKoMode(false);
    // 터미널에 포커스 복귀
    if (xtermRef.current) xtermRef.current.focus();
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        const { WebLinksAddon } = await import("@xterm/addon-web-links");
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");
        invokeRef.current = invoke;

        if (cancelled) return;

        const darkTheme = {
          background: "#021018", foreground: "#E5E8EC", cursor: "#F58220", cursorAccent: "#021018",
          selectionBackground: "#0A305088",
          black: "#021018", red: "#fca5a5", green: "#86efac", yellow: "#F58220",
          blue: "#7E9FC3", magenta: "#c084fc", cyan: "#00A9CE", white: "#E5E8EC",
          brightBlack: "#5A7A98", brightRed: "#fca5a5", brightGreen: "#86efac", brightYellow: "#F0B26B",
          brightBlue: "#0086B8", brightMagenta: "#c084fc", brightCyan: "#00A9CE", brightWhite: "#ffffff",
        };
        const lightTheme = {
          background: "#FAFBFC", foreground: "#1A1A2E", cursor: "#E06A00", cursorAccent: "#FAFBFC",
          selectionBackground: "#E06A0033",
          black: "#1A1A2E", red: "#DC2626", green: "#059669", yellow: "#E06A00",
          blue: "#2563EB", magenta: "#7C3AED", cyan: "#0891B2", white: "#F5F5F5",
          brightBlack: "#6B7280", brightRed: "#EF4444", brightGreen: "#10B981", brightYellow: "#F59E0B",
          brightBlue: "#3B82F6", brightMagenta: "#8B5CF6", brightCyan: "#06B6D4", brightWhite: "#FFFFFF",
        };

        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: "bar",
          fontSize: fontSizeProp || 14,
          fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
          theme: darkMode ? darkTheme : lightTheme,
          allowTransparency: false,
          scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(termRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitRef.current = fitAddon;

        // PTY 스폰
        const cols = term.cols;
        const rows = term.rows;
        const sessionId = await invoke("pty_spawn", {
          shell: "",
          cols,
          rows,
        });
        sessionRef.current = sessionId;
        if (onSessionId) onSessionId(sessionId);

        // PTY 출력 수신
        const unlisten = await listen("pty_output", (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
            term.scrollToBottom();
          }
        });
        unlistenRef.current = unlisten;

        // PTY 종료 수신
        const unlistenExit = await listen("pty_exit", (event) => {
          if (event.payload.session_id === sessionId) {
            term.write("\r\n\x1b[33m[세션 종료]\x1b[0m\r\n");
          }
        });

        // 사용자 키 입력 → PTY
        term.onData((data) => {
          invoke("pty_write", { sessionId, data }).catch(() => {});
        });

        // Ctrl+K로 한글 입력 모드 토글
        term.attachCustomKeyEventHandler((e) => {
          if (e.type === "keydown" && e.key === "k" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            setKoMode(prev => !prev);
            setTimeout(() => { if (koInputRef.current) koInputRef.current.focus(); }, 50);
            return false;
          }
          return true;
        });

        // 리사이즈 감지
        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          if (sessionRef.current != null) {
            invoke("pty_resize", {
              sessionId: sessionRef.current,
              cols: term.cols,
              rows: term.rows,
            }).catch(() => {});
          }
        });
        resizeObserver.observe(termRef.current);

        setReady(true);

        term._cleanup = () => {
          resizeObserver.disconnect();
          unlisten();
          unlistenExit();
          if (sessionRef.current != null) {
            invoke("pty_kill", { sessionId: sessionRef.current }).catch(() => {});
          }
          term.dispose();
        };
      } catch (e) {
        if (!cancelled) {
          const msg = typeof e === "string" ? e : e.message || JSON.stringify(e);
          console.error("터미널 초기화 오류:", e);
          setError(msg || "터미널 초기화 실패");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (xtermRef.current && xtermRef.current._cleanup) {
        xtermRef.current._cleanup();
      }
    };
  }, []);

  // fontSize prop 변경 시 xterm에 반영
  useEffect(() => {
    if (xtermRef.current && fontSizeProp) {
      xtermRef.current.options.fontSize = fontSizeProp;
      if (fitRef.current) fitRef.current.fit();
    }
  }, [fontSizeProp]);

  // darkMode 변경 시 xterm 테마 전환
  useEffect(() => {
    if (!xtermRef.current) return;
    const dk = {
      background: "#021018", foreground: "#E5E8EC", cursor: "#F58220", cursorAccent: "#021018",
      selectionBackground: "#0A305088",
      black: "#021018", red: "#fca5a5", green: "#86efac", yellow: "#F58220",
      blue: "#7E9FC3", magenta: "#c084fc", cyan: "#00A9CE", white: "#E5E8EC",
      brightBlack: "#5A7A98", brightRed: "#fca5a5", brightGreen: "#86efac", brightYellow: "#F0B26B",
      brightBlue: "#0086B8", brightMagenta: "#c084fc", brightCyan: "#00A9CE", brightWhite: "#ffffff",
    };
    const lt = {
      background: "#FAFBFC", foreground: "#1A1A2E", cursor: "#E06A00", cursorAccent: "#FAFBFC",
      selectionBackground: "#E06A0033",
      black: "#1A1A2E", red: "#DC2626", green: "#059669", yellow: "#E06A00",
      blue: "#2563EB", magenta: "#7C3AED", cyan: "#0891B2", white: "#F5F5F5",
      brightBlack: "#6B7280", brightRed: "#EF4444", brightGreen: "#10B981", brightYellow: "#F59E0B",
      brightBlue: "#3B82F6", brightMagenta: "#8B5CF6", brightCyan: "#06B6D4", brightWhite: "#FFFFFF",
    };
    xtermRef.current.options.theme = darkMode ? dk : lt;
    // 컨테이너 배경도 동기화
    if (termRef.current) {
      const xtermEl = termRef.current.querySelector(".xterm");
      if (xtermEl) xtermEl.style.background = darkMode ? "#021018" : "#FAFBFC";
    }
  }, [darkMode]);

  if (error) {
    return (
      <div style={{
        background: "#021018",
        color: "#fca5a5",
        padding: 20,
        fontFamily: "monospace",
        fontSize: 14,
        borderRadius: 12,
        border: "1px solid #0A3050",
        ...style,
      }}>
        터미널 오류: {error}
        <br /><br />
        <span style={{ color: "#8DA0B8", fontSize: 12, lineHeight: 1.8 }}>
          {error.includes("pty_spawn") || error.includes("PTY") || error.includes("ConPTY") ? (
            <>
              Windows ConPTY 초기화에 실패했습니다.<br />
              • Windows 10 버전 1809 이상이 필요합니다<br />
              • 설정 → 앱 → 선택적 기능 → "Windows 콘솔 호스트" 확인<br />
            </>
          ) : error.includes("invoke") || error.includes("not a function") || error.includes("__TAURI") ? (
            <>
              Tauri 런타임이 감지되지 않습니다.<br />
              • <code>npx tauri dev</code> 또는 빌드된 앱으로 실행해주세요<br />
            </>
          ) : (
            <>
              터미널 초기화에 실패했습니다.<br />
              • 앱을 재시작해보세요<br />
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      ...style,
    }}>
      {/* 터미널 헤더 */}
      <div style={{
        background: darkMode ? "#061E30" : "#E8ECF0",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff6b6b" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#F58220" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#6bff8d" }} />
        </div>
        <span style={{
          color: "#5A7A98",
          fontSize: 12,
          fontFamily: "monospace",
          marginLeft: 6,
        }}>
          native-terminal
        </span>
        <span style={{
          background: "#05966933",
          color: "#86efac",
          fontSize: 9,
          padding: "2px 8px",
          borderRadius: 10,
          fontWeight: 700,
        }}>
          LIVE
        </span>
        <span
          onClick={() => {
            setKoMode(true);
            setTimeout(() => { if (koInputRef.current) koInputRef.current.focus(); }, 50);
          }}
          style={{
            marginLeft: "auto",
            color: "#5A7A98",
            fontSize: 10,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          한글: Ctrl+K
        </span>
      </div>

      {/* xterm 컨테이너 */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background: darkMode ? "#021018" : "#FAFBFC",
          padding: "4px 0",
        }}
      />

      {/* 한글 입력 바 */}
      {koMode && (
        <div style={{
          background: "#0A1E2E",
          borderTop: "1px solid #F58220",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ color: "#F58220", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>한글</span>
          <input
            ref={koInputRef}
            value={koText}
            onChange={(e) => setKoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendKorean();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setKoText("");
                setKoMode(false);
                if (xtermRef.current) xtermRef.current.focus();
              }
            }}
            placeholder="한글 입력 후 Enter (Esc로 닫기)"
            autoFocus
            style={{
              flex: 1,
              background: "#021018",
              border: "1px solid #1A4060",
              borderRadius: 4,
              color: "#E5E8EC",
              padding: "4px 8px",
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              outline: "none",
            }}
          />
          <button
            onClick={sendKorean}
            style={{
              background: "#F58220",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            전송
          </button>
        </div>
      )}
    </div>
  );
}
