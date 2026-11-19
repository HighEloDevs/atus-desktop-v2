// @vitest-environment jsdom
/** Several fits over one dataset (decision 0016): sidebar, chart series, results and saving. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
const chart = vi.hoisted(() => ({ props: null }));
const saved = vi.hoisted(() => ({ content: null }));
vi.mock("@/lib/notify", () => ({ notify }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: (_project, content) => {
    saved.content = content;
    return {
      project: null,
      status: "Salvo",
      error: "",
      canLeave: async () => true,
      flush: async () => true,
      saveAs: async () => {},
    };
  },
}));
vi.mock("../../src/components/chart/Chart", () => ({
  Chart: (props) => {
    chart.props = props;
    return createElement("div", { "data-testid": "chart" });
  },
}));
vi.mock("../../src/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => createElement(Fragment, null, children),
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => createElement("div", null, children),
  DropdownMenuItem: ({ children, onSelect }) =>
    createElement("button", { onClick: onSelect }, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuLabel: ({ children }) => createElement("span", null, children),
}));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";

let root;
let node;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  document.body.innerHTML = "";
});

/** A project saved before multiple fits: the dataset state holds one fit. */
const legacyProject = () => ({
  path: "/p.atus",
  snapshot: {
    id: "p",
    name: "P",
    created_at: "2024",
    updated_at: "2024",
    analyses: [
      {
        id: "analysis",
        kind: "analysis",
        state: { selectedId: "d" },
        datasets: [
          {
            id: "d",
            name: "Queda",
            state: { color: "#364cff", equation: "a*x+b", parameters: "a=1; b=0" },
            points: [
              { x: 0, y: 1, sy: 0.1 },
              { x: 1, y: 3, sy: 0.1 },
              { x: 2, y: 5, sy: 0.1 },
              { x: 3, y: 8, sy: 0.1 },
            ],
          },
        ],
      },
    ],
  },
});

async function render(project = legacyProject()) {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack: vi.fn(),
        project,
        finderPath: null,
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
      }),
    ),
  );
}
const buttons = (root = node) => [...root.querySelectorAll("button")];
const button = (text, root = node) => buttons(root).find((b) => b.textContent.includes(text));
const series = () => chart.props.series;
async function click(element) {
  await act(async () => element.click());
}
async function type(input, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const savedDataset = () => JSON.parse(saved.content)[0].datasets[0].state;

it("opens an old project with its fit as A and keeps today's single-fit layout", async () => {
  await render();
  expect(series().map((s) => [s.id, s.name, s.points.length, s.lineOnly])).toEqual([
    ["d", "Queda", 4, false],
  ]);
  expect(node.querySelector('input[aria-label="Função de ajuste de Queda"]').value).toBe("a*x+b");
  expect(node.querySelector('[aria-label="Ajustes de Queda"]')).toBeNull();
  expect(chart.props.rangeEditor).toBeNull();
  expect(savedDataset()).toMatchObject({ equation: "a*x+b", fitCounter: 1 });
  expect(savedDataset().fits).toHaveLength(1);
});

it("duplicates the fit, draws the points once and compares the fits", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  expect(notify.success).toHaveBeenCalledWith(
    "Ajuste B criado a partir de A",
    expect.objectContaining({ id: "fit-added" }),
  );
  expect(node.querySelector('[aria-label="Ajustes de Queda"]')).not.toBeNull();
  expect(node.textContent).toContain("4 linhas · 2 ajustes");
  // The copy keeps the function and opens its controls.
  expect(node.querySelector('input[aria-label="Função de ajuste de Queda, ajuste B"]').value).toBe(
    "a*x+b",
  );
  expect(series().map((s) => [s.name, s.points.length, s.lineOnly, s.lineStyle])).toEqual([
    ["Queda · A", 4, false, "solid"],
    ["Queda · B", 0, true, "dashed"],
  ]);
  expect(series()[1].color).not.toBe(series()[0].color);
  // The band edits the range of the active fit, B.
  expect(chart.props.rangeEditor).toMatchObject({ pointsSeriesId: "d", label: "B" });

  await click(button("Executar ajustes"));
  expect(series().every((s) => s.linePoints.length > 0)).toBe(true);
  // Only the active fit draws residuals, so two fits of the same points never overlap there.
  expect(series().map((s) => Boolean(s.residuals))).toEqual([false, true]);
  const panel = node.querySelector('[aria-label="Resultados da análise"]');
  expect(panel.textContent).toContain("Queda · A");
  expect(panel.textContent).toContain("Queda · B");
  await click(button("Comparar", panel));
  const table = panel.querySelector('table[aria-label="Comparação dos ajustes de Queda"]');
  expect(table).not.toBeNull();
  expect(table.textContent).toContain("mesma função em A, B");
  expect(table.textContent).toContain("Chi²");
  expect(table.querySelectorAll('svg[aria-label^="Resíduos do ajuste"]')).toHaveLength(2);
  expect(table.textContent).not.toMatch(/melhor|R²|reduzido/i);
});

