import { useState, useEffect, useRef, lazy, Suspense, Fragment } from "react";
import usePersonalization from "./hooks/usePersonalization.js";
import useMissionProgress from "./hooks/useMissionProgress.js";
import DeptTaskInput from "./components/DeptTaskInput.jsx";
import MissionSlide from "./components/MissionSlide.jsx";
import GrowthChart from "./components/GrowthChart.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import {
  isTauri,
  legacyInvoke as tauriInvoke,
  resetProject as runtimeResetProject,
  copyToClipboard,
  readProjectFile,
  writeProjectFile,
  appendProjectFile,
  getCurrentUser,
  reportProgress,
  fetchMyTarget,
  sendToMyTerminal,
  clearMySession,
  setDemoMode,
} from "./lib/runtime.js";

const NativeTerminal = lazy(() => import("./NativeTerminal.jsx"));
const TtydEmbed = lazy(() => import("./components/TtydEmbed.jsx"));
// 모드별 터미널 컴포넌트: Tauri는 로컬 PTY, 웹은 ttyd iframe.
const Terminal = isTauri() ? NativeTerminal : TtydEmbed;

// ═══ MIRAE ASSET BRAND ═══
// 가독성 원칙 (WCAG AA 4.5:1 이상 목표)
//  - 다크 모드: bg = 짙은 네이비 → 모든 컬러 키는 '밝은' 톤
//  - 라이트 모드: bg = 흰색 → 모든 컬러 키는 '짙은' 톤
//  - 두 모드 모두 같은 키 이름이지만 색은 다르게 매핑돼서 어디 써도 visible 함
const DARK = {
  or: "#F58220", orL: "#F0B26B", orD: "#CB6015",
  // 다크 배경에 보이는 밝은 네이비/시안 (옛날엔 #043B72 였는데 다크 bg에 거의 안 보였음)
  bl: "#7E9FC3", blL: "#A8C0DA", blM: "#38BDF8", ac: "#22D3EE",
  bg: "#041828", bg2: "#061E30", bg3: "#021018",
  bd: "#0A3050", bd2: "#0E4060",
  tx: "#E5E8EC", tx2: "#B8C5D6", tx3: "#7E94B0",
  // 시맨틱 액센트
  gd: "#86efac", gdBg: "#86efac18",
  bad: "#fca5a5", badBg: "#fca5a533",
  wn: "#fbbf24", wnBg: "#fbbf2422",
  wnTx: "#1a1a1a",
};
const LIGHT = {
  // 라이트 배경에 보이는 짙은 톤. 형광/연회색 절대 금지.
  or: "#CB6015", orL: "#E07A2A", orD: "#A04A0D",
  bl: "#043B72", blL: "#1E3A5F", blM: "#0E5A8A", ac: "#0E7490",
  bg: "#F5F5F5", bg2: "#FFFFFF", bg3: "#EAEEF2",
  bd: "#C8D2DE", bd2: "#B0BCC8",
  tx: "#0F1729",   // 본문 — 거의 검정에 가까운 짙은 네이비
  tx2: "#1E3A5F",  // 보조 — 짙은 슬레이트 네이비
  tx3: "#475569",  // 약한 텍스트 — 슬레이트 그레이, 흰 배경에서 4.5:1 이상
  // 시맨틱 액센트 — 흰 배경에 충분한 대비를 가지는 진한 톤
  gd: "#047857", gdBg: "#04785718",
  bad: "#b91c1c", badBg: "#b91c1c18",
  wn: "#b45309", wnBg: "#b4530918",
  wnTx: "#ffffff",
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
    section: "1. 도입",
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
        <div style={{ marginTop: 8, fontSize: 14, color: M.tx3 }}>미래에셋생명 · 5시간 과정 · {VISIBLE_SLIDES.length} 슬라이드</div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "워크북 사용법 — 화면 조작",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>
          이 <span style={{ color: M.or }}>워크북</span> 어떻게 조작하나요?
        </div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center", marginBottom: 4 }}>
          오른쪽 상단 버튼으로 화면을 조절합니다. 모든 슬라이드에서 공통.
        </div>

        {/* 상단 툴바 시각화 */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: M.or, marginBottom: 10, letterSpacing: 1 }}>상단 툴바</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: M.bg3, borderRadius: 10, padding: "10px 16px",
            border: `1px solid ${M.bd}`, fontSize: 14,
          }}>
            <span style={{ flex: 1, color: M.tx2, fontSize: 13, fontWeight: 600 }}>슬라이드 제목</span>
            <span style={{ background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 6, padding: "4px 10px", fontSize: 16 }}>⛶</span>
            <span style={{ background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 6, padding: "4px 10px", fontSize: 16 }}>☀️</span>
            <span style={{ color: M.tx3, fontFamily: "var(--workbook-mono)", fontSize: 13 }}>2 / 89</span>
            <span style={{ background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "4px 14px", fontSize: 16 }}>←</span>
            <span style={{ background: M.or, color: "#fff", borderRadius: 8, padding: "4px 14px", fontSize: 16 }}>→</span>
          </div>
        </div>

        {/* 5개 컨트롤 설명 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { icon: "⛶", label: "전체화면", desc: "F5 키 또는 클릭\n프레젠테이션처럼 풀스크린", color: M.ac },
            { icon: "☀️ / 🌙", label: "라이트 / 다크", desc: "눈이 편한 모드로 전환\n다크가 기본", color: M.or },
            { icon: "← →", label: "페이지 이동", desc: "이전/다음 슬라이드\n키보드 화살표도 가능", color: M.blM },
          ].map(b => (
            <div key={b.label} style={{ ...card({ borderLeft: `3px solid ${b.color}` }), padding: "12px 14px" }}>
              <div style={{ fontSize: 22, marginBottom: 6, textAlign: "center" }}>{b.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: b.color, textAlign: "center", marginBottom: 6 }}>{b.label}</div>
              <div style={{ fontSize: 12, color: M.tx3, lineHeight: 1.6, whiteSpace: "pre-line", textAlign: "center" }}>{b.desc}</div>
            </div>
          ))}
        </div>

        {/* 줌 + 강의 모드 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...card({ borderLeft: `3px solid ${M.gd}` }), padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M.gd} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 800, color: M.gd }}>확대 / 축소 (7단계)</span>
            </div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
              슬라이드 글씨가 작으면 <strong style={{ color: M.tx }}>+</strong> 버튼으로 확대.<br/>
              슬라이드 아래 줌 바에서 조절. <strong style={{ color: M.tx }}>초기화</strong> 로 원래 크기.
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `3px solid ${M.bad}` }), padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: M.bad }}>강의 모드</span>
            </div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
              강사가 <strong style={{ color: M.tx }}>진행을 통제</strong>할 때 표시됩니다.<br/>
              이 모드에서는 슬라이드가 자동으로 넘어갑니다.<br/>
              직접 이동은 잠깁니다.
            </div>
          </div>
        </div>

        <div style={{ ...card({ background: M.bg3 }), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: M.tx3 }}>
            미션 슬라이드에서는 <strong style={{ color: M.or }}>왼쪽 안내 패널</strong> + <strong style={{ color: M.gd }}>오른쪽 터미널</strong> 로 화면이 나뉩니다. 자세한 건 실습 때 안내.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "자연어 → 관념화 → 프로그램",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>자연어로 <span style={{ color: M.or }}>생각</span>하면 <span style={{ color: M.gd }}>프로그램</span>이 됩니다</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { step: "1", title: "관념화", desc: "\"매달 경쟁사 3곳 실적 비교해서 보고서 만드는 게 필요해\"", icon: "💭", color: M.bl, sub: "복잡한 업무를 자연어로 정리" },
            { step: "2", title: "지시", desc: "\"경쟁사 분석 보고서 만들어줘. 삼성·한화·교보 비교표 포함해서\"", icon: "💬", color: M.or, sub: "AI에게 한글로 요청" },
            { step: "3", title: "구현", desc: "AI가 코드를 작성하고 실행 → 완성된 보고서 파일 생성", icon: "⚡", color: "#059669", sub: "바이브코딩: 코드를 몰라도 프로그램이 만들어짐" },
            { step: "4", title: "고도화", desc: "반복되는 절차를 Skill로 저장 → 다음엔 한 마디로 동일 품질", icon: "🎯", color: M.ac, sub: "한 번 만든 노하우가 영구 자산이 됨" },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1, background: M.bg2, borderRadius: 12, padding: "12px 18px", border: `1px solid ${M.bd}` }}>
                <div style={{ fontWeight: 800, color: s.color, fontSize: 16 }}>{s.title}</div>
                <div style={{ color: M.tx, fontSize: 15, marginTop: 4, fontStyle: "italic" }}>{s.desc}</div>
                <div style={{ color: M.tx3, fontSize: 13, marginTop: 4 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "LLM이 바꾼 업무 방식",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>LLM이 바꾼 <span style={{ color: M.or }}>업무 방식</span></div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "16px 20px" }}>
          <div style={{ fontSize: 17, color: M.tx, lineHeight: 2 }}>
            과거: 복잡한 작업 = <span style={{ color: M.bad }}>전문가에게 의뢰</span>하거나 <span style={{ color: M.bad }}>직접 배워서</span> 해야 했음<br/>
            현재: 복잡한 작업 = <strong style={{ color: M.or }}>자연어로 관념화</strong>해서 AI에게 지시하면 끝
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.bad, fontWeight: 700, marginBottom: 8 }}>과거의 보고서 작업</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>자료 검색 2시간<br/>Word 작성 1시간<br/>서식·디자인 1시간<br/><strong style={{ color: M.bad }}>= 4시간 + 전문 스킬</strong></div>
          </div>
          <div style={{ fontSize: 32, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.gd, fontWeight: 700, marginBottom: 8 }}>지금의 보고서 작업</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>"퇴직연금 보고서 만들어줘"<br/>AI가 알아서 코드 작성·실행<br/>완성된 .docx 파일 받기<br/><strong style={{ color: M.gd }}>= 10분 + 자연어만</strong></div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "실제 사례: 왜 주니어 개발자를 안 뽑을까",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>실제 사례: 왜 <span style={{ color: M.or }}>주니어 개발자</span>를 안 뽑을까</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>개발업계에서 일어나고 있는 일</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.9 }}>
            2024년부터 IT 업계에서 <strong style={{ color: M.tx }}>주니어 개발자 채용이 급감</strong>하고 있습니다.<br/>
            시니어 1명 + AI가 주니어 3~4명 분의 코드를 만들어내기 때문입니다.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "stretch" }}>
          <div style={{ ...card(), borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.bad, fontWeight: 700, marginBottom: 10 }}>과거의 개발팀</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
              시니어가 <strong style={{ color: M.tx }}>설계</strong><br/>
              주니어가 <strong style={{ color: M.tx }}>구현</strong><br/>
              시간·리소스 한계로<br/>
              사람을 더 뽑아야 했음
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: M.bad, fontWeight: 700 }}>시니어 1 + 주니어 3~4명</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 32, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.gd, fontWeight: 700, marginBottom: 10 }}>지금의 개발팀</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
              시니어가 <strong style={{ color: M.tx }}>설계</strong><br/>
              AI가 <strong style={{ color: M.or }}>구현 (바이브코딩)</strong><br/>
              경험과 노하우로 검증하고<br/>
              Skill로 품질을 고정
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: M.gd, fontWeight: 700 }}>시니어 1 + AI</div>
          </div>
        </div>
        <div style={{ ...card({ background: M.bg3 }), textAlign: "center", padding: "10px 16px" }}>
          <div style={{ fontSize: 15, color: M.tx2 }}>핵심은 <strong style={{ color: M.or }}>구현 능력</strong>이 아니라 <strong style={{ color: M.or }}>설계 능력</strong>과 <strong style={{ color: M.or }}>경험에서 오는 판단력</strong>입니다</div>
        </div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "우리는 어떤 방향으로 가야 하나",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>우리는 어떤 <span style={{ color: M.or }}>방향</span>으로 가야 하나</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.9 }}>
            시니어 개발자가 강한 이유는 코딩 실력이 아닙니다.<br/>
            <strong style={{ color: M.tx }}>주니어 시절부터 쌓아온 실패 경험, 도메인 지식, "이건 이렇게 해야 해"라는 판단력</strong>이<br/>
            설계와 의사결정을 가능하게 합니다.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card(), borderLeft: `4px solid #fca5a5`, padding: "14px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: M.bad, marginBottom: 8 }}>AI가 대체하는 것</div>
            {["코드 작성 (구현)", "자료 검색·정리", "반복적인 문서 작업", "형식·서식 맞추기"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 15, color: M.tx2 }}>
                <span style={{ color: M.bad }}>×</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ ...card(), borderLeft: `4px solid #86efac`, padding: "14px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: M.gd, marginBottom: 8 }}>사람만 할 수 있는 것</div>
            {["\"뭘 만들어야 하지?\" (기획·설계)", "\"이건 이렇게 해야 해\" (경험 판단)", "\"이 결과가 맞나?\" (품질 검증)", "\"팀에게 어떻게 적용하지?\" (PM)"].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 15, color: M.tx2 }}>
                <span style={{ color: M.gd }}>✓</span><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), textAlign: "center", padding: "14px 18px" }}>
          <div style={{ fontSize: 17, color: M.or, fontWeight: 700, lineHeight: 1.7 }}>
            여러분의 업무 경험과 도메인 지식이 곧 설계 능력입니다.<br/>
            오늘 배우는 것은 그 능력을 AI로 <strong>실행</strong>하는 방법입니다.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "오늘의 목표",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>오늘의 <span style={{ color: M.or }}>목표</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>5시간 뒤, 여러분은 <strong style={{ color: M.or }}>나만의 업무 자동화 프로그램</strong>을 갖게 됩니다</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "16px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 12 }}>완성할 프로그램의 모습</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🗺️", label: "설계", desc: "Plan 모드로 기능을 정의하고 검토", color: M.bl },
              { icon: "📋", label: "규칙서", desc: "CLAUDE.md로 AI의 기본 행동을 설정", color: M.or },
              { icon: "🎯", label: "업무 매뉴얼", desc: "Skill로 반복 업무의 절차를 자동화", color: "#059669" },
              { icon: "⌨️", label: "단축 명령어", desc: "Command로 복잡한 워크플로우를 한 마디로", color: M.ac },
              { icon: "⚡", label: "안전장치", desc: "Hook으로 개인정보 등 보안 자동 검사", color: M.wn },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "center", background: M.bg3, borderRadius: 8, padding: "10px 14px" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontWeight: 700, color: item.color, fontSize: 15, minWidth: 90 }}>{item.label}</span>
                <span style={{ color: M.tx2, fontSize: 15 }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.or, fontWeight: 700 }}>먼저 완성된 모습을 시연으로 보여드리겠습니다</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "좋은 프롬프트 쓰는 법",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>좋은 프롬프트 <span style={{ color: M.or }}>쓰는 법</span></div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center" }}>이 6가지를 챙기면 AI가 한 번에 원하는 결과를 줍니다</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { n: "1", t: "주제 + 맥락", d: "무엇을, 왜", ex: "퇴직연금 시장 → 전략회의용", color: M.ac },
            { n: "2", t: "형식 + 구조", d: "파일 형태, 섹션", ex: "Word 6섹션, 표 2개", color: M.or },
            { n: "3", t: "단계별 분리", d: "한 번에 다 말고 나눠서", ex: "먼저 목차 → 2장 작성", color: M.blM },
            { n: "4", t: "예시 제공", d: "원하는 형태 보여주기", ex: "이런 형식으로: (붙여넣기)", color: "#059669" },
            { n: "5", t: "역할 부여", d: "AI 에게 관점 지정", ex: "경영기획팀 과장으로 써줘", color: M.wn },
            { n: "6", t: "제한 사항", d: "하지 말아야 할 것", ex: "3페이지, 개인정보 빼고", color: "#dc2626" },
          ].map(p => (
            <div key={p.n} style={{ ...card({ borderLeft: `3px solid ${p.color}` }), padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ background: p.color, color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{p.n}</span>
                <span style={{ fontWeight: 800, color: p.color, fontSize: 14 }}>{p.t}</span>
              </div>
              <div style={{ color: M.tx3, fontSize: 12 }}>{p.d}</div>
              <div style={{ color: M.tx2, fontSize: 11, marginTop: 4, fontFamily: "var(--workbook-mono)" }}>{p.ex}</div>
            </div>
          ))}
        </div>

        {/* Before → After 비교 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "stretch" }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.bad}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: M.bad, marginBottom: 8, letterSpacing: 1 }}>BEFORE</div>
            <div style={{ fontSize: 18, color: M.tx, fontFamily: "var(--workbook-mono)", lineHeight: 1.6 }}>"보고서 써줘"</div>
            <div style={{ fontSize: 12, color: M.tx3, marginTop: 8 }}>주제·형식·구조·제한 전부 빠짐<br/>AI가 추측 → 엉뚱한 결과</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.gd}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: M.gd, marginBottom: 8, letterSpacing: 1 }}>AFTER</div>
            <div style={{ fontSize: 13, color: M.tx, lineHeight: 1.8 }}>
              "2025 퇴직연금 시장 현황을<br/>
              금감원·보험연구원 데이터로 조사.<br/>
              6개 섹션 Word 보고서,<br/>
              outputs/ 폴더에 저장. 3페이지."
            </div>
            <div style={{ fontSize: 12, color: M.tx3, marginTop: 8 }}>6가지 원칙 충족 → 한 번에 OK</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
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
    section: "2. 개념 설명 및 시연",
    title: "시연: Step 2 - AI가 코드 생성",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 2: <span style={{ color: M.or }}>바이브코딩</span></div>
        {conceptCard("🤖", "코드를 몰라도 프로그램이 만들어집니다", "여러분이 한 일은 자연어로 지시한 것뿐. 세부 구현은 AI가 알아서 합니다. 이것이 바이브코딩입니다.", M.or)}
        <div style={{ ...card() }}>
          <div style={{ fontSize: 16, color: M.tx3, marginBottom: 12 }}>AI가 알아서 처리하는 세부 구현</div>
          {["python-docx 라이브러리 설치", "보고서 구조에 맞는 코드 작성", "미래에셋 색상 (#F58220) 적용", "outputs/ 폴더에 파일 저장 코드 작성"].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 3 ? `1px solid ${M.bd}` : "none" }}>
              <span style={{ color: M.gd }}>✓</span>
              <span style={{ fontSize: 17, color: M.tx }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ ...card({ background: M.bg3 }), padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: M.tx2 }}>이 세부 구현을 Skill에 녹이면 → 다음부터 <strong style={{ color: M.or }}>한 마디</strong>로 같은 품질이 재현됩니다</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "시연: Step 3 - 프로그램 실행",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Step 3: <span style={{ color: M.or }}>프로그램 실행</span></div>
        {conceptCard("▶️", "코드가 자동 실행되어 파일이 생성됩니다", "AI가 코드를 작성한 후 바로 실행합니다. 기다리기만 하면 됩니다.", "#059669")}
        <div style={{ background: M.bg3, borderRadius: 12, padding: 20, fontFamily: "var(--workbook-mono)", fontSize: 15, lineHeight: 2 }}>
          <div style={{ color: M.tx3 }}>AI가 실행하는 과정:</div>
          <div style={{ color: M.ac }}>라이브러리 설치 중...</div>
          <div style={{ color: M.tx }}>보고서 생성 중...</div>
          <div style={{ color: M.gd }}>✓ 완료! outputs/2025-03-14_보고서_퇴직연금.docx</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
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
    section: "2. 개념 설명 및 시연",
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
    section: "1. 도입",
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
    section: "1. 도입",
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
    section: "1. 도입",
    title: "실제 사례: 보고서 작업",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx }}>실제 사례: <span style={{ color: M.or }}>보고서 작업</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, width: "100%", alignItems: "center" }}>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>기존 방식</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: M.bad }}>4시간</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>검색 → 정리 → Word → 서식</div>
          </div>
          <div style={{ fontSize: 40, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ ...card(), textAlign: "center", borderLeft: `4px solid #86efac` }}>
            <div style={{ fontSize: 14, color: M.tx3, marginBottom: 8 }}>Claude Code</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: M.gd }}>10분</div>
            <div style={{ color: M.tx2, marginTop: 8, fontSize: 15 }}>한 줄 입력 → 완성!</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: M.tx2 }}>상황: 내일 전략회의를 위한 퇴직연금 시장 자료가 필요</div>
      </div>
    ),
  },
  {
    section: "1. 도입",
    title: "실제 사례: 그 외 업무들",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>보고서만이 <span style={{ color: M.or }}>아닙니다</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { task: "PPT 제작", before: "2일", after: "20분", detail: "\"분기 실적 PPT 8장\" → 자동 생성", icon: "📊" },
            { task: "시장 조사", before: "반나절", after: "5분", detail: "금감원·보험연구원 자동 수집 + 출처 정리", icon: "🔍" },
            { task: "경쟁사 분석", before: "3시간", after: "10분", detail: "삼성·한화·교보 비교표 자동 생성", icon: "📈" },
            { task: "컴플라이언스 점검", before: "2시간", after: "3분", detail: "4대 법규 기준 자동 검토 + 수정안", icon: "📋" },
          ].map(c => (
            <div key={c.task} style={{ ...card(), borderLeft: `4px solid ${M.or}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: M.tx }}>{c.icon} {c.task}</span>
                <span style={{ fontSize: 14, color: M.tx3 }}><span style={{ color: M.bad }}>{c.before}</span> → <span style={{ color: M.gd, fontWeight: 700 }}>{c.after}</span></span>
              </div>
              <div style={{ fontSize: 14, color: M.tx2 }}>{c.detail}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>반복적이고 구조화된 업무라면 <strong style={{ color: M.or }}>거의 모든 것</strong>을 자동화할 수 있습니다</div>
      </div>
    ),
  },
  // ── 와닿는 실제 사례 — 다른 회사들이 얻은 효과 ──
  {
    section: "1. 도입",
    title: "실제 사례: 회사들이 얻은 효과",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>다른 회사들이 <span style={{ color: M.or }}>실제로 얻은 효과</span></div>
          <div style={{ fontSize: 15, color: M.tx2, marginTop: 6 }}>Anthropic 공식 사례 (2025-2026)</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            {
              org: "Anthropic 마케팅팀",
              metric: "2.5시간 → 30분",
              desc: "고객 사례 보고서 작성 시간 단축. 주당 10시간 절약.",
              color: M.or,
            },
            {
              org: "ServiceNow (직원 29,000명)",
              metric: "준비 시간 95% 단축",
              desc: "영업 미팅 준비 자료를 Claude Code가 자동 생성.",
              color: "#059669",
            },
            {
              org: "Block (결제 기업)",
              metric: "운영 효율 40% ↑",
              desc: "결제·상점 데이터를 Claude로 실시간 문서화.",
              color: M.bl,
            },
            {
              org: "DevOps 엔지니어 (Medium)",
              metric: "5초 → 0.5초",
              desc: "Redis CPU 급증 원인 5분 만에 분석. 응답 시간 10배 개선.",
              color: M.ac,
            },
            {
              org: "비개발자 마케터 (Austin Lau)",
              metric: "30분 → 30초",
              desc: "Figma 광고 시안 생성 플러그인을 직접 코드 없이 제작.",
              color: M.blM,
            },
            {
              org: "엔터프라이즈 평균",
              metric: "PR 처리 30% 빠름",
              desc: "코드 리뷰·디버깅·문서화 자동화. 엔지니어 생산성 30~60% 향상.",
              color: M.wn,
            },
          ].map((c) => (
            <div key={c.org} style={{ ...card({ borderLeft: `4px solid ${c.color}` }), padding: "12px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.org}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: M.tx, marginBottom: 4 }}>{c.metric}</div>
              <div style={{ fontSize: 12, color: M.tx3, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: M.or }}>
            출처: Anthropic 공식 고객 사례 · CIO 매거진 · Medium · PyTorchKR · DevOcean
          </div>
        </div>
      </div>
    ),
  },

  // ── 사례 깊게 보기 1: Anthropic 마케팅팀 ──
  {
    section: "1. 도입",
    title: "사례 1: Anthropic 마케팅팀 — 2.5시간 → 30분",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>사례 1. <span style={{ color: M.or }}>Anthropic 마케팅팀</span></div>
          <div style={{ fontSize: 13, color: M.tx2, marginTop: 4 }}>고객 케이스 스터디 작성 · 주당 10시간 절약 · 출처: Anthropic 공식 블로그</div>
        </div>

        <div style={{ ...card({ background: M.bg3 }), padding: "8px 14px" }}>
          <div style={{ fontSize: 12, color: M.tx3 }}><strong style={{ color: M.or }}>업무</strong>: 고객 인터뷰를 토대로 1편의 케이스 스터디(서사 구조 + 인용 + 결과 수치)를 작성</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Before */}
          <div style={{ ...card({ borderLeft: "4px solid #94a3b8" }), padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", marginBottom: 4 }}>이전 (Claude Code 도입 전)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: M.tx, marginBottom: 6 }}>2시간 30분</div>
            <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
              1. 인터뷰 녹음 받아쓰기 (30분)<br/>
              2. 핵심 인용·수치 추출 (30분)<br/>
              3. 서사 구조 잡기 (30분)<br/>
              4. 1차 드래프트 작성 (45분)<br/>
              5. 검토 + 수정 (15분)
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>↳ 한 사람이 주당 1~2건이 한계</div>
          </div>

          {/* After */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "10px 12px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: M.or, marginBottom: 4 }}>지금 (Claude Code)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: M.tx, marginBottom: 6 }}>30분</div>
            <div style={{ fontSize: 10.5, color: M.tx3, lineHeight: 1.5, fontFamily: "var(--workbook-mono)" }}>
              <span style={{ color: M.or }}>{`>`}</span> 인터뷰 녹취록 (interview.txt) 을 읽고<br/>
              &nbsp;&nbsp;case-study Skill 절차로 케이스<br/>
              &nbsp;&nbsp;스터디 작성해줘<br/><br/>
              <span style={{ color: M.gd }}>● Read</span> interview.txt (12k)<br/>
              <span style={{ color: M.gd }}>● Skill</span> case-study 적용<br/>
              <span style={{ color: M.gd }}>● Write</span> outputs/case-acme.md<br/>
              <span style={{ color: M.or }}>✓</span> 4섹션 + 인용 6개 + 결과 수치
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: M.or, fontWeight: 700 }}>↳ 한 사람이 주당 10건+ 가능</div>
          </div>
        </div>

        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), padding: "8px 14px" }}>
          <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.6 }}>
            <strong style={{ color: M.or }}>핵심:</strong> 마케팅팀은 코드를 직접 작성하지 않았습니다. <strong>case-study 라는 Skill 한 개만 만들어 두고</strong>, 이후로는 인터뷰 텍스트만 던지면 매번 동일한 품질의 케이스 스터디가 나옵니다. 우리가 오늘 Part 3에서 하는 것과 똑같은 패턴입니다.
          </div>
        </div>
      </div>
    ),
  },

  // ── 사례 깊게 보기 2: ServiceNow 영업팀 + Austin Lau ──
  {
    section: "1. 도입",
    title: "사례 2: 영업 + 비개발자 마케터 — 95% 시간 절약",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>사례 2. <span style={{ color: M.or }}>다른 회사들도 같은 패턴</span></div>
          <div style={{ fontSize: 12, color: M.tx2, marginTop: 4 }}>출처: Anthropic / CIO 매거진 / Medium 공식 사례</div>
        </div>

        {/* ServiceNow */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.bl}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.bl, marginBottom: 4 }}>ServiceNow 영업팀 (직원 29,000명)</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <strong style={{ color: M.tx2 }}>업무</strong>: 고객 미팅 전 사전 리서치 (회사 배경, 최근 뉴스, 의사결정자 프로필, 계정 히스토리 종합)<br/>
            <span style={{ color: "#94a3b8" }}>이전</span>: 영업 담당자가 한 주의 대부분을 데이터 입력, CRM 업데이트, 콜 준비에 사용. 한 미팅 준비에 1~2시간.<br/>
            <span style={{ color: M.or }}>지금</span>: <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/prep-meeting [회사명]</code> 한 줄. Claude가 LinkedIn, 회사 홈, 뉴스, CRM을 동시에 조회하고 1페이지 브리프 생성. <strong style={{ color: M.bl }}>5분</strong>.
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: M.bl }}>→ 준비 시간 <strong>95% 단축</strong>. 영업 사원의 82%가 "고객 관계 형성에 더 많은 시간을 쓰게 됐다"고 응답.</div>
        </div>

        {/* Austin Lau */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.blM, marginBottom: 4 }}>Austin Lau (Growth Marketer, 코드 경력 0)</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <strong style={{ color: M.tx2 }}>업무</strong>: 광고 시안 30개 만들기 (제목·부제·본문 텍스트 변형)<br/>
            <span style={{ color: "#94a3b8" }}>이전</span>: Figma에서 디자이너에게 요청 → 30분 대기 → 수정 → 다시 요청. 배치 한 번에 평균 30분.<br/>
            <span style={{ color: M.or }}>지금</span>: Austin이 <strong>Claude Code로 직접 Figma 플러그인을 작성</strong>. 버튼 한 번 누르면 30개 변형이 자동 생성. <strong style={{ color: M.blM }}>30초</strong>.
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: M.blM }}>→ 한 배치당 60배 빠름. <strong>코드를 모르는 마케터가 자기 손으로 자동화 도구를 만든 사례</strong>.</div>
        </div>

        {/* DevOps */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.ac}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.ac, marginBottom: 4 }}>DevOps 엔지니어 (Medium 공개 사례)</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <strong style={{ color: M.tx2 }}>업무</strong>: Redis CPU 급증 원인 분석<br/>
            <span style={{ color: "#94a3b8" }}>이전</span>: Grafana 대시보드 뒤지기 → 로그 grep → 쿼리 분석 → 가설 → 검증. 평균 <strong>2~3시간</strong>.<br/>
            <span style={{ color: M.or }}>지금</span>: 로그 파일 + 메트릭 dump를 Claude Code에 던지고 <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>"이 Redis가 왜 CPU 99%인지 찾아줘"</code>. 5분 안에 원인 + 수정안 + 패치 코드까지.
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: M.ac }}>→ 응답 시간 <strong>5초 → 0.5초</strong>. 사고 대응 시간 30배 단축.</div>
        </div>

        <div style={{ ...card({ background: M.bg3 }), padding: "6px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: M.tx2 }}>공통 패턴: <strong style={{ color: M.or }}>반복되는 업무를 Skill·Command로 한 번 정의</strong> → 다음부터 한 줄 호출. 그게 전부.</div>
        </div>
      </div>
    ),
  },

  // ── 보험업 비유: 미래에셋생명 직원의 하루 ──
  {
    section: "1. 도입",
    title: "보험업으로 비유하면",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>만약 <span style={{ color: M.or }}>미래에셋생명 직원</span>이 Claude Code를 쓴다면</div>
          <div style={{ fontSize: 12, color: M.tx2, marginTop: 4 }}>다른 회사 사례를 우리 일에 그대로 옮겨 봅니다</div>
        </div>

        {/* 시나리오 1 — 분기 시장 분석 보고서 */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.or, marginBottom: 4 }}>① 분기 퇴직연금 시장 분석 보고서</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <span style={{ color: "#94a3b8" }}>이전</span>: 금감원·보험연구원 사이트 일일이 다운로드 → 엑셀 정리 → 워드 작성 → 차트 PPT. <strong>반나절~하루.</strong><br/>
            <span style={{ color: M.or }}>지금</span>: <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/quarterly-report 퇴직연금</code> 한 줄. Claude가 자료 수집 → 표 정리 → 본문 작성 → docx 저장. <strong style={{ color: M.or }}>5분.</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: M.or }}>↳ Anthropic 마케팅팀의 케이스 스터디 자동화와 같은 패턴</div>
        </div>

        {/* 시나리오 2 — 약관 검토 */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.bl}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.bl, marginBottom: 4 }}>② 신상품 약관 컴플라이언스 검토</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <span style={{ color: "#94a3b8" }}>이전</span>: 약관 PDF 한 줄씩 읽으며 금소법·보험업법 위반 가능 표현 체크. 한 건당 <strong>2~3시간.</strong><br/>
            <span style={{ color: M.or }}>지금</span>: <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/compliance-check 약관.pdf</code>. compliance-check Skill이 정의한 기준으로 자동 스캔, 위반 의심 항목·근거 조항·수정안 제시. <strong style={{ color: M.bl }}>10분.</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: M.bl }}>↳ Hook으로 PII까지 자동 차단 (2.8 절)</div>
        </div>

        {/* 시나리오 3 — 고객 상담 follow-up */}
        <div style={{ ...card({ borderLeft: `4px solid #059669` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#059669", marginBottom: 4 }}>③ FC 미팅 사전 준비 + 사후 follow-up</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <span style={{ color: "#94a3b8" }}>이전</span>: 고객 정보·과거 가입 내역·최근 시장 이슈 일일이 검색, 메모 작성. 미팅 후 follow-up 메일 직접 작성. 미팅 한 건당 <strong>1시간.</strong><br/>
            <span style={{ color: M.or }}>지금</span>: <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/prep-meeting [고객명]</code> → 1페이지 브리프 자동 생성. 미팅 후 <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/follow-up</code> → 메모 기반 메일 초안. <strong style={{ color: "#059669" }}>합쳐서 5분.</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#059669" }}>↳ ServiceNow 영업 자동화의 95% 시간 단축과 같은 원리</div>
        </div>

        {/* 시나리오 4 — Excel 데이터 분석 */}
        <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: M.blM, marginBottom: 4 }}>④ 월별 가입 현황 데이터 분석</div>
          <div style={{ fontSize: 11.5, color: M.tx3, lineHeight: 1.55 }}>
            <span style={{ color: "#94a3b8" }}>이전</span>: Excel에서 피벗 → 차트 → 매월 같은 작업 반복. 한 사람이 매월 <strong>3~4시간.</strong><br/>
            <span style={{ color: M.or }}>지금</span>: 매월 raw 데이터 csv를 폴더에 떨어뜨리고 <code style={{ background: M.bg3, padding: "0 4px", borderRadius: 3, color: M.or }}>/monthly-summary</code> 한 줄. 그래프 + 전월 대비 분석 + 보고서까지. <strong style={{ color: M.blM }}>2분.</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: M.blM }}>↳ 비개발자 마케터 Austin Lau의 Figma 자동화와 같은 패턴 (코드 몰라도 자기 손으로 만듦)</div>
        </div>

        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), padding: "6px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 11.5, color: M.tx2 }}>
            <strong style={{ color: M.or }}>핵심:</strong> 여러분의 부서마다 위와 같은 "매달 똑같이 반복하는 업무"가 분명히 있습니다. 그게 오늘의 자동화 후보입니다.
          </div>
        </div>
      </div>
    ),
  },

  // ── LLM 답변 차이: 같은 질문, 다른 결과 ──
  {
    section: "1. 도입",
    title: "같은 질문, 다른 답변",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>같은 질문에 <span style={{ color: M.or }}>이렇게 다른 답</span>이 나옵니다</div>
          <div style={{ fontSize: 14, color: M.tx2, marginTop: 4 }}>"퇴직연금 시장 분석 보고서를 만들어줘"</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* 일반 챗봇 */}
          <div style={{ ...card({ borderLeft: "4px solid #94a3b8" }), padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>일반 챗봇 (예: 무료 ChatGPT)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: M.tx2, marginBottom: 8 }}>📝 텍스트로 안내만</div>
            <div style={{ background: M.bg3, borderRadius: 6, padding: "8px 10px", fontSize: 11.5, color: M.tx3, lineHeight: 1.55, fontFamily: "var(--workbook-font)" }}>
              퇴직연금 시장 분석 보고서를 작성하시려면 다음 항목을 고려해 보세요:<br/><br/>
              1. 시장 규모 및 성장률<br/>
              2. 주요 사업자별 점유율<br/>
              3. 상품 트렌드 (DC/DB/IRP)<br/>
              4. 규제 변화<br/>
              5. 향후 전망<br/><br/>
              필요하시면 보고서 템플릿을 만들어 드릴 수 있습니다. 어떤 형식을 원하시나요?
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>👉 사람이 다시 자료 찾고, 워드에 옮겨 적고, 차트 만들어야 함 (반나절 ~ 하루)</div>
          </div>

          {/* Claude Code */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: M.or, marginBottom: 4 }}>Claude Code (에이전트)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: M.tx2, marginBottom: 8 }}>🤖 즉시 실행 + 결과물 생성</div>
            <div style={{ background: M.bg3, borderRadius: 6, padding: "8px 10px", fontSize: 11, color: M.tx3, lineHeight: 1.5, fontFamily: "var(--workbook-mono)" }}>
              <span style={{ color: M.gd }}>● Read</span> CLAUDE.md (3.2k)<br/>
              <span style={{ color: M.gd }}>● Skill</span> ai-plan-report 적용<br/>
              <span style={{ color: M.gd }}>● WebFetch</span> 금감원 통계 (2026-Q1)<br/>
              <span style={{ color: M.gd }}>● WebFetch</span> 보험연구원 보고서<br/>
              <span style={{ color: M.gd }}>● Write</span> outputs/퇴직연금_분석.md<br/>
              <span style={{ color: M.gd }}>● Bash</span> python make_chart.py<br/>
              <span style={{ color: M.gd }}>● Write</span> outputs/퇴직연금_분석.docx<br/>
              <span style={{ color: M.or }}>✓</span> 완료. 12페이지 .docx 생성<br/>
              <span style={{ color: M.tx2 }}>  - 시장 규모 18.9조원 (+7.2%)</span><br/>
              <span style={{ color: M.tx2 }}>  - 차트 4종 포함</span><br/>
              <span style={{ color: M.tx2 }}>  - 출처 각주 12개</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: M.or, fontWeight: 700 }}>👉 outputs/ 폴더에 완성된 파일 (3분)</div>
          </div>
        </div>

        <div style={{ ...card({ background: M.bg3 }), padding: "8px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: M.tx2 }}>
            <strong style={{ color: M.or }}>핵심 차이:</strong> 챗봇은 "이렇게 만들어 보세요" 라고 말한다 · 에이전트는 직접 만들어서 파일로 건네준다.
          </div>
        </div>
      </div>
    ),
  },

  // 터미널 슬라이드
  /* 오늘 배울 도구 한눈에 — 삭제 (5가지 핵심 도구 슬라이드와 중복) */
  {
    section: "2. 개념 설명 및 시연",
    title: "설치하기",
    mode: "tauri",  // 웹 모드: 서버에 이미 설치되어 있으므로 슬라이드 자체를 숨김
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
    section: "2. 개념 설명 및 시연",
    title: "첫 실행",
    mode: "tauri",  // 웹 모드: 다음 "Claude 첫 로그인" 슬라이드가 동일 내용을 다룸
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>첫 실행</div>
        <div style={{ ...card() }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: M.or, marginBottom: 16 }}>터미널에서 아래 명령어 입력</div>
          <Cmd cmd="claude" desc="Claude Code 시작" />
          <div style={{ marginTop: 16, fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            실행하면 인증 화면이 나타납니다.<br/>
            API 키를 입력하면 준비 완료!
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
  // ─── 터미널 개념 설명 (생소한 사용자를 위해) ───
  {
    section: "2. 개념 설명 및 시연",
    title: "터미널이란 무엇인가",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 8, padding: "5px 18px", fontSize: 13, fontWeight: 700, color: M.or, letterSpacing: 2, display: "inline-block", marginBottom: 10 }}>TERMINAL 101</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>터미널이란 <span style={{ color: M.or }}>무엇인가요?</span></div>
          <div style={{ fontSize: 15, color: M.tx2, marginTop: 8, maxWidth: 700, margin: "8px auto 0", lineHeight: 1.6 }}>
            <strong style={{ color: M.or }}>마우스 대신 글로 컴퓨터에게 지시하는 창</strong>입니다. 처음엔 낯설지만, AI 코딩에선 가장 효율적인 입력 방식이에요.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: M.tx3, marginBottom: 8 }}>익숙한 GUI 방식</div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.8 }}>
              📁 폴더 더블클릭<br/>
              🖱️ 메뉴에서 "다른 이름으로 저장"<br/>
              ✂️ 드래그로 파일 이동<br/>
              <span style={{ color: M.tx3 }}>→ 한 번에 한 가지, 손이 많이 감</span>
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: M.or, marginBottom: 8 }}>터미널(CLI) 방식</div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.8, fontFamily: "var(--workbook-mono)" }}>
              <span style={{ color: M.or }}>cd ~/projects</span><br/>
              <span style={{ color: M.or }}>ls *.docx</span><br/>
              <span style={{ color: M.or }}>claude "보고서 만들어줘"</span><br/>
              <span style={{ color: M.gd, fontFamily: "var(--workbook-font)" }}>→ 한 줄에 한 동작, 자동화 가능</span>
            </div>
          </div>
        </div>

        <div style={{ ...card({ borderLeft: `4px solid ${M.gd}` }), padding: "12px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: M.gd, marginBottom: 6 }}>왜 AI 코딩에선 터미널을 쓸까?</div>
          <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.7 }}>
            ① <strong style={{ color: M.tx }}>AI가 직접 명령을 실행</strong>할 수 있어요. 사람이 마우스를 잡고 클릭할 필요 없음.<br/>
            ② <strong style={{ color: M.tx }}>결과가 텍스트</strong>라서 AI가 다음 행동을 정확히 결정할 수 있어요.<br/>
            ③ <strong style={{ color: M.tx }}>한 번 만들면 재사용</strong> — 같은 명령어를 다음에도, 다른 사람도 그대로 실행.
          </div>
        </div>

        <div style={{ fontSize: 13, color: M.tx3, textAlign: "center" }}>
          오늘은 <code style={{ background: M.bg3, color: M.or, padding: "1px 6px", borderRadius: 4, fontFamily: "var(--workbook-mono)" }}>claude</code> 한 단어만 외워도 충분합니다 — 나머지는 한국어로 대화하세요.
        </div>
      </div>
    ),
  },
  /* Claude Desktop vs CLI — 터미널이란? 바로 위로 이동됨 */
  {
    section: "2. 개념 설명 및 시연",
    title: "오늘 배울 5가지 핵심 도구",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>오늘 배울 <span style={{ color: M.or }}>5가지 핵심 도구</span></div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center" }}>이 5가지를 순서대로 만들면 업무 자동화가 완성됩니다</div>
        {[
          { icon: "🗺️", name: "Plan 모드", desc: "먼저 설계 → 검토 → 승인. 엉뚱한 결과 방지", color: M.bl, num: "1" },
          { icon: "📋", name: "CLAUDE.md", desc: "프로젝트 규칙서. 한 번 쓰면 매번 자동 적용", color: M.or, num: "2" },
          { icon: "🎯", name: "Skill", desc: "업무 표준 절차서. 같은 품질 결과가 반복 가능", color: "#059669", num: "3" },
          { icon: "⌨️", name: "Command", desc: "단축 명령어. /ai-plan 한 줄이면 전체 워크플로우", color: M.ac, num: "4" },
          { icon: "🛡️", name: "Hook", desc: "자동 안전장치. 개인정보 차단 등 예외 없이 적용", color: M.wn, num: "5" },
        ].map(b => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 16, background: M.bg2, borderRadius: 14, padding: "14px 20px", border: `1px solid ${M.bd}`, borderLeft: `4px solid ${b.color}` }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: b.color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 900, flexShrink: 0,
            }}>{b.num}</div>
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 800, color: b.color, fontSize: 17 }}>{b.name}</span>
              <span style={{ color: M.tx2, fontSize: 14, marginLeft: 12 }}>{b.desc}</span>
            </div>
          </div>
        ))}
        <div style={{ ...card({ background: M.bg3 }), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: M.tx3 }}>
            체험(Part 3)에서 하나씩 만들어 보고, 실습(Part 4)에서 본인 업무에 적용합니다
          </div>
        </div>
      </div>
    ),
  },
  // ─── 기본 도구 ───
  {
    section: "2. 개념 설명 및 시연",
    title: "Claude 첫 로그인",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: `linear-gradient(135deg, ${M.or}22, #fbbf2422)`, border: `1px solid ${M.or}44`, borderRadius: 8, padding: "6px 20px", fontSize: 14, fontWeight: 700, color: M.or, letterSpacing: 2, display: "inline-block", marginBottom: 14 }}>FIRST LOGIN</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, lineHeight: 1.2, marginBottom: 10 }}>Claude에 <span style={{ color: M.or }}>처음 로그인</span>하기</div>
          <div style={{ fontSize: 16, color: M.tx2, maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            처음 한 번만 로그인하면, 이후엔 <strong style={{ color: M.or }}>claude</strong> 한 줄로 바로 시작합니다.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.ac}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.ac, marginBottom: 8 }}>1단계 — 터미널에서 claude 실행</div>
            <Ref title="명령어">{`claude`}</Ref>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 8 }}>2단계 — 로그인 모드 진입</div>
            <Ref title="claude 안에서 입력">{`/login`}</Ref>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.gd, marginBottom: 8 }}>
              3단계 — URL 복사 → {isTauri() ? "본인 PC 브라우저" : "새 탭"}에서 열기
            </div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.6 }}>
              화면에 <code style={{ background: M.bg3, padding: "1px 6px", borderRadius: 4 }}>https://claude.ai/oauth/...</code> 형태의 URL이 표시됩니다. 마우스로 드래그해 복사한 뒤 <strong style={{ color: M.tx }}>{isTauri() ? "본인 노트북 브라우저" : "브라우저 새 탭"}</strong>에 붙여넣어 여세요.
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.wn, marginBottom: 8 }}>4단계 — Claude 로그인 후 코드 받기</div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.6 }}>
              본인의 <strong style={{ color: M.tx }}>Claude 계정</strong>으로 로그인하면 인증 코드가 표시됩니다. 그 코드를 복사하세요.
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "14px 18px", gridColumn: "1 / 3" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.blM, marginBottom: 8 }}>5단계 — 코드를 터미널에 붙여넣기</div>
            <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.6 }}>
              터미널로 돌아와서 받은 코드를 붙여넣고 엔터. <strong style={{ color: M.gd }}>"Login successful"</strong> 메시지가 보이면 완료입니다. 토큰이 <code style={{ background: M.bg3, padding: "1px 6px", borderRadius: 4 }}>~/.claude/.credentials.json</code>에 자동 저장되어 다음부터는 로그인 과정 없이 바로 사용 가능합니다.
            </div>
          </div>
        </div>

        <div style={{ ...card({ background: M.bg3 }), padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: M.tx2 }}>
            ⚠️ 본인의 Claude 계정이 필요합니다. 계정이 없다면 <strong style={{ color: M.tx }}>claude.ai</strong>에서 먼저 가입하세요.
          </div>
        </div>
      </div>
    ),
  },
  /* 챗봇 vs 에이전트 + Claude Code = 나만의 AI 비서 — 삭제됨 (사용자 요청) */
  {
    section: "2. 개념 설명 및 시연",
    title: "작업 폴더 설정",
    mode: "tauri",  // 웹 모드: ttyd가 user 홈에서 바로 시작 — 폴더 선택 불필요
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
                style={{ flex: 1, background: M.bg3, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 14px", color: M.or, fontFamily: "var(--workbook-mono)", fontSize: 14, outline: "none" }} />
              <button onClick={() => { const v = document.getElementById("proj-dir-input")?.value; if (v) handleSet(v); }} disabled={!tauri}
                style={{ background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
                설정
              </button>
            </div>
          </div>
          {projectNotice && (
            <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "10px 16px" }}>
              <div style={{ fontSize: 15, color: M.gd, fontWeight: 700 }}>{projectNotice}</div>
            </div>
          )}
        </div>
      );
    },
  },
  /* 프로젝트 폴더 구조 — 삭제됨 (사용자 요청) */

  // ─── Claude Desktop 의 Code 탭 vs Claude Code CLI ───
  {
    section: "2. 개념 설명 및 시연",
    title: "같은 Claude Code, 두 가지 환경",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 8, padding: "5px 18px", fontSize: 13, fontWeight: 700, color: M.or, letterSpacing: 2, display: "inline-block", marginBottom: 8 }}>WHY CLI?</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>Claude Desktop <span style={{ color: M.blM }}>Code 탭</span> vs <span style={{ color: M.or }}>Claude Code CLI</span></div>
          <div style={{ fontSize: 14, color: M.tx2, marginTop: 6 }}>둘 다 Claude Code 엔진인데, 왜 터미널(CLI)로 할까?</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.blM, marginBottom: 8 }}>🖥️ Desktop 앱의 Code 탭</div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.tx }}>✓ GUI 안에서 Claude Code 실행</strong><br/>
              <strong style={{ color: M.tx }}>✓ 채팅 탭과 전환 편리</strong><br/>
              <strong style={{ color: M.tx }}>✓ 파일 미리보기 내장</strong><br/>
              <span style={{ color: M.bad }}>✗ 터미널 기능 제한적</span> — 복잡한 셸 조합 어려움<br/>
              <span style={{ color: M.bad }}>✗ 앱 업데이트에 의존</span> — 최신 기능 반영 느림
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: M.tx3, fontStyle: "italic" }}>
              개인 PC에서 가볍게 쓰기에 적합
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 8 }}>⚡ Claude Code CLI (터미널)</div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.tx }}>✓ 전체 기능 100% 사용</strong> — 최신 버전 즉시 반영<br/>
              <strong style={{ color: M.tx }}>✓ git · npm · python 파이프라인 연결</strong><br/>
              <strong style={{ color: M.tx }}>✓ Skill/Command/Hook 완벽 지원</strong><br/>
              <strong style={{ color: M.tx }}>✓ 스크립트로 자동화 가능</strong><br/>
              <strong style={{ color: M.tx }}>✓ 팀 전체가 같은 환경 공유</strong> (git 으로 배포)
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: M.gd, fontStyle: "italic" }}>
              업무 자동화 · 팀 협업에 강력
            </div>
          </div>
        </div>

        <div style={{ ...card({ borderLeft: `4px solid ${M.gd}` }), padding: "12px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: M.gd, marginBottom: 6 }}>오늘 CLI 를 쓰는 이유</div>
          <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.75 }}>
            ① <strong style={{ color: M.tx }}>전체 기능</strong> — Skill · Command · Hook 등 핵심 도구를 제한 없이 사용<br/>
            ② <strong style={{ color: M.tx }}>워크숍 환경</strong> — 브라우저만 열면 바로 시작. Desktop 앱 설치가 필요 없음<br/>
            ③ <strong style={{ color: M.tx }}>팀 공유</strong> — CLI 에서 만든 Skill/Command 는 git 으로 팀 전체에 배포 가능<br/>
            ④ <strong style={{ color: M.tx }}>집에서는 Desktop Code 탭도 OK</strong> — 같은 Skill/Command 파일이 그대로 동작합니다
          </div>
        </div>

        <div style={{ fontSize: 12, color: M.tx3, textAlign: "center" }}>
          <strong style={{ color: M.or }}>결론:</strong> Desktop Code 탭이든 CLI 터미널이든 만드는 결과물은 같습니다. 오늘은 CLI 로 익히고, 집에서는 편한 쪽을 쓰세요.
        </div>
      </div>
    ),
  },
  // ─── AI 코딩 도구 비교 — 바이브 코딩 IDE ───
  {
    section: "2. 개념 설명 및 시연",
    title: "AI 코딩 도구 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: M.ac + "22", border: `1px solid ${M.ac}44`, borderRadius: 8, padding: "5px 18px", fontSize: 13, fontWeight: 700, color: M.ac, letterSpacing: 2, display: "inline-block", marginBottom: 8 }}>AI CODING LANDSCAPE</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.tx, lineHeight: 1.2 }}>AI 코딩 도구, <span style={{ color: M.or }}>어떤 걸 써야 할까?</span></div>
          <div style={{ fontSize: 14, color: M.tx2, marginTop: 6 }}>Claude Code vs 바이브 코딩 IDE 비교</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Claude Code */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 6 }}>⚡ Claude Code (CLI / Desktop)</div>
            <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.gd }}>✓</strong> Skill/Command/Hook 생태계<br/>
              <strong style={{ color: M.gd }}>✓</strong> 터미널 직접 제어 (git, npm, python)<br/>
              <strong style={{ color: M.gd }}>✓</strong> 팀 규칙(CLAUDE.md) 공유<br/>
              <strong style={{ color: M.gd }}>✓</strong> 서버/자동화 파이프라인 연결<br/>
              <span style={{ color: M.tx3 }}>△ 코드 에디터 별도 필요</span>
            </div>
            <div style={{ marginTop: 8, padding: "4px 10px", background: M.or + "15", borderRadius: 6, fontSize: 11, color: M.or, fontWeight: 700 }}>
              업무 자동화 · 비개발자 · 팀 협업
            </div>
          </div>

          {/* Cursor */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.ac}` }), padding: "14px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.ac, marginBottom: 6 }}>🖱️ Cursor</div>
            <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.gd }}>✓</strong> VS Code 기반 — 익숙한 UI<br/>
              <strong style={{ color: M.gd }}>✓</strong> 코드 인라인 수정/자동완성<br/>
              <strong style={{ color: M.gd }}>✓</strong> 멀티 파일 동시 편집<br/>
              <span style={{ color: M.tx3 }}>△ 월 $20 유료</span><br/>
              <span style={{ color: M.tx3 }}>△ 터미널 자동화 제한적</span>
            </div>
            <div style={{ marginTop: 8, padding: "4px 10px", background: M.ac + "15", borderRadius: 6, fontSize: 11, color: M.ac, fontWeight: 700 }}>
              개발자 · 코드 편집 중심
            </div>
          </div>

          {/* Windsurf */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "14px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.blM, marginBottom: 6 }}>🏄 Windsurf</div>
            <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.gd }}>✓</strong> "Flow" 모드 — AI가 연속 작업<br/>
              <strong style={{ color: M.gd }}>✓</strong> 코드 + 터미널 통합<br/>
              <strong style={{ color: M.gd }}>✓</strong> 무료 플랜 있음<br/>
              <span style={{ color: M.tx3 }}>△ Cursor 대비 생태계 작음</span><br/>
              <span style={{ color: M.tx3 }}>△ 업무 자동화 기능 제한</span>
            </div>
            <div style={{ marginTop: 8, padding: "4px 10px", background: M.blM + "15", borderRadius: 6, fontSize: 11, color: M.blM, fontWeight: 700 }}>
              개발자 · 연속 작업 선호
            </div>
          </div>

          {/* Anysphere / Antigravity */}
          <div style={{ ...card({ borderLeft: `4px solid ${M.wn}` }), padding: "14px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: M.wn, marginBottom: 6 }}>🚀 Antigravity (구 Jules)</div>
            <div style={{ fontSize: 12, color: M.tx2, lineHeight: 1.7 }}>
              <strong style={{ color: M.gd }}>✓</strong> Google DeepMind 기반<br/>
              <strong style={{ color: M.gd }}>✓</strong> GitHub 연동 비동기 작업<br/>
              <strong style={{ color: M.gd }}>✓</strong> PR 자동 생성<br/>
              <span style={{ color: M.tx3 }}>△ 아직 얼리 액세스</span><br/>
              <span style={{ color: M.tx3 }}>△ 비개발자용 기능 부족</span>
            </div>
            <div style={{ marginTop: 8, padding: "4px 10px", background: M.wn + "15", borderRadius: 6, fontSize: 11, color: M.wn, fontWeight: 700 }}>
              개발자 · GitHub 중심 워크플로우
            </div>
          </div>
        </div>

        <div style={{ ...card({ borderLeft: `4px solid ${M.gd}` }), padding: "10px 16px" }}>
          <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
            <strong style={{ color: M.gd }}>핵심 차이:</strong> Cursor/Windsurf/Antigravity는 <strong style={{ color: M.tx }}>개발자가 코드를 편집</strong>하는 도구. Claude Code는 <strong style={{ color: M.or }}>비개발자도 업무를 자동화</strong>하는 도구. 목적이 다릅니다.
          </div>
        </div>
      </div>
    ),
  },
  // ── 터미널 소개 ──
  {
    section: "2. 개념 설명 및 시연",
    title: "터미널이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx, textAlign: "center" }}>터미널이란?</div>
        <div style={{ ...card(), textAlign: "center", padding: "32px" }}>
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
    section: "2. 개념 설명 및 시연",
    title: "터미널 사용법",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", height: "100%", alignItems: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: M.tx }}>터미널 사용법 — <span style={{ color: M.or }}>딱 2가지만</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          {conceptCard("1️⃣", "claude 입력 후 Enter", "Claude Code를 실행합니다. 그러면 AI가 준비 완료!", M.or)}
          {conceptCard("2️⃣", "한글로 원하는 것 입력", "\"퇴직연금 보고서 만들어줘\" 처럼 자연스럽게 입력하면 됩니다", M.ac)}
        </div>
        <div style={{ background: M.bg3, borderRadius: 12, padding: 20, fontFamily: "var(--workbook-mono)", fontSize: 16, lineHeight: 2, width: "100%" }}>
          <span style={{ color: M.gd }}>$</span> <span style={{ color: M.or }}>claude</span><br/>
          <span style={{ color: M.tx3 }}>(Claude Code 실행됨)</span><br/>
          <span style={{ color: M.gd }}>{">"}</span> <span style={{ color: M.tx }}>퇴직연금 보고서 만들어줘</span>
        </div>
      </div>
    ),
  },

  // ── Plan 모드: 설계부터 시작하기 ──
  {
    section: "2. 개념 설명 및 시연",
    title: "먼저 설계하기: Plan 모드",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>먼저 <span style={{ color: M.or }}>설계</span>하기</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>이런 경험 있으신가요?</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            "보고서 써줘" → 결과가 기대와 다름 → "다시 써줘" → 또 다름 → 반복...<br/>
            <strong style={{ color: M.tx }}>원인: AI에게 뭘 만들지 설계를 안 하고 바로 실행시켰기 때문</strong>
          </div>
        </div>
        {conceptCard("🗺️", "Plan 모드 = 설계도 먼저 그리기", "집을 짓기 전에 설계도를 그리듯, AI에게 먼저 계획을 세우게 합니다. 검토 후 실행하면 수정 횟수가 절반으로 줄어듭니다.", M.or)}
        {vsBox(
          "바로 실행 (시행착오)",
          ["결과물이 기대와 다를 수 있음", "수정 요청이 3~5회 반복", "매번 구조가 달라짐"],
          "설계 후 실행 (한 번에)",
          ["계획을 먼저 검토·승인", "한 번에 원하는 결과물", "일관된 구조와 품질 보장"]
        )}
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Plan 모드 작동 방식",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Plan 모드 <span style={{ color: M.or }}>작동 방식</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>복잡한 작업은 AI에게 먼저 계획을 세우게 하세요</div>
        {[
          { step: "1", title: "기능 정의", desc: "무엇을 만들지 요구사항을 알려줌", icon: "📋", color: M.bl },
          { step: "2", title: "설계 검토", desc: "AI가 실행 계획을 작성 → 검토 후 승인", icon: "🗺️", color: M.or },
          { step: "3", title: "자율 실행", desc: "승인된 계획대로 AI가 자동으로 작업", icon: "⚡", color: "#059669" },
          { step: "4", title: "결과 검증", desc: "완성된 결과물을 확인하고 피드백", icon: "✅", color: M.ac },
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
          <div style={{ fontSize: 15, color: M.tx2, marginTop: 6, fontFamily: "var(--workbook-mono)" }}>"먼저 구현 계획을 세워줘. 계획을 보여주면 내가 검토하고 승인할게"</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Plan 모드: 인터뷰 기능",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, textAlign: "center" }}>Plan 모드에서 <span style={{ color: M.or }}>AI가 역질문</span>을 합니다</div>
        <div style={{ fontSize: 14, color: M.tx2, textAlign: "center" }}>
          요구사항이 불명확하면 AI가 먼저 물어봅니다 — 당황하지 마세요, 정상입니다
        </div>

        {/* 터미널 스타일 재현 — 실제 Claude Code Plan 인터뷰 UI */}
        <div style={{
          background: "#0a0a0f", borderRadius: 12, padding: "16px 20px",
          fontFamily: "var(--workbook-mono)", fontSize: 13, lineHeight: 1.8,
          border: `1px solid ${M.bd}`, color: "#e5e8ec",
        }}>
          <div style={{ color: "#60a5fa", marginBottom: 4 }}>╭─────────────────────────────────────────╮</div>
          <div style={{ color: "#60a5fa" }}>│  <span style={{ color: M.or, fontWeight: 700 }}>Plan</span>  설계하기 전에 몇 가지 확인하겠습니다.  │</div>
          <div style={{ color: "#60a5fa", marginBottom: 12 }}>╰─────────────────────────────────────────╯</div>

          <div style={{ color: "#86efac", marginBottom: 8 }}>? 어떤 종류의 보고서를 자동화하고 싶으신가요?</div>
          <div style={{ paddingLeft: 16, marginBottom: 12 }}>
            {[
              { label: "분기별 실적 보고서", checked: true, active: false },
              { label: "경쟁사 분석 보고서", checked: true, active: false },
              { label: "시장 동향 보고서", checked: false, active: true },
              { label: "내부 감사 보고서", checked: false, active: false },
              { label: "기타 (직접 입력)", checked: false, active: false },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                color: item.active ? "#fff" : item.checked ? "#86efac" : "#5a7a98",
                background: item.active ? "#1e3a5f" : "transparent",
                padding: "2px 8px", borderRadius: 4,
                marginBottom: 1,
              }}>
                <span style={{ width: 16, display: "inline-block" }}>
                  {item.checked ? <span style={{ color: "#86efac" }}>◉</span> : item.active ? <span style={{ color: "#60a5fa" }}>○</span> : <span style={{ color: "#3a5068" }}>○</span>}
                </span>
                {item.label}
              </div>
            ))}
          </div>

          <div style={{ color: "#86efac", marginBottom: 8 }}>? 대상 독자는 누구인가요?</div>
          <div style={{ paddingLeft: 16, marginBottom: 12 }}>
            {[
              { label: "임원진", checked: false, active: true },
              { label: "팀장/부서장", checked: false, active: false },
              { label: "실무 담당자", checked: false, active: false },
              { label: "외부 고객/파트너", checked: false, active: false },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                color: item.active ? "#fff" : "#5a7a98",
                background: item.active ? "#1e3a5f" : "transparent",
                padding: "2px 8px", borderRadius: 4,
                marginBottom: 1,
              }}>
                <span style={{ width: 16, display: "inline-block" }}>
                  {item.active ? <span style={{ color: "#60a5fa" }}>❯</span> : " "}
                </span>
                {item.label}
              </div>
            ))}
          </div>

          <div style={{ color: "#5a7a98", borderTop: "1px solid #1a2a3a", paddingTop: 8, fontSize: 11 }}>
            <span style={{ color: "#60a5fa" }}>↑↓</span> 이동  <span style={{ color: "#60a5fa", marginLeft: 12 }}>Space</span> 선택  <span style={{ color: "#60a5fa", marginLeft: 12 }}>Enter</span> 확인
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...card({ borderLeft: `3px solid ${M.ac}` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: M.ac, marginBottom: 4 }}>왜 물어보나?</div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.6 }}>
              요구사항이 모호하면 AI가 추측 대신<br/><strong style={{ color: M.tx }}>확인부터 합니다</strong>. 결과물 품질이 올라감.
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `3px solid ${M.gd}` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: M.gd, marginBottom: 4 }}>어떻게 대응?</div>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.6 }}>
              <strong style={{ color: M.tx }}>↑↓</strong> 로 이동, <strong style={{ color: M.tx }}>Space</strong> 로 체크,<br/>
              <strong style={{ color: M.tx }}>Enter</strong> 로 확인. 편하게 고르세요.
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "3. 기능 체험",
    title: "체험 슬라이드 사용법",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: M.tx, textAlign: "center" }}>
          체험 슬라이드 <span style={{ color: M.or }}>사용법</span>
        </div>
        <div style={{ fontSize: 15, color: M.tx2, textAlign: "center" }}>
          이제부터 화면이 두 칸으로 나뉩니다. 왼쪽을 읽고, 오른쪽에서 실행하세요.
        </div>

        {/* 화면 구조 시각화 */}
        <div style={{ ...card(), padding: "14px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "35% 65%", gap: 10, minHeight: 140 }}>
            <div style={{ background: M.bg3, borderRadius: 10, padding: "10px 12px", border: `1px solid ${M.bd}`, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: M.gd }}>🎯 GOAL — 이 미션의 목적</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: M.or }}>📥 INPUT — 내가 입력할 것</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: M.blM }}>📤 OUTPUT — 나와야 할 파일</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: M.tx2 }}>💬 프롬프트 (복사 or 작성)</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>✅ 필수 / ⭐ 도전 체크</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: M.blM }}>🤖 AI 채점 버튼</div>
            </div>
            <div style={{ background: "#0a0a0f", borderRadius: 10, padding: "10px 12px", border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)", fontSize: 11, color: "#86efac" }}>
              <div style={{ color: M.tx3, fontSize: 10, marginBottom: 2 }}>🤖 AI 조수  잘 진행 중...</div>
              <div style={{ borderBottom: `1px solid ${M.bd}33`, marginBottom: 6, paddingBottom: 4 }} />
              <div>user01@workshop:~$ claude</div>
              <div style={{ color: "#60a5fa" }}>&gt; PLAN.md 를 만들어줘...</div>
              <div style={{ color: "#fbbf24" }}>✓ Created PLAN.md</div>
            </div>
          </div>
        </div>

        {/* 진행 순서 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { step: "1", label: "읽기", desc: "GOAL·INPUT·OUTPUT 확인", color: M.gd },
            { step: "2", label: "실행", desc: "📋 복사 → 터미널 붙여넣기\n또는 ▶ 실행 버튼", color: M.or },
            { step: "3", label: "확인", desc: "파일 생성 → 토스트 알림\n📄 프리뷰로 결과 확인", color: M.blM },
            { step: "4", label: "채점", desc: "🤖 AI 채점 받기 (선택)\n상세 피드백 + 점수", color: "#10b981" },
          ].map(s => (
            <div key={s.step} style={{ ...card({ borderLeft: `3px solid ${s.color}` }), padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{s.step}</div>
                <span style={{ fontWeight: 800, color: s.color, fontSize: 14 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 11, color: M.tx3, lineHeight: 1.5, whiteSpace: "pre-line" }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* 팁 */}
        <div style={{ ...card({ background: M.bg3, borderLeft: `4px solid ${M.or}` }), padding: "10px 16px" }}>
          <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
            <strong style={{ color: M.or }}>팁:</strong> 막히면 <strong style={{ color: M.tx }}>힌트</strong> 또는 <strong style={{ color: M.tx }}>모범답안</strong>을 펼쳐보세요.
            터미널 우하단 <strong style={{ color: M.or }}>💬 버튼</strong>을 누르면 <strong style={{ color: M.tx }}>AI 도우미</strong>에게 자유롭게 질문할 수 있습니다.
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "3. 기능 체험",
    title: "체험: Plan 모드로 기능 정의하기",
    mission: {
      id: "plan", stage: 1, label: "Plan 모드",
      description: "설계부터 시작 — AI에게 계획을 세우게 합니다",
      goal: "Plan 모드를 써서 보고서 작성 워크플로우 4~5단계를 계획 + PLAN.md 로 저장",
      inputDesc: "터미널에서 claude 실행 후 /plan 슬래시 커맨드로 시작. 무엇을 만들지 자연어로 설명",
      outputDesc: "PLAN.md (마크다운) — 4~5개 단계가 번호 매김으로 정리된 보고서 워크플로우",
      outputFiles: ["PLAN.md"],
      promptTemplate: `/plan AI 추진 TF의 "AI 추진 계획 보고서"를 작성할 거야. 단계별 계획만 세워줘. 코드 작성이나 프로그램 실행은 하지 마. PLAN.md 파일로 저장. 최대한 간결하게.`,
      exampleOutput: `결론: 4-5단계의 보고서 생성 워크플로우.
