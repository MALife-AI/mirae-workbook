import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { applyWkWebViewImePatch } from "./wkwebview-ime-patch.js";

// xterm.js + tauri-plugin-pty + WKWebView 한글 IME 패치
export default function NativeTerminal({ style, fontSize: fontSizeProp, darkMode = true, onSessionId, onPtyReady }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const ptyRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        const { WebLinksAddon } = await import("@xterm/addon-web-links");
        const { spawn } = await import("tauri-pty");
        const { invoke } = await import("@tauri-apps/api/core");

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

        // WKWebView 한글 IME 패치 적용
        applyWkWebViewImePatch(term);

        // 프로젝트 경로
        let cwd;
        try { cwd = await invoke("get_project_path"); } catch (_) {}

        // 쉘 판별 + 환경변수 확장
        const isMac = navigator.userAgent.includes("Mac");
        const shell = isMac ? "/bin/zsh" : "powershell.exe";

        // Rust에서 확장된 PATH 가져오기
        let expandedPath;
        try {
          expandedPath = await invoke("get_expanded_path");
        } catch (_) {
          expandedPath = "";
        }

        // tauri-plugin-pty로 쉘 스폰
        const pty = spawn(shell, [], {
          cols: term.cols,
          rows: term.rows,
          cwd: cwd || undefined,
          env: {
            TERM: "xterm-256color",
            LANG: "ko_KR.UTF-8",
            ...(expandedPath ? { PATH: expandedPath } : {}),
            // Windows: Claude Code에 Git Bash 경로 필요
            ...(!isMac ? { CLAUDE_CODE_GIT_BASH_PATH: (await invoke("get_git_bash_path").catch(() => "C:\\Program Files\\Git\\bin\\bash.exe")).trim() } : {}),
          },
        });

        // pty를 ref에 저장 + 부모에게 write 함수 노출
        ptyRef.current = pty;
        if (onPtyReady) onPtyReady({ write: (data) => pty.write(data) });

        // 양방향 데이터 전송
        pty.onData(data => term.write(data));
        term.onData(data => pty.write(data));

        pty.onExit(() => {
          term.write("\r\n\x1b[33m[세션 종료]\x1b[0m\r\n");
        });

        // 리사이즈
        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          try { pty.resize(term.cols, term.rows); } catch (_) {}
        });
        resizeObserver.observe(termRef.current);

        setReady(true);

        term._cleanup = () => {
          resizeObserver.disconnect();
          try { pty.kill(); } catch (_) {}
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

  useEffect(() => {
    if (xtermRef.current && fontSizeProp) {
      xtermRef.current.options.fontSize = fontSizeProp;
      if (fitRef.current) fitRef.current.fit();
    }
  }, [fontSizeProp]);

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
    if (termRef.current) {
      const xtermEl = termRef.current.querySelector(".xterm");
      if (xtermEl) xtermEl.style.background = darkMode ? "#021018" : "#FAFBFC";
    }
  }, [darkMode]);

  if (error) {
    return (
      <div style={{
        background: "#021018", color: "#fca5a5", padding: 20,
        fontFamily: "monospace", fontSize: 14, borderRadius: 12, border: "1px solid #0A3050",
        ...style,
      }}>
        터미널 오류: {error}
      </div>
    );
  }

  return (
    <div style={{
      overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0,
      ...style,
    }}>
      <div style={{
        background: darkMode ? "#061E30" : "#E8ECF0",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff6b6b" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#F58220" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#6bff8d" }} />
        </div>
        <span style={{ color: "#5A7A98", fontSize: 12, fontFamily: "monospace", marginLeft: 6 }}>
          native-terminal
        </span>
        <span style={{
          background: "#05966933", color: "#86efac", fontSize: 9,
          padding: "2px 8px", borderRadius: 10, fontWeight: 700,
        }}>
          LIVE
        </span>
      </div>
      <div ref={termRef} style={{
        flex: 1, minHeight: 0, overflow: "hidden",
        background: darkMode ? "#021018" : "#FAFBFC", padding: "4px 0",
      }} />
    </div>
  );
}
