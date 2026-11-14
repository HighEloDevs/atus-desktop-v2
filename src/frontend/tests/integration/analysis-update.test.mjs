// @vitest-environment jsdom
/** Analysis screen: the compact update button is always in the toolbar, and the project is saved before an update installs. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const native = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@tauri-apps/api/core", () => native);
const save = vi.hoisted(() => ({ flush: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: null,
    status: "Salvo",
    error: "",
    canLeave: async () => true,
    flush: save.flush,
    saveAs: async () => {},
  }),
}));
vi.mock("../../src/components/chart/Chart", () => ({ Chart: () => null }));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";
import { INERT_UPDATE, UpdateContext } from "../../src/features/updates/update-context";

let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  native.isTauri.mockReturnValue(false);
  save.flush.mockResolvedValue(true);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render(value) {
  await act(async () =>
    root.render(
      createElement(
        UpdateContext.Provider,
        { value: { ...INERT_UPDATE, ...value } },
        createElement(AnalysisPage, {
          onBack: vi.fn(),
          project: null,
          finderPath: null,
          onOpenFinderProject: vi.fn(),
          onCancelFinderProject: vi.fn(),
        }),
      ),
    ),
  );
}

it("keeps the update button in the main toolbar, even with the side panel closed", async () => {
  const openDialog = vi.fn();
  await render({ state: { kind: "ready", version: "0.3.0", notes: null }, openDialog });
  const toolbar = () => node.querySelector("main > div");
  const update = () => toolbar().querySelector('button[aria-label="Atualizar"]');
  expect(update()).not.toBeNull();
  await act(async () => node.querySelector('button[aria-label="Ocultar painel"]').click());
  expect(node.querySelector(".analysis-panel")).toBeNull();
  expect(update()).not.toBeNull();
  await act(async () => update().click());
  expect(openDialog).toHaveBeenCalledTimes(1);
});

it("shows the banner above the toolbar", async () => {
  await render({
    state: { kind: "ready", version: "0.3.0", notes: "Resumo." },
    bannerVisible: true,
  });
  expect(node.querySelector("main").firstElementChild.textContent).toContain("Nova versão · 0.3.0");
});

it("saves the project before an update installs, and unregisters when it closes", async () => {
  const setInstallGuard = vi.fn();
  await render({ setInstallGuard });
  expect(setInstallGuard).toHaveBeenCalledTimes(1);
  const guard = setInstallGuard.mock.calls[0][0];
  save.flush.mockResolvedValueOnce(false);
  await expect(guard()).resolves.toBe(false);
  await expect(guard()).resolves.toBe(true);
  expect(save.flush).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  expect(setInstallGuard).toHaveBeenLastCalledWith(null);
  root = createRoot(node);
});
