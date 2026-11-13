/** Formatting of project table cells. */
import { expect, it } from "vitest";
import { formatModified, formatSize } from "../../src/features/projects/format-project";

it("formats sizes in bytes, KB and MB", () => {
  expect(formatSize(512)).toBe("512 B");
  expect(formatSize(48 * 1024)).toBe("48 KB");
  expect(formatSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
});

it("formats known modification times and an unknown one", () => {
  expect(formatModified(null)).toBe("–");
  expect(formatModified(Date.UTC(2026, 10, 9, 15, 30))).toMatch(/2026|26/);
});
