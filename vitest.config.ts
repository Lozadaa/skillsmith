import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // Node by default (engine + pure libs). Component tests opt into jsdom
    // per-file with a `// @vitest-environment jsdom` pragma on line 1.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
  },
});
