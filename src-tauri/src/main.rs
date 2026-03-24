// src-tauri/src/main.rs
// 미래에셋생명 문서자동화 워크북 — Tauri 백엔드

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::{Read as IoRead, Write as IoWrite};
use std::process::Command;
use std::path::PathBuf;
use std::fs;
use std::sync::{Arc, Mutex, atomic::{AtomicU32, AtomicBool, Ordering}};
use std::thread;

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter};
use serde::Serialize;



/// GUI 앱에서도 node/npm/claude 등을 찾을 수 있도록 확장된 PATH 반환
fn expanded_path() -> String {
    let base = std::env::var("PATH").unwrap_or_default();

    #[cfg(target_os = "windows")]
    {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let pf_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
        let extra = format!(
            "{}\\AppData\\Roaming\\npm;{}\\.cargo\\bin;{}\\nodejs;{}\\nodejs;{}\\Git\\bin;{}\\Git\\cmd;{}\\Git\\bin;{}\\Git\\cmd",
            home, home, program_files, pf_x86, program_files, program_files, pf_x86, pf_x86
        );
        format!("{};{}", extra, base)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        // nvm, homebrew, cargo, volta, fnm 등 주요 경로 포함
        let candidates = [
            format!("{}/.nvm/versions/node", home),
        ];
        // nvm: 가장 최신 버전의 bin 디렉토리 찾기
        let mut nvm_bin = String::new();
        for base_dir in &candidates {
            if let Ok(entries) = fs::read_dir(base_dir) {
                let mut versions: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().join("bin").exists())
                    .map(|e| e.path())
                    .collect();
                versions.sort();
                if let Some(latest) = versions.last() {
                    nvm_bin = latest.join("bin").to_string_lossy().to_string();
                }
            }
        }
        let extra = format!(
            "{}:{}/.cargo/bin:{}/Library/Application Support/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin",
            nvm_bin, home, home
        );
        format!("{}:{}", extra, base)
    }
}

/// Command에 확장된 PATH를 설정
fn command_with_path(program: &str) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PATH", expanded_path());
    cmd
}

// ─── 프로젝트 디렉토리 ───
fn project_dir_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mirae-workbook")
        .join(".project_dir")
}

fn project_dir() -> PathBuf {
    // 사용자가 지정한 폴더가 있으면 그것을 사용
    if let Ok(custom) = fs::read_to_string(project_dir_config_path()) {
        let custom = custom.trim().to_string();
        if !custom.is_empty() {
            let p = PathBuf::from(&custom);
            if p.exists() {
                fs::create_dir_all(p.join("templates")).ok();
                fs::create_dir_all(p.join("outputs")).ok();
                return p;
            }
        }
    }
    // 기본 경로
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mirae-workbook")
        .join("doc-automation");
    fs::create_dir_all(&dir).ok();
    fs::create_dir_all(dir.join("templates")).ok();
    fs::create_dir_all(dir.join("outputs")).ok();
    dir
}

// ─── PTY 세션 관리 ───
struct PtySession {
    writer: Box<dyn IoWrite + Send>,
    pair: portable_pty::PtyPair,
    alive: Arc<AtomicBool>,
}

