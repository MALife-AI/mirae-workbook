import { useState, useEffect, useRef, lazy, Suspense } from "react";

const NativeTerminal = lazy(() => import("./NativeTerminal.jsx"));

// ═══ MIRAE ASSET BRAND ═══
const M = {
  or: "#F58220", orL: "#F0B26B", orD: "#CB6015",
  bl: "#043B72", blL: "#7E9FC3", blM: "#0086B8", ac: "#00A9CE",
  bg: "#041828", bg2: "#061E30", bg3: "#021018",
  bd: "#0A3050", bd2: "#0E4060",
  tx: "#E5E8EC", tx2: "#8DA0B8", tx3: "#5A7A98",
};

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill={M.bl}/>
        <circle cx="20" cy="16" r="7" stroke={M.or} strokeWidth="2" fill="none"/>
        <circle cx="20" cy="16" r="2.5" fill={M.or}/>
        <path d="M13 16H8M27 16H32M20 9V4M20 23V28" stroke={M.or} strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
        <path d="M12 28L16 24M28 28L24 24" stroke={M.orL} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 32H26" stroke={M.orL} strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
      </svg>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: M.or, lineHeight: 1.2 }}>Vibe Coding</div>
        <div style={{ fontSize: 9, color: M.blL, letterSpacing: .5, fontWeight: 500 }}>AI WORKBOOK</div>
      </div>
    </div>
  );
}

// ═══ CHAPTERS ═══
const CHS = [
  { id: "overview", icon: "📋", t: "교육 개요", s: "무엇을, 왜 배우는가" },
  { id: "setup", icon: "⚙️", t: "환경 셋업", s: "설치부터 첫 실행까지" },
  { id: "pipeline", icon: "🔄", t: "핵심 파이프라인", s: "템플릿 → 리서치 → 최종 파일" },
  { id: "step1", icon: "📂", t: "Step 1: 템플릿 분석", s: "pptx/docx에서 XML 추출" },
  { id: "step2", icon: "🔍", t: "Step 2: 자동 리서치", s: "주제별 웹 리서치 자동화" },
  { id: "step3", icon: "✍️", t: "Step 3: 콘텐츠 생성", s: "리서치 → 보고서/슬라이드 작성" },
  { id: "step4", icon: "📦", t: "Step 4: 최종 파일 출력", s: "템플릿 적용 pptx/docx 생성" },
  { id: "skills-hooks", icon: "🎯", t: "Skill & Hook 설정", s: "자동화 루틴 + 안전장치" },
  { id: "mcp-connect", icon: "🔌", t: "MCP 외부 연결", s: "Slack, Jira, DB 연동" },
  { id: "practice", icon: "🚀", t: "실전 실습", s: "주제 선택 → 완성까지 원스톱" },
];


// ═══ Tauri invoke 헬퍼 ═══
function isTauri() {
  return typeof window !== "undefined" && (window.__TAURI__ || window.__TAURI_INTERNALS__);
}
let _invoke = null;
async function tauriInvoke(cmd, args) {
  if (!isTauri()) throw new Error("Not Tauri");
  if (!_invoke) { const m = await import("@tauri-apps/api/core"); _invoke = m.invoke; }
  return _invoke(cmd, args);
}

// ═══ UI COMPONENTS ═══
function Code({ code, name, filePath }) {
  const [cp, setCp] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savePath, setSavePath] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(code);
  const [fileExists, setFileExists] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const textareaRef = useRef(null);
  const tauri = isTauri();

  // 파일 존재 여부 확인 + 존재하면 디스크 내용 로드
  useEffect(() => {
    if (!filePath || !tauri) return;
    tauriInvoke("check_project_file", { path: filePath }).then(exists => {
      setFileExists(exists);
      if (exists) {
        tauriInvoke("read_project_file", { path: filePath }).then(content => {
          setEditContent(content);
          setLoaded(true);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath) return;
    try {
      const fullPath = await tauriInvoke("write_project_file", { path: filePath, content: editContent });
      setSavePath(fullPath);
      setSaved(true);
      setFileExists(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      alert("파일 저장 실패: " + e);
    }
  };

  const handleEdit = async () => {
    // 편집 모드 진입 시 디스크에서 최신 내용 로드
    if (filePath && tauri && fileExists) {
      try {
        const content = await tauriInvoke("read_project_file", { path: filePath });
        setEditContent(content);
      } catch (_) {}
    } else {
      setEditContent(code);
    }
    setEditing(true);
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollTop = 0;
    }
  }, [editing]);

  const displayContent = loaded && fileExists ? editContent : code;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${editing ? M.or + "88" : M.bd}`, margin: "16px 0", transition: "border .2s" }}>
      <div style={{ background: M.bg2, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ color: M.or, fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {filePath && fileExists && !editing && (
            <span style={{ background: "#05966933", color: "#86efac", fontSize: 9, padding: "2px 6px", borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>저장됨</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {filePath && tauri && !editing && (
            <button onClick={handleEdit}
              style={{ background: M.blM, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              ✏️ 편집
            </button>
          )}
          {filePath && tauri && editing && (
            <>
              <button onClick={handleSave}
                style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                💾 저장
              </button>
              <button onClick={() => { setEditing(false); setEditContent(displayContent); }}
                style={{ background: M.bd, color: M.tx2, border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11 }}>
                취소
              </button>
            </>
          )}
          {filePath && tauri && !editing && !fileExists && (
            <button onClick={handleSave}
              style={{ background: saved ? "#059669" : M.or, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all .2s" }}>
              {saved ? "✓ 생성됨!" : "📁 파일 생성"}
            </button>
          )}
          {!editing && (
            <button onClick={() => { navigator.clipboard.writeText(displayContent); setCp(true); setTimeout(() => setCp(false), 2000); }}
              style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11 }}>
              {cp ? "✓ 복사됨!" : "📋 복사"}
            </button>
          )}
        </div>
      </div>
      {saved && savePath && (
        <div style={{ background: "#05966622", padding: "6px 16px", fontSize: 11, color: "#86efac", fontFamily: "monospace" }}>
          ✓ {savePath}
        </div>
      )}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          spellCheck={false}
          style={{
            background: "#0a1520", color: M.tx, padding: 16, margin: 0, width: "100%",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.7,
            border: "none", outline: "none", resize: "vertical", minHeight: 200,
            display: "block", boxSizing: "border-box",
          }}
          rows={Math.max(10, editContent.split("\n").length + 2)}
        />
      ) : (
        <pre style={{ background: M.bg3, padding: 16, margin: 0, overflowX: "auto", fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, color: M.tx }}>{displayContent}</pre>
      )}
    </div>
  );
}

// 한 줄 명령어 복사
function Cmd({ cmd, desc }) {
  const [cp, setCp] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", background: M.bg3, borderRadius: 8, border: `1px solid ${M.bd}`, overflow: "hidden" }}>
        {desc && <span style={{ color: M.tx3, fontSize: 11, padding: "8px 0 8px 12px", whiteSpace: "nowrap" }}>{desc}</span>}
        <code style={{ flex: 1, color: M.or, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", padding: "8px 12px", whiteSpace: "nowrap", overflow: "auto" }}>{cmd}</code>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(cmd); setCp(true); setTimeout(() => setCp(false), 1500); }}
        style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, flexShrink: 0, transition: "all .15s" }}>
        {cp ? "✓" : "📋"}
      </button>
    </div>
  );
}

// 참고용 블록 (구조도, 코드 예시 등)
function Ref({ title, children }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${M.bd}`, margin: "16px 0" }}>
      {title && <div style={{ background: M.bg2, padding: "8px 16px", fontSize: 12, color: M.tx3, fontFamily: "monospace" }}>{title}</div>}
      <pre style={{ background: M.bg3, padding: 16, margin: 0, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.8, color: M.tx2, whiteSpace: "pre-wrap" }}>{children}</pre>
    </div>
  );
}

function Flow({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", margin: "20px 0" }}>
      {steps.map((s, i) => (
        <div key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${s.c1},${s.c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: `0 0 24px ${s.c1}33` }}>{s.icon}</div>
            <div style={{ background: M.bg2, borderRadius: 12, padding: "14px 20px", flex: 1, border: `1px solid ${M.bd}` }}>
              <div style={{ fontWeight: 700, color: M.tx, fontSize: 15 }}>{s.t}</div>
              <div style={{ color: M.tx2, fontSize: 13, marginTop: 2 }}>{s.d}</div>
            </div>
          </div>
          {i < steps.length - 1 && <div style={{ width: 2, height: 24, background: `linear-gradient(to bottom,${M.or}44,${M.or}11)`, marginLeft: 23 }} />}
        </div>
      ))}
    </div>
  );
}

function Tip({ type, children }) {
  const C = { tip: { bg: "#0A2040", bd: M.blM, ic: "💡", lb: "꿀팁" }, warn: { bg: "#2d1b0e", bd: M.or, ic: "⚠️", lb: "주의" }, key: { bg: "#0A1830", bd: M.blL, ic: "🔑", lb: "핵심" }, try: { bg: "#0A2818", bd: "#059669", ic: "🧪", lb: "실습" } }[type || "tip"];
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.bd}44`, borderLeft: `3px solid ${C.bd}`, borderRadius: "0 10px 10px 0", padding: "14px 18px", margin: "16px 0" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: C.bd, marginBottom: 6 }}>{C.ic} {C.lb}</div>
      <div style={{ color: M.tx, fontSize: 14, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

// ═══ 프로젝트 구조 일괄 생성 ═══
const PROJECT_FILES = {
  "CLAUDE.md": `# 미래에셋 문서 자동화 프로젝트

## 프로젝트 목적
- 미래에셋 공식 템플릿을 사용한 보고서/PPT 자동 생성
- 웹 리서치 → 콘텐츠 작성 → 최종 파일 출력 파이프라인

## 필수 규칙
- 모든 문서는 templates/ 폴더의 공식 템플릿 사용
- 브랜드 색상: Primary #F58220 (오렌지), Secondary #043B72 (블루)
- 개인정보(고객명, 주민번호, 연락처) 절대 포함 금지
- 데이터 출처를 반드시 명시 (기관명 + 발행일)
- 파일명 규칙: YYYY-MM-DD_[유형]_[주제].확장자

## 문서 품질 기준
- 보고서: 요약 → 현황 → 분석 → 시사점 → 제언 구조
- PPT: 표지 → 목차 → 본문(5-8장) → 요약 → Q&A
- 모든 수치에 출처 각주 포함
- 차트는 미래에셋 색상 팔레트 사용`,

  ".claude/settings.json": `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "command": "bash .claude/hooks/check-pii.sh",
        "description": "파일 쓰기 전 개인정보 유출 검사"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "command": "echo '파일 생성 완료' >> .claude/hooks/activity.log",
        "description": "파일 생성 로그 기록"
      }
    ]
  }
}`,

  ".claude/hooks/check-pii.sh": `#!/bin/bash
# 개인정보 포함 여부 검사 Hook
# PreToolUse 이벤트에서 Write matcher와 함께 동작

# 주민등록번호 패턴 (6자리-7자리)
if echo "$TOOL_INPUT" | grep -qE '[0-9]{6}-[0-9]{7}'; then
  echo '{"block": true, "message": "❌ 주민등록번호가 감지되었습니다! 마스킹 처리 후 다시 시도하세요."}'
  exit 0
fi

# 전화번호 패턴 (010-XXXX-XXXX)
if echo "$TOOL_INPUT" | grep -qE '010-[0-9]{4}-[0-9]{4}'; then
  echo '{"block": true, "message": "❌ 전화번호가 감지되었습니다! 마스킹(010-****-1234) 처리 후 다시 시도하세요."}'
  exit 0
fi

# 이메일 패턴
if echo "$TOOL_INPUT" | grep -qE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'; then
  echo '{"feedback": "⚠️ 이메일 주소가 감지되었습니다. 마스킹 여부를 확인하세요."}'
fi

echo '{"continue": true}'`,

  ".claude/skills/report-writer/SKILL.md": `---
description: "보고서(docx) 작성 요청 시 사용"
---

# 보고서 작성 가이드

