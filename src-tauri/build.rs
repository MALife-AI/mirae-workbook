fn main() {
    // config.txt가 없으면 빈 파일 생성 (빌드 전에 키를 넣으면 exe에 포함됨)
    let config_path = std::path::Path::new("resources/config.txt");
    if !config_path.exists() {
        std::fs::create_dir_all("resources").ok();
        std::fs::write(config_path, "ANTHROPIC_API_KEY=\n").ok();
    }
    tauri_build::build()
}