struct PtyState {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct PtyOutput {
    session_id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct PtyExit {
    session_id: u32,
}

// ─── PTY 명령어들 ───
#[tauri::command]
fn pty_spawn(
    shell: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyState>,
    app: AppHandle,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY 생성 실패: {}", e))?;

    let shell_path = if shell.is_empty() {
        #[cfg(target_os = "windows")]
        {
            // Windows: PowerShell 우선, 없으면 cmd.exe
            std::env::var("COMSPEC").unwrap_or_else(|_| {
                if std::path::Path::new("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe").exists() {
                    "powershell.exe".to_string()
                } else {
                    "cmd.exe".to_string()
                }
            })
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
        }
    } else {
        shell
    };

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(project_dir());

    // 환경변수 설정 — PATH에 cargo, npm 경로 포함
    #[cfg(target_os = "windows")]
    {
        if let Ok(path) = std::env::var("PATH") {
            let home = std::env::var("USERPROFILE").unwrap_or_default();
            let extra = format!("{}\\.cargo\\bin;{}\\AppData\\Roaming\\npm", home, home);
            cmd.env("PATH", format!("{};{}", extra, path));
        }
        cmd.env("TERM", "xterm-256color");
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(path) = std::env::var("PATH") {
            let home = std::env::var("HOME").unwrap_or_default();
            let extra = format!("{}/.cargo/bin:{}/.nvm/versions/node/*/bin:/usr/local/bin", home, home);
            cmd.env("PATH", format!("{}:{}", extra, path));
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("LANG", "ko_KR.UTF-8");
    }
    // Claude Code 중첩 세션 방지 — 환경변수 제거
    cmd.env_remove("CLAUDECODE");

    // 저장된 API 키가 있으면 PTY에 주입
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            cmd.env("ANTHROPIC_API_KEY", &key);
        }
    }

    let child = pair.slave
        .spawn_command(cmd)
        .map_err(|e| format!("셸 실행 실패: {}", e))?;

    let writer = pair.master
        .take_writer()
        .map_err(|e| format!("Writer 획득 실패: {}", e))?;

    let mut reader = pair.master
        .try_clone_reader()
        .map_err(|e| format!("Reader 획득 실패: {}", e))?;

    let session_id = state.next_id.fetch_add(1, Ordering::SeqCst);
    let alive = Arc::new(AtomicBool::new(true));
    let alive_clone = alive.clone();

    // 백그라운드 스레드: PTY 출력 → Tauri 이벤트
    // 한글(UTF-8 3바이트)이 read 경계에서 잘리지 않도록 잔여 바이트를 버퍼링
    let app_clone = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending = Vec::<u8>::new(); // 불완전한 UTF-8 바이트 보관
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    // 끝에서부터 불완전한 UTF-8 시퀀스 길이를 구한다
                    let valid_up_to = match std::str::from_utf8(&pending) {
                        Ok(_) => pending.len(),
                        Err(e) => e.valid_up_to(),
                    };
                    if valid_up_to > 0 {
                        let data = String::from_utf8_lossy(&pending[..valid_up_to]).to_string();
                        let _ = app_clone.emit("pty_output", PtyOutput {
                            session_id,
                            data,
                        });
                    }
                    // 남은 불완전 바이트를 다음 read에 이어붙이기
                    if valid_up_to < pending.len() {
                        let leftover = pending[valid_up_to..].to_vec();
                        pending.clear();
                        pending.extend_from_slice(&leftover);
                    } else {
                        pending.clear();
                    }
                }
                Err(_) => break,
            }
        }
        alive_clone.store(false, Ordering::SeqCst);
        let _ = app_clone.emit("pty_exit", PtyExit { session_id });
    });

    state.sessions.lock().unwrap().insert(session_id, PtySession {
        writer,
        pair,
        alive,
    });

    // child 프로세스는 별도 스레드에서 대기
    thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
    });

    Ok(session_id)
}

#[tauri::command]
fn pty_write(
    session_id: u32,
    data: String,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        session.writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("쓰기 오류: {}", e))?;
        session.writer.flush().ok();
        Ok(())
    } else {
        Err("세션을 찾을 수 없습니다".to_string())
    }
}

#[tauri::command]
fn pty_resize(
    session_id: u32,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        session.pair.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("리사이즈 오류: {}", e))?;
        Ok(())
    } else {
        Err("세션을 찾을 수 없습니다".to_string())
    }
}

#[tauri::command]
fn pty_kill(
    session_id: u32,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&session_id) {
        session.alive.store(false, Ordering::SeqCst);
        drop(session);
        Ok(())
    } else {
        Ok(())
    }
}

