// FileExplorer.jsx
// 사용자 홈 디렉터리의 파일/폴더를 리스팅, 더블클릭으로 미리보기 모달.
// 미션 슬라이드의 prompt 영역 밑에 들어감.

import { useEffect, useState, useCallback } from "react";
import { listProjectDir, readProjectFile } from "../lib/runtime.js";

function fmtSize(n) {
  if (!n) return "";
  if (n < 1024) return n + "B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + "KB";
  return (n / 1024 / 1024).toFixed(1) + "MB";
}

// initialPath: 미션이 만들 파일의 부모 디렉터리 (예: ".claude/skills/ai-plan-report")
//   → 탐색기가 그 폴더를 자동으로 열어서 학습자가 결과를 바로 확인 가능.
// highlightPaths: 강조해서 보여줄 파일/폴더 이름 배열.
export default function FileExplorer({ M, refreshKey, initialPath = "", highlightPaths = [] }) {
  const [cwd, setCwd] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { path, content, error }

  const load = useCallback(async (path = cwd) => {
    setLoading(true);
    setError(null);
    try {
      const r = await listProjectDir(path);
      setCwd(r.path || "");
      setItems(r.items || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  // 첫 마운트 + initialPath 변경 시 자동으로 해당 디렉터리로 이동.
  // initialPath 가 파일 경로면 부모 디렉터리로 fallback (디렉터리가 없으면 위로 거슬러 올라감).
  useEffect(() => {
    let target = initialPath || "";
    // 파일명이면 부모 디렉터리만 추출
    if (target && /\.[a-zA-Z0-9]+$/.test(target.split("/").pop() || "")) {
      const parts = target.split("/");
      parts.pop();
      target = parts.join("/");
    }
    let cancelled = false;
    (async () => {
      const tryPath = async (p) => {
        try {
          const r = await listProjectDir(p);
          if (cancelled) return true;
          setCwd(r.path || "");
          setItems(r.items || []);
          return true;
        } catch { return false; }
      };
      // 시도 → 실패 시 부모로 fallback
      let p = target;
      while (true) {
        if (await tryPath(p)) return;
        if (!p) return;
        const parts = p.split("/").filter(Boolean);
        parts.pop();
        p = parts.join("/");
      }
    })();
    return () => { cancelled = true; };
  }, [initialPath]);

  useEffect(() => { load(cwd); /* eslint-disable-next-line */ }, [refreshKey]);

  // 30초마다 자동 새로고침 (수동 🔄 버튼으로 즉시 갱신 가능)
  useEffect(() => {
    const id = setInterval(() => { load(cwd); }, 30000);
    return () => clearInterval(id);
  }, [cwd, load]);

  const goUp = () => {
    if (!cwd) return;
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    load(parts.join("/"));
  };

  const open = async (item) => {
    if (item.isDir) {
      const next = cwd ? `${cwd}/${item.name}` : item.name;
      load(next);
    } else {
      // 파일 미리보기
      const fullPath = cwd ? `${cwd}/${item.name}` : item.name;
      try {
        const content = await readProjectFile(fullPath);
        setPreview({ path: fullPath, content, error: null });
      } catch (e) {
        setPreview({ path: fullPath, content: "", error: String(e.message || e) });
      }
    }
  };

  return (
    <div style={{
      marginTop: 12,
      border: `1px solid ${M.bd}`,
      borderRadius: 8,
      background: M.bg2,
      overflow: "hidden",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px",
        background: M.bg3, borderBottom: `1px solid ${M.bd}`,
        fontSize: 12,
      }}>
        <span style={{ color: M.tx3, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
          📁 파일
        </span>
        <button
          onClick={goUp}
          disabled={!cwd}
          title="상위 폴더"
          style={{
            background: "transparent", border: `1px solid ${M.bd}`,
            color: !cwd ? M.tx3 : M.tx2,
            borderRadius: 4, padding: "2px 8px",
            fontSize: 11, cursor: !cwd ? "default" : "pointer",
          }}
        >↑</button>
        <button
          onClick={() => load(cwd)}
          title="새로고침"
          style={{
            background: "transparent", border: `1px solid ${M.bd}`,
            color: M.tx2, borderRadius: 4, padding: "2px 8px",
            fontSize: 11, cursor: "pointer",
          }}
        >🔄</button>
        <span style={{ color: M.or, fontFamily: "var(--workbook-mono)", marginLeft: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          ~/{cwd}
        </span>
      </div>

      {/* 리스트 */}
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {loading && <div style={{ padding: "10px 12px", color: M.tx3, fontSize: 12 }}>로딩 중...</div>}
        {error && <div style={{ padding: "10px 12px", color: "#fca5a5", fontSize: 12 }}>오류: {error}</div>}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: "16px 12px", color: M.tx3, fontSize: 12, textAlign: "center" }}>비어 있음</div>
        )}
        {items.map((item, i) => {
          // 강조할 파일이면 오렌지 배경 + 굵게
          const fullRel = cwd ? `${cwd}/${item.name}` : item.name;
          const isHl = highlightPaths.some(p => p === item.name || p === fullRel || p.endsWith("/" + item.name));
          return (
          <div
            key={i}
            onDoubleClick={() => open(item)}
            onClick={(e) => { if (item.isDir) open(item); }}
            title={item.isDir ? "더블클릭 또는 클릭하여 폴더 열기" : "더블클릭하여 미리보기"}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 12px",
              cursor: "pointer", fontSize: 12,
              borderBottom: `1px solid ${M.bd}33`,
              userSelect: "none",
              background: isHl ? M.or + "22" : "transparent",
              borderLeft: isHl ? `3px solid ${M.or}` : "3px solid transparent",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isHl ? M.or + "33" : M.or + "11"}
            onMouseLeave={(e) => e.currentTarget.style.background = isHl ? M.or + "22" : "transparent"}
          >
            <span style={{ width: 16, fontSize: 14 }}>{item.isDir ? "📁" : "📄"}</span>
            <span style={{ flex: 1, color: isHl ? M.or : (item.isDir ? M.or : M.tx2), fontFamily: "var(--workbook-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isHl ? 800 : 400 }}>
              {item.name}{item.isDir ? "/" : ""}
            </span>
            {isHl && <span style={{ color: M.or, fontSize: 10, fontWeight: 800 }}>✓ 미션</span>}
            {!item.isDir && !isHl && (
              <span style={{ color: M.tx3, fontSize: 10 }}>{fmtSize(item.size)}</span>
            )}
          </div>
        ); })}
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 12,
            padding: "20px 24px", maxWidth: 900, width: "100%",
            maxHeight: "85vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 14, color: M.or, fontFamily: "var(--workbook-mono)", overflow: "hidden", textOverflow: "ellipsis" }}>
                📄 ~/{preview.path}
              </div>
              <button onClick={() => setPreview(null)}
                style={{ background: "transparent", border: "none", color: M.tx3, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            {preview.error ? (
              <div style={{ color: "#fca5a5", padding: 16, fontSize: 13 }}>
                미리보기 실패: {preview.error}
                <div style={{ color: M.tx3, marginTop: 8, fontSize: 11 }}>
                  바이너리 파일이거나 너무 크거나 권한 문제일 수 있습니다.
                </div>
              </div>
            ) : (
              <pre style={{
                flex: 1, overflow: "auto",
                background: "#0a0a0a", color: "#e5e5e5",
                padding: 16, borderRadius: 8,
                fontSize: 12, fontFamily: "var(--workbook-mono)",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                border: `1px solid ${M.bd}`,
                margin: 0,
              }}>
                {preview.content || "(빈 파일)"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