## 문서 구조 (6-Section)
1. 표지 — 제목 / 부서명 / 작성자 / 날짜
2. 요약 (Executive Summary) — 핵심 내용 3줄 이내
3. 현황 분석 — 시장 규모/동향 데이터, 표 또는 차트
4. 심층 분석 — 트렌드 3-5개, 데이터 근거
5. 시사점 & 리스크 — 미래에셋생명에 미치는 영향
6. 제언 (Action Items) — 구체적 실행 과제 3-5개

## 작성 규칙
- 모든 수치에 출처 각주 삽입
- 표는 미래에셋 스타일 (오렌지 헤더)
- 개인정보 절대 포함 금지`,

  ".claude/skills/pptx-generator/SKILL.md": `---
description: "PPT(pptx) 생성 요청 시 사용"
---

# PPT 생성 가이드

## 슬라이드 구성 (8장 기본)
1. 표지 — 제목 + 부서 + 날짜
2. 목차 — 자동 생성
3. 시장 개요 — 핵심 수치 3개
4. 주요 트렌드 — 트렌드 3개
5. 데이터 분석 — 차트
6. 비교 분석 — 테이블
7. 시사점 & Action Items
8. Q&A / 감사 페이지

## 디자인 규칙
- 한 슬라이드에 핵심 메시지 1개만
- 텍스트 최소화, 수치와 차트 우선
- 미래에셋 색상 팔레트 사용
- 폰트: 맑은 고딕 (제목 24pt / 본문 16pt)`,

  ".claude/skills/web-researcher/SKILL.md": `---
description: "주제에 대해 웹 리서치할 때 사용"
---

# 웹 리서치 가이드

## 검색 전략
1. 주제에서 핵심 키워드 3-5개 추출
2. 각 키워드에 대해 검색 쿼리 조합:
   - "[키워드] 2025 2026 시장 동향"
   - "[키워드] 통계 금융감독원"
   - "[키워드] 전망 보험연구원"

## 우선 참고 소스
- 금융감독원 보도자료
- 보험연구원 리포트
- 생명보험협회 통계
- 한국신용평가/한국기업평가
- 주요 경제지 (매경, 한경, 서경)

## 수집 데이터 형식
- 핵심 수치 (시장 규모, 성장률, 점유율 등)
- 주요 트렌드 3-5개
- 리스크 요인
- 출처 (기관명 + 발행일 + URL)`,

  ".claude/commands/report.md": `---
description: "주제를 입력하면 리서치 → 보고서+PPT 자동 생성"
allowed-tools: Read, Write, Bash, WebFetch, mcp__web-search
---

다음 과정을 순서대로 진행하세요:

1. templates/ 폴더에서 docx, pptx 템플릿을 분석하세요
2. "$ARGUMENTS" 주제에 대해 웹 리서치를 수행하세요
   - 금감원, 보험연구원, 생명보험협회 등 공신력 있는 소스 우선
   - 최신 데이터 (최근 6개월 이내) 우선 수집