it("moves the range from the chart band and refits only that fit, quietly", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  await click(button("Executar ajustes"));
  notify.success.mockClear();
  await act(async () => chart.props.rangeEditor.onChange({ min: 1, max: undefined }));
  expect(node.querySelector('input[aria-label="Mínimo de X para Queda, ajuste B"]').value).toBe(
    "1",
  );
  expect(series()[1].residuals.map((r) => r.x)).toEqual([1, 2, 3]);
  expect(series()[0].linePoints.length).toBeGreaterThan(0);
  expect(notify.success).not.toHaveBeenCalled();
  const fits = savedDataset().fits;
  expect(fits.map((fit) => [fit.letter, fit.minX])).toEqual([
    ["A", ""],
    ["B", "1"],
  ]);
});

it("labels, hides, removes and keeps letters stable", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  await click(button("Ajuste em branco"));
  expect(node.textContent).toContain("3 ajustes");
  // A fit without a curve is not listed in the legend yet.
  expect(series()[2]).toMatchObject({ name: "Queda · C", visible: false });
  const list = node.querySelector('[aria-label="Ajustes de Queda"]');
  expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    expect.stringContaining("A"),
    expect.stringContaining("B"),
    expect.stringContaining("C"),
  ]);
  // C is active: remove it, then B; the next fit is D, never C again.
  await click(button("Remover ajuste"));
  await click(node.querySelector('button[aria-label="Ajuste B"]'));
  await type(node.querySelector('input[placeholder="Ajuste B"]'), "Início");
  expect(series()[1].name).toBe("Queda · Início");
  await click(node.querySelector('button[aria-label="Ocultar curva do ajuste B"]'));
  expect(series()[1].visible).toBe(false);
  await click(node.querySelector('button[aria-label="Ajuste A"]'));
  await click(button("Duplicar ajuste A"));
  expect(savedDataset().fits.map((fit) => [fit.letter, fit.label, fit.visible])).toEqual([
    ["A", "", true],
    ["B", "Início", false],
    ["D", "", true],
  ]);
  expect(savedDataset().fitCounter).toBe(4);
});

it("keeps the points in the dataset colour after fit A is removed", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  await click(button("Executar ajustes"));
  const bLine = series()[1].lineColor;
  await click(node.querySelector('button[aria-label="Ajuste A"]'));
  await click(button("Remover ajuste"));
  expect(series()).toHaveLength(1);
  expect(series()[0]).toMatchObject({
    name: "Queda",
    color: "#364cff",
    lineColor: bLine,
    lineStyle: "dashed",
    points: expect.any(Array),
  });
  expect(series()[0].points).toHaveLength(4);
});

it("asks before removing a dataset with several fits and lists them", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  await click(buttons().find((b) => b.textContent.trim() === "Remover"));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Remover “Queda”?");
  expect(dialog.textContent).toContain("Os pontos e os 2 ajustes abaixo saem do projeto.");
  await click(button("Cancelar", dialog));
  expect(series()).toHaveLength(2);
  await click(buttons().find((b) => b.textContent.trim() === "Remover"));
  await click(button("Remover conjunto e ajustes", document.querySelector('[role="dialog"]')));
  expect(node.querySelector('[data-testid="chart"]')).toBeNull();
});

it("replacing the data keeps every fit and clears every result", async () => {
  await render();
  await click(button("Novo ajuste com estes dados"));
  await click(button("Executar ajustes"));
  const input = node.querySelector("#replace-d");
  Object.defineProperty(input, "files", {
    value: [{ name: "novo.csv", size: 10, text: async () => "0;1\n1;2\n2;3" }],
    configurable: true,
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(series().map((s) => [s.name, s.points.length, s.linePoints.length])).toEqual([
    ["Queda · A", 3, 0],
    ["Queda · B", 0, 0],
  ]);
  expect(savedDataset().fits.every((fit) => fit.fitState === "idle")).toBe(true);
});
