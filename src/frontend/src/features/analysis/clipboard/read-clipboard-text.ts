/**
 * @module
 * Reads text data from the system clipboard for the analysis import flow.
 */

import { isTauri } from "@tauri-apps/api/core";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

/** Maximum size, in bytes, accepted for imported text (files and clipboard). */
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** Reason why the clipboard text could not be used. */
export type ClipboardReadErrorCode = "empty" | "denied" | "too-large";

const MESSAGES: Record<ClipboardReadErrorCode, string> = {
  empty: "A área de transferência está vazia.",
  denied: "Não foi possível acessar a área de transferência. Verifique as permissões.",
  "too-large": "O texto da área de transferência excede 1 MB.",
};

/** Error with a user-facing Portuguese message describing why the clipboard was not read. */
export class ClipboardReadError extends Error {
  /**
   * @param code - Machine-readable reason, used to select the message.
   */
  constructor(readonly code: ClipboardReadErrorCode) {
    super(MESSAGES[code]);
    this.name = "ClipboardReadError";
  }
}

/**
 * Reads the clipboard text.
 *
 * In the desktop app it goes through the native Tauri clipboard plugin, which reads directly
 * without the "Paste" prompt that WKWebView shows for `navigator.clipboard.readText()`. In a
 * plain browser it uses the standard Clipboard API.
 *
 * @returns The clipboard text, untrimmed.
 * @throws {ClipboardReadError} When the API is unavailable or denied (`denied`), the text is
 * empty or whitespace only (`empty`), or it exceeds {@link MAX_IMPORT_BYTES} (`too-large`).
 * @example
 * const text = await readClipboardText();
 */
export async function readClipboardText(): Promise<string> {
  let text: string;
  try {
    text = isTauri() ? await readText() : await navigator.clipboard.readText();
  } catch {
    throw new ClipboardReadError("denied");
  }
  if (!text || text.trim() === "") throw new ClipboardReadError("empty");
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new ClipboardReadError("too-large");
  }
  return text;
}