3. 리서치 결과를 바탕으로 보고서(docx) 콘텐츠를 작성하세요
4. 동일 내용으로 PPT(pptx)도 작성하세요
5. 미래에셋 템플릿을 적용하여 최종 파일을 output/에 저장하세요
6. 생성된 파일 목록과 요약을 출력하세요`,

  ".mcp.json": `{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-web-search"],
      "env": {
        "BRAVE_API_KEY": "여기에_API키_입력"
      }
    }
  }
}`,
};

function SetupAllFiles() {
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [results, setResults] = useState([]);
  const tauri = isTauri();

  const handleCreate = async () => {
    if (!tauri) return;
    setStatus("working");
    const res = [];
    for (const [path, content] of Object.entries(PROJECT_FILES)) {
      try {
        // 이미 존재하면 건너뜀
        const exists = await tauriInvoke("check_project_file", { path });
        if (exists) {
          res.push({ path, ok: true, skipped: true });
        } else {
          await tauriInvoke("write_project_file", { path, content });
          res.push({ path, ok: true, skipped: false });
        }
      } catch (e) {
        res.push({ path, ok: false, err: String(e) });
      }
    }
    // check-pii.sh 실행 권한 부여
    try {
      await tauriInvoke("run_shell", { command: "chmod +x .claude/hooks/check-pii.sh" });
    } catch (_) {}
    setResults(res);
    setStatus(res.every(r => r.ok) ? "done" : "error");
  };

  return (
    <div style={{ background: M.bg2, borderRadius: 14, padding: 20, margin: "20px 0", border: `2px solid ${status === "done" ? "#059669" : M.or}44` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: results.length ? 16 : 0 }}>
        <div>
          <div style={{ fontWeight: 800, color: M.or, fontSize: 16 }}>프로젝트 구조 한 번에 생성</div>
          <div style={{ color: M.tx2, fontSize: 12, marginTop: 4 }}>
            CLAUDE.md, Skill 3종, Hook, 슬래시 커맨드, MCP 설정 — 총 {Object.keys(PROJECT_FILES).length}개 파일
          </div>
        </div>
        {tauri && status !== "done" && (
          <button onClick={handleCreate} disabled={status === "working"}
            style={{ background: M.or, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: status === "working" ? "wait" : "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
            {status === "working" ? "생성 중..." : "🚀 전체 생성"}
          </button>
        )}
        {status === "done" && (
          <span style={{ color: "#86efac", fontWeight: 700, fontSize: 14 }}>✓ 완료!</span>
        )}
        {!tauri && (
          <span style={{ color: M.tx3, fontSize: 12 }}>Tauri 앱에서만 사용 가능</span>
        )}
      </div>
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "monospace" }}>
              <span style={{ color: r.ok ? "#86efac" : "#fca5a5" }}>{r.ok ? "✓" : "✗"}</span>
              <span style={{ color: M.tx2 }}>{r.path}</span>
              {r.skipped && <span style={{ color: M.tx3, fontSize: 10 }}>(이미 존재 — 건너뜀)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ CHAPTER CONTENT ═══
const S = { p: { color: M.tx, fontSize: 15, lineHeight: 1.9, margin: "12px 0" }, h3: { fontSize: 20, fontWeight: 700, color: M.or, marginTop: 32, marginBottom: 10 } };

function Ch({ id }) {
  if (id === "overview") return (<>
    <h2 style={{ fontSize: 30, fontWeight: 800, color: M.tx, lineHeight: 1.3 }}>Claude Code로<br/><span style={{ color: M.or }}>보고서·PPT 자동 생성</span> 마스터하기</h2>
    <p style={S.p}>이 워크북은 미래에셋생명 임직원이 <strong style={{ color: M.or }}>반복적인 문서 작업</strong>을 Claude Code로 자동화하는 방법을 처음부터 끝까지 가르칩니다.</p>
    <Tip type="key">
      <strong>핵심 파이프라인:</strong> 미래에셋 템플릿(.pptx/.docx) → XML 구조 분석 → 주제별 웹 리서치 → AI가 내용 자동 작성 → 동일한 미래에셋 디자인의 최종 파일 출력
    </Tip>

    <h3 style={S.h3}>Claude Code란?</h3>
    <p style={S.p}>Claude Code는 Anthropic이 만든 <strong style={{ color: M.or }}>터미널 기반 AI 코딩 에이전트</strong>입니다. 일반적인 챗봇과 달리, <strong>실제로 파일을 읽고, 코드를 작성하고, 명령어를 실행</strong>할 수 있습니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 800, color: "#fca5a5", fontSize: 14, marginBottom: 10 }}>일반 AI 챗봇</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.8 }}>
          "보고서 만들어줘" →<br/>
          텍스트로 된 답변만 출력<br/>
          복사 → 붙여넣기 → 서식 수동 적용<br/>
          <strong style={{ color: "#fca5a5" }}>파일 생성 불가</strong>
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.or}44` }}>
        <div style={{ fontWeight: 800, color: "#86efac", fontSize: 14, marginBottom: 10 }}>Claude Code</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.8 }}>
          "보고서 만들어줘" →<br/>
          웹 리서치 → 데이터 수집 → 코드 작성<br/>
          → 템플릿 적용 → <strong style={{ color: "#86efac" }}>.docx/.pptx 파일 직접 생성</strong><br/>
          <strong style={{ color: "#86efac" }}>원클릭 완성</strong>
        </div>
      </div>
    </div>

    <h3 style={S.h3}>핵심 개념 5가지</h3>
    <p style={S.p}>이 워크북에서 배울 5가지 핵심 개념입니다. 각각의 역할을 이해하면 자동화의 전체 그림이 보입니다.</p>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
      {[
        { icon: "💬", name: "프롬프트 (Prompt)", desc: "Claude에게 내리는 명령. 자연어로 작성하며, 구체적일수록 결과가 좋음", ex: "\"2025 퇴직연금 시장 현황 보고서를 미래에셋 템플릿으로 만들어줘\"", color: M.ac },
        { icon: "📋", name: "CLAUDE.md", desc: "프로젝트 규칙서. Claude Code 시작 시 자동으로 읽혀서 매번 규칙을 반복 지시할 필요 없음", ex: "\"브랜드 색상 #F58220 사용\", \"개인정보 금지\", \"출처 명시\"", color: M.or },
        { icon: "🎯", name: "Skill (스킬)", desc: "특정 작업의 가이드라인. Claude가 상황을 판단해 자동으로 참고함 (제안 방식)", ex: "report-writer Skill → 보고서 6섹션 구조로 자동 작성", color: "#059669" },
        { icon: "⚡", name: "Hook (훅)", desc: "이벤트 발생 시 강제 실행되는 안전장치. 예외 없이 100% 동작", ex: "파일 쓰기 시 개인정보 검사 → 위반 시 즉시 차단", color: "#fbbf24" },
        { icon: "🔌", name: "MCP (외부 연결)", desc: "Claude Code에 외부 서비스를 연결하는 어댑터. 웹 검색, Slack, DB 등", ex: "web-search MCP → 실시간 웹 리서치 가능", color: M.blM },
      ].map(c => (
        <div key={c.name} style={{ background: M.bg2, borderRadius: 12, padding: "16px 20px", border: `1px solid ${M.bd}`, borderLeft: `3px solid ${c.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <span style={{ fontWeight: 800, color: c.color, fontSize: 15 }}>{c.name}</span>
          </div>
          <div style={{ color: M.tx, fontSize: 13, lineHeight: 1.7 }}>{c.desc}</div>
          <div style={{ color: M.tx3, fontSize: 12, marginTop: 6, fontFamily: "monospace", background: M.bg3, padding: "6px 10px", borderRadius: 6 }}>{c.ex}</div>
        </div>
      ))}
    </div>

    <h3 style={S.h3}>누가, 무엇을 배우나요?</h3>
    <p style={S.p}>어느 부서든, 어떤 주제든 동일한 방식으로 동작합니다. <strong>주제만 바꾸면</strong> 각 부서의 업무에 맞는 문서가 자동으로 만들어집니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, margin: "16px 0" }}>
      {[
        { icon: "📋", dept: "보험심사부", ex: "\"2025 언더라이팅 트렌드 보고서\"" },
        { icon: "📈", dept: "마케팅팀", ex: "\"MZ세대 보험 니즈 분석 PPT\"" },
        { icon: "⚖️", dept: "리스크관리", ex: "\"K-ICS 규제 변화 보고서\"" },
        { icon: "💰", dept: "퇴직연금팀", ex: "\"DC형 연금 시장 현황 PPT\"" },
        { icon: "📊", dept: "경영기획", ex: "\"2025 3분기 경영 실적 보고서\"" },
        { icon: "🖥️", dept: "IT/디지털", ex: "\"보험업 AI 도입 현황 PPT\"" },
      ].map(d => (
        <div key={d.dept} style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.bd}` }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{d.icon}</div>
          <div style={{ fontWeight: 700, color: M.or, fontSize: 13 }}>{d.dept}</div>
          <div style={{ color: M.tx2, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{d.ex}</div>
        </div>
      ))}
    </div>
    <h3 style={S.h3}>커리큘럼 구조</h3>
    <Flow steps={[
      { icon: "⚙️", t: "환경 셋업", d: "Claude Code 설치, 프로젝트 구조 이해, 첫 실행", c1: M.bl, c2: M.blM },
      { icon: "🔄", t: "핵심 파이프라인 이해", d: "템플릿 → 리서치 → 생성 → 출력 전체 흐름 파악", c1: M.or, c2: M.orL },
      { icon: "📂", t: "Step 1: 템플릿 분석", d: "pptx/docx를 열어 XML 구조를 파악하고 스타일 추출", c1: "#059669", c2: "#34d399" },
      { icon: "🔍", t: "Step 2: 자동 리서치", d: "MCP 웹 검색으로 주제별 최신 데이터 수집", c1: M.blM, c2: M.ac },
      { icon: "✍️", t: "Step 3: 콘텐츠 생성", d: "수집한 데이터를 보고서/슬라이드 구조에 맞춰 작성", c1: M.orD, c2: M.or },
      { icon: "📦", t: "Step 4: 최종 파일 출력", d: "미래에셋 템플릿이 적용된 .docx/.pptx 자동 생성", c1: M.bl, c2: M.blL },
      { icon: "🎯", t: "Skill·Hook·MCP 설정", d: "자동화 루틴, 보안 안전장치, 외부 도구 연결", c1: "#dc2626", c2: "#f87171" },
      { icon: "🚀", t: "실전 실습", d: "내 업무 주제로 직접 보고서+PPT 한 세트 완성", c1: M.or, c2: M.orL },
    ]} />
    <Tip type="try">아래 터미널에서 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude --version</code>을 입력해 Claude Code가 설치되어 있는지 확인하세요.</Tip>
  </>);

  if (id === "setup") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>환경 셋업</h2>
    <h3 style={S.h3}>0. 터미널(명령 프롬프트) 열기</h3>
    <p style={S.p}>Claude Code는 <strong style={{ color: M.or }}>터미널</strong>에서 실행합니다. 이 워크북 앱 없이도 아래 방법으로 터미널을 열 수 있습니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 800, color: M.ac, fontSize: 15, marginBottom: 12 }}>Windows</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 2 }}>
          <strong style={{ color: M.tx }}>방법 1: 검색</strong><br/>
          <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Win + S</code> → "cmd" 또는 "PowerShell" 검색 → 클릭<br/><br/>
          <strong style={{ color: M.tx }}>방법 2: 실행</strong><br/>
          <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Win + R</code> → <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>cmd</code> 입력 → Enter<br/><br/>
          <strong style={{ color: M.tx }}>방법 3: Windows Terminal (권장)</strong><br/>
          <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Win + X</code> → "터미널" 클릭
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 800, color: "#86efac", fontSize: 15, marginBottom: 12 }}>macOS</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 2 }}>
          <strong style={{ color: M.tx }}>방법 1: Spotlight</strong><br/>
          <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>Cmd + Space</code> → "터미널" 검색 → Enter<br/><br/>
          <strong style={{ color: M.tx }}>방법 2: Finder</strong><br/>
          응용 프로그램 → 유틸리티 → 터미널.app<br/><br/>
          <strong style={{ color: M.tx }}>방법 3: Launchpad</strong><br/>
          Launchpad → "기타" 폴더 → 터미널
        </div>
      </div>
    </div>
    <Tip type="tip">
      이 워크북 앱의 <strong>하단 터미널</strong>에서도 동일하게 사용할 수 있습니다. 하지만 워크북 없이 직접 터미널을 열어서 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude</code>를 실행해도 완전히 동일하게 동작합니다.
    </Tip>

    <h3 style={S.h3}>1. 설치 (한 번만)</h3>
    <Flow steps={[
      { icon: "1️⃣", t: "Node.js 설치", d: "nodejs.org → LTS 버전 다운로드 → 설치 (다음 계속 클릭)", c1: "#059669", c2: "#34d399" },
      { icon: "2️⃣", t: "Claude 구독", d: "claude.ai → Pro($20/월) 이상 구독 필요", c1: M.bl, c2: M.blM },
      { icon: "3️⃣", t: "Claude Code 설치", d: "터미널에서 아래 명령어 실행", c1: M.or, c2: M.orL },
    ]} />
    <Cmd cmd="npm install -g @anthropic-ai/claude-code" desc="설치" />
    <Cmd cmd="claude --version" desc="설치 확인" />

    <h3 style={S.h3}>2. 첫 실행 & 로그인 (최초 1회)</h3>
    <p style={S.p}>Claude Code를 처음 실행하면 <strong style={{ color: M.or }}>인증 화면</strong>이 나타납니다. 아래 순서를 따라하세요.</p>
    <p style={S.p}>1. 터미널에서 Claude Code를 실행합니다:</p>
    <Cmd cmd="claude" />
    <Ref title="로그인 메뉴가 나타납니다">{`┌──────────────────────────────────────┐
│  How would you like to authenticate? │
│                                      │
│  1. Claude.ai (OAuth)                │
│  2. Anthropic API Key       ← 선택!  │
│  3. Other providers                  │
└──────────────────────────────────────┘

→ 숫자 2를 누르세요
→ API 키 입력란이 나타나면 키를 붙여넣기(Ctrl+V / Cmd+V)하고 Enter`}</Ref>

    <h3 style={S.h3}>API 키 발급 방법</h3>
    <div style={{ background: M.bg2, borderRadius: 12, padding: 20, margin: "16px 0", border: `1px solid ${M.bd}` }}>
      <div style={{ fontWeight: 800, color: M.or, fontSize: 15, marginBottom: 16 }}>Anthropic API 키 발급 순서</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { n: "1", t: "console.anthropic.com 접속", d: "Anthropic 개발자 콘솔 사이트에 접속" },
          { n: "2", t: "회원가입 / 로그인", d: "이메일로 가입하거나 Google 계정으로 로그인" },
          { n: "3", t: "API Keys 메뉴 클릭", d: "좌측 메뉴에서 \"API Keys\" 선택" },
          { n: "4", t: "Create Key 버튼 클릭", d: "\"+ Create Key\" 버튼 클릭 → 키 이름 입력 (예: mirae-workbook)" },
          { n: "5", t: "키 복사 & 저장", d: "sk-ant-로 시작하는 키를 복사. ⚠️ 이 화면을 닫으면 다시 볼 수 없음!" },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: M.or, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
            <div>
              <span style={{ fontWeight: 700, color: M.tx, fontSize: 13 }}>{s.t}</span>
              <div style={{ color: M.tx2, fontSize: 12 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <Tip type="warn">
      <strong>API 키는 비밀번호와 같습니다!</strong> 절대 다른 사람에게 공유하거나 코드에 직접 넣지 마세요. 키가 노출되면 즉시 console.anthropic.com에서 해당 키를 삭제하고 새로 발급하세요.
    </Tip>

    <Tip type="tip">
      <strong>요금 안내:</strong> API 키는 사용량 기반 과금입니다. 첫 가입 시 $5 무료 크레딧이 제공됩니다. 이후에는 console.anthropic.com → Billing에서 결제 수단을 등록하면 됩니다. Claude Pro 구독($20/월)과는 별개입니다.
    </Tip>

    <Ref title="로그인 성공 시 화면">{`╭────────────────────────────────────────╮
│  Welcome to Claude Code!               │
│  Type your request to get started.     │
╰────────────────────────────────────────╯

> _  (여기에 프롬프트 입력)

로그인 정보는 저장되므로 다음부터는 바로 시작됩니다.`}</Ref>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>다시 로그인해야 할 때:</p>
    <Cmd cmd="claude logout" desc="로그아웃" />
    <Cmd cmd="claude" desc="재로그인" />

    <h3 style={S.h3}>3. 프로젝트 폴더 구조</h3>
    <p style={S.p}>문서 자동화를 위한 프로젝트 폴더를 만들고, 아래 구조로 셋업합니다.</p>
    <Ref title="프로젝트 폴더 구조">{`doc-automation/
├── CLAUDE.md                       ← 프로젝트 규칙 (AI가 자동 로드)
├── .mcp.json                       ← 외부 서비스 연결 설정
├── .claude/
│   ├── settings.json               ← Hook (자동 안전장치) 설정
│   ├── hooks/
│   │   └── check-pii.sh            ← 개인정보 유출 방지
│   ├── skills/
│   │   ├── report-writer/SKILL.md  ← 보고서 작성 가이드
│   │   ├── pptx-generator/SKILL.md ← PPT 생성 가이드
│   │   └── web-researcher/SKILL.md ← 리서치 가이드
│   └── commands/
│       └── report.md               ← /report 슬래시 커맨드
├── templates/                      ← 미래에셋 공식 템플릿 보관
│   ├── 미래에셋_보고서_템플릿.docx
│   └── 미래에셋_발표자료_템플릿.pptx
└── output/                         ← 생성된 최종 파일`}</Ref>

    <SetupAllFiles />
    <Tip type="tip">
      위 <strong>"전체 생성"</strong> 버튼을 누르면 모든 설정 파일이 프로젝트 폴더에 자동으로 만들어집니다. 이미 존재하는 파일은 건너뜁니다.<br/>
      아래에서 각 파일을 <strong>편집 → 저장</strong>할 수 있으니, 내용을 먼저 확인하고 필요하면 수정하세요.
    </Tip>

    <h3 style={S.h3}>4. CLAUDE.md 작성</h3>
    <p style={S.p}>이 파일은 Claude Code가 시작할 때 <strong style={{ color: M.or }}>자동으로 읽는 규칙서</strong>입니다. 한 번 작성해두면 매번 지시할 필요가 없어요.</p>
    <Code name="CLAUDE.md" filePath="CLAUDE.md" code={`# 미래에셋 문서 자동화 프로젝트

## 프로젝트 목적
- 미래에셋 공식 템플릿을 사용한 보고서/PPT 자동 생성
- 웹 리서치 → 콘텐츠 작성 → 최종 파일 출력 파이프라인

## 필수 규칙
- 모든 문서는 templates/ 폴더의 공식 템플릿 사용
- 브랜드 색상: Primary #F58220 (오렌지), Secondary #043B72 (블루)
- 개인정보(고객명, 주민번호, 연락처) 절대 포함 금지
- 데이터 출처를 반드시 명시 (기관명 + 발행일)
- 파일명 규칙: YYYY-MM-DD_[유형]_[주제].확장자

## 문서 품질 기준
- 보고서: 요약 → 현황 → 분석 → 시사점 → 제언 구조
- PPT: 표지 → 목차 → 본문(5-8장) → 요약 → Q&A
- 모든 수치에 출처 각주 포함
- 차트는 미래에셋 색상 팔레트 사용`} />

    <h3 style={S.h3}>5. 프롬프트(Prompt) 기초</h3>
    <p style={S.p}>프롬프트는 Claude에게 내리는 <strong style={{ color: M.or }}>자연어 명령</strong>입니다. 같은 요청이라도 프롬프트를 어떻게 쓰느냐에 따라 결과 품질이 달라집니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: "#2d1b0e", borderRadius: 12, padding: 16, border: `1px solid ${M.or}44` }}>
        <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 13, marginBottom: 8 }}>나쁜 프롬프트</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          "보고서 만들어줘"<br/>
          "시장 분석해줘"<br/>
          "PPT 작성"
        </div>
        <div style={{ color: M.tx3, fontSize: 11, marginTop: 8 }}>→ 주제 불명확, 형식 미지정, 범위 모호</div>
      </div>
      <div style={{ background: "#0A2818", borderRadius: 12, padding: 16, border: `1px solid #05966944` }}>
        <div style={{ fontWeight: 700, color: "#86efac", fontSize: 13, marginBottom: 8 }}>좋은 프롬프트</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          "2025 퇴직연금 시장 현황을<br/>
          미래에셋 보고서 템플릿으로<br/>
          6섹션 구조로 만들어줘.<br/>
          금감원 데이터 우선 참고."
        </div>
        <div style={{ color: M.tx3, fontSize: 11, marginTop: 8 }}>→ 주제 명확, 템플릿 지정, 구조/출처 지시</div>
      </div>
    </div>

    <h3 style={S.h3}>프롬프트 작성 공식</h3>
    <Ref title="프롬프트 공식: [역할] + [주제] + [형식] + [조건] + [출처]">{`예시 1 — 보고서:
"미래에셋 보고서 템플릿으로 2025 ESG 경영 현황 보고서를 작성해줘.
 요약→현황→분석→시사점→제언 6섹션 구조로,
 금감원과 보험연구원 데이터를 우선 참고해줘."

예시 2 — PPT:
"미래에셋 PPT 템플릿으로 MZ세대 보험 소비 트렌드 발표자료를 만들어줘.
 8장 이내, 한 슬라이드에 핵심 메시지 1개, 차트와 수치 중심으로."

예시 3 — 비교 분석:
"국내 주요 생명보험사 5곳의 디지털 전환 현황을 비교 분석해줘.
 표 형태로 정리하고, 미래에셋의 강점과 보완점을 도출해줘."`}</Ref>

    <Tip type="try">하단 터미널에서 직접 실습하세요!<br/>
    <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude</code>로 시작 → 위 프롬프트 공식을 참고해 여러분만의 프롬프트를 작성해보세요.</Tip>
  </>);

  if (id === "pipeline") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>핵심 파이프라인</h2>
    <p style={S.p}>이 챕터에서는 전체 자동화 플로우를 <strong style={{ color: M.or }}>한눈에</strong> 이해합니다. 이후 챕터에서 각 단계를 상세히 실습합니다.</p>

    <h3 style={S.h3}>전체 흐름: 4단계</h3>
    <div style={{ background: M.bg2, borderRadius: 14, padding: 24, margin: "20px 0", border: `1px solid ${M.bd}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignItems: "center" }}>
        {[
          { icon: "📂", label: "Step 1", desc: "템플릿 분석", detail: "pptx/docx의 XML 구조와\n미래에셋 스타일 추출", color: "#059669" },
          { icon: "🔍", label: "Step 2", desc: "자동 리서치", detail: "주제별 웹 검색으로\n최신 데이터 수집", color: M.blM },
          { icon: "✍️", label: "Step 3", desc: "콘텐츠 생성", detail: "리서치 데이터를\n문서 구조에 맞춰 작성", color: M.or },
          { icon: "📦", label: "Step 4", desc: "파일 출력", detail: "미래에셋 템플릿 적용\n.docx/.pptx 생성", color: M.orD },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 100, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: s.color + "22", border: `2px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 8px" }}>{s.icon}</div>
              <div style={{ fontWeight: 700, color: s.color, fontSize: 11 }}>{s.label}</div>
              <div style={{ fontWeight: 700, color: M.tx, fontSize: 13, marginTop: 2 }}>{s.desc}</div>
              <div style={{ color: M.tx3, fontSize: 11, marginTop: 4, whiteSpace: "pre-wrap" }}>{s.detail}</div>
            </div>
            {i < 3 && <div style={{ color: M.or, fontSize: 24, fontWeight: 700 }}>→</div>}
          </div>
        ))}
      </div>
    </div>

    <h3 style={S.h3}>실제 명령어로 보면?</h3>
    <p style={S.p}>Claude Code 세션에서 이렇게 실행됩니다:</p>
    <p style={S.p}>Claude Code 세션에서 이렇게 실행됩니다:</p>
    <Cmd cmd="claude" desc="시작" />
    <Ref title="원스톱 또는 단계별 실행">{`원스톱: > 2025 보험 시장 동향 보고서 만들어줘

단계별:
  > pptx 템플릿 분석해줘          ← Step 1
  > 2025 보험 시장 동향 리서치해줘  ← Step 2
  > 보고서 만들어줘                ← Step 3+4
  > PPT 만들어줘                  ← Step 3+4 (별도)`}</Ref>

    <Tip type="key">
      <strong>주제만 바꾸면 어떤 부서의 어떤 문서든 동일한 플로우로 생성됩니다.</strong><br/>
      "ESG 경영 현황" → "K-ICS 도입 영향" → "MZ세대 보험 소비 트렌드" → 뭐든 OK!
    </Tip>

    <h3 style={S.h3}>프롬프트 모드: -p 플래그</h3>
    <p style={S.p}>Claude Code는 두 가지 모드로 실행할 수 있습니다:</p>
    <Ref title="1. 대화형 모드 — 대화하며 작업 (기본)">{`claude 시작 후 여러 번 대화:
  > 보고서 만들어줘
  > 차트도 추가해줘
  > 끝! exit`}</Ref>
    <p style={{ color: M.tx3, fontSize: 12, margin: "12px 0 4px" }}>2. 원샷 모드 (-p) — 한 번에 실행하고 끝:</p>
    <Cmd cmd='claude -p "2025 퇴직연금 시장 보고서 만들어줘"' />
    <p style={{ color: M.tx3, fontSize: 12, margin: "12px 0 4px" }}>3. 파이프 모드 — 다른 명령과 연결:</p>
    <Cmd cmd='echo "ESG 현황 요약해줘" | claude -p' />
    <Cmd cmd='cat research.md | claude -p "이 데이터로 PPT 만들어줘"' />

    <Tip type="try">하단 터미널에서 원샷 모드를 체험하세요:<br/>
    <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude -p "현재 폴더 구조를 설명해줘"</code></Tip>
  </>);

  if (id === "step1") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>Step 1: 템플릿 분석</h2>
    <p style={S.p}>pptx와 docx 파일은 사실 <strong style={{ color: M.or }}>ZIP으로 압축된 XML 파일들의 묶음</strong>입니다. Claude Code가 이 구조를 분석해서 어디에 어떤 내용을 넣을지 파악합니다.</p>

    <h3 style={S.h3}>pptx 파일의 실제 구조</h3>
    <p style={S.p}>PPT 파일의 확장자를 .zip으로 바꿔서 열면 이런 구조가 보입니다:</p>
    <Ref title="pptx 내부 XML 구조">{`미래에셋_발표자료_템플릿.pptx (= ZIP 파일)
│
├── [Content_Types].xml        # 파일 타입 정의
├── _rels/.rels                # 관계 정의
│
├── ppt/
│   ├── presentation.xml       # 프레젠테이션 전체 구조
│   ├── presProps.xml          # 프레젠테이션 속성
│   │
│   ├── slides/                # ← 각 슬라이드의 내용
│   │   ├── slide1.xml         #    표지 (제목, 부서명, 날짜)
│   │   ├── slide2.xml         #    목차
│   │   └── slide3.xml         #    본문 (텍스트 플레이스홀더)
│   │
│   ├── slideLayouts/          # ← 레이아웃 (어디에 뭘 배치할지)
│   │   ├── slideLayout1.xml   #    "제목 슬라이드" 레이아웃
│   │   └── slideLayout2.xml   #    "제목+내용" 레이아웃
│   │
│   ├── slideMasters/          # ← 마스터 (전체 디자인 기본 틀)
│   │   └── slideMaster1.xml   #    미래에셋 마스터 디자인
│   │
│   └── theme/
│       └── theme1.xml         # ← 테마 색상 (오렌지, 블루 등)
│
└── docProps/
    ├── app.xml                # 앱 속성
    └── core.xml               # 작성자, 날짜 등 메타데이터`}</Ref>

    <h3 style={S.h3}>docx 파일의 실제 구조</h3>
    <Ref title="docx 내부 XML 구조">{`미래에셋_보고서_템플릿.docx (= ZIP 파일)
│
├── word/
│   ├── document.xml           # ← 본문 내용 (핵심!)
│   ├── styles.xml             # ← 스타일 정의 (제목, 본문, 표 등)
│   ├── header1.xml            # ← 헤더 (미래에셋 로고)
│   ├── footer1.xml            # ← 푸터 (페이지번호)
│   ├── numbering.xml          # ← 목록 번호 스타일
│   └── theme/theme1.xml       # ← 테마 색상
│
└── docProps/
    └── core.xml               # 메타데이터`}</Ref>

    <Tip type="key">
      <strong>Claude Code가 하는 일:</strong> 이 XML들을 읽어서 ① 어떤 스타일(폰트, 색상, 크기)이 쓰이는지, ② 어디에 텍스트를 넣을 수 있는지, ③ 표/차트 구조가 어떤지를 파악합니다. <br/>이 정보를 바탕으로 새 문서를 만들 때 <strong>동일한 디자인</strong>이 유지됩니다.
    </Tip>

    <h3 style={S.h3}>python-pptx / python-docx로 조작하는 원리</h3>
    <Ref title="Claude Code가 내부적으로 실행하는 코드 (참고용)">{`# pptx 템플릿 분석 예시
from pptx import Presentation
prs = Presentation('templates/미래에셋_발표자료_템플릿.pptx')

# 슬라이드 레이아웃 확인
for layout in prs.slide_layouts:
    print(f"레이아웃: {layout.name}")
    for ph in layout.placeholders:
        print(f"  플레이스홀더: idx={ph.placeholder_format.idx}, "
              f"type={ph.placeholder_format.type}")

# 테마 색상 추출
theme = prs.slide_masters[0].slide_layouts[0]
# → Primary: #F58220, Secondary: #043B72

# ─────────────────────────────────────
# docx 템플릿 분석 예시
from docx import Document
doc = Document('templates/미래에셋_보고서_템플릿.docx')

# 스타일 확인
for style in doc.styles:
    if style.type == 1:  # Paragraph
        print(f"스타일: {style.name}, "
              f"폰트: {style.font.name}, "
              f"크기: {style.font.size}")`}</Ref>

    <Tip type="try">아래 터미널에서 직접 체험하세요!<br/>
    <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude</code> 시작 → <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>pptx 템플릿 분석해줘</code> 또는 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>docx 템플릿 분석해줘</code></Tip>
  </>);

  if (id === "step2") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>Step 2: 자동 리서치</h2>
    <p style={S.p}>이 단계에서 Claude Code는 <strong style={{ color: M.or }}>MCP 웹 검색 서버</strong>를 통해 주제에 맞는 최신 데이터를 자동으로 수집합니다. 여러분은 <strong>주제만 입력</strong>하면 됩니다.</p>

    <h3 style={S.h3}>MCP(Model Context Protocol)란?</h3>
    <p style={S.p}>MCP는 Claude Code에 <strong style={{ color: M.or }}>외부 도구를 연결하는 표준 프로토콜</strong>입니다. USB 포트처럼, 규격만 맞으면 어떤 외부 서비스든 연결할 수 있습니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 13, marginBottom: 8 }}>MCP 없이</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          Claude Code = 똑똑한 AI<br/>
          하지만 <strong style={{ color: "#fca5a5" }}>인터넷 검색 불가</strong><br/>
          학습 데이터에 있는 정보만 사용<br/>
          → 최신 데이터 부정확
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.or}44` }}>
        <div style={{ fontWeight: 700, color: "#86efac", fontSize: 13, marginBottom: 8 }}>MCP 연결 후</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          Claude Code + <strong style={{ color: "#86efac" }}>웹 검색 MCP</strong><br/>
          실시간 인터넷 검색 가능<br/>
          금감원, 보험연구원 최신 데이터 수집<br/>
          → <strong style={{ color: "#86efac" }}>정확한 최신 보고서</strong>
        </div>
      </div>
    </div>
    <Tip type="key">
      MCP는 Claude Code의 "확장 팩"이라고 생각하세요. <strong>web-search</strong> MCP를 연결하면 웹 검색 능력이 추가되고, <strong>slack</strong> MCP를 연결하면 Slack 메시지 전송 능력이 추가됩니다.
    </Tip>

    <h3 style={S.h3}>MCP 설치 & 확인 (실습)</h3>
    <Cmd cmd="claude mcp list" desc="현재 연결된 MCP 서버 확인" />
    <Cmd cmd="claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" desc="web-search MCP 추가" />
    <Cmd cmd="claude mcp remove web-search" desc="MCP 서버 삭제" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>※ .mcp.json 파일에 직접 작성해도 동일한 효과 (mcp-connect 챕터에서 자세히 다룹니다)</p>

    <h3 style={S.h3}>리서치 파이프라인</h3>
    <Flow steps={[
      { icon: "💬", t: "1. 주제 입력", d: "\"2025 보험시장 동향\", \"ESG 경영 현황\" 등 자유롭게", c1: M.bl, c2: M.blM },
      { icon: "🔍", t: "2. 검색어 자동 생성", d: "Claude가 주제를 분석해 3~5개 검색 쿼리를 만듦", c1: M.or, c2: M.orL },
      { icon: "🌐", t: "3. MCP 웹 검색 실행", d: "금감원, 보험연구원, 언론사 등 신뢰 소스에서 수집", c1: M.blM, c2: M.ac },
      { icon: "📋", t: "4. 데이터 정제 & 저장", d: "핵심 수치/트렌드/출처를 정리해서 markdown으로 저장", c1: "#059669", c2: "#34d399" },
    ]} />

    <h3 style={S.h3}>웹 리서치 Skill</h3>
    <p style={S.p}>이 Skill이 Claude Code에게 "어떻게 리서치할지"를 가르칩니다.</p>
    <Code name=".claude/skills/web-researcher/SKILL.md" filePath=".claude/skills/web-researcher/SKILL.md" code={`---
