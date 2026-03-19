import { useState, useEffect, useRef, lazy, Suspense, Fragment } from "react";

const NativeTerminal = lazy(() => import("./NativeTerminal.jsx"));

// ═══ MIRAE ASSET BRAND ═══
const DARK = {
  or: "#F58220", orL: "#F0B26B", orD: "#CB6015",
  bl: "#043B72", blL: "#7E9FC3", blM: "#0086B8", ac: "#00A9CE",
  bg: "#041828", bg2: "#061E30", bg3: "#021018",
  bd: "#0A3050", bd2: "#0E4060",
  tx: "#E5E8EC", tx2: "#8DA0B8", tx3: "#5A7A98",
};
const LIGHT = {
  or: "#E06A00", orL: "#F0A050", orD: "#CB6015",
  bl: "#043B72", blL: "#5A7A98", blM: "#0076A8", ac: "#0090B0",
  bg: "#F5F5F5", bg2: "#FFFFFF", bg3: "#EAEEF2",
  bd: "#D0D8E0", bd2: "#C0C8D0",
  tx: "#1A1A2E", tx2: "#4A5568", tx3: "#8896A6",
};
let M = DARK;

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
        <div style={{ fontSize: 15, color: M.blL, letterSpacing: .5, fontWeight: 500 }}>AI WORKBOOK</div>
      </div>
    </div>
  );
}

// ═══ SLIDES (슬라이드 기반 프레젠테이션) ═══
// 각 슬라이드: { section, title, render }
// render()는 JSX를 반환하는 함수

