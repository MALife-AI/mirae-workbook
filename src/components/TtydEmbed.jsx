// TtydEmbed.jsx — 웹 모드에서 사용자별 ttyd 브라우저 터미널을 iframe으로 임베드.
//
// MissionSlide의 우측 터미널 영역에 들어간다. NativeTerminal(Tauri 전용)과 같은
// props 시그니처를 받지만, fontSize/darkMode/onPtyReady는 ttyd가 자체적으로 관리하므로
// 여기서는 무시하거나 단순 전달만 한다.
//
// 사용자 식별: /api/me 호출로 nginx Basic Auth가 설정한 X-Remote-User를 받아온다.
// ttyd는 nginx에서 /<username>/ 경로로 라우팅됨 (setup-ttyd.sh 참조).

import { useEffect, useRef, useState } from "react";
import { getCurrentUser, fetchMyTarget, clearMySession } from "../lib/runtime.js";

export default function TtydEmbed({ style, darkMode = true, bustKey = 0 }) {
  const [username, setUsername] = useState(null);
  const [error, setError] = useState(null);
  // 어드민이 reset 할 때마다 server의 sessionVersion이 증가 → iframe key 변경 → reload
  const [sessionVersion, setSessionVersion] = useState(0);
  // 마운트 시점 타임스탬프 — 매번 고유 URL 보장 (브라우저 캐시/WebSocket 재사용 방지)
  const [mountTs] = useState(() => Date.now());
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        if (u && u.username) {
          setUsername(u.username);
        } else {
          setError("사용자 정보를 가져올 수 없습니다");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // sessionVersion 폴링 — 변화 감지 시 iframe 강제 reload
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    async function poll() {
      const r = await fetchMyTarget();
      if (cancelled) return;
      if (typeof r?.sessionVersion === "number" && r.sessionVersion !== sessionVersion) {
        setSessionVersion(r.sessionVersion);
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [username, sessionVersion]);

  // darkMode 변경 시 iframe에 테마 postMessage
  useEffect(() => {
    if (!iframeRef.current) return;
    const send = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: "theme", dark: darkMode }, "*");
      } catch {}
    };
    send();
    const t = setTimeout(send, 500);
    const t2 = setTimeout(send, 1500);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [darkMode, sessionVersion, username]);

  // iframe(ttyd)이 준비되었다는 신호를 받으면 즉시 테마 재전송
  useEffect(() => {
    function onMsg(ev) {
      if (ev.data && ev.data.type === "ttyd-ready" && iframeRef.current) {
        try {
          iframeRef.current.contentWindow?.postMessage({ type: "theme", dark: darkMode }, "*");
        } catch {}
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [darkMode]);

  const baseStyle = {
    width: "100%",
    height: "100%",
    border: 0,
    background: "#0a0a0a",
    display: "block",
    ...style,
  };

  if (error) {
    return (
      <div
        style={{
          ...baseStyle,
          color: "#e5e5e5",
          padding: 24,
          fontFamily: "var(--workbook-mono)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "#f87171", marginBottom: 8 }}>
            터미널 로드 실패
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{error}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
            서버 ttyd 또는 /api/me 응답을 확인하세요.
          </div>
        </div>
      </div>
    );
  }

  if (!username) {
    return (
      <div
        style={{
          ...baseStyle,
          color: "#9ca3af",
          padding: 24,
          fontFamily: "var(--workbook-mono)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        터미널 준비 중...
      </div>
    );
  }

  // ttyd는 nginx에서 /<username>/ 경로로 리버스 프록시됨 (setup-ttyd.sh).
  // 같은 origin이라 X-Frame-Options: SAMEORIGIN 이면 임베드 가능.
  // mountTs: 컴포넌트가 새로 마운트될 때마다 고유값 → 브라우저가 절대 캐시 재사용 안 함
  const src = `/${username}/?_t=${mountTs}`;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <button
        onClick={() => clearMySession().catch(() => {})}
        title="터미널 초기화 (화면 비우기)"
        style={{
          position: "absolute", top: 6, right: 8, zIndex: 10,
          background: "rgba(30,30,30,0.85)", color: "#9ca3af",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
          padding: "3px 8px", fontSize: 11, fontWeight: 600,
          cursor: "pointer", backdropFilter: "blur(4px)",
          transition: "color .2s, border-color .2s",
          lineHeight: 1.4,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      >
        🔄 초기화
      </button>
      <iframe
        ref={iframeRef}
        key={`ttyd-${username}-${mountTs}`}
        src={src}
        title={`Terminal: ${username}`}
        style={baseStyle}
        onLoad={() => {
          try {
            iframeRef.current?.contentWindow?.postMessage({ type: "theme", dark: darkMode }, "*");
          } catch {}
        }}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
