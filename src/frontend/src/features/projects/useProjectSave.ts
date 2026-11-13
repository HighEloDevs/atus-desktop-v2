/**
 * @module
 * Serialized autosave and project-close coordination.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useQuitRequest } from "@/hooks/use-quit-request";
import {
  chooseDestination,
  projectClient,
  rememberProject,
  replaceRecentPath,
  type OpenProject,
  type ProjectSnapshot,
} from "./project-client";

/**
 * Coordinates debounced and manual saves and project closing.
 * @param initial - Open project, or null outside the desktop workflow.
 * @param content - Serialized analysis state to save.
 * @returns Save status, errors, and actions for saving, copying, and leaving.
 */
export function useProjectSave(initial: OpenProject | null, content: string) {
  const [project, setProject] = useState(initial);
  const [status, setStatus] = useState("Salvo");
  const [savedContent, setSavedContent] = useState(content);
  const [error, setError] = useState("");
  const current = useRef(initial);
  const latest = useRef(content);
  const committed = useRef(content);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const destinationOpen = useRef(false);
  useLayoutEffect(() => {
    latest.current = content;
  }, [content]);

  const persist = useCallback((destination?: string) => {
    const job = queue.current.then(async () => {
      const active = current.current;
      if (!active || (!destination && latest.current === committed.current)) return true;
      const serialized = latest.current;
      const analyses: ProjectSnapshot["analyses"] = JSON.parse(serialized);
      const snapshot = { ...active.snapshot, updated_at: new Date().toISOString(), analyses };
      setError("");
      setStatus("Salvando…");
      try {
        if (destination) {
          const saved = await projectClient.saveAs(destination, snapshot);
          current.current = saved;
          setProject(saved);
          rememberProject(saved.path);
        } else {
          await projectClient.save(active.path, active.snapshot, snapshot);
          current.current = { ...active, snapshot };
        }
        committed.current = serialized;
        setSavedContent(serialized);
        setStatus(latest.current === serialized ? "Salvo" : "Alterações pendentes");
        return true;
      } catch (error) {
        setError(String(error));
        setStatus("Falha ao salvar");
        return false;
      }
    });
    queue.current = job;
    return job;
  }, []);

  const flush = useCallback(async () => {
    if (destinationOpen.current) return false;
    while (current.current) {
      if (!(await persist())) return false;
      if (latest.current === committed.current) break;
    }
    return true;
  }, [persist]);

  useEffect(() => {
    if (!project || content === committed.current) return;
    const timer = window.setTimeout(() => {
      if (!destinationOpen.current) void persist();
    }, 500);
    return () => clearTimeout(timer);
  }, [content, persist, project]);

  const canLeave = useCallback(async () => {
    if (destinationOpen.current) return false;
    if (await flush()) return true;
    try {
      return await confirm(
        "Não foi possível salvar. Deseja sair e descartar as alterações pendentes?",
        {
          title: "Alterações não salvas",
          kind: "warning",
          okLabel: "Descartar alterações",
          cancelLabel: "Continuar editando",
        },
      );
    } catch (error) {
      setError(String(error));
      return false;
    }
  }, [flush]);

  useEffect(() => {
    if (!initial) return;
    const windowHandle = getCurrentWindow();
    let active = true;
    let closing = false;
    const listener = windowHandle.onCloseRequested(async (event) => {
      event.preventDefault();
      if (closing) return;
      closing = true;
      try {
        if (await canLeave()) await windowHandle.destroy();
      } finally {
        closing = false;
      }
    });
    void listener
      .then((unlisten) => {
        if (!active) unlisten();
      })
      .catch((error) => setError(String(error)));
    return () => {
      active = false;
      void listener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [initial, canLeave]);

  // ATUS stays in the background when the window closes; quitting saves through here.
  useQuitRequest(Boolean(initial), canLeave);

  const saveAs = useCallback(async () => {
    if (!current.current || destinationOpen.current) return;
    destinationOpen.current = true;
    let copied = false;
    try {
      const path = await chooseDestination(current.current.snapshot.name);
      if (path) copied = await persist(/\.atus$/i.test(path) ? path : `${path}.atus`);
    } catch (error) {
      setError(String(error));
    } finally {
      destinationOpen.current = false;
      if (copied && latest.current !== committed.current) void persist();
    }
  }, [persist]);

  /**
   * Renames the open project (stored name and file). Pending edits are saved first, and the
   * hook then follows the new path and snapshot so later saves keep working.
   * @param name - New project name.
   * @returns Resolves when renamed; rejects with the readable failure otherwise.
   */
  const rename = useCallback(
    async (name: string) => {
      if (!current.current) return;
      if (destinationOpen.current || !(await flush())) {
        throw new Error("Aguarde o salvamento terminar e tente novamente.");
      }
      const job = queue.current.then(async () => {
        const active = current.current;
        if (!active) return;
        const nextPath = await projectClient.rename(active.path, name);
        const next = { path: nextPath, snapshot: { ...active.snapshot, name: name.trim() } };
        current.current = next;
        setProject(next);
        replaceRecentPath(active.path, nextPath);
      });
      queue.current = job.catch(() => undefined);
      await job;
    },
    [flush],
  );

  const usesNativeMenu = isTauri() && /^Mac/.test(navigator.platform);
  useEffect(() => {
    if (!initial || !usesNativeMenu) return;
    let active = true;
    const listener = getCurrentWindow().listen<"save" | "save-as">(
      "project-menu-action",
      ({ payload }) => {
        if (!active) return;
        if (payload === "save") void flush();
        if (payload === "save-as") void saveAs();
      },
    );
    void listener
      .then(() => active && invoke("project_menu_enabled", { enabled: true }))
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
      void listener.then((unlisten) => unlisten()).catch(() => {});
      void invoke("project_menu_enabled", { enabled: false }).catch(console.error);
    };
  }, [initial, usesNativeMenu, flush, saveAs]);

  return {
    usesNativeMenu,
    project,
    status: status === "Salvo" && content !== savedContent ? "Alterações pendentes" : status,
    error,
    flush,
    canLeave,
    saveAs,
    rename,
  };
}