const card = (children, extra = {}) => ({
  background: M.bg2, borderRadius: 16, padding: "24px 28px",
  border: `1px solid ${M.bd}`, ...extra,
});
const bigNum = (num, label, color = M.or) => (
  <div style={{ textAlign: "center", padding: "16px 0" }}>
    <div style={{ fontSize: 64, fontWeight: 900, color, lineHeight: 1 }}>{num}</div>
    <div style={{ fontSize: 18, color: M.tx2, marginTop: 8 }}>{label}</div>
  </div>
);
const vsBox = (leftTitle, leftItems, rightTitle, rightItems) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
    <div style={{ ...card(), borderLeft: `4px solid ${M.tx3}` }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: M.tx2, marginBottom: 12 }}>{leftTitle}</div>
      {leftItems.map((t, i) => <div key={i} style={{ color: M.tx2, fontSize: 16, lineHeight: 2 }}>{t}</div>)}
    </div>
    <div style={{ fontSize: 32, fontWeight: 900, color: M.or, textAlign: "center" }}>VS</div>
    <div style={{ ...card(), borderLeft: `4px solid ${M.or}` }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: M.or, marginBottom: 12 }}>{rightTitle}</div>
      {rightItems.map((t, i) => <div key={i} style={{ color: M.tx, fontSize: 16, lineHeight: 2 }}>{t}</div>)}
    </div>
  </div>
);
const conceptCard = (icon, title, desc, color) => (
  <div style={{ ...card(), borderLeft: `4px solid ${color}`, display: "flex", gap: 20, alignItems: "flex-start" }}>
    <div style={{ fontSize: 36, lineHeight: 1 }}>{icon}</div>
    <div>
      <div style={{ fontWeight: 800, fontSize: 20, color, marginBottom: 6 }}>{title}</div>
      <div style={{ color: M.tx2, fontSize: 17, lineHeight: 1.7 }}>{desc}</div>
    </div>
  </div>
);
const sectionTitle = (tag, title, sub) => () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 20 }}>
    <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 8, padding: "6px 20px", fontSize: 14, fontWeight: 700, color: M.or, letterSpacing: 2 }}>{tag}</div>
    <div style={{ fontSize: 40, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>{title}</div>
    {sub && <div style={{ fontSize: 20, color: M.tx2, maxWidth: 500 }}>{sub}</div>}
  </div>
);

const SLIDES = [
  // ─── 도입: AI 코딩 도구 개요 (0-14) ───
  {
    section: "도입",
    title: "AI 코딩 어시스턴트로 업무 자동화하기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 24 }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>
          AI 코딩 어시스턴트로<br/><span style={{ color: M.or }}>업무 자동화하기</span>
        </div>
        <div style={{ fontSize: 22, color: M.tx2, maxWidth: 600, lineHeight: 1.7 }}>
          프로그래밍 경험 없이도<br/>한글로 지시하면 AI가 파일을 만들어줍니다
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          {["비개발자도 OK", "한글로 지시", "파일 자동 생성"].map(t => (
            <div key={t} style={{ background: M.or + "18", border: `1px solid ${M.or}44`, borderRadius: 10, padding: "10px 22px", color: M.or, fontWeight: 700, fontSize: 16 }}>{t}</div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: M.tx3 }}>미래에셋생명 · 6시간 과정 · 72 슬라이드</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "AI가 발전했습니다",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>AI가 <span style={{ color: M.or }}>발전</span>했습니다</div>
        {vsBox(
          "예전 AI",
          ["질문하면 → 텍스트 답변만", "내가 복사해서 Word에 붙여넣기", "서식, 표, 디자인은 내가 직접"],
          "지금 AI (Claude Code)",
          ["질문하면 → 파일을 직접 만들어줌", "Word, PPT 파일이 자동 생성", "인터넷 검색도 스스로 함"]
        )}
        <div style={{ textAlign: "center", fontSize: 18, color: M.tx2 }}>이제 AI는 "말"만 하는 게 아니라 "행동"합니다</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "기존 AI vs Claude Code",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>무엇이 다른가요?</div>
        {vsBox(
          "ChatGPT / Claude.ai",
          ["\"보고서 써줘\"", "→ 텍스트로 답변", "→ 내가 복사·붙여넣기", "→ 서식 내가 작업"],
          "Claude Code",
          ["\"보고서 써줘\"", "→ 인터넷 검색", "→ 코드 작성 + 실행", "→ .docx 파일 완성!"]
        )}
        <div style={{ ...card(), textAlign: "center" }}>
          <span style={{ fontSize: 18, color: M.tx2 }}>핵심: Claude Code는 <strong style={{ color: M.or }}>비서</strong>처럼 일을 처음부터 끝까지 해결합니다</span>
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "실제 사례: 보고서 작업",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx }}>실제 사례: <span style={{ color: M.or }}>보고서 작업</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, width: "100%", alignItems: "center" }}>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>기존 방식</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#fca5a5" }}>4시간</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>검색 → 정리 → Word → 서식</div>
          </div>
          <div style={{ fontSize: 40, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>Claude Code</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#86efac" }}>10분</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>한 줄 입력 → 완성!</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: M.tx2 }}>상황: 내일 전략회의를 위한 퇴직연금 시장 자료가 필요</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "실제 사례: PPT 작업",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx }}>실제 사례: <span style={{ color: M.or }}>PPT 작업</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, width: "100%", alignItems: "center" }}>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>기존 방식</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#fca5a5" }}>2일</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>슬라이드 하나씩 → 디자인 → 수치 검증</div>
          </div>
          <div style={{ fontSize: 40, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>Claude Code</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#86efac" }}>20분</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>\"경영 실적 PPT 8장\" → 자동 생성</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: M.tx2 }}>상황: 의사결정을 위한 분기 실적 현황 파악</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "실제 사례: 시장 조사",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx }}>실제 사례: <span style={{ color: M.or }}>시장 조사</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, width: "100%", alignItems: "center" }}>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>기존 방식</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#fca5a5" }}>반나절</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>금감원·보험연구원 수동 검색 → 엑셀 정리</div>
          </div>
          <div style={{ fontSize: 40, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>Claude Code</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#86efac" }}>5분</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>자동 수집 + 출처 정리</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: M.tx2 }}>상황: 신상품 기획 시장 조사 자료 필요</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "터미널이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>터미널이란?</div>
        <div style={{ ...card(), textAlign: "center', padding: '32px" }}>
          <div style={{ fontSize: 48 }}>⌨️</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: M.or, marginTop: 12 }}>글자로 컴퓨터에 명령하는 창</div>
          <div style={{ fontSize: 18, color: M.tx2, marginTop: 10 }}>카카오톡으로 문자 보내듯이, 터미널로 컴퓨터에 명령을 보냅니다</div>
        </div>
        {vsBox(
          "마우스 방식 (GUI)",
          ["폴더 클릭", "아이콘 더블클릭", "메뉴에서 선택"],
          "터미널 방식 (CLI)",
          ["명령어 입력 → Enter", "결과가 텍스트로 나옴", "Claude Code가 여기서 동작"]
        )}
      </div>
    ),
  },
  {
    section: "도입",
    title: "터미널 사용법",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>터미널 사용법 — <span style={{ color: M.or }}>딱 2가지만</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          {conceptCard("1️⃣", "claude 입력 후 Enter", "Claude Code를 실행합니다. 그러면 AI가 준비 완료!", M.or)}
          {conceptCard("2️⃣", "한글로 원하는 것 입력", "\"퇴직연금 보고서 만들어줘\" 처럼 자연스럽게 입력하면 됩니다", M.ac)}
        </div>
        <div style={{ background: M.bg3, borderRadius: 12, padding: 20, fontFamily: "monospace", fontSize: 16, lineHeight: 2, width: "100%" }}>
          <span style={{ color: "#86efac" }}>$</span> <span style={{ color: M.or }}>claude</span><br/>
          <span style={{ color: M.tx3 }}>(Claude Code 실행됨)</span><br/>
          <span style={{ color: "#86efac" }}>{">"}</span> <span style={{ color: M.tx }}>퇴직연금 보고서 만들어줘</span>
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "핵심 개념 1: 프롬프트",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>핵심 개념 1</div>
        {conceptCard("💬", "프롬프트 (Prompt)", "Claude에게 하는 말. 한글로 원하는 걸 자연스럽게 입력하면 됩니다.", M.ac)}
        <div style={{ ...card(), width: "100%" }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 8 }}>예시</div>
          <div style={{ fontSize: 20, color: M.or, fontWeight: 700, lineHeight: 1.8 }}>
            "2025 퇴직연금 시장 현황 보고서를<br/>미래에셋 양식으로 만들어줘"
          </div>
        </div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>길게 설명할수록 더 좋은 결과가 나옵니다</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "핵심 개념 2: CLAUDE.md",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>핵심 개념 2</div>
        {conceptCard("📋", "CLAUDE.md", "팀 규칙서. 한 번 작성해두면 매번 반복 설명할 필요가 없습니다.", M.or)}
        <div style={{ ...card(), width: "100%" }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>이런 내용을 적어둡니다</div>
          {["브랜드 색상: #F58220 오렌지", "개인정보 절대 포함 금지", "출처 반드시 명시", "파일명 규칙: 날짜_유형_주제"].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? `1px solid ${M.bd}` : "none" }}>
              <span style={{ color: M.or, fontWeight: 700 }}>•</span>
              <span style={{ fontSize: 18, color: M.tx }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "핵심 개념 3: Skill",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>핵심 개념 3</div>
        {conceptCard("🎯", "Skill (스킬)", "업무 매뉴얼. 신입사원에게 주는 가이드북처럼, AI에게 업무 방법을 알려줍니다.", "#059669")}
        <div style={{ ...card(), width: "100%" }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>효과</div>
          <div style={{ fontSize: 19, color: M.tx, lineHeight: 1.8 }}>
            "보고서 써줘" 한 마디만 해도<br/>
            <span style={{ color: "#86efac", fontWeight: 700 }}>→ 항상 6섹션 + 미래에셋 양식 + 출처 각주 자동 적용</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "핵심 개념 4: Hook",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>핵심 개념 4</div>
        {conceptCard("⚡", "Hook (훅)", "자동 안전장치. 파일을 만들 때마다 자동으로 규칙을 검사합니다. 예외 없음.", "#fbbf24")}
        <div style={{ ...card(), width: "100%" }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>보험업에서 가장 중요한 Hook</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1, fontSize: 18, color: M.tx }}>보고서에 주민번호 포함 시도</div>
            <div style={{ fontSize: 24, color: M.or }}>→</div>
            <div style={{ flex: 1, fontSize: 18, color: "#fca5a5", fontWeight: 700 }}>즉시 차단 + 경고 메시지</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "핵심 개념 5: MCP",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>핵심 개념 5</div>
        {conceptCard("🔌", "MCP (외부 도구 연결)", "스마트폰에 앱을 설치하듯이, AI에 새로운 능력을 추가합니다.", M.blM)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
          {[
            { icon: "🔍", name: "웹 검색", desc: "최신 데이터 실시간 수집" },
            { icon: "💬", name: "Slack 연결", desc: "메시지 자동 전송" },
            { icon: "🗄️", name: "DB 연결", desc: "데이터베이스 직접 조회" },
            { icon: "🎫", name: "Jira 연결", desc: "업무 티켓 자동 관리" },
          ].map(s => (
            <div key={s.name} style={{ ...card() }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, color: M.or, fontSize: 16, marginTop: 6 }}>{s.name}</div>
              <div style={{ color: M.tx2, fontSize: 14, marginTop: 4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "설치하기",
    render: ({ isMac } = {}) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>설치하기 — <span style={{ color: M.or }}>처음 한 번만</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card(), borderLeft: `4px solid #059669` }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ fontSize: 36 }}>1️⃣</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#059669", marginBottom: 10 }}>Node.js 설치</div>
                {isMac ? (
                  <Cmd cmd="brew install node" desc="macOS (Homebrew)" />
                ) : (
                  <Cmd cmd="winget install OpenJS.NodeJS.LTS" desc="Windows (winget)" />
                )}
                <div style={{ fontSize: 14, color: M.tx3, marginTop: 6 }}>또는 nodejs.org 에서 LTS 버전 직접 다운로드</div>
              </div>
            </div>
          </div>
          <div style={{ ...card() }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ fontSize: 36 }}>2️⃣</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: M.or, marginBottom: 10 }}>Claude Code 설치</div>
                <Cmd cmd="npm install -g @anthropic-ai/claude-code" desc="터미널에서 실행 (macOS·Windows 동일)" />
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>설치는 한 번만! 이후에는 claude 명령어만 입력하면 됩니다</div>
      </div>
    ),
  },
  {
    section: "도입",
    title: "첫 실행",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>첫 실행</div>
        <div style={{ ...card() }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: M.or, marginBottom: 16 }}>터미널에서 아래 명령어 입력</div>
          <Cmd cmd="claude" desc="Claude Code 시작" />
          <div style={{ marginTop: 16, fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            실행하면 인증 화면이 나타납니다.<br/>
            로그인 방식 또는 API 키로 인증하면 준비 완료!
          </div>
        </div>
        <div style={{ ...card(), borderLeft: `4px solid ${M.ac}` }}>
          <div style={{ fontSize: 18, color: M.tx, lineHeight: 1.8 }}>
            인증 후 이렇게 입력해보세요:<br/>
            <span style={{ color: M.or, fontWeight: 700 }}>"안녕! 자기소개 해줘"</span>
          </div>
        </div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>다음 슬라이드부터 실제 시연을 보여드립니다</div>
      </div>
    ),
  },
  // ─── 도입: 자동화 프로그램 시연 (15-24) ───
  {
    section: "도입: 시연",
    title: "시연: 텍스트 → Word 보고서 자동 제작",
    render: sectionTitle("도입: 시연", "텍스트 → Word 보고서\n자동 제작", "한 줄 입력으로 완성된 Word 파일이 만들어지는 과정을 함께 봅시다"),
  },
  {
    section: "도입: 시연",
    title: "전체 과정 미리보기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>전체 과정 <span style={{ color: M.or }}>미리보기</span></div>
        <Flow steps={[
          { icon: "💬", t: "1단계: 프롬프트 작성", d: "한글로 원하는 결과물을 설명", c1: M.bl, c2: M.blM },
          { icon: "🤖", t: "2단계: AI가 코드 생성", d: "Claude Code가 Python 코드를 자동으로 작성", c1: M.or, c2: M.orL },
          { icon: "▶️", t: "3단계: 프로그램 실행", d: "생성된 코드가 자동으로 실행됨", c1: "#059669", c2: "#34d399" },
          { icon: "📄", t: "4단계: 결과물 확인", d: "outputs/ 폴더에 완성된 .docx 파일!", c1: M.blM, c2: M.ac },
        ]} />
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "좋은 프롬프트의 4요소",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>좋은 프롬프트의 <span style={{ color: M.or }}>4요소</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { n: "1", t: "주제", d: "무엇에 대한 건지", ex: "2025 퇴직연금 시장 현황", color: M.ac },
            { n: "2", t: "형식", d: "어떤 파일로 만들지", ex: "Word 보고서로", color: M.or },
            { n: "3", t: "구조", d: "어떤 구성으로", ex: "제목·요약·본문·결론 포함", color: "#059669" },
            { n: "4", t: "출처", d: "어디서 가져올지", ex: "금감원·보험연구원 기반", color: M.blM },
          ].map(p => (
            <div key={p.n} style={{ ...card(), borderLeft: `4px solid ${p.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ background: p.color, color: "#fff", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>{p.n}</span>
                <span style={{ fontWeight: 800, color: p.color, fontSize: 20 }}>{p.t}</span>
              </div>
              <div style={{ color: M.tx2, fontSize: 15 }}>{p.d}</div>
              <div style={{ color: M.or, fontSize: 14, marginTop: 8, fontFamily: "monospace" }}>{p.ex}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "나쁜 프롬프트 vs 좋은 프롬프트",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트 비교</div>
        <div style={{ ...card(), borderLeft: `4px solid #fca5a5` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fca5a5", marginBottom: 10 }}>나쁜 프롬프트</div>
          <div style={{ fontSize: 22, color: M.tx, fontFamily: "monospace" }}>"보고서 써줘"</div>
          <div style={{ fontSize: 14, color: M.tx3, marginTop: 8 }}>너무 짧아서 AI가 무엇을 원하는지 알 수 없음</div>
        </div>
        <div style={{ ...card(), borderLeft: `4px solid #86efac` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#86efac", marginBottom: 10 }}>좋은 프롬프트</div>
          <div style={{ fontSize: 17, color: M.tx, lineHeight: 1.8 }}>
            "2025 퇴직연금 시장 현황을 금감원·보험연구원 데이터로 조사하고,<br/>
            제목·요약·현황·분석·시사점·제언 6개 섹션 Word 보고서를<br/>
            outputs/ 폴더에 만들어줘"
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "시연: Step 1 - 프롬프트 작성",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 1: <span style={{ color: M.or }}>프롬프트 작성</span></div>
        <div style={{ ...card() }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>터미널에서 claude 실행 후 이렇게 입력합니다</div>
          <Ref title="실제 프롬프트 예시">{`퇴직연금 시장 현황을 조사해서 Word 보고서로 만들어줘.

구성:
1. 표지 (제목, 날짜)
2. 요약 (핵심 3줄)
3. 시장 현황 (규모, 성장률)
4. 주요 트렌드 3개
5. 시사점
6. 결론 및 제언

outputs/ 폴더에 저장해줘.`}</Ref>
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "시연: Step 2 - AI가 코드 생성",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 2: <span style={{ color: M.or }}>AI가 코드 생성</span></div>
        {conceptCard("🤖", "Claude Code가 알아서 Python 코드를 작성합니다", "코드를 몰라도 됩니다. AI가 전부 작성하고 실행까지 합니다.", M.or)}
        <div style={{ ...card() }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>AI가 자동으로 처리하는 것들</div>
          {["python-docx 라이브러리 설치", "보고서 구조에 맞는 코드 작성", "미래에셋 색상 (#F58220) 적용", "outputs/ 폴더에 파일 저장 코드 작성"].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 3 ? `1px solid ${M.bd}` : "none" }}>
              <span style={{ color: "#86efac" }}>✓</span>
              <span style={{ fontSize: 17, color: M.tx }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "시연: Step 3 - 프로그램 실행",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 3: <span style={{ color: M.or }}>프로그램 실행</span></div>
        {conceptCard("▶️", "코드가 자동 실행되어 파일이 생성됩니다", "AI가 코드를 작성한 후 바로 실행합니다. 기다리기만 하면 됩니다.", "#059669")}
        <div style={{ background: M.bg3, borderRadius: 12, padding: 20, fontFamily: "monospace", fontSize: 15, lineHeight: 2 }}>
          <div style={{ color: M.tx3 }}>AI가 실행하는 과정:</div>
          <div style={{ color: M.ac }}>라이브러리 설치 중...</div>
          <div style={{ color: M.tx }}>보고서 생성 중...</div>
          <div style={{ color: "#86efac" }}>✓ 완료! outputs/2025-03-14_보고서_퇴직연금.docx</div>
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "시연: Step 4 - 결과물 확인",
    render: ({ isMac } = {}) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 4: <span style={{ color: M.or }}>결과물 확인</span></div>
        {conceptCard("📄", "outputs/ 폴더에 완성된 .docx 파일!", "더블클릭하면 Word에서 열립니다. 바로 사용할 수 있습니다.", M.blM)}
        <div style={{ ...card() }}>
          <Ref title="생성된 파일 구조">{`doc-automation/
├── report_generator.py    ← AI가 작성한 코드
└── outputs/
    └── 2025-03-14_보고서_퇴직연금.docx  ← 완성!`}</Ref>
          {isMac
            ? <Cmd cmd="ls outputs/" desc="파일 확인 (macOS)" />
            : <Cmd cmd="dir outputs" desc="파일 확인 (Windows)" />
          }
          {isMac
            ? <Cmd cmd="open outputs/*.docx" desc="파일 열기 (macOS)" />
            : <Cmd cmd="start outputs" desc="폴더 열기 (Windows)" />
          }
        </div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "Word/PPT 파일의 비밀",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>.docx 파일의 <span style={{ color: M.or }}>비밀</span></div>
        <div style={{ ...card(), textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: M.or }}>보고서.docx = ZIP 파일 + XML</div>
          <div style={{ fontSize: 16, color: M.tx2, marginTop: 8 }}>Word 파일 안에는 사실 텍스트 파일들이 들어있습니다</div>
        </div>
        <Ref title="docx 내부 구조 (비밀!)">{"보고서.docx (= ZIP 파일)\n├── word/\n│   ├── document.xml  ← 본문 내용\n│   ├── styles.xml    ← 폰트·색상\n│   └── header1.xml   ← 머리글\n└── docProps/\n    └── core.xml      ← 제목·작성자"}</Ref>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code는 이 구조를 이해하고 자동으로 만들어줍니다</div>
      </div>
    ),
  },
  {
    section: "도입: 시연",
    title: "이제 직접 만들어봅시다!",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 28, textAlign: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: M.tx }}>이제 <span style={{ color: M.or }}>직접</span> 만들어봅시다!</div>
        <div style={{ fontSize: 22, color: M.tx2 }}>다음 모듈부터 단계별로 직접 만들어 봅니다</div>
        <div style={{ display: "flex", gap: 16 }}>
          {["모듈 1: 기본 제작", "모듈 2: 고도화", "최종 실습: 업무 적용"].map((t, i) => (
            <div key={t} style={{ ...card(), minWidth: 160 }}>
              <div style={{ fontSize: 28 }}>{["🤖", "⚡", "🏢"][i]}</div>
              <div style={{ fontWeight: 700, color: M.or, fontSize: 16, marginTop: 8 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // ─── 모듈 1: AI 에이전트 활용 ───
  {
    section: "모듈 1",
    title: "모듈 1: AI 에이전트 활용하기",
    render: sectionTitle("모듈 1", "AI 에이전트 활용하기", "프로그램을 직접 제작하고, 수정하고, 자동화해봅시다"),
  },
  {
    section: "모듈 1",
    title: "챗봇 vs 에이전트",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>챗봇 vs 에이전트</div>
        {vsBox(
          "챗봇 (상담원)",
          ["질문에 텍스트로 답변", "파일을 직접 만들지 못함", "인터넷 검색 제한적", "사람이 직접 실행해야 함"],
          "에이전트 (비서)",
          ["파일 읽기·쓰기·수정 가능", "코드 작성 + 직접 실행", "인터넷 검색 가능 (MCP)", "다단계 작업 자율 처리"]
        )}
        <div style={{ ...card(), textAlign: "center" }}>
          <span style={{ fontSize: 18, color: M.tx }}>Claude Code = <strong style={{ color: M.or }}>나만의 AI 비서</strong></span>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Claude Code = 나만의 AI 비서",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Claude Code = <span style={{ color: M.or }}>나만의 AI 비서</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { icon: "📝", t: "문서 생성", d: "Word, PPT 파일 자동 작성" },
            { icon: "🔍", t: "웹 리서치", d: "최신 데이터 자동 수집" },
            { icon: "🔄", t: "반복 작업", d: "매달 하던 보고서 자동화" },
            { icon: "✏️", t: "수정·개선", d: "\"표지 추가해줘\" → 즉시 반영" },
          ].map(c => (
            <div key={c.t} style={{ ...card() }}>
              <div style={{ fontSize: 36 }}>{c.icon}</div>
              <div style={{ fontWeight: 800, color: M.or, fontSize: 18, marginTop: 8 }}>{c.t}</div>
              <div style={{ color: M.tx2, fontSize: 15, marginTop: 4 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "작업 폴더 설정",
    render: ({ projectPath, setProjectPath, projectNotice, setProjectNotice } = {}) => {
      const tauri = typeof window !== "undefined" && (window.__TAURI__ || window.__TAURI_INTERNALS__);
      const handleSet = async (dir) => {
        if (!tauri || !dir) return;
        try {
          await tauriInvoke("set_project_dir", { path: dir });
          if (setProjectPath) setProjectPath(dir);
          if (setProjectNotice) setProjectNotice("폴더 설정 완료 — " + dir);
        } catch (e) {
          if (setProjectNotice) setProjectNotice("실패: " + e);
        }
      };
      const handleNew = async () => {
        if (!tauri) return;
        const home = await tauriInvoke("run_shell", { command: "echo $HOME" });
        const dir = (home || "").trim() + "/Documents/doc-automation";
        await handleSet(dir);
      };
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>작업 폴더 <span style={{ color: M.or }}>설정</span></div>
          <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>AI가 문서를 생성할 작업 폴더를 지정합니다.</div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "16px 20px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 10 }}>빠른 시작 — 기본 폴더로 생성</div>
            <button onClick={handleNew} disabled={!tauri}
              style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", cursor: tauri ? "pointer" : "default", fontSize: 16, fontWeight: 700, width: "100%" }}>
              ~/Documents/doc-automation 폴더 생성
            </button>
          </div>
          <div style={{ ...card(), padding: "16px 20px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.tx, marginBottom: 10 }}>직접 경로 입력</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="proj-dir-input" type="text" placeholder="/Users/이름/Documents/my-project"
                style={{ flex: 1, background: M.bg3, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 14px", color: M.or, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, outline: "none" }} />
              <button onClick={() => { const v = document.getElementById("proj-dir-input")?.value; if (v) handleSet(v); }} disabled={!tauri}
                style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
                설정
              </button>
            </div>
          </div>
          {projectNotice && (
            <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "10px 16px" }}>
              <div style={{ fontSize: 15, color: "#86efac", fontWeight: 700 }}>{projectNotice}</div>
            </div>
          )}
        </div>
      );
    },
  },
  {
    section: "모듈 1",
    title: "프로젝트 폴더 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>프로젝트 <span style={{ color: M.or }}>폴더 구조</span></div>
        <Ref title="프로젝트 폴더 구조">{`doc-automation/
├── CLAUDE.md                  ← 팀 규칙서
├── .claude/
│   ├── settings.json          ← Hook 설정
│   ├── hooks/
│   │   └── check-pii.sh       ← 개인정보 검사
│   ├── skills/
│   │   ├── report-writer/     ← 보고서 작성 절차
│   │   ├── competitor-watch/  ← 경쟁사 동향 수집
│   │   └── compliance-check/  ← 컴플라이언스 점검
│   └── commands/
│       └── report.md          ← /report 단축키
├── templates/                 ← 회사 공식 양식
└── outputs/                    ← 결과물 저장`}</Ref>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>이 구조를 한 번 만들면 팀 전체가 함께 사용할 수 있습니다</div>
      </div>
    ),
  },

  // ── CLAUDE.md (4 slides) ──
  {
    section: "모듈 1",
    title: "CLAUDE.md란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md란?</div>
        {conceptCard("📋", "회사 사규집 — 모든 직원이 따르는 공통 규칙", "언어, 톤, 브랜드 색상, 보안 정책 등 프로젝트 전체에 적용되는 기본 규칙입니다.", M.or)}
        {vsBox(
          "CLAUDE.md 없이",
          ["매번 \"한국어로 써줘\"", "매번 \"미래에셋 색상 써줘\"", "매번 \"개인정보 빼줘\"", "→ 기본 규칙을 반복 설명"],
          "CLAUDE.md 사용 시",
          ["언어·톤·색상 자동 적용", "보안 규칙 항상 유지", "팀 전체가 같은 규칙 공유", "→ 프로젝트 공통 규칙 한 곳에"]
        )}
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "CLAUDE.md 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md <span style={{ color: M.or }}>구조</span></div>
        <Code code={`# 프로젝트명

## 기본 동작
- AI가 따를 최우선 행동 규칙 (질문하지 말고 바로 실행 등)

## 언어 및 톤
- 응답 언어, 문서 톤 (한국어, 정중하되 간결)

## 브랜드 가이드라인
- Primary: #F58220 (오렌지) — 제목, 강조, 표 헤더
- Secondary: #043B72 (블루) — 본문

## 보안 규칙
- 개인정보(주민번호, 연락처) 절대 포함 금지

## 파일 규칙
- 출력 위치: outputs/ 폴더
- 파일명: YYYY-MM-DD_[유형]_[주제].확장자

## Skill 연결 (선택)
- 보고서 작성 → report-writer Skill 읽고 절차대로 실행`} name="CLAUDE.md 구조" filePath="CLAUDE.md" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "10px 14px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.or, marginBottom: 4 }}>자동 로드</div>
            <div style={{ fontSize: 16, color: M.tx3 }}>매 대화마다 전체 내용이 AI에 주입됩니다. 별도 호출 불필요.</div>
          </div>
          <div style={{ ...card(), padding: "10px 14px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.or, marginBottom: 4 }}>3단계 계층</div>
            <div style={{ fontSize: 16, color: M.tx3 }}>~/.claude/ (전역) → 프로젝트 루트 → 하위 폴더. 하위가 우선.</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "CLAUDE.md 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md <span style={{ color: M.or }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>"보고서 만들어줘" 한 마디에 대한 AI 응답 차이</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>❌ CLAUDE.md 없이</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`Sure! What kind of report
would you like me to create?

Please provide:
- Topic
- Format (Word, PDF...)
- Any specific requirements

I'll be happy to help!`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#86efac", marginBottom: 10 }}>✅ CLAUDE.md 적용 후</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: "#86efac", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`최신 보험 시장 동향을 주제로
보고서를 작성하겠습니다.

템플릿: 미래에셋생명_A.docx
브랜드: #F58220 오렌지 적용
파일명: 2026-03-18_보고서_
보험시장동향.docx
→ 바로 생성 시작...`}</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.tx2 }}>같은 요청인데 <strong style={{ color: M.or }}>질문 vs 즉시 실행</strong> — CLAUDE.md가 AI의 행동 규칙을 바꿉니다</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "CLAUDE.md 여러 예시",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md <span style={{ color: M.or }}>여러 예시</span></div>
        <Code code={BASE_FILES["CLAUDE.md"]} name="CLAUDE.md (미래에셋생명 실제 예시)" filePath="CLAUDE.md" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "기본 동작", desc: "질문 금지 + 즉시 실행 규칙", color: M.or },
            { label: "브랜드 가이드", desc: "#F58220 오렌지, 미래에셋생명 표기", color: M.or },
            { label: "보안 규칙", desc: "개인정보 절대 포함 금지", color: "#fca5a5" },
          ].map((item, i) => (
            <div key={i} style={{ ...card(), padding: "10px 12px", borderLeft: `4px solid ${item.color}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 14, color: M.tx3 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "체험: 프롬프트로 CLAUDE.md 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: M.or }}>CLAUDE.md 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 CLAUDE.md를 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-claudemd"
            defaultValue={`CLAUDE.md 만들어줘.\n미래에셋생명 보고서 자동화 프로젝트야.\n한국어로 작성하고, 질문하지 말고 바로 실행해줘.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "'JetBrains Mono',monospace", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-claudemd"); if (t) navigator.clipboard.writeText(t.value); }}
            style={{ marginTop: 8, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.or, marginBottom: 6 }}>포함할 내용 추가 예시</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              "파일명 규칙 날짜_유형_주제 형식"<br/>
              "모든 수치에 출처 각주 필수"<br/>
              "개인정보 절대 포함 금지"
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.or, marginBottom: 6 }}>만들고 나서</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              내용을 보고 마음에 안 드는 부분은<br/>
              자연스럽게 수정 요청하면 됩니다.<br/>
              "톤을 더 간결하게 바꿔줘"
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // ── Skill (4 slides) ──
  {
    section: "모듈 1",
    title: "Skill이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill이란?</div>
        {conceptCard("🎯", "재사용 가능한 업무 매뉴얼 — 어디서든 꺼내 쓰는 SOP", "CLAUDE.md는 이 프로젝트에만 적용되지만, Skill은 복사해서 다른 프로젝트에도 그대로 쓸 수 있습니다.", "#059669")}
        {vsBox(
          "CLAUDE.md (프로젝트 귀속)",
          ["이 프로젝트에서만 적용", "언어·톤·색상 등 공통 규칙", "다른 프로젝트에선 새로 작성", "→ 프로젝트마다 1개"],
          "Skill (재사용 가능)",
          ["다른 프로젝트에 복사해서 즉시 사용", "~/.claude/skills/에 넣으면 전역 적용", "팀원에게 파일만 전달하면 끝", "→ 업무별로 N개, 어디서든 재사용"]
        )}
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Skill 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill <span style={{ color: "#059669" }}>구조</span></div>
        <Code code={`---
name: skill-name
description: 사용자가 이 작업을 요청하면 자동 실행. 자동 호출될 키워드를 포함.
---

# Skill 제목

한 줄 설명.

## 역할
당신은 어떤 역할이다. $ARGUMENTS에 대해 작업한다.

## 도메인 규칙
- 이 분야의 핵심 규칙/용어/제약 조건
- 참고해야 할 표준이나 프레임워크

## 실행 절차
1. **첫 번째 단계**: 구체적 행동
2. **두 번째 단계**: 구체적 행동
3. **세 번째 단계**: 구체적 행동
4. 단계별로 사고하라. 질문하지 말고 바로 실행.`} name="SKILL.md 구조" filePath=".claude/skills/example/SKILL.md" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginBottom: 4 }}>name</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>슬래시 명령어명<br/>/name으로 직접 호출</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginBottom: 4 }}>description</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>자동 호출 트리거<br/>사용자 키워드 매칭</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginBottom: 4 }}>$ARGUMENTS</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>사용자 입력 전달<br/>/name 뒤의 텍스트</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Skill 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill <span style={{ color: "#059669" }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>"보고서 만들어줘" — CLAUDE.md만 있을 때 vs Skill까지 있을 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>CLAUDE.md만 (규칙만)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`한국어 ✓ 브랜드 색상 ✓

하지만...
· 구조가 매번 3섹션, 5섹션, 7섹션
· 표 서식이 들쭉날쭉
· 출처 각주 빠짐
· 템플릿 무시하고 새 스타일`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#86efac", marginBottom: 10 }}>CLAUDE.md + Skill (절차까지)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: "#86efac", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`한국어 ✓ 브랜드 색상 ✓

그리고...
· 항상 6섹션 고정 구조
· 표 헤더 #F58220 + 흰색 텍스트
· 모든 수치에 출처 각주 [1]
· 템플릿 스타일 그대로 재사용`}</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.tx2 }}>CLAUDE.md = <strong style={{ color: M.or }}>"무엇을"</strong> / Skill = <strong style={{ color: "#059669" }}>"어떻게"</strong> — 둘을 조합해야 일관된 결과</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Skill 여러 예시",
    render: ({ skillTab, setSkillTab } = {}) => {
      const tabs = [
        { label: "보고서 작성", key: ".claude/skills/report-writer/SKILL.md", name: "report-writer" },
        { label: "경쟁사 분석", key: ".claude/skills/competitor-watch/SKILL.md", name: "competitor-watch" },
        { label: "컴플라이언스", key: ".claude/skills/compliance-check/SKILL.md", name: "compliance-check" },
      ];
      const activeTab = skillTab ?? 0;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill <span style={{ color: "#059669" }}>여러 예시</span></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {tabs.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setSkillTab && setSkillTab(i)}
                style={{
                  background: activeTab === i ? M.or : "transparent",
                  color: activeTab === i ? "#fff" : M.tx3,
                  border: `1px solid ${activeTab === i ? M.or : M.bd}`,
                  borderRadius: 8,
                  padding: "8px 20px",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 700,
                  transition: "all .15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Code
            code={SKILL_FILES[tabs[activeTab].key]}
            name={`${tabs[activeTab].name}/SKILL.md (실제 예시)`}
            filePath={tabs[activeTab].key}
          />
        </div>
      );
    },
  },
  {
    section: "모듈 1",
    title: "체험: 프롬프트로 Skill 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: "#059669" }}>Skill 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Skill 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #059669` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#059669", marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-skill"
            defaultValue={`경쟁사 분석 스킬 파일을 만들어줘.\n.claude/skills/competitor-watch/SKILL.md 로 저장해.\nCLAUDE.md는 건드리지 마.\n\n삼성생명, 한화생명, 교보생명을 비교하고\n뉴스/신상품/실적/전략 4가지로 수집해서\n비교표로 정리하는 절차를 담아줘.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "'JetBrains Mono',monospace", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-skill"); if (t) navigator.clipboard.writeText(t.value); }}
            style={{ marginTop: 8, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#059669", marginBottom: 6 }}>다른 Skill 예시 프롬프트</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              "보고서 작성 스킬 만들어줘.<br/>6섹션 구조, 출처 각주 필수"<br/>
              "컴플라이언스 점검 스킬 만들어줘.<br/>개인정보보호법 기준으로"
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#059669", marginBottom: 6 }}>CLAUDE.md와 연결하기</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              Skill을 만든 후 CLAUDE.md에<br/>
              "경쟁사 분석 요청 시 이 Skill 읽어서<br/>절차대로 실행"이라고 연결합니다.
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // ── Command (4 slides) ──
  {
    section: "모듈 1",
    title: "Command란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command란?</div>
        {conceptCard("⌨️", "/명령어 단축키 (워크플로우 자동화)", "여러 Skill을 순서대로 연결해 복잡한 작업을 한 번에 실행합니다.", M.or)}
        {vsBox(
          "Skill (지식 — 명사)",
          ["AI가 자동으로 판단해서 호출", "어떤 상황에 적용할지 AI가 결정", "배경 지식·절차 제공"],
          "Command (워크플로우 — 동사)",
          ["/report처럼 사용자가 직접 실행", "Skill들을 체이닝해서 자동화", "웹 리서치 → 보고서 → PPT 순서"]
        )}
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Command 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command <span style={{ color: M.or }}>구조</span></div>
        <Code code={`---
description: 이 명령어가 하는 일을 한 줄로 요약.
argument-hint: [주제]
allowed-tools: Read, Write, Bash, WebFetch
---

아래 단계를 순서대로 실행합니다:

1. \`report-writer\` 스킬로 "$ARGUMENTS" 보고서 작성
2. \`compliance-check\` 스킬로 보고서 규제 검토
3. 문제 수정 후 최종 파일 출력
4. 완료 후 다음 추천 작업 제안`} name="commands/report.md" filePath=".claude/commands/report.md" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "10px 14px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.or, marginBottom: 4 }}>argument-hint</div>
            <div style={{ fontSize: 16, color: M.tx3 }}>/report 뒤에 올 인자 힌트.<br/>예: /report 퇴직연금 시장 동향</div>
          </div>
          <div style={{ ...card(), padding: "10px 14px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.or, marginBottom: 4 }}>allowed-tools</div>
            <div style={{ fontSize: 16, color: M.tx3 }}>이 명령 실행 시 허용할 도구 목록.<br/>권한 확인 없이 바로 사용 가능.</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Command 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command <span style={{ color: M.or }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>보고서 + PPT + 컴플라이언스 검토를 한 번에 실행할 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>Command 없이 (수동)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`1. "퇴직연금 보고서 만들어줘"
   → 결과 확인, 수정 요청

2. "이걸로 PPT도 만들어줘"
   → 또 확인, 수정 요청

3. "규제 위반 없는지 검토해줘"
   → 총 3번 요청, 30분 소요`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#86efac", marginBottom: 10 }}>Command 사용 (자동)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: "#86efac", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`/report 퇴직연금
→ 한 줄이면 끝!

1. 웹 리서치 자동 수행
2. 보고서(docx) 생성
3. PPT(pptx) 생성
4. 컴플라이언스 자동 검토
→ 전부 자동, 5분 완료`}</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.tx2 }}>Skill = <strong style={{ color: "#059669" }}>개별 능력</strong> / Command = <strong style={{ color: M.or }}>능력을 연결하는 워크플로우</strong></div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Command 여러 예시",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command <span style={{ color: M.or }}>여러 예시</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { cmd: "/report", desc: "전체 보고서 사이클", detail: "웹 리서치 → 보고서 → PPT → 컴플라이언스 검사 → 최종 파일", color: M.or },
            { cmd: "/competitor", desc: "경쟁사 분석", detail: "삼성·한화·교보 수집 → 비교표 → 전략적 시사점 도출", color: M.or },
            { cmd: "/weekly", desc: "주간 업무 보고", detail: "이번 주 작업 정리 → 성과 요약 → 다음 주 계획 자동 생성", color: M.ac },
            { cmd: "/review", desc: "문서 검토", detail: "컴플라이언스 점검 → 수정 제안 → 최종 승인 버전 저장", color: M.ac },
          ].map(c => (
            <div key={c.cmd} style={{ ...card(), borderLeft: `4px solid ${c.color}` }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, color: c.color, fontWeight: 800, marginBottom: 4 }}>{c.cmd}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: M.tx, marginBottom: 4 }}>{c.desc}</div>
              <div style={{ fontSize: 14, color: M.tx3, lineHeight: 1.6 }}>{c.detail}</div>
            </div>
          ))}
        </div>
        <Code code={COMMAND_FILES[".claude/commands/report.md"]} name="commands/report.md (실제 예시)" filePath=".claude/commands/report.md" />
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "체험: 프롬프트로 Command 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: M.or }}>Command 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Command 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-command"
            defaultValue={`아까 만든 스킬들을 연결하는 "/report" 커맨드를 만들어줘.\n.claude/commands/report.md 파일로 만들어야 해.\n\n순서: 웹 리서치 → 보고서 생성 → PPT 생성 → 컴플라이언스 검토\n아까 만든 경쟁사 분석 스킬도 연결해줘.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "'JetBrains Mono',monospace", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-command"); if (t) navigator.clipboard.writeText(t.value); }}
            style={{ marginTop: 8, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.or, marginBottom: 6 }}>다른 Command 예시 프롬프트</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              '"/competitor" 커맨드 만들어줘.<br/>경쟁사 4곳 수집 후 비교표 생성'<br/>
              '"/weekly" 커맨드 만들어줘.<br/>주간 보고서 자동 생성'
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.or, marginBottom: 6 }}>커맨드를 못 찾을 때</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              파일이 반드시 <strong style={{ color: M.or }}>.claude/commands/</strong> 안에 있어야 합니다.<br/>
              안 되면 /clear 후 다시 시도하세요.
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#86efac", marginBottom: 6 }}>등록 확인 방법</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              터미널에서 <strong style={{ color: M.or }}>/</strong> 입력 → 자동완성에 커맨드가 나타나면 등록 완료.<br/>
              안 나타나면: ls .claude/commands/ 로 파일 존재 여부 확인.
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // ── Hook (4 slides) ──
  {
    section: "모듈 1",
    title: "Hook이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook이란?</div>
        {conceptCard("⚡", "자동 검문소 (통과하는 모든 차량 검사)", "파일이 만들어질 때마다 자동으로 실행됩니다. 예외 없이 100% 강제!", "#fbbf24")}
        {vsBox(
          "Skill (제안)",
          ["AI가 판단해서 적용", "상황에 따라 다를 수 있음", "더 유연함"],
          "Hook (강제)",
          ["예외 없이 100% 실행", "보안 규칙에 적합", "절대 놓치지 않음"]
        )}
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Hook 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: "#fbbf24" }}>구조</span></div>
        <Code code={`// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [           // 언제? → 도구 사용 직전
      {
        "matcher": "Write",    // 어떤 도구? → 파일 쓰기
        "hooks": [{
          "type": "command",
          "command": "bash .claude/hooks/check-pii.sh"
        }]                     // 무엇을? → 개인정보 검사 스크립트 실행
      }
    ]
  }
}`} name="Hook 설정 구조" filePath=".claude/settings.json" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>이벤트 타입</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>PreToolUse (실행 전)<br/>PostToolUse (실행 후)</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>matcher</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>Write, Read, Bash 등<br/>어떤 도구에 반응할지</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>command</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>실행할 쉘 스크립트<br/>차단 시 block 반환</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Hook 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: "#fbbf24" }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>AI가 고객 주민번호가 포함된 보고서를 만들었을 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>Hook 없이 (무방비)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`보고서가 저장되었습니다.
outputs/보고서_고객분석.docx

내용 중:
"김철수(850101-1234567)
고객의 해약 사유 분석..."

⚠️ 개인정보 그대로 노출!
→ 사람이 검토하기 전까진 모름`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#86efac", marginBottom: 10 }}>Hook 적용 (자동 차단)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "'JetBrains Mono',monospace", color: "#86efac", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`🚫 Hook이 파일 저장을 차단!

"주민등록번호 패턴이
감지되었습니다.
마스킹 후 재시도하세요."

→ AI가 자동으로 마스킹 처리:
"김**(**0101-*******)"
→ 안전한 파일로 재저장 ✓`}</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.tx2 }}>Skill은 <strong style={{ color: "#059669" }}>"제안"</strong> / Hook은 <strong style={{ color: "#fbbf24" }}>"강제"</strong> — 보안 규칙은 Hook으로 100% 차단</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "Hook 여러 예시",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: "#fbbf24" }}>여러 예시</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { name: "개인정보 차단 Hook", desc: "파일 저장 전 주민번호·전화번호 감지 → 즉시 차단", event: "PreToolUse / Write", color: "#fca5a5" },
            { name: "활동 로그 Hook", desc: "파일 생성 후 날짜·파일명을 activity.log에 자동 기록", event: "PostToolUse / Write", color: "#fbbf24" },
            { name: "이메일 경고 Hook", desc: "이메일 주소 감지 시 차단 대신 경고 메시지만 표시", event: "PreToolUse / Write", color: "#fbbf24" },
            { name: "명령어 감사 Hook", desc: "Bash 명령 실행 전 허용 목록에 없으면 차단", event: "PreToolUse / Bash", color: "#fca5a5" },
          ].map(h => (
            <div key={h.name} style={{ ...card(), borderLeft: `4px solid ${h.color}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: M.tx, marginBottom: 4 }}>{h.name}</div>
              <div style={{ fontSize: 14, color: M.tx3, marginBottom: 6, lineHeight: 1.6 }}>{h.desc}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: h.color, background: M.bg3, padding: "3px 8px", borderRadius: 4, display: "inline-block" }}>{h.event}</div>
            </div>
          ))}
        </div>
        <Code code={HOOK_FILES[".claude/hooks/check-pii.sh"]} name="check-pii.sh (실제 예시)" filePath=".claude/hooks/check-pii.sh" />
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "체험: 프롬프트로 Hook 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: "#fbbf24" }}>Hook 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Hook 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24", marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-hook"
            defaultValue={`보안 훅을 만들어줘.\n.claude/settings.local.json에 Hook을 설정하고\n.claude/hooks/ 폴더에 스크립트를 만들어.\nCLAUDE.md나 스킬 파일은 건드리지 마.\n\n파일을 저장할 때 주민번호, 전화번호, 이메일이 포함되어 있으면\n저장을 차단하고 마스킹하라고 알려주는 훅이야.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "'JetBrains Mono',monospace", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-hook"); if (t) navigator.clipboard.writeText(t.value); }}
            style={{ marginTop: 8, background: "#fbbf24", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>다른 Hook 예시 프롬프트</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              "파일 생성할 때마다 로그 기록하는 훅 만들어줘"<br/>
              "이메일 주소 발견하면 경고만 표시하는 훅 만들어줘"
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>만들고 나서 테스트</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              "테스트용 파일 하나 만들어봐.<br/>내용에 주민번호 901215-1234567 포함해줘"<br/>
              → Hook이 차단하는지 확인!
            </div>
          </div>
        </div>
      </div>
    ),
  },

  {
    section: "모듈 1",
    title: "템플릿 파일 준비",
    render: ({ tmplStatus, setTmplStatus } = {}) => {
      const tauri = typeof window !== "undefined" && (window.__TAURI__ || window.__TAURI_INTERNALS__);
      const handleCopy = async () => {
        if (!tauri) return;
        if (setTmplStatus) setTmplStatus("working");
        try {
          const msg = await tauriInvoke("copy_templates_to_project", {});
          if (setTmplStatus) setTmplStatus("done:" + msg);
        } catch (e) {
          if (setTmplStatus) setTmplStatus("error:" + e);
        }
      };
      const st = tmplStatus || "idle";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>템플릿 파일 <span style={{ color: M.or }}>준비</span></div>
          <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>미래에셋생명 공식 양식(docx/pptx)을 작업 폴더의 templates/에 복사합니다</div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "16px 20px" }}>
            <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>복사되는 파일: 미래에셋생명_A/B/C.docx, 미래에셋생명_A/B/C.pptx (6개)</div>
            <button onClick={handleCopy} disabled={!tauri || st === "working"}
              style={{ background: st.startsWith("done") ? "#059669" : M.or, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", cursor: tauri ? "pointer" : "default", fontSize: 16, fontWeight: 700, width: "100%" }}>
              {st.startsWith("done") ? "✓ " + st.slice(5) : st === "working" ? "복사 중..." : "📁 템플릿 파일 복사"}
            </button>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: M.tx, marginBottom: 6 }}>Skill에서 템플릿을 활용하는 방법</div>
            <div style={{ fontSize: 16, color: M.tx3, lineHeight: 1.7 }}>
              Skill의 실행 절차에 "templates/ 폴더의 docx 템플릿을 분석하라"고 적으면,<br/>
              AI가 자동으로 템플릿 구조를 읽고 동일한 양식으로 문서를 생성합니다.
            </div>
          </div>
        </div>
      );
    },
  },
  {
    section: "모듈 1",
    title: "실습: 보고서 생성기 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>실습: <span style={{ color: M.or }}>보고서 생성기 만들기</span></div>
        <Cmd cmd="claude" desc="Claude Code 실행" />
        <Ref title="실습 프롬프트">{`보고서 자동 생성 웹 UI를 만들어줘.

주제 입력란, 템플릿 선택(A/B/C), 생성 버튼이 있는 웹 페이지야.
버튼을 누르면 아까 만든 report-writer 스킬의 절차대로
templates/ 양식을 적용해서 outputs/에 docx를 만들어줘.

"/report" 커맨드도 이 UI에서 호출할 수 있게 연결해줘.
HTML + Python으로 간단하게 만들어줘.`}</Ref>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "실습: 수정 요청하기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>실습: <span style={{ color: M.or }}>수정 요청하기</span></div>
        <div style={{ ...card() }}>
          <div style={{ fontSize: 18, color: M.tx3, marginBottom: 12 }}>폰트와 스타일을 이렇게 수정해보세요</div>
          {[
            "제목 글씨를 24pt로 키우고 볼드 처리해줘",
            "표 헤더 배경색을 #043B72 블루로 바꿔줘",
            "본문 줄간격을 1.5로 넓혀줘",
            "페이지 번호를 넣어줘",
            "목차를 자동 생성해줘",
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? `1px solid ${M.bd}` : "none" }}>
              <span style={{ color: M.or, fontSize: 20 }}>•</span>
              <span style={{ fontSize: 18, color: M.tx, fontFamily: "monospace" }}>"{t}"</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>자연스러운 한국어로 말하면 AI가 바로 수정합니다</div>
      </div>
    ),
  },
  // ─── 심화: 5가지 빌딩 블록 + AI와 대화하기 ───
  {
    section: "모듈 1",
    title: "Claude Code의 5가지 도구",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Claude Code의 <span style={{ color: M.or }}>5가지 도구</span></div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>이 5가지만 알면 Claude Code를 자유자재로 활용할 수 있습니다</div>
        {[
          { icon: "📋", name: "CLAUDE.md", desc: "팀 규칙서 — 자동으로 항상 적용됨", color: M.or },
          { icon: "⌨️", name: "Slash Command", desc: "단축 명령어 — /report처럼 직접 실행", color: M.ac },
          { icon: "🤖", name: "Subagent", desc: "전문가 AI — 독립된 전문 분야 담당", color: M.blM },
          { icon: "🎯", name: "Skill", desc: "업무 매뉴얼 — 자동으로 필요할 때 적용", color: "#059669" },
          { icon: "🔌", name: "MCP", desc: "외부 연결 — 웹 검색, Slack, DB 등", color: "#fbbf24" },
        ].map(b => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 16, background: M.bg2, borderRadius: 14, padding: "14px 20px", border: `1px solid ${M.bd}`, borderLeft: `4px solid ${b.color}` }}>
            <span style={{ fontSize: 24 }}>{b.icon}</span>
            <div>
              <span style={{ fontWeight: 800, color: b.color, fontSize: 17 }}>{b.name}</span>
              <span style={{ color: M.tx2, fontSize: 15, marginLeft: 12 }}>{b.desc}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "AI에게 물어보세요!",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Claude Code는 <span style={{ color: M.or }}>스스로 설명</span>할 수 있습니다</div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>모르는 게 있으면 Claude Code에게 직접 물어보세요!</div>
        <div style={{ ...card() }}>
          {[
            "\"어떤 도구를 가지고 있어?\"",
            "\"슬래시 명령어는 어떻게 만들어?\"",
            "\"이 프로젝트 구조를 설명해줘\"",
            "\"지금 열려있는 파일들 뭐가 있어?\"",
            "\"우리 협업을 어떻게 개선할 수 있을까?\"",
          ].map((q, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? `1px solid ${M.bd}` : "none" }}>
              <span style={{ color: "#86efac", fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 17, color: M.or, fontFamily: "'JetBrains Mono',monospace" }}>{q}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 15, color: M.tx3, textAlign: "center" }}>마치 새로 온 동료에게 질문하듯, 편하게 물어보면 됩니다</div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "CLAUDE.md 3단계 계층",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md의 <span style={{ color: M.or }}>3단계 계층</span></div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>회사→팀→개인 순서로 규칙이 적용됩니다</div>
        {[
          { level: "1", name: "회사 전체 규칙", desc: "보안 정책, 개인정보 금지 등 전사 공통 규칙", icon: "🏢", color: M.or, path: "조직 레벨" },
          { level: "2", name: "프로젝트 규칙", desc: "이 프로젝트의 코딩 표준, 템플릿 규칙", icon: "📂", color: M.ac, path: "./CLAUDE.md (팀 공유)" },
          { level: "3", name: "개인 설정", desc: "나만의 작업 스타일, 선호 형식", icon: "👤", color: M.blM, path: "~/.claude/CLAUDE.md" },
        ].map(l => (
          <div key={l.level} style={{ display: "flex", alignItems: "center", gap: 16, background: M.bg2, borderRadius: 14, padding: "18px 24px", border: `1px solid ${M.bd}`, borderLeft: `4px solid ${l.color}` }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: l.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{l.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: l.color, fontSize: 17 }}>{l.name}</div>
              <div style={{ color: M.tx2, fontSize: 14, marginTop: 2 }}>{l.desc}</div>
            </div>
            <div style={{ fontSize: 14, color: M.tx3, fontFamily: "monospace", background: M.bg3, padding: "4px 10px", borderRadius: 6 }}>{l.path}</div>
          </div>
        ))}
        <div style={{ fontSize: 14, color: M.tx3, textAlign: "center" }}>나중에 적용된 규칙이 우선합니다 (개인 {">"} 프로젝트 {">"} 회사)</div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "성공 패턴: 반복이 완벽을 이긴다",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>완벽보다 <span style={{ color: M.or }}>반복</span>이 중요합니다</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }) }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fca5a5", marginBottom: 10 }}>이렇게 하지 마세요</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
              한 번에 완벽한 결과를<br/>얻으려고 긴 프롬프트 작성<br/><br/>
              결과가 마음에 안 들면<br/>처음부터 다시 시작
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#86efac", marginBottom: 10 }}>이렇게 하세요</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
              간단하게 시작하고<br/>결과를 보면서 수정 요청<br/><br/>
              "이 부분 바꿔줘"로<br/>점진적으로 개선
            </div>
          </div>
        </div>
        <div style={{ ...card({ background: M.bg3 }) }}>
          <div style={{ fontSize: 15, color: M.or, fontWeight: 700, marginBottom: 8 }}>유용한 명령어</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { cmd: "/compact", desc: "대화 내용 정리" },
              { cmd: "/rewind", desc: "이전 상태로 되돌리기" },
              { cmd: "/clear", desc: "새로 시작하기" },
            ].map(c => (
              <div key={c.cmd} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: M.or, fontSize: 15, fontWeight: 700 }}>{c.cmd}</div>
                <div style={{ color: M.tx3, fontSize: 15, marginTop: 4 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 1",
    title: "바이브코딩 주의사항",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>
          바이브코딩은 <span style={{ color: "#fca5a5" }}>만능이 아닙니다</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            {
              icon: "🤖",
              title: "할루시네이션",
              desc: "AI가 존재하지 않는 법 조항, 가짜 통계를 만들어낼 수 있습니다. 반드시 사람이 검증하세요.",
            },
            {
              icon: "🔒",
              title: "보안 위험",
              desc: "API 키, 비밀번호, 내부 시스템 정보를 프롬프트에 넣지 마세요. AI 서버에 전송됩니다.",
            },
            {
              icon: "⚖️",
              title: "저작권",
              desc: "AI가 생성한 문서도 출처 표기가 필요합니다. 타사 보고서를 그대로 복사하면 안 됩니다.",
            },
            {
              icon: "🚫",
              title: "이런 건 하면 안 됩니다",
              desc: "고객 개인정보 입력, 미공개 재무 데이터 직접 전달, AI 결과를 무검증 배포",
            },
          ].map((w, i) => (
            <div key={i} style={{ background: M.bg2, borderRadius: 16, padding: "20px 22px", border: `1px solid ${M.bd}`, borderLeft: "4px solid #fca5a5" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 30, lineHeight: 1 }}>{w.icon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#fca5a5", marginBottom: 6 }}>{w.title}</div>
                  <div style={{ color: M.tx2, fontSize: 15, lineHeight: 1.7 }}>{w.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: M.bg2, borderRadius: 12, padding: "12px 20px", border: `1px solid #fca5a544`, textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.tx2 }}>
            AI는 <strong style={{ color: "#fca5a5" }}>보조 도구</strong>입니다. 최종 판단과 책임은 항상 사람에게 있습니다.
          </div>
        </div>
      </div>
    ),
  },

  // ─── 모듈 2: 프로그램 고도화 ───
  {
    section: "모듈 2",
    title: "모듈 2: 프로그램 고도화",
    render: sectionTitle("모듈 2", "프로그램 고도화", "컨텍스트 관리와 외부 연결로 더 스마트하게"),
  },
  {
    section: "모듈 2",
    title: "컨텍스트란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>컨텍스트란?</div>
        {conceptCard("📚", "AI에게 주는 배경지식", "신입사원에게 회사 소개서를 주는 것처럼, AI에게 맥락을 주면 훨씬 잘 합니다.", M.ac)}
        <div style={{ ...card() }}>
          <div style={{ fontSize: 17, color: M.tx, lineHeight: 1.9 }}>
            컨텍스트가 <span style={{ color: "#fca5a5" }}>없으면</span>: "보고서 양식이 어떻게 되나요? 색상은요? 출처는요?..."<br/>
            컨텍스트가 <span style={{ color: "#86efac" }}>있으면</span>: 바로 시작! 모든 규칙을 이미 알고 있음
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "컨텍스트 4가지",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>컨텍스트 <span style={{ color: M.or }}>4가지</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "📋", name: "CLAUDE.md", desc: "프로젝트 전체 규칙 → 항상 지키는 기본 원칙", color: M.or },
            { icon: "🎯", name: "Skill", desc: "업무별 매뉴얼 → 보고서·PPT 작성 가이드", color: "#059669" },
            { icon: "⚡", name: "Hook", desc: "자동 검증 → 개인정보 등 안전장치", color: "#fbbf24" },
            { icon: "🔌", name: "MCP", desc: "외부 데이터 → 실시간 웹 검색·DB 연결", color: M.blM },
          ].map(c => (
            <div key={c.name} style={{ display: "flex", gap: 16, alignItems: "center", ...card(), padding: "16px 20px" }}>
              <span style={{ fontSize: 28 }}>{c.icon}</span>
              <div>
                <span style={{ fontWeight: 800, color: c.color, fontSize: 18 }}>{c.name}</span>
                <span style={{ color: M.tx2, fontSize: 16, marginLeft: 12 }}>{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "프롬프트 엔지니어링 6원칙",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>좋은 프롬프트의 <span style={{ color: M.or }}>6가지 원칙</span></div>
        {[
          { n: "1", rule: "구체적으로 말하기", ex: "\"보고서 써줘\" → \"6개 섹션, 표 포함, A4 5페이지 분량의 보고서 써줘\"", color: M.or },
          { n: "2", rule: "맥락 알려주기", ex: "\"이건 전략회의 자료야\", \"핵심 수치 위주로 정리해줘\"", color: M.ac },
          { n: "3", rule: "단계별로 나누기", ex: "한 번에 다 하지 말고 \"먼저 목차 잡아줘\" → \"2장 내용 써줘\"", color: M.blM },
          { n: "4", rule: "예시 보여주기", ex: "\"이런 형식으로 해줘: (예시 붙여넣기)\"", color: "#059669" },
          { n: "5", rule: "역할 부여하기", ex: "\"너는 미래에셋 경영기획팀 과장이야\"", color: "#fbbf24" },
          { n: "6", rule: "제한 사항 명시", ex: "\"개인정보 빼고\", \"3페이지 이내로\", \"표 2개 이상 포함\"", color: "#dc2626" },
        ].map(r => (
          <div key={r.n} style={{ display: "flex", gap: 14, alignItems: "center", background: M.bg2, borderRadius: 12, padding: "12px 18px", border: `1px solid ${M.bd}`, borderLeft: `4px solid ${r.color}` }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{r.n}</div>
            <div>
              <div style={{ fontWeight: 700, color: r.color, fontSize: 15 }}>{r.rule}</div>
              <div style={{ color: M.tx3, fontSize: 15, marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>{r.ex}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "컨텍스트 관리 실전 명령어",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>컨텍스트 관리 <span style={{ color: M.or }}>실전 명령어</span></div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>대화가 길어지면 AI가 앞부분을 잊어버립니다. 이 명령어로 관리하세요.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { cmd: "/compact", desc: "대화 요약", detail: "긴 대화를 핵심만 남기고 정리. AI 기억력 회복!", icon: "📦", color: M.or },
            { cmd: "/rewind", desc: "되돌리기", detail: "이전 상태로 돌아가서 다른 방법 시도", icon: "⏪", color: M.ac },
            { cmd: "/context", desc: "상태 확인", detail: "현재 AI가 얼마나 기억하고 있는지 확인", icon: "📊", color: M.blM },
            { cmd: "/clear", desc: "새로 시작", detail: "대화를 완전히 리셋하고 처음부터", icon: "🔄", color: "#059669" },
          ].map(c => (
            <div key={c.cmd} style={{ ...card(), textAlign: "center", borderTop: `3px solid ${c.color}` }}>
              <span style={{ fontSize: 28 }}>{c.icon}</span>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: c.color, fontSize: 18, fontWeight: 800, margin: "8px 0" }}>{c.cmd}</div>
              <div style={{ color: M.tx, fontSize: 15, fontWeight: 600 }}>{c.desc}</div>
              <div style={{ color: M.tx3, fontSize: 15, marginTop: 6 }}>{c.detail}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: 컨텍스트 관리 실습",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>컨텍스트 관리</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>대화가 길어질 때 컨텍스트를 관리하는 방법</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 6 }}>대화 압축</div>
            <div data-copyable="/compact" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/compact</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>긴 대화를 요약해서 토큰 절약</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 6 }}>대화 초기화</div>
            <div data-copyable="/clear" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/clear</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>완전히 새로운 대화 시작</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 6 }}>컨텍스트 확인</div>
            <div data-copyable="/context" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/context</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>현재 컨텍스트 사용량 확인</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 6 }}>메모리 확인</div>
            <div data-copyable="/memory" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/memory</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>저장된 메모리 목록 조회</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "노트 테이킹: AI의 외부 기억장치",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>노트 테이킹: <span style={{ color: M.or }}>AI의 외부 기억장치</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>AI에게 메모를 시키면 대화가 끊겨도 기억이 유지됩니다</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "📝", name: "세션 메모", desc: "\"지금까지 대화 내용을 CURRENT_SESSION.md에 정리해줘\"", color: M.or },
            { icon: "📋", name: "결정 기록", desc: "\"API 설계 결정 사항을 DECISIONS.md에 기록해줘\"", color: M.ac },
            { icon: "💡", name: "학습 메모", desc: "\"이번에 알게 된 점을 LEARNINGS.md에 저장해줘\"", color: "#059669" },
            { icon: "🔧", name: "문제 해결", desc: "\"오류 해결 과정을 TROUBLESHOOTING.md에 남겨줘\"", color: "#fbbf24" },
          ].map(n => (
            <div key={n.name} style={{ display: "flex", gap: 14, alignItems: "center", ...card(), padding: "14px 20px", borderLeft: `4px solid ${n.color}` }}>
              <span style={{ fontSize: 24 }}>{n.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: n.color, fontSize: 16 }}>{n.name}</div>
                <div style={{ color: M.tx2, fontSize: 14, marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>{n.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 14, color: M.tx3, textAlign: "center" }}>이 메모 파일들은 다음 대화에서도 AI가 읽어서 활용합니다</div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: 노트 테이킹 실습",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>노트 테이킹</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>AI에게 메모를 남기고, 다음 대화에서 활용해봅시다</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 8 }}>Step 1: 메모 남기기</div>
          <div data-copyable="이 프로젝트는 퇴직연금 시장 분석 보고서야. 다음에 물어보면 기억해줘." title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>
            이 프로젝트는 퇴직연금 시장 분석 보고서야. 다음에 물어보면 기억해줘.
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#86efac", marginBottom: 8 }}>Step 2: 새 대화에서 확인</div>
          <div data-copyable="아까 내가 어떤 프로젝트한다고 했지?" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>
            아까 내가 어떤 프로젝트한다고 했지?
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.tx2 }}>AI가 <strong style={{ color: M.or }}>이전 대화 내용을 기억</strong>하고 답합니다. CLAUDE.md 메모리 시스템 덕분!</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "계획 모드: 큰 작업 체계적으로",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>계획 모드: <span style={{ color: M.or }}>큰 작업을 체계적으로</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>복잡한 작업은 AI에게 먼저 계획을 세우게 하세요</div>
        {[
          { step: "1", title: "맥락 공유", desc: "프로젝트 상황과 요구사항을 알려줌", icon: "📋", color: M.bl },
          { step: "2", title: "계획 수립", desc: "AI가 실행 계획을 작성 → 검토 후 승인", icon: "🗺️", color: M.or },
          { step: "3", title: "자율 실행", desc: "승인된 계획대로 AI가 자동으로 작업", icon: "⚡", color: "#059669" },
          { step: "4", title: "결과 검증", desc: "완성된 결과물을 확인하고 테스트", icon: "✅", color: M.ac },
        ].map(s => (
          <div key={s.step} style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
            <div style={{ flex: 1, background: M.bg2, borderRadius: 12, padding: "14px 20px", border: `1px solid ${M.bd}` }}>
              <span style={{ fontWeight: 800, color: M.tx, fontSize: 17 }}>Step {s.step}. {s.title}</span>
              <span style={{ color: M.tx2, fontSize: 15, marginLeft: 10 }}>{s.desc}</span>
            </div>
          </div>
        ))}
        <div style={{ ...card({ background: M.bg3 }), textAlign: "center" }}>
          <div style={{ fontSize: 14, color: M.or, fontWeight: 700 }}>프롬프트 예시</div>
          <div style={{ fontSize: 15, color: M.tx2, marginTop: 6, fontFamily: "'JetBrains Mono',monospace" }}>"먼저 구현 계획을 세워줘. 계획을 보여주면 내가 검토하고 승인할게"</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: 계획 모드 실습",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>계획 모드</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>큰 작업을 단계별로 나누어 진행해봅시다</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 8 }}>계획 모드 진입</div>
          <div data-copyable="/plan 퇴직연금 시장 분석 보고서를 만들건데, 리서치부터 보고서 작성, PPT 생성, 컴플라이언스 검토까지 단계별 계획을 세워줘" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            /plan 퇴직연금 시장 분석 보고서를 만들건데, 리서치부터 보고서 작성, PPT 생성, 컴플라이언스 검토까지 단계별 계획을 세워줘
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#86efac", marginBottom: 8 }}>계획 확인 후 실행</div>
          <div style={{ fontSize: 16, color: M.tx3, lineHeight: 1.7 }}>
            AI가 단계별 계획을 보여주면 검토 후 "좋아, 실행해줘"로 진행합니다.<br/>
            중간에 "2단계는 건너뛰고 3단계부터" 같은 수정도 가능합니다.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "MCP란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>MCP란?</div>
        {conceptCard("📱", "스마트폰에 앱 설치하기", "기본 Claude Code에 새로운 능력을 추가합니다. 앱을 설치하듯이 간단합니다!", M.blM)}
        {vsBox(
          "MCP 없이",
          ["AI 학습 데이터만 사용", "오래된 정보·부정확한 수치", "인터넷 검색 불가"],
          "MCP 연결 후",
          ["실시간 웹 검색 가능", "최신 데이터·정확한 출처", "Slack·DB 연결도 가능"]
        )}
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "MCP 권한 한번에 설정",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>MCP 권한 <span style={{ color: M.or }}>한번에 설정</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>MCP를 쓰기 전에 권한을 미리 설정하면, 매번 승인하지 않아도 됩니다</div>
        <Code code={`// .claude/settings.local.json
{
  "permissions": {
    "allow": [
      "mcp__web-search",
      "mcp__desktop-automation",
      "Bash(*)",
      "Read(*)",
      "Write(*)"
    ]
  }
}`} name="권한 일괄 설정" filePath=".claude/settings.local.json" />
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "10px 16px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>주의사항</div>
          <div style={{ fontSize: 16, color: M.tx3, lineHeight: 1.7 }}>
            "Bash(*)"는 모든 터미널 명령을 허용합니다. 보안이 중요한 환경에서는<br/>
            "Bash(python *)", "Bash(npm *)" 등 특정 명령만 허용하세요.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: MCP 없이 질문해보기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.blM }}>먼저 MCP 없이</span> 질문</div>
        <div style={{ fontSize: 14, color: M.tx2, textAlign: "center" }}>MCP를 추가하기 <strong>전에</strong>, 아래 질문을 터미널에서 해보세요</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.blM, marginBottom: 8 }}>터미널에 입력</div>
          <div data-copyable="2025년 퇴직연금 시장 규모 알려줘" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>
            2025년 퇴직연금 시장 규모 알려줘
          </div>
        </div>
        <div style={{ ...card(), padding: "12px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 6 }}>결과를 확인하세요</div>
          <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.7 }}>
            정확한 최신 수치가 나왔나요? 출처가 있나요? "학습 데이터 기준"이라고 하지 않나요?<br/>
            <strong style={{ color: M.tx2 }}>다음 슬라이드에서 MCP를 추가한 후, 같은 질문을 다시 해보겠습니다.</strong>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "CLAUDE.md에 MCP 활용 추가",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md에 <span style={{ color: M.or }}>MCP 활용</span> 추가</div>
        <div style={{ fontSize: 16, color: M.tx2, textAlign: "center" }}>MCP를 설치해도 AI가 알아서 쓰지 않을 수 있습니다. CLAUDE.md에 명시하세요!</div>
        <Code code={`## MCP 도구 활용 — "못한다"고 하지 말고 MCP 도구를 즉시 사용할 것
- 화면 캡처/화면 보기 요청 → desktop-automation의 screen_capture 사용
- 마우스 클릭/키보드 입력 요청 → desktop-automation의 mouse_click, keyboard_type 사용
- 웹 검색/최신 데이터 요청 → web-search MCP 사용
- MCP 도구가 있으면 "할 수 없다"고 답하지 말고 반드시 해당 도구를 호출하여 실행`} name="CLAUDE.md에 추가" filePath="CLAUDE.md" />
        <AppendClaudeMd section={CLAUDE_MD_MCP_SECTION} title="CLAUDE.md에 추가" description="MCP 도구 활용 섹션을 CLAUDE.md 끝에 추가합니다" />
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "12px 18px" }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>왜 필요한가요?</div>
          <div style={{ fontSize: 19, color: M.tx3, lineHeight: 1.8 }}>
            AI는 기본적으로 "화면을 볼 수 없다"고 학습되어 있습니다.<br/>
            CLAUDE.md에 <strong style={{ color: M.or }}>"MCP 도구가 있으니 반드시 사용하라"</strong>고 명시하면<br/>
            "못합니다" 대신 <strong style={{ color: "#86efac" }}>바로 MCP 도구를 호출</strong>합니다.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "MCP: 데스크톱 자동화 추가",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>MCP: <span style={{ color: M.or }}>데스크톱 자동화</span></div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }) }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: M.or, marginBottom: 8 }}>AI가 내 모니터 화면을 보고 직접 조작합니다</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            화면 캡처 → AI가 화면 내용 인식 → 마우스 클릭·키보드 입력까지<br/>
            <strong style={{ color: M.tx }}>마치 옆에 앉은 동료가 대신 PC를 조작하는 것처럼!</strong>
          </div>
        </div>
        <div style={{ ...card() }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>터미널에서 설치 (macOS / Windows 모두 지원)</div>
          <Cmd cmd="claude mcp add desktop-automation -- npx -y mcp-desktop-automation" desc="데스크톱 자동화 MCP 추가" />
          <div style={{ fontSize: 14, color: M.tx3, marginTop: 6 }}>Windows에서 npx 오류 시: <code style={{ color: M.or, fontFamily: "'JetBrains Mono',monospace" }}>npx.cmd</code> 로 교체하세요</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { icon: "📸", name: "화면 캡처", desc: "현재 화면을 스크린샷으로 AI에게 전달" },
            { icon: "🖱️", name: "마우스 제어", desc: "클릭, 더블클릭, 드래그, 이동" },
            { icon: "⌨️", name: "키보드 입력", desc: "텍스트 입력, 단축키 실행" },
          ].map(f => (
            <div key={f.name} style={{ ...card(), padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, color: M.or, fontSize: 15, marginTop: 6 }}>{f.name}</div>
              <div style={{ color: M.tx3, fontSize: 14, marginTop: 4 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: AI가 내 화면을 봅니다",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>AI가 내 화면을 봅니다</span></div>
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "10px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>Claude Code를 재시작하세요!</div>
          <div style={{ fontSize: 15, color: M.tx2 }}>MCP는 시작 시 로드됩니다: <span style={{ fontFamily: "monospace", color: M.or }}>/exit</span> → <span style={{ fontFamily: "monospace", color: "#86efac" }}>claude</span></div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 8 }}>터미널에 입력해보세요</div>
          <div data-copyable="지금 내 화면을 캡처해서 뭐가 보이는지 설명해줘" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", fontSize: 14, lineHeight: 1.6 }}>
            지금 내 화면을 캡처해서 뭐가 보이는지 설명해줘
          </div>
        </div>
        <div style={{ ...card(), padding: "12px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: M.tx, marginBottom: 6 }}>AI가 실제로 하는 일</div>
          <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
            1. 현재 모니터 화면을 스크린샷으로 캡처<br/>
            2. 캡처된 이미지를 AI가 분석<br/>
            3. 화면에 보이는 내용을 설명<br/>
            4. 필요하면 마우스·키보드로 직접 조작까지!
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#86efac", marginBottom: 6 }}>이런 것도 해보세요</div>
          <div data-copyable="메모장을 열고 '미래에셋생명 테스트'라고 입력해줘" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
            메모장을 열고 '미래에셋생명 테스트'라고 입력해줘
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "체험: MCP 적용 후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: 이제 <span style={{ color: "#86efac" }}>같은 질문</span>을 다시!</div>
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "10px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>중요: Claude Code를 재시작하세요!</div>
          <div style={{ fontSize: 14, color: M.tx2 }}>MCP는 Claude Code 시작 시 로드됩니다</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <div data-copyable="/exit" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "6px 12px", fontFamily: "'JetBrains Mono',monospace", color: "#fbbf24", border: `1px solid ${M.bd}`, cursor: "pointer" }}>/exit</div>
            <div style={{ color: M.tx3, display: "flex", alignItems: "center" }}>→</div>
            <div data-copyable="claude" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "6px 12px", fontFamily: "'JetBrains Mono',monospace", color: "#86efac", border: `1px solid ${M.bd}`, cursor: "pointer" }}>claude</div>
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#86efac", marginBottom: 8 }}>같은 질문을 다시 입력</div>
          <div data-copyable="2025년 퇴직연금 시장 규모 알려줘" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>
            2025년 퇴직연금 시장 규모 알려줘
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.tx3, marginBottom: 4 }}>아까 (Before)</div>
            <div style={{ fontSize: 14, color: M.tx3, lineHeight: 1.6 }}>"학습 데이터 기준으로..."<br/>오래된 수치, 부정확<br/>출처 없음</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#86efac", marginBottom: 4 }}>지금 (After)</div>
            <div style={{ fontSize: 14, color: "#86efac", lineHeight: 1.6 }}>실시간 웹 검색 실행!<br/>금감원·보험연구원 최신 수치<br/>출처 URL 포함</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: M.tx2 }}>MCP 하나 추가했을 뿐인데 <strong style={{ color: M.blM }}>실시간 데이터를 직접 검색</strong>합니다!</div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "MCP: 이런 것도 연결 가능",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>MCP로 <span style={{ color: M.or }}>연결 가능한 것들</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { icon: "🔍", name: "웹 검색", desc: "금감원·보험연구원 최신 데이터 검색", color: "#059669" },
            { icon: "🖥️", name: "데스크톱 자동화", desc: "화면 캡처 + 마우스·키보드 직접 제어", color: M.or },
            { icon: "💬", name: "Slack", desc: "보고서 완성 시 자동으로 팀에 공유", color: M.blM },
            { icon: "🗄️", name: "DB", desc: "회사 데이터베이스 직접 조회", color: M.ac },
          ].map(s => (
            <div key={s.name} style={{ ...card(), borderLeft: `4px solid ${s.color}`, padding: "12px 16px" }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontWeight: 800, color: s.color, fontSize: 17, marginTop: 6 }}>{s.name}</div>
              <div style={{ color: M.tx2, fontSize: 15, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.ac}` }), padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🏪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.ac }}>MCP 마켓플레이스에서 더 찾아보기</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 4, lineHeight: 1.6 }}>
              수백 개의 MCP 서버를 검색·설치할 수 있습니다
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <a href="https://github.com/modelcontextprotocol/servers" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, color: M.or, fontFamily: "'JetBrains Mono',monospace", textDecoration: "underline", cursor: "pointer" }}>
                github.com/modelcontextprotocol/servers
              </a>
              <a href="https://smithery.ai" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, color: M.or, fontFamily: "'JetBrains Mono',monospace", textDecoration: "underline", cursor: "pointer" }}>
                smithery.ai
              </a>
              <a href="https://glama.ai/mcp/servers" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, color: M.or, fontFamily: "'JetBrains Mono',monospace", textDecoration: "underline", cursor: "pointer" }}>
                glama.ai/mcp/servers
              </a>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "웹 리서치 자동화",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>웹 리서치 <span style={{ color: M.or }}>자동화</span></div>
        <Flow steps={[
          { icon: "💬", t: "주제 입력", d: "\"퇴직연금 시장 현황 조사해줘\"", c1: M.bl, c2: M.blM },
          { icon: "🔍", t: "자동 검색", d: "AI가 3-5개 검색어를 만들어 자동 검색", c1: M.or, c2: M.orL },
          { icon: "📊", t: "데이터 수집", d: "금감원·보험연구원 등 신뢰 기관 데이터", c1: "#059669", c2: "#34d399" },
          { icon: "📋", t: "정리 완료", d: "핵심 수치·트렌드·출처가 자동 정리됨", c1: M.blM, c2: M.ac },
        ]} />
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: ".mcp.json 설정 파일",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>.mcp.json <span style={{ color: M.or }}>설정 파일</span></div>
        <Code code={MCP_FILES[".mcp.json"]} name=".mcp.json" filePath=".mcp.json" />
        <SetupFiles files={MCP_FILES} title="MCP 설정 생성" description="웹 검색 서버 연결" />
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "병렬 실행: 동시에 여러 작업",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>병렬 실행: <span style={{ color: M.or }}>동시에 여러 작업</span></div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center" }}>Claude Code는 여러 작업을 동시에 병렬로 실행할 수 있습니다</div>
        {vsBox(
          "순차 실행 (느림)",
          ["보고서 생성 → 완료 대기", "PPT 생성 → 완료 대기", "리서치 → 완료 대기", "총 30분 소요"],
          "병렬 실행 (빠름)",
          ["보고서 + PPT + 리서치 동시 시작", "Subagent가 각각 독립 처리", "결과 자동 취합", "총 10분 소요"]
        )}
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: M.or, marginBottom: 8 }}>어떻게 병렬 실행되나요?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { n: "1", t: "Subagent 자동 생성", d: "복잡한 작업을 감지하면 AI가 알아서 여러 Subagent를 생성" },
              { n: "2", t: "독립적 병렬 처리", d: "각 Subagent가 파일 읽기·쓰기·검색을 동시에 수행" },
              { n: "3", t: "결과 통합", d: "모든 Subagent 완료 후 메인 에이전트가 결과를 취합" },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: M.or + "22", color: M.or, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
                <div><span style={{ color: M.tx, fontSize: 15, fontWeight: 600 }}>{s.t}</span> <span style={{ color: M.tx3, fontSize: 14 }}>— {s.d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "/btw: 작업 중 끼어들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>/btw: <span style={{ color: M.or }}>작업 중 끼어들기</span></div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center" }}>Claude Code가 작업 중일 때 새로운 지시를 추가할 수 있습니다</div>
        {conceptCard("💬", "작업 중단 없이 추가 지시", "AI가 보고서를 만드는 동안 '/btw 표도 추가해줘'라고 하면 현재 작업에 반영!", M.ac)}
        <div style={{ ...card(), padding: "14px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: M.ac, marginBottom: 12 }}>사용 예시</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { time: "작업 중", user: false, text: "퇴직연금 보고서 생성 중... (3/6 섹션 완료)" },
              { time: "끼어들기", user: true, text: "/btw 각 섹션마다 핵심 수치를 볼드 처리해줘" },
              { time: "반영", user: false, text: "알겠습니다! 남은 섹션부터 핵심 수치를 볼드 처리합니다." },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: m.user ? "flex-end" : "flex-start", flexDirection: m.user ? "row-reverse" : "row" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.user ? M.or + "22" : M.ac + "22", color: m.user ? M.or : M.ac, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.user ? "👤" : "🤖"}</div>
                <div style={{ background: m.user ? M.or + "15" : M.bg2, borderRadius: 10, padding: "8px 14px", maxWidth: "80%", border: `1px solid ${m.user ? M.or + "33" : M.bd}` }}>
                  <div style={{ fontSize: 15, color: M.tx3, marginBottom: 3 }}>{m.time}</div>
                  <div style={{ fontSize: 15, color: m.user ? M.or : M.tx2, fontFamily: m.user ? "'JetBrains Mono',monospace" : "inherit" }}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#86efac", marginBottom: 4 }}>이럴 때 쓰세요</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.6 }}>
              "표 추가해줘"<br/>"색상을 파란색으로 바꿔"<br/>"영문 버전도 만들어줘"
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fca5a5", marginBottom: 4 }}>주의</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.6 }}>
              이미 완료된 부분은 수정 안 됨<br/>너무 큰 방향 전환은 새로 요청<br/>작업 완료 후 수정 요청이 더 안전
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "고도화 과정 요약",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>고도화 <span style={{ color: M.or }}>과정 요약</span></div>
        <Flow steps={[
          { icon: "📝", t: "기본 버전 (모듈 1)", d: "정적 데이터로 보고서 생성", c1: M.tx3, c2: M.bd },
          { icon: "🔌", t: "+ MCP 웹 검색", d: "실시간 최신 데이터 수집 추가", c1: M.blM, c2: M.ac },
          { icon: "🎯", t: "+ Skill 적용", d: "품질 일관성 확보", c1: "#059669", c2: "#34d399" },
          { icon: "⚡", t: "+ Hook 안전장치", d: "개인정보 자동 차단", c1: "#fbbf24", c2: "#fcd34d" },
          { icon: "🚀", t: "고도화 완성!", d: "검색 → 분석 → 생성 → 검증 자동화", c1: M.or, c2: M.orL },
        ]} />
      </div>
    ),
  },
  {
    section: "모듈 2",
    title: "실습: 웹 검색 추가하기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>실습: <span style={{ color: M.or }}>웹 검색 추가하기</span></div>
        <Cmd cmd="claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" desc="MCP 추가" />
        <Cmd cmd="claude" desc="Claude Code 실행" />
        <Ref title="고도화 프롬프트">{`이 프로그램에 웹 검색 기능을 추가해줘.

주제를 입력하면:
1. 먼저 최신 데이터를 자동으로 검색
2. 금감원·보험연구원 등 공신력 있는 소스 우선
3. 수집한 데이터를 바탕으로 보고서 작성`}</Ref>
      </div>
    ),
  },
  // ─── 최종 실습: 부서별 AI 자동화 ───
  {
    section: "최종 실습",
    title: "최종 실습: 부서별 AI 자동화",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 8, padding: "6px 20px", fontSize: 14, fontWeight: 700, color: M.or, letterSpacing: 2, display: "inline-block", marginBottom: 16 }}>최종 실습</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, lineHeight: 1.2, marginBottom: 12 }}>부서별 AI 자동화</div>
          <div style={{ fontSize: 18, color: M.tx2, maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
            CLAUDE.md, Skill, Command, Hook을 조합하여 실제 업무를 자동화합니다
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { icon: "📊", dept: "경영기획팀", tasks: "실적 보고서 + 경쟁사 분석" },
            { icon: "💼", dept: "상품개발팀", tasks: "신상품 기획안 + 시장 조사" },
            { icon: "📋", dept: "준법감시팀", tasks: "문서 컴플라이언스 점검" },
            { icon: "📈", dept: "마케팅팀", tasks: "캠페인 성과 보고서" },
          ].map(d => (
            <div key={d.dept} style={{ ...card(), borderLeft: `4px solid ${M.or}`, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ fontSize: 36 }}>{d.icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: M.or, marginBottom: 4 }}>{d.dept}</div>
                <div style={{ color: M.tx2, fontSize: 16 }}>{d.tasks}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "최종 실습",
    title: "부서별 세팅 예제",
    render: ({ deptTab = 0, setDeptTab } = {}) => {
      const depts = [
        { label: "📊 경영기획", prompt: `우리 팀은 경영기획팀이야.\n1. CLAUDE.md를 만들어줘 — 실적 보고서와 경쟁사 분석이 주 업무야. 한국어, 미래에셋생명 브랜드 색상 적용, 질문하지 말고 바로 실행해줘.\n2. 실적 보고서 작성 스킬을 만들어줘 — 분기별 수입보험료, 신계약, 해약률 데이터를 표로 정리하고 전 분기 대비 증감 분석하는 절차를 담아줘.\n3. 경쟁사 분석 스킬을 만들어줘 — 삼성생명, 한화생명, 교보생명 비교표를 자동 생성하는 절차야.\n4. "/실적보고서" 커맨드를 만들어줘 — 웹에서 최신 데이터 수집하고 보고서 자동 생성하는 워크플로우야.\n5. 파일 저장할 때 개인정보 있으면 차단하는 훅을 만들어줘.` },
        { label: "💼 상품개발", prompt: `우리 팀은 상품개발팀이야.\n1. CLAUDE.md를 만들어줘 — 신상품 기획과 시장 조사가 주 업무야. 보험 상품 용어 정확히 써줘.\n2. 상품 기획안 작성 스킬을 만들어줘 — 상품 개요, 타깃 고객, 보장 내용, 예상 손해율, 경쟁 상품 비교 구조로 작성해줘.\n3. 시장 조사 스킬을 만들어줘 — 보험연구원, 금감원 데이터 기반으로 시장 규모와 트렌드를 분석해줘.\n4. "/기획안" 커맨드를 만들어줘 — 시장 조사 → 기획안 작성 → 컴플라이언스 검토까지 한 번에 실행하는 워크플로우야.\n5. 보험료 할인이나 확정 수익 같은 금소법 위반 표현이 있으면 차단하는 훅을 만들어줘.` },
        { label: "📋 준법감시", prompt: `우리 팀은 준법감시팀이야.\n1. CLAUDE.md를 만들어줘 — 문서 검토와 규제 확인이 주 업무야. 개인정보보호법, 금소법, 보험업법 기준으로 일해줘.\n2. 문서 검토 스킬을 만들어줘 — 4대 법규 기준으로 위반 사항 찾고 수정안 제시하는 절차야.\n3. 규제 변경 모니터링 스킬을 만들어줘 — 금감원, 금융위원회 최신 규제 변경 사항을 수집하고 영향 분석해줘.\n4. "/문서검토" 커맨드를 만들어줘 — 문서 읽기 → 4대 법규 점검 → 위반 보고서 생성까지 한 번에 실행해줘.\n5. 고객 실명이나 주민번호가 포함되면 무조건 차단하는 훅을 만들어줘.` },
        { label: "📈 마케팅", prompt: `우리 팀은 마케팅팀이야.\n1. CLAUDE.md를 만들어줘 — 캠페인 성과 분석과 마케팅 보고서가 주 업무야. 데이터 시각화에 신경 써줘.\n2. 캠페인 성과 보고서 스킬을 만들어줘 — 채널별 전환율, ROI, 고객 유입 경로를 표와 차트로 정리해줘.\n3. 경쟁사 마케팅 분석 스킬을 만들어줘 — 경쟁사 광고, SNS, 프로모션 동향을 수집하고 비교해줘.\n4. "/성과보고서" 커맨드를 만들어줘 — 데이터 수집 → 분석 → 보고서 + PPT 생성까지 자동화해줘.\n5. 고객 이메일이나 연락처가 포함되면 마스킹하라고 경고하는 훅을 만들어줘.` },
      ];
      const sel = depts[deptTab] || depts[0];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%" }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>부서별 <span style={{ color: M.or }}>세팅 예제</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {depts.map((d, i) => (
              <button key={i} onClick={() => setDeptTab && setDeptTab(i)}
                style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: deptTab === i ? `2px solid ${M.or}` : `1px solid ${M.bd}`, background: deptTab === i ? M.or + "22" : "transparent", color: deptTab === i ? M.or : M.tx3, fontWeight: deptTab === i ? 700 : 500, fontSize: 14, cursor: "pointer", textAlign: "center" }}>
                {d.label}
              </button>
            ))}
          </div>
          <div style={{ ...card(), borderLeft: "4px solid #fbbf24", padding: "8px 14px" }}>
            <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700 }}>새 세션에서 시작하세요 — /clear로 이전 대화를 초기화한 뒤 아래 프롬프트를 입력하세요.</div>
          </div>
          <textarea id="ta-dept"
            key={deptTab}
            defaultValue={sel.prompt}
            rows={8}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "'JetBrains Mono',monospace", color: M.or, borderRadius: 8, padding: 14, width: "100%", resize: "vertical", lineHeight: 1.7, outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-dept"); if (t) navigator.clipboard.writeText(t.value); }}
            style={{ marginTop: 4, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
          <div style={{ fontSize: 15, color: M.tx3, textAlign: "center", marginTop: 4 }}>프롬프트를 자유롭게 수정한 뒤, 터미널에 붙여넣으세요.</div>
        </div>
      );
    },
  },
  {
    section: "최종 실습",
    title: "실습 체크리스트",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>실습 <span style={{ color: M.or }}>체크리스트</span></div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "✅", label: "CLAUDE.md", desc: "팀 맞춤 규칙 설정 완료" },
              { icon: "✅", label: "Skill 2~3개", desc: "핵심 업무 절차 자동화" },
              { icon: "✅", label: "Command 1개", desc: "원클릭 워크플로우" },
              { icon: "✅", label: "Hook 1개", desc: "보안/규제 자동 검사" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", background: M.bg3, borderRadius: 8, padding: "12px 16px" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontWeight: 700, color: M.or, fontSize: 16, minWidth: 120 }}>{item.label}</span>
                <span style={{ color: M.tx2, fontSize: 16 }}>— {item.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), textAlign: "center" }}>
          <div style={{ fontSize: 18, color: "#86efac", fontWeight: 700 }}>이 4가지를 갖추면 어떤 부서든 AI 자동화가 가능합니다.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card() }}>
            <div style={{ fontWeight: 700, color: M.or, fontSize: 16, marginBottom: 6 }}>팀원 공유</div>
            <div style={{ color: M.tx2, fontSize: 15, lineHeight: 1.7 }}>.claude/ Git 커밋 — 팀 전체가 같은 품질로 작업</div>
          </div>
          <div style={{ ...card() }}>
            <div style={{ fontWeight: 700, color: M.or, fontSize: 16, marginBottom: 6 }}>지속 개선</div>
            <div style={{ color: M.tx2, fontSize: 15, lineHeight: 1.7 }}>Skill 파일만 수정하면 즉시 반영</div>
          </div>
        </div>
      </div>
    ),
  },

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

  // 파일 존재 여부만 확인 (표시는 항상 code prop 사용, 편집 시에만 디스크 로드)
  useEffect(() => {
    if (!filePath || !tauri) return;
    tauriInvoke("check_project_file", { path: filePath }).then(exists => {
      setFileExists(exists);
    }).catch(() => {});
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath) return;
    try {
      const fullPath = await tauriInvoke("write_project_file", { path: filePath, content: editContent });
      setSavePath(fullPath);
      setSaved(true);
      setFileExists(true);
      setLoaded(true);
      setEditing(false);
      // 저장 후 디스크에서 다시 읽어 확인
      try {
        const fresh = await tauriInvoke("read_project_file", { path: filePath });
        setEditContent(fresh);
      } catch (_) {}
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

  const displayContent = editing ? editContent : code;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${editing ? M.or + "88" : M.bd}`, margin: "16px 0", transition: "border .2s" }}>
      <div style={{ background: M.bg2, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ color: M.or, fontSize: 15, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {filePath && fileExists && !editing && (
            <span style={{ background: "#05966933", color: "#86efac", fontSize: 15, padding: "2px 6px", borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>저장됨</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {filePath && tauri && !editing && (
            <button onClick={handleEdit}
              style={{ background: M.blM, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              ✏️ 편집
            </button>
          )}
          {filePath && tauri && editing && (
            <>
              <button onClick={handleSave}
                style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                💾 저장
              </button>
              <button onClick={() => { setEditing(false); setEditContent(displayContent); }}
                style={{ background: M.bd, color: M.tx2, border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 14 }}>
                취소
              </button>
            </>
          )}
          {filePath && tauri && !editing && !fileExists && (
            <button onClick={handleSave}
              style={{ background: saved ? "#059669" : M.or, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all .2s" }}>
              {saved ? "✓ 생성됨!" : "📁 파일 생성"}
            </button>
          )}
          {!editing && (
            <button onClick={() => { navigator.clipboard.writeText(displayContent); setCp(true); setTimeout(() => setCp(false), 2000); }}
              style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 14 }}>
              {cp ? "✓ 복사됨!" : "📋 복사"}
            </button>
          )}
        </div>
      </div>
      {saved && savePath && (
        <div style={{ background: "#05966622", padding: "6px 16px", fontSize: 14, color: "#86efac", fontFamily: "monospace" }}>
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
            fontFamily: "'JetBrains Mono', monospace", fontSize: 15, lineHeight: 1.7,
            border: "none", outline: "none", resize: "vertical", minHeight: 200,
            display: "block", boxSizing: "border-box",
          }}
          rows={Math.max(10, editContent.split("\n").length + 2)}
        />
      ) : (
        <pre style={{ background: M.bg3, padding: 16, margin: 0, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, color: M.tx }}>{displayContent}</pre>
      )}
    </div>
  );
}

// 복사 버튼 (범용)
function CopyBtn({ text, label }) {
  const [cp, setCp] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text.trim()); setCp(true); setTimeout(() => setCp(false), 1500); }}
      style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 15, flexShrink: 0, transition: "all .15s", whiteSpace: "nowrap" }}>
      {cp ? "✓ 복사됨" : (label || "📋 복사")}
    </button>
  );
}

