import { afterEach, describe, expect, test, vi } from "vitest";
const tauri = vi.hoisted(() => ({ isTauri: vi.fn(() => false), readText: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: tauri.isTauri }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: tauri.readText }));
import {
  ClipboardReadError,
  MAX_IMPORT_BYTES,
  readClipboardText,
} from "../../src/features/analysis/clipboard/read-clipboard-text.ts";

function mockClipboard(readText) {
  vi.stubGlobal("navigator", { clipboard: { readText } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  tauri.isTauri.mockReturnValue(false);
  tauri.readText.mockReset();
});

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

  test("reads through the native plugin in the desktop app, without the browser API", async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.readText.mockResolvedValue("1;2\n");
    const browserRead = vi.fn();
    mockClipboard(browserRead);
    expect(await readClipboardText()).toBe("1;2\n");
    expect(browserRead).not.toHaveBeenCalled();
  });

  test("maps native plugin failures and empty text to clipboard errors", async () => {
    tauri.isTauri.mockReturnValue(true);
    tauri.readText.mockRejectedValue(new Error("denied by capability"));
    await expect(readClipboardText()).rejects.toMatchObject({ code: "denied" });
    tauri.readText.mockResolvedValue("");
    await expect(readClipboardText()).rejects.toMatchObject({ code: "empty" });
  });
});
