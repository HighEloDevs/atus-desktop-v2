/** Project persistence adapter contracts and recent-project behavior. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  reveal: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: native.reveal }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: native.open, save: native.save }));

import {
  chooseDestination,
  chooseProject,
  fileName,
  forgetProject,
  newSnapshot,
  projectClient,
  recentPaths,
  rememberProject,
  replaceRecentPath,
} from "../../src/features/projects/project-client";

const key = "atus.recent-projects.v1";
let store;

beforeEach(() => {
  vi.clearAllMocks();
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (name) => store.get(name) ?? null,
    setItem: (name, value) => store.set(name, value),
  });
  let next = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `id-${++next}` });
});

describe("recent projects", () => {
  it("extracts names from Windows and Unix paths without changing other extensions", () => {
    expect(fileName("C:\\Lab\\Pêndulo.ATUS")).toBe("Pêndulo");
    expect(fileName("/lab/test.csv")).toBe("test.csv");
  });

  it("ignores malformed values, non-arrays and non-string entries", () => {
    store.set(key, "not json");
    expect(recentPaths()).toEqual([]);
    store.set(key, '{"path":"x"}');
    expect(recentPaths()).toEqual([]);
    store.set(key, '["a",null,42,"b"]');
    expect(recentPaths()).toEqual(["a", "b"]);
  });

  it("moves a project to the front, removes replaced paths, and limits history", () => {
    store.set(key, JSON.stringify(Array.from({ length: 102 }, (_, i) => `p${i}`)));
    rememberProject("p2", "p1");
    const paths = recentPaths();
    expect(paths).toHaveLength(100);
    expect(paths[0]).toBe("p2");
    expect(paths.filter((path) => path === "p2")).toHaveLength(1);
    expect(paths).not.toContain("p1");
    forgetProject("p2");
    expect(recentPaths()).not.toContain("p2");
  });

  it("replaces a path in place, drops it, and avoids duplicates", () => {
    store.set(key, '["a","b","c"]');
    replaceRecentPath("b", "x");
    expect(recentPaths()).toEqual(["a", "x", "c"]);
    replaceRecentPath("a", "c");
    expect(recentPaths()).toEqual(["c", "x"]);
    replaceRecentPath("x", null);
    expect(recentPaths()).toEqual(["c"]);
    replaceRecentPath("missing", "y");
    expect(recentPaths()).toEqual(["c"]);
  });

  it("tolerates unavailable browser storage without throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("unavailable");
      },
      setItem() {
        throw new Error("unavailable");
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(recentPaths()).toEqual([]);
    expect(() => rememberProject("p")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("native project operations", () => {
  it("creates separate project and analysis identifiers with matching timestamps", () => {
    const snapshot = newSnapshot();
    expect(snapshot.id).toBe("id-1");
    expect(snapshot.analyses).toEqual([{ id: "id-2", kind: "analysis", datasets: [], state: {} }]);
    expect(snapshot.created_at).toBe(snapshot.updated_at);
    expect(Number.isNaN(Date.parse(snapshot.created_at))).toBe(false);
  });

  it("configures single-file selection and a suggested save filename", async () => {
    native.open.mockResolvedValue(null);
    native.save.mockResolvedValue("/tmp/project.atus");
    expect(await chooseProject()).toBeNull();
    expect(native.open).toHaveBeenCalledWith({
      filters: [{ name: "Projeto ATUS", extensions: ["atus"] }],
      multiple: false,
    });
    expect(await chooseDestination("project")).toBe("/tmp/project.atus");
    expect(native.save).toHaveBeenCalledWith({
      filters: [{ name: "Projeto ATUS", extensions: ["atus"] }],
      defaultPath: "project.atus",
    });
  });

  it("forwards management operations to the native commands", async () => {
    native.invoke.mockResolvedValue("/new.atus");
    await projectClient.listArchived();
    await projectClient.details(["a"]);
    await projectClient.rename("a", "b");
    await projectClient.archive("a");
    await projectClient.unarchive("a");
    await projectClient.remove("a");
    await projectClient.reveal("a");
    expect(native.invoke.mock.calls).toEqual([
      ["project_list_archived"],
      ["project_details", { paths: ["a"] }],
      ["project_rename", { path: "a", newName: "b" }],
      ["project_archive", { path: "a" }],
      ["project_unarchive", { path: "a" }],
      ["project_delete", { path: "a" }],
    ]);
    expect(native.reveal).toHaveBeenCalledWith("a");
  });

  it("forwards project operations and propagates errors from native commands", async () => {
    const snapshot = newSnapshot();
    const previous = { ...snapshot, name: "before" };
    native.invoke.mockResolvedValueOnce({ path: "p", snapshot });
    expect(await projectClient.create(snapshot)).toEqual({ path: "p", snapshot });
    await projectClient.open("p");
    await projectClient.save("p", previous, snapshot);
    await projectClient.saveAs("q", snapshot);
    await projectClient.list();
    await projectClient.available("p");
    expect(native.invoke.mock.calls).toEqual([
      ["project_create", { snapshot }],
      ["project_open", { path: "p" }],
      ["project_save", { path: "p", previous, snapshot }],
      ["project_save_as", { path: "q", snapshot }],
      ["project_list"],
      ["project_available", { path: "p" }],
    ]);
    native.invoke.mockRejectedValueOnce(new Error("invalid project"));
    await expect(projectClient.open("bad")).rejects.toThrow("invalid project");
  });
});