// 한 줄 명령어 복사
function Cmd({ cmd, desc }) {
  const [cp, setCp] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", background: M.bg3, borderRadius: 8, border: `1px solid ${M.bd}`, overflow: "hidden" }}>
        {desc && <span style={{ color: M.tx3, fontSize: 14, padding: "8px 0 8px 12px", whiteSpace: "nowrap" }}>{desc}</span>}
        <code style={{ flex: 1, color: M.or, fontFamily: "'JetBrains Mono', monospace", padding: "8px 12px", whiteSpace: "nowrap", overflow: "auto" }}>{cmd}</code>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(cmd); setCp(true); setTimeout(() => setCp(false), 1500); }}
        style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "all .15s" }}>
        {cp ? "✓" : "📋"}
      </button>
    </div>
  );
}

// 참고용 블록 (구조도, 코드 예시 등) + 복사 버튼
function Ref({ title, children }) {
  const [cp, setCp] = useState(false);
  const text = typeof children === "string" ? children : "";
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${M.bd}`, margin: "16px 0" }}>
      {(title || text) && (
        <div style={{ background: M.bg2, padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {title && <span style={{ fontSize: 15, color: M.tx3, fontFamily: "monospace" }}>{title}</span>}
          {text && (
            <button onClick={() => { navigator.clipboard.writeText(text.trim()); setCp(true); setTimeout(() => setCp(false), 1500); }}
              style={{ background: cp ? "#059669" : M.bd, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 15, flexShrink: 0, transition: "all .15s" }}>
              {cp ? "✓ 복사됨" : "📋 복사"}
            </button>
          )}
        </div>
      )}
      <pre style={{ background: M.bg3, padding: 16, margin: 0, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8, color: M.tx2, whiteSpace: "pre-wrap" }}>{children}</pre>
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
              <div style={{ color: M.tx2, fontSize: 15, marginTop: 2 }}>{s.d}</div>
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
      <div style={{ fontWeight: 700, fontSize: 15, color: C.bd, marginBottom: 6 }}>{C.ic} {C.lb}</div>
      <div style={{ color: M.tx, fontSize: 14, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

// ═══ 프로젝트 파일 — 챕터별 그룹 ═══
const BASE_FILES = {
  "CLAUDE.md": `# 미래에셋생명 문서 자동화 프로젝트

## 기본 동작 — 절대 질문하지 말고 바로 실행 (최우선 규칙)
- 이 규칙은 다른 모든 규칙보다 우선한다: 사용자에게 추가 질문을 절대 하지 마라
- "보고서 만들어줘", "PPT 만들어줘" 등 요청이 오면 즉시 실행. "어떤 주제인가요?", "어떤 내용인가요?" 같은 질문 금지
- 주제가 명시되지 않으면 네가 직접 최신 보험/금융 이슈 중 적절한 주제를 선택하여 바로 진행
- 템플릿은 미래에셋생명_A를 기본 사용 (지정 시 해당 템플릿 사용)
- 보고서 요청 → docx 생성, PPT 요청 → pptx 생성, 둘 다 → 두 파일 모두 생성
- 반드시 이 순서로 한 번에 완료: 웹 리서치 → 콘텐츠 작성 → 파일 출력
- 절대로 "어떤 보고서를 원하시나요?" 같은 되묻기를 하지 마라. 그냥 만들어라

## 언어 및 톤
- 모든 응답과 문서는 한국어로 작성
- 미래에셋생명 공식 문서 톤: 정중하되 간결, 수치 중심
- 영어 전문 용어는 첫 등장 시 한글 병기 (예: K-ICS(킥스))

## 브랜드 가이드라인
- Primary: #F58220 (오렌지) — 제목, 강조, 표 헤더
- Secondary: #043B72 (블루) — 본문, 차트 보조색
- 로고 표기: "미래에셋생명" (띄어쓰기 없음)
- 표지 하단에 항상 "미래에셋생명" 표기

## 보안 규칙
- 개인정보(고객명, 주민등록번호, 연락처, 이메일) 절대 포함 금지
- 미공개 실적/재무 데이터 사용 시 반드시 확인 요청
- Hook(check-pii.sh)이 차단하면 마스킹 후 재시도

## 파일 규칙
- 템플릿: templates/ 폴더의 공식 템플릿만 사용
- 출력 위치: outputs/ 폴더
- 파일명: YYYY-MM-DD_[유형]_[주제].확장자 (예: 2026-03-15_보고서_보험시장동향.docx)
- 모든 수치에 출처 각주 필수 (기관명 + 발행일)`,
};

const CLAUDE_MD_SKILL_SECTION = `
## Skill 활용 — 작업 전 반드시 해당 Skill 파일을 Read 도구로 열어 절차를 따를 것
- 보고서/docx 작성 → 반드시 .claude/skills/report-writer/SKILL.md 파일을 Read로 열고 절차대로 실행
- 경쟁사 분석/비교 → 반드시 .claude/skills/competitor-watch/SKILL.md 파일을 Read로 열고 절차대로 실행
- 문서 검토/규제 확인 → 반드시 .claude/skills/compliance-check/SKILL.md 파일을 Read로 열고 절차대로 실행`;

const CLAUDE_MD_MCP_SECTION = `
## MCP 도구 활용 — "못한다"고 하지 말고 MCP 도구를 즉시 사용할 것
- 화면 캡처/화면 보기 요청 → desktop-automation의 screen_capture 사용
- 마우스 클릭/키보드 입력 요청 → desktop-automation의 mouse_click, keyboard_type 사용
- 웹 검색/최신 데이터 요청 → web-search MCP 사용
- MCP 도구가 있으면 "할 수 없다"고 답하지 말고 반드시 해당 도구를 호출하여 실행`;

const HOOK_FILES = {
  ".claude/settings.json": `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/check-pii.sh",
            "description": "파일 쓰기 전 개인정보 유출 검사"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo '파일 생성 완료' >> .claude/hooks/activity.log",
            "description": "파일 생성 로그 기록"
          }
        ]
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
};

