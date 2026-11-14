/**
 * @module
 * Owns the update state of the main window: follows the native state, checks for updates in the
 * background, downloads them, decides when the banner shows and installs on request.
 */

import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EMBEDDED_CHANGELOG } from "@/features/news/embedded-changelog";
import { mergeChangelogs, parseChangelog, type ChangelogVersion } from "@/features/news/changelog";
import { notify } from "@/lib/notify";
import { localDay, readBannerRecord, shouldShowBanner, writeBannerRecord } from "./banner-schedule";
import { UpdateContext, type UpdateApi } from "./update-context";
import { RELEASES_URL, updateClient, type UpdateClient, type UpdateState } from "./update-client";
import { manualMessage } from "./update-messages";

/** Wait after start before the first background check, so it never competes with startup. */
export const FIRST_CHECK_MS = 5_000;
/** Time between background checks. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const INSTALL_TOAST = "update-install";

interface UpdateProviderProps {
  children: ReactNode;
  /**
   * Whether the app checks and downloads on its own. Only the production build does: a
   * development or test build waits for someone to ask.
   */
  automatic?: boolean;
  /** The native side; tests replace it. */
  client?: UpdateClient;
}

/**
 * Provides {@link UpdateApi} to the main window.
 *
 * It follows the `update-state` event of the native core and reads the current state once at
 * start, because the core keeps a downloaded update while the window is closed. In an automatic
 * build it checks 5 seconds after start and every 6 hours, downloads an announced update in the
 * background and never installs by itself. Failures of those background steps stay silent; only
 * what the person asked for is reported.
 *
 * @param props - The children and, for tests, whether to run automatically and the client.
 * @returns The provider element.
 */
