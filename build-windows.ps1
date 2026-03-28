# build-windows.ps1
# Windows 빌드 올인원 스크립트 (PowerShell에서 실행)
# 사용법: powershell -ExecutionPolicy Bypass -File build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VibeCodingWorkbook - Windows Build Setup"  -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─── 프로젝트 경로 결정 ───
# WSL에서 실행할 경우 Windows 파일시스템으로 복사
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$ProjectDir = $ScriptDir

# WSL 경로인 경우 Windows 쪽으로 복사
if ($ProjectDir -match "wsl") {
    $WinProject = "$env:USERPROFILE\mirae-workbook"
    Write-Host "[!] WSL filesystem detected. Copying to $WinProject ..." -ForegroundColor Yellow
    if (Test-Path $WinProject) { Remove-Item -Recurse -Force $WinProject }
    Copy-Item -Recurse -Path $ProjectDir -Destination $WinProject -Exclude @("node_modules", "dist", "target")
    $ProjectDir = $WinProject
}

Set-Location $ProjectDir
Write-Host "[OK] Project: $ProjectDir" -ForegroundColor Green

# ─── 1. Visual Studio Build Tools 확인 ───
Write-Host ""
Write-Host "[1/5] Checking Visual Studio Build Tools..." -ForegroundColor Yellow

$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVS = $false
if (Test-Path $vsWhere) {
    $vsInstall = & $vsWhere -latest -property installationPath 2>$null
    if ($vsInstall) { $hasVS = $true }
}

if (-not $hasVS) {
    # cl.exe 직접 검색
    $clExe = Get-Command cl.exe -ErrorAction SilentlyContinue
    if ($clExe) { $hasVS = $true }
}

if ($hasVS) {
    Write-Host "  Visual Studio Build Tools OK" -ForegroundColor Green
} else {
    Write-Host "  Visual Studio Build Tools not found!" -ForegroundColor Red
    Write-Host "  Installing via winget..." -ForegroundColor Yellow
    try {
        winget install --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
        Write-Host "  Build Tools installed!" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "  [ERROR] Auto-install failed." -ForegroundColor Red
        Write-Host "  Please install manually:" -ForegroundColor Red
        Write-Host "  https://visualstudio.microsoft.com/ko/visual-cpp-build-tools/" -ForegroundColor Cyan
        Write-Host '  Select: "Desktop development with C++"' -ForegroundColor Cyan
        Write-Host ""
        Read-Host "Press Enter after installing Build Tools..."
    }
}

# ─── 2. Rust 확인/설치 ───
Write-Host ""
Write-Host "[2/5] Checking Rust..." -ForegroundColor Yellow

$rustc = Get-Command rustc -ErrorAction SilentlyContinue
if ($rustc) {
    $rustVer = & rustc --version
    Write-Host "  $rustVer" -ForegroundColor Green
} else {
    Write-Host "  Rust not found. Installing..." -ForegroundColor Yellow
    try {
        # winget 시도
        winget install --id Rustlang.Rustup --accept-package-agreements --accept-source-agreements
    } catch {
        # 직접 다운로드
        Write-Host "  winget failed. Downloading rustup-init.exe..." -ForegroundColor Yellow
        $rustupUrl = "https://win.rustup.rs/x86_64"
        $rustupPath = "$env:TEMP\rustup-init.exe"
        Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath
        & $rustupPath -y --default-toolchain stable
    }

    # PATH 갱신
    $cargoPath = "$env:USERPROFILE\.cargo\bin"
    if ($env:PATH -notmatch [regex]::Escape($cargoPath)) {
        $env:PATH = "$cargoPath;$env:PATH"
    }

    $rustc2 = Get-Command rustc -ErrorAction SilentlyContinue
    if ($rustc2) {
        Write-Host "  Rust installed: $(& rustc --version)" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Rust installation failed." -ForegroundColor Red
        Write-Host "  Install manually: https://rustup.rs" -ForegroundColor Cyan
        exit 1
    }
}

# cargo bin을 PATH에 추가
$cargoPath = "$env:USERPROFILE\.cargo\bin"
if ($env:PATH -notmatch [regex]::Escape($cargoPath)) {
    $env:PATH = "$cargoPath;$env:PATH"
}

# ─── 3. Node.js 확인/설치 ───
Write-Host ""
Write-Host "[3/5] Checking Node.js..." -ForegroundColor Yellow

$nodeVer = $null
try { $nodeVer = & node --version 2>$null } catch {}

$needNode = $false
if (-not $nodeVer) {
    $needNode = $true
    Write-Host "  Node.js not found." -ForegroundColor Yellow
} elseif ([int]($nodeVer -replace 'v(\d+)\..*','$1') -lt 18) {
    $needNode = $true
    Write-Host "  Node.js $nodeVer is too old (need v18+)." -ForegroundColor Yellow
} else {
    Write-Host "  Node.js $nodeVer" -ForegroundColor Green
}

if ($needNode) {
    Write-Host "  Installing Node.js LTS..." -ForegroundColor Yellow
    try {
        winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    } catch {
        Write-Host "  winget failed. Downloading..." -ForegroundColor Yellow
        $nodeUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi"
        $nodeMsi = "$env:TEMP\node-install.msi"
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
    }

    # PATH 갱신
    $nodePath = "$env:ProgramFiles\nodejs"
    $npmGlobal = "$env:APPDATA\npm"
    if ($env:PATH -notmatch [regex]::Escape($nodePath)) {
        $env:PATH = "$npmGlobal;$nodePath;$env:PATH"
    }

    try {
        $newVer = & node --version
        Write-Host "  Node.js $newVer installed!" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Node.js install failed. Install from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
}

# ─── 4. npm 의존성 설치 ───
Write-Host ""
Write-Host "[4/5] Installing npm dependencies..." -ForegroundColor Yellow

# npm global path를 PATH에 추가
$npmGlobal = "$env:APPDATA\npm"
if ($env:PATH -notmatch [regex]::Escape($npmGlobal)) {
    $env:PATH = "$npmGlobal;$env:PATH"
}

& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed!" -ForegroundColor Green

# ─── 5. Tauri Build ───
Write-Host ""
Write-Host "[5/5] Building Tauri app..." -ForegroundColor Yellow
Write-Host ""

& npm run tauri build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Build Complete!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""

    # 결과물 경로 표시
    $nsisPath = "src-tauri\target\release\bundle\nsis"
    $exePath = "src-tauri\target\release\VibeCodingWorkbook.exe"

    if (Test-Path $nsisPath) {
        Write-Host "  NSIS Installer:" -ForegroundColor Cyan
        Get-ChildItem $nsisPath -Filter "*.exe" | ForEach-Object {
            Write-Host "    $($_.FullName)" -ForegroundColor White
        }
    }
    if (Test-Path $exePath) {
        Write-Host "  Standalone EXE:" -ForegroundColor Cyan
        Write-Host "    $(Resolve-Path $exePath)" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "  [ERROR] Build failed!" -ForegroundColor Red
    Write-Host "  Check the error messages above." -ForegroundColor Yellow
    exit 1
}
