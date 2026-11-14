/**
 * @module
 * What the update interface shares: the state, the actions and the hook that lets the open
 * project save itself before an update is installed. The provider that fills it is
 * `UpdateProvider`; without one the context is inert, so screens work in tests and in a browser.
 */

import { createContext, useContext, useEffect, useRef } from "react";
import type { ChangelogVersion } from "@/features/news/changelog";
import type { UpdateState } from "./update-client";

/** State and actions of the update interface. */
export interface UpdateApi {
  /** Where the update is. Anything but an update to offer is hidden by the interface. */
  state: UpdateState;
  /** The notes of every version known: the ones embedded in the build and the ones announced. */
  changelog: ChangelogVersion[];
  /** The version this launch has just been updated to, or null. The news of it should open. */
  justUpdated: string | null;
  /** Whether the once-a-day banner is showing. */
  bannerVisible: boolean;
  /** Whether the install confirmation is open. It only opens for a downloaded update. */
  dialogOpen: boolean;
  /** Looks for a newer version now. */
  check(): Promise<void>;
  /** Repeats the step that failed: the check, or the download. */
  retry(): Promise<void>;
  /** Downloads the announced update. */
  download(): Promise<void>;
  /** Stops the download in progress. */
  cancelDownload(): Promise<void>;
  /** Saves the open project, installs the downloaded update and restarts. */
  install(): Promise<void>;
  /** Hides the banner until the next day (or the next version). */
  dismissBanner(): void;
  /** Opens the install confirmation. */
  openDialog(): void;
  /** Closes the install confirmation. */
  closeDialog(): void;
  /** Opens the releases page in the browser, for an update that must be installed by hand. */
  openReleases(): Promise<void>;
  /** Registers what must succeed before installing (saving the project); null removes it. */
  setInstallGuard(guard: (() => Promise<boolean>) | null): void;
}

const nothing = async () => {};

/** The context value outside a provider: no update is ever offered. */
export const INERT_UPDATE: UpdateApi = {
  state: { kind: "idle" },
  changelog: [],
  justUpdated: null,
  bannerVisible: false,
  dialogOpen: false,
  check: nothing,
  retry: nothing,
  download: nothing,
  cancelDownload: nothing,
  install: nothing,
  dismissBanner: () => {},
  openDialog: () => {},
  closeDialog: () => {},
  openReleases: nothing,
  setInstallGuard: () => {},
};

/** The update context. */
export const UpdateContext = createContext<UpdateApi>(INERT_UPDATE);

/**
 * The update state and actions.
 * @returns The value of the nearest provider, or an inert one.
 */
export function useUpdate(): UpdateApi {
  return useContext(UpdateContext);
}

/**
 * While mounted, makes installing an update wait for `guard`, and cancel when it resolves to
 * false. The screen that owns the open project passes its save here.
 * @param guard - Resolves to true when it is safe to install, for example after saving.
 */
export function useBeforeUpdateInstall(guard: () => Promise<boolean>): void {
  const { setInstallGuard } = useUpdate();
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  }, [guard]);
  useEffect(() => {
    setInstallGuard(() => latest.current());
    return () => setInstallGuard(null);
  }, [setInstallGuard]);
}
