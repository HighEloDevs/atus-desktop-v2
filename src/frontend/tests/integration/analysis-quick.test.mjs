// @vitest-environment jsdom
/** The analysis page opened by a quick analysis: automatic fit and the replacement prompt. */
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
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
const save = vi.hoisted(() => ({ canLeave: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: null,
    status: "Salvo",
    error: "",
    canLeave: save.canLeave,
    flush: async () => true,
    saveAs: async () => {},
  }),
}));
vi.mock("../../src/components/chart/Chart", () => ({
  Chart: ({ series }) =>
    createElement(
      "div",
      { "data-testid": "chart" },
      series.map((s) => `${s.name}:${s.points.length}:${s.linePoints.length}`).join(";"),
    ),
}));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";
import { quickAnalysisSnapshot } from "../../src/features/quick-analysis/quick-analysis-client";

const request = {
  equation: "a*x + b",
  points: [
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ],
};
let root;
let node;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  save.canLeave.mockResolvedValue(true);
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render(props) {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack: vi.fn(),
        project: { path: "/quick.atus", snapshot: quickAnalysisSnapshot(request) },
        finderPath: null,
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
        ...props,
      }),
    ),
  );
}
const chart = () => node.querySelector('[data-testid="chart"]').textContent;
const dialog = () => document.querySelector('[role="dialog"]');
function dialogButton(text) {
  return [...dialog().querySelectorAll("button")].find((b) => b.textContent.includes(text));
}

it("opens the quick analysis dataset with its equation and runs the fit once", async () => {
  await render({ runFitsOnOpen: true });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(chart()).toMatch(/^Dados da análise rápida:3:[1-9]/);
  expect(node.querySelector('input[aria-label^="Função de ajuste"]').value).toBe("a*x + b");
  expect(notify.success).toHaveBeenCalledTimes(1);
  await render({ runFitsOnOpen: true, onBack: vi.fn() });
  expect(notify.success).toHaveBeenCalledTimes(1);
});

it("does not fit on its own when opened normally", async () => {
  await render();
  expect(chart()).toBe("Dados da análise rápida:3:0");
  expect(dialog()).toBeNull();
  expect(notify.success).not.toHaveBeenCalled();
});

it("saves before replacing the analysis and lets the person keep it", async () => {
  const onStartQuick = vi.fn().mockResolvedValue(undefined);
  const onCancelQuick = vi.fn();
  await render({ quickRequest: request, onStartQuick, onCancelQuick });
  expect(dialog().textContent).toContain("Abrir a análise rápida?");
  await act(async () => dialogButton("Abrir análise rápida").click());
  expect(save.canLeave).toHaveBeenCalled();
  expect(onStartQuick).toHaveBeenCalledWith(request);
  save.canLeave.mockResolvedValue(false);
  await act(async () => dialogButton("Abrir análise rápida").click());
  expect(onStartQuick).toHaveBeenCalledTimes(1);
  await act(async () => dialogButton("Continuar aqui").click());
  expect(onCancelQuick).toHaveBeenCalled();
});

it("ignores a second confirmation while the first is opening", async () => {
  let finish;
  const onStartQuick = vi.fn(() => new Promise((resolve) => (finish = resolve)));
  await render({ quickRequest: request, onStartQuick, onCancelQuick: vi.fn() });
  await act(async () => dialogButton("Abrir análise rápida").click());
  expect(dialogButton("Abrindo")).toBeTruthy();
  expect(dialogButton("Abrindo").disabled).toBe(true);
  await act(async () => {
    dialog().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(dialog()).not.toBeNull();
  await act(async () => finish());
  expect(onStartQuick).toHaveBeenCalledTimes(1);
});
