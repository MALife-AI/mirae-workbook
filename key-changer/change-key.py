#!/usr/bin/env python3
"""
VibeCodingWorkbook API Key Changer
빌드된 앱의 config.txt에 API 키를 설정합니다.

사용법:
  python change-key.py sk-ant-api03-xxxxx
  python change-key.py                      # 대화형 입력
"""
import sys
import os
import glob

def find_config_files():
    """앱 번들/exe 근처의 config.txt를 찾음"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(script_dir)

    candidates = [
        # Windows: exe와 같은 폴더
        os.path.join(parent_dir, "config.txt"),
        os.path.join(script_dir, "config.txt"),
        # macOS: .app/Contents/Resources/
        *glob.glob(os.path.join(parent_dir, "*.app", "Contents", "Resources", "config.txt")),
        *glob.glob(os.path.join(script_dir, "*.app", "Contents", "Resources", "config.txt")),
        # 빌드 폴더
        os.path.join(parent_dir, "src-tauri", "resources", "config.txt"),
        os.path.join(script_dir, "..", "src-tauri", "resources", "config.txt"),
        # Tauri 번들 결과
        *glob.glob(os.path.join(parent_dir, "src-tauri", "target", "release", "bundle", "**", "config.txt"), recursive=True),
        *glob.glob(os.path.join(parent_dir, "src-tauri", "target", "release", "config.txt")),
    ]

    found = []
    for c in candidates:
        c = os.path.normpath(c)
        if os.path.isfile(c) and c not in found:
            found.append(c)
    return found

def read_current_key(path):
    """config.txt에서 현재 키 읽기"""
    with open(path, "r") as f:
        for line in f:
            if line.strip().startswith("ANTHROPIC_API_KEY="):
                key = line.strip().split("=", 1)[1].strip()
                return key if key else None
    return None

def write_key(path, key):
    """config.txt에 키 쓰기"""
    lines = []
    found = False
    if os.path.exists(path):
        with open(path, "r") as f:
            for line in f:
                if line.strip().startswith("ANTHROPIC_API_KEY="):
                    lines.append(f"ANTHROPIC_API_KEY={key}\n")
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.append(f"ANTHROPIC_API_KEY={key}\n")
    with open(path, "w") as f:
        f.writelines(lines)

def main():
    print("=" * 50)
    print("  VibeCodingWorkbook API Key Changer")
    print("=" * 50)
    print()

    # config.txt 찾기
    configs = find_config_files()
    if not configs:
        print("[!] config.txt not found.")
        print("    Place this script next to the app or build folder.")
        input("\nPress Enter to exit...")
        return

    print(f"Found {len(configs)} config file(s):")
    for i, c in enumerate(configs):
        current = read_current_key(c)
        masked = f"{current[:12]}...{current[-4:]}" if current and len(current) > 16 else (current or "(empty)")
        print(f"  [{i+1}] {c}")
        print(f"      Current key: {masked}")
    print()

    # 키 입력
    if len(sys.argv) > 1:
        new_key = sys.argv[1].strip()
    else:
        new_key = input("Enter new API key (sk-ant-...): ").strip()

    if not new_key:
        print("No key entered. Cancelled.")
        return

    if not new_key.startswith("sk-ant-"):
        print("[!] Warning: key doesn't start with 'sk-ant-'. Proceeding anyway.")

    # 모든 config에 쓰기
    for c in configs:
        write_key(c, new_key)
        print(f"[OK] Updated: {c}")

    print()
    print("Done! Restart the app to apply.")
    print()
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