export function UpdateProvider({
  children,
  automatic = import.meta.env.PROD,
  client = updateClient,
}: UpdateProviderProps) {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const [bannerVersion, setBannerVersion] = useState<string | null>(null);
  const [dialogRequested, setDialogRequested] = useState(false);
  const [announced, setAnnounced] = useState<ChangelogVersion[]>([]);
  const [justUpdated, setJustUpdated] = useState<string | null>(null);
  const stateRef = useRef(state);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const installing = useRef(false);
  const downloadRequested = useRef<string | null>(null);
  const bannerDecided = useRef<string | null>(null);
  const changelogRequested = useRef<string | null>(null);

  const apply = useCallback(
    (next: UpdateState) => {
      const previous = stateRef.current;
      stateRef.current = next;
      setState(next);
      if (next.kind !== "ready") setDialogRequested(false);
      // What the person asked for (installing) is reported; background steps are not.
      if (previous.kind === "installing" && next.kind === "error") {
        notify.error("Não foi possível instalar a atualização", {
          description: next.message,
          id: INSTALL_TOAST,
        });
      } else if (previous.kind === "installing" && next.kind === "manual") {
        notify.warning("Instale a atualização manualmente", {
          description: manualMessage(next.reason, next.version),
          id: INSTALL_TOAST,
        });
      }
      if (
        (next.kind === "ready" || next.kind === "manual") &&
        bannerDecided.current !== next.version
      ) {
        bannerDecided.current = next.version;
        const today = localDay(new Date());
        if (shouldShowBanner(readBannerRecord(), next.version, today)) {
          writeBannerRecord({ version: next.version, day: today });
          setBannerVersion(next.version);
        }
      }
      if (
        (next.kind === "available" || next.kind === "ready" || next.kind === "manual") &&
        changelogRequested.current !== next.version
      ) {
        // The notes of the new version travel in the manifest the core downloaded. They come from
        // the network, so they are validated before use; a failure just leaves the page without them.
        changelogRequested.current = next.version;
        client
          .changelog()
          .then((raw) => setAnnounced(parseChangelog(raw)))
          .catch(() => {});
      }
      if (automatic && next.kind === "available" && downloadRequested.current !== next.version) {
        downloadRequested.current = next.version;
        client.download().catch(() => {});
      }
    },
    [automatic, client],
  );

  useEffect(() => {
    if (!client.isAvailable()) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        unlisten = await client.onState((next) => active && apply(next));
        if (!active) {
          unlisten();
          return;
        }
      } catch (error) {
        console.error(error);
      }
      try {
        // The core keeps a downloaded update while this window is closed, so start from it.
        const current = await client.status();
        if (active && current) apply(current);
      } catch (error) {
        console.error(error);
      }
      try {
        // The core noticed that the app was just updated to this version, which opens its news.
        const installed = await client.takeInstalled();
        if (active && installed) setJustUpdated(installed);
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
      unlisten?.();
    };
  }, [client, apply]);

  useEffect(() => {
    if (!automatic || !client.isAvailable()) return;
    const run = () => void client.check().catch(() => {});
    const first = window.setTimeout(run, FIRST_CHECK_MS);
    const every = window.setInterval(run, CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [automatic, client]);

  const check = useCallback(async () => {
    try {
      await client.check();
    } catch (error) {
      notify.error("Não foi possível procurar atualizações", {
        description: String(error),
        id: "update-check",
      });
    }
  }, [client]);

  const download = useCallback(async () => {
    const current = stateRef.current;
    if (current.kind === "available") downloadRequested.current = current.version;
    try {
      await client.download();
    } catch (error) {
      notify.error("Não foi possível baixar a atualização", {
        description: String(error),
        id: "update-download",
      });
    }
  }, [client]);

  const retry = useCallback(async () => {
    const current = stateRef.current;
    if (current.kind === "error" && current.stage === "check") await check();
    else await download();
  }, [check, download]);

  const cancelDownload = useCallback(async () => {
    try {
      await client.cancelDownload();
    } catch (error) {
      notify.error("Não foi possível cancelar o download", {
        description: String(error),
        id: "update-download",
      });
    }
  }, [client]);

  const install = useCallback(async () => {
    if (stateRef.current.kind !== "ready" || installing.current) return;
    installing.current = true;
    try {
      if (guard.current && !(await guard.current())) {
        notify.error("Não foi possível salvar o projeto", {
          description: "A atualização não foi instalada. Resolva o problema e tente de novo.",
          id: INSTALL_TOAST,
        });
        return;
      }
      setDialogRequested(false);
      await client.install();
    } catch (error) {
      notify.error("Não foi possível instalar a atualização", {
        description: String(error),
        id: INSTALL_TOAST,
      });
    } finally {
      installing.current = false;
    }
  }, [client]);

  const openReleases = useCallback(async () => {
    try {
      if (isTauri()) await openUrl(RELEASES_URL);
      else window.open(RELEASES_URL, "_blank", "noopener,noreferrer");
    } catch {
      notify.error("Não foi possível abrir o navegador", {
        description: "Tente novamente.",
        id: "update-open-error",
      });
    }
  }, []);

  const setInstallGuard = useCallback((next: (() => Promise<boolean>) | null) => {
    guard.current = next;
  }, []);

  const offered = state.kind === "ready" || state.kind === "manual";
  const changelog = useMemo(() => mergeChangelogs(EMBEDDED_CHANGELOG, announced), [announced]);
  const api = useMemo<UpdateApi>(
    () => ({
      state,
      changelog,
      justUpdated,
      bannerVisible: offered && bannerVersion === state.version,
      dialogOpen: dialogRequested && state.kind === "ready",
      check,
      retry,
      download,
      cancelDownload,
      install,
      dismissBanner: () => setBannerVersion(null),
      openDialog: () => setDialogRequested(stateRef.current.kind === "ready"),
      closeDialog: () => setDialogRequested(false),
      openReleases,
      setInstallGuard,
    }),
    [
      state,
      changelog,
      justUpdated,
      offered,
      bannerVersion,
      dialogRequested,
      check,
      retry,
      download,
      cancelDownload,
      install,
      openReleases,
      setInstallGuard,
    ],
  );

  return <UpdateContext.Provider value={api}>{children}</UpdateContext.Provider>;
}
