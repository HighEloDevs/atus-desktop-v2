// @vitest-environment jsdom
/** The main window receives a quick analysis, creates its project and asks it to run the fit. */
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
  newSnapshot: vi.fn(),
  projectClient: { create: vi.fn(), open: vi.fn() },
  analysisProps: null,
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri, invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: bridge.listen }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../../src/features/projects/project-client", () => ({
  chooseProject: vi.fn(),
  newSnapshot: bridge.newSnapshot,
  rememberProject: vi.fn(),
  projectClient: bridge.projectClient,
}));
vi.mock("../../src/features/projects/ProjectTables", () => ({
  ProjectTables: ({ onOpen }) =>
    createElement("button", { onClick: () => onOpen("/recent.atus") }, "Recent fixture"),
}));
vi.mock("../../src/features/analysis/AnalysisPage", () => ({
  AnalysisPage: (props) => {
    bridge.analysisProps = props;
    return createElement("span", { "data-testid": "analysis" }, props.project?.path);
  },
}));
import App from "../../src/App";

const request = { equation: "a*x", points: [{ x: 1, y: 2 }] };
let root;
let node;
let handlers;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  handlers = {};
  bridge.analysisProps = null;
  bridge.isTauri.mockReturnValue(true);
  bridge.invoke.mockResolvedValue(null);
  bridge.listen.mockImplementation(async (event, handler) => {
    handlers[event] = handler;
    return () => {};
  });
  bridge.newSnapshot.mockImplementation(() => ({
    id: "p",
    name: "Projeto sem título",
    analyses: [{ id: "a", kind: "analysis", datasets: [], state: {} }],
  }));
  bridge.projectClient.create.mockImplementation(async (snapshot) => ({
    path: "/quick.atus",
    snapshot,
  }));
  bridge.projectClient.open.mockImplementation(async (path) => ({ path, snapshot: {} }));
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
async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

it("opens a waiting quick analysis from the home page as a new project with an automatic fit", async () => {
  bridge.invoke.mockImplementation(async (command) =>
    command === "take_quick_analysis" ? request : null,
  );
  await render();
  await settle();
  expect(bridge.invoke).toHaveBeenCalledWith("take_quick_analysis");
  const [snapshot] = bridge.projectClient.create.mock.calls[0];
  expect(snapshot.analyses[0].datasets[0]).toMatchObject({
    points: [{ x: 1, y: 2, sx: null, sy: null }],
    state: { equation: "a*x" },
  });
  expect(node.querySelector('[data-testid="analysis"]').textContent).toBe("/quick.atus");
  expect(bridge.analysisProps.runFitsOnOpen).toBe(true);
  expect(bridge.analysisProps.quickRequest).toBeNull();
  await act(async () => bridge.analysisProps.onBack());
  expect(node.textContent).toContain("Projetos");
});

it("hands a quick analysis to the open analysis, which confirms or cancels it", async () => {
  await render();
  await act(async () =>
    [...node.querySelectorAll("button")].find((b) => b.textContent === "Recent fixture").click(),
  );
  expect(bridge.analysisProps.runFitsOnOpen).toBe(false);
  bridge.invoke.mockImplementation(async (command) =>
    command === "take_quick_analysis" ? request : null,
  );
  await act(async () => handlers["quick-analysis-requested"]());
  expect(bridge.analysisProps.quickRequest).toEqual(request);
  expect(bridge.projectClient.create).not.toHaveBeenCalled();
  await act(async () => bridge.analysisProps.onCancelQuick());
  expect(bridge.analysisProps.quickRequest).toBeNull();
  await act(async () => handlers["quick-analysis-requested"]());
  await act(async () => bridge.analysisProps.onStartQuick(bridge.analysisProps.quickRequest));
  expect(bridge.projectClient.create).toHaveBeenCalledTimes(1);
  expect(bridge.analysisProps.project.path).toBe("/quick.atus");
  expect(bridge.analysisProps.runFitsOnOpen).toBe(true);
  expect(bridge.analysisProps.quickRequest).toBeNull();
});

it("reports a quick analysis that cannot be read and quits at once from the home page", async () => {
  bridge.invoke.mockImplementation(async (command) => {
    if (command === "take_quick_analysis") throw new Error("falhou");
    return null;
  });
  await render();
  await settle();
  expect(notify.error).toHaveBeenCalledWith("Não foi possível abrir o projeto", expect.anything());
  bridge.invoke.mockResolvedValue(undefined);
  await act(async () => handlers["app-quit-requested"]());
  expect(bridge.invoke).toHaveBeenCalledWith("app_quit");
});
