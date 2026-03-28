#!/bin/bash
# WSL에서 Windows 빌드를 트리거하는 스크립트
# 사용법: ./build-windows.sh
set -e

cd "$(dirname "$0")"

echo ""
echo "=== VibeCodingWorkbook Windows Build (from WSL) ==="
echo ""

# WSL 환경인지 확인
if ! grep -qi microsoft /proc/version 2>/dev/null; then
    echo "This script is for WSL only."
    echo "On native Windows, run: powershell -ExecutionPolicy Bypass -File build-windows.ps1"
    exit 1
fi

# Windows 쪽 프로젝트 경로
WIN_HOME=$(wslpath "$(cmd.exe /C 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")
WIN_PROJECT="$WIN_HOME/mirae-workbook"

echo "[1/3] Syncing project to Windows filesystem..."
echo "  From: $(pwd)"
echo "  To:   $WIN_PROJECT"

# node_modules, dist, target 제외하고 복사
mkdir -p "$WIN_PROJECT"
rsync -a --delete \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'src-tauri/target' \
    --exclude '.git' \
    ./ "$WIN_PROJECT/"

echo "  Sync complete!"

echo ""
echo "[2/3] Launching Windows build..."
echo ""

# PowerShell로 빌드 실행
WIN_PROJECT_PATH=$(wslpath -w "$WIN_PROJECT")
powershell.exe -ExecutionPolicy Bypass -Command "
    Set-Location '$WIN_PROJECT_PATH'
    & '$WIN_PROJECT_PATH\build-windows.ps1'
"

BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
    echo ""
    echo "[3/3] Copying build artifacts back to WSL..."

    # NSIS installer 복사
    NSIS_DIR="$WIN_PROJECT/src-tauri/target/release/bundle/nsis"
    if [ -d "$NSIS_DIR" ]; then
        mkdir -p ./build-output
        cp "$NSIS_DIR"/*.exe ./build-output/ 2>/dev/null && \
            echo "  Installer copied to ./build-output/"
    fi

    # standalone exe 복사
    EXE_PATH="$WIN_PROJECT/src-tauri/target/release/VibeCodingWorkbook.exe"
    if [ -f "$EXE_PATH" ]; then
        mkdir -p ./build-output
        cp "$EXE_PATH" ./build-output/ && \
            echo "  EXE copied to ./build-output/"
    fi

    echo ""
    echo "=== Build Complete! ==="
    ls -lh ./build-output/ 2>/dev/null
else
    echo ""
    echo "=== Build Failed ==="
    exit 1
fi
