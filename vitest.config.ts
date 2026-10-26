import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sandbox-friendly cache location (package folders are read-only there).
  cacheDir: ".vitest-cache",
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
});
