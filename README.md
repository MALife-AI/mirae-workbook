# 바이브 코딩 워크북

미래에셋생명 문서자동화 교육용 데스크톱 앱 (Tauri v2 + React)

Claude Code를 활용한 보고서/PPT 자동 생성 파이프라인을 단계별로 학습하는 워크북입니다.

## 주요 기능

- **10개 챕터** 단계별 교육 콘텐츠 (개요 → 설치 → 파이프라인 → 실전실습)
- **내장 터미널** (xterm.js + PTY) — 앱 내에서 바로 Claude Code 실행
- **프로젝트 파일 생성/편집** — CLAUDE.md, SKILL.md, Hook 설정 등 원클릭 생성 & 인앱 편집
- **Claude Code 5대 개념** 학습: Prompt, CLAUDE.md, Skill, Hook, MCP

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
│   ├── workbook.jsx          # 메인 앱 (챕터 콘텐츠 + UI)
│   ├── NativeTerminal.jsx    # xterm.js 내장 터미널
│   └── main.jsx              # 엔트리포인트
├── src-tauri/
│   ├── src/main.rs           # Rust 백엔드 (PTY, 파일 I/O)
│   ├── tauri.conf.json       # Tauri 설정
│   ├── resources/CLAUDE.md   # 기본 CLAUDE.md 템플릿
│   └── icons/                # 앱 아이콘
├── index.html
├── vite.config.js
└── package.json
```

## 라이선스

내부 교육용