1. 추진 배경·목표 정리
2. 적용 사례 리서치
3. 도입 로드맵 작성
4. 위험·기대효과 정리
5. 최종 보고서(.docx) 출력
확인: PLAN.md 파일이 생성되어야 자동검증 통과.`,
      hints: [
        "Claude가 계획을 한국어로 제시한 뒤, PLAN.md 파일로도 저장하라고 요청하세요",
        "ls 로 PLAN.md 파일이 생긴 것 확인",
      ],
      mandatory: [
        "보고서 관련 작업을 수행했다",
        "내용이 여러 단계나 섹션으로 구성되어 있다",
      ],
      challenge: [
        "입력 / 출력 / 산출물이 명시되어 있다",
        "구조가 깔끔하게 정리되어 있다",
      ],
      // 호환성: 기존 checklist 도 유지 (자동검증 UI 가 사용)
      checklist: ["계획 파일 생성됨"],
      autoChecks: [
        { type: "file-exists", path: "PLAN.md" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>Plan 모드로 기능 정의</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>실제로 설계부터 시작해봅시다</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 8 }}>Step 1. Plan 모드 진입</div>
          <div data-copyable={`/plan AI 추진 TF의 "AI 추진 계획 보고서"를 작성할 거야. 단계별 계획만 세워줘. 코드 작성이나 프로그램 실행은 하지 마. PLAN.md 파일로 저장. 최대한 간결하게.`} title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            /plan AI 추진 TF의 "AI 추진 계획 보고서"를 작성할 거야. 단계별 계획만 세워줘. 코드 작성이나 프로그램 실행은 하지 마. <strong style={{ color: M.tx }}>PLAN.md</strong> 파일로 저장. 최대한 간결하게.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: M.or }}>PLAN.md</code></div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.gd, marginBottom: 8 }}>Step 2. 설계 검토 후 실행</div>
          <div style={{ fontSize: 16, color: M.tx3, lineHeight: 1.7 }}>
            AI가 섹션 구조와 내용을 설계하면 검토합니다.<br/>
            "좋아, 실행해줘" 또는 "2번 섹션은 빼고 진행해줘" 같은 피드백이 가능합니다.
          </div>
        </div>
        <div style={{ ...card({ background: M.bg3, borderLeft: `4px solid ${M.bl}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.7 }}>
            <strong style={{ color: M.or }}>핵심:</strong> 이 설계 과정에서 나온 구조를 CLAUDE.md와 Skill에 반영하면,<br/>
            다음부터는 설계 없이도 같은 품질의 결과물이 나옵니다.
          </div>
        </div>
      </div>
    ),
  },

  // ── 권한 시스템 ──
  {
    section: "2. 개념 설명 및 시연",
    title: "왜 자꾸 Yes를 눌러야 하나요?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>왜 자꾸 <span style={{ color: M.or }}>Yes</span>를 눌러야 하나요?</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>에이전트는 실제로 파일을 만들고 코드를 실행합니다</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            챗봇과 달리, Claude Code는 {isTauri() ? "여러분 컴퓨터에서" : "여러분의 작업 공간에서"} <strong style={{ color: M.tx }}>파일 생성·삭제·터미널 명령</strong>을 직접 실행합니다.<br/>
            그래서 매번 "이거 해도 될까요?" 하고 허락을 구하는 것입니다.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { icon: "📄", label: "파일 생성/수정", desc: "Read, Write, Edit", color: M.or },
            { icon: "💻", label: "터미널 명령", desc: "Bash(pip install ...)", color: M.ac },
            { icon: "🔌", label: "외부 연결", desc: "MCP(웹 검색 등)", color: M.blM },
          ].map(p => (
            <div key={p.label} style={{ ...card(), padding: "12px 14px", borderLeft: `4px solid ${p.color}` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontWeight: 700, color: p.color, fontSize: 15, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontSize: 13, color: M.tx3, fontFamily: "var(--workbook-mono)" }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card({ background: M.bg3 }), textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.tx2 }}>귀찮지만, <strong style={{ color: M.gd }}>여러분의 컴퓨터를 보호</strong>하기 위한 안전장치입니다</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "권한 설정: 매번 Yes 안 누르는 법",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>매번 Yes <span style={{ color: M.or }}>안 누르는 법</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card(), borderLeft: `4px solid #fca5a5` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: M.bad, marginBottom: 8 }}>방법 1: 항상 허용 (Always allow)</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.7, marginBottom: 10 }}>
              권한 요청이 뜰 때 <strong style={{ color: M.tx }}>Always allow</strong>를 선택하면 해당 도구는 다시 묻지 않습니다.
            </div>
            <div style={{ fontSize: 14, color: M.tx3 }}>한 번씩 판단하면서 허용 범위를 넓힐 수 있음</div>
          </div>
          <div style={{ ...card(), borderLeft: `4px solid ${M.or}` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 8 }}>방법 2: 설정 파일로 일괄 허용</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.7, marginBottom: 10 }}>
              <code style={{ color: M.or }}>.claude/settings.local.json</code>에 미리 허용할 도구를 적어두면 처음부터 묻지 않습니다.
            </div>
            <div style={{ fontSize: 14, color: M.tx3 }}>팀 전체에 동일한 권한을 배포할 수 있음</div>
          </div>
        </div>
        <Code code={`// .claude/settings.local.json
{
  "permissions": {
    "allow": [
      "Read",         // 파일 읽기
      "Write",        // 파일 쓰기
      "Edit",         // 파일 수정
      "Bash(python *)",   // Python 실행
      "Bash(pip *)",      // 패키지 설치
      "Bash(node *)",     // Node.js 실행
      "Bash(npm *)"       // npm 명령
    ]
  }
}`} name="권한 설정 파일" filePath=".claude/settings.local.json" />
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "무조건 Yes 눌러도 되나요?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>무조건 Yes 눌러도 <span style={{ color: M.or }}>되나요?</span></div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: M.gd, marginBottom: 8 }}>오늘 실습에서는 — Yes 눌러도 괜찮습니다</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            오늘은 <strong style={{ color: M.tx }}>작업 폴더(doc-automation)</strong> 안에서만 작업합니다.<br/>
            AI가 만드는 파일도, 실행하는 코드도 이 폴더 안에서 일어납니다.<br/>
            실수해도 폴더를 삭제하면 원상복구됩니다.
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: M.bad, marginBottom: 8 }}>실무에서는 — 주의가 필요합니다</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 15, color: M.tx2, lineHeight: 1.7 }}>
            {[
              { icon: "🚫", text: "rm -rf, 삭제 명령어 → 파일이 영구 삭제될 수 있음" },
              { icon: "🚫", text: "git push --force → 팀원의 코드가 날아갈 수 있음" },
              { icon: "🚫", text: "낯선 외부 서비스 호출 → 데이터 유출 가능성" },
            ].map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{w.icon}</span>
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.or, fontWeight: 700 }}>원칙: 모르는 명령어가 보이면 일단 No → AI에게 "이게 뭐야?" 물어보기</div>
        </div>
      </div>
    ),
  },
  {
    section: "3. 기능 체험",
    title: "체험: 권한 설정하기",
    mission: {
      id: "permission", stage: 2, label: "권한 설정",
      description: "매번 Yes를 누르지 않게 권한을 설정합니다",
      goal: "도구 사전 승인 — Bash, Read, Write, Edit 등을 settings.local.json 의 allow 목록에 등록",
      inputDesc: "Claude 에게 settings.local.json 만들어달라고 요청 — 어떤 도구를 허용할지 명시",
      outputDesc: ".claude/settings.local.json (JSON) — permissions.allow 배열 안에 도구 패턴 들어있음",
      outputFiles: [".claude/settings.local.json"],
      promptTemplate: `settings.local.json에 Bash, Read, Write, Edit 도구를 자동 허용 설정해줘. 최대한 간결하게.`,
      exampleOutput: `결론: .claude/settings.local.json 생성됨.
permissions.allow 에 Bash(*), Read(*), Write(*), Edit(*) 추가.
확인: 다음부터 매번 Yes 누를 필요 없음.`,
      hints: ["allowedTools에 도구명을 추가합니다", "위험한 도구는 제외하는 게 좋습니다"],
      mandatory: [
        "권한 설정 작업을 수행했다",
        "도구 허용 관련 내용이 있다",
      ],
      challenge: [
        "필요한 권한만 골라서 허용했다",
        "위험한 명령어는 제외했다",
        "설정 형식이 깔끔하다",
      ],
      checklist: ["권한 설정 파일 생성됨"],
      autoChecks: [
        { type: "file-exists", path: ".claude/settings.local.json" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>권한 설정</span>하기</div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>실습 중 Yes를 반복하지 않도록 미리 설정합시다</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 8 }}>터미널에 입력</div>
          <div data-copyable=".claude/settings.local.json 파일을 만들어줘. Read, Write, Edit, Bash(python *), Bash(pip *), Bash(node *), Bash(npm *), Bash(ls *), Bash(cat *), Bash(mkdir *) 권한을 허용해줘." title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            .claude/settings.local.json 파일을 만들어줘. Read, Write, Edit, Bash(python *), Bash(pip *), Bash(node *), Bash(npm *), Bash(ls *), Bash(cat *), Bash(mkdir *) 권한을 허용해줘.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: M.or }}>.claude/settings.local.json</code></div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.gd, marginBottom: 8 }}>설정 후 효과</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            파일 읽기·쓰기·수정 → <strong style={{ color: M.gd }}>자동 허용</strong><br/>
            Python·npm 실행 → <strong style={{ color: M.gd }}>자동 허용</strong><br/>
            그 외 낯선 명령 → <strong style={{ color: M.or }}>여전히 물어봄 (안전)</strong>
          </div>
        </div>
        <div style={{ ...card({ background: M.bg3 }), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 15, color: M.tx2 }}>이 설정은 이 프로젝트 폴더에서만 적용됩니다. 다른 폴더에는 영향 없음.</div>
        </div>
      </div>
    ),
  },

  // ── CLAUDE.md (4 slides) ──
  {
    section: "2. 개념 설명 및 시연",
    title: "CLAUDE.md란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md란?</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>Plan에서 정한 설계, 매번 반복할 건가요?</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            Plan 모드로 좋은 설계를 만들었어도, 다음 대화에선 AI가 잊어버립니다.<br/>
            <strong style={{ color: M.tx }}>CLAUDE.md에 기록하면 → 매 대화마다 자동으로 규칙이 적용됩니다</strong>
          </div>
        </div>
        {conceptCard("📋", "프로젝트 규칙서 — 한 번 쓰면 매번 자동 적용", "언어, 톤, 브랜드 색상, 보안 정책 등 설계에서 정한 규칙을 영구히 저장합니다.", M.or)}
        {vsBox(
          "CLAUDE.md 없이",
          ["매번 \"한국어로 써줘\" 반복", "매번 \"미래에셋 색상 써줘\" 반복", "매번 \"개인정보 빼줘\" 반복", "→ 같은 말 10번 반복하는 비효율"],
          "CLAUDE.md 사용 시",
          ["언어·톤·색상 자동 적용", "보안 규칙 항상 유지", "팀 전체가 같은 규칙 공유", "→ 한 번 쓰면 영원히 적용"]
        )}
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "CLAUDE.md 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md <span style={{ color: M.or }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>"보고서 만들어줘" 한 마디에 대한 AI 응답 차이</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>❌ CLAUDE.md 없이</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`Sure! What kind of report
would you like me to create?

Please provide:
- Topic
- Format (Word, PDF...)
- Any specific requirements

I'll be happy to help!`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.gd, marginBottom: 10 }}>✅ CLAUDE.md 적용 후</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.gd, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`최신 보험 시장 동향을 주제로
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
    section: "2. 개념 설명 및 시연",
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
    section: "2. 개념 설명 및 시연",
    title: "CLAUDE.md 여러 예시",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>CLAUDE.md <span style={{ color: M.or }}>여러 예시</span></div>
        <Code code={BASE_FILES["CLAUDE.md"]} name="CLAUDE.md (미래에셋생명 실제 예시)" filePath="CLAUDE.md" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "기본 동작", desc: "질문 금지 + 즉시 실행 규칙", color: M.or },
            { label: "브랜드 가이드", desc: "#F58220 오렌지, 미래에셋생명 표기", color: M.or },
            { label: "보안 규칙", desc: "개인정보 절대 포함 금지", color: M.bad },
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
    section: "3. 기능 체험",
    title: "체험: 프롬프트로 CLAUDE.md 만들기",
    mission: {
      id: "claudemd", stage: 3, label: "CLAUDE.md",
      description: "AI에게 프로젝트 규칙을 알려줍니다",
      goal: "프로젝트 규칙서를 작성 — 팀/프로젝트/언어/색상/톤을 한 파일에 정리",
      inputDesc: "Claude 에게 CLAUDE.md 를 만들어 달라고 요청 — 팀명, 프로젝트, 언어, 색상 등 명시",
      outputDesc: "프로젝트 루트의 CLAUDE.md (마크다운) — 한국어 + #F58220 키워드 포함",
      outputFiles: ["CLAUDE.md"],
      promptTemplate: `현재 폴더에 CLAUDE.md를 만들어줘. 팀: AI 추진 TF, 프로젝트: AI 추진 계획 보고서 자동화. 한국어, 브랜드 색상 #F58220. 최대한 간결하게. 질문 말고 바로 실행.`,
      exampleOutput: `결론: 프로젝트 루트에 CLAUDE.md 생성됨.
내용 구조:
- 프로젝트: AI 추진 계획 보고서 자동화
- 팀: AI 추진 TF
- 코딩 규칙: 한국어, 강조 색상 #F58220
- 주요 작업: 리서치 → 본문 작성 → 검토 → .docx 출력
확인: cat CLAUDE.md 로 내용 확인.`,
      hints: ["브랜드 색상, 톤앤매너도 추가해보세요", "파일명 규칙이나 폴더 구조도 넣어보세요"],
      mandatory: [
        "CLAUDE.md 관련 작업을 수행했다",
        "브랜드 색상이나 스타일이 언급되어 있다",
      ],
      challenge: [
        "팀명이나 프로젝트명이 들어있다",
        "톤·스타일 관련 내용이 있다",
        "구조적으로 정리되어 있다",
        "보안 관련 내용이 있다",
      ],
      checklist: ["CLAUDE.md 생성됨"],
      autoChecks: [
        { type: "file-exists", path: "CLAUDE.md" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: M.or }}>CLAUDE.md 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 CLAUDE.md를 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: M.wn, fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-claudemd"
            defaultValue={`현재 폴더에 CLAUDE.md를 만들어줘.\n팀은 "AI 추진 TF", 프로젝트는 "AI 추진 계획 보고서 자동화"야.\n한국어로 작성하고, 브랜드 색상 오렌지 #F58220 를 반드시 명시해줘.\n250단어 이내로 간결하게, 질문하지 말고 바로 실행.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-claudemd"); if (t) copyToClipboard(t.value); }}
            style={{ marginTop: 8, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: M.or }}>CLAUDE.md</code> (한국어 + #F58220 포함)</div>
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
    section: "2. 개념 설명 및 시연",
    title: "Skill이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill이란?</div>
        <div style={{ ...card({ borderLeft: `4px solid #059669` }), padding: "14px 18px", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#059669", marginBottom: 6 }}>CLAUDE.md만으로 부족한 이유</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            CLAUDE.md는 이 프로젝트에서만 작동합니다. 보고서 작성 노하우를 다른 프로젝트에서도 쓰고 싶다면?<br/>
            <strong style={{ color: M.tx }}>Skill로 만들면 → 어떤 프로젝트에서든 같은 품질로 작동합니다</strong>
          </div>
        </div>
        {conceptCard("🎯", "재사용 가능한 업무 매뉴얼 — 팀 전체가 공유하는 SOP", "신입사원에게 업무 매뉴얼을 주듯, AI에게 업무 절차를 알려줍니다. 한 번 만들면 팀 누구나 동일한 품질로.", "#059669")}
        {vsBox(
          "CLAUDE.md (이 프로젝트만)",
          ["이 프로젝트에서만 적용", "언어·톤·색상 등 공통 규칙", "다른 프로젝트에선 새로 작성", "→ 프로젝트마다 1개"],
          "Skill (어디서든 재사용)",
          ["다른 프로젝트에 복사해서 즉시 사용", "~/.claude/skills/에 넣으면 전역 적용", "팀원에게 파일만 전달하면 끝", "→ 업무별로 N개, 어디서든 재사용"]
        )}
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Skill 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Skill <span style={{ color: "#059669" }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>"보고서 만들어줘" — CLAUDE.md만 있을 때 vs Skill까지 있을 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>CLAUDE.md만 (규칙만)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`한국어 ✓ 브랜드 색상 ✓

하지만...
· 구조가 매번 3섹션, 5섹션, 7섹션
· 표 서식이 들쭉날쭉
· 출처 각주 빠짐
· 템플릿 무시하고 새 스타일`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.gd, marginBottom: 10 }}>CLAUDE.md + Skill (절차까지)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.gd, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`한국어 ✓ 브랜드 색상 ✓

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
    section: "2. 개념 설명 및 시연",
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
    section: "2. 개념 설명 및 시연",
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
    section: "3. 기능 체험",
    title: "체험: 프롬프트로 Skill 만들기",
    mission: {
      id: "skill", stage: 4, label: "Skill",
      description: "반복 업무를 매뉴얼로 만들어 일관된 품질을 확보합니다",
      goal: "보고서 작성 표준 절차를 Skill 파일로 영구화 — 다음부턴 한 줄로 동일 품질",
      inputDesc: "Claude 에게 .claude/skills/ai-plan-report/SKILL.md 만들어달라고 요청 + 절차 명시",
      outputDesc: "Skill 마크다운 — frontmatter (name/description) + 입력/절차/출력 섹션",
      outputFiles: [".claude/skills/ai-plan-report/SKILL.md"],
      promptTemplate: `AI 추진 계획 보고서 작성 표준 절차를 스킬로 만들어줘. .claude/skills/ai-plan-report/SKILL.md 에 저장. 최대한 간결하게.`,
      exampleOutput: `결론: .claude/skills/ai-plan-report/SKILL.md 생성됨.
구조:
- 입력: 회사·팀·목표
- 절차: 1) 배경 2) 사례 3) 로드맵 4) 위험·기대효과 5) 결론
- 출력: 마크다운 + .docx
확인: ls .claude/skills/ai-plan-report/`,
      hints: ["필수 섹션과 작성 순서를 구체적으로 넣어보세요", "예시 데이터도 포함하면 품질이 올라갑니다"],
      mandatory: [
        "스킬 관련 작업을 수행했다",
        "이름이나 설명이 있다",
        "절차가 여러 단계로 구성되어 있다",
      ],
      challenge: [
        "입력 / 출력이 구분되어 있다",
        "보고서 관련 섹션이 언급되어 있다",
        "산출물 형식이 명시되어 있다",
        "사용할 도구가 정의되어 있다",
      ],
      checklist: ["스킬 파일 생성됨"],
      autoChecks: [
        { type: "file-exists", path: ".claude/skills/ai-plan-report/SKILL.md" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: "#059669" }}>Skill 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Skill 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: M.wn, fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #059669` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#059669", marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-skill"
            defaultValue={`AI 추진 계획 보고서 작성 표준 절차를 스킬로 만들어줘.\n.claude/skills/ai-plan-report/SKILL.md 경로에 저장.\nCLAUDE.md는 건드리지 마.\n\n절차: 1) 추진 배경·목표 정리\n2) 적용 사례 리서치\n3) 도입 로드맵 작성\n4) 위험·기대효과 정리\n5) 최종 보고서 출력\n250단어 이내로 간결하게.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-skill"); if (t) copyToClipboard(t.value); }}
            style={{ marginTop: 8, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: "#059669" }}>.claude/skills/ai-plan-report/SKILL.md</code></div>
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
    section: "2. 개념 설명 및 시연",
    title: "Command란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command란?</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>매번 긴 프롬프트를 다시 쳐야 하나요?</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            "웹에서 검색해서 → 보고서 써서 → PPT 만들어줘" 같은 복잡한 요청을 매번 입력하기 번거롭습니다.<br/>
            <strong style={{ color: M.tx }}>Command로 만들면 → /report 한 마디로 전체 워크플로우가 실행됩니다</strong>
          </div>
        </div>
        {conceptCard("⌨️", "/명령어 단축키 — 복잡한 작업을 한 마디로", "여러 Skill을 순서대로 연결해 복잡한 작업을 한 번에 실행합니다.", M.or)}
        {vsBox(
          "Skill (지식 — 명사)",
          ["AI가 자동으로 판단해서 호출", "어떤 상황에 적용할지 AI가 결정", "배경 지식·절차 제공"],
          "Command (워크플로우 — 동사)",
          ["/report처럼 사용자가 직접 실행", "Skill들을 체이닝해서 자동화", "웹 리서치 → 보고서 → PPT 한 번에"]
        )}
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Command 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Command <span style={{ color: M.or }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>보고서 + PPT + 컴플라이언스 검토를 한 번에 실행할 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>Command 없이 (수동)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`1. "퇴직연금 보고서 만들어줘"
   → 결과 확인, 수정 요청

2. "이걸로 PPT도 만들어줘"
   → 또 확인, 수정 요청

3. "규제 위반 없는지 검토해줘"
   → 총 3번 요청, 30분 소요`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.gd, marginBottom: 10 }}>Command 사용 (자동)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.gd, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`/report 퇴직연금
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
    section: "2. 개념 설명 및 시연",
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
    section: "2. 개념 설명 및 시연",
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
              <div style={{ fontFamily: "var(--workbook-mono)", fontSize: 18, color: c.color, fontWeight: 800, marginBottom: 4 }}>{c.cmd}</div>
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
    section: "3. 기능 체험",
    title: "체험: 프롬프트로 Command 만들기",
    mission: {
      id: "command", stage: 5, label: "Command",
      description: "한 마디로 실행하는 단축 명령어를 만듭니다",
      goal: "/ai-plan {부서명} 한 줄로 보고서가 나오는 슬래시 커맨드를 만든다",
      inputDesc: "Claude 에게 .claude/commands/ai-plan.md 만들어달라고 요청 + 인자 받는 방식 설명",
      outputDesc: "Command 마크다운 — frontmatter (description, argument-hint) + 워크플로우 설명",
      outputFiles: [".claude/commands/ai-plan.md"],
      promptTemplate: `ai-plan 이라는 커맨드를 .claude/commands/ai-plan.md 로 만들어줘. 부서명을 인자로 받아 ai-plan-report 스킬을 호출. 최대한 간결하게.`,
      exampleOutput: `결론: .claude/commands/ai-plan.md 생성.
사용법: /ai-plan 영업기획팀
실행 시:
1. ai-plan-report 스킬 호출
2. 해당 부서 맞춤 보고서 작성
3. outputs/ 폴더에 .docx 저장
확인: claude 재시작 후 /ai-plan 한 번 실행.`,
      hints: ["커맨드명은 업무에 맞게 변경해보세요", "여러 스킬을 순서대로 연결할 수 있습니다"],
      mandatory: [
        "커맨드 관련 작업을 수행했다",
        "설명이 포함되어 있다",
        "작업 흐름이 정의되어 있다",
      ],
      challenge: [
        "입력값 힌트가 있다",
        "사용 예시가 들어있다",
        "여러 단계가 순서대로 정의되어 있다",
      ],
      checklist: ["커맨드 파일 생성됨"],
      autoChecks: [
        { type: "file-exists", path: ".claude/commands/ai-plan.md" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: M.or }}>Command 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Command 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: M.wn, fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-command"
            defaultValue={`ai-plan 이라는 커맨드를 만들어줘.\n.claude/commands/ai-plan.md 파일로 만들어야 해.\n\n인자로 부서명을 받아서, 아까 만든 ai-plan-report 스킬을 호출해\nAI 추진 계획 보고서를 생성하는 워크플로우야.\n최대한 간결하게.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-command"); if (t) copyToClipboard(t.value); }}
            style={{ marginTop: 8, background: M.or, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: M.or }}>.claude/commands/ai-plan.md</code></div>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: M.gd, marginBottom: 6 }}>등록 확인 방법</div>
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
    section: "2. 개념 설명 및 시연",
    title: "Hook이란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook이란?</div>
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "14px 18px", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.wn, marginBottom: 6 }}>보험업에서 개인정보가 유출되면?</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            AI가 생성한 문서에 주민번호·연락처가 포함될 수 있습니다. CLAUDE.md로 "빼줘"라고 해도 AI가 가끔 놓칩니다.<br/>
            <strong style={{ color: M.tx }}>Hook은 AI가 아닌 프로그램이 100% 자동 검사합니다. 예외 없음.</strong>
          </div>
        </div>
        {conceptCard("⚡", "자동 검문소 — 모든 파일을 100% 자동 검사", "파일이 만들어질 때마다 프로그램이 자동으로 실행됩니다. AI의 실수까지 잡아냅니다.", M.wn)}
        {vsBox(
          "CLAUDE.md/Skill (제안, AI 판단)",
          ["AI가 판단해서 적용", "가끔 놓칠 수 있음", "더 유연하지만 100%는 아님"],
          "Hook (강제, 프로그램 실행)",
          ["예외 없이 100% 실행", "보안·컴플라이언스에 적합", "AI의 실수도 잡아냄"]
        )}
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Hook 전후 비교",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: M.wn }}>전후 비교</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>AI가 고객 주민번호가 포함된 보고서를 만들었을 때</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid ${M.tx3}` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.tx3, marginBottom: 10 }}>Hook 없이 (무방비)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.tx3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`보고서가 저장되었습니다.
outputs/보고서_고객분석.docx

내용 중:
"김철수(850101-1234567)
고객의 해약 사유 분석..."

⚠️ 개인정보 그대로 노출!
→ 사람이 검토하기 전까진 모름`}</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: M.gd, marginBottom: 10 }}>Hook 적용 (자동 차단)</div>
            <div style={{ background: M.bg3, borderRadius: 8, padding: 14, fontFamily: "var(--workbook-mono)", color: M.gd, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`🚫 Hook이 파일 저장을 차단!

"주민등록번호 패턴이
감지되었습니다.
마스킹 후 재시도하세요."

→ AI가 자동으로 마스킹 처리:
"김**(**0101-*******)"
→ 안전한 파일로 재저장 ✓`}</div>
          </div>
        </div>
        <div style={{ ...card(), padding: "10px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.tx2 }}>Skill은 <strong style={{ color: "#059669" }}>"제안"</strong> / Hook은 <strong style={{ color: M.wn }}>"강제"</strong> — 보안 규칙은 Hook으로 100% 차단</div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Hook 구조",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: M.wn }}>구조</span></div>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: M.wn, marginBottom: 4 }}>이벤트 타입</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>PreToolUse (실행 전)<br/>PostToolUse (실행 후)</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.wn, marginBottom: 4 }}>matcher</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>Write, Read, Bash 등<br/>어떤 도구에 반응할지</div>
          </div>
          <div style={{ ...card(), padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.wn, marginBottom: 4 }}>command</div>
            <div style={{ fontSize: 15, color: M.tx3 }}>실행할 쉘 스크립트<br/>차단 시 block 반환</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Hook 여러 예시",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Hook <span style={{ color: M.wn }}>여러 예시</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { name: "개인정보 차단 Hook", desc: "파일 저장 전 주민번호·전화번호 감지 → 즉시 차단", event: "PreToolUse / Write", color: M.bad },
            { name: "활동 로그 Hook", desc: "파일 생성 후 날짜·파일명을 activity.log에 자동 기록", event: "PostToolUse / Write", color: M.wn },
            { name: "이메일 경고 Hook", desc: "이메일 주소 감지 시 차단 대신 경고 메시지만 표시", event: "PreToolUse / Write", color: M.wn },
            { name: "명령어 감사 Hook", desc: "Bash 명령 실행 전 허용 목록에 없으면 차단", event: "PreToolUse / Bash", color: M.bad },
          ].map(h => (
            <div key={h.name} style={{ ...card(), borderLeft: `4px solid ${h.color}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: M.tx, marginBottom: 4 }}>{h.name}</div>
              <div style={{ fontSize: 14, color: M.tx3, marginBottom: 6, lineHeight: 1.6 }}>{h.desc}</div>
              <div style={{ fontFamily: "var(--workbook-mono)", fontSize: 12, color: h.color, background: M.bg3, padding: "3px 8px", borderRadius: 4, display: "inline-block" }}>{h.event}</div>
            </div>
          ))}
        </div>
        <Code code={HOOK_FILES[".claude/hooks/check-pii.sh"]} name="check-pii.sh (실제 예시)" filePath=".claude/hooks/check-pii.sh" />
      </div>
    ),
  },
  {
    section: "3. 기능 체험",
    title: "체험: 프롬프트로 Hook 만들기",
    mission: {
      id: "hook", stage: 6, label: "Hook",
      description: "파일 저장 시 자동으로 안전 검사를 수행합니다",
      goal: "Write/Edit 직전에 PII (주민번호·전화번호) 패턴을 자동 차단하는 안전장치 만들기",
      inputDesc: "Claude 에게 PreToolUse hook 만들어달라고 요청 — PII 정규식 + 차단 동작 명시",
      outputDesc: ".claude/hooks/check-pii.sh (실행 가능 셸 스크립트) + settings.local.json 에 등록",
      outputFiles: [".claude/hooks/check-pii.sh", ".claude/settings.local.json"],
      promptTemplate: `보고서 저장 전에 개인정보(주민번호, 전화번호)가 있으면 차단하는 훅 만들어줘. 최대한 간결하게.`,
      exampleOutput: `결론: .claude/hooks/check-pii.sh + .claude/settings.json 의 PreToolUse hook 등록.
동작: Write 호출 시 파일 내용에 주민번호/전화번호 패턴이 있으면
"❌ 개인정보 감지 — 저장 차단" 출력 후 거부.
확인: 일부러 가짜 주민번호를 보고서에 넣어 저장 시도해보면 차단됨.`,
      hints: ["정규식으로 개인정보 패턴을 감지합니다", "차단 시 경고 메시지를 보여줍니다"],
      mandatory: [
        "Hook 관련 작업을 수행했다",
        "개인정보 감지 관련 내용이 있다",
        "Hook이 등록되었거나 등록 방법이 있다",
      ],
      challenge: [
        "차단 시 경고 메시지가 있다",
        "추가 개인정보 패턴도 있다",
        "스크립트가 실행 가능하다",
      ],
      checklist: ["Hook 스크립트 생성됨"],
      autoChecks: [
        { type: "file-exists", path: ".claude/hooks/check-pii.sh" },
      ],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>프롬프트로 <span style={{ color: M.wn }}>Hook 만들기</span></div>
        <div style={{ fontSize: 17, color: M.tx2, textAlign: "center" }}>Claude Code에게 이렇게 말하면 Hook 파일을 만들어줍니다</div>
        <div style={{ borderLeft: "4px solid #fbbf24", padding: "10px 14px", marginBottom: 0, background: M.bg2, borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: M.wn, fontWeight: 700, marginBottom: 6 }}>💡 이전 대화 기록이 남아있으면 Skill이 제대로 작동하지 않을 수 있습니다. 아래 명령어로 대화를 초기화하세요.</div>
          <Cmd cmd="/clear" desc="대화 초기화" />
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #fbbf24` }), padding: "20px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.wn, marginBottom: 12 }}>터미널에 입력할 프롬프트</div>
          <textarea id="ta-hook"
            defaultValue={`AI 추진 계획 보고서 작업의 안전장치로 보안 훅을 만들어줘.\n.claude/settings.local.json 에 PreToolUse Hook을 설정하고\n.claude/hooks/check-pii.sh 스크립트를 만들어.\nCLAUDE.md나 스킬 파일은 건드리지 마.\n\n파일을 저장할 때 주민번호, 전화번호, 이메일 패턴이 있으면\n저장을 차단하고 경고를 출력하는 훅이야.`}
            style={{ background: M.bg3, border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)", color: M.or, borderRadius: 8, padding: "14px", width: "100%", resize: "vertical", fontSize: 14, lineHeight: 1.8, boxSizing: "border-box" }}
          />
          <button onClick={() => { const t = document.getElementById("ta-hook"); if (t) copyToClipboard(t.value); }}
            style={{ marginTop: 8, background: M.wn, color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📋 복사</button>
          <div style={{ marginTop: 8, fontSize: 13, color: M.tx3 }}>🎯 목표 파일: <code style={{ color: M.wn }}>.claude/hooks/check-pii.sh</code> + <code style={{ color: M.wn }}>.claude/settings.local.json</code></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.wn, marginBottom: 6 }}>다른 Hook 예시 프롬프트</div>
            <div style={{ fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
              "파일 생성할 때마다 로그 기록하는 훅 만들어줘"<br/>
              "이메일 주소 발견하면 경고만 표시하는 훅 만들어줘"
            </div>
          </div>
          <div style={{ ...card(), padding: "12px 16px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.wn, marginBottom: 6 }}>만들고 나서 테스트</div>
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
    section: "2. 개념 설명 및 시연",
    title: "템플릿 파일 준비",
    mode: "tauri",  // 웹 모드: 사용자가 ttyd에서 git clone 또는 mkdir로 직접 준비
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
  // ─── 컨텍스트 관리 ───
  {
    section: "2. 개념 설명 및 시연",
    title: "컨텍스트란?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>컨텍스트란?</div>
        {conceptCard("📚", "AI에게 주는 배경지식", "신입사원에게 회사 소개서를 주는 것처럼, AI에게 맥락을 주면 훨씬 잘 합니다.", M.ac)}
        <div style={{ ...card() }}>
          <div style={{ fontSize: 17, color: M.tx, lineHeight: 1.9 }}>
            컨텍스트가 <span style={{ color: M.bad }}>없으면</span>: "보고서 양식이 어떻게 되나요? 색상은요? 출처는요?..."<br/>
            컨텍스트가 <span style={{ color: M.gd }}>있으면</span>: 바로 시작! 모든 규칙을 이미 알고 있음
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "컨텍스트란 실제로 뭔가요?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>컨텍스트란 <span style={{ color: M.or }}>실제로</span> 뭔가요?</div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>AI가 한 번에 볼 수 있는 정보의 총량</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            AI와 대화할 때 매번 전달되는 모든 정보를 합쳐서 컨텍스트라고 합니다.<br/>
            <strong style={{ color: M.tx }}>CLAUDE.md + 대화 내용 + 파일 내용 + 프롬프트</strong> = 전부 합쳐서 하나의 컨텍스트
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { icon: "📋", label: "CLAUDE.md", desc: "매 대화 시작 시 자동으로 읽힘", ex: "\"한국어로 써줘\" 같은 규칙", color: M.or },
            { icon: "💬", label: "대화 내용", desc: "지금까지 주고받은 모든 메시지", ex: "\"아까 보고서에서 표 추가해줘\"", color: M.ac },
            { icon: "📄", label: "파일 내용", desc: "AI가 읽은 코드, 문서, 템플릿", ex: "templates/양식.docx 분석 결과", color: "#059669" },
            { icon: "🔌", label: "외부 데이터", desc: "MCP로 가져온 웹 검색 결과 등", ex: "\"2026년 퇴직연금 시장 규모는...\"", color: M.blM },
          ].map(c => (
            <div key={c.label} style={{ ...card(), borderLeft: `4px solid ${c.color}`, padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <span style={{ fontWeight: 800, color: c.color, fontSize: 16 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 14, color: M.tx2, marginBottom: 4 }}>{c.desc}</div>
              <div style={{ fontSize: 13, color: M.tx3, fontFamily: "var(--workbook-mono)" }}>{c.ex}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card({ background: M.bg3 }), textAlign: "center", padding: "10px 16px" }}>
          <div style={{ fontSize: 15, color: M.tx2 }}>이 공간에는 <strong style={{ color: M.bad }}>한계</strong>가 있습니다. 대화가 길어지면 앞 내용을 잊어버리는 이유!</div>
        </div>
      </div>
    ),
  },
  /* 프롬프트 6원칙 — "좋은 프롬프트 쓰는 법" 슬라이드에 합쳐짐 */
  {
    section: "2. 개념 설명 및 시연",
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
              <div style={{ fontFamily: "var(--workbook-mono)", color: c.color, fontSize: 18, fontWeight: 800, margin: "8px 0" }}>{c.cmd}</div>
              <div style={{ color: M.tx, fontSize: 15, fontWeight: 600 }}>{c.desc}</div>
              <div style={{ color: M.tx3, fontSize: 15, marginTop: 6 }}>{c.detail}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "/compact는 왜 하는 건가요?",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>/compact는 왜 <span style={{ color: M.or }}>하는 건가요?</span></div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 6 }}>AI의 기억력에는 한계가 있습니다</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.8 }}>
            AI는 대화 내용을 <strong style={{ color: M.tx }}>컨텍스트 윈도우</strong>라는 공간에 담아둡니다.<br/>
            대화가 길어지면 이 공간이 가득 차서 <strong style={{ color: M.bad }}>앞에서 한 말을 잊어버립니다.</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
          <div style={{ flex: 1, ...card(), padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄📄📄📄📄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.bad }}>대화가 쌓이면...</div>
            <div style={{ fontSize: 14, color: M.tx3, marginTop: 4 }}>컨텍스트 윈도우가 가득 참</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: M.or, fontWeight: 900 }}>→</div>
          <div style={{ flex: 1, ...card(), padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.gd }}>/compact 후</div>
            <div style={{ fontSize: 14, color: M.tx3, marginTop: 4 }}>핵심만 요약해서 공간 확보</div>
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.bad, marginBottom: 6 }}>주의: compact하면 세부 내용이 사라집니다</div>
          <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
            /compact는 대화를 <strong style={{ color: M.tx }}>요약</strong>하는 것이지, 전부 기억하는 것이 아닙니다.<br/>
            "아까 3번째 수정 사항이 뭐였지?" 같은 세부 내용은 사라질 수 있습니다.<br/>
            <strong style={{ color: M.or }}>→ 그래서 compact 전에 중요한 내용을 메모리에 저장해야 합니다!</strong>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "Compact 전에 메모리 먼저!",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>Compact 전에 <span style={{ color: M.or }}>메모리 먼저!</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { step: "1", title: "메모리에 저장", desc: "중요한 결정 사항, 진행 상황을 AI에게 기억시킴", icon: "💾", color: "#059669", cmd: "지금까지 결정한 사항들을 기억해줘" },
            { step: "2", title: "/compact 실행", desc: "대화를 요약해서 컨텍스트 공간 확보", icon: "📦", color: M.or, cmd: "/compact" },
            { step: "3", title: "이어서 작업", desc: "메모리 덕분에 AI가 맥락을 유지한 채 계속 작업", icon: "▶️", color: M.ac, cmd: "아까 하던 작업 이어서 해줘" },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
              <div style={{ flex: 1, background: M.bg2, borderRadius: 12, padding: "12px 18px", border: `1px solid ${M.bd}` }}>
                <div style={{ fontWeight: 800, color: s.color, fontSize: 16 }}>Step {s.step}. {s.title}</div>
                <div style={{ color: M.tx2, fontSize: 15, marginTop: 4 }}>{s.desc}</div>
                <div data-copyable={s.cmd} title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "6px 10px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", marginTop: 6, fontSize: 14, display: "inline-block" }}>
                  {s.cmd}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: M.bad, marginBottom: 4 }}>잘못된 순서</div>
            <div style={{ fontSize: 14, color: M.tx3 }}>/compact 먼저 → 세부 내용 소실 → "아까 뭐라고 했더라?"</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: M.gd, marginBottom: 4 }}>올바른 순서</div>
            <div style={{ fontSize: 14, color: M.tx3 }}>메모리 저장 → /compact → 맥락 유지하며 계속 작업</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "3. 기능 체험",
    title: "체험: 컨텍스트 관리 실습",
    mission: {
      id: "context", stage: 7, label: "컨텍스트 관리",
      description: "대화를 압축하고 메모리를 활용합니다",
      goal: "긴 대화를 /compact 로 압축 + 핵심 정보는 메모리에 저장 → 다음 작업에서도 컨텍스트 유지",
      inputDesc: "Claude 에게 '지금까지 작업 기억해줘' 요청 후 /compact 실행, 마지막에 /context 확인",
      outputDesc: "산출 파일 없음 — Claude 세션 안에서만 확인. /context 출력에 컨텍스트 줄어든 것 보이면 OK",
      outputFiles: [],
      promptTemplate: `지금까지 우리가 한 작업을 정리해줘: 1) AI 추진 TF의 "AI 추진 계획 보고서" Plan 설계 2) 권한 설정(settings.local.json) 3) CLAUDE.md 규칙서 작성 4) Skill 매뉴얼 작성 5) Command 단축키 생성 6) Hook 안전장치 설치. 이 내용을 기억한 뒤 /compact 실행해줘. 최대한 간결하게.`,
      exampleOutput: `결론: 대화 요약 생성 후 /compact 로 컨텍스트 압축.
효과: 토큰 사용량 감소, 다음 질문에서도 "AI 추진 TF / 보고서 자동화" 컨텍스트 유지.
확인: /compact 후 새 질문에 프로젝트 정보를 기억하는지 확인.`,
      hints: ["/compact 전에 중요한 내용을 메모리에 저장하세요", "메모리는 세션이 바뀌어도 유지됩니다"],
      mandatory: [
        "컨텍스트 관리 작업을 수행했다",
        "/compact 또는 메모리 관련 명령을 사용했다",
      ],
      challenge: [
        "토큰 사용량을 확인했다",
        "compact 후에도 컨텍스트가 유지된다",
      ],
      checklist: ["/compact 실행 완료"],
      autoChecks: null,
      manualOnly: true,  // AI 채점 비활성화 — 검증할 산출물 없음
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>체험: <span style={{ color: M.or }}>컨텍스트 관리</span></div>
        <div style={{ fontSize: 18, color: M.tx2, textAlign: "center" }}>메모리 저장 → compact → 확인 순서로 실습합니다</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card({ borderLeft: `4px solid #059669` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginBottom: 6 }}>Step 1: 이전 작업 내용 알려주고 기억시키기</div>
            <div data-copyable="지금까지 우리가 한 작업을 정리해줘: 1) AI 추진 계획 보고서 Plan 설계 2) 권한 설정 3) CLAUDE.md 규칙서 4) Skill 매뉴얼 5) Command 단축키 6) Hook 안전장치. 이 내용을 기억해줘." title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", whiteSpace: "pre-wrap" }}>
              지금까지 우리가 한 작업: 1) Plan 설계 2) 권한 설정 3) CLAUDE.md 4) Skill 5) Command 6) Hook. 이 내용을 기억해줘.
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.or, marginBottom: 6 }}>Step 2: 대화 압축</div>
            <div data-copyable="/compact" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/compact</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>긴 대화를 요약해서 컨텍스트 공간 확보</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.ac}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.ac, marginBottom: 6 }}>Step 3: 컨텍스트 확인</div>
            <div data-copyable="/context" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/context</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>compact 후 컨텍스트가 줄어든 것을 확인</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "12px 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.blM, marginBottom: 6 }}>Step 4: 메모리 확인</div>
            <div data-copyable="/memory" title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 6, padding: "8px 12px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer" }}>/memory</div>
            <div style={{ fontSize: 15, color: M.tx3, marginTop: 6 }}>저장해둔 메모리가 살아있는지 확인</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
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
            { icon: "🔧", name: "문제 해결", desc: "\"오류 해결 과정을 TROUBLESHOOTING.md에 남겨줘\"", color: M.wn },
          ].map(n => (
            <div key={n.name} style={{ display: "flex", gap: 14, alignItems: "center", ...card(), padding: "14px 20px", borderLeft: `4px solid ${n.color}` }}>
              <span style={{ fontSize: 24 }}>{n.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: n.color, fontSize: 16 }}>{n.name}</div>
                <div style={{ color: M.tx2, fontSize: 14, marginTop: 2, fontFamily: "var(--workbook-mono)" }}>{n.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 14, color: M.tx3, textAlign: "center" }}>이 메모 파일들은 다음 대화에서도 AI가 읽어서 활용합니다</div>
      </div>
    ),
  },
  /* Claude Code의 5가지 도구 — Claude Code 시작 섹션으로 이동됨 */
  {
    section: "2. 개념 설명 및 시연",
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
              <span style={{ color: M.gd, fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 17, color: M.or, fontFamily: "var(--workbook-mono)" }}>{q}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 15, color: M.tx3, textAlign: "center" }}>마치 새로 온 동료에게 질문하듯, 편하게 물어보면 됩니다</div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "성공 패턴: 반복이 완벽을 이긴다",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>완벽보다 <span style={{ color: M.or }}>반복</span>이 중요합니다</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }) }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.bad, marginBottom: 10 }}>이렇게 하지 마세요</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.8 }}>
              한 번에 완벽한 결과를<br/>얻으려고 긴 프롬프트 작성<br/><br/>
              결과가 마음에 안 들면<br/>처음부터 다시 시작
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.gd, marginBottom: 10 }}>이렇게 하세요</div>
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
                <div style={{ fontFamily: "var(--workbook-mono)", color: M.or, fontSize: 15, fontWeight: 700 }}>{c.cmd}</div>
                <div style={{ color: M.tx3, fontSize: 15, marginTop: 4 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    section: "2. 개념 설명 및 시연",
    title: "바이브코딩 주의사항",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: M.tx, textAlign: "center" }}>
          바이브코딩은 <span style={{ color: M.bad }}>만능이 아닙니다</span>
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
                  <div style={{ fontWeight: 800, fontSize: 17, color: M.bad, marginBottom: 6 }}>{w.title}</div>
                  <div style={{ color: M.tx2, fontSize: 15, lineHeight: 1.7 }}>{w.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: M.bg2, borderRadius: 12, padding: "12px 20px", border: `1px solid #fca5a544`, textAlign: "center" }}>
          <div style={{ fontSize: 16, color: M.tx2 }}>
            AI는 <strong style={{ color: M.bad }}>보조 도구</strong>입니다. 최종 판단과 책임은 항상 사람에게 있습니다.
          </div>
        </div>
      </div>
    ),
  },

  // ─── 성장 리캡 ───

  /* 왜 고도화가 필요한가? — 삭제됨 (사용자 요청) */
  /* 노트 테이킹 — 컨텍스트 중제목 최말단으로 이동됨 */
  {
    section: "2. 개념 설명 및 시연",
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
            <div style={{ fontSize: 15, fontWeight: 700, color: M.gd, marginBottom: 4 }}>이럴 때 쓰세요</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.6 }}>
              "표 추가해줘"<br/>"색상을 파란색으로 바꿔"<br/>"영문 버전도 만들어줘"
            </div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid #fca5a5` }), padding: "10px 14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.bad, marginBottom: 4 }}>주의</div>
            <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.6 }}>
              이미 완료된 부분은 수정 안 됨<br/>너무 큰 방향 전환은 새로 요청<br/>작업 완료 후 수정 요청이 더 안전
            </div>
          </div>
        </div>
      </div>
    ),
  },
  /* 노트 테이킹 + 체험 노트 + /btw — 고급 섹션(훅↔컨텍스트 사이)으로 이동됨 */
  // ─── 실습 챕터 — 스킬 페이지 소개 (GitHub) ───
  {
    section: "4. 실습 프로젝트",
    title: "스킬 페이지 소개",
    render: () => {
      const repoUrl = "https://github.com/MALife-AI/subagent-mastery";
      const pagesUrl = "https://malife-ai.github.io/subagent-mastery/";
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "80vh", gap: 0 }}>
          {/* 미니 헤더 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 12px", flexShrink: 0,
            background: M.bg3, borderBottom: `1px solid ${M.bd}`,
            height: 30,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: M.or }}>스킬 페이지</span>
            <div style={{ flex: 1 }} />
            <a href={pagesUrl} target="_blank" rel="noopener" style={{
              color: M.or, fontSize: 11, fontWeight: 700, textDecoration: "none",
            }}>🌐 새 탭</a>
            <a href={repoUrl} target="_blank" rel="noopener" style={{
              color: M.tx3, fontSize: 11, textDecoration: "none", marginLeft: 8,
            }}>📦 GitHub</a>
          </div>
          {/* 웹뷰 — 고정 높이로 큰 iframe */}
          <iframe
            src={pagesUrl}
            title="subagent-mastery skills"
            style={{ flex: 1, width: "100%", border: 0, display: "block", background: "#fff", borderRadius: 8 }}
          />
        </div>
      );
    },
  },

  // ─── 최종 실습: 나만의 프로그램 만들기 (intro) ───
  {
    section: "4. 실습 프로젝트",
    title: "최종 실습: 나만의 프로그램 만들기",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ background: `linear-gradient(135deg, ${M.or}22, #fbbf2422)`, border: `1px solid ${M.or}44`, borderRadius: 8, padding: "6px 20px", fontSize: 14, fontWeight: 700, color: M.or, letterSpacing: 2, display: "inline-block", marginBottom: 14 }}>FINAL PROJECT</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, lineHeight: 1.2, marginBottom: 10 }}>나만의 <span style={{ color: M.or }}>프로그램</span> 만들기</div>
          <div style={{ fontSize: 17, color: M.tx2, maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
            앞에서는 강사가 제시한 예제(AI 추진 계획 보고서)를 따라했습니다.<br/>
            이제부터는 <strong style={{ color: M.or }}>본인 부서의 실제 업무</strong>로 처음부터 끝까지 직접 만듭니다.
          </div>
        </div>

        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "16px 20px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: M.or, marginBottom: 10 }}>프롬프트 하나로 전부 만듭니다</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {["Plan", "CLAUDE.md", "Skill", "Command", "Hook"].map((label, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ background: M.or, color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>{label}</span>
                {i < 4 && <span style={{ color: M.tx3, fontSize: 14 }}>+</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card({ borderLeft: `4px solid #86efac` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.gd, marginBottom: 6 }}>진행 방식</div>
          <div style={{ fontSize: 14, color: M.tx2, lineHeight: 1.7 }}>
            각 단계에서 <strong style={{ color: M.or }}>하나의 프롬프트</strong>로 필요한 파일을 한번에 만듭니다.
            체험과 달리 하나씩 나눠서 할 필요 없습니다.
          </div>
        </div>
      </div>
    ),
  },

  // ─── Step 1~5: 프롬프트 편집 + Step 6: 실행 + Step 7: 웹 ───
  ...[
    { id: "final-plan", stage: 8, label: "1. Plan", key: "plan", color: M.bl, title: "Step 1. Plan 프롬프트 다듬기", desc: "자동화 워크플로우 설계", icon: "📋", hint: "어떤 업무를 자동화할지 구체적으로 적을수록 결과가 좋습니다" },
    { id: "final-claudemd", stage: 9, label: "2. CLAUDE.md", key: "claudemd", color: M.or, title: "Step 2. CLAUDE.md 프롬프트 다듬기", desc: "규칙서 (언어, 톤, 브랜드)", icon: "📋", hint: "부서 특성에 맞는 톤이나 보안 규칙을 추가해보세요" },
    { id: "final-skill", stage: 10, label: "3. Skill", key: "skill", color: "#059669", title: "Step 3. Skill 프롬프트 다듬기", desc: "업무 표준 절차", icon: "⚙️", hint: "매번 같은 품질로 나오게 하려면 절차를 구체적으로 적으세요" },
    { id: "final-command", stage: 11, label: "4. Command", key: "command", color: M.ac, title: "Step 4. Command 프롬프트 다듬기", desc: "단축 명령어", icon: "⌨️", hint: "어떤 인자를 받을지, 어떤 스킬을 호출할지 정해주세요" },
    { id: "final-hook", stage: 12, label: "5. Hook", key: "hook", color: M.wn, title: "Step 5. Hook 프롬프트 다듬기", desc: "개인정보 차단 안전장치", icon: "🛡️", hint: "업무 특성에 맞는 차단 규칙을 추가해보세요" },
  ].map(step => ({
    section: "4. 실습 프로젝트",
    title: step.title,
    mission: {
      id: step.id, stage: step.stage, label: step.label,
      description: step.desc,
      goal: `프롬프트를 본인 업무에 맞게 수정`,
      inputDesc: "기본 프롬프트를 편집하세요 — 아직 실행하지 않습니다",
      outputDesc: "편집 완료 (파일 생성은 Step 6에서)",
      outputFiles: [],
      promptTemplate: "",
      hints: [step.hint, "아직 터미널에 입력하지 마세요 — 다듬기만"],
      mandatory: [], challenge: [], checklist: [],
      autoChecks: null, manualOnly: true,
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: step.color, color: "#fff", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>{step.icon}</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: M.tx }}>{step.title}</div>
            <div style={{ fontSize: 13, color: M.tx3 }}>{step.desc} — 본인 업무에 맞게 수정하세요</div>
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${step.color}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: step.color, marginBottom: 8 }}>✏️ 프롬프트 편집</div>
          <textarea
            value={practicePrompts[step.key]}
            onChange={e => updatePrompt(step.key, e.target.value)}
            style={{
              width: "100%", minHeight: 120, resize: "vertical",
              background: M.bg3, color: M.or,
              border: `1px solid ${step.color}33`, borderRadius: 10,
              padding: "12px 14px", fontFamily: "var(--workbook-mono)",
              fontSize: 13, lineHeight: 1.7, outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = step.color + "88"; }}
            onBlur={e => { e.target.style.borderColor = step.color + "33"; }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: M.tx3 }}>💡 {step.hint}</div>
        </div>
        <div style={{ ...card({ background: M.bg3 }), padding: "10px 16px" }}>
          <div style={{ fontSize: 13, color: M.tx2 }}>⚠️ 아직 터미널에 입력하지 마세요. <strong style={{ color: M.or }}>Step 6에서 한번에 실행</strong>합니다.</div>
        </div>
      </div>
    ),
  })),

  // ─── Step 6. 한번에 실행 ───
  {
    section: "4. 실습 프로젝트",
    title: "Step 6. 한번에 실행하기",
    mission: {
      id: "final-run", stage: 13, label: "6. 실행",
      description: "다듬은 프롬프트를 합쳐서 한번에 실행합니다",
      goal: "Step 1~5에서 작성한 프롬프트를 합쳐서 터미널에서 실행",
      inputDesc: "합쳐진 프롬프트를 복사해서 터미널에 붙여넣기",
      outputDesc: "PLAN.md, CLAUDE.md, Skill, Command, Hook 파일 일괄 생성",
      outputFiles: ["PLAN.md", "CLAUDE.md", ".claude/skills/my-task/SKILL.md", ".claude/commands/my-cmd.md"],
      promptTemplate: "",
      hints: ["복사 버튼으로 합쳐진 프롬프트를 터미널에 붙여넣으세요", "완료 후 /exit → claude 재시작"],
      mandatory: [], challenge: [], checklist: [],
      autoChecks: [
        { type: "file-exists", path: "PLAN.md" },
        { type: "file-exists", path: "CLAUDE.md" },
      ],
    },
    render: () => {
      const combined = `다음을 한번에 만들어줘. 질문하지 말고 바로 실행.\n\n--- 1. Plan ---\n${practicePrompts.plan}\n\n--- 2. CLAUDE.md ---\n${practicePrompts.claudemd}\n\n--- 3. Skill ---\n${practicePrompts.skill}\n\n--- 4. Command ---\n${practicePrompts.command}\n\n--- 5. Hook ---\n${practicePrompts.hook}`;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: M.gd, color: "#1a1a2e", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>▶</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: M.tx }}>한번에 <span style={{ color: M.gd }}>실행하기</span></div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.gd}` }), padding: "14px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: M.gd, marginBottom: 8 }}>합쳐진 프롬프트 (Step 1~5)</div>
            <div style={{
              background: M.bg3, borderRadius: 10, padding: "12px 14px",
              border: `1px solid ${M.bd}`, fontFamily: "var(--workbook-mono)",
              fontSize: 12, color: M.or, lineHeight: 1.7,
              maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap",
            }}>
              {combined}
            </div>
            <button
              onClick={() => { copyToClipboard(combined); }}
              style={{
                marginTop: 10, width: "100%",
                background: `linear-gradient(135deg, ${M.gd}, #059669)`,
                color: "#fff", border: "none", borderRadius: 10,
                padding: "12px", fontSize: 14, fontWeight: 800,
                cursor: "pointer", boxShadow: `0 2px 12px ${M.gd}44`,
              }}
            >
              📋 합쳐진 프롬프트 복사 → 터미널에 붙여넣기
            </button>
          </div>
          <div style={{ ...card({ background: M.bg3 }), padding: "10px 16px" }}>
            <div style={{ fontSize: 13, color: M.tx2, lineHeight: 1.7 }}>
              1. 위 버튼으로 복사<br/>
              2. 터미널에 붙여넣기 (Ctrl+V)<br/>
              3. 완료 후 <code style={{ color: M.or }}>/exit</code> → <code style={{ color: M.or }}>claude</code> 재시작하면 커맨드 사용 가능
            </div>
          </div>
        </div>
      );
    },
  },

  // ─── Step 7. 웹 배포 ───
  {
    section: "4. 실습 프로젝트",
    title: "Step 7. 웹페이지로 만들기",
    mission: {
      id: "final-web", stage: 14, label: "7. Web",
      description: "만든 기능을 웹페이지로 감쌉니다",
      goal: "단일 HTML 페이지로 팀원도 브라우저에서 쓸 수 있게 만듦",
      inputDesc: "Claude에게 web/index.html 만들어달라고 요청",
      outputDesc: "web/index.html — 백엔드 없이 단독 동작",
      outputFiles: ["web/index.html"],
      promptTemplate: `web/index.html 을 만들어줘. 백엔드 없이 단일 HTML로 완전히 동작해야 해. 입력 textarea + 실행 버튼 + 결과 표시. JavaScript로 처리. 디자인은 미래에셋 오렌지 #F58220. CSS도 HTML 안에 포함. 최대한 간결하게.`,
      hints: ["백엔드 없이 HTML+JS만으로 동작하는 페이지", "미리보기 버튼으로 바로 확인 가능"],
      mandatory: [], challenge: [], checklist: [],
      autoChecks: [{ type: "file-exists", path: "web/index.html" }],
    },
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: M.blM, color: "#fff", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>🌐</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: M.tx }}>웹페이지로 <span style={{ color: M.blM }}>만들기</span></div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.blM}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, color: M.tx2, lineHeight: 1.7 }}>
            만든 기능을 <strong style={{ color: M.or }}>단일 HTML 페이지</strong>로 만듭니다. 백엔드 없이 브라우저만으로 동작.
          </div>
        </div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }), padding: "14px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: M.or, marginBottom: 8 }}>프롬프트</div>
          <div data-copyable="web/index.html 을 만들어줘. 백엔드 없이 단일 HTML로 완전히 동작. 입력 textarea + 실행 버튼 + 결과 표시. JavaScript로 처리. 디자인은 오렌지 #F58220. 최대한 간결하게." title="클릭하여 복사" style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", fontFamily: "var(--workbook-mono)", color: M.or, border: `1px solid ${M.bd}`, cursor: "pointer", whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 13 }}>
            web/index.html 을 만들어줘. 백엔드 없이 단일 HTML로 완전히 동작. 입력 textarea + 실행 버튼 + 결과 표시. 디자인은 오렌지 #F58220. 최대한 간결하게.
          </div>
        </div>
      </div>
    ),
  },

  // ─── 완성! ───
  {
    section: "4. 실습 프로젝트",
    title: "완성! 내가 만든 프로그램",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: M.tx, textAlign: "center" }}>완성! <span style={{ color: M.or }}>내가 만든 프로그램</span></div>
        <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Plan 모드", desc: "설계 → 검토 → 승인", color: M.bl },
              { label: "CLAUDE.md", desc: "매번 자동 적용되는 규칙서", color: M.or },
              { label: "Skill", desc: "재사용 가능한 업무 매뉴얼", color: "#059669" },
              { label: "Command", desc: "/한마디로 전체 워크플로우 실행", color: M.ac },
              { label: "Hook", desc: "예외 없는 자동 안전장치", color: M.wn },
              { label: "Web UI", desc: "다른 사람도 쓸 수 있는 인터페이스", color: M.blM },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", background: M.bg3, borderRadius: 8, padding: "10px 16px" }}>
                <span style={{ fontWeight: 700, color: item.color, fontSize: 15, minWidth: 110 }}>{item.label}</span>
                <span style={{ color: M.tx2, fontSize: 15 }}>— {item.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ ...card({ borderLeft: `4px solid #86efac` }) }}>
            <div style={{ fontWeight: 700, color: M.gd, fontSize: 16, marginBottom: 6 }}>팀원에게 공유</div>
            <div style={{ color: M.tx2, fontSize: 14, lineHeight: 1.6 }}>프로젝트 폴더를 통째로 전달하면 팀 전체가 같은 품질로 작업합니다</div>
          </div>
          <div style={{ ...card({ borderLeft: `4px solid ${M.or}` }) }}>
            <div style={{ fontWeight: 700, color: M.or, fontSize: 16, marginBottom: 6 }}>계속 개선</div>
            <div style={{ color: M.tx2, fontSize: 14, lineHeight: 1.6 }}>Skill 파일만 수정하면 다음 실행부터 즉시 반영됩니다</div>
          </div>
        </div>
        <div style={{ ...card({ background: M.or + "11", border: `1px solid ${M.or}33` }), textAlign: "center" }}>
          <div style={{ fontSize: 17, color: M.or, fontWeight: 700 }}>축하합니다! 여러분은 방금 AI 자동화 프로그램을 직접 만들었습니다.</div>
        </div>
      </div>
    ),
  },

];