// ─── 기존 명령어들 ───

#[tauri::command]
fn run_shell(command: String) -> Result<String, String> {
    let dir = project_dir();

    #[cfg(target_os = "windows")]
    let output = command_with_path("cmd")
        .args(["/C", &command])
        .current_dir(&dir)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = command_with_path("sh")
        .args(["-c", &command])
        .current_dir(&dir)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Ok(format!("{}{}", stdout, stderr))
            }
        }
        Err(e) => Err(format!("실행 오류: {}", e)),
    }
}

#[tauri::command]
fn start_claude_login() -> Result<String, String> {
    // claude login을 별도 창에서 실행 (브라우저가 열림)
    #[cfg(target_os = "windows")]
    let result = {
        let mut cmd = command_with_path("cmd");
        cmd.env("CLAUDE_CODE_GIT_BASH_PATH", "C:\\Program Files\\Git\\bin\\bash.exe");
        cmd.args(["/C", "start", "Claude 로그인", "cmd", "/K",
            "echo ========================================= && echo   Claude Code 로그인 && echo ========================================= && echo. && echo 브라우저가 열립니다. 로그인 후 이 창으로 돌아오세요. && echo. && set CLAUDE_CODE_GIT_BASH_PATH=C:\\Program Files\\Git\\bin\\bash.exe && claude login && echo. && echo ========================================= && echo   로그인 완료! 이 창을 닫아주세요. && echo ========================================="])
            .spawn()
    };

    #[cfg(not(target_os = "windows"))]
    let result = command_with_path("sh")
        .args(["-c", "claude login &"])
        .spawn();

    match result {
        Ok(_) => Ok("로그인 프로세스 시작됨".to_string()),
        Err(e) => Err(format!("claude login 실행 실패: {}", e)),
    }
}

#[tauri::command]
fn check_auth_status() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = command_with_path("cmd")
        .args(["/C", "claude", "auth", "status"])
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = command_with_path("claude")
        .args(["auth", "status"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr);
            if combined.contains("\"loggedIn\": true") || combined.contains("\"loggedIn\":true") || combined.contains("Authenticated") {
                Ok("authenticated".to_string())
            } else {
                Err(format!("미인증: {}", combined))
            }
        }
        Err(e) => Err(format!("상태 확인 실패: {}", e)),
    }
}

#[tauri::command]
fn run_claude(prompt: String) -> Result<String, String> {
    let dir = project_dir();

    #[cfg(target_os = "windows")]
    let output = command_with_path("cmd")
        .args(["/C", "claude", "-p", &prompt])
        .current_dir(&dir)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = command_with_path("claude")
        .args(["-p", &prompt])
        .current_dir(&dir)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            Ok(format!("{}{}", stdout, stderr))
        }
        Err(e) => Err(format!(
            "Claude Code 실행 오류: {}\n\nClaude Code가 설치되어 있는지 확인하세요:\nnpm install -g @anthropic-ai/claude-code",
            e
        )),
    }
}

