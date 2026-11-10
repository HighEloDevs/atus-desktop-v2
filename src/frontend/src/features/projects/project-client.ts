import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export type ProjectPoint = { x: number; y: number; sx?: number | null; sy?: number | null };
export type ProjectDataset = { id: string; name: string; points: ProjectPoint[]; state: unknown };
export type ProjectSnapshot = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  analyses: { id: string; kind: string; datasets: ProjectDataset[]; state: unknown }[];
};
export type OpenProject = { path: string; snapshot: ProjectSnapshot };

const filters = [{ name: "Projeto ATUS", extensions: ["atus"] }];
const recentKey = "atus.recent-projects.v1";

export function fileName(path: string) {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.atus$/i, "");
}

export function recentPaths(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Não foi possível atualizar os projetos recentes.", error);
  }
}

export function rememberProject(path: string, replacedPath = path) {
  writeRecent(
    recentKey,
    JSON.stringify(
      [path, ...recentPaths().filter((item) => item !== path && item !== replacedPath)].slice(
        0,
        100,
      ),
    ),
  );
}

export function forgetProject(path: string) {
  writeRecent(recentKey, JSON.stringify(recentPaths().filter((item) => item !== path)));
}

export function newSnapshot(): ProjectSnapshot {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Projeto sem título",
    created_at: now,
    updated_at: now,
    analyses: [{ id: crypto.randomUUID(), kind: "analysis", datasets: [], state: {} }],
  };
}

export const chooseProject = () => open({ filters, multiple: false });
export const chooseDestination = (name: string) => save({ filters, defaultPath: `${name}.atus` });

export const projectClient = {
  create: (snapshot: ProjectSnapshot) => invoke<OpenProject>("project_create", { snapshot }),
  open: (path: string) => invoke<OpenProject>("project_open", { path }),
  save: (path: string, previous: ProjectSnapshot, snapshot: ProjectSnapshot) =>
    invoke<void>("project_save", { path, previous, snapshot }),
  saveAs: (path: string, snapshot: ProjectSnapshot) =>
    invoke<OpenProject>("project_save_as", { path, snapshot }),
  list: () => invoke<string[]>("project_list"),
  available: (path: string) => invoke<boolean>("project_available", { path }),
};