// 슬라이드는 mode 필드로 환경별 표시 여부를 지정.
//   undefined / "both" → 항상 표시
//   "tauri"            → Tauri 데스크톱 모드에서만 (예: 로컬 설치 안내)
//   "web"              → 웹 모드에서만 (예: ttyd 안내)
//
// section 은 4파트 중 하나로 정렬:
//   "1. 도입"   "2. 개념 설명 및 시연"   "3. 기능 체험"   "4. 실습 프로젝트"
const PART_ORDER = {
  "1. 도입": 1,
  "2. 개념 설명 및 시연": 2,
  "3. 기능 체험": 3,
  "4. 실습 프로젝트": 4,
};

const VISIBLE_SLIDES = SLIDES
  .map((s, i) => ({ ...s, _origIdx: i }))
  .filter(s => {
    if (!s.mode || s.mode === "both") return true;
    if (s.mode === "tauri") return isTauri();
    if (s.mode === "web") return !isTauri();
    return true;
  })
  .sort((a, b) => {
    const ap = PART_ORDER[a.section] ?? 99;
    const bp = PART_ORDER[b.section] ?? 99;
    if (ap !== bp) return ap - bp;
    return a._origIdx - b._origIdx;
  });


// ═══ Tauri invoke 헬퍼 ═══
// isTauri / tauriInvoke 는 ./lib/runtime.js에서 import (상단)