const SKILL_FILES = {
  ".claude/skills/report-writer/SKILL.md": `---
name: report-writer
description: 보고서, 리포트, docx, 문서 작성 요청 시 자동 실행. 템플릿 분석 → 6섹션 구성 → 서식 적용 → 파일 출력까지 한 번에 처리.
---

# 보고서 작성

$ARGUMENTS에 대한 미래에셋생명 공식 보고서를 생성합니다.

## 역할

당신은 미래에셋생명 시니어 애널리스트로서 공식 보고서를 작성합니다. templates/ 폴더의 docx 템플릿을 먼저 읽어 XML 구조(styles.xml, document.xml)를 파악하고, 기존 스타일명(Heading1, Normal, TableGrid)을 재사용합니다.

## 도메인 규칙

- 미래에셋생명 브랜드: 주색 #F58220(오렌지), 보조색 #043B72(블루)
- 모든 보고서는 6섹션 구조 준수: 표지 → 요약 → 현황 분석 → 심층 분석 → 시사점 → 제언
- 모든 수치에 출처 각주 필수 기재
- 출력 형식: python-docx .docx 파일, outputs/ 폴더에 저장

## 실행 절차

1. **입력 확인**: templates/미래에셋생명_A.docx를 읽어 템플릿 구조 파악. 주제가 있으면 사용, 없으면 최신 보험/금융 이슈 중 직접 선택.
2. **리서치**: 금감원, 보험연구원, 생명보험협회 등 공신력 있는 출처에서 최신 데이터 수집.
3. **6섹션 구성**:
   - 표지: 제목 / 부서명 / 작성자 / 날짜 (1쪽)
   - 요약: 핵심 내용 3줄 이내 (반쪽)
   - 현황 분석: 시장 규모·동향 데이터, 표 1개 이상 (1-2쪽)
   - 심층 분석: 트렌드 3-5개, 데이터 근거 (2-3쪽)
   - 시사점 & 리스크: 미래에셋생명에 미치는 영향 (1쪽)
   - 제언: 구체적 실행 과제 3-5개 (1쪽)
4. **서식 적용**: 표 헤더는 오렌지(#F58220) 배경 + 흰 글자. 출처 각주 삽입([1] 본문 → 페이지 하단 주석).
5. **파일 출력**: python-docx로 outputs/에 .docx 생성. CLAUDE.md 파일명 규칙 준수.
6. 단계별로 사고하라. 사용자에게 추가 질문 없이 최선의 판단으로 바로 진행.`,

  ".claude/skills/competitor-watch/SKILL.md": `---
name: competitor-watch
description: 경쟁사 분석, 타사 비교, 삼성생명/한화생명/교보생명 언급 시 자동 실행. 대상 확정 → 항목별 수집 → 비교표 작성.
---

# 경쟁사 분석

$ARGUMENTS에 대한 국내 생명보험 경쟁사 현황을 분석합니다.

## 역할

당신은 미래에셋생명 경쟁 인텔리전스 담당 애널리스트입니다. 웹 검색으로 경쟁사 최신 동향을 수집하며, 미래에셋생명을 항상 기준 열로 포함합니다.

## 도메인 규칙

- 기본 비교 대상: 삼성생명, 한화생명, 교보생명, NH농협생명
- 출처 우선순위: 보도자료 > 금감원 공시 > 경제지 기사 > 증권사 리포트
- 수집 항목: 최근 뉴스, 신상품, 재무 실적, 디지털/AI 전략

## 실행 절차

1. **범위 확정**: 지정된 회사 사용 또는 기본 세트 사용. 미래에셋생명은 항상 기준 열로 포함.
2. **회사별 수집**:
   - 최근 뉴스: "[사명] 2026 보험 뉴스"
   - 신상품: "[사명] 신상품 출시 2026"
   - 실적: "[사명] 분기 실적 수입보험료"
   - 전략: "[사명] 디지털 전환 OR AI OR 신사업"
3. **비교표 작성**:
   | 구분 | 미래에셋 | 삼성생명 | 한화생명 | 교보생명 |
   |------|---------|---------|---------|---------|
   | 최근 이슈 | ... | ... | ... | ... |
   | 신상품 | ... | ... | ... | ... |
   | 수입보험료 | ... | ... | ... | ... |
   | 디지털/AI | ... | ... | ... | ... |
4. **시사점 도출**: 미래에셋생명 관점에서 전략적 시사점 3개 이상 작성.
5. 단계별로 사고하라. 내용이 많을 경우 outputs/에 마크다운으로 저장.`,

  ".claude/skills/compliance-check/SKILL.md": `---
name: compliance-check
description: 컴플라이언스, 규제 확인, 문서 검토, 발행 전 검토 요청 시 자동 실행. 4대 법규 점검 → 위반 식별 → 수정안 제시.
---

# 컴플라이언스 점검

$ARGUMENTS 문서의 국내 보험 규제 준수 여부를 검토합니다.

## 역할

당신은 미래에셋생명 준법감시 담당자입니다. 대상 문서를 먼저 읽은 후 4개 규제 항목에 대해 체계적으로 점검합니다.

## 도메인 규칙

- 개인정보보호법: 고객 개인식별정보(PII)가 문서에 절대 포함되면 안 됨
- 금융소비자보호법(금소법): 확정 수익 보장 표현 금지
- 보험업법: 미승인 상품 언급 또는 할인 약속 금지
- 저작권법: 모든 통계·제3자 콘텐츠에 출처 표기 필수

## 실행 절차

1. **문서 읽기**: 대상 파일을 열어 전체 내용 파악.
2. **4개 항목 점검**:
   - 개인정보 보호: 고객명, 주민번호, 연락처, 식별 가능 사례 → 마스킹 제안
   - 금소법: 확정 수익 표현("반드시", "확실히", "보장"), 오해 유발 판매 문구 → 대안 제시("~할 수 있습니다")
   - 보험업법: 미승인 상품, 할인 약속, 과장된 보장 → 구체적 법적 근거 인용
   - 저작권·출처: 미인용 제3자 데이터, 누락된 출처 표기 → 추가 또는 삭제 제안
3. **결과 출력** (아래 형식):
   ## 컴플라이언스 점검 결과
   통과: N개 | 주의: N개 | 수정 필요: N개
   | # | 위치 | 유형 | 원문 | 수정 제안 | 근거 법규 |
   |---|------|------|------|----------|----------|
4. 단계별로 사고하라. 모든 위반 사항에는 수정 제안과 구체적인 법 조항 번호를 반드시 포함.`,
};

