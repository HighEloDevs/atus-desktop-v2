/**
 * @module
 * Response of the main window to a native request to quit the app.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

/** Event the native core sends to the main window when the app should quit. */
export const QUIT_REQUESTED_EVENT = "app-quit-requested";

/**
 * While enabled, answers quit requests (Cmd+Q or **Sair do ATUS** in the tray) by asking
 * `canLeave` and then quitting through the native `app_quit` command. ATUS keeps running in the
 * background after its window closes, so quitting must go through here to save first.
 *
 * Only one enabled listener should exist per window: the home page enables it when no project
 * is open, and the project save hook while one is.
 *
 * @param enabled - Whether this component is responsible for quitting.
 * @param canLeave - Resolves to true when it is safe to quit, for example after saving.
 * @returns Nothing.
 */
export function useQuitRequest(enabled: boolean, canLeave: () => Promise<boolean>) {
  const latest = useRef(canLeave);
  useEffect(() => {
    latest.current = canLeave;
  }, [canLeave]);
  useEffect(() => {
    if (!enabled || !isTauri()) return;
    let active = true;
    let quitting = false;
    const listener = getCurrentWindow().listen(QUIT_REQUESTED_EVENT, async () => {
      if (!active || quitting) return;
      quitting = true;
      try {
        if (await latest.current()) await invoke("app_quit");
      } catch (error) {
        console.error(error);
      } finally {
        quitting = false;
      }
    });
    return () => {
      active = false;
      void listener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [enabled]);
}