// ═══ UI COMPONENTS ═══
function Code({ code, name }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${M.bd}`, margin: "16px 0" }}>
      <div style={{ background: M.bg2, padding: "8px 16px", display: "flex", alignItems: "center" }}>
        <span style={{ color: M.or, fontSize: 15, fontFamily: "var(--workbook-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <pre style={{ background: M.bg3, padding: 16, margin: 0, overflowX: "auto", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, color: M.tx }}>{code}</pre>
    </div>
  );
}

// 복사 버튼 (범용)
function CopyBtn({ text, label }) {
  return null;
}

// 한 줄 명령어 표시 (복사 버튼 제거)
function Cmd({ cmd, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", background: M.bg3, borderRadius: 8, border: `1px solid ${M.bd}`, overflow: "hidden" }}>
        {desc && <span style={{ color: M.tx3, fontSize: 14, padding: "8px 0 8px 12px", whiteSpace: "nowrap" }}>{desc}</span>}
        <code style={{ flex: 1, color: M.or, fontFamily: "'JetBrains Mono', monospace", padding: "8px 12px", whiteSpace: "nowrap", overflow: "auto" }}>{cmd}</code>
      </div>
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
          {title && <span style={{ fontSize: 15, color: M.tx3, fontFamily: "var(--workbook-mono)" }}>{title}</span>}
          {text && (
            <button onClick={() => { copyToClipboard(text.trim()); setCp(true); setTimeout(() => setCp(false), 1500); }}
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
allowed-tools: Read, Write, Bash, WebFetch
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
allowed-tools: Read, Write, Bash, WebFetch
---

종합 분석 워크플로우를 실행합니다:

1. "competitor-watch" 스킬로 경쟁사 동향을 먼저 수집합니다
2. 수집된 경쟁사 데이터를 참고하여 "report-writer" 스킬로 보고서를 작성합니다
3. "compliance-check" 스킬로 작성된 보고서를 검토합니다
4. 위반 사항이 있으면 자동 수정 후 최종본을 저장합니다
5. 경쟁사 분석표 + 보고서(docx) + PPT(pptx) 총 3개 파일을 outputs/에 출력합니다`,
};

