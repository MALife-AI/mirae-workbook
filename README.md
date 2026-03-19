# 바이브 코딩 워크북

미래에셋생명 문서자동화 교육용 데스크톱 앱 (Tauri v2 + React)

Claude Code를 활용한 보고서/PPT 자동 생성 파이프라인을 단계별로 학습하는 워크북입니다.

## 사용법

### 1. 앱 실행

빌드된 `.app`(macOS) 또는 `.exe`(Windows) 파일을 실행합니다.
초기 설정 화면에서 Node.js, Claude Code 설치 여부를 자동 확인합니다.

### 2. 작업 폴더 설정

모듈 1 시작 시 **작업 폴더 설정** 슬라이드에서:
- "빠른 시작" 버튼 → `~/Documents/doc-automation` 폴더 자동 생성
- 또는 직접 경로 입력

### 3. 교육 진행 순서

| 단계 | 내용 | 설명 |
|------|------|------|
| **모듈 1** | AI 에이전트 활용 | CLAUDE.md → Skill → Command → Hook 순서로 학습 |
| **모듈 2** | 프로그램 고도화 | 컨텍스트 관리, MCP 연결, 병렬 실행 |
| **최종 실습** | 부서별 AI 자동화 | 경영기획/상품개발/준법감시/마케팅 부서별 실습 |

### 4. 핵심 학습 흐름 (모듈 1)

각 개념은 **이란? → 구조 → 전후비교 → 예시 → 체험** 순서로 진행됩니다.

```
① CLAUDE.md 만들기  →  프로젝트 기본 규칙 (언어, 톤, 색상)
② Skill 만들기      →  업무별 세부 절차 (보고서 6섹션 구조 등)
③ Command 만들기    →  스킬을 연결하는 워크플로우 (/report)
④ Hook 만들기       →  보안 자동 검사 (개인정보 차단)
⑤ 템플릿 복사       →  미래에셋생명 공식 양식 적용
⑥ 실습              →  보고서 생성 웹 UI 제작
```

### 5. 체험 슬라이드 사용법

- 슬라이드에 표시된 프롬프트를 **편집** 가능 — 내용을 수정한 뒤
- **📋 복사** 버튼으로 클립보드에 복사
- 하단 **터미널**에 붙여넣기 후 실행
- 다음 체험으로 넘어갈 때 `/clear`로 대화 초기화 권장

### 6. 터미널 사용법

앱 하단에 내장 터미널이 있습니다.

| 명령어 | 설명 |
|--------|------|
| `claude` | Claude Code 실행 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (토큰 절약) |
| `/report 주제` | 보고서 자동 생성 (Command 설정 후) |
| `/exit` | Claude Code 종료 |

### 7. 초기화

사이드바 하단 **🗑 초기화** 버튼:
- 프로젝트 파일 전체 삭제 (CLAUDE.md, Skill, Hook, Command)
- templates/ 및 outputs/ 내 파일 삭제
- Claude Code 메모리 삭제
- 폴더 구조(templates/, outputs/)는 유지

### 8. 설정

사이드바 하단 **⚙ 설정** 버튼:
- 코드 글씨 크기 조절 (슬라이드 내 코드 블록, 터미널에 적용)
- 터미널 글씨 크기 조절
- 다크/라이트 모드 전환

## 주요 기능

- **모듈별 단계 교육** — 개념 → 구조 → 전후비교 → 예시 → 체험 패턴
- **내장 터미널** (xterm.js + PTY) — 앱 내에서 바로 Claude Code 실행
- **프로젝트 파일 관리** — CLAUDE.md, Skill, Hook, Command 원클릭 생성 & 인앱 편집
- **플랫폼 자동 감지** — macOS/Windows 명령어 자동 분기
- **작업 폴더 지정** — 사용자가 원하는 경로에 프로젝트 생성
- **템플릿 관리** — 앱 번들에서 사용자 폴더로 복사
- **최종 실습** — 4개 부서별 실무 예제 (편집 가능 프롬프트)

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Tauri v2 |
| 프론트엔드 | React + Vite |
| 백엔드 | Rust |
| 터미널 | portable-pty + xterm.js |

## 사전 요구사항

- **Node.js** 18 이상
- **Rust** (rustup으로 설치)
- **시스템 빌드 도구** (OS별 아래 참고)

## 개발 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npx tauri dev
```

## 빌드

### macOS

```bash
# 사전 요구: Xcode Command Line Tools
xcode-select --install

# 빌드
npx tauri build
```

빌드 결과물:
- `.app` → `src-tauri/target/release/bundle/macos/바이브 코딩 워크북.app`
- `.dmg` → `src-tauri/target/release/bundle/dmg/바이브 코딩 워크북_1.0.0_aarch64.dmg`

### Windows

```powershell
# 사전 요구: Visual Studio Build Tools (C++ 데스크톱 개발 워크로드)
# https://visualstudio.microsoft.com/visual-cpp-build-tools/ 에서 설치

# 사전 요구: WebView2 Runtime (Windows 10 이하)
# Windows 11은 기본 포함

# 빌드
npx tauri build
```

빌드 결과물:
- `.exe` (설치파일) → `src-tauri/target/release/bundle/nsis/바이브 코딩 워크북_1.0.0_x64-setup.exe`
- `.msi` → `src-tauri/target/release/bundle/msi/바이브 코딩 워크북_1.0.0_x64_ko-KR.msi`

### Linux

```bash
# 사전 요구 (Ubuntu/Debian)
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# 빌드
npx tauri build
```

빌드 결과물:
- `.deb` → `src-tauri/target/release/bundle/deb/`
- `.AppImage` → `src-tauri/target/release/bundle/appimage/`

> **참고:** Tauri는 크로스 컴파일을 지원하지 않습니다. Windows .exe는 Windows에서, macOS .dmg는 macOS에서 빌드해야 합니다. GitHub Actions를 사용하면 여러 OS에서 동시에 빌드할 수 있습니다.

## 프로젝트 구조

```
mirae-workbook/
├── src/
│   ├── workbook.jsx          # 메인 앱 (슬라이드 콘텐츠 + UI)
│   ├── NativeTerminal.jsx    # xterm.js 내장 터미널
│   └── main.jsx              # 엔트리포인트
├── src-tauri/
│   ├── src/main.rs           # Rust 백엔드 (PTY, 파일 I/O, 폴더 관리)
│   ├── tauri.conf.json       # Tauri 설정
│   ├── resources/templates/  # 미래에셋생명 공식 템플릿 (docx/pptx)
│   └── icons/                # 앱 아이콘
├── index.html
├── vite.config.js
└── package.json
```

## 라이선스

내부 교육용
