import { defineConfig } from "vite";

// Tauri expects a fixed port and won't tolerate it changing.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: "src",
  publicDir: "../public",
  // Prevent Vite from clearing Rust compile output in the terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch Rust source — Tauri handles that itself.
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2021",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