const COMMAND_FILES = {
  ".claude/commands/report.md": `---
description: 주제를 입력하면 웹 리서치 → 보고서 → PPT → 컴플라이언스 검토까지 한 번에 실행합니다.
argument-hint: [주제 — 예: 퇴직연금 시장 동향]
allowed-tools: Read, Write, Bash, WebFetch, mcp__web-search
---

아래 단계를 순서대로 실행합니다:

1. "report-writer" 스킬을 사용하여 "$ARGUMENTS" 주제로 docx 보고서를 작성합니다
2. 생성된 보고서를 읽고 같은 템플릿 스타일로 pptx 프레젠테이션을 만듭니다
3. "compliance-check" 스킬을 사용하여 보고서의 규제 위반 여부를 검토합니다
4. 위반 사항이 있으면 수정 후 재생성합니다
5. 최종 파일 목록과 요약을 출력합니다
6. 완료 후 제안: "경쟁사 분석도 추가할까요? → /competitor-watch"`,

  ".claude/commands/full-analysis.md": `---
description: 보고서 작성 + 경쟁사 분석 + 컴플라이언스 검토를 순서대로 실행하는 종합 분석 워크플로우입니다.
argument-hint: [주제 — 예: 퇴직연금]
allowed-tools: Read, Write, Bash, WebFetch, mcp__web-search
---

종합 분석 워크플로우를 실행합니다:

1. "competitor-watch" 스킬로 경쟁사 동향을 먼저 수집합니다
2. 수집된 경쟁사 데이터를 참고하여 "report-writer" 스킬로 보고서를 작성합니다
3. "compliance-check" 스킬로 작성된 보고서를 검토합니다
4. 위반 사항이 있으면 자동 수정 후 최종본을 저장합니다
5. 경쟁사 분석표 + 보고서(docx) + PPT(pptx) 총 3개 파일을 outputs/에 출력합니다`,
};

