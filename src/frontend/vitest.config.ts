import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { changelogPlugin } from "./vite-plugin-changelog";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** Defines test execution and coverage for every frontend TypeScript source file. */
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [changelogPlugin()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Rendering tests exceeded the 5 s default on slow macOS Intel runners.
    testTimeout: 15000,
    include: ["tests/**/*.test.{mjs,ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
