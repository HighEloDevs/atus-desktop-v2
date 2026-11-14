/**
 * @module
 * When the update banner may appear: once per day for each version. The record lives in
 * `localStorage`, so it survives restarts, and every access tolerates a missing, blocked or
 * corrupt store (the banner then simply shows).
 */

/** `localStorage` key of the record. */
export const BANNER_STORAGE_KEY = "atus.update-banner";

/** The last time the banner was shown. */
export interface BannerRecord {
  /** Version the banner announced. */
  version: string;
  /** Local day it was shown, as `YYYY-MM-DD`. */
  day: string;
}

/**
 * The local calendar day of a date.
 * @param date - Moment to describe.
 * @returns `YYYY-MM-DD` in the local time zone.
 */
export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Whether the banner may appear now: once per day, and again at once for a newer version.
 * @param record - The last time it was shown, if any.
 * @param version - Version it would announce.
 * @param today - Local day, from {@link localDay}.
 * @returns True when it was not yet shown today for this version.
 */
export function shouldShowBanner(
  record: BannerRecord | null,
  version: string,
  today: string,
): boolean {
  return !record || record.version !== version || record.day !== today;
}

/**
 * Reads the record.
 * @param storage - Store to read; defaults to `localStorage`.
 * @returns The record, or null when there is none, it is corrupt or the store is unavailable.
 */
export function readBannerRecord(storage?: Storage): BannerRecord | null {
  try {
    const raw = (storage ?? localStorage).getItem(BANNER_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== "object" || value === null) return null;
    const { version, day } = value as Record<string, unknown>;
    return typeof version === "string" && typeof day === "string" ? { version, day } : null;
  } catch {
    return null;
  }
}

/**
 * Stores the record. A store that refuses is ignored: the banner may then show again.
 * @param record - What to store.
 * @param storage - Store to write; defaults to `localStorage`.
 */
export function writeBannerRecord(record: BannerRecord, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(BANNER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private windows and blocked site data: nothing to do.
  }
}