const MCP_FILES = {
  ".mcp.json": `{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-web-search"],
      "env": {
        "BRAVE_API_KEY": "여기에_API키_입력"
      }
    },
    "desktop-automation": {
      "command": "npx",
      "args": ["-y", "mcp-desktop-automation"]
    }
  }
}`,
};

// 전체 합치기 (하위 호환)
const FULL_CLAUDE_MD = { "CLAUDE.md": BASE_FILES["CLAUDE.md"] + CLAUDE_MD_MCP_SECTION };
const PROJECT_FILES = { ...FULL_CLAUDE_MD, ...HOOK_FILES, ...SKILL_FILES, ...COMMAND_FILES, ...MCP_FILES };

function AppendClaudeMd({ section, title, description }) {
  const [status, setStatus] = useState("idle");
  const tauri = isTauri();

  const handleAppend = async () => {
    if (!tauri) return;
    setStatus("working");
    try {
      let current = "";
      try { current = await tauriInvoke("read_project_file", { path: "CLAUDE.md" }); } catch { current = ""; }
      if (current.includes(section.trim().split("\n")[0])) {
        setStatus("exists");
        return;
      }
      await tauriInvoke("write_project_file", { path: "CLAUDE.md", content: current + "\n" + section });
      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: M.bg2, borderRadius: 10, border: `1px solid ${M.bd}`, margin: "12px 0" }}>
      <button onClick={handleAppend} disabled={status === "working" || !tauri}
        style={{ background: status === "done" ? "#059669" : status === "exists" ? M.tx3 : M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: (status === "working" || !tauri) ? "default" : "pointer", fontSize: 15, fontWeight: 700, transition: "all .2s", whiteSpace: "nowrap" }}>
        {status === "done" ? "✓ 추가 완료!" : status === "exists" ? "이미 추가됨" : status === "working" ? "추가 중..." : `📝 ${title}`}
      </button>
      <div style={{ fontSize: 14, color: M.tx3 }}>{description}</div>
    </div>
  );
}

