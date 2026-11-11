// @vitest-environment jsdom
/** Analysis workspace imports, demonstration, and simulated-fit integration. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const native = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => native);
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: null,
    status: "Salvo",
    error: "",
    canLeave: async () => true,
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

let root;
let node;
let onBack;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  native.isTauri.mockReturnValue(false);
  native.invoke.mockReset();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  onBack = vi.fn();
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render() {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack,
        finderPath: null,
        projectError: "",
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
      }),
    ),
  );
}

function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

async function importFiles(files) {
  const input = node.querySelector('input[type="file"][multiple]');
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

async function setInput(label, value) {
  const input = node.querySelector(`input[aria-label="${label}"]`);
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("shows the empty state, toggles the panel, and returns to the home page", async () => {
  await render();
  expect(node.textContent).toContain("Comece sua análise");
  expect(button("Executar ajustes").disabled).toBe(true);
  await act(async () => node.querySelector('button[aria-label="Ocultar painel"]').click());
  expect(node.querySelector('button[aria-label="Mostrar painel"]')).not.toBeNull();
  await act(async () => button("Abrir painel de dados").click());
  expect(node.querySelector('button[aria-label="Ocultar painel"]')).not.toBeNull();
  await act(async () => node.querySelector('button[aria-label="Voltar ao início"]').click());
  expect(onBack).toHaveBeenCalledOnce();
});

it("imports valid points and runs only the clearly marked simulation", async () => {
  await render();
  await importFiles([{ name: "ensaio.csv", size: 20, text: async () => "x;y\n1;2\n2;4" }]);
  expect(node.textContent).toContain("ensaio.csv");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("ensaio.csv:2:0");
  await setInput("Função de ajuste de ensaio.csv", "a*x+b");
  expect(button("Executar ajustes").disabled).toBe(false);
  await act(async () => button("Executar ajustes").click());
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("ensaio.csv:2:2");
  expect(node.textContent).toContain("Simulação");
});

it("rejects oversized files and negative uncertainties without losing valid imports", async () => {
  await render();
  await importFiles([
    { name: "bom.csv", size: 10, text: async () => "1;2\n2;3" },
    { name: "grande.csv", size: 1024 * 1024 + 1, text: async () => "" },
    { name: "erro.csv", size: 10, text: async () => "1;2;-1" },
  ]);
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("bom.csv:2:0");
  expect(node.querySelector('[role="alert"]').textContent).toContain("grande.csv");
  expect(node.querySelector('[role="alert"]').textContent).toContain("erro.csv");
  expect(node.querySelector('[role="alert"]').textContent).toContain(
    "incertezas não podem ser negativas",
  );
});

it("reports failure when the desktop example is unavailable", async () => {
  await render();
  await act(async () => button("Carregar exemplo").click());
  expect(node.textContent).toContain("Não foi possível carregar o exemplo");
  expect(native.invoke).not.toHaveBeenCalled();
});

it("loads the fixed C++ example when the desktop bridge succeeds", async () => {
  native.isTauri.mockReturnValue(true);
  native.invoke.mockResolvedValue({ slope: 2, intercept: 1, r_squared: 1, x: [1, 2], y: [3, 5] });
  await render();
  await act(async () => button("Carregar exemplo").click());
  expect(native.invoke).toHaveBeenCalledWith("get_mock_analysis");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("Exemplo 1:2:2");
  expect(node.textContent).toContain("Exemplo demonstrativo: nenhum ajuste foi executado.");
});

it("clears previous simulated output after changing the equation and reports invalid models", async () => {
  await render();
  await importFiles([{ name: "ensaio.csv", size: 10, text: async () => "1;2\n2;4" }]);
  await setInput("Função de ajuste de ensaio.csv", "a*x");
  await act(async () => button("Executar ajustes").click());
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("ensaio.csv:2:2");
  await setInput("Função de ajuste de ensaio.csv", "sin(");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("ensaio.csv:2:0");
  await act(async () => button("Executar ajustes").click());
  expect(
    [...node.querySelectorAll('[role="alert"]')].some((item) =>
      item.textContent.includes("Função inválida"),
    ),
  ).toBe(true);
});

it("keeps separate imported series and collapses only the selected card", async () => {
  await render();
  await importFiles([
    { name: "a.csv", size: 10, text: async () => "1;2\n2;3" },
    { name: "b.csv", size: 10, text: async () => "1;4\n2;5" },
  ]);
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("a.csv:2:0;b.csv:2:0");
  expect(node.querySelector('input[aria-label="Função de ajuste de a.csv"]')).not.toBeNull();
  expect(node.querySelector('input[aria-label="Função de ajuste de b.csv"]')).not.toBeNull();
  await act(async () => node.querySelector('button[aria-label="Recolher a.csv"]').click());
  expect(node.querySelector('input[aria-label="Função de ajuste de a.csv"]')).toBeNull();
  expect(node.querySelector('input[aria-label="Função de ajuste de b.csv"]')).not.toBeNull();
});
