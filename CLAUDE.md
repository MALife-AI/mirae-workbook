# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

미래에셋생명 문서자동화 교육용 워크북. 두 가지 배포 형태로 같은 프론트엔드를 공유합니다.

- **데스크톱 앱** (`src-tauri/`): Tauri v2 + Rust. 학습자가 로컬에서 설치해 쓰는 단일 바이너리. 내장 PTY 터미널로 `claude` 실행.
- **웹 멀티유저** (`deploy/multi-user/`): nginx + ttyd + Node/Express API 서버. 한 서버에 Claude Code 한 번 깔고 user01…userNN이 브라우저(basic auth)로 각자 홈에서 사용.

프론트엔드 코드(`src/`)는 `isTauri()`로 런타임을 분기하며, 모든 백엔드 호출은 `src/lib/runtime.js`를 통과합니다 — **새 기능을 추가할 때 직접 `invoke()`/`fetch()`를 부르지 말고 반드시 이 어댑터에 Tauri/Web 양쪽 구현을 같이 추가**하세요 (파일 상단 주석 참조).

## Commands

### 개발
```bash
npm install
npx tauri dev              # 데스크톱 앱 개발 모드 (Rust + Vite)
npm run dev                # 프론트엔드만 (웹 모드 개발)
```

### 빌드
```bash
npx tauri build            # 현재 OS용 앱 빌드 (macOS/Windows/Linux)
./build-and-sign.sh        # macOS: 빌드 + ad-hoc 코드 서명
./build-windows.sh         # Windows 빌드 도우미 (호스트가 Windows여야 함 — Tauri는 크로스 컴파일 미지원)
npm run build:web          # 웹 배포용 정적 빌드 (dist/)
```

### 테스트
```bash
bash tests/run-all.sh                    # 6개 스위트 전체
bash tests/unit-shell-scripts.sh         # deploy 스크립트 단위
bash tests/integration-server.sh         # api-server/server.js 라우트 (mock 주입)
bash tests/frontend-validation.sh        # 정적 + vite build
bash tests/ui-render-check.sh            # preview 스모크
bash tests/learner-journey.sh            # user01 시나리오
bash tests/e2e-test.sh                   # 전체 플로우
```

테스트 러너는 개별 스위트 스크립트를 직접 실행하므로 단일 케이스를 돌리려면 해당 `.sh`를 열어 필요한 함수/단계를 호출하세요.

### 서버 배포
```bash
# 서버에서
sudo deploy/multi-user/setup-server.sh 20      # user01..user20 + Claude + systemd 제한
sudo deploy/multi-user/setup-ttyd.sh 20        # 브라우저 터미널
sudo deploy/multi-user/deploy-frontend.sh      # /var/www/mirae-workbook 에 dist 배치
```

## Architecture

### Tauri 백엔드 (`src-tauri/src/main.rs`, ~1200줄, 단일 파일)
`tauri::generate_handler!` 매크로에 등록된 커맨드가 프론트엔드 `invoke()`의 엔트리입니다 (파일 하단 참조). 주요 책임:

- **PTY 관리**: `portable-pty`로 `claude`/쉘 프로세스 spawn. `pty_spawn`/`pty_write`/`pty_resize`/`pty_kill`이 세션 핸들을 `AtomicU32` id로 관리.
- **PATH 확장** (`expanded_path()`): GUI 앱에서도 `node`/`npm`/`claude`를 찾도록 nvm/fnm/homebrew/cargo 경로를 합성. nvm은 `~/.nvm/versions/node` 아래에서 가장 최신 버전 bin을 동적 선택.
- **Windows Git Bash 탐색** (`find_git_bash()`): `CLAUDE_CODE_GIT_BASH_PATH` → `where git` → 표준 경로 순으로 폴백. Claude Code가 Windows에서 bash를 요구하기 때문.
- **프로젝트 폴더 I/O**: 학습자 지정 작업 폴더(기본 `~/Documents/doc-automation`) 안의 CLAUDE.md/Skill/Hook/Command 파일을 읽고 쓰기. `copy_templates_to_project`는 앱 번들의 `src-tauri/resources/templates/`(docx/pptx)를 사용자 폴더로 복사.

### 프론트엔드 (`src/`)
- `workbook.jsx` (~5000줄, 단일 파일): 모든 슬라이드 콘텐츠, 사이드바, 설정 패널. 디자인 상수 `DARK`/`LIGHT` 팔레트는 **WCAG AA 4.5:1 이상**을 목표로 하며 "다크 배경=밝은 톤 / 라이트 배경=짙은 톤" 원칙을 지키세요 (파일 상단 주석의 이유 참조).
- `NativeTerminal.jsx`: xterm.js ↔ Tauri PTY 브리지 (데스크톱 모드).
- `components/TtydEmbed.jsx`: ttyd iframe 래퍼 (웹 모드). `workbook.jsx`에서 `isTauri()`로 둘 중 하나를 지연 로드.
- `wkwebview-ime-patch.js`: macOS WKWebView의 한글 IME 이슈 우회 패치 — 건드리지 말 것.
- `hooks/useMissionProgress.js`, `hooks/usePersonalization.js`: 진행도/개인화 상태를 서버(웹) 또는 로컬 파일(Tauri)에 커밋.

### 웹 백엔드 (`deploy/multi-user/api-server/server.js`)
Express. 인증은 nginx Basic Auth가 세팅한 `X-Remote-User` 헤더를 신뢰합니다 (서비스가 이 헤더 없이 직접 노출되면 안 됨). 파일 I/O는 전부 `/home/${user}` 안으로 정규화되고(`..`·절대경로 거부), 사용자 파일 쓰기는 `write-as-user.sh`를 `sudo`로 호출해 권한을 drop합니다. 주요 스크립트 경로는 `WRITE_AS_USER_PATH` 등 환경변수로 override 가능(테스트에서 mock 주입).

관리자(`admin`)와 발표자(`user00`)는 특수 권한: `user00`이 슬라이드를 넘기면 모든 학생에게 자동 전파됩니다.

### 권한 모델 (멀티유저)
- 사용자 홈은 `chmod 750` + `chgrp workbook-readers`. api 서버 프로세스가 이 그룹에 속해야 읽기 가능.
- 사용자당 systemd slice로 CPU 150% / RAM 1.5GB / Tasks 300 제한 (`/etc/systemd/system/user-.slice.d/limits.conf`).
- 학습자 "초기화" 버튼은 `~/.claude` 및 프로젝트 파일을 전부 삭제하고 `/etc/skel`로 리셋.

## Conventions

- **한국어 주석/UI 문자열이 정상입니다.** 번역하지 마세요.
- `workbook.jsx`가 하나로 큰 것은 교안의 단일 소스로 읽히게 하려는 의도적 선택입니다. 슬라이드 단위로 잘게 쪼개는 리팩터는 수업 흐름을 깨니 지양하세요.
- Tauri는 크로스 컴파일 불가 — CI에서 `.exe`/`.dmg`를 같이 만들려면 GitHub Actions 매트릭스가 필요합니다.
- 새 커맨드를 추가할 때는 ①`main.rs`에 `#[tauri::command]` ②`generate_handler!`에 등록 ③`runtime.js`에 Tauri/Web 구현 ④필요 시 `server.js`에 라우트 — 네 곳을 같이 수정하세요.