description: "주제에 대해 웹 리서치할 때 사용"
---

# 웹 리서치 가이드

## 검색 전략
1. 주제에서 핵심 키워드 3-5개 추출
2. 각 키워드에 대해 검색 쿼리 조합:
   - "[키워드] 2025 2026 시장 동향"
   - "[키워드] 통계 금융감독원"
   - "[키워드] 전망 보험연구원"

## 우선 참고 소스
- 금융감독원 보도자료
- 보험연구원 리포트
- 생명보험협회 통계
- 한국신용평가/한국기업평가
- 주요 경제지 (매경, 한경, 서경)

## 수집 데이터 형식
- 핵심 수치 (시장 규모, 성장률, 점유율 등)
- 주요 트렌드 3-5개
- 리스크 요인
- 출처 (기관명 + 발행일 + URL)`} />

    <h3 style={S.h3}>실제 실행 예시: "퇴직연금 시장 현황"</h3>
    <Ref title="Claude Code에서 실행되는 과정">{`🤖 > 퇴직연금 시장 현황 리서치해줘

🔍 웹 리서치 시작...

1. 검색어 생성:
   → "퇴직연금 시장 규모 2025 2026"
   → "DC형 IRP 적립금 현황 금융감독원"
   → "퇴직연금 디폴트옵션 현황 고용노동부"

