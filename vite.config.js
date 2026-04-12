import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "fs";
import { resolve } from "path";

// 빌드 시점 버전 — 프론트가 5초마다 폴링해서 새 번들 감지 → window.location.reload()
const BUILD_VERSION = String(Date.now());

function buildVersionPlugin() {
  return {
    name: "build-version",
    apply: "build",
    closeBundle() {
      const out = resolve(__dirname, "dist", "version.txt");
      writeFileSync(out, BUILD_VERSION + "\n");
      // eslint-disable-next-line no-console
      console.log(`build-version → dist/version.txt = ${BUILD_VERSION}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), buildVersionPlugin()],
  clearScreen: false,
  // 인메모리 빌드 버전을 모든 파일에 노출 — 프론트에서 import.meta.env.VITE_BUILD_VERSION 으로 사용
  define: {
    "import.meta.env.VITE_BUILD_VERSION": JSON.stringify(BUILD_VERSION),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "chrome105",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
