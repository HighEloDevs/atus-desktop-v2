// @vitest-environment jsdom
/** Behavior of discovered, recent and unavailable projects. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const api = vi.hoisted(() => ({
  chooseProject: vi.fn(),
  fileName: (path) =>
    path
      .split("/")
      .pop()
      .replace(/\.atus$/i, ""),
  forgetProject: vi.fn(),
  projectClient: { list: vi.fn(), available: vi.fn() },
  recentPaths: vi.fn(),
}));
vi.mock("../../src/features/projects/project-client", () => api);
import { RecentProjects } from "../../src/features/projects/RecentProjects";

let root;
let node;
let onOpen;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  onOpen = vi.fn().mockResolvedValue(undefined);
  api.recentPaths.mockReturnValue([]);
  api.projectClient.list.mockResolvedValue([]);
  api.projectClient.available.mockResolvedValue(false);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render() {
  await act(async () => root.render(createElement(RecentProjects, { onOpen })));
}

it("shows an empty state after loading an empty project list", async () => {
  await render();
  expect(node.textContent).toContain("Nenhum projeto recente");
});

it("deduplicates discovered and recent paths and opens an available project", async () => {
  api.recentPaths.mockReturnValue(["/a.atus", "/missing.atus"]);
  api.projectClient.list.mockResolvedValue(["/a.atus", "/b.atus"]);
  await render();
  expect(node.querySelectorAll("li")).toHaveLength(3);
  expect(node.textContent).toContain("Arquivo indisponível");
  expect(api.projectClient.available).toHaveBeenCalledWith("/missing.atus");
  await act(async () => node.querySelector('button[title="/a.atus"]').click());
  expect(onOpen).toHaveBeenCalledWith("/a.atus");
});

it("locates missing projects and forwards the replacement and original paths", async () => {
  api.recentPaths.mockReturnValue(["/missing.atus"]);
  api.chooseProject.mockResolvedValue("/replacement.atus");
  await render();
  await act(async () => node.querySelector('button[title="/missing.atus"]').click());
  expect(onOpen).toHaveBeenCalledWith("/replacement.atus", "/missing.atus");
});

it("shows a clear error if discovery fails and retains recent projects", async () => {
  api.recentPaths.mockReturnValue(["/a.atus"]);
  api.projectClient.list.mockRejectedValue(new Error("unavailable"));
  api.projectClient.available.mockResolvedValue(true);
  await render();
  expect(node.querySelector('[role="alert"]').textContent).toContain("unavailable");
  expect(node.querySelector('button[title="/a.atus"]')).not.toBeNull();
});

it("shows an error when the relocation dialog fails", async () => {
  api.recentPaths.mockReturnValue(["/missing.atus"]);
  api.chooseProject.mockRejectedValue(new Error("dialog failed"));
  await render();
  await act(async () => node.querySelector('button[title="/missing.atus"]').click());
  expect(node.querySelector('[role="alert"]').textContent).toContain("dialog failed");
  expect(onOpen).not.toHaveBeenCalled();
});
