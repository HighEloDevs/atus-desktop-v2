// @vitest-environment jsdom
/** Recent and all-projects tables with rename, archive, delete and reveal actions. */
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
  replaceRecentPath: vi.fn(),
  recentPaths: vi.fn(),
  projectClient: {
    list: vi.fn(),
    listArchived: vi.fn(),
    details: vi.fn(),
    rename: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    remove: vi.fn(),
    reveal: vi.fn(),
  },
}));
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
vi.mock("../../src/features/projects/project-client", () => api);
// Radix menus need pointer events that jsdom lacks; render the items inline instead.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => createElement("div", null, children),
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => createElement("div", { role: "menu" }, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: ({ children, onSelect }) =>
    createElement("button", { type: "button", role: "menuitem", onClick: onSelect }, children),
}));
import { ProjectTables } from "../../src/features/projects/ProjectTables";

const detail = (path, extra = {}) => ({
  path,
  name: path.split("/").pop().replace(".atus", ""),
  modified: 1_700_000_000_000,
  size: 2048,
  archived: false,
  available: true,
  error: null,
  ...extra,
});

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
  api.projectClient.listArchived.mockResolvedValue([]);
  api.projectClient.details.mockImplementation(async (paths) => paths.map((p) => detail(p)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  document.body.innerHTML = "";
});

async function render() {
  await act(async () => root.render(createElement(ProjectTables, { onOpen })));
}
const rows = (label) =>
  [...node.querySelectorAll(`table[aria-labelledby="${label}"] tbody tr`)].map(
    (r) => r.textContent,
  );
const item = (scope, text) =>
  [...scope.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === text);
const section = (id) => node.querySelector(`section[aria-labelledby="${id}"]`);
const firstRow = (id) => section(id).querySelector("tbody tr");
const click = (el) => act(async () => el.click());

it("shows the empty state and no results message for an empty list", async () => {
  await render();
  expect(node.textContent).toContain("Nenhum projeto recente");
  expect(node.textContent).toContain("Nenhum projeto encontrado.");
});

it("lists recents (including outside projects) and all projects separately", async () => {
  api.recentPaths.mockReturnValue(["/outside/a.atus"]);
  api.projectClient.list.mockResolvedValue(["/docs/b.atus"]);
  api.projectClient.listArchived.mockResolvedValue(["/docs/archived/c.atus"]);
  api.projectClient.details.mockImplementation(async (paths) =>
    paths.map((p) => detail(p, { archived: p.includes("archived") })),
  );
  await render();
  expect(rows("recent-heading")).toHaveLength(1);
  expect(rows("recent-heading")[0]).toContain("a");
  // Default filter hides archived projects, and outside projects are not in "all".
  expect(rows("all-heading")).toHaveLength(1);
  expect(rows("all-heading")[0]).toContain("b");
  await click([...node.querySelectorAll("button")].find((b) => b.textContent === "Arquivados"));
  expect(rows("all-heading")).toHaveLength(1);
  expect(rows("all-heading")[0]).toContain("Arquivado");
  await click([...node.querySelectorAll("button")].find((b) => b.textContent === "Todos"));
  expect(rows("all-heading")).toHaveLength(2);
});

it("filters by name and sorts by name or modification", async () => {
  api.projectClient.list.mockResolvedValue(["/d/zeta.atus", "/d/alfa.atus"]);
  api.projectClient.details.mockImplementation(async (paths) =>
    paths.map((p, i) => detail(p, { modified: i === 0 ? 2 : 1 })),
  );
  await render();
  expect(rows("all-heading")[0]).toContain("zeta");
  await click([...node.querySelectorAll("button")].find((b) => b.textContent === "A–Z"));
  expect(rows("all-heading")[0]).toContain("alfa");
  const search = node.querySelector('input[aria-label="Buscar projetos"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(search, "ze");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(rows("all-heading")).toHaveLength(1);
  expect(rows("all-heading")[0]).toContain("zeta");
});

it("opens an available project and relocates a missing one", async () => {
  api.recentPaths.mockReturnValue(["/a.atus", "/missing.atus"]);
  api.projectClient.details.mockImplementation(async (paths) =>
    paths.map((p) => detail(p, { available: !p.includes("missing"), modified: null })),
  );
  api.chooseProject.mockResolvedValue("/replacement.atus");
  await render();
  expect(node.textContent).toContain("Arquivo indisponível");
  await click(node.querySelector('button[aria-label="Abrir a"]'));
  expect(onOpen).toHaveBeenCalledWith("/a.atus");
  await click(node.querySelector('button[aria-label="Localizar missing"]'));
  expect(onOpen).toHaveBeenCalledWith("/replacement.atus", "/missing.atus");
});

it("reports a failed relocation dialog", async () => {
  api.recentPaths.mockReturnValue(["/missing.atus"]);
  api.projectClient.details.mockResolvedValue([detail("/missing.atus", { available: false })]);
  api.chooseProject.mockRejectedValue(new Error("dialog failed"));
  await render();
  await click(node.querySelector('button[aria-label="Localizar missing"]'));
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível localizar o projeto",
    expect.objectContaining({ description: expect.stringContaining("dialog failed") }),
  );
  expect(onOpen).not.toHaveBeenCalled();
});

it("keeps loading projects when the folder listing fails", async () => {
  api.recentPaths.mockReturnValue(["/a.atus"]);
  api.projectClient.list.mockRejectedValue(new Error("unavailable"));
  await render();
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível listar a pasta de projetos",
    expect.objectContaining({ description: expect.stringContaining("unavailable") }),
  );
  expect(rows("recent-heading")).toHaveLength(1);
});

