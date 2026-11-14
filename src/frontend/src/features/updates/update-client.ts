/**
 * @module
 * Typed facade over the native updater commands (`src/desktop/src/update.rs`) and their
 * `update-state` event. The state types mirror the Rust `UpdateState` and are the contract with
 * the native core.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Event the native core sends to every window each time the update state changes. */
export const UPDATE_STATE_EVENT = "update-state";

/** Where people download the installers when the app cannot update itself. */
export const RELEASES_URL = "https://github.com/HighEloDevs/atus-desktop-v2/releases/latest";

/** Why this build cannot look for updates at all. */
export type UnavailableReason = "developmentBuild" | "unknownInstallation";

/** Why an update has to be installed by hand. */
export type ManualReason =
  | "permissionDenied"
  | "installFailed"
  | "notWritable"
  | "readOnlyLocation"
  | "previousAttemptFailed";

/** The step of an update that failed. */
export type UpdateStage = "check" | "download" | "install";

/** What the interface shows about updates. */
export type UpdateState =
  | { kind: "idle" }
  | { kind: "unavailable"; reason: UnavailableReason }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; version: string; notes: string | null }
  | { kind: "downloading"; version: string; downloaded: number; total: number | null }
  | { kind: "ready"; version: string; notes: string | null }
  | { kind: "installing"; version: string; startedAt: number }
  | { kind: "manual"; version: string; reason: ManualReason; url: string; notes: string | null }
  | { kind: "error"; stage: UpdateStage; message: string };

const UNAVAILABLE_REASONS = ["developmentBuild", "unknownInstallation"];
const MANUAL_REASONS = [
  "permissionDenied",
  "installFailed",
  "notWritable",
  "readOnlyLocation",
  "previousAttemptFailed",
];
const STAGES = ["check", "download", "install"];

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isOptional = (value: unknown, test: (item: unknown) => boolean) =>
  value === null || value === undefined || test(value);

/**
 * Whether a value received from the native core is a well-formed {@link UpdateState}. Anything
 * else (for example the empty answer of a test double) is ignored instead of crashing the UI.
 * @param value - Value to check.
 * @returns True when it has a known `kind` and the fields of that kind.
 */
export function isUpdateState(value: unknown): value is UpdateState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  switch (state.kind) {
    case "idle":
    case "checking":
    case "upToDate":
      return true;
    case "unavailable":
      return UNAVAILABLE_REASONS.includes(state.reason as string);
    case "available":
    case "ready":
      return isString(state.version) && isOptional(state.notes, isString);
    case "downloading":
      return (
        isString(state.version) && isNumber(state.downloaded) && isOptional(state.total, isNumber)
      );
    case "installing":
      return isString(state.version) && isNumber(state.startedAt);
    case "manual":
      return (
        isString(state.version) &&
        isString(state.url) &&
        MANUAL_REASONS.includes(state.reason as string) &&
        isOptional(state.notes, isString)
      );
    case "error":
      return STAGES.includes(state.stage as string) && isString(state.message);
    default:
      return false;
  }
}

/** What the updater needs from the native side; tests replace it. */
export interface UpdateClient {
  /** Whether updates exist at all: only inside the desktop app. */
  isAvailable(): boolean;
  /** The current state, or null when the answer is not a state. */
  status(): Promise<UpdateState | null>;
  /** Looks for a newer version. Rejects with a readable message while another step runs. */
  check(): Promise<UpdateState | null>;
  /** Starts the background download. */
  download(): Promise<UpdateState | null>;
  /** Stops the download in progress. */
  cancelDownload(): Promise<UpdateState | null>;
  /** Installs the downloaded update and restarts. Save the open project first. */
  install(): Promise<UpdateState | null>;
  /** Calls `callback` for every state the core reports; resolves to the unsubscribe function. */
  onState(callback: (state: UpdateState) => void): Promise<() => void>;
}

async function command(name: string): Promise<UpdateState | null> {
  const result = await invoke<unknown>(name);
  return isUpdateState(result) ? result : null;
}

/** The client that talks to the desktop core. */
export const updateClient: UpdateClient = {
  isAvailable: () => isTauri(),
  status: () => command("update_status"),
  check: () => command("update_check"),
  download: () => command("update_download"),
  cancelDownload: () => command("update_cancel_download"),
  install: () => command("update_install"),
  onState: (callback) =>
    getCurrentWindow().listen<unknown>(UPDATE_STATE_EVENT, ({ payload }) => {
      if (isUpdateState(payload)) callback(payload);
    }),
};
