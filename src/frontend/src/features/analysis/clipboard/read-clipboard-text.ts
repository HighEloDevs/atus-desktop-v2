/**
 * @module
 * Reads text data from the system clipboard for the analysis import flow.
 */

import { isTauri } from "@tauri-apps/api/core";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

/** Reason why the clipboard text could not be used. */
export type ClipboardReadErrorCode = "empty" | "denied";

const MESSAGES: Record<ClipboardReadErrorCode, string> = {
  empty: "A área de transferência está vazia.",
  denied: "Não foi possível acessar a área de transferência. Verifique as permissões.",
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
 * empty or whitespace only (`empty`). There is no size limit.
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
  return text;
}
