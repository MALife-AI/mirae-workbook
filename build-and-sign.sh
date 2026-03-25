#!/bin/bash
# 빌드 + Ad-hoc 코드 서명 자동화
set -e

cd "$(dirname "$0")"

echo "=== Tauri Build ==="
npm run tauri build

APP_PATH="src-tauri/target/release/bundle/macos/VibeCodingWorkbook.app"

if [ -d "$APP_PATH" ]; then
    echo ""
    echo "=== Code Signing (ad-hoc) ==="
    codesign --force --deep --sign - "$APP_PATH"
    codesign -v "$APP_PATH" && echo "Signing OK"
    echo ""
    echo "Done: $APP_PATH"
else
    echo "App not found: $APP_PATH"
    exit 1
fi