2. 수집 결과 (14개 소스):
   ✓ 금감원 "2025년 퇴직연금 적립금 현황" (2025.12)
   ✓ 고용노동부 "디폴트옵션 도입 1년 성과" (2025.09)
   ✓ 보험연구원 "퇴직연금 시장 전망" (2026.01)
   ✓ 미래에셋투자와연금센터 리포트 (2026.02)
   ... +10건

3. 핵심 데이터 정제:
   📊 퇴직연금 적립금: 382조원 (전년 대비 +12.3%)
   📊 DC형 비중: 41.2% → 45.8% (2년간)
   📊 디폴트옵션 가입률: 68.4%
   📊 TDF 편입 비율: 32.1% (전년 21.4%)

4. 저장:
   📄 research/퇴직연금_시장_현황_리서치결과.md`}</Ref>

    <Tip type="key">
      <strong>어떤 주제든 동일한 방식으로 동작합니다:</strong><br/>
      "K-ICS 도입 영향" → "MZ세대 보험 소비" → "해외 보험사 디지털 전환" → "ESG 채권 투자 현황"<br/>
      주제만 바꾸면 리서치 결과가 자동으로 달라집니다.
    </Tip>

    <h3 style={S.h3}>직접 해보기: 리서치 실습</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>1. Claude Code 시작:</p>
    <Cmd cmd="claude" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>2. 간단한 리서치 요청 (주제를 자유롭게 바꿔보세요):</p>
    <Cmd cmd="2025 생명보험 시장 동향을 리서치해줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>3. 리서치 결과 확인 후 추가 질문:</p>
    <Cmd cmd="이 중에서 미래에셋에 가장 중요한 3가지만 정리해줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>4. 원샷 모드로 리서치 (대화 없이 바로 결과):</p>
    <Cmd cmd='claude -p "K-ICS 제도 변경사항 최신 동향 리서치해줘"' />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>5. 리서치 결과를 파일로 저장:</p>
    <Cmd cmd='claude -p "2025 퇴직연금 시장 현황을 리서치해서 research.md로 저장해줘"' />
    <Tip type="try">아래 터미널에서 위 명령어를 하나씩 실행해보세요! 주제를 여러분 부서의 업무로 바꿔도 됩니다.</Tip>
  </>);

  if (id === "step3") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>Step 3: 콘텐츠 생성</h2>
    <p style={S.p}>리서치 데이터가 준비되면, Claude Code가 <strong style={{ color: M.or }}>문서 구조에 맞게 내용을 자동 작성</strong>합니다. 보고서와 PPT의 구조가 다르므로, 각각 다른 Skill이 동작합니다.</p>

    <h3 style={S.h3}>Skill(스킬)이란?</h3>
    <p style={S.p}>Skill은 Claude Code에게 <strong style={{ color: M.or }}>"이런 작업은 이렇게 해"</strong>라고 알려주는 가이드라인 파일입니다.</p>
    <div style={{ background: M.bg2, borderRadius: 12, padding: 20, margin: "16px 0", border: `1px solid ${M.bd}` }}>
      <div style={{ fontWeight: 800, color: M.or, fontSize: 15, marginBottom: 12 }}>Skill의 동작 원리</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { n: "1", t: "저장 위치", d: ".claude/skills/[이름]/SKILL.md 파일로 저장", color: M.ac },
          { n: "2", t: "자동 감지", d: "description 필드를 보고 Claude가 관련 작업인지 판단", color: M.or },
          { n: "3", t: "제안 방식", d: "\"이 Skill을 참고하겠습니다\"라고 알린 후 가이드라인 적용", color: "#059669" },
          { n: "4", t: "강제 아님", d: "Hook과 달리 상황에 맞지 않으면 무시할 수 있음", color: "#fbbf24" },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
            <div><span style={{ fontWeight: 700, color: M.tx }}>{s.t}:</span> <span style={{ color: M.tx2, fontSize: 13 }}>{s.d}</span></div>
          </div>
        ))}
      </div>
    </div>
    <Ref title="SKILL.md 파일 구조 (필수 형식)">{`---
description: "이 Skill이 언제 사용되는지 설명 (Claude가 이 설명을 보고 판단)"
---

# Skill 제목

## 가이드라인 내용
- Claude가 따를 규칙들
- 문서 구조, 작성 방식, 스타일 등

## 예시
- 좋은 예시와 나쁜 예시를 포함하면 품질 향상`}</Ref>
    <Tip type="key">
      <strong>description이 가장 중요합니다!</strong> Claude는 이 설명을 보고 "지금 요청이 이 Skill과 관련있는가?"를 판단합니다. 명확하게 작성하세요.<br/>
      예: ✅ "보고서(docx) 작성 요청 시 사용" &nbsp; ❌ "문서 관련 스킬"
    </Tip>

    <h3 style={S.h3}>보고서(docx) 콘텐츠 구조</h3>
    <Code name=".claude/skills/report-writer/SKILL.md" filePath=".claude/skills/report-writer/SKILL.md" code={`---
description: "보고서(docx) 작성 요청 시 사용"
---

# 보고서 작성 가이드

## 문서 구조 (6-Section)
1. 표지
   - 제목 / 부서명 / 작성자 / 날짜
2. 요약 (Executive Summary)
   - 핵심 내용 3줄 이내
   - 주요 수치 하이라이트
3. 현황 분석
   - 시장 규모/동향 데이터
   - 표 또는 차트로 시각화
4. 심층 분석
   - 트렌드 분석 (3-5개)
   - 각 트렌드별 데이터 근거
5. 시사점 & 리스크
   - 미래에셋에 미치는 영향
   - 리스크 요인과 대응 방안
6. 제언 (Action Items)
   - 구체적 실행 과제 3-5개
   - 담당 부서 / 일정 제안

## 작성 규칙
- 모든 수치에 출처 각주 삽입
- 표는 미래에셋 스타일 (오렌지 헤더)
- 개인정보 절대 포함 금지`} />

    <h3 style={S.h3}>PPT(pptx) 콘텐츠 구조</h3>
    <Code name=".claude/skills/pptx-generator/SKILL.md" filePath=".claude/skills/pptx-generator/SKILL.md" code={`---
description: "PPT(pptx) 생성 요청 시 사용"
---

# PPT 생성 가이드

## 슬라이드 구성 (8장 기본)
1. 표지 — 제목 + 부서 + 날짜
2. 목차 — 자동 생성 (본문 제목에서 추출)
3. 시장 개요 — 핵심 수치 3개 + 한줄 요약
4. 주요 트렌드 — 트렌드 3개를 아이콘+텍스트로
5. 데이터 분석 — 차트 (막대/파이/라인)
6. 비교 분석 — 경쟁사 또는 기간 비교 테이블
7. 시사점 & Action Items — 핵심 3가지
8. Q&A / 감사 페이지

## 디자인 규칙
- 한 슬라이드에 핵심 메시지 1개만
- 텍스트 최소화, 수치와 차트 우선
- 미래에셋 색상 팔레트 사용
- 폰트: 맑은 고딕 (제목 24pt / 본문 16pt)`} />

    <h3 style={S.h3}>리서치 → 콘텐츠 매핑 과정</h3>
    <p style={S.p}>Claude Code가 리서치 결과를 문서 구조의 각 섹션에 자동으로 배치합니다:</p>
    <div style={{ background: M.bg2, borderRadius: 12, padding: 20, margin: "16px 0", border: `1px solid ${M.bd}`, fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 2 }}>
      <div style={{ color: M.or, fontWeight: 700, marginBottom: 8 }}>📋 매핑 예시: "퇴직연금 시장 현황"</div>
      <div>리서치: 적립금 382조원 → <span style={{ color: "#86efac" }}>보고서 §3 현황분석 / PPT Slide 3</span></div>
      <div>리서치: DC형 비중 증가 → <span style={{ color: "#86efac" }}>보고서 §4 트렌드 / PPT Slide 4</span></div>
      <div>리서치: 디폴트옵션 68.4% → <span style={{ color: "#86efac" }}>보고서 §4 트렌드 / PPT Slide 5 (차트)</span></div>
      <div>리서치: TDF 편입 32.1% → <span style={{ color: "#86efac" }}>보고서 §4 데이터표 / PPT Slide 5</span></div>
      <div>분석: 미래에셋 영향 → <span style={{ color: "#86efac" }}>보고서 §5 시사점 / PPT Slide 7</span></div>
      <div>도출: 실행 과제 → <span style={{ color: "#86efac" }}>보고서 §6 제언 / PPT Slide 7</span></div>
    </div>

    <h3 style={S.h3}>직접 해보기: Skill 생성 실습</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>1. 위의 "파일 생성" 버튼으로 SKILL.md 파일들을 먼저 생성하세요</p>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>2. Claude Code 시작:</p>
    <Cmd cmd="claude" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>3. Skill이 잘 동작하는지 테스트:</p>
    <Cmd cmd="2025 보험시장 동향 보고서 만들어줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "4px 0 0" }}>→ Claude가 "report-writer Skill을 참고합니다"라고 표시되면 성공!</p>
    <Ref title="Skill 유무 차이">{`Skill 없이: 구조가 일정하지 않고 매번 다른 형식
Skill 있을 때: 항상 6섹션 구조, 미래에셋 스타일 적용`}</Ref>

    <Tip type="try">위 SKILL.md 코드블록의 <strong>"파일 생성"</strong> 버튼을 클릭한 후, 터미널에서 보고서 작성을 요청해보세요!</Tip>
  </>);

  if (id === "step4") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>Step 4: 최종 파일 출력</h2>
    <p style={S.p}>콘텐츠가 준비되면, Claude Code가 <strong style={{ color: M.or }}>미래에셋 템플릿의 XML 구조에 맞게 파일을 조립</strong>해서 최종 .docx / .pptx를 생성합니다.</p>

    <h3 style={S.h3}>파일 생성 내부 과정</h3>
    <Flow steps={[
      { icon: "📂", t: "1. 템플릿 XML 로드", d: "Step 1에서 분석한 XML 구조와 스타일 정보를 불러옴", c1: M.bl, c2: M.blM },
      { icon: "✍️", t: "2. 콘텐츠 삽입", d: "Step 3에서 생성한 텍스트/표/차트를 XML 플레이스홀더에 배치", c1: M.or, c2: M.orL },
      { icon: "🎨", t: "3. 스타일 적용", d: "미래에셋 색상/폰트/레이아웃을 XML 속성으로 적용", c1: M.orD, c2: M.or },
      { icon: "📦", t: "4. ZIP 패키징", d: "XML 파일들을 ZIP으로 묶어 .docx/.pptx 확장자로 저장", c1: "#059669", c2: "#34d399" },
    ]} />

    <h3 style={S.h3}>실제 코드 (python-pptx)</h3>
    <p style={S.p}>Claude Code가 내부적으로 실행하는 코드입니다. 직접 작성할 필요 없이 Claude가 자동으로 처리합니다.</p>
    <Ref title="PPT 생성 코드 (Claude Code가 자동 실행)">{`from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor

