// @vitest-environment jsdom
/** Analysis workspace imports, demonstration, and simulated-fit integration. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const native = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
vi.mock("@tauri-apps/api/core", () => native);
const save = vi.hoisted(() => ({ error: "" }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: null,
    status: "Salvo",
    error: save.error,
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
  save.error = "";
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

async function render(project = null) {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack,
        project,
        finderPath: null,
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
  expect(notify.error).toHaveBeenCalledTimes(1);
  const [title, { description }] = notify.error.mock.calls[0];
  expect(title).toBe("Não foi possível importar");
  expect(description).toContain("grande.csv");
  expect(description).toContain("erro.csv");
  expect(description).toContain("incertezas não podem ser negativas");
  expect(node.querySelector('[role="alert"]')).toBeNull();
});

it("reports failure when the desktop example is unavailable", async () => {
  await render();
  await act(async () => button("Carregar exemplo").click());
  expect(notify.error).toHaveBeenCalledWith("Não foi possível carregar o exemplo", {
    description: "Abra o aplicativo desktop e tente novamente.",
    id: "example-error",
  });
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
  const failed = node.querySelector('section[aria-label="Resultados da análise"] article');
  expect(failed.textContent).toContain("Falha no ajuste");
  expect(failed.textContent).toContain("Função inválida");
  expect(failed.textContent).not.toContain("Ver detalhes");
  expect(notify.error).toHaveBeenCalledWith("Falha no ajuste de ensaio.csv", {
    description: expect.stringContaining("Função inválida"),
    id: expect.stringMatching(/^fit-error-/),
  });
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

it("shows a saved dataset in a read-only table, even when the snapshot has legacy edit state", async () => {
  const project = {
    path: "/saved.atus",
    snapshot: {
      id: "p",
      name: "Salvo",
      created_at: "2024",
      updated_at: "2024",
      analyses: [
        {
          id: "analysis",
          kind: "analysis",
          // `editingText` was saved by versions that allowed editing; it must be ignored.
          state: { tableId: "d", selectedId: "d", editingText: "1; 2; 0; 0" },
          datasets: [
            {
              id: "d",
              name: "Salvos",
              state: {},
              points: [
                { x: 1, y: 2, sy: 0.2, sx: 0.1 },
                { x: 0.30000000000000004, y: 6.62607015e-34 },
              ],
            },
          ],
        },
      ],
    },
  };
  await render(project);
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Dados · Salvos");
  expect(dialog.textContent).toContain("2 pontos");
  expect(dialog.textContent).toContain("Somente leitura");
  expect(dialog.textContent).toContain("0,2");
  expect(dialog.textContent).toContain("0,30000000000000004");
  expect(dialog.textContent).toContain("6,62607015e−34");
  expect(dialog.querySelectorAll("tbody tr")).toHaveLength(2);
  const lastRow = [...dialog.querySelectorAll("tbody tr:nth-child(2) td")].map(
    (c) => c.textContent,
  );
  expect(lastRow.slice(-2)).toEqual(["—", "—"]);
  expect(dialog.querySelector("textarea")).toBeNull();
  expect(dialog.querySelector("input")).toBeNull();
  const labels = [...dialog.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels).not.toContain("Editar dados");
  expect(labels).not.toContain("Salvar dados");
  await act(async () =>
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Fechar").click(),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("Salvos:2:0");
});

it("switches to visualization controls and preserves imported datasets", async () => {
  await render();
  await importFiles([{ name: "a.csv", size: 10, text: async () => "1;2\n2;3" }]);
  await act(async () => button("Personalização").click());
  expect(node.textContent).toContain("Intervalo do eixo X");
  expect(node.textContent).toContain("Linha de ajuste");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("a.csv:2:0");
  await act(async () => button("Análise").click());
  expect(node.querySelector('input[aria-label="Função de ajuste de a.csv"]')).not.toBeNull();
});

it("replaces imported data and reports invalid replacement files", async () => {
  await render();
  await importFiles([{ name: "a.csv", size: 10, text: async () => "1;2\n2;3" }]);
  const fileInput = node.querySelector('input[type="file"]:not([multiple])');
  Object.defineProperty(fileInput, "files", {
    value: [{ name: "new.csv", size: 10, text: async () => "3;4\n5;6\n7;8" }],
    configurable: true,
  });
  await act(async () => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("a.csv:3:0");
  Object.defineProperty(fileInput, "files", {
    value: [{ name: "bad.csv", size: 10, text: async () => "1;2;-1" }],
    configurable: true,
  });
  await act(async () => fileInput.dispatchEvent(new Event("change", { bubbles: true })));
  expect(notify.error.mock.lastCall[0]).toContain("incertezas não podem ser negativas");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("a.csv:3:0");
});

it("reports a native bridge failure without adding a demonstration series", async () => {
  native.isTauri.mockReturnValue(true);
  native.invoke.mockRejectedValue(new Error("bridge unavailable"));
  await render();
  await act(async () => button("Carregar exemplo").click());
  expect(notify.error).toHaveBeenCalledWith("Não foi possível carregar o exemplo", {
    description: "Abra o aplicativo desktop e tente novamente.",
    id: "example-error",
  });
  expect(node.querySelector('[data-testid="chart"]')).toBeNull();
});

it("keeps the previous series when a replacement is oversized", async () => {
  await render();
  await importFiles([{ name: "a.csv", size: 10, text: async () => "1;2\n2;3" }]);
  const input = node.querySelector('input[type="file"]:not([multiple])');
  Object.defineProperty(input, "files", {
    value: [{ name: "large.csv", size: 1024 * 1024 + 1 }],
    configurable: true,
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(notify.error.mock.lastCall[0]).toContain("excede 1 MB");
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("a.csv:2:0");
});

it("reports a failed save as a snackbar once per distinct error", async () => {
  save.error = "disk full";
  await render();
  expect(notify.error).toHaveBeenCalledWith("Não foi possível salvar o projeto", {
    description: "disk full",
    id: "save-error",
  });
  expect(node.querySelector('[role="alert"]')).toBeNull();
});