// 전체 합치기 (하위 호환)
const FULL_CLAUDE_MD = { "CLAUDE.md": BASE_FILES["CLAUDE.md"] };
const PROJECT_FILES = { ...FULL_CLAUDE_MD, ...HOOK_FILES, ...SKILL_FILES, ...COMMAND_FILES };

function AppendClaudeMd({ section, title, description }) {
  const [status, setStatus] = useState("idle");

  const handleAppend = async () => {
    setStatus("working");
    try {
      // 중복 추가 방지: 기존 내용에 첫 줄이 이미 있으면 스킵
      let current = "";
      try {
        current = await readProjectFile("CLAUDE.md");
      } catch {
        current = "";
      }
      if (current.includes(section.trim().split("\n")[0])) {
        setStatus("exists");
        return;
      }
      // append → 양쪽 모드 모두 동작 (Tauri는 read+write, 웹은 백엔드 sudo)
      await appendProjectFile("CLAUDE.md", "\n" + section);
      setStatus("done");
    } catch (e) {
      console.error("AppendClaudeMd:", e);
      setStatus("error");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: M.bg2, borderRadius: 10, border: `1px solid ${M.bd}`, margin: "12px 0" }}>
      <button onClick={handleAppend} disabled={status === "working"}
        style={{ background: status === "done" ? "#059669" : status === "exists" ? M.tx3 : status === "error" ? "#dc2626" : M.or, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: status === "working" ? "default" : "pointer", fontSize: 15, fontWeight: 700, transition: "all .2s", whiteSpace: "nowrap" }}>
        {status === "done" ? "✓ 추가 완료!" : status === "exists" ? "이미 추가됨" : status === "working" ? "추가 중..." : status === "error" ? "✗ 실패 — 다시 시도" : `📝 ${title}`}
      </button>
      <div style={{ fontSize: 14, color: M.tx3 }}>{description}</div>
    </div>
  );
}

