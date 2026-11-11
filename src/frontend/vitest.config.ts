import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/** Defines test execution and coverage for every frontend TypeScript source file. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.{mjs,ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