# 1. 미래에셋 템플릿 로드
prs = Presentation('templates/미래에셋_발표자료_템플릿.pptx')

# 2. 표지 슬라이드 — 제목 삽입
slide = prs.slides[0]
title = slide.placeholders[0]
title.text = "2025 퇴직연금 시장 현황 분석"

subtitle = slide.placeholders[1]
subtitle.text = "퇴직연금팀 | 2026.03.09"

# 3. 본문 슬라이드 추가 — 레이아웃 활용
layout = prs.slide_layouts[1]  # "제목+내용" 레이아웃
slide = prs.slides.add_slide(layout)
slide.placeholders[0].text = "시장 개요"
slide.placeholders[1].text = (
    "• 퇴직연금 적립금: 382조원 (전년비 +12.3%)\\n"
    "• DC형 비중: 45.8% (2년간 +4.6%p)\\n"
    "• 디폴트옵션 가입률: 68.4%"
)

# 4. 차트 삽입
from pptx.chart.data import CategoryChartData
chart_data = CategoryChartData()
chart_data.categories = ['DB형', 'DC형', 'IRP']
chart_data.add_series('2024', (198, 142, 42))
chart_data.add_series('2025', (207, 175, 53))
# ... 차트 추가 코드

# 5. 저장
prs.save('output/2026-03-09_발표자료_퇴직연금.pptx')`}</Ref>

    <h3 style={S.h3}>보고서(docx) 생성 코드</h3>
    <Ref title="docx 생성 코드 (Claude Code가 자동 실행)">{`from docx import Document
from docx.shared import Pt, RGBColor, Inches

# 1. 미래에셋 보고서 템플릿 로드
doc = Document('templates/미래에셋_보고서_템플릿.docx')

# 2. 표지 정보 삽입
doc.paragraphs[0].text = "2025 퇴직연금 시장 현황 분석"
doc.paragraphs[0].style = doc.styles['Title']

# 3. 섹션별 내용 작성
doc.add_heading('1. 요약', level=1)
doc.add_paragraph(
    '퇴직연금 적립금이 382조원을 돌파하며 '
    '전년 대비 12.3% 성장했다. DC형 비중이 '
    '45.8%로 확대되는 추세이며...'
)

# 4. 표 삽입 (미래에셋 스타일)
table = doc.add_table(rows=4, cols=3)
table.style = 'Table Grid'
# 헤더 — 미래에셋 오렌지
for cell in table.rows[0].cells:
    cell.paragraphs[0].runs[0].font.color.rgb = \\
        RGBColor(0xFF, 0xFF, 0xFF)
    # 배경색은 XML 직접 조작으로 #F58220 적용

# 5. 저장
doc.save('output/2026-03-09_보고서_퇴직연금.docx')`}</Ref>

    <Tip type="key">
      <strong>이 코드를 직접 작성할 필요 없습니다!</strong> Claude Code에게 "보고서 만들어줘"라고 말하면, Skill을 참고해서 이 코드를 자동으로 생성하고 실행합니다. 여기서는 "내부에서 이런 일이 일어나는구나"를 이해하기 위해 보여드리는 것입니다.
    </Tip>

    <h3 style={S.h3}>파일 출력 확인 & 관리</h3>
    <Cmd cmd="ls output/" desc="output 폴더 확인" />
    <Ref title="예시 결과">{`2026-03-09_보고서_퇴직연금.docx
