import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// D1 runs directly against the workspace sources so a core change does not
// require a `tsc` rebuild before the dev server picks it up.
export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  // Keep Vite's cache at the workspace root; package folders are read-only in
  // the sandbox and the cache must live where the process can write.
  cacheDir: "../../.vite",
  resolve: {
    alias: {
      "@typesetting-engine/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@typesetting-engine/render-canvas": fileURLToPath(
        new URL("../../packages/render-canvas/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