it("renames through the dialog, updates recents and offers undo", async () => {
  api.projectClient.list.mockResolvedValue(["/d/old.atus"]);
  api.projectClient.rename
    .mockResolvedValueOnce("/d/new.atus")
    .mockResolvedValueOnce("/d/old.atus");
  await render();
  await click(item(firstRow("all-heading"), "Renomear…"));
  const input = document.querySelector('input[aria-label="Novo nome"]');
  expect(input.value).toBe("old");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "new");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(api.projectClient.rename).toHaveBeenCalledWith("/d/old.atus", "new");
  expect(api.replaceRecentPath).toHaveBeenCalledWith("/d/old.atus", "/d/new.atus");
  expect(document.querySelector("form")).toBeNull();
  const options = notify.success.mock.calls[0][1];
  await act(async () => options.actions[0].onClick());
  expect(api.projectClient.rename).toHaveBeenLastCalledWith("/d/new.atus", "old");
  expect(api.replaceRecentPath).toHaveBeenLastCalledWith("/d/new.atus", "/d/old.atus");
});

it("keeps the rename dialog open and shows the error when renaming fails", async () => {
  api.projectClient.list.mockResolvedValue(["/d/old.atus"]);
  api.projectClient.rename.mockRejectedValue("Já existe um projeto com esse nome nesta pasta.");
  await render();
  await click(item(firstRow("all-heading"), "Renomear…"));
  await act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(document.querySelector('[role="alert"]').textContent).toContain("Já existe");
  expect(api.replaceRecentPath).not.toHaveBeenCalled();
});

it("archives and restores projects with undo, updating recent paths", async () => {
  api.projectClient.list.mockResolvedValue(["/d/a.atus"]);
  api.projectClient.archive.mockResolvedValue("/d/archived/a.atus");
  api.projectClient.unarchive.mockResolvedValue("/d/a.atus");
  await render();
  await click(item(firstRow("all-heading"), "Arquivar"));
  expect(api.projectClient.archive).toHaveBeenCalledWith("/d/a.atus");
  expect(api.replaceRecentPath).toHaveBeenCalledWith("/d/a.atus", "/d/archived/a.atus");
  expect(notify.success).toHaveBeenCalledWith("Projeto arquivado", expect.anything());
  await act(async () => notify.success.mock.calls[0][1].actions[0].onClick());
  expect(api.projectClient.unarchive).toHaveBeenCalledWith("/d/archived/a.atus");
});

it("offers Desarquivar for archived projects and reports failures", async () => {
  api.projectClient.listArchived.mockResolvedValue(["/d/archived/a.atus"]);
  api.projectClient.details.mockResolvedValue([detail("/d/archived/a.atus", { archived: true })]);
  api.projectClient.unarchive.mockRejectedValue("falhou");
  await render();
  await click([...node.querySelectorAll("button")].find((b) => b.textContent === "Arquivados"));
  await click(item(firstRow("all-heading"), "Desarquivar"));
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível alterar o arquivamento",
    expect.objectContaining({ description: "falhou" }),
  );
});

it("deletes only after confirmation and forgets the path", async () => {
  api.recentPaths.mockReturnValue(["/d/a.atus"]);
  api.projectClient.list.mockResolvedValue(["/d/a.atus"]);
  api.projectClient.remove.mockResolvedValue(undefined);
  await render();
  await click(item(firstRow("all-heading"), "Excluir…"));
  expect(api.projectClient.remove).not.toHaveBeenCalled();
  const cancel = [...document.querySelectorAll("button")].find((b) => b.textContent === "Cancelar");
  await click(cancel);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click(item(firstRow("all-heading"), "Excluir…"));
  await click(
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Mover para a Lixeira"),
  );
  expect(api.projectClient.remove).toHaveBeenCalledWith("/d/a.atus");
  expect(api.forgetProject).toHaveBeenCalledWith("/d/a.atus");
});

it("reports a failed delete without forgetting the project", async () => {
  api.projectClient.list.mockResolvedValue(["/d/a.atus"]);
  api.projectClient.remove.mockRejectedValue("sem permissão");
  await render();
  await click(item(firstRow("all-heading"), "Excluir…"));
  await click(
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Mover para a Lixeira"),
  );
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível excluir o projeto",
    expect.objectContaining({ description: "sem permissão" }),
  );
  expect(api.forgetProject).not.toHaveBeenCalled();
});

it("reveals the file and reports a reveal failure", async () => {
  api.projectClient.list.mockResolvedValue(["/d/a.atus"]);
  api.projectClient.reveal.mockRejectedValueOnce(new Error("no finder"));
  await render();
  await click(item(firstRow("all-heading"), "Mostrar na pasta"));
  expect(api.projectClient.reveal).toHaveBeenCalledWith("/d/a.atus");
  expect(notify.error).toHaveBeenCalledWith("Não foi possível abrir a pasta", expect.anything());
});

it("removes an entry from recents without touching the file", async () => {
  api.recentPaths.mockReturnValue(["/d/a.atus"]);
  await render();
  await click(item(firstRow("recent-heading"), "Remover dos recentes"));
  expect(api.forgetProject).toHaveBeenCalledWith("/d/a.atus");
  expect(api.projectClient.remove).not.toHaveBeenCalled();
});

it("opens through the row button and keeps Abrir out of the actions menu", async () => {
  api.projectClient.list.mockResolvedValue(["/d/a.atus"]);
  await render();
  const labels = [...firstRow("all-heading").querySelectorAll('[role="menuitem"]')].map(
    (b) => b.textContent,
  );
  expect(labels).toEqual(["Renomear…", "Mostrar na pasta", "Arquivar", "Excluir…"]);
  await click(firstRow("all-heading").querySelector('button[aria-label="Abrir a"]'));
  expect(onOpen).toHaveBeenCalledWith("/d/a.atus");
});