#[tauri::command]
fn list_output() -> Result<Vec<String>, String> {
    let dir = project_dir().join("outputs");
    match fs::read_dir(&dir) {
        Ok(entries) => {
            let files: Vec<String> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            Ok(files)
        }
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
fn open_file(filename: String) -> Result<(), String> {
    let path = project_dir().join("outputs").join(&filename);
    if !path.exists() {
        return Err(format!("파일을 찾을 수 없습니다: {}", filename));
    }

    #[cfg(target_os = "windows")]
    Command::new("cmd").args(["/C", "start", "", &path.to_string_lossy()]).spawn().ok();

    #[cfg(target_os = "macos")]
    Command::new("open").arg(&path).spawn().ok();

    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&path).spawn().ok();

    Ok(())
}

/// 파일을 HTML로 변환하여 미리보기 (macOS: textutil 사용)
#[tauri::command]
fn preview_file(filename: String) -> Result<String, String> {
    let path = project_dir().join("outputs").join(&filename);
    if !path.exists() {
        return Err(format!("파일을 찾을 수 없습니다: {}", filename));
    }

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    match ext.as_str() {
        "html" | "htm" => {
            fs::read_to_string(&path).map_err(|e| format!("읽기 실패: {}", e))
        }
        "docx" | "doc" | "rtf" => {
            // macOS textutil로 HTML 변환
            let output = Command::new("textutil")
                .args(["-convert", "html", "-stdout"])
                .arg(&path)
                .output()
                .map_err(|e| format!("textutil 실행 실패: {}", e))?;
            if output.status.success() {
                let html = String::from_utf8_lossy(&output.stdout).to_string();
                // 기본 스타일 추가
                Ok(format!(
                    "<html><head><meta charset='utf-8'><style>body{{font-family:-apple-system,sans-serif;padding:20px;max-width:800px;margin:0 auto;line-height:1.6;color:#333}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ddd;padding:8px}}</style></head><body>{}</body></html>",
                    html
                ))
            } else {
                let err = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("변환 실패: {}", err))
            }
        }
        "pptx" | "ppt" => {
            // pptx → Quick Look으로 썸네일 이미지 생성
            let tmp_dir = std::env::temp_dir().join("mirae-preview");
            fs::create_dir_all(&tmp_dir).ok();
            let output = Command::new("qlmanage")
                .args(["-t", "-s", "1200", "-o"])
                .arg(&tmp_dir)
                .arg(&path)
                .output()
                .map_err(|e| format!("qlmanage 실행 실패: {}", e))?;
            if output.status.success() {
                // 생성된 PNG 파일 찾기
                let png_name = format!("{}.png", filename);
                let png_path = tmp_dir.join(&png_name);
                if png_path.exists() {
                    let bytes = fs::read(&png_path).map_err(|e| format!("이미지 읽기 실패: {}", e))?;
                    let b64 = base64_encode(&bytes);
                    fs::remove_file(&png_path).ok();
                    Ok(format!(
                        "<html><head><style>body{{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e}}img{{max-width:100%;max-height:100vh;box-shadow:0 4px 20px rgba(0,0,0,0.5)}}</style></head><body><img src='data:image/png;base64,{}'></body></html>",
                        b64
                    ))
                } else {
                    Err("썸네일 생성 실패".to_string())
                }
            } else {
                Err("qlmanage 실행 실패".to_string())
            }
        }
        "txt" | "md" | "json" | "csv" => {
            let content = fs::read_to_string(&path).map_err(|e| format!("읽기 실패: {}", e))?;
            let escaped = content.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
            Ok(format!(
                "<html><head><meta charset='utf-8'><style>body{{font-family:'JetBrains Mono',monospace;padding:20px;background:#021018;color:#E5E8EC;white-space:pre-wrap;font-size:13px;line-height:1.6}}</style></head><body>{}</body></html>",
                escaped
            ))
        }
        _ => {
            Err(format!("미리보기를 지원하지 않는 형식입니다: .{}", ext))
        }
    }
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 { result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char); } else { result.push('='); }
        if chunk.len() > 2 { result.push(CHARS[(triple & 0x3F) as usize] as char); } else { result.push('='); }
    }
    result
}

#[tauri::command]
fn check_node() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = command_with_path("cmd")
        .args(["/C", "node", "--version"])
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = command_with_path("node").arg("--version").output();

    match output {
        Ok(out) if out.status.success() => {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        }
        _ => Err("Node.js가 설치되어 있지 않습니다".to_string()),
    }
}