function SetupFiles({ files, title, description, onAfter }) {
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);

  const handleCreate = async () => {
    setStatus("working");
    const res = [];
    for (const [path, content] of Object.entries(files)) {
      try {
        await writeProjectFile(path, content);
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
        {status !== "done" && (
          <button onClick={handleCreate} disabled={status === "working"}
            style={{ background: M.or, color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: status === "working" ? "wait" : "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
            {status === "working" ? "생성 중..." : "📁 파일 생성"}
          </button>
        )}
        {status === "done" && (
          <span style={{ color: M.gd, fontWeight: 700, fontSize: 14 }}>✓ 완료!</span>
        )}
      </div>
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontFamily: "var(--workbook-mono)" }}>
              <span style={{ color: r.ok ? M.gd : M.bad }}>{r.ok ? "✓" : "✗"}</span>
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
  const [apiKeyPlaceholder, setApiKeyPlaceholder] = useState("sk-ant-api03-...");
  const [authMode, setAuthMode] = useState(null); // null | "apikey"
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

    // Step 3: 인증 - 항상 키 입력 화면 표시 (config에 키가 있으면 placeholder로)
    updateStep("auth", "working");
    addLog("인증 단계");
    try {
      const savedKey = await tauriInvoke("load_api_key");
      if (savedKey) {
        setApiKeyPlaceholder(savedKey);
        addLog("기존 키 감지됨 (placeholder에 표시)");
      }
    } catch { /* 없음 */ }
    addLog("API key 입력 대기");
    setAuthMode("apikey");
  };

  const handleSaveKey = async () => {
    // 입력 없으면 placeholder(기존 config 키)로 폴백 — 기본 안내 텍스트면 config에서 직접 한번 더 로드 시도
    let trimmed = apiKey.trim();
    if (!trimmed) {
      const ph = apiKeyPlaceholder.trim();
      if (ph && ph !== "sk-ant-api03-...") {
        trimmed = ph;
      } else {
        try {
          const k = await tauriInvoke("load_api_key");
          if (k && k.trim()) trimmed = k.trim();
        } catch { /* 없음 */ }
      }
    }
    if (!trimmed) {
      setError("API 키를 입력해주세요.");
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

  const handleSkipAuth = () => {
    addLog("인증 건너뜀 (나중에 설정 가능)");
    updateStep("auth", "skipped");
    setAuthMode(null);
    setTimeout(() => onDone(), 400);
  };

  const allDone = steps.every(s => s.status === "done" || s.status === "skipped");
  const hasError = steps.some(s => s.status === "error");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: M.bg, fontFamily: "var(--workbook-font)" }}>
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
                <div style={{ fontWeight: 700, fontSize: 15, color: s.status === "done" ? M.gd : s.status === "error" ? M.bad : M.tx }}>{s.label}</div>
                <div style={{ fontSize: 14, color: M.tx3, marginTop: 2 }}>
                  {s.status === "done" ? "완료" : s.status === "error" ? "실패" : s.status === "working" ? "진행 중..." : s.status === "skipped" ? "건너뜀" : "대기"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* API 키 입력 폼 */}
        {authMode === "apikey" && (
          <div style={{ padding: "0 32px 24px" }}>
            <div style={{ background: M.bg3, borderRadius: 12, padding: 20, border: `1px solid ${M.or}44` }}>
              <div style={{ fontSize: 15, color: M.or, fontWeight: 700, marginBottom: 8 }}>Anthropic API Key</div>
              <div style={{ fontSize: 14, color: M.tx2, marginBottom: 12, lineHeight: 1.6 }}>
                console.anthropic.com &#x2192; API Keys &#x2192; Create Key<br/>
                sk-ant-로 시작하는 키를 붙여넣으세요
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                placeholder={apiKeyPlaceholder}
                autoFocus
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${M.bd}`, background: M.bg, color: M.tx, fontSize: 15, fontFamily: "var(--workbook-mono)", outline: "none", boxSizing: "border-box" }}
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


        {/* 에러 메시지 */}
        {error && (
          <div style={{ padding: "0 32px 16px" }}>
            <div style={{ background: "#2d1b1b", border: "1px solid #dc262644", borderRadius: 8, padding: "10px 14px", fontSize: 15, color: M.bad, lineHeight: 1.6 }}>
              {error}
            </div>
          </div>
        )}

        {/* 로그 */}
        <div style={{ padding: "0 32px 20px" }}>
          <div style={{ background: M.bg3, borderRadius: 8, padding: "10px 14px", maxHeight: 100, overflowY: "auto", fontFamily: "var(--workbook-mono)", fontSize: 15, color: M.tx3, lineHeight: 1.8 }}>
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
  // 실습 프롬프트 편집 상태 — 각 스텝에서 편집, Step 6에서 합쳐서 실행
  const [practicePrompts, setPracticePrompts] = useState({
    plan: "나는 [내 부서/역할]이야. [반복하는 업무]를 자동화하는 워크플로우를 설계해줘. 코드 작성은 하지 마. PLAN.md 파일로 저장.",
    claudemd: "CLAUDE.md를 만들어줘. 한국어, 브랜드 색상 #F58220, 내 업무에 맞는 규칙서. 간결하게.",
    skill: ".claude/skills/my-task/SKILL.md 를 만들어줘. 내 업무의 표준 절차를 스킬로 정리. 간결하게.",
    command: ".claude/commands/my-cmd.md 커맨드를 만들어줘. my-task 스킬을 호출하는 워크플로우. 간결하게.",
    hook: ".claude/hooks/my-check.sh + settings.local.json 을 만들어줘. 개인정보(주민번호, 전화번호) 차단 훅. outputs/와 web/ 폴더는 제외. 간결하게.",
  });
  const updatePrompt = (key, val) => setPracticePrompts(p => ({ ...p, [key]: val }));
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
  const [slideTermW, setSlideTermW] = useState(520);
  const slideTermDrag = useRef(null);
  const slideContainerRef = useRef(null);
  const slideContentRef = useRef(null);
  const [slideScale, setSlideScale] = useState(1);
  // 사용자 수동 줌 (돋보기 +/-) — 7단계, 디폴트는 인덱스 1 (= 기존 zoom 1.25 와 동일)
  const ZOOM_LEVELS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.3, 2.6];
  const ZOOM_DEFAULT_INDEX = 1;
  const [zoomLevel, setZoomLevel] = useState(ZOOM_DEFAULT_INDEX);
  const userZoom = ZOOM_LEVELS[zoomLevel];
  const isZoomedIn = zoomLevel > ZOOM_DEFAULT_INDEX;
  const [showSettings, setShowSettings] = useState(false);
  const [termFontSize, setTermFontSize] = useState(14);
  const [codeFontSize, setCodeFontSize] = useState(18);
  const [darkMode, setDarkMode] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null); // null | "reset"
  const [fullscreen, setFullscreen] = useState(false);
  const [sidebarW, setSidebarW] = useState(220);
  const sidebarDrag = useRef(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(""), 3000); return () => clearTimeout(t); } }, [notice]);

  // Esc로 전체화면 해제
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);
  // 테마 전환 시 M 업데이트
  M = darkMode ? DARK : LIGHT;
  const termWriteRef = useRef(null);

  // 게이미피케이션: 부서/업무 + 미션 진행
  const personalization = usePersonalization();
  const missionProgress = useMissionProgress();

  // 웹 모드: 사용자명 + 어드민 통제 — 강의 모드에서 next/prev 잠금
  const [username, setUsername] = useState(null);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userDisabled, setUserDisabled] = useState(false);
  const [serverTarget, setServerTarget] = useState(null);
  const [navLocked, setNavLocked] = useState(false);
  const [serverSessionVersion, setServerSessionVersion] = useState(null);
  // 발표자(user00) — 모든 슬라이드에서 터미널 패널 표시 (시연용)
  const isPresenter = username === "user00";
  useEffect(() => {
    if (isTauri()) return;
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/api/me", { credentials: "same-origin" });
        if (cancelled) return;
        if (r.ok) {
          const j = await r.json();
          setUsername(j.username || null);
          setUserIsAdmin(!!j.admin);
          setUserDisabled(!!j.disabled);
        }
      } catch {}
    }
    poll();
    // 차단 상태도 주기적으로 체크 — 어드민이 풀어주면 자동 재개
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const TOTAL = VISIBLE_SLIDES.length;
  const slide = VISIBLE_SLIDES[page];
  const isMission = !!slide.mission;

  // 모든 미션 슬라이드 인덱스 맵
  const allMissions = VISIBLE_SLIDES
    .map((s, i) => s.mission ? { ...s.mission, slideIndex: i } : null)
    .filter(Boolean);

  // Section index map for sidebar (with sub-slides)
  // 챕터 2 (개념 설명 및 시연) 안에는 sub-section 그룹 표시 — 제목 키워드로 자동 분류
  function detectSubsection(title, section) {
    if (section !== "2. 개념 설명 및 시연") return null;
    const t = title;
    // 고급 카테고리로 강제 분류 (물어보세요/성공패턴/바이브코딩/고도화/노트테이킹/btw)
    if (t.includes("물어보세요") || t.includes("성공 패턴") || t.includes("바이브코딩")
        || t.includes("고도화") || t.includes("노트 테이킹") || t.includes("외부 기억")
        || t.includes("/btw") || t.includes("끼어들기")) return "고급";
    if (t.includes("터미널") || t.includes("폴더") || t.includes("작업 폴더") || t.includes("템플릿") || t.includes("Claude 첫 로그인") || t.includes("챗봇") || t.includes("AI 비서") || t.includes("첫 실행") || t.includes("설치하기") || t.includes("5가지 핵심") || t.includes("같은 Claude Code") || t.includes("Desktop") || t.includes("AI 코딩 도구")) return "Claude Code 시작";
    if (t.includes("자연어") || t.includes("프롬프트") || t.includes("시연") || t.includes("Word/PPT") || t.includes("이제 직접")) return "프롬프트 작성법";
    if (t.includes("Plan") || t.includes("플랜") || t.includes("설계")) return "Plan 모드";
    if (t.includes("권한") || t.includes("Yes")) return "권한 시스템";
    if (t.includes("CLAUDE.md")) return "CLAUDE.md (규칙서)";
    if (t.includes("Skill")) return "Skill (재사용 절차)";
    if (t.includes("Command") || t.includes("커맨드") || t.includes("/report")) return "Command (단축 명령)";
    if (t.includes("Hook") || t.includes("훅")) return "Hook (안전장치)";
    if (t.includes("컨텍스트") || t.includes("compact") || t.includes("Compact")) return "컨텍스트 관리";
    return "고급";
  }
  const sections = [];
  VISIBLE_SLIDES.forEach((s, i) => {
    const sub = detectSubsection(s.title, s.section);
    const last = sections[sections.length - 1];
    if (!last || last.section !== s.section) {
      sections.push({
        section: s.section,
        firstSlide: i,
        slides: [],
        subgroups: [],
      });
    }
    const cur = sections[sections.length - 1];
    cur.slides.push({ title: s.title, index: i, sub });
    // sub-group 추적 (챕터 2만) — 같은 label 의 그룹이 이미 있으면 거기에 합침 (중복 방지)
    if (sub) {
      const existing = cur.subgroups.find(g => g.label === sub);
      if (existing) {
        existing.slides.push({ title: s.title, index: i });
      } else {
        cur.subgroups.push({ label: sub, firstSlide: i, slides: [{ title: s.title, index: i }] });
      }
    }
  });
  const [expandedSections, setExpandedSections] = useState({});

  // ─── 강의 모드: 어드민 통제 (사용자만) ─────────────────
  // target 은 어드민이 설정/통제하는 위치.
  // - 첫 폴: 항상 target 으로 이동 (재접속 시 admin 의도 복원)
  // - 이후: locked 일 때만 target 으로 강제 이동 (unlocked 면 사용자 자유 이동 보존)
  const firstTargetPoll = useRef(true);
  useEffect(() => {
    if (isTauri()) return;
    if (userIsAdmin) return;
    if (userDisabled) return;
    if (!username) return;

    let cancelled = false;
    async function poll() {
      const r = await fetchMyTarget();
      if (cancelled) return;
      setNavLocked(!!r.locked);
      // sessionVersion 변경 감지 — 어드민이 reset 한 경우 로컬 미션 진행도도 클리어
      if (typeof r.sessionVersion === "number") {
        if (serverSessionVersion === null) {
          setServerSessionVersion(r.sessionVersion);
        } else if (r.sessionVersion !== serverSessionVersion) {
          missionProgress.reset();
          setServerSessionVersion(r.sessionVersion);
        }
      }
      const shouldForce = firstTargetPoll.current || !!r.locked;
      if (shouldForce && r.target != null && r.target !== page) {
        if (r.target >= 0 && r.target < TOTAL) {
          setPage(r.target);
          setServerTarget(r.target);
        }
      }
      firstTargetPoll.current = false;
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [username, page, TOTAL, serverSessionVersion, missionProgress]);

  // ─── 모든 사용자: 시연 슬라이드 진입 시 Haiku swap ─
  // 시연 슬라이드 → Haiku 4.5 + 1024 tokens (빠름)
  // 그 외      → Sonnet 4.6 + 8192 tokens (풀 품질)
  // 순서: setDemoMode (settings.json swap) → 다음 claude 호출부터 적용
  //       발표자는 추가로 clearMySession 해서 바로 새 모델로 demo.
  //       학습자는 swap만 (비파괴). 미션 진입 시 MissionSlide가 "normal" 로 강제.
  const [presenterTermReady, setPresenterTermReady] = useState(true);
  const presenterRemountRef = useRef(null);
  useEffect(() => {
    if (isTauri()) return;
    if (mode !== "slide") return;
    if (isMission) return; // 미션은 MissionSlide 가 알아서 클리어 + normal 강제
    const isDemoSlide = !!(slide?.title?.startsWith("시연"));
    // 모든 사용자: settings.json swap
    setDemoMode(isDemoSlide ? "demo" : "normal").catch(() => {});
    // 발표자: 시연 슬라이드 진입 시 터미널 클리어 + 재생성
    if (isPresenter && isDemoSlide) {
      if (presenterRemountRef.current) clearTimeout(presenterRemountRef.current);
      setPresenterTermReady(false);
      clearMySession().catch(() => {});
      // ttyd RestartSec=1 → 재시작까지 ~2초
      presenterRemountRef.current = setTimeout(() => {
        presenterRemountRef.current = null;
        setPresenterTermReady(true);
      }, 2500);
    }
  }, [page, isPresenter, mode, isMission, slide?.title]);

  // ─── 빌드 버전 폴링 → 새 번들 감지 시 풀 리로드 ─────────
  // dist/version.txt 가 빌드마다 새로 쓰이므로, 처음 본 값과 다르면
  // 옛 탭이 자동으로 새 번들로 갈아탐.
  useEffect(() => {
    if (isTauri()) return; // 데스크톱 앱은 리로드 불필요
    let initialVersion = null;
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(`/version.txt?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const v = (await r.text()).trim();
        if (!v) return;
        if (initialVersion === null) {
          initialVersion = v;
        } else if (v !== initialVersion) {
          // 새 번들 감지 — 풀 리로드
          // eslint-disable-next-line no-console
          console.log(`[workbook] new build detected: ${initialVersion} → ${v}, reloading…`);
          window.location.reload();
        }
      } catch {}
    }
    check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ─── 진행 보고 (어드민 모니터링용) ─────────────────────
  useEffect(() => {
    if (isTauri()) return;
    if (!username || userIsAdmin || userDisabled) return;
    const cur = VISIBLE_SLIDES[page];
    if (!cur || !cur.title || !cur.section) return; // 빈 슬라이드 보호
    reportProgress({
      slideIndex: page,
      slideTitle: cur.title,
      sectionTitle: cur.section,
      isMissionSlide: !!cur.mission,
      currentMissionId: cur.mission?.id || null,
      completedMissionIds: Array.from(missionProgress.completedMissions || []),
      totalSlides: TOTAL,
      totalMissions: allMissions.length,
    });
  }, [username, page, missionProgress.completedMissions, TOTAL, allMissions.length]);

  // 방향키 슬라이드 이동 — 미션 슬라이드가 아닐 때 + 잠금 아닐 때
  useEffect(() => {
    const handler = (e) => {
      // input/textarea/iframe에 포커스 있으면 무시
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "IFRAME") return;
      if (navLocked) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") { e.preventDefault(); setPage(p => Math.max(0, p - 1)); }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); setPage(p => Math.min(TOTAL - 1, p + 1)); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navLocked, TOTAL]);

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

    // 사용자가 수동으로 줌인했을 때는 자동축소 끔 — 스크롤로 나머지 처리
    if (isZoomedIn) {
      setSlideScale(1);
      content.style.transform = "scale(1)";
      return;
    }

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
  }, [page, slideTermH, mode, isZoomedIn]);

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
    if (!chatInput.trim() || !termWriteRef.current) return;
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
    termWriteRef.current(msg + "\n");
    setChatInput(""); setSelectedElement(null);
    // 수정 후 자동 새로고침 (8초 후) — Tauri 모드에서만 (preview_file 명령 필요)
    if (previewFile && isTauri()) setTimeout(() => {
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
    "기본 도구": [
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
    "고도화": [
      { label: "Claude Code 실행", cmd: "claude" },
      { label: "/report 명령어 실행", cmd: "/report 2025 퇴직연금 시장 동향" },
      { label: "병렬 실행 테스트", cmd: "퇴직연금 보고서와 PPT를 동시에 만들어줘" },
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

  // 어드민 계정은 슬라이드 대신 모니터링 대시보드를 봄
  if (!isTauri() && userIsAdmin) {
    return <AdminDashboard M={M} />;
  }

  // 차단된 사용자: lockout 화면
  if (!isTauri() && userDisabled) {
    return (
      <div style={{
        height: "100vh", background: M.bg, color: M.tx,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--workbook-font)",
      }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>🚫</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: M.tx, marginBottom: 12 }}>접속이 일시 차단되었습니다</div>
          <div style={{ fontSize: 16, color: M.tx2, lineHeight: 1.7, maxWidth: 460 }}>
            워크숍 운영자가 잠시 접속을 막아둔 상태입니다.<br/>
            운영자가 풀어주면 자동으로 접속이 재개됩니다.
          </div>
          <div style={{ fontSize: 13, color: M.tx3, marginTop: 24, fontFamily: "var(--workbook-mono)" }}>
            user: {username || "?"}
          </div>
        </div>
      </div>
    );
  }

  // 부서/업무 입력 모달: 모듈1 첫 슬라이드 이후 + 아직 온보딩 안 된 경우 오버레이로 표시
  const showDeptInput = !personalization.isOnboarded && slide.section === "기본 도구";

  return (
    <div style={{ display: "flex", height: "100vh", background: M.bg, color: M.tx, fontFamily: "var(--workbook-font)", overflow: "hidden", "--code-font-size": codeFontSize + "px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slide-enter { animation: slideIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        *{box-sizing:border-box}
        /* Smooth scrollbar */
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${M.bd};border-radius:4px;transition:background .2s}
        ::-webkit-scrollbar-thumb:hover{background:${M.or}66}
        /* Focus visible */
        :focus-visible{outline:2px solid ${M.or};outline-offset:2px;border-radius:4px}
        /* Selection */
        ::selection{background:${M.or}33;color:${M.tx}}
        [data-copyable]{font-size:${codeFontSize}px !important}
        pre{font-size:${codeFontSize}px !important}
        code{font-size:${codeFontSize}px !important}
        textarea{font-size:${codeFontSize}px !important}
        /* scrollbar handled above */
        /* 슬라이드 글씨 확대 — px 단위 폰트도 전부 키움. 사용자 수동 줌과 곱해짐. */
        .slide-content-scaled { zoom: ${userZoom}; }
        /* 전체화면 모드 — 더 크게 */
        .fullscreen-slide .slide-content-scaled { zoom: ${userZoom * 1.28}; }
      `}</style>

      {/* ─── 부서/업무 입력 오버레이 (모듈1 진입 시) ─── */}
      {showDeptInput && (
        <DeptTaskInput
          M={M}
          onComplete={(dept, task) => personalization.completeOnboarding(dept, task)}
        />
      )}

      {/* ─── 전체화면 오버레이 ─── */}
      {fullscreen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: M.bg, zIndex: 9999,
          display: "flex", flexDirection: "column",
        }}>
          {/* 전체화면 헤더 */}
          <div style={{
            padding: "12px 24px", display: "flex", alignItems: "center", gap: 12,
            background: M.bg3, borderBottom: `1px solid ${M.bd}`, flexShrink: 0,
          }}>
            <div style={{ background: M.or + "22", border: `1px solid ${M.or}44`, borderRadius: 6, padding: "2px 10px", fontSize: 16, fontWeight: 700, color: M.or }}>
              {slide.section}
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: M.tx, flex: 1 }}>{slide.title}</div>
            <span style={{ color: M.tx3, fontSize: 16, fontFamily: "var(--workbook-mono)" }}>{page + 1} / {TOTAL}</span>
            <button onClick={() => !navLocked && setPage(p => Math.max(0, p - 1))} disabled={page === 0 || navLocked}
              title={navLocked ? "강의 모드: 어드민이 진행을 통제합니다" : ""}
              style={{ background: M.bg2, color: (page === 0 || navLocked) ? M.tx3 : M.tx, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "8px 18px", cursor: (page === 0 || navLocked) ? "default" : "pointer", fontSize: 18, fontWeight: 700, opacity: navLocked ? 0.5 : 1 }}>
              {navLocked ? "🔒" : "←"}
            </button>
            <button onClick={() => !navLocked && setPage(p => Math.min(TOTAL - 1, p + 1))} disabled={page === TOTAL - 1 || navLocked}
              title={navLocked ? "강의 모드: 어드민이 진행을 통제합니다" : ""}
              style={{ background: (page === TOTAL - 1 || navLocked) ? M.bg2 : M.or, color: (page === TOTAL - 1 || navLocked) ? M.tx3 : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: (page === TOTAL - 1 || navLocked) ? "default" : "pointer", fontSize: 18, fontWeight: 700, opacity: navLocked ? 0.5 : 1 }}>
              {navLocked ? "🔒" : "→"}
            </button>
            <button onClick={() => setFullscreen(false)}
              style={{ background: "#fca5a533", color: M.bad, border: `1px solid #fca5a544`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>
              ✕ 닫기
            </button>
          </div>

          {/* 전체화면 슬라이드 콘텐츠 */}
          <div className="fullscreen-slide" style={{ flex: 1, overflow: "auto", padding: "24px 48px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div key={page} className="slide-content-scaled slide-enter" style={{ width: "100%", maxWidth: 1200 }}>
              {slide.render({ skillTab, setSkillTab, deptTab, setDeptTab, projectPath, setProjectPath, projectNotice, setProjectNotice, tmplStatus, setTmplStatus, codeFontSize, isMac, interpolate: personalization.interpolate, _GrowthChart: <GrowthChart completedSet={missionProgress.completedMissions} M={M} /> })}
            </div>
          </div>
        </div>
      )}

      {/* ─── SIDEBAR ─── */}
      <nav style={{ width: sidebarW, minWidth: 140, maxWidth: 500, background: M.bg3, borderRight: `1px solid ${M.bd}`, display: "flex", flexDirection: "column", padding: "16px 0", position: "relative", flexShrink: 0 }}>
        <div style={{ padding: "0 16px", marginBottom: 16 }}><Logo /></div>

        {/* Progress bar with mission milestones */}
        <div style={{ padding: "0 16px 12px", borderBottom: `1px solid ${M.bd}`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: M.bd, borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ width: ((page + 1) / TOTAL * 100) + "%", height: "100%", background: `linear-gradient(90deg,${M.or},${M.orL})`, borderRadius: 4, transition: "width .4s" }} />
            </div>
            <span style={{ color: M.tx3, fontSize: 15, fontFamily: "var(--workbook-mono)", whiteSpace: "nowrap" }}>{page + 1}/{TOTAL}</span>
          </div>
          {/* 체험 진행 카운터 */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: M.tx3 }}>🎯</span>
            <span style={{ fontSize: 11, color: M.or, fontWeight: 600 }}>
              {missionProgress.completedCount}/{allMissions.length}
            </span>
            <span style={{ fontSize: 11, color: M.tx3 }}>체험 완료</span>
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
                    if (!navLocked) setPage(sec.firstSlide);
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
                    {sec.subgroups.length > 0 ? (
                      // 챕터 2 — sub-그룹 별로 묶어서 표시
                      sec.subgroups.map((sg) => (
                        <div key={sg.label} style={{ marginBottom: 4 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 800, color: M.or,
                            letterSpacing: 0.5, padding: "6px 10px 2px",
                            textTransform: "uppercase",
                          }}>{sg.label}</div>
                          {sg.slides.map((sl) => (
                            <button key={sl.index} onClick={() => { if (!navLocked) setPage(sl.index); }}
                              style={{
                                display: "block", width: "100%", padding: "3px 14px", borderRadius: 6, border: "none",
                                background: page === sl.index ? M.or + "22" : "transparent",
                                cursor: "pointer", textAlign: "left",
                                color: page === sl.index ? M.or : M.tx3,
                                fontWeight: page === sl.index ? 600 : 400,
                                fontSize: 13, marginBottom: 1,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                              {VISIBLE_SLIDES[sl.index].mission && missionProgress.isCompleted(VISIBLE_SLIDES[sl.index].mission.id)
                                ? <span style={{ color: M.gd }}>✓ </span>
                                : VISIBLE_SLIDES[sl.index].mission
                                ? <span style={{ color: M.or }}>🎯 </span>
                                : null}
                              {sl.title}
                            </button>
                          ))}
                        </div>
                      ))
                    ) : (
                      // 다른 챕터 — 평면 리스트
                      sec.slides.map((sl) => (
                        <button key={sl.index} onClick={() => { if (!navLocked) setPage(sl.index); }}
                          style={{
                            display: "block", width: "100%", padding: "4px 10px", borderRadius: 6, border: "none",
                            background: page === sl.index ? M.or + "22" : "transparent",
                            cursor: "pointer", textAlign: "left",
                            color: page === sl.index ? M.or : M.tx3,
                            fontWeight: page === sl.index ? 600 : 400,
                            fontSize: 14, marginBottom: 1, transition: "all .1s",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                          {VISIBLE_SLIDES[sl.index].mission && missionProgress.isCompleted(VISIBLE_SLIDES[sl.index].mission.id)
                            ? <span style={{ color: M.gd }}>✓ </span>
                            : VISIBLE_SLIDES[sl.index].mission
                            ? <span style={{ color: M.or }}>🎯 </span>
                            : null}
                          {sl.title}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tauri 모드에서만 샌드박스 토글 */}
        {isTauri() && (
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${M.bd}` }}>
            <button onClick={() => { setMode(mode === "sandbox" ? "slide" : "sandbox"); if (mode !== "sandbox") refreshSandboxFiles(); }}
              style={{ width: "100%", background: mode === "sandbox" ? M.or + "18" : "transparent", color: mode === "sandbox" ? M.or : M.tx3, border: mode === "sandbox" ? `1px solid ${M.or}44` : `1px solid ${M.bd}`, borderRadius: 6, padding: "6px 4px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              🧪 샌드박스
            </button>
          </div>
        )}
        {/* 부서 표시 — 삭제 (사용자 요청) */}
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
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, position: "relative" }}>
            <button onClick={() => setFullscreen(true)} title="전체화면 (F5)"
              style={{ background: "none", border: `1px solid ${M.bd}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 15, color: M.tx3 }}>
              ⛶
            </button>
            <button onClick={() => setDarkMode(d => !d)}
              style={{ background: "none", border: `1px solid ${M.bd}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 15, color: M.tx3 }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <span style={{ color: M.tx3, fontSize: 14, fontFamily: "var(--workbook-mono)" }}>{page + 1} / {TOTAL}</span>
            {navLocked && (
              <span style={{ background: "#7f1d1d44", color: M.bad, border: "1px solid #f8717155", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                🔒 강의 모드 — 어드민이 진행을 통제합니다
              </span>
            )}
            <button onClick={() => !navLocked && setPage(p => Math.max(0, p - 1))} disabled={page === 0 || navLocked}
              title={navLocked ? "강의 모드: 어드민이 진행을 통제합니다" : ""}
              style={{ background: M.bg2, color: (page === 0 || navLocked) ? M.tx3 : M.tx, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "6px 14px", cursor: (page === 0 || navLocked) ? "default" : "pointer", fontSize: 15, fontWeight: 700, opacity: navLocked ? 0.5 : 1 }}>
              ←
            </button>
            <button onClick={() => !navLocked && setPage(p => Math.min(TOTAL - 1, p + 1))} disabled={page === TOTAL - 1 || navLocked}
              title={navLocked ? "강의 모드: 어드민이 진행을 통제합니다" : ""}
              style={{ background: (page === TOTAL - 1 || navLocked) ? M.bg2 : M.or, color: (page === TOTAL - 1 || navLocked) ? M.tx3 : "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: (page === TOTAL - 1 || navLocked) ? "default" : "pointer", fontSize: 15, fontWeight: 700, opacity: navLocked ? 0.5 : 1 }}>
              →
            </button>
          </div>
        </header>

        {mode === "slide" && isMission && slide.mission.hiddenUntil && !slide.mission.hiddenUntil.every(id => missionProgress.completedMissions.has(id)) && (
          /* ═══ 히든 미션 잠금 화면 ═══ */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>히든 스테이지</div>
            <div style={{ fontSize: 15, color: M.tx2, textAlign: "center", lineHeight: 1.8 }}>
              이전 실습 미션을 모두 완료하면 열립니다.<br/>
              <span style={{ color: M.or, fontWeight: 700 }}>
                {slide.mission.hiddenUntil.filter(id => missionProgress.completedMissions.has(id)).length}/{slide.mission.hiddenUntil.length}
              </span> 완료
            </div>
          </div>
        )}

        {mode === "slide" && isMission && (!slide.mission.hiddenUntil || slide.mission.hiddenUntil.every(id => missionProgress.completedMissions.has(id))) && (
          /* ═══ 체험 미션 모드: 브리핑(35%) + 터미널(65%) ═══ */
          <MissionSlide
            mission={slide.mission}
            section={slide.section}
            interpolate={personalization.interpolate}
            onComplete={(id) => missionProgress.completeMission(id)}
            onAdvance={() => { if (!navLocked && page < TOTAL - 1) setPage(page + 1); }}
            onPtyReady={({ write }) => { termWriteRef.current = write; }}
            allMissions={allMissions}
            completedSet={missionProgress.completedMissions}
            onJump={(slideIndex) => setPage(slideIndex)}
            termFontSize={termFontSize}
            setTermFontSize={setTermFontSize}
            darkMode={darkMode}
            M={M}
          />
        )}

        {/* 슬라이드 줌 컨트롤 — 일반 슬라이드용 (미션은 내부 줌 사용) */}
        {mode === "slide" && !isMission && (
            <div style={{ padding: "3px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, background: M.bg3, borderBottom: `1px solid ${M.bd}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15, color: M.tx3, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  화면
                </span>
                <button
                  onClick={() => setZoomLevel(Math.max(0, zoomLevel - 1))}
                  disabled={zoomLevel === 0}
                  title="축소"
                  style={{ background: "transparent", border: `1px solid ${M.bd}`, color: zoomLevel === 0 ? M.tx3 : M.tx2, borderRadius: 4, width: 22, height: 22, cursor: zoomLevel === 0 ? "default" : "pointer", fontSize: 14, fontWeight: 700, padding: 0, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                >−</button>
                <span style={{ fontSize: 14, color: M.or, fontFamily: "var(--workbook-mono)", minWidth: 28, textAlign: "center" }}>
                  {zoomLevel + 1}/{ZOOM_LEVELS.length}
                </span>
                <button
                  onClick={() => setZoomLevel(Math.min(ZOOM_LEVELS.length - 1, zoomLevel + 1))}
                  disabled={zoomLevel === ZOOM_LEVELS.length - 1}
                  title="확대"
                  style={{ background: "transparent", border: `1px solid ${M.bd}`, color: zoomLevel === ZOOM_LEVELS.length - 1 ? M.tx3 : M.tx2, borderRadius: 4, width: 22, height: 22, cursor: zoomLevel === ZOOM_LEVELS.length - 1 ? "default" : "pointer", fontSize: 14, fontWeight: 700, padding: 0, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                >+</button>
                {zoomLevel !== ZOOM_DEFAULT_INDEX && (
                  <button
                    onClick={() => setZoomLevel(ZOOM_DEFAULT_INDEX)}
                    title="기본으로"
                    style={{ background: "transparent", border: "none", color: M.tx3, cursor: "pointer", fontSize: 13, padding: "0 4px" }}
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
        )}

        {mode === "slide" && !isMission && (
          /* ═══ 슬라이드 모드: 슬라이드 + 하단 미니 터미널 ═══ */
          <>
            {/* 시연 슬라이드일 때만 발표자 우측 터미널 보임. 그 외에는 슬라이드 풀폭. */}
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <div ref={slideContainerRef} style={{ flex: 1, overflow: "auto", padding: "12px 24px", display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: 0, minWidth: 0 }}
              onClick={(e) => {
                // 체험 슬라이드가 아닌 일반 슬라이드에서는 복사 UI 비활성화
                if (!isMission) return;
                // data-copyable 클릭 → 인라인 편집 input + 복사 버튼으로 변환
                const el = e.target.closest("[data-copyable]");
                if (el && !el.querySelector("input")) {
                  const text = el.getAttribute("data-copyable");
                  const origText = el.textContent;
                  const origStyle = el.style.cssText;
                  // 기존 자식 제거
                  while (el.firstChild) el.removeChild(el.firstChild);
                  el.style.cssText = origStyle + ";display:flex;align-items:center;gap:8px;padding:6px 10px;";

                  const input = document.createElement("input");
                  input.type = "text";
                  input.value = text;
                  input.style.cssText = "flex:1;background:transparent;border:none;color:#F58220;font-family:'JetBrains Mono',monospace;font-size:14px;outline:none;padding:0;min-width:0;";
                  el.appendChild(input);

                  const copyBtn = document.createElement("button");
                  copyBtn.textContent = "복사";
                  copyBtn.style.cssText = "background:#F58220;color:#fff;border:none;border-radius:4px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;";
                  copyBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    copyToClipboard(input.value);
                    copyBtn.textContent = "✓";
                    setTimeout(() => { copyBtn.textContent = "복사"; }, 1000);
                  };
                  el.appendChild(copyBtn);

                  input.focus();
                  input.select();

                  const restore = () => {
                    el.setAttribute("data-copyable", input.value);
                    while (el.firstChild) el.removeChild(el.firstChild);
                    el.style.cssText = origStyle;
                    el.textContent = input.value;
                  };
                  input.addEventListener("blur", () => {
                    setTimeout(() => {
                      if (!el.contains(document.activeElement)) restore();
                    }, 200);
                  });
                  input.addEventListener("keydown", (ev) => {
                    if (ev.key === "Escape") restore();
                    if (ev.key === "Enter") {
                      copyToClipboard(input.value);
                      restore();
                    }
                  });
                }
              }}
            >
              <div key={page} ref={slideContentRef} className="slide-content-scaled slide-enter" style={{ width: slideScale < 1 ? `${100 / slideScale}%` : "100%", maxWidth: slideScale < 1 ? 900 / slideScale : 900, transform: `scale(${slideScale})`, transformOrigin: "top center" }}>
                {slide.render({ skillTab, setSkillTab, deptTab, setDeptTab, projectPath, setProjectPath, projectNotice, setProjectNotice, tmplStatus, setTmplStatus, codeFontSize, isMac, interpolate: personalization.interpolate, _GrowthChart: <GrowthChart completedSet={missionProgress.completedMissions} M={M} /> })}
              </div>
            </div>

            {/* 발표자 우측 터미널 — 시연 슬라이드에서만 */}
            {isPresenter && slide.title && slide.title.startsWith("시연") && (
              <>
                {/* 가로 리사이즈 핸들 */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startW = slideTermW;
                    const onMove = (ev) => setSlideTermW(Math.max(280, Math.min(900, startW - (ev.clientX - startX))));
                    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                  style={{
                    width: 6, cursor: "col-resize", background: M.bd,
                    borderLeft: `1px solid ${M.bd2}`, borderRight: `1px solid ${M.bd2}`,
                    flexShrink: 0,
                  }}
                  title="드래그로 터미널 너비 조절"
                />
                <div style={{ width: slideTermW, flexShrink: 0, background: "#0a0a0a", borderLeft: `1px solid ${M.or}44`, position: "relative" }}>
                  <div style={{ position: "absolute", top: 6, right: 8, zIndex: 5, background: M.blM + "88", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>
                    🎤 발표자 시연 터미널
                  </div>
                  <Suspense fallback={<div style={{ color: M.tx3, padding: 20, fontFamily: "var(--workbook-mono)", height: "100%" }}>터미널 로딩 중...</div>}>
                    {presenterTermReady ? (
                      <Terminal key={`presenter-term-${page}-${Date.now()}`} style={{ height: "100%", borderRadius: 0, border: "none" }} fontSize={termFontSize} darkMode={darkMode} onPtyReady={({ write }) => { termWriteRef.current = write; }} />
                    ) : (
                      <div style={{ color: M.tx3, padding: 20, fontFamily: "var(--workbook-mono)", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        터미널 초기화 중...
                      </div>
                    )}
                  </Suspense>
                </div>
              </>
            )}
            </div>
          </>
        )}

        {mode === "sandbox" && (
          /* ═══ 샌드박스 모드: 터미널 + 미리보기/코드/출력 ═══ */
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* 터미널 (좌) */}
            <div style={{ width: "45%", minWidth: 280, borderRight: `1px solid ${M.bd}` }}>
              <Suspense fallback={<div style={{ color: M.tx2, padding: 20, fontFamily: "var(--workbook-mono)", background: M.bg3, height: "100%" }}>터미널 로딩 중...</div>}>
                <Terminal style={{ height: "100%", borderRadius: 0, border: "none" }} fontSize={termFontSize} darkMode={darkMode} onPtyReady={({ write }) => { termWriteRef.current = write; }} />
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
                              style={{ background: M.bg3, border: `1px solid ${M.bd}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: M.tx, fontSize: 14, fontFamily: "var(--workbook-mono)", display: "flex", alignItems: "center", gap: 4 }}>
                              <span>{icon}</span>
                              <span>{f}</span>
                              {canPreview && <span style={{ color: M.gd, fontSize: 15, fontWeight: 700 }}>미리보기</span>}
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
                        <button key={f} onClick={async () => { if (!isTauri()) return; try { const c = await tauriInvoke("read_project_file", { path: f }); setSelectedCode(c); setSelectedCodeName(f); } catch {} }}
                          style={{ display: "block", width: "100%", background: M.bg2, border: `1px solid ${M.bd}`, borderRadius: 8, padding: "10px 14px", marginBottom: 4, cursor: "pointer", color: M.or, fontSize: 15, fontFamily: "var(--workbook-mono)", textAlign: "left" }}>
                          📄 {f}
                        </button>
                      ))}
                      {selectedCodeName && (
                        <>
                          <button onClick={() => { setSelectedCodeName(""); setSelectedCode(""); }} style={{ background: "none", border: "none", color: M.tx3, cursor: "pointer", fontSize: 15, marginBottom: 8 }}>← 목록으로</button>
                          <pre style={{ background: M.bg, padding: 14, borderRadius: 8, fontSize: 15, fontFamily: "var(--workbook-mono)", color: M.tx, lineHeight: 1.7, overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>{selectedCode}</pre>
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
                        <span style={{ color: M.tx, fontSize: 15, fontFamily: "var(--workbook-mono)", flex: 1 }}>{f}</span>
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
                <button onClick={() => { if (previewFile && isTauri()) { tauriInvoke("preview_file", { filename: previewFile }).then(c => setPreviewHtml(c)).catch(() => {}); } else { refreshSandboxFiles(); } }}
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
                missionProgress.reset();
                personalization.reset();
                setPage(0);
                runtimeResetProject().then(msg => setNotice(msg)).catch(e => setNotice("실패: " + e));
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
