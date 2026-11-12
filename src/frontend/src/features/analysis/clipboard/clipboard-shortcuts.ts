/**
 * @module
 * Keyboard shortcuts that import clipboard data: Cmd/Ctrl+B creates a dataset and
 * Cmd/Ctrl+1 to 9 replaces the data of dataset N.
 */

import { useEffect, useRef } from "react";

/** Action requested by a clipboard shortcut. */
export type ClipboardShortcut = { kind: "create" } | { kind: "replace"; index: number };

/** Minimal keyboard event fields used to detect a shortcut. */
export type ShortcutEvent = Pick<
  KeyboardEvent,
  "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "isComposing" | "target"
>;

/**
 * Tells whether the event started in a control where the keys already have a meaning.
 * @param target - Event target.
 * @returns True for inputs, text areas, selects and editable content.
 */
function isTextTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Maps a keyboard event to a clipboard shortcut.
 *
 * Uses Cmd on macOS and Ctrl elsewhere, without Alt or Shift, and ignores key repeat,
 * IME composition and events from text controls.
 *
 * @param event - Keyboard event, or an object with the same fields.
 * @param isMac - Whether the platform uses Cmd as the primary modifier.
 * @returns The shortcut, or null when the event is not one.
 * @example
 * getClipboardShortcut({ code: "Digit2", metaKey: true, ... }, true); // { kind: "replace", index: 2 }
 */
export function getClipboardShortcut(
  event: ShortcutEvent,
  isMac: boolean,
): ClipboardShortcut | null {
  if (event.repeat || event.isComposing || event.altKey || event.shiftKey) return null;
  if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
  if (isTextTarget(event.target)) return null;
  if (event.code === "KeyB") return { kind: "create" };
  const digit = /^Digit([1-9])$/.exec(event.code);
  return digit ? { kind: "replace", index: Number(digit[1]) } : null;
}

/**
 * Listens for clipboard shortcuts while enabled.
 *
 * The handler is read through a ref, so changing it does not re-register the listener.
 * The browser default is prevented only for recognized shortcuts.
 *
 * @param onShortcut - Called with the recognized shortcut.
 * @param isMac - Whether the platform uses Cmd as the primary modifier.
 * @param enabled - Set to false while a dialog is open.
 */
export function useClipboardShortcuts(
  onShortcut: (shortcut: ClipboardShortcut) => void,
  isMac: boolean,
  enabled: boolean,
) {
  const handler = useRef(onShortcut);
  useEffect(() => {
    handler.current = onShortcut;
  });
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const shortcut = getClipboardShortcut(event, isMac);
      if (!shortcut) return;
      event.preventDefault();
      handler.current(shortcut);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMac, enabled]);
}