2026-03-09_발표자료_퇴직연금.pptx
2026-03-09_보고서_ESG경영.docx`}</Ref>
    <Cmd cmd="open output/2026-03-09_보고서_퇴직연금.docx" desc="파일 열기 (macOS)" />
    <Cmd cmd="start output/2026-03-09_보고서_퇴직연금.docx" desc="파일 열기 (Windows)" />

    <h3 style={S.h3}>직접 해보기: 파일 출력 실습</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>방법 1: 대화형으로 단계별 실행</p>
    <Cmd cmd="claude" />
    <Cmd cmd='미래에셋 PPT 템플릿으로 "AI 보험심사 도입 현황" 발표자료 만들어줘. 8장 이내, 차트 포함해줘.' desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>방법 2: 원샷으로 한 번에 실행</p>
    <Cmd cmd='claude -p "2025 ESG 경영 현황 보고서를 미래에셋 템플릿으로 만들어줘. 6섹션 구조, 출처 포함."' />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>방법 3: /report 커맨드로 실행 (커맨드 파일 생성 후)</p>
    <Cmd cmd="claude" />
    <Cmd cmd="/report 2025 퇴직연금 시장 동향" desc="대화형 입력 >" />

    <Tip type="try">
      아래 터미널에서 <strong>여러분의 주제</strong>로 파일 생성을 직접 실행해보세요!<br/>
      완성된 파일은 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>ls output/</code>으로 확인할 수 있습니다.
    </Tip>

  </>);

  if (id === "skills-hooks") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>Skill & Hook 설정</h2>
    <p style={S.p}>지금까지 배운 파이프라인이 <strong style={{ color: M.or }}>매번 일관되게, 안전하게</strong> 동작하도록 Skill(루틴)과 Hook(안전장치)을 설정합니다.</p>

    <h3 style={S.h3}>Skill vs Hook — 핵심 차이</h3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
        <div style={{ fontWeight: 800, color: M.or, fontSize: 16, marginBottom: 8 }}>Skill = 제안</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>
          Claude가 상황을 <strong style={{ color: M.tx }}>판단해서</strong> 참고할 수도, 안 할 수도 있음.<br/><br/>
          "보고서 만들어줘" → report-writer Skill 자동 로드<br/>
          "코드 수정해줘" → Skill 로드 안 함 (관련 없으므로)
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
        <div style={{ fontWeight: 800, color: "#fbbf24", fontSize: 16, marginBottom: 8 }}>Hook = 강제</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>
          설정한 이벤트 발생 시 <strong style={{ color: M.tx }}>100% 자동 실행</strong>. 예외 없음.<br/><br/>
          파일 쓰기 시도 → 개인정보 검사 Hook <strong style={{ color: "#fbbf24" }}>무조건</strong> 실행<br/>
          위반 감지 → 작업 <strong style={{ color: "#fca5a5" }}>즉시 차단</strong>
        </div>
      </div>
    </div>

    <h3 style={S.h3}>Hook 이벤트 생명주기</h3>
    <p style={S.p}>Hook은 Claude Code의 <strong style={{ color: M.or }}>특정 이벤트가 발생할 때</strong> 자동으로 실행됩니다. 두 가지 타이밍이 있습니다:</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.ac}44` }}>
        <div style={{ fontWeight: 800, color: M.ac, fontSize: 14, marginBottom: 8 }}>PreToolUse (실행 전)</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.8 }}>
          Claude가 도구를 <strong style={{ color: M.tx }}>사용하기 직전</strong>에 실행<br/>
          → 파일 쓰기 전에 내용 검사<br/>
          → 위반 시 <strong style={{ color: "#fca5a5" }}>block</strong>으로 차단 가능<br/><br/>
          <span style={{ fontSize: 11, color: M.tx3 }}>matcher: "Write" → 파일 쓰기 전에만 실행</span>
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid #05966944` }}>
        <div style={{ fontWeight: 800, color: "#059669", fontSize: 14, marginBottom: 8 }}>PostToolUse (실행 후)</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.8 }}>
          Claude가 도구를 <strong style={{ color: M.tx }}>사용한 직후</strong>에 실행<br/>
          → 생성된 파일 검증<br/>
          → 로그 기록, 알림 전송 등<br/><br/>
          <span style={{ fontSize: 11, color: M.tx3 }}>matcher: "Write" → 파일 쓰기 후에 실행</span>
        </div>
      </div>
    </div>
    <Tip type="key">
      <strong>Hook 응답 형식:</strong><br/>
      <code style={{ background: M.bg3, color: "#fca5a5", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{"{"}"block": true, "message": "..."{"}"}</code> → 작업 차단<br/>
      <code style={{ background: M.bg3, color: "#fbbf24", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{"{"}"feedback": "..."{"}"}</code> → 경고만 (차단하지 않음)<br/>
      <code style={{ background: M.bg3, color: "#86efac", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{"{"}"continue": true{"}"}</code> → 정상 통과
    </Tip>

    <h3 style={S.h3}>Hook 설정 파일: settings.json</h3>
    <p style={S.p}>Hook을 등록하려면 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>.claude/settings.json</code> 파일에 설정해야 합니다.</p>
    <Code name=".claude/settings.json" filePath=".claude/settings.json" code={`{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "command": "bash .claude/hooks/check-pii.sh",
        "description": "파일 쓰기 전 개인정보 유출 검사"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "command": "echo '파일 생성 완료' >> .claude/hooks/activity.log",
        "description": "파일 생성 로그 기록"
      }
    ]
  }
}`} />

    <h3 style={S.h3}>필수 Hook: 개인정보 유출 방지</h3>
    <p style={S.p}>금융회사에서 가장 중요한 안전장치입니다. 문서에 고객 개인정보가 포함되면 <strong style={{ color: "#fca5a5" }}>파일 생성을 차단</strong>합니다.</p>
    <Code name=".claude/hooks/check-pii.sh" filePath=".claude/hooks/check-pii.sh" code={`#!/bin/bash
# 개인정보 포함 여부 검사 Hook
# PreToolUse 이벤트에서 Write matcher와 함께 동작

# 주민등록번호 패턴 (6자리-7자리)
if echo "$TOOL_INPUT" | grep -qE '[0-9]{6}-[0-9]{7}'; then
  echo '{"block": true, "message": "❌ 주민등록번호가 감지되었습니다! 마스킹 처리 후 다시 시도하세요."}'
  exit 0
fi

# 전화번호 패턴 (010-XXXX-XXXX)
if echo "$TOOL_INPUT" | grep -qE '010-[0-9]{4}-[0-9]{4}'; then
  echo '{"block": true, "message": "❌ 전화번호가 감지되었습니다! 마스킹(010-****-1234) 처리 후 다시 시도하세요."}'
  exit 0
fi

# 이메일 패턴
if echo "$TOOL_INPUT" | grep -qE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'; then
  echo '{"feedback": "⚠️ 이메일 주소가 감지되었습니다. 마스킹 여부를 확인하세요."}'
fi

echo '{"continue": true}'`} />

    <h3 style={S.h3}>슬래시 커맨드: 원클릭 실행</h3>
    <p style={S.p}>자주 쓰는 워크플로우를 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>/report</code> 같은 단축 명령으로 만들 수 있습니다.</p>
    <Code name=".claude/commands/report.md" filePath=".claude/commands/report.md" code={`---
description: "주제를 입력하면 리서치 → 보고서+PPT 자동 생성"
allowed-tools: Read, Write, Bash, WebFetch, mcp__web-search
---

다음 과정을 순서대로 진행하세요:

1. templates/ 폴더에서 docx, pptx 템플릿을 분석하세요
2. "$ARGUMENTS" 주제에 대해 웹 리서치를 수행하세요
   - 금감원, 보험연구원, 생명보험협회 등 공신력 있는 소스 우선
   - 최신 데이터 (최근 6개월 이내) 우선 수집
3. 리서치 결과를 바탕으로 보고서(docx) 콘텐츠를 작성하세요
4. 동일 내용으로 PPT(pptx)도 작성하세요
5. 미래에셋 템플릿을 적용하여 최종 파일을 output/에 저장하세요
6. 생성된 파일 목록과 요약을 출력하세요`} />

    <Tip type="key">
      이 커맨드를 만들어두면 Claude Code에서 이렇게 한 줄로 실행할 수 있습니다:<br/>
      <code style={{ background: M.bl, color: M.or, padding: "4px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 14 }}>/report 2025 퇴직연금 시장 동향</code><br/><br/>
      → 리서치 → 보고서 → PPT까지 자동 완성!
    </Tip>

    <h3 style={S.h3}>직접 해보기: Hook & Skill 실습</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>1. 먼저 위의 "파일 생성" 버튼으로 settings.json, check-pii.sh 파일을 생성하세요</p>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>2. check-pii.sh에 실행 권한 부여:</p>
    <Cmd cmd="chmod +x .claude/hooks/check-pii.sh" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>3. Claude Code 시작:</p>
    <Cmd cmd="claude" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>4. Hook 테스트 — 개인정보를 포함한 요청:</p>
    <Cmd cmd="홍길동(010-1234-5678)에 대한 보고서를 작성해줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 11, margin: "4px 0" }}>→ Hook이 감지하고 차단: "전화번호가 감지되었습니다!"</p>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>5. 정상 요청 테스트:</p>
    <Cmd cmd="2025 보험시장 동향 보고서를 작성해줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 11, margin: "4px 0" }}>→ 정상 작성 (개인정보 없음)</p>

    <Tip type="try">위 순서대로 실행해서 Hook이 개인정보를 차단하는지 직접 확인하세요!</Tip>

  </>);

  if (id === "mcp-connect") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>MCP 외부 연결</h2>
    <p style={S.p}>MCP(Model Context Protocol)는 Claude Code에 <strong style={{ color: M.or }}>외부 서비스를 연결하는 어댑터</strong>입니다. 리서치에는 웹 검색이, 업무 연동에는 Slack/Jira 등이 사용됩니다.</p>

    <h3 style={S.h3}>MCP 프로토콜 구조</h3>
    <p style={S.p}>MCP는 <strong style={{ color: M.or }}>클라이언트-서버 구조</strong>로 동작합니다. Claude Code가 클라이언트, 외부 도구가 서버입니다.</p>
    <div style={{ background: M.bg2, borderRadius: 12, padding: 20, margin: "16px 0", border: `1px solid ${M.bd}`, fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 2 }}>
      <div style={{ color: M.or, fontWeight: 700, marginBottom: 8 }}>MCP 통신 흐름</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: M.bl, padding: "8px 14px", borderRadius: 8, color: M.tx, fontSize: 13, fontWeight: 700 }}>Claude Code</div>
        <span style={{ color: M.or }}>→ 요청 →</span>
        <div style={{ background: M.bl, padding: "8px 14px", borderRadius: 8, color: M.tx, fontSize: 13, fontWeight: 700 }}>MCP 서버</div>
        <span style={{ color: M.or }}>→ 호출 →</span>
        <div style={{ background: M.bl, padding: "8px 14px", borderRadius: 8, color: M.tx, fontSize: 13, fontWeight: 700 }}>외부 API</div>
      </div>
      <div style={{ marginTop: 12, color: M.tx3, fontSize: 11 }}>
        Claude: "web-search 검색해줘" → MCP 서버가 Brave API 호출 → 결과 반환 → Claude가 정리
      </div>
    </div>

    <h3 style={S.h3}>MCP 설정 범위: 프로젝트 vs 글로벌</h3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.or}44` }}>
        <div style={{ fontWeight: 700, color: M.or, fontSize: 13, marginBottom: 8 }}>프로젝트 단위 (권장)</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          파일: <strong style={{ color: M.tx }}>.mcp.json</strong><br/>
          위치: 프로젝트 루트<br/>
          범위: 이 폴더에서만 사용<br/>
          장점: 팀원과 설정 공유 가능
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 700, color: M.tx2, fontSize: 13, marginBottom: 8 }}>글로벌 (전체)</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.tx2, lineHeight: 1.8 }}>
          파일: <strong style={{ color: M.tx }}>~/.claude.json</strong><br/>
          위치: 사용자 홈 디렉토리<br/>
          범위: 모든 프로젝트에서 사용<br/>
          장점: 한 번 설정으로 어디서든 사용
        </div>
      </div>
    </div>

    <h3 style={S.h3}>문서 자동화에 유용한 MCP 서버</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, margin: "16px 0" }}>
      {[
        { icon: "🔍", name: "web-search", desc: "웹 리서치 — Step 2의 핵심", use: "주제별 최신 데이터 수집", essential: true },
        { icon: "💬", name: "slack", desc: "Slack 알림 전송", use: "문서 생성 완료 시 팀 알림", essential: false },
        { icon: "🎫", name: "jira", desc: "Jira 티켓 연동", use: "업무 요청 → 문서 생성 자동화", essential: false },
        { icon: "🗄️", name: "postgresql", desc: "DB 직접 조회", use: "내부 데이터로 보고서 작성", essential: false },
      ].map(m => (
        <div key={m.name} style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${m.essential ? M.or + "66" : M.bd}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{m.icon}</span>
            {m.essential && <span style={{ background: M.or + "33", color: M.or, fontSize: 9, padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>필수</span>}
          </div>
          <div style={{ fontWeight: 700, color: M.tx, fontSize: 14, fontFamily: "monospace" }}>{m.name}</div>
          <div style={{ color: M.or, fontSize: 12, marginTop: 4 }}>{m.desc}</div>
          <div style={{ color: M.tx3, fontSize: 11, marginTop: 4 }}>{m.use}</div>
        </div>
      ))}
    </div>

    <h3 style={S.h3}>MCP 설정 파일</h3>
    <Code name=".mcp.json (프로젝트 루트에 저장 → 팀 공유)" filePath=".mcp.json" code={`{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-web-search"],
      "env": {
        "BRAVE_API_KEY": "BSA_xxxxxxxxxx"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-xxxxxxxxxx",
        "SLACK_CHANNEL": "#doc-automation"
      }
    }
  }
}`} />

    <Tip type="warn">MCP 서버를 너무 많이 연결하면 Claude의 컨텍스트 윈도우(기억 공간)를 많이 차지합니다. <strong>3~5개</strong>가 적당하고, <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>claude mcp list</code>로 현재 상태를 확인하세요.</Tip>

    <h3 style={S.h3}>MCP 구성 방법 3가지</h3>
    <p style={S.p}>MCP 서버를 추가하는 방법은 3가지가 있습니다. 상황에 따라 편한 방법을 선택하세요.</p>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.or}44`, borderLeft: `3px solid ${M.or}` }}>
        <div style={{ fontWeight: 800, color: M.or, fontSize: 14, marginBottom: 6 }}>방법 1: CLI 명령어 (가장 간편)</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>터미널에서 한 줄로 추가. 설정 파일이 자동 생성됩니다.</div>
        <Cmd cmd="claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" desc="프로젝트 단위 추가" />
        <Cmd cmd="claude mcp add --scope user web-search -- npx @anthropic-ai/mcp-web-search" desc="글로벌 추가" />
        <Cmd cmd="claude mcp add web-search -e BRAVE_API_KEY=BSA_xxx -- npx @anthropic-ai/mcp-web-search" desc="환경변수 포함" />
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.ac}44`, borderLeft: `3px solid ${M.ac}` }}>
        <div style={{ fontWeight: 800, color: M.ac, fontSize: 14, marginBottom: 6 }}>방법 2: .mcp.json 파일 직접 작성</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>프로젝트 루트에 파일을 만들면 팀원과 설정을 공유할 수 있습니다. (위의 설정 파일 참고)</div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 16, border: `1px solid ${M.blL}44`, borderLeft: `3px solid ${M.blL}` }}>
        <div style={{ fontWeight: 800, color: M.blL, fontSize: 14, marginBottom: 6 }}>방법 3: Claude Code 설정 UI</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>Claude Code 실행 중 <code style={{ background: M.bg3, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>/mcp</code> 입력하면 대화형으로 MCP를 관리할 수 있습니다.</div>
      </div>
    </div>

    <h3 style={S.h3}>MCP 마켓플레이스</h3>
    <p style={S.p}>수백 개의 MCP 서버가 이미 만들어져 있습니다. <strong style={{ color: M.or }}>마켓플레이스</strong>에서 필요한 도구를 검색하고 바로 설치할 수 있습니다.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.or}44` }}>
        <div style={{ fontWeight: 800, color: M.or, fontSize: 15, marginBottom: 8 }}>Anthropic 공식 마켓플레이스</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.ac, marginBottom: 10, wordBreak: "break-all" }}>marketplace.anthropic.com</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>
          Anthropic이 운영하는 공식 MCP 서버 목록.<br/>
          검증된 서버들이 등록되어 있어 안전합니다.<br/>
          검색 → 설치 명령어 복사 → 터미널에 붙여넣기
        </div>
      </div>
      <div style={{ background: M.bg2, borderRadius: 12, padding: 20, border: `1px solid ${M.bd}` }}>
        <div style={{ fontWeight: 800, color: M.blL, fontSize: 15, marginBottom: 8 }}>GitHub MCP Servers</div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: M.ac, marginBottom: 10, wordBreak: "break-all" }}>github.com/anthropics/model-context-protocol/servers</div>
        <div style={{ color: M.tx2, fontSize: 13, lineHeight: 1.7 }}>
          오픈소스 MCP 서버 저장소.<br/>
          커뮤니티가 만든 다양한 서버 포함.<br/>
          소스 코드를 직접 확인할 수 있음
        </div>
      </div>
    </div>

    <h3 style={S.h3}>마켓플레이스에서 설치하기</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>1. marketplace.anthropic.com 접속 → 원하는 MCP 서버 검색 → 설치 명령어 복사</p>
    <Cmd cmd="claude mcp add filesystem -- npx @anthropic-ai/mcp-filesystem" desc="파일시스템 MCP" />
    <Cmd cmd="claude mcp add github -- npx @anthropic-ai/mcp-github" desc="GitHub MCP" />
    <Cmd cmd="claude mcp add gdrive -- npx @anthropic-ai/mcp-gdrive" desc="Google Drive MCP" />
    <Cmd cmd="claude mcp add memory -- npx @anthropic-ai/mcp-memory" desc="메모리 MCP" />
    <Cmd cmd="claude mcp list" desc="설치 후 확인" />

    <Tip type="tip">
      마켓플레이스에서 <strong>"web-search"</strong>를 검색하면 Brave Search 기반 MCP 서버의 설치 명령어와 설정 방법을 바로 확인할 수 있습니다. 대부분의 MCP 서버는 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>npx</code> 한 줄로 설치 가능합니다.
    </Tip>

    <h3 style={S.h3}>직접 해보기: MCP 설정 실습</h3>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>1. 현재 MCP 상태 확인:</p>
    <Cmd cmd="claude mcp list" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>2. CLI로 web-search MCP 추가 (또는 위의 ".mcp.json" 파일 생성 버튼 클릭):</p>
    <Cmd cmd="claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" />
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>3. MCP 연결 테스트:</p>
    <Cmd cmd="claude" />
    <Cmd cmd="2025 보험 시장 규모 검색해줘" desc="대화형 입력 >" />
    <p style={{ color: M.tx3, fontSize: 11, margin: "4px 0" }}>→ "web-search 도구를 사용합니다"가 표시되면 성공!</p>
    <p style={{ color: M.tx3, fontSize: 12, margin: "8px 0" }}>4. MCP 서버 삭제/확인 (필요 시):</p>
    <Cmd cmd="claude mcp remove web-search" desc="MCP 삭제" />
    <Cmd cmd="claude mcp get web-search" desc="MCP 상세 정보" />

    <Tip type="tip">
      <strong>Brave Search API 키가 필요합니다:</strong> <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>brave.com/search/api</code>에서 무료 키를 발급받으세요 (월 2,000건 무료). 키를 <code style={{ background: M.bl, color: M.or, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>BRAVE_API_KEY</code> 환경변수에 설정하면 됩니다.
    </Tip>

  </>);

  if (id === "practice") return (<>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: M.tx }}>실전 실습: 처음부터 끝까지</h2>
    <p style={S.p}>지금까지 배운 모든 것을 합쳐서, <strong style={{ color: M.or }}>여러분의 주제</strong>로 보고서와 PPT를 한 세트 완성해봅시다!</p>

    <h3 style={S.h3}>실습 미션</h3>
    <div style={{ background: M.or + "11", borderRadius: 14, padding: 24, margin: "20px 0", border: `2px solid ${M.or}44` }}>
      <div style={{ fontWeight: 800, color: M.or, fontSize: 18, marginBottom: 16 }}>🎯 최종 미션: 나만의 보고서 + PPT 자동 생성</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { n: "1", t: "주제 정하기", d: "여러분의 부서 업무와 관련된 주제를 하나 정하세요" },
          { n: "2", t: "Claude Code 시작", d: "터미널에서 claude 입력" },
          { n: "3", t: "템플릿 분석", d: "\"pptx 템플릿 분석해줘\" 또는 \"docx 템플릿 분석해줘\"" },
          { n: "4", t: "리서치 실행", d: "\"[나의 주제] 리서치해줘\"" },
          { n: "5", t: "보고서 생성", d: "\"보고서 만들어줘\"" },
          { n: "6", t: "PPT 생성", d: "\"PPT 만들어줘\"" },
          { n: "7", t: "결과 확인", d: "\"ls output/\" 으로 생성된 파일 확인" },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: M.or, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
            <div>
              <div style={{ fontWeight: 700, color: M.tx, fontSize: 14 }}>{s.t}</div>
              <div style={{ color: M.tx2, fontSize: 13 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <h3 style={S.h3}>주제 예시 (부서별)</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, margin: "16px 0" }}>
      {[
        { dept: "경영기획", topics: ["2025 3분기 경영 실적 분석", "2026 사업 계획 요약", "보험업 M&A 동향"] },
        { dept: "보험심사", topics: ["언더라이팅 자동화 트렌드", "유병자 보험 시장 현황", "해외 심사 AI 도입 사례"] },
        { dept: "마케팅", topics: ["MZ세대 보험 소비 트렌드", "디지털 채널 전환율 분석", "보험업 SNS 마케팅 현황"] },
        { dept: "리스크관리", topics: ["K-ICS 도입 영향 분석", "금리 리스크 시나리오", "사이버 리스크 대응 현황"] },
        { dept: "퇴직연금", topics: ["DC형 연금 시장 동향", "디폴트옵션 성과 분석", "TDF 시장 경쟁 현황"] },
        { dept: "IT/디지털", topics: ["보험업 AI 활용 사례", "클라우드 마이그레이션 현황", "인슈어테크 투자 동향"] },
      ].map(d => (
        <div key={d.dept} style={{ background: M.bg2, borderRadius: 12, padding: 14, border: `1px solid ${M.bd}` }}>
          <div style={{ fontWeight: 700, color: M.or, fontSize: 13, marginBottom: 8 }}>{d.dept}</div>
          {d.topics.map(t => (
            <div key={t} style={{ color: M.tx2, fontSize: 12, padding: "3px 0", cursor: "default" }}>• {t}</div>
          ))}
        </div>
      ))}
    </div>

    <h3 style={S.h3}>실습 체크리스트</h3>
    <div style={{ background: M.bg2, borderRadius: 12, padding: 20, margin: "16px 0", border: `1px solid ${M.bd}` }}>
      <div style={{ fontWeight: 700, color: M.or, fontSize: 15, marginBottom: 16 }}>완료 확인표</div>
      {[
        { t: "CLAUDE.md 파일 생성", d: "프로젝트 규칙서가 프로젝트 폴더에 존재" },
        { t: "SKILL.md 3종 생성", d: "report-writer, pptx-generator, web-researcher" },
        { t: "Hook 설정 완료", d: "settings.json + check-pii.sh 생성 & 권한 설정" },
        { t: "MCP 연결 확인", d: "claude mcp list로 web-search 확인" },
        { t: "리서치 실행", d: "주제에 대한 웹 리서치 수행" },
        { t: "보고서 생성", d: ".docx 파일이 output/ 에 생성됨" },
        { t: "PPT 생성", d: ".pptx 파일이 output/ 에 생성됨" },
        { t: "개인정보 Hook 테스트", d: "주민번호/전화번호 입력 시 차단 확인" },
      ].map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < 7 ? `1px solid ${M.bd}` : "none" }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, border: `2px solid ${M.bd2}`, flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 600, color: M.tx, fontSize: 13 }}>{c.t}</span>
            <span style={{ color: M.tx3, fontSize: 12, marginLeft: 8 }}>— {c.d}</span>
          </div>
        </div>
      ))}
    </div>

    <h3 style={S.h3}>트러블슈팅</h3>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
      {[
        { q: "\"claude: command not found\"", a: "Claude Code 미설치. npm install -g @anthropic-ai/claude-code 실행" },
        { q: "\"MCP 서버 연결 실패\"", a: "Node.js 18+ 필요. node --version으로 확인" },
        { q: "\"템플릿 파일을 찾을 수 없습니다\"", a: "templates/ 폴더에 .docx/.pptx 파일을 넣었는지 확인" },
        { q: "보고서에 미래에셋 스타일이 안 나와요", a: "templates/ 폴더에 실제 미래에셋 템플릿 파일이 있어야 합니다" },
        { q: "웹 검색이 안 돼요", a: "claude mcp list로 web-search 연결 확인 + BRAVE_API_KEY 설정 확인" },
      ].map((f, i) => (
        <div key={i} style={{ background: M.bg2, borderRadius: 10, padding: "12px 16px", border: `1px solid ${M.bd}` }}>
          <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 13, fontFamily: "monospace" }}>{f.q}</div>
          <div style={{ color: M.tx2, fontSize: 13, marginTop: 4 }}>→ {f.a}</div>
        </div>
      ))}
    </div>

    <Tip type="try">
      위 주제 중 하나를 골라 아래 터미널에서 <strong>전체 파이프라인</strong>을 실행해보세요!<br/>
      또는 여러분만의 주제를 자유롭게 입력해도 됩니다.<br/><br/>
      <strong>추천 순서:</strong> 파일 생성 버튼으로 설정 파일 생성 → claude 시작 → 리서치 → 보고서/PPT 생성
    </Tip>

  </>);

  return null;
}


