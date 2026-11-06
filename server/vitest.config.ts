import { defineConfig } from "vitest/config";
import path from "path";

const testDir = path.resolve(import.meta.dirname, "src/test");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: path.join(testDir, "global-setup.ts"),
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
