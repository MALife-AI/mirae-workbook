import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

// xterm.js + Tauri 연동 내장 터미널
export default function NativeTerminal({ style }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const sessionRef = useRef(null);
  const unlistenRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 동적 임포트 (Tauri 환경에서만 로드)
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        const { WebLinksAddon } = await import("@xterm/addon-web-links");
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        if (cancelled) return;

        // xterm 인스턴스 생성
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: "bar",
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
          theme: {
            background: "#021018",
            foreground: "#E5E8EC",
            cursor: "#F58220",
            cursorAccent: "#021018",
            selectionBackground: "#0A305088",
            black: "#021018",
            red: "#fca5a5",
            green: "#86efac",
            yellow: "#F58220",
            blue: "#7E9FC3",
            magenta: "#c084fc",
            cyan: "#00A9CE",
            white: "#E5E8EC",
            brightBlack: "#5A7A98",
            brightRed: "#fca5a5",
            brightGreen: "#86efac",
            brightYellow: "#F0B26B",
            brightBlue: "#0086B8",
            brightMagenta: "#c084fc",
            brightCyan: "#00A9CE",
            brightWhite: "#ffffff",
          },
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

        // PTY 출력 수신
        const unlisten = await listen("pty_output", (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
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

        // 클린업 함수 저장
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
      ...style,
    }}>
      {/* 터미널 헤더 */}
      <div style={{
        background: "#061E30",
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
      </div>

      {/* xterm 컨테이너 */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          background: "#021018",
          padding: "4px 0",
        }}
      />
    </div>
  );
}
