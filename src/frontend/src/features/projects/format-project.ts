/**
 * @module
 * Display formatting for project table cells.
 */

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Formats a modification time for display.
 * @param modified - Milliseconds since the Unix epoch, or null when unknown.
 * @returns A localized date and time, or an en dash when unknown.
 */
export function formatModified(modified: number | null) {
  return modified === null ? "–" : dateFormat.format(new Date(modified));
}

/**
 * Formats a file size using KB or MB.
 * @param bytes - Size in bytes.
 * @returns A short size such as "48 KB".
 */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