function SetupFiles({ files, title, description, onAfter }) {
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);
  const tauri = isTauri();

  const handleCreate = async () => {
    if (!tauri) return;
    setStatus("working");
    const res = [];
    for (const [path, content] of Object.entries(files)) {
      try {
        await tauriInvoke("write_project_file", { path, content });
        res.push({ path, ok: true, skipped: false });
      } catch (e) {
        res.push({ path, ok: false, err: String(e) });
      }
    }
    if (onAfter) {
      try { await onAfter(); } catch (_) {}
    }
    setResults(res);
    setStatus(res.every(r => r.ok) ? "done" : "error");
  };

  return (
    <div style={{ background: M.bg2, borderRadius: 14, padding: 20, margin: "20px 0", border: `2px solid ${status === "done" ? "#059669" : M.or}44` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: results.length ? 16 : 0 }}>
        <div>
          <div style={{ fontWeight: 800, color: M.or, fontSize: 16 }}>{title}</div>
          <div style={{ color: M.tx2, fontSize: 15, marginTop: 4 }}>
            {description} — 총 {Object.keys(files).length}개 파일
          </div>
        </div>
        {tauri && status !== "done" && (
          <button onClick={handleCreate} disabled={status === "working"}
            style={{ background: M.or, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: status === "working" ? "wait" : "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
            {status === "working" ? "생성 중..." : "📁 파일 생성"}
          </button>
        )}
        {status === "done" && (
          <span style={{ color: "#86efac", fontWeight: 700, fontSize: 14 }}>✓ 완료!</span>
        )}
        {!tauri && (
          <span style={{ color: M.tx3, fontSize: 15 }}>Tauri 앱에서만 사용 가능</span>
        )}
      </div>
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontFamily: "monospace" }}>
              <span style={{ color: r.ok ? "#86efac" : "#fca5a5" }}>{r.ok ? "✓" : "✗"}</span>
              <span style={{ color: M.tx2 }}>{r.path}</span>
              {r.skipped && <span style={{ color: M.tx3, fontSize: 14 }}>(이미 존재 — 건너뜀)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetupSplash({ onDone }) {
  const [steps, setSteps] = useState([
    { id: "node", label: "Node.js", status: "pending" },
    { id: "claude", label: "Claude Code", status: "pending" },
    { id: "auth", label: "인증 설정", status: "pending" },
  ]);
  const [apiKey, setApiKey] = useState("");
  const [authMode, setAuthMode] = useState(null); // null | "choose" | "apikey" | "login"
  const [loginStatus, setLoginStatus] = useState(""); // "" | "working" | "done" | "error"
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(prev => [...prev, msg]);
  const updateStep = (id, status) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));

  useEffect(() => {
    runSetup();
  }, []);

  const runSetup = async () => {
    // Step 1: Node.js
    updateStep("node", "working");
    addLog("Node.js 확인 중...");
    try {
      const ver = await tauriInvoke("check_node");
      addLog(`Node.js ${ver} 감지됨`);
      updateStep("node", "done");
    } catch {
      addLog("Node.js 미설치 → 자동 설치 시작...");
      try {
        const msg = await tauriInvoke("install_node");
        addLog(msg);
        updateStep("node", "done");
      } catch (e) {
        addLog(`Node.js 설치 실패: ${e}`);
        updateStep("node", "error");
        setError("Node.js 설치에 실패했습니다. nodejs.org에서 직접 설치 후 앱을 재시작하세요.");
        return;
      }
    }

    // Step 2: Claude Code
    updateStep("claude", "working");
    addLog("Claude Code 확인 중...");
    try {
      const ver = await tauriInvoke("check_claude");
      addLog(`Claude Code ${ver} 감지됨`);
      updateStep("claude", "done");
    } catch {
      addLog("Claude Code 미설치 → npm install 시작...");
      try {
        const msg = await tauriInvoke("install_claude_code");
        addLog(msg);
        updateStep("claude", "done");
      } catch (e) {
        addLog(`Claude Code 설치 실패: ${e}`);
        updateStep("claude", "error");
        setError("Claude Code 설치에 실패했습니다. 터미널에서 npm install -g @anthropic-ai/claude-code 를 직접 실행하세요.");
        return;
      }
    }

    // Step 3: 인증 확인
    updateStep("auth", "working");
    addLog("인증 상태 확인 중...");
    try {
      const key = await tauriInvoke("load_api_key");
      addLog("API 키 확인 완료");
      updateStep("auth", "done");
      setTimeout(() => onDone(), 800);
      return;
    } catch { /* API 키 없음 */ }
    // claude login 상태 확인
    try {
      await tauriInvoke("check_auth_status");
      addLog("Claude 로그인 확인 완료");
      updateStep("auth", "done");
      setTimeout(() => onDone(), 800);
      return;
    } catch { /* 로그인 안됨 */ }
    addLog("인증 미설정 → 방식 선택 필요");
    setAuthMode("choose");
  };

  const handleSaveKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("sk-ant-")) {
      setError("API 키는 sk-ant-로 시작해야 합니다.");
      return;
    }
    setError("");
    try {
      await tauriInvoke("save_api_key", { key: trimmed });
      addLog("API 키 저장 완료");
      updateStep("auth", "done");
      setAuthMode(null);
      setTimeout(() => onDone(), 600);
    } catch (e) {
      setError(`API 키 저장 실패: ${e}`);
    }
  };

  const handleLogin = async () => {
    setAuthMode("login");
    setLoginStatus("working");
    setError("");
    addLog("claude login 실행 중... (브라우저가 열립니다)");
    try {
      await tauriInvoke("start_claude_login");
      addLog("브라우저에서 로그인을 완료해주세요...");
      // 인증 완료될 때까지 폴링 (2초 간격, 최대 60회 = 2분)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          await tauriInvoke("check_auth_status");
          clearInterval(poll);
          addLog("로그인 성공!");
          setLoginStatus("done");
          updateStep("auth", "done");
          setTimeout(() => onDone(), 800);
        } catch {
          if (attempts >= 60) {
            clearInterval(poll);
            addLog("로그인 시간 초과");
            setLoginStatus("error");
            setError("로그인 시간이 초과되었습니다. 다시 시도해주세요.");
          }
        }
      }, 2000);
    } catch (e) {
      addLog(`로그인 실패: ${e}`);
      setLoginStatus("error");
      setError("로그인에 실패했습니다. Claude Code가 설치되어 있는지 확인하세요.");
    }
  };

  const handleSkipAuth = () => {
    addLog("인증 건너뜀 (나중에 설정 가능)");
    updateStep("auth", "skipped");
    setAuthMode(null);
    setTimeout(() => onDone(), 400);
  };

  const allDone = steps.every(s => s.status === "done" || s.status === "skipped");
  const hasError = steps.some(s => s.status === "error");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: M.bg, fontFamily: "'Noto Sans KR',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
      `}</style>
      <div style={{ width: 480, background: M.bg2, borderRadius: 20, border: `1px solid ${M.bd}`, overflow: "hidden", boxShadow: `0 20px 60px #0008` }}>
        {/* 헤더 */}
        <div style={{ padding: "32px 32px 20px", textAlign: "center", borderBottom: `1px solid ${M.bd}` }}>
          <Logo />
          <div style={{ marginTop: 16, fontSize: 20, fontWeight: 800, color: M.tx }}>환경 자동 설정</div>
          <div style={{ fontSize: 15, color: M.tx2, marginTop: 4 }}>필요한 도구를 자동으로 설치합니다</div>
        </div>

        {/* 단계 표시 */}
        <div style={{ padding: "24px 32px" }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < steps.length - 1 ? `1px solid ${M.bd}22` : "none" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                background: s.status === "done" ? "#059669" : s.status === "error" ? "#dc2626" : s.status === "working" ? M.or : s.status === "skipped" ? M.tx3 : M.bd,
                color: "#fff", fontWeight: 700,
                ...(s.status === "working" ? { animation: "pulse 1.2s ease-in-out infinite" } : {}),
              }}>
                {s.status === "done" ? "✓" : s.status === "error" ? "✗" : s.status === "skipped" ? "—" : s.status === "working" ? "···" : (i + 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: s.status === "done" ? "#86efac" : s.status === "error" ? "#fca5a5" : M.tx }}>{s.label}</div>
                <div style={{ fontSize: 14, color: M.tx3, marginTop: 2 }}>
                  {s.status === "done" ? "완료" : s.status === "error" ? "실패" : s.status === "working" ? "진행 중..." : s.status === "skipped" ? "건너뜀" : "대기"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 인증 방식 선택 */}
        {authMode === "choose" && (
          <div style={{ padding: "0 32px 24px" }}>
            <div style={{ fontSize: 15, color: M.or, fontWeight: 700, marginBottom: 12 }}>인증 방식을 선택하세요</div>
            <div style={{ display: "flex", gap: 10 }}>
              {/* 로그인 카드 */}
              <button onClick={handleLogin}
                style={{ flex: 1, background: M.bg3, border: `1.5px solid ${M.or}66`, borderRadius: 12, padding: "18px 14px", cursor: "pointer", textAlign: "center", transition: "border-color .2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = M.or}
                onMouseLeave={e => e.currentTarget.style.borderColor = M.or + "66"}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#x1f511;</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 4 }}>로그인</div>
                <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.5 }}>
                  Claude Pro/Max 구독자<br/>
                  <span style={{ color: M.tx3 }}>브라우저에서 로그인</span>
                </div>
              </button>
              {/* API 키 카드 */}
              <button onClick={() => { setAuthMode("apikey"); setError(""); }}
                style={{ flex: 1, background: M.bg3, border: `1.5px solid ${M.bd}`, borderRadius: 12, padding: "18px 14px", cursor: "pointer", textAlign: "center", transition: "border-color .2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = M.or}
                onMouseLeave={e => e.currentTarget.style.borderColor = M.bd}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#x1f4cb;</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 4 }}>API 키</div>
                <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.5 }}>
                  Anthropic API 사용자<br/>
                  <span style={{ color: M.tx3 }}>sk-ant- 키 직접 입력</span>
                </div>
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button onClick={handleSkipAuth}
                style={{ background: "none", color: M.tx3, border: "none", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}>
                나중에 설정
              </button>
            </div>
          </div>
        )}

        {/* API 키 입력 폼 */}
        {authMode === "apikey" && (
          <div style={{ padding: "0 32px 24px" }}>
            <div style={{ background: M.bg3, borderRadius: 12, padding: 20, border: `1px solid ${M.or}44` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 15, color: M.or, fontWeight: 700 }}>Anthropic API 키 입력</div>
                <button onClick={() => { setAuthMode("choose"); setError(""); }}
                  style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 14 }}>
                  &#x2190; 돌아가기
                </button>
              </div>
              <div style={{ fontSize: 14, color: M.tx2, marginBottom: 12, lineHeight: 1.6 }}>
                console.anthropic.com &#x2192; API Keys &#x2192; Create Key<br/>
                sk-ant-로 시작하는 키를 붙여넣으세요
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                placeholder="sk-ant-api03-..."
                autoFocus
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${M.bd}`, background: M.bg, color: M.tx, fontSize: 15, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={handleSaveKey}
                  style={{ flex: 1, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                  저장
                </button>
                <button onClick={handleSkipAuth}
                  style={{ background: M.bg2, color: M.tx3, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 15 }}>
                  나중에
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 로그인 진행 중 */}
        {authMode === "login" && (
          <div style={{ padding: "0 32px 24px" }}>
            <div style={{ background: M.bg3, borderRadius: 12, padding: 20, border: `1px solid ${M.or}44`, textAlign: "center" }}>
              <div style={{ fontSize: 15, color: M.or, fontWeight: 700, marginBottom: 12 }}>
                {loginStatus === "working" ? "로그인 진행 중..." : loginStatus === "done" ? "로그인 완료!" : "로그인 실패"}
              </div>
              {loginStatus === "working" && (
                <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.6 }}>
                  브라우저가 열립니다. 로그인을 완료해주세요.<br/>
                  <span style={{ fontSize: 22, display: "inline-block", marginTop: 8, animation: "spin 1s linear infinite" }}>&#x23F3;</span>
                </div>
              )}
              {loginStatus === "error" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                  <button onClick={handleLogin}
                    style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                    다시 시도
                  </button>
                  <button onClick={() => { setAuthMode("choose"); setError(""); }}
                    style={{ background: M.bg2, color: M.tx3, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 15 }}>
                    돌아가기
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div style={{ padding: "0 32px 16px" }}>
            <div style={{ background: "#2d1b1b", border: "1px solid #dc262644", borderRadius: 8, padding: "10px 14px", fontSize: 15, color: "#fca5a5", lineHeight: 1.6 }}>
              {error}
            </div>
          </div>
        )}

        {/* 로그 */}
        <div style={{ padding: "0 32px 20px" }}>
          <div style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", maxHeight: 100, overflowY: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
            {log.map((l, i) => <div key={i}><span style={{ color: M.or }}>$</span> {l}</div>)}
          </div>
        </div>

        {/* 하단 - 에러 시 건너뛰기 */}
        {hasError && (
          <div style={{ padding: "0 32px 20px", textAlign: "center" }}>
            <button onClick={() => onDone()}
              style={{ background: M.bg2, color: M.tx2, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 15 }}>
              건너뛰고 워크북 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══ MAIN APP ═══
export default function App() {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const [page, setPage] = useState(0);
  const [skillTab, setSkillTab] = useState(0);
  const [deptTab, setDeptTab] = useState(0);
  const [projectPath, setProjectPath] = useState("");
  const [projectNotice, setProjectNotice] = useState("");
  const [tmplStatus, setTmplStatus] = useState("idle");
  const [mode, setMode] = useState("slide"); // "slide" | "terminal" | "sandbox"
  const [setupDone, setSetupDone] = useState(!isTauri());
  const [sandboxTab, setSandboxTab] = useState("preview");
  const [chatInput, setChatInput] = useState("");
  const [outputFiles, setOutputFiles] = useState([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewFile, setPreviewFile] = useState(""); // 현재 미리보기 중인 파일명
  const [codeFiles, setCodeFiles] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedCodeName, setSelectedCodeName] = useState("");
  const [selectedElement, setSelectedElement] = useState(null);
  const [cheatOpen, setCheatOpen] = useState(true);
  const [slideTermH, setSlideTermH] = useState(260);
  const slideTermDrag = useRef(null);
  const slideContainerRef = useRef(null);
  const slideContentRef = useRef(null);
  const [slideScale, setSlideScale] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [termFontSize, setTermFontSize] = useState(14);
  const [codeFontSize, setCodeFontSize] = useState(18);
  const [darkMode, setDarkMode] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null); // null | "reset"
  const [sidebarW, setSidebarW] = useState(220);
  const sidebarDrag = useRef(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(""), 3000); return () => clearTimeout(t); } }, [notice]);
  // 테마 전환 시 M 업데이트
  M = darkMode ? DARK : LIGHT;
  const ptyIdRef = useRef(null);

  const TOTAL = SLIDES.length;
  const slide = SLIDES[page];

  // Section index map for sidebar (with sub-slides)
  const sections = [];
  SLIDES.forEach((s, i) => {
    if (sections.length === 0 || sections[sections.length - 1].section !== s.section) {
      sections.push({ section: s.section, firstSlide: i, slides: [{ title: s.title, index: i }] });
    } else {
      sections[sections.length - 1].slides.push({ title: s.title, index: i });
    }
  });
  const [expandedSections, setExpandedSections] = useState({});

  // Keyboard navigation disabled — 방향키로 슬라이드 전환 방지

  // Tauri setup check
  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const [nodeOk, claudeOk, keyOk] = await Promise.allSettled([
          tauriInvoke("check_node"),
          tauriInvoke("check_claude"),
          tauriInvoke("load_api_key"),
        ]);
        if (nodeOk.status === "fulfilled" && claudeOk.status === "fulfilled") {
          if (keyOk.status === "fulfilled") {
            setSetupDone(true);
          } else {
            try {
              const authResult = await tauriInvoke("run_shell", { command: "claude auth status 2>&1" });
              if (authResult && authResult.includes("Authenticated")) setSetupDone(true);
            } catch {}
          }
        }
      } catch {}
    })();
  }, []);

  // 슬라이드 콘텐츠 자동 축소
  useEffect(() => {
    const container = slideContainerRef.current;
    const content = slideContentRef.current;
    if (!container || !content) return;

    const calc = () => {
      // scale을 1로 리셋한 상태에서 실제 높이 측정
      content.style.transform = "scale(1)";
      content.style.transformOrigin = "top center";
      const ch = container.clientHeight - 16; // 패딩 여유
      const sh = content.scrollHeight;
      if (sh > ch && ch > 0) {
        const s = Math.max(0.65, (ch / sh) * 0.98); // 최소 65%, 더 작으면 스크롤
        setSlideScale(s);
        content.style.transform = `scale(${s})`;
      } else {
        setSlideScale(1);
        content.style.transform = "scale(1)";
      }
    };

    // 초기 + 약간 딜레이 후 재계산
    calc();
    const t1 = setTimeout(calc, 50);
    const t2 = setTimeout(calc, 200);

    // 컨테이너 리사이즈 감지
    const ro = new ResizeObserver(() => calc());
    ro.observe(container);

    return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); };
  }, [page, slideTermH, mode]);

  // iframe element click handler
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === "element-click") {
        setSelectedElement({ tag: e.data.tag, text: e.data.text, classes: e.data.classes, id: e.data.id });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // 샌드박스 파일 새로고침
  const refreshSandboxFiles = async () => {
    if (!isTauri()) return;
    try {
      const files = await tauriInvoke("list_output");
      setOutputFiles(files);
      const htmlFile = files.find(f => f.endsWith(".html"));
      if (htmlFile) {
        const content = await tauriInvoke("read_project_file", { path: "outputs/" + htmlFile });
        setPreviewHtml(content);
      }
      const codeExts = [".py", ".js", ".ts", ".sh"];
      const cf = [];
      for (const ext of codeExts) {
        try {
          const r = await tauriInvoke("run_shell", { command: `ls *.${ext.slice(1)} 2>/dev/null` });
          if (r.trim()) cf.push(...r.trim().split("\n"));
        } catch {}
      }
      setCodeFiles(cf);
    } catch {}
  };

  // 수정 요청 전송
  const sendEditRequest = () => {
    if (!chatInput.trim() || !isTauri() || ptyIdRef.current == null) return;
    const isDocx = previewFile && /\.docx?$/i.test(previewFile);
    const isPptx = previewFile && /\.pptx?$/i.test(previewFile);
    let msg;
    if (previewFile && selectedElement) {
      // 파일 + 선택 텍스트 있을 때 → python-docx/python-pptx 기반 수정 프롬프트
      msg = isDocx
        ? `outputs/${previewFile} Word 파일을 python-docx로 열어서, "${selectedElement.text}" 텍스트가 포함된 부분을 찾아서 ${chatInput}. 수정 후 같은 파일에 저장해줘.`
        : isPptx
        ? `outputs/${previewFile} PowerPoint 파일을 python-pptx로 열어서, "${selectedElement.text}" 텍스트가 포함된 부분을 찾아서 ${chatInput}. 수정 후 같은 파일에 저장해줘.`
        : `outputs/${previewFile} 파일에서 "${selectedElement.text}" 부분을 ${chatInput}`;
    } else if (previewFile) {
      msg = isDocx
        ? `outputs/${previewFile} Word 파일을 python-docx로 열어서 ${chatInput}. 수정 후 같은 파일에 저장해줘.`
        : isPptx
        ? `outputs/${previewFile} PowerPoint 파일을 python-pptx로 열어서 ${chatInput}. 수정 후 같은 파일에 저장해줘.`
        : `outputs/${previewFile} 파일에서 ${chatInput}`;
    } else {
      msg = chatInput;
    }
    tauriInvoke("pty_write", { sessionId: ptyIdRef.current, data: msg + "\n" }).catch(() => {});
    setChatInput(""); setSelectedElement(null);
    // 수정 후 자동 새로고침 (8초 후)
    if (previewFile) setTimeout(() => {
      tauriInvoke("preview_file", { filename: previewFile }).then(c => setPreviewHtml(c)).catch(() => {});
    }, 8000);
  };

  // Cheatsheet: derive from current section
  const sectionCheatsheets = {
    "도입": [
      { label: "Node.js 버전 확인", cmd: "node --version" },
      { label: isMac ? "Node.js 설치 (macOS)" : "Node.js 설치 (Windows)", cmd: isMac ? "brew install node" : "winget install OpenJS.NodeJS.LTS" },
      { label: "Claude Code 설치", cmd: "npm install -g @anthropic-ai/claude-code" },
      { label: "Claude Code 버전 확인", cmd: "claude --version" },
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "첫 명령", cmd: "안녕! 자기소개 해줘" },
      { label: "종료", cmd: "/exit" },
    ],
    "도입: 시연": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "Word 보고서 생성", cmd: "퇴직연금 시장 현황을 조사해서 Word 보고서로 만들어줘. 제목, 목차, 본문, 결론 포함하고 outputs/ 폴더에 저장해줘" },
      { label: "PPT 생성", cmd: "같은 내용으로 PPT도 만들어줘. outputs/ 폴더에 저장" },
      { label: isMac ? "파일 확인 (macOS)" : "파일 확인 (Windows)", cmd: isMac ? "ls outputs/" : "dir outputs" },
      { label: isMac ? "파일 열기 (macOS)" : "폴더 열기 (Windows)", cmd: isMac ? "open outputs/*.docx" : "start outputs" },
    ],
    "모듈 1": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "체험: CLAUDE.md 없이", cmd: "보고서 만들어줘" },
      { label: "CLAUDE.md 확인", cmd: isMac ? "cat CLAUDE.md" : "type CLAUDE.md" },
      { label: "체험: Skill 없이", cmd: "퇴직연금 보고서 만들어줘" },
      { label: "Skill 파일 확인", cmd: isMac ? "cat .claude/skills/report-writer/SKILL.md" : "type .claude\\skills\\report-writer\\SKILL.md" },
      { label: "Skill 목록 확인", cmd: isMac ? "ls .claude/skills/" : "dir .claude\\skills" },
      { label: "Hook 만들기 요청", cmd: "개인정보 보호 Hook을 만들어줘. 파일을 저장할 때마다 주민번호, 전화번호가 있으면 차단해줘." },
      { label: "Hook 테스트", cmd: "테스트용 보고서를 만들어봐. 내용에 이걸 포함해줘: \"고객 홍길동, 주민번호 901215-1234567, 연락처 010-1234-5678\"" },
      { label: "Hook 설정 확인", cmd: isMac ? "cat .claude/settings.json" : "type .claude\\settings.json" },
      { label: "보고서 생성기 만들기", cmd: "Python으로 Word 보고서 자동 생성 프로그램을 만들어줘. 주제를 입력하면 제목, 요약, 본문, 결론이 포함된 .docx 파일을 outputs/에 생성하는 프로그램이야" },
      { label: "프로젝트 구조 확인", cmd: isMac ? "find . -type f | head -30" : "dir /s /b | findstr /v node_modules" },
    ],
    "모듈 2": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "체험: MCP 없이", cmd: "2025년 퇴직연금 시장 규모 알려줘" },
      { label: "웹 검색 MCP 추가", cmd: "claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" },
      { label: "MCP 서버 목록", cmd: "claude mcp list" },
      { label: "MCP 연결 테스트", cmd: "금감원 최신 퇴직연금 통계 검색해줘" },
      { label: "웹 리서치 자동화", cmd: "퇴직연금 시장 현황을 웹에서 조사하고, 핵심 수치와 출처를 정리해줘" },
      { label: "/report 명령어 실행", cmd: "/report 2025 퇴직연금 시장 동향" },
      { label: "병렬 실행 테스트", cmd: "퇴직연금 보고서와 PPT를 동시에 만들어줘" },
      { label: "/btw 테스트 (작업 중)", cmd: "/btw 각 섹션에 핵심 수치를 볼드 처리해줘" },
      { label: "Slash Command 확인", cmd: "cat .claude/commands/report.md" },
    ],
    "최종 실습": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "대화 초기화", cmd: "/clear" },
      { label: "경영기획팀 세팅", cmd: "우리 팀은 경영기획팀이야. CLAUDE.md와 실적 보고서 스킬, 경쟁사 분석 스킬, /실적보고서 커맨드, 개인정보 차단 훅을 만들어줘." },
      { label: "상품개발팀 세팅", cmd: "우리 팀은 상품개발팀이야. CLAUDE.md와 상품 기획안 스킬, 시장 조사 스킬, /기획안 커맨드, 금소법 위반 표현 차단 훅을 만들어줘." },
      { label: "준법감시팀 세팅", cmd: "우리 팀은 준법감시팀이야. CLAUDE.md와 문서 검토 스킬, 규제 모니터링 스킬, /문서검토 커맨드, 개인정보 차단 훅을 만들어줘." },
      { label: "마케팅팀 세팅", cmd: "우리 팀은 마케팅팀이야. CLAUDE.md와 캠페인 성과 스킬, 경쟁사 마케팅 분석 스킬, /성과보고서 커맨드, 연락처 마스킹 훅을 만들어줘." },
      { label: "설정 확인", cmd: "cat CLAUDE.md && ls .claude/skills/ && ls .claude/hooks/ && ls .claude/commands/" },
    ],
  };
  // 슬라이드별 치트시트 (제목 키워드 매칭)
  const slideCheatsheets = {
    "체험: 프롬프트로 CLAUDE.md 만들기": [
      { label: "대화 초기화", cmd: "/clear" },
      { label: "CLAUDE.md 생성 요청", cmd: "CLAUDE.md 만들어줘. 미래에셋생명 보고서 자동화 프로젝트야. 한국어, 브랜드 색상 오렌지 #F58220, 질문하지 말고 바로 실행하게 해줘" },
      { label: "생성 확인", cmd: isMac ? "cat CLAUDE.md" : "type CLAUDE.md" },
    ],
    "체험: 프롬프트로 Skill 만들기": [
      { label: "대화 초기화", cmd: "/clear" },
      { label: "Skill 생성 요청", cmd: "경쟁사 분석 스킬 만들어줘. 삼성생명, 한화생명, 교보생명 비교하고, 뉴스/신상품/실적/전략 4가지로 수집해서 비교표로 정리하는 절차를 담아줘" },
      { label: "Skill 목록 확인", cmd: isMac ? "ls .claude/skills/" : "dir .claude\\skills" },
      { label: "Skill 내용 확인", cmd: isMac ? "cat .claude/skills/competitor-watch/SKILL.md" : "type .claude\\skills\\competitor-watch\\SKILL.md" },
    ],
    "체험: 프롬프트로 Command 만들기": [
      { label: "대화 초기화", cmd: "/clear" },
      { label: "Command 생성 요청", cmd: "\"/report\" 슬래시 커맨드를 만들어줘. .claude/commands/report.md 파일로 만들어야 해. 웹 리서치 → 보고서 → PPT 순서로 자동 생성하는 워크플로우야." },
      { label: "Command 확인", cmd: isMac ? "cat .claude/commands/report.md" : "type .claude\\commands\\report.md" },
      { label: "등록 확인 (/ 입력)", cmd: isMac ? "ls .claude/commands/" : "dir .claude\\commands" },
    ],
    "체험: 프롬프트로 Hook 만들기": [
      { label: "대화 초기화", cmd: "/clear" },
      { label: "Hook 생성 요청", cmd: "파일 저장할 때 개인정보 있으면 차단하는 훅 만들어줘" },
      { label: "Hook 테스트", cmd: "테스트용 보고서를 만들어봐. 내용에 이걸 포함해줘: \"고객 홍길동, 주민번호 901215-1234567\"" },
      { label: "Hook 설정 확인", cmd: isMac ? "cat .claude/settings.local.json" : "type .claude\\settings.local.json" },
    ],
    "CLAUDE.md 전후 비교": [
      { label: "CLAUDE.md 없이 테스트", cmd: "보고서 만들어줘" },
      { label: "CLAUDE.md 확인", cmd: isMac ? "cat CLAUDE.md" : "type CLAUDE.md" },
    ],
    "Skill 전후 비교": [
      { label: "Skill 없이 테스트", cmd: "퇴직연금 보고서 만들어줘" },
      { label: "Skill 목록 확인", cmd: isMac ? "ls .claude/skills/" : "dir .claude\\skills" },
    ],
    "Skill 여러 예시": [
      { label: "보고서 Skill", cmd: isMac ? "cat .claude/skills/report-writer/SKILL.md" : "type .claude\\skills\\report-writer\\SKILL.md" },
      { label: "경쟁사 Skill", cmd: isMac ? "cat .claude/skills/competitor-watch/SKILL.md" : "type .claude\\skills\\competitor-watch\\SKILL.md" },
      { label: "컴플라이언스 Skill", cmd: isMac ? "cat .claude/skills/compliance-check/SKILL.md" : "type .claude\\skills\\compliance-check\\SKILL.md" },
    ],
    "실습: 보고서 생성기": [
      { label: "대화 초기화", cmd: "/clear" },
      { label: "보고서 UI 생성", cmd: "보고서 자동 생성 웹 UI를 만들어줘. 아까 만든 report-writer 스킬과 /report 커맨드를 연결해서, 주제 입력 + 템플릿 선택 + 생성 버튼이 있는 웹 페이지야." },
    ],
    "실습: 수정 요청": [
      { label: "제목 크기 변경", cmd: "제목 글씨를 24pt로 키우고 볼드 처리해줘" },
      { label: "표 색상 변경", cmd: "표 헤더 배경색을 #043B72 블루로 바꿔줘" },
      { label: "줄간격 변경", cmd: "본문 줄간격을 1.5로 넓혀줘" },
    ],
    "체험: MCP 없이": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "MCP 없이 테스트", cmd: "2025년 퇴직연금 시장 규모 알려줘" },
    ],
    "MCP: 웹 검색 추가": [
      { label: "웹 검색 MCP 추가", cmd: "claude mcp add web-search -- npx @anthropic-ai/mcp-web-search" },
      { label: "MCP 목록 확인", cmd: "claude mcp list" },
    ],
    "체험: MCP 적용 후": [
      { label: "1. Claude 종료", cmd: "/exit" },
      { label: "2. Claude 재시작", cmd: "claude" },
      { label: "3. 같은 질문 다시", cmd: "2025년 퇴직연금 시장 규모 알려줘" },
      { label: "웹 리서치 테스트", cmd: "금감원 최신 퇴직연금 통계 검색해줘" },
    ],
    "Slash Command": [
      { label: "Slash Command 확인", cmd: isMac ? "cat .claude/commands/report.md" : "type .claude\\commands\\report.md" },
      { label: "/report 실행", cmd: "/report 2025 퇴직연금 시장 동향" },
    ],
    "병렬 실행": [
      { label: "병렬 생성 테스트", cmd: "퇴직연금 보고서와 PPT를 동시에 만들어줘. 각각 outputs/에 저장" },
    ],
    "/btw": [
      { label: "/btw 테스트", cmd: "/btw 각 섹션에 핵심 수치를 볼드 처리해줘" },
    ],
    "템플릿 사용법": [
      { label: "템플릿 확인", cmd: "ls templates/" },
      { label: "템플릿 분석", cmd: "templates/ 폴더의 docx 파일을 분석해서 스타일을 파악해줘" },
    ],
    "실습: 템플릿 분석": [
      { label: "템플릿 분석", cmd: "templates/ 폴더의 docx 파일을 분석해서 스타일(폰트, 색상, 레이아웃)을 파악해줘" },
    ],
    "실습: 양식 적용": [
      { label: "양식 적용 보고서", cmd: "templates/ 폴더의 양식을 그대로 사용해서 \"AI 보험업 활용 현황\" 주제로 보고서를 만들어줘. outputs/ 폴더에 저장" },
    ],
    "Step 1: 템플릿 분석": [
      { label: "생성기 코드 만들기", cmd: "templates/ 폴더의 docx 파일을 분석해서, 같은 양식으로 보고서를 자동 생성하는 Python 코드를 만들어줘" },
    ],
    "Step 2: 웹 UI": [
      { label: "웹 UI 만들기", cmd: "report_generator.py를 활용해서 웹 UI를 만들어줘. 주제 입력창, 자동 조사, docx 다운로드 기능 포함" },
    ],
    "Step 3: 실행": [
      { label: "서버 실행", cmd: "python app.py" },
    ],
    "배치 처리": [
      { label: "배치 생성", cmd: "다음 3개 주제로 각각 보고서를 만들어줘: 1) 퇴직연금 시장 현황 2) MZ세대 보험 트렌드 3) K-ICS 규제 영향. outputs/에 저장" },
    ],
    "PII Hook": [
      { label: "PII 테스트", cmd: "테스트용으로 주민번호 123456-7890123이 포함된 보고서를 만들어봐" },
    ],
    "체험: 노트 테이킹": [
      { label: "메모 남기기", cmd: "이 프로젝트는 퇴직연금 시장 분석 보고서야. 다음에 물어보면 기억해줘." },
      { label: "메모 확인", cmd: "아까 내가 어떤 프로젝트한다고 했지?" },
    ],
    "체험: 계획 모드": [
      { label: "계획 세우기", cmd: "/plan 퇴직연금 시장 분석 보고서를 만들건데, 리서치부터 보고서 작성, PPT 생성, 컴플라이언스 검토까지 단계별 계획을 세워줘" },
      { label: "계획 실행", cmd: "좋아, 실행해줘" },
    ],
    "체험: 컨텍스트 관리": [
      { label: "대화 압축", cmd: "/compact" },
      { label: "대화 초기화", cmd: "/clear" },
      { label: "컨텍스트 확인", cmd: "/context" },
      { label: "메모리 확인", cmd: "/memory" },
    ],
    "MCP 권한 한번에": [
      { label: "권한 설정 파일 확인", cmd: isMac ? "cat .claude/settings.local.json" : "type .claude\\settings.local.json" },
    ],
    "템플릿 사용법": [
      { label: "템플릿 확인", cmd: isMac ? "ls templates/" : "dir templates" },
      { label: "템플릿 분석", cmd: "templates/ 폴더의 docx 파일을 분석해서 스타일을 파악해줘" },
    ],
    "실습: 템플릿 분석": [
      { label: "템플릿 분석", cmd: "templates/ 폴더의 docx 파일을 분석해서 스타일(폰트, 색상, 레이아웃)을 파악해줘" },
    ],
    "실습: 양식 적용": [
      { label: "양식 적용 보고서", cmd: "templates/ 폴더의 양식을 그대로 사용해서 \"AI 보험업 활용 현황\" 주제로 보고서를 만들어줘. outputs/ 폴더에 저장" },
    ],
  };

  // 슬라이드 제목으로 매칭: 정확히 일치 → 포함 매칭 (가장 긴 키 우선) → 섹션 폴백
  const exactMatch = slideCheatsheets[slide.title];
  const partialKeys = Object.keys(slideCheatsheets).filter(k => slide.title.includes(k)).sort((a, b) => b.length - a.length);
  const cheatItems = exactMatch || (partialKeys.length > 0 ? slideCheatsheets[partialKeys[0]] : null) || sectionCheatsheets[slide.section] || [];

  if (!setupDone) {
    return <SetupSplash onDone={() => setSetupDone(true)} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: M.bg, color: M.tx, fontFamily: "'Noto Sans KR',-apple-system,sans-serif", overflow: "hidden", "--code-font-size": codeFontSize + "px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        *{box-sizing:border-box}
        [data-copyable]{font-size:${codeFontSize}px !important}
        pre{font-size:${codeFontSize}px !important}
        code{font-size:${codeFontSize}px !important}
        textarea{font-size:${codeFontSize}px !important}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${M.bd};border-radius:3px}
      `}</style>

      {/* ─── SIDEBAR ─── */}
      <nav style={{ width: sidebarW, minWidth: 140, maxWidth: 500, background: M.bg3, borderRight: `1px solid ${M.bd}`, display: "flex", flexDirection: "column", padding: "16px 0", position: "relative", flexShrink: 0 }}>
        <div style={{ padding: "0 16px", marginBottom: 16 }}><Logo /></div>

        {/* Progress bar */}
        <div style={{ padding: "0 16px 12px", borderBottom: `1px solid ${M.bd}`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: M.bd, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: ((page + 1) / TOTAL * 100) + "%", height: "100%", background: `linear-gradient(90deg,${M.or},${M.orL})`, borderRadius: 4, transition: "width .4s" }} />
            </div>
            <span style={{ color: M.tx3, fontSize: 15, fontFamily: "monospace", whiteSpace: "nowrap" }}>{page + 1}/{TOTAL}</span>
          </div>
        </div>

        {/* Section list with sub-chapters */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {sections.map((sec) => {
            const isActive = slide.section === sec.section;
            const isExpanded = expandedSections[sec.section] ?? isActive;
            return (
              <div key={sec.section} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => {
                    setPage(sec.firstSlide);
                    setExpandedSections(prev => ({ ...prev, [sec.section]: !isExpanded }));
                  }}
                  style={{
                    display: "flex", alignItems: "center", width: "100%", padding: "8px 10px", borderRadius: 8, border: "none",
                    background: isActive ? M.or + "18" : "transparent",
                    borderLeft: isActive ? `3px solid ${M.or}` : "3px solid transparent",
                    cursor: "pointer", textAlign: "left",
                    color: isActive ? M.tx : M.tx2,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 16, transition: "all .15s", gap: 6,
                  }}>
                  <span style={{ fontSize: 15, color: M.tx3, flexShrink: 0, transition: "transform .2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  <span style={{ flex: 1 }}>{sec.section}</span>
                  <span style={{ fontSize: 15, color: M.tx3 }}>{sec.slides.length}</span>
                </button>
                {isExpanded && (
                  <div style={{ paddingLeft: 14, marginTop: 1 }}>
                    {sec.slides.map((sl) => (
                      <button key={sl.index} onClick={() => setPage(sl.index)}
                        style={{
                          display: "block", width: "100%", padding: "4px 10px", borderRadius: 6, border: "none",
                          background: page === sl.index ? M.or + "22" : "transparent",
                          cursor: "pointer", textAlign: "left",
                          color: page === sl.index ? M.or : M.tx3,
                          fontWeight: page === sl.index ? 600 : 400,
                          fontSize: 14, marginBottom: 1, transition: "all .1s",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                        {sl.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mode toggle */}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${M.bd}` }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "slide", label: "📖 슬라이드" },
              { id: "terminal", label: "⌨️ 터미널" },
              { id: "sandbox", label: "🧪 샌드박스" },
            ].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); if (m.id === "sandbox") refreshSandboxFiles(); }}
                style={{ flex: 1, background: mode === m.id ? M.or + "18" : "transparent", color: mode === m.id ? M.or : M.tx3, border: mode === m.id ? `1px solid ${M.or}44` : `1px solid transparent`, borderRadius: 6, padding: "6px 4px", cursor: "pointer", fontSize: 12, fontWeight: mode === m.id ? 700 : 500, textAlign: "center", whiteSpace: "nowrap" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 로그아웃/초기화 */}
        <div style={{ padding: "4px 12px", borderTop: `1px solid ${M.bd}`, display: "flex", gap: 4 }}>
          <button onClick={() => { if (isTauri()) { setNotice("로그아웃 중..."); tauriInvoke("run_shell", { command: "claude auth logout 2>&1" }).then(() => { tauriInvoke("save_api_key", { key: "" }).catch(() => {}); setNotice("로그아웃 완료"); }).catch(() => setNotice("로그아웃 실패")); } }}
            style={{ flex: 1, background: "transparent", border: `1px solid ${M.bd}`, borderRadius: 6, padding: "4px", cursor: "pointer", fontSize: 15, color: M.tx3 }}>
            🔓 로그아웃
          </button>
          <button onClick={() => setConfirmAction("reset")}
            style={{ flex: 1, background: "transparent", border: `1px solid #dc262644`, borderRadius: 6, padding: "4px", cursor: "pointer", fontSize: 15, color: "#fca5a5" }}>
            🗑 초기화
          </button>
        </div>
        <div style={{ padding: "4px 16px 6px", fontSize: 15, color: M.tx3, textAlign: "center" }}>
          © 미래에셋생명 · 바이브 코딩
        </div>
        <div style={{ padding: "2px 16px 8px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: M.tx3 }}>{isMac ? "🍎 macOS" : "🪟 Windows"}</span>
        </div>
        {/* sidebar resize handle */}
        <div
          style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "col-resize", zIndex: 10 }}
          onMouseDown={e => {
            e.preventDefault();
            const startX = e.clientX, startW = sidebarW;
            const onMove = ev => setSidebarW(Math.max(140, Math.min(500, startW + ev.clientX - startX)));
            const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          onMouseEnter={e => e.currentTarget.style.background = M.or + "44"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        />
      </nav>

      {/* ─── MAIN ─── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Header */}
        <header style={{ padding: "8px 20px", borderBottom: `1px solid ${M.bd}`, display: "flex", alignItems: "center", gap: 12, background: M.bg3, flexShrink: 0 }}>
          <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 6, padding: "2px 10px", fontSize: 14, fontWeight: 700, color: M.or, whiteSpace: "nowrap" }}>
            {slide.section}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: M.tx, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {slide.title}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => setDarkMode(d => !d)}
              style={{ background: "none", border: `1px solid ${M.bd}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 15, color: M.tx3 }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <span style={{ color: M.tx3, fontSize: 14, fontFamily: "monospace" }}>{page + 1} / {TOTAL}</span>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ background: M.bg2, color: page === 0 ? M.tx3 : M.tx, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "6px 14px", cursor: page === 0 ? "default" : "pointer", fontSize: 15, fontWeight: 700 }}>
              ←
            </button>
            <button onClick={() => setPage(p => Math.min(TOTAL - 1, p + 1))} disabled={page === TOTAL - 1}
              style={{ background: page === TOTAL - 1 ? M.bg2 : M.or, color: page === TOTAL - 1 ? M.tx3 : "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: page === TOTAL - 1 ? "default" : "pointer", fontSize: 15, fontWeight: 700 }}>
              →
            </button>
          </div>
        </header>

        {mode === "slide" && (
          /* ═══ 슬라이드 모드: 슬라이드 + 하단 미니 터미널 ═══ */
          <>
            {/* 코드 글씨 크기 슬라이더 */}
            <div style={{ padding: "3px 24px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: M.bg3, borderBottom: `1px solid ${M.bd}` }}>
              <span style={{ fontSize: 15, color: M.tx3 }}>코드</span>
              <input type="range" min="10" max="22" value={codeFontSize} onChange={e => setCodeFontSize(Number(e.target.value))}
                style={{ width: 80, accentColor: M.or, height: 3 }} />
              <span style={{ fontSize: 15, color: M.or, fontFamily: "monospace", minWidth: 22 }}>{codeFontSize}</span>
            </div>
            <div ref={slideContainerRef} style={{ flex: 1, overflow: "auto", padding: "12px 24px", display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: 0 }}
              onClick={(e) => {
                // 코드 블록 클릭 시 클립보드 복사
                const el = e.target.closest("[data-copyable]");
                if (el) {
                  const text = el.getAttribute("data-copyable");
                  navigator.clipboard.writeText(text);
                  const old = el.style.borderColor;
                  el.style.borderColor = "#059669";
                  const tip = document.createElement("div");
                  tip.textContent = "✓ 복사됨";
                  tip.style.cssText = "position:absolute;top:-20px;right:8px;background:#059669;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;z-index:99;pointer-events:none";
                  el.style.position = "relative";
                  el.appendChild(tip);
                  setTimeout(() => { el.style.borderColor = old; tip.remove(); }, 1200);
                }
              }}
            >
              <div ref={slideContentRef} style={{ width: slideScale < 1 ? `${100 / slideScale}%` : "100%", maxWidth: slideScale < 1 ? 900 / slideScale : 900, transform: `scale(${slideScale})`, transformOrigin: "top center", fontSize: "0.92em" }}>
                {slide.render({ skillTab, setSkillTab, deptTab, setDeptTab, projectPath, setProjectPath, projectNotice, setProjectNotice, tmplStatus, setTmplStatus, codeFontSize, isMac })}
              </div>
            </div>
            {/* 드래그 리사이즈 핸들 + 터미널 글씨 슬라이더 */}
            <div
              style={{ height: 20, flexShrink: 0, background: M.bg2, borderTop: `1px solid ${M.bd}`, cursor: "row-resize", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 16px" }}
              onMouseDown={(e) => {
                if (e.target.tagName === "INPUT") return; // 슬라이더 클릭은 무시
                e.preventDefault();
                const startY = e.clientY;
                const startH = slideTermH;
                const onMove = (ev) => {
                  const delta = startY - ev.clientY;
                  setSlideTermH(Math.max(120, Math.min(600, startH + delta)));
                };
                const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            >
              <div style={{ width: 30, height: 3, borderRadius: 2, background: M.tx3, opacity: 0.5 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "default" }} onMouseDown={e => e.stopPropagation()}>
                <span style={{ fontSize: 15, color: M.tx3 }}>글씨</span>
                <input type="range" min="10" max="24" value={termFontSize} onChange={e => setTermFontSize(Number(e.target.value))}
                  style={{ width: 60, accentColor: M.or, height: 3 }} />
                <span style={{ fontSize: 15, color: M.or, fontFamily: "monospace", minWidth: 16 }}>{termFontSize}</span>
              </div>
              <div style={{ width: 30, height: 3, borderRadius: 2, background: M.tx3, opacity: 0.5 }} />
            </div>
            <div style={{ height: slideTermH, flexShrink: 0 }}>
              <Suspense fallback={<div style={{ color: M.tx2, padding: 20, fontFamily: "monospace", background: M.bg3, height: "100%" }}>터미널 로딩 중...</div>}>
                <NativeTerminal style={{ height: "100%", borderRadius: 0, border: "none" }} fontSize={termFontSize} darkMode={darkMode} onSessionId={(id) => { ptyIdRef.current = id; }} />
              </Suspense>
            </div>
          </>
        )}

        {mode === "terminal" && (
          /* ═══ 터미널 모드: 치트시트 + 전체 터미널 ═══ */
          <>
            {cheatOpen && cheatItems.length > 0 && (
              <div style={{ background: M.bg2, borderBottom: `1px solid ${M.bd}`, padding: "10px 20px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: M.or }}>치트시트 — {slide.section}</span>
                  <button onClick={() => setCheatOpen(false)} style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 14 }}>접기 ▲</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {cheatItems.map((item, i) => (
                    <div key={i}
                      style={{ display: "flex", alignItems: "center", gap: 8, background: M.bg3, borderRadius: 8, padding: "6px 12px", cursor: "pointer", border: `1px solid ${M.bd}`, transition: "border-color .15s" }}
                      onClick={() => { if (isTauri() && ptyIdRef.current != null) tauriInvoke("pty_write", { sessionId: ptyIdRef.current, data: item.cmd }).catch(() => {}); }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = M.or}
                      onMouseLeave={e => e.currentTarget.style.borderColor = M.bd}>
                      <span style={{ color: M.or, fontWeight: 700, fontSize: 14, minWidth: 20 }}>{i + 1}.</span>
                      <span style={{ color: M.tx2, fontSize: 14, flex: "0 0 auto", maxWidth: 160 }}>{item.label}</span>
                      <code style={{ color: M.or, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.cmd}</code>
                      <span style={{ color: M.tx3, fontSize: 15, flexShrink: 0 }}>클릭→입력</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!cheatOpen && (
              <div style={{ background: M.bg2, borderBottom: `1px solid ${M.bd}`, padding: "4px 20px", textAlign: "center", flexShrink: 0 }}>
                <button onClick={() => setCheatOpen(true)} style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 14 }}>치트시트 펼치기 ▼</button>
              </div>
            )}
            <div style={{ flex: 1, minHeight: 200 }}>
              <Suspense fallback={<div style={{ color: M.tx2, padding: 20, fontFamily: "monospace", background: M.bg3, height: "100%" }}>터미널 로딩 중...</div>}>
                <NativeTerminal style={{ height: "100%", borderRadius: 0, border: "none" }} fontSize={termFontSize} darkMode={darkMode} onSessionId={(id) => { ptyIdRef.current = id; }} />
              </Suspense>
            </div>
          </>
        )}

        {mode === "sandbox" && (
          /* ═══ 샌드박스 모드: 터미널 + 미리보기/코드/출력 ═══ */
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* 터미널 (좌) */}
            <div style={{ width: "45%", minWidth: 280, borderRight: `1px solid ${M.bd}` }}>
              <Suspense fallback={<div style={{ color: M.tx2, padding: 20, fontFamily: "monospace", background: M.bg3, height: "100%" }}>터미널 로딩 중...</div>}>
                <NativeTerminal style={{ height: "100%", borderRadius: 0, border: "none" }} fontSize={termFontSize} darkMode={darkMode} onSessionId={(id) => { ptyIdRef.current = id; }} />
              </Suspense>
            </div>
            {/* 미리보기/코드/출력 (우) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: M.bg3 }}>
              {/* 탭 */}
              <div style={{ display: "flex", borderBottom: `1px solid ${M.bd}`, background: M.bg2, flexShrink: 0 }}>
                {[{ id: "preview", label: "미리보기" }, { id: "code", label: "코드" }, { id: "output", label: "출력" }].map(tab => (
                  <button key={tab.id} onClick={() => setSandboxTab(tab.id)}
                    style={{ background: sandboxTab === tab.id ? M.bg3 : "transparent", color: sandboxTab === tab.id ? M.or : M.tx3, border: "none", borderBottom: sandboxTab === tab.id ? `2px solid ${M.or}` : "2px solid transparent", padding: "8px 14px", cursor: "pointer", fontSize: 15, fontWeight: sandboxTab === tab.id ? 700 : 500 }}>
                    {tab.label}
                  </button>
                ))}
                <button onClick={refreshSandboxFiles}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 15, padding: "8px 12px" }}>🔄</button>
              </div>
              {/* 탭 콘텐츠 */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {sandboxTab === "preview" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    {/* 파일 목록 */}
                    {outputFiles.length > 0 && (
                      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${M.bd}`, background: M.bg2, flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {outputFiles.map(f => {
                          const icon = f.endsWith(".docx") ? "📝" : f.endsWith(".pptx") ? "📊" : f.endsWith(".html") ? "🌐" : f.endsWith(".pdf") ? "📕" : "📄";
                          const canPreview = /\.(html?|docx?|rtf|pptx?|txt|md|json|csv)$/i.test(f);
                          return (
                            <button key={f} onClick={() => {
                              if (canPreview && isTauri()) {
                                tauriInvoke("preview_file", { filename: f }).then(c => { setPreviewHtml(c); setPreviewFile(f); }).catch(() => {
                                  tauriInvoke("open_file", { filename: f }).catch(() => {});
                                });
                              } else if (isTauri()) {
                                tauriInvoke("open_file", { filename: f }).catch(() => {});
                              }
                            }}
                              style={{ background: M.bg3, border: `1px solid ${M.bd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: M.tx, fontSize: 14, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                              <span>{icon}</span>
                              <span>{f}</span>
                              {canPreview && <span style={{ color: "#86efac", fontSize: 15, fontWeight: 700 }}>미리보기</span>}
                              {!canPreview && <span style={{ color: M.or, fontSize: 15, fontWeight: 700 }}>열기</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* 미리보기 영역 */}
                    <div style={{ flex: 1, minHeight: 0 }}>
                      {previewHtml ? (
                        <iframe
                          srcDoc={previewHtml + `<script>
document.addEventListener('mouseup',function(){
  var sel=window.getSelection();
  var text=sel?sel.toString().trim():'';
  if(text.length>0){
    window.parent.postMessage({type:'element-click',tag:'SELECTION',text:text.substring(0,200)},'*');
  }
});
document.addEventListener('click',function(e){
  var sel=window.getSelection();
  if(sel&&sel.toString().trim().length>0)return;
  var el=e.target;
  window.parent.postMessage({type:'element-click',tag:el.tagName,text:el.textContent.trim().substring(0,200)},'*');
},true);
</script>`}
                          style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                          sandbox="allow-scripts"
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: M.tx3, fontSize: 15, flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 32 }}>📄</span>
                          <span>outputs/ 폴더에 파일이 없습니다</span>
                          <span style={{ fontSize: 14 }}>터미널에서 Claude Code로 파일을 생성하면 여기에 표시됩니다</span>
                          <span style={{ fontSize: 14, color: M.tx3 }}>docx·pptx·html·txt 등 클릭하면 앱 내 미리보기</span>
                          <button onClick={refreshSandboxFiles} style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 15, fontWeight: 600, marginTop: 8 }}>🔄 새로고침</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {sandboxTab === "code" && (
                  codeFiles.length > 0 ? (
                    <div style={{ padding: 12 }}>
                      {!selectedCodeName && codeFiles.map(f => (
                        <button key={f} onClick={async () => { try { const c = await tauriInvoke("read_project_file", { path: f }); setSelectedCode(c); setSelectedCodeName(f); } catch {} }}
                          style={{ display: "block", width: "100%", background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 14px", marginBottom: 4, cursor: "pointer", color: M.or, fontSize: 15, fontFamily: "monospace", textAlign: "left" }}>
                          📄 {f}
                        </button>
                      ))}
                      {selectedCodeName && (
                        <>
                          <button onClick={() => { setSelectedCodeName(""); setSelectedCode(""); }} style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 15, marginBottom: 8 }}>← 목록으로</button>
                          <pre style={{ background: M.bg, padding: 14, borderRadius: 8, fontSize: 15, fontFamily: "'JetBrains Mono',monospace", color: M.tx, lineHeight: 1.7, overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>{selectedCode}</pre>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: M.tx3, fontSize: 15, flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 32 }}>💻</span><span>코드 파일이 없습니다</span>
                      <button onClick={refreshSandboxFiles} style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 15, fontWeight: 600, marginTop: 8 }}>🔄 새로고침</button>
                    </div>
                  )
                )}
                {sandboxTab === "output" && (
                  <div style={{ padding: 12 }}>
                    {outputFiles.length > 0 ? outputFiles.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, background: M.bg2, borderRadius: 8, padding: "10px 14px", marginBottom: 4, border: `1px solid ${M.bd}` }}>
                        <span style={{ fontSize: 16 }}>{f.endsWith(".docx") ? "📝" : f.endsWith(".pptx") ? "📊" : f.endsWith(".html") ? "🌐" : "📄"}</span>
                        <span style={{ color: M.tx, fontSize: 15, fontFamily: "monospace", flex: 1 }}>{f}</span>
                        <button onClick={() => { if (isTauri()) tauriInvoke("open_file", { filename: f }).catch(() => {}); }}
                          style={{ background: M.or, color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>열기</button>
                      </div>
                    )) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: M.tx3, fontSize: 15, flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 32 }}>📂</span><span>outputs/ 폴더가 비어있습니다</span>
                        <button onClick={refreshSandboxFiles} style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 15, fontWeight: 600, marginTop: 8 }}>🔄 새로고침</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* 선택된 요소 또는 파일 표시 */}
              {(selectedElement || previewFile) && (
                <div style={{ background: M.or + "11", borderTop: `1px solid ${M.or}44`, padding: "6px 12px", fontSize: 15, color: M.or, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {previewFile && <span style={{ color: M.tx2 }}>📄 outputs/{previewFile}</span>}
                  {selectedElement && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>| 선택: "{selectedElement.text}"</span>}
                  {selectedElement && <button onClick={() => setSelectedElement(null)} style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", flexShrink: 0 }}>✕</button>}
                </div>
              )}
              {/* 수정 요청 입력 */}
              <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderTop: `1px solid ${M.bd}`, background: M.bg2, flexShrink: 0 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && chatInput.trim()) {
                      sendEditRequest();
                    }
                  }}
                  placeholder={selectedElement ? `"${selectedElement.text}" 어떻게 수정할까요?` : previewFile ? `${previewFile} 수정 요청...` : "수정 요청을 입력하세요..."}
                  style={{ flex: 1, background: M.bg, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "8px 12px", color: M.tx, fontSize: 15, outline: "none" }}
                />
                <button onClick={() => { if (previewFile) { tauriInvoke("preview_file", { filename: previewFile }).then(c => setPreviewHtml(c)).catch(() => {}); } else { refreshSandboxFiles(); } }}
                  style={{ background: M.bg3, color: M.tx3, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 15 }}>🔄</button>
                <button onClick={() => { if (chatInput.trim()) sendEditRequest(); }}
                  style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>전송</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 확인 모달 */}
      {confirmAction && (
        <>
          <div onClick={() => setConfirmAction(null)} style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 9998 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 16, padding: "28px 32px", zIndex: 9999, minWidth: 320, textAlign: "center", boxShadow: "0 20px 60px #000a" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.tx, marginBottom: 8 }}>프로젝트 초기화</div>
            <div style={{ fontSize: 15, color: M.tx2, marginBottom: 20, lineHeight: 1.6 }}>프로젝트 파일(Skills, Hooks, CLAUDE.md 등)을<br/>모두 삭제하고 초기 상태로 되돌립니다.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmAction(null)}
                style={{ background: M.bg3, color: M.tx2, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 15 }}>
                취소
              </button>
              <button onClick={() => {
                setConfirmAction(null);
                setNotice("초기화 중...");
                tauriInvoke("reset_project").then(msg => setNotice(msg)).catch(e => setNotice("실패: " + e));
              }}
                style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                초기화
              </button>
            </div>
          </div>
        </>
      )}

      {/* 알림 토스트 */}
      {notice && (
        <div onClick={() => setNotice("")}
          style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: M.bg2, border: `1px solid ${M.or}66`, borderRadius: 10, padding: "12px 24px", fontSize: 15, color: M.tx, zIndex: 9999, boxShadow: "0 8px 30px #000a", cursor: "pointer" }}>
          {notice}
        </div>
      )}

    </div>
  );
}
