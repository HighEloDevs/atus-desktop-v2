/**
 * @module
 * Frontend access to native project commands and recent paths.
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

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
/** File-level information about a project, as reported by the native `project_details`. */
export type ProjectDetails = {
  path: string;
  /** Stored project name, or the file name when the file cannot be read. */
  name: string;
  /** Last modification in milliseconds since the Unix epoch, when known. */
  modified: number | null;
  size: number;
  archived: boolean;
  available: boolean;
  /** Reason the file could not be read, when it is present but invalid. */
  error: string | null;
};

const filters = [{ name: "Projeto ATUS", extensions: ["atus"] }];
const recentKey = "atus.recent-projects.v1";

/**
 * Extracts the final path component and removes a trailing .atus extension.
 * @param path - File path using slash or backslash separators.
 * @returns Project name for display.
 */
export function fileName(path: string) {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.atus$/i, "");
}

/**
 * Reads recent project paths from local storage, tolerating invalid or unavailable data.
 * @returns Stored string paths, or an empty array.
 */
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

/**
 * Moves a project to the front of the local history, retaining at most 100 entries.
 * @param path - Project to record.
 * @param replacedPath - Previous path to remove after locating a project.
 * @returns Nothing; storage failures are logged.
 */
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

/**
 * Removes a path from local recent history without deleting its file.
 * @param path - Path to forget.
 * @returns Nothing; storage failures are logged.
 */
export function forgetProject(path: string) {
  writeRecent(recentKey, JSON.stringify(recentPaths().filter((item) => item !== path)));
}

/**
 * Replaces a path in the recent history, keeping its position.
 * @param path - Path that no longer exists, for example after a rename.
 * @param replacement - New path, or null to drop the entry.
 * @returns Nothing; storage failures are logged.
 */
export function replaceRecentPath(path: string, replacement: string | null) {
  const next = recentPaths().flatMap((item) =>
    item !== path ? [item] : replacement ? [replacement] : [],
  );
  writeRecent(recentKey, JSON.stringify([...new Set(next)]));
}

/**
 * Creates a new project snapshot with one empty analysis and fresh identifiers.
 * @returns A project snapshot timestamped in UTC.
 */
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

/**
 * Opens a native selector for a single .atus file.
 * @returns The chosen path, or null when the dialog is cancelled.
 * @throws If the native dialog cannot be opened.
 */
export const chooseProject = () => open({ filters, multiple: false });
/**
 * Opens a native save dialog with a suggested project filename.
 * @param name - Suggested name without an extension.
 * @returns The chosen path, or null when the dialog is cancelled.
 * @throws If the native dialog cannot be opened.
 */
export const chooseDestination = (name: string) => save({ filters, defaultPath: `${name}.atus` });

/** Native project operations. Each method rejects when the corresponding command fails. */
export const projectClient = {
  /** Creates a default-location project from a snapshot. */
  create: (snapshot: ProjectSnapshot) => invoke<OpenProject>("project_create", { snapshot }),
  /** Opens and migrates the project at a path. */
  open: (path: string) => invoke<OpenProject>("project_open", { path }),
  /** Saves a snapshot if the file still matches its previous state. */
  save: (path: string, previous: ProjectSnapshot, snapshot: ProjectSnapshot) =>
    invoke<void>("project_save", { path, previous, snapshot }),
  /** Creates a project copy at an unused path. */
  saveAs: (path: string, snapshot: ProjectSnapshot) =>
    invoke<OpenProject>("project_save_as", { path, snapshot }),
  /** Lists projects in the default directory. */
  list: () => invoke<string[]>("project_list"),
  /** Checks whether a path is an accessible file. */
  available: (path: string) => invoke<boolean>("project_available", { path }),
  /** Lists projects in the archive folder. */
  listArchived: () => invoke<string[]>("project_list_archived"),
  /** Reads name, dates, size and state for each path; unreadable files are still returned. */
  details: (paths: string[]) => invoke<ProjectDetails[]>("project_details", { paths }),
  /** Renames the stored name and the file together. Resolves with the new path. */
  rename: (path: string, newName: string) => invoke<string>("project_rename", { path, newName }),
  /** Moves a project to the archive folder. Resolves with the new path. */
  archive: (path: string) => invoke<string>("project_archive", { path }),
  /** Restores an archived project. Resolves with the new path. */
  unarchive: (path: string) => invoke<string>("project_unarchive", { path }),
  /** Moves a project file to the system trash. */
  remove: (path: string) => invoke<void>("project_delete", { path }),
  /** Shows the project file in the system file manager. */
  reveal: (path: string) => revealItemInDir(path),
};
