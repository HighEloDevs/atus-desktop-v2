// @vitest-environment jsdom
/** Application navigation and project orchestration with a simulated desktop bridge. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
const bridge = vi.hoisted(() => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
  listen: vi.fn(),
  openUrl: vi.fn(),
  chooseProject: vi.fn(),
  newSnapshot: vi.fn(),
  rememberProject: vi.fn(),
  projectClient: { create: vi.fn(), open: vi.fn() },
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri, invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: bridge.listen }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: bridge.openUrl }));
vi.mock("../../src/features/projects/project-client", () => ({
  chooseProject: bridge.chooseProject,
  newSnapshot: bridge.newSnapshot,
  rememberProject: bridge.rememberProject,
  projectClient: bridge.projectClient,
}));
vi.mock("../../src/features/projects/ProjectTables", () => ({
  ProjectTables: ({ onOpen }) =>
    createElement("button", { onClick: () => onOpen("/recent.atus") }, "Recent fixture"),
}));
vi.mock("../../src/features/analysis/AnalysisPage", () => ({
  AnalysisPage: ({ project, onBack }) =>
    createElement(
      "div",
      null,
      createElement("span", { "data-testid": "analysis" }, project?.path ?? "browser"),
      createElement("button", { onClick: onBack }, "Back fixture"),
    ),
}));
import App from "../../src/App";

let root;
let node;
const snapshot = { id: "id", name: "Projeto", analyses: [] };
const opened = { path: "/project.atus", snapshot };

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  bridge.isTauri.mockReturnValue(true);
  bridge.newSnapshot.mockReturnValue(snapshot);
  bridge.projectClient.create.mockResolvedValue(opened);
  bridge.projectClient.open.mockResolvedValue(opened);
  bridge.chooseProject.mockResolvedValue(null);
  bridge.listen.mockResolvedValue(() => {});
  bridge.invoke.mockResolvedValue(null);
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render() {
  await act(async () => root.render(createElement(App)));
}
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

it("creates a native project, remembers it, and returns to the home page", async () => {
  await render();
  await act(async () => button("Nova análise").click());
  expect(bridge.projectClient.create).toHaveBeenCalledWith(snapshot);
  expect(bridge.rememberProject).toHaveBeenCalledWith("/project.atus", undefined);
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/project.atus");
  await act(async () => button("Back fixture").click());
  expect(node.textContent).toContain("Projetos");
});

it("opens a selected native project and treats dialog cancellation as no-op", async () => {
  await render();
  await act(async () => button("Abrir projeto").click());
  expect(bridge.projectClient.open).not.toHaveBeenCalled();
  expect(node.querySelector('[data-testid="analysis"]')).toBeNull();
  bridge.chooseProject.mockResolvedValueOnce("/chosen.atus");
  await act(async () => button("Abrir projeto").click());
  expect(bridge.projectClient.open).toHaveBeenCalledWith("/chosen.atus");
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/project.atus");
});

it("shows an understandable error and remains on home when project creation fails", async () => {
  bridge.projectClient.create.mockRejectedValue(new Error("disk failure"));
  await render();
  await act(async () => button("Nova análise").click());
  expect(notify.error).toHaveBeenCalledWith("Não foi possível abrir o projeto", {
    description: expect.stringContaining("disk failure"),
    id: "project-error",
  });
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(node.querySelector('[data-testid="analysis"]')).toBeNull();
});

it("opens a recent project with the project bridge", async () => {
  await render();
  await act(async () => button("Recent fixture").click());
  expect(bridge.projectClient.open).toHaveBeenCalledWith("/recent.atus");
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/project.atus");
});

it("honors the platform shortcut once and ignores key repeats and editing fields", async () => {
  await render();
  const input = document.createElement("input");
  node.append(input);
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, code: "KeyN", ctrlKey: true, altKey: true }),
    ),
  );
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyN", ctrlKey: true, altKey: true, repeat: true }),
    ),
  );
  expect(bridge.projectClient.create).not.toHaveBeenCalled();
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyN", ctrlKey: true, altKey: true }),
    ),
  );
  expect(bridge.projectClient.create).toHaveBeenCalledTimes(1);
});

it("provides browser preview without invoking native creation", async () => {
  bridge.isTauri.mockReturnValue(false);
  await render();
  await act(async () => button("Nova análise").click());
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("browser");
  expect(bridge.projectClient.create).not.toHaveBeenCalled();
});

it("navigates to about and reports a failed external profile opening", async () => {
  bridge.openUrl.mockRejectedValue(new Error("browser unavailable"));
  await render();
  await act(async () => button("Sobre").click());
  expect(node.textContent).toContain("Sobre o ATUS");
  await act(async () =>
    node
      .querySelector('button[aria-label="Abrir LinkedIn de Willian Maximo no navegador"]')
      .click(),
  );
  expect(bridge.openUrl).toHaveBeenCalledWith(
    "https://www.linkedin.com/in/willian-gama-maximo-85297017b/",
  );
  expect(notify.error).toHaveBeenCalledWith("Não foi possível abrir o navegador", {
    description: "Tente novamente.",
    id: "profile-error",
  });
});

it("opens a Finder request on macOS", async () => {
  Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  bridge.invoke.mockResolvedValueOnce("/finder.atus");
  await render();
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(bridge.listen).toHaveBeenCalledWith("finder-project-requested", expect.any(Function));
  expect(bridge.projectClient.open).toHaveBeenCalledWith("/finder.atus");
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/project.atus");
});

it("prevents overlapping creation requests while the first is pending", async () => {
  let finish;
  bridge.projectClient.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await act(async () => {
    button("Nova análise").click();
    button("Nova análise").click();
  });
  expect(bridge.projectClient.create).toHaveBeenCalledTimes(1);
  await act(async () => finish(opened));
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/project.atus");
});

it("shows an error when the Finder request cannot be read", async () => {
  Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  bridge.invoke.mockRejectedValueOnce(new Error("Finder unavailable"));
  await render();
  expect(notify.error).toHaveBeenCalledWith("Não foi possível abrir o projeto", {
    description: expect.stringContaining("Finder unavailable"),
    id: "project-error",
  });
  expect(bridge.projectClient.open).not.toHaveBeenCalled();
});

it("uses Command-Option-N on macOS and does not trigger the Control shortcut", async () => {
  Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  await render();
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyN", ctrlKey: true, altKey: true }),
    ),
  );
  expect(bridge.projectClient.create).not.toHaveBeenCalled();
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyN", metaKey: true, altKey: true }),
    ),
  );
  expect(bridge.projectClient.create).toHaveBeenCalledTimes(1);
});

it("opens an external profile through the browser in preview mode", async () => {
  bridge.isTauri.mockReturnValue(false);
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  await render();
  await act(async () => button("Sobre").click());
  await act(async () =>
    node
      .querySelector('button[aria-label="Abrir LinkedIn de Willian Maximo no navegador"]')
      .click(),
  );
  expect(open).toHaveBeenCalledWith(
    "https://www.linkedin.com/in/willian-gama-maximo-85297017b/",
    "_blank",
    "noopener,noreferrer",
  );
  open.mockRestore();
});
