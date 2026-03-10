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
use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

// ─── 프로젝트 디렉토리 ───
fn project_dir() -> PathBuf {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mirae-workbook")
        .join("doc-automation");
    fs::create_dir_all(&dir).ok();
    fs::create_dir_all(dir.join("templates")).ok();
    fs::create_dir_all(dir.join("output")).ok();
    fs::create_dir_all(dir.join(".claude/skills/report-writer")).ok();
    fs::create_dir_all(dir.join(".claude/skills/pptx-generator")).ok();
    fs::create_dir_all(dir.join(".claude/skills/web-researcher")).ok();
    fs::create_dir_all(dir.join(".claude/hooks")).ok();
    fs::create_dir_all(dir.join(".claude/commands")).ok();
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
    let app_clone = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit("pty_output", PtyOutput {
                        session_id,
                        data,
                    });
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
    let output = Command::new("cmd")
        .args(["/C", &command])
        .current_dir(&dir)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh")
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
fn run_claude(prompt: String) -> Result<String, String> {
    let dir = project_dir();

    let output = Command::new("claude")
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
    let dir = project_dir().join("output");
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
    let path = project_dir().join("output").join(&filename);
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

#[tauri::command]
fn check_node() -> Result<String, String> {
    let output = Command::new("node").arg("--version").output();
    match output {
        Ok(out) if out.status.success() => {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        }
        _ => Err("Node.js가 설치되어 있지 않습니다".to_string()),
    }
}

#[tauri::command]
fn check_claude() -> Result<String, String> {
    let output = Command::new("claude").arg("--version").output();
    match output {
        Ok(out) if out.status.success() => {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        }
        _ => Err("Claude Code가 설치되어 있지 않습니다".to_string()),
    }
}

#[tauri::command]
fn install_node() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("winget")
            .args(["install", "--id", "OpenJS.NodeJS.LTS", "--accept-package-agreements", "--accept-source-agreements"])
            .output();
        match output {
            Ok(out) if out.status.success() => Ok("Node.js 설치 완료!".to_string()),
            _ => Err("자동 설치 실패. https://nodejs.org 에서 직접 설치해주세요.".to_string()),
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("brew")
            .args(["install", "node@22"])
            .output();
        match output {
            Ok(out) if out.status.success() => Ok("Node.js 설치 완료!".to_string()),
            _ => Err("자동 설치 실패. https://nodejs.org 에서 직접 설치해주세요.".to_string()),
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("sh")
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
    let output = Command::new("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code"])
        .output();
    match output {
        Ok(out) if out.status.success() => Ok("Claude Code 설치 완료!".to_string()),
        Ok(out) => Err(format!(
            "설치 실패: {}",
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

fn main() {
    let dir = project_dir();
    let claude_md = dir.join("CLAUDE.md");
    if !claude_md.exists() {
        fs::write(&claude_md, include_str!("../resources/CLAUDE.md")).ok();
    }

    tauri::Builder::default()
        .manage(PtyState {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        })
        .invoke_handler(tauri::generate_handler![
            run_shell,
            run_claude,
            list_output,
            open_file,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
