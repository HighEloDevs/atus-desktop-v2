// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { getClipboardShortcut } from "../../src/features/analysis/clipboard/clipboard-shortcuts.ts";

const base = {
  code: "KeyB",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  target: null,
};

describe("clipboard shortcuts", () => {
  test("Cmd on macOS and Ctrl elsewhere create a dataset with B", () => {
    expect(getClipboardShortcut({ ...base, metaKey: true }, true)).toEqual({ kind: "create" });
    expect(getClipboardShortcut({ ...base, ctrlKey: true }, false)).toEqual({ kind: "create" });
  });

  test("digits 1 to 9 replace the matching dataset", () => {
    for (let n = 1; n <= 9; n++) {
      expect(getClipboardShortcut({ ...base, code: `Digit${n}`, ctrlKey: true }, false)).toEqual({
        kind: "replace",
        index: n,
      });
    }
    expect(getClipboardShortcut({ ...base, code: "Digit0", ctrlKey: true }, false)).toBeNull();
  });

  test("ignores the wrong modifier for the platform and extra modifiers", () => {
    expect(getClipboardShortcut({ ...base, ctrlKey: true }, true)).toBeNull();
    expect(getClipboardShortcut({ ...base, metaKey: true }, false)).toBeNull();
    expect(getClipboardShortcut({ ...base, metaKey: true, ctrlKey: true }, true)).toBeNull();
    expect(getClipboardShortcut({ ...base, ctrlKey: true, altKey: true }, false)).toBeNull();
    expect(getClipboardShortcut({ ...base, ctrlKey: true, shiftKey: true }, false)).toBeNull();
    expect(getClipboardShortcut({ ...base }, false)).toBeNull();
  });

  test("ignores Space, key repeat and IME composition", () => {
    expect(getClipboardShortcut({ ...base, code: "Space", ctrlKey: true }, false)).toBeNull();
    expect(getClipboardShortcut({ ...base, ctrlKey: true, repeat: true }, false)).toBeNull();
    expect(getClipboardShortcut({ ...base, ctrlKey: true, isComposing: true }, false)).toBeNull();
  });

  test("ignores events from text controls but not from buttons", () => {
    const event = (target) => ({ ...base, ctrlKey: true, target });
    for (const tag of ["input", "textarea", "select"]) {
      expect(getClipboardShortcut(event(document.createElement(tag)), false)).toBeNull();
    }
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(getClipboardShortcut(event(editable), false)).toBeNull();
    expect(getClipboardShortcut(event(document.createElement("button")), false)).toEqual({
      kind: "create",
    });
  });
});