#[tauri::command]
fn check_claude() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // 1차: cmd /C claude
        let output = command_with_path("cmd")
            .args(["/C", "claude", "--version"])
            .output();
        if let Ok(out) = &output {
            if out.status.success() {
                return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
        // 2차: 직접 경로 시도
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        let direct = format!("{}\\AppData\\Roaming\\npm\\claude.cmd", home);
        let output2 = Command::new("cmd")
            .args(["/C", &direct, "--version"])
            .output();
        match output2 {
            Ok(out) if out.status.success() => {
                Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
            }
            _ => Err("Claude Code가 설치되어 있지 않습니다".to_string()),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = command_with_path("claude").arg("--version").output();
        match output {
            Ok(out) if out.status.success() => {
                Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
            }
            _ => Err("Claude Code가 설치되어 있지 않습니다".to_string()),
        }
    }
}

#[tauri::command]
fn install_node() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // 먼저 winget 시도 (보이는 창)
        let output = command_with_path("cmd")
            .args(["/C", "start", "/wait", "Node.js 설치", "cmd", "/C",
                "echo ========================================= && echo   Node.js 설치 중... && echo ========================================= && echo. && winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements && echo. && echo 설치 완료! && timeout /t 3 >nul"])
            .output();
        match output {
            Ok(out) if out.status.success() => return Ok("Node.js 설치 완료! 앱을 재시작해주세요.".to_string()),
            _ => {}
        }
        // winget 실패 시 powershell로 직접 다운로드
        let ps_cmd = r#"
            $url = 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi'
            $out = "$env:TEMP\node-install.msi"
            Invoke-WebRequest -Uri $url -OutFile $out
            Start-Process msiexec.exe -ArgumentList "/i `"$out`" /qn" -Wait -Verb RunAs
        "#;
        let output2 = command_with_path("powershell")
            .args(["-ExecutionPolicy", "Bypass", "-Command", ps_cmd])
            .output();
        match output2 {
            Ok(out) if out.status.success() => Ok("Node.js 설치 완료! 앱을 재시작해주세요.".to_string()),
            Ok(out) => Err(format!(
                "자동 설치 실패: {}. https://nodejs.org 에서 직접 설치해주세요.",
                String::from_utf8_lossy(&out.stderr)
            )),
            Err(e) => Err(format!("설치 오류: {}. https://nodejs.org 에서 직접 설치해주세요.", e)),
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = command_with_path("brew")
            .args(["install", "node@22"])
            .output();
        match output {
            Ok(out) if out.status.success() => Ok("Node.js 설치 완료!".to_string()),
            _ => Err("자동 설치 실패. https://nodejs.org 에서 직접 설치해주세요.".to_string()),
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = command_with_path("sh")
            .args(["-c", "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"])
            .output();
        match output {
            Ok(out) if out.status.success() => Ok("Node.js 설치 완료!".to_string()),
            _ => Err("자동 설치 실패. https://nodejs.org 에서 직접 설치해주세요.".to_string()),
        }
    }
}

#[tauri::command]
fn install_claude_code() -> Result<String, String> {
    // Windows: Git Bash 확인 → 없으면 Git 먼저 설치 → Claude Code 설치
    #[cfg(target_os = "windows")]
    let output = {
        // Git Bash 존재 확인
        let git_check = Command::new("cmd")
            .args(["/C", "where", "git"])
            .output();
        let has_git = matches!(&git_check, Ok(out) if out.status.success());

        if !has_git {
            // Git 설치 (winget)
            let _ = command_with_path("cmd")
                .args(["/C", "start", "/wait", "Git 설치", "cmd", "/C",
                    "echo ========================================= && echo   Git 설치 중... (Claude Code에 필요) && echo ========================================= && echo. && winget install --id Git.Git --accept-package-agreements --accept-source-agreements && echo. && echo Git 설치 완료! && timeout /t 3 >nul"])
                .output();
        }

        // Claude Code 설치
        command_with_path("cmd")
            .args(["/C", "start", "/wait", "Claude Code 설치", "cmd", "/C",
                "echo ========================================= && echo   Claude Code 설치 중... && echo ========================================= && echo. && npm install -g @anthropic-ai/claude-code && echo. && echo ========================================= && echo   설치 완료! 이 창은 자동으로 닫힙니다. && echo ========================================= && timeout /t 3 >nul"])
            .output()
    };

    #[cfg(not(target_os = "windows"))]
    let output = command_with_path("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            // 설치 후 바로 확인 — 실제로 실행 가능한지 체크
            #[cfg(target_os = "windows")]
            {
                let verify = command_with_path("cmd")
                    .args(["/C", "claude", "--version"])
                    .output();
                match verify {
                    Ok(v) if v.status.success() => Ok(format!(
                        "Claude Code 설치 완료! ({})",
                        String::from_utf8_lossy(&v.stdout).trim()
                    )),
                    _ => Ok("Claude Code 설치 완료! 앱을 재시작하면 인식됩니다.".to_string()),
                }
            }
            #[cfg(not(target_os = "windows"))]
            Ok("Claude Code 설치 완료!".to_string())
        }
        Ok(out) => Err(format!(
            "설치 실패: {}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        )),
        Err(e) => Err(format!("npm 실행 오류: {}. Node.js가 먼저 설치되어야 합니다.", e)),
    }
}

// ─── 프로젝트 내 파일 읽기 ───
#[tauri::command]
fn read_project_file(path: String) -> Result<String, String> {
    if path.contains("..") {
        return Err("잘못된 경로입니다".to_string());
    }
    let full = project_dir().join(&path);
    fs::read_to_string(&full)
        .map_err(|e| format!("파일 읽기 실패: {}", e))
}

// ─── 프로젝트 내 파일 존재 확인 ───
#[tauri::command]
fn check_project_file(path: String) -> bool {
    if path.contains("..") { return false; }
    project_dir().join(&path).exists()
}

// ─── 프로젝트 내 파일 쓰기 ───
#[tauri::command]
fn write_project_file(path: String, content: String) -> Result<String, String> {
    let full = project_dir().join(&path);

    // 경로 탈출 방지
    if path.contains("..") {
        return Err("잘못된 경로입니다".to_string());
    }

    // 상위 디렉토리 자동 생성
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).ok();
    }

    fs::write(&full, &content)
        .map_err(|e| format!("파일 쓰기 실패: {}", e))?;

    Ok(full.to_string_lossy().to_string())
}

#[tauri::command]
fn get_project_path() -> String {
    project_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn set_project_dir(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| format!("폴더 생성 실패: {}", e))?;
    }
    if !p.is_dir() {
        return Err("경로가 폴더가 아닙니다".to_string());
    }
    // templates, outputs 하위 폴더 생성
    fs::create_dir_all(p.join("templates")).ok();
    fs::create_dir_all(p.join("outputs")).ok();
    // 설정 파일에 저장
    let config = project_dir_config_path();
    if let Some(parent) = config.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&config, &path).map_err(|e| format!("설정 저장 실패: {}", e))?;
    Ok(path)
}

#[tauri::command]
fn copy_templates_to_project(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let templates_dir = project_dir().join("templates");
    fs::create_dir_all(&templates_dir).ok();
    let template_files = [
        "미래에셋생명_A.docx", "미래에셋생명_A.pptx",
        "미래에셋생명_B.docx", "미래에셋생명_B.pptx",
        "미래에셋생명_C.docx", "미래에셋생명_C.pptx",
    ];
    let mut copied = vec![];
    for name in &template_files {
        let dest = templates_dir.join(name);
        if let Ok(resource_path) = app_handle.path().resolve(
            format!("resources/templates/{}", name),
            tauri::path::BaseDirectory::Resource,
        ) {
            if resource_path.exists() {
                fs::copy(&resource_path, &dest).ok();
                copied.push(name.to_string());
            }
        }
    }
    Ok(format!("템플릿 {}개 복사 완료", copied.len()))
}

// ─── API 키 저장/조회 ───
fn api_key_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mirae-workbook")
        .join(".api_key")
}

#[tauri::command]
fn save_api_key(key: String) -> Result<String, String> {
    let path = api_key_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&path, key.trim())
        .map_err(|e| format!("API 키 저장 실패: {}", e))?;

    // 현재 프로세스 환경변수에도 설정 (PTY에서 상속되도록)
    std::env::set_var("ANTHROPIC_API_KEY", key.trim());
    Ok("저장 완료".to_string())
}

#[tauri::command]
fn load_api_key() -> Result<String, String> {
    // 1) 환경변수에 이미 있으면 사용
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    // 2) 저장된 파일에서 읽기
    let path = api_key_path();
    match fs::read_to_string(&path) {
        Ok(key) if !key.trim().is_empty() => {
            std::env::set_var("ANTHROPIC_API_KEY", key.trim());
            Ok(key.trim().to_string())
        }
        _ => Err("API 키가 설정되지 않았습니다".to_string()),
    }
}

#[tauri::command]
fn set_env_for_pty(key: String, value: String) {
    std::env::set_var(&key, &value);
}

/// 프로젝트 파일 전체 초기화 (templates, outputs 내용물 포함 전부 삭제, 폴더 구조만 유지)
#[tauri::command]
fn reset_project() -> Result<String, String> {
    let dir = project_dir();
    let mut removed = vec![];

    let entries = fs::read_dir(&dir).map_err(|e| format!("디렉토리 읽기 실패: {}", e))?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        if name == "outputs" || name == "templates" {
            // 폴더는 유지하되 안의 파일만 삭제
            if let Ok(files) = fs::read_dir(&path) {
                let mut count = 0;
                for f in files.flatten() {
                    if f.path().is_file() {
                        fs::remove_file(f.path()).ok();
                        count += 1;
                    }
                }
                if count > 0 {
                    removed.push(format!("{}/내 파일 {}개", name, count));
                }
            }
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(&path).ok();
            removed.push(name);
        } else if path.is_file() {
            fs::remove_file(&path).ok();
            removed.push(name);
        }
    }

    // Claude Code 프로젝트 메모리 삭제 (~/.claude/projects/에서 이 프로젝트에 해당하는 폴더)
    if let Some(home) = dirs::home_dir() {
        let claude_projects = home.join(".claude").join("projects");
        if claude_projects.exists() {
            // project_dir 경로를 Claude Code 프로젝트 키로 변환 (/ → -)
            let proj_path = dir.to_string_lossy().replace('/', "-");
            if let Ok(entries) = fs::read_dir(&claude_projects) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if proj_path.contains(&name) || name.contains("mirae-workbook") || name.contains("doc-automation") {
                        if entry.path().is_dir() {
                            fs::remove_dir_all(entry.path()).ok();
                            removed.push(format!("Claude 메모리({})", name));
                        }
                    }
                }
            }
        }
    }

    Ok(format!("초기화 완료: {}", if removed.is_empty() { "삭제할 항목 없음".to_string() } else { removed.join(", ") }))
}


fn main() {
    let _dir = project_dir();
    // CLAUDE.md, Skill, Hook 등은 강의 중 SetupFiles 버튼이나 Claude Code로 생성

    // 저장된 API 키가 있으면 프로세스 환경변수에 로드
    if let Ok(key) = fs::read_to_string(api_key_path()) {
        let key = key.trim();
        if !key.is_empty() {
            std::env::set_var("ANTHROPIC_API_KEY", key);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_pty::init())
        .manage(PtyState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        })
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_shell,
            start_claude_login,
            check_auth_status,
            run_claude,
            list_output,
            open_file,
            preview_file,
            check_node,
            check_claude,
            install_node,
            install_claude_code,
            get_project_path,
            read_project_file,
            check_project_file,
            write_project_file,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            save_api_key,
            load_api_key,
            set_env_for_pty,
            reset_project,
            set_project_dir,
            copy_templates_to_project,
            get_expanded_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_expanded_path() -> String {
    expanded_path()
}
