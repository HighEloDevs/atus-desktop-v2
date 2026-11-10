import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  chooseDestination,
  projectClient,
  rememberProject,
  type OpenProject,
  type ProjectSnapshot,
} from "./project-client";

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

  async function saveAs() {
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
  }

  return {
    project,
    status: status === "Salvo" && content !== savedContent ? "Alterações pendentes" : status,
    error,
    flush,
    canLeave,
    saveAs,
  };
}