// ═══ MAIN APP ═══
export default function App() {
  const [cur, setCur] = useState(0);
  const [side, setSide] = useState(false);
  const [termOpen, setTermOpen] = useState(true);
  const [termH, setTermH] = useState(280);
  const ref = useRef(null);
  const dragging = useRef(false);
  useEffect(() => { if (ref.current) ref.current.scrollTo(0, 0); }, [cur]);
  const ch = CHS[cur];

  // 드래그로 터미널 높이 조절
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const newH = window.innerHeight - e.clientY;
      setTermH(Math.max(120, Math.min(newH, window.innerHeight - 200)));
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: M.bg, color: M.tx, fontFamily: "'Noto Sans KR',-apple-system,sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${M.bd};border-radius:3px}
      `}</style>

      {side && <div onClick={() => setSide(false)} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 40 }} />}

      <nav style={{ width: 280, minWidth: 280, background: M.bg3, borderRight: `1px solid ${M.bd}`, display: "flex", flexDirection: "column", padding: "20px 0", ...(side ? { position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50 } : {}) }}>
        <div style={{ padding: "0 20px", marginBottom: 20 }}><Logo /></div>
        <div style={{ padding: "0 20px 14px", borderBottom: `1px solid ${M.bd}`, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: M.tx3, fontWeight: 600, marginBottom: 6 }}>바이브 코딩 워크북</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: M.bd, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: ((cur + 1) / CHS.length * 100) + "%", height: "100%", background: `linear-gradient(90deg,${M.or},${M.orL})`, borderRadius: 4, transition: "width .5s" }} />
            </div>
            <span style={{ color: M.tx3, fontSize: 11, fontFamily: "monospace" }}>{cur + 1}/{CHS.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {CHS.map((c, i) => (
            <button key={c.id} onClick={() => { setCur(i); setSide(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 8, border: "none", background: i === cur ? M.or + "18" : "transparent", borderLeft: i === cur ? `3px solid ${M.or}` : "3px solid transparent", cursor: "pointer", marginBottom: 1 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{c.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: i === cur ? 700 : 500, fontSize: 12, color: i === cur ? M.tx : M.tx2 }}>{c.t}</div>
                <div style={{ fontSize: 10, color: M.tx3 }}>{c.s}</div>
              </div>
              {i < cur && <span style={{ marginLeft: "auto", color: "#059669", fontSize: 13 }}>✓</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${M.bd}`, fontSize: 9, color: M.tx3, textAlign: "center" }}>
          © 미래에셋생명 · 바이브 코딩 워크북
        </div>
      </nav>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "10px 20px", borderBottom: `1px solid ${M.bd}`, display: "flex", alignItems: "center", gap: 10, background: M.bg3 }}>
          <button onClick={() => setSide(!side)} style={{ background: "none", border: "none", color: M.tx2, fontSize: 20, cursor: "pointer" }}>☰</button>
          <span style={{ fontSize: 20 }}>{ch.icon}</span>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>{ch.t}</div><div style={{ fontSize: 11, color: M.tx3 }}>{ch.s}</div></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => setTermOpen(!termOpen)}
              style={{ background: termOpen ? "#05966622" : M.bg2, color: termOpen ? "#86efac" : M.tx3, border: `1px solid ${termOpen ? "#059669" : M.bd}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "monospace", transition: "all .2s" }}>
              {termOpen ? ">" : ">"}_  terminal
            </button>
            <button onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0} style={{ background: M.bg2, color: cur === 0 ? M.tx3 : M.tx, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "7px 14px", cursor: cur === 0 ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}>←</button>
            <button onClick={() => setCur(Math.min(CHS.length - 1, cur + 1))} disabled={cur === CHS.length - 1} style={{ background: cur === CHS.length - 1 ? M.bg2 : M.or, color: cur === CHS.length - 1 ? M.tx3 : "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: cur === CHS.length - 1 ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}>→</button>
          </div>
        </header>

        {/* 콘텐츠 영역 */}
        <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "28px 36px 60px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <Ch id={ch.id} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 20, borderTop: `1px solid ${M.bd}` }}>
              {cur > 0 ? <button onClick={() => setCur(cur - 1)} style={{ background: M.bg2, color: M.tx, border: `1px solid ${M.bd}`, borderRadius: 10, padding: "12px 20px", cursor: "pointer", textAlign: "left" }}><div style={{ fontSize: 10, color: M.tx3 }}>← 이전</div><div style={{ fontWeight: 600, fontSize: 13 }}>{CHS[cur - 1].icon} {CHS[cur - 1].t}</div></button> : <div />}
              {cur < CHS.length - 1 ? <button onClick={() => setCur(cur + 1)} style={{ background: M.or + "18", color: M.tx, border: `1px solid ${M.or}44`, borderRadius: 10, padding: "12px 20px", cursor: "pointer", textAlign: "right" }}><div style={{ fontSize: 10, color: M.or }}>다음 →</div><div style={{ fontWeight: 600, fontSize: 13 }}>{CHS[cur + 1].icon} {CHS[cur + 1].t}</div></button> : <div />}
            </div>
          </div>
        </div>

        {/* 하단 고정 터미널 */}
        {termOpen && (
          <>
            {/* 드래그 핸들 */}
            <div
              onMouseDown={() => { dragging.current = true; document.body.style.cursor = "row-resize"; document.body.style.userSelect = "none"; }}
              style={{ height: 6, background: M.bg3, borderTop: `1px solid ${M.bd}`, cursor: "row-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: M.bd2 }} />
            </div>
            <div style={{ height: termH, minHeight: 120, flexShrink: 0 }}>
              <Suspense fallback={<div style={{ color: M.tx2, padding: 20, fontFamily: "monospace", background: M.bg3, height: "100%" }}>터미널 로딩 중...</div>}>
                <NativeTerminal style={{ height: "100%", borderRadius: 0, border: "none" }} />
              </Suspense>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
