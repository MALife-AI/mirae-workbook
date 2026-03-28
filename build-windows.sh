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

    RELEASE_DIR="$WIN_PROJECT/src-tauri/target/release"

    # NSIS installer 복사
    NSIS_DIR="$RELEASE_DIR/bundle/nsis"
    if [ -d "$NSIS_DIR" ]; then
        mkdir -p ./build-output/installer
        cp "$NSIS_DIR"/*.exe ./build-output/installer/ 2>/dev/null && \
            echo "  Installer → ./build-output/installer/"
    fi

    # Standalone 포터블 버전 구성 (exe + resources)
    STANDALONE_DIR="./build-output/standalone"
    rm -rf "$STANDALONE_DIR"
    mkdir -p "$STANDALONE_DIR"

    # exe 복사 (mirae-workbook.exe 또는 VibeCodingWorkbook.exe)
    for name in "mirae-workbook.exe" "VibeCodingWorkbook.exe"; do
        if [ -f "$RELEASE_DIR/$name" ]; then
            cp "$RELEASE_DIR/$name" "$STANDALONE_DIR/VibeCodingWorkbook.exe"
            echo "  EXE → $STANDALONE_DIR/VibeCodingWorkbook.exe"
            break
        fi
    done

    # 리소스 복사 (templates, config.txt)
    if [ -d "$WIN_PROJECT/src-tauri/resources" ]; then
        cp -r "$WIN_PROJECT/src-tauri/resources" "$STANDALONE_DIR/resources"
        echo "  Resources → $STANDALONE_DIR/resources/"
    fi

    echo ""
    echo "=== Build Complete! ==="
    echo ""
    echo "  [Installer]"
    ls -lh ./build-output/installer/ 2>/dev/null
    echo ""
    echo "  [Standalone - 설치 없이 바로 실행]"
    ls -lhR "$STANDALONE_DIR" 2>/dev/null
else
    echo ""
    echo "=== Build Failed ==="
    exit 1
fi
