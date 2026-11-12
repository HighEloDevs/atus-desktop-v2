import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ClipboardReadError,
  MAX_IMPORT_BYTES,
  readClipboardText,
} from "../../src/features/analysis/clipboard/read-clipboard-text.ts";

function mockClipboard(readText) {
  vi.stubGlobal("navigator", { clipboard: { readText } });
}

afterEach(() => vi.unstubAllGlobals());

describe("readClipboardText", () => {
  test("returns the untrimmed clipboard text", async () => {
    mockClipboard(async () => "1;2\n3;4\n");
    expect(await readClipboardText()).toBe("1;2\n3;4\n");
  });

  test.each([[""], ["  \n\t"]])("rejects empty text %j", async (text) => {
    mockClipboard(async () => text);
    await expect(readClipboardText()).rejects.toMatchObject({ code: "empty" });
  });

  test("reports denied access, including a missing Clipboard API", async () => {
    mockClipboard(async () => {
      throw new Error("NotAllowedError");
    });
    await expect(readClipboardText()).rejects.toMatchObject({ code: "denied" });
    vi.stubGlobal("navigator", {});
    await expect(readClipboardText()).rejects.toBeInstanceOf(ClipboardReadError);
  });

  test("limits the text to 1 MB in bytes, not characters", async () => {
    mockClipboard(async () => "1".repeat(MAX_IMPORT_BYTES));
    expect(await readClipboardText()).toHaveLength(MAX_IMPORT_BYTES);
    mockClipboard(async () => "1".repeat(MAX_IMPORT_BYTES + 1));
    await expect(readClipboardText()).rejects.toMatchObject({ code: "too-large" });
    mockClipboard(async () => "é".repeat(MAX_IMPORT_BYTES / 2 + 1));
    await expect(readClipboardText()).rejects.toMatchObject({ code: "too-large" });
  });

  test("uses Portuguese messages", async () => {
    mockClipboard(async () => "");
    await expect(readClipboardText()).rejects.toThrow("A área de transferência está vazia.");
  });
});
