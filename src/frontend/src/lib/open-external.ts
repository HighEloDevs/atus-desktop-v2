/**
 * @module
 * Opening an address in the default browser.
 */

import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Opens an `https` address in the default browser. Inside the desktop app only the places listed
 * in the `opener` permission (`src/desktop/capabilities/default.json`) open; anywhere else the
 * promise rejects.
 * @param url - Address to open.
 * @returns Resolves once the browser was asked to open it.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) await openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
