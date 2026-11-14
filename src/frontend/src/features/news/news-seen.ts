/**
 * @module
 * Which news the person already saw: the version whose notes were shown after an update, and the
 * update that was announced when the news page was last opened. Both live in `localStorage`; every
 * access tolerates a missing or blocked store.
 */

import { compareVersions } from "./changelog";

/** Last version whose news the app showed (or skipped on the very first run). */
export const NEWS_SEEN_KEY = "atus.news-seen";
/** Last announced update whose news the person opened. */
export const UPDATE_SEEN_KEY = "atus.news-seen-update";

/**
 * Reads a stored version.
 * @param key - `localStorage` key.
 * @param storage - Store to read; defaults to `localStorage`.
 * @returns The version, or null when there is none or the store is unavailable.
 */
export function readSeen(key: string, storage?: Storage): string | null {
  try {
    const value = (storage ?? localStorage).getItem(key);
    return value && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Stores a version. A store that refuses is ignored.
 * @param key - `localStorage` key.
 * @param version - Version to remember.
 * @param storage - Store to write; defaults to `localStorage`.
 */
export function writeSeen(key: string, version: string, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(key, version);
  } catch {
    // Private windows and blocked site data: nothing to do.
  }
}

/**
 * The version whose news should open on its own: the first launch after an update.
 * @param seen - The version last recorded, or null on the very first run (nothing to announce).
 * @param running - The version that is running now.
 * @returns The running version when it is newer than the one recorded, otherwise null.
 */
export function versionToShowAfterUpdate(seen: string | null, running: string): string | null {
  return seen !== null && compareVersions(running, seen) > 0 ? running : null;
}
