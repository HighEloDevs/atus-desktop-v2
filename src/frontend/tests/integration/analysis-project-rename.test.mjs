// @vitest-environment jsdom
/** Renaming the open project from the analysis header. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const state = vi.hoisted(() => ({ rename: vi.fn() }));
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: { path: "/p/a.atus", snapshot: { name: "Pêndulo", analyses: [] } },
    status: "Salvo",
    error: "",
    usesNativeMenu: true,
    canLeave: async () => true,
    flush: async () => true,
    saveAs: async () => {},
    rename: state.rename,
  }),
}));
vi.mock("../../src/components/chart/Chart", () => ({ Chart: () => null }));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";

let root;
let node;
beforeEach(() => {
  vi.clearAllMocks();
  state.rename.mockResolvedValue(undefined);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

it("renames the project from the header title and confirms with a snackbar", async () => {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack: vi.fn(),
        finderPath: null,
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
      }),
    ),
  );
  await act(async () => node.querySelector('button[title="Renomear projeto (F2)"]').click());
  const input = node.querySelector('input[aria-label="Nome do projeto"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, " Queda ");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })),
  );
  expect(state.rename).toHaveBeenCalledWith(" Queda ");
  expect(notify.success).toHaveBeenCalledWith("Projeto renomeado", { description: "Queda" });
});
