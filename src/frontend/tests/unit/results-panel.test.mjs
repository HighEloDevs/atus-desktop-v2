// @vitest-environment jsdom
/** Fit result cards, failed fits and the detailed report. */
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
import { ResultsPanel } from "../../src/features/analysis/fit/ResultsPanel";

let root;
let node;
let highlight;
const base = {
  version: 1,
  kind: "mock",
  curve: [],
  equation: "a*x + b",
  parameters: [
    { name: "a", value: 1.25, uncertainty: 0.1 },
    { name: "b", value: 0.5, uncertainty: 0.02 },
  ],
  chiSquared: 2.5,
  degreesOfFreedom: 3,
  hasUncertainty: true,
  uncertaintyUsed: null,
  covariance: [
    [0.01, -0.0005],
    [-0.0005, 0.0004],
  ],
  residuals: [
    { x: 0, residual: 0.1 },
    { x: 1, residual: -0.2 },
    { x: 2, residual: 0.05 },
  ],
};
const item = { id: "a", name: "Ensaio", color: "#123456", result: base };
const noUncertainty = {
  ...item,
  result: { ...base, hasUncertainty: false, uncertaintyUsed: 0.912871, chiSquared: 2.5 },
};
const many = {
  ...item,
  result: {
    ...base,
    parameters: ["a", "b", "c", "d", "e", "f"].map((name, i) => ({
      name,
      value: i + 1,
      uncertainty: 0.1,
    })),
    covariance: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 0.01 : 0)),
    ),
  },
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  highlight = vi.fn();
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
async function render(results) {
  await act(async () =>
    root.render(createElement(ResultsPanel, { results, onHighlight: highlight })),
  );
}
function button(text, scope = node) {
  return [...scope.querySelectorAll("button")].find((b) => b.textContent.includes(text));
}
const dialog = () => document.querySelector('[role="dialog"]');
async function openDetails(results = [item]) {
  await render(results);
  await act(async () => button("Ver detalhes").click());
  return dialog();
}
function choose(select, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

it("shows an empty state and clears highlighted series when collapsed", async () => {
  await render([]);
  expect(node.textContent).toContain("Nenhum ajuste calculado");
  await act(async () => button("Resultados da análise").click());
  expect(highlight).toHaveBeenCalledWith(null);
  expect(button("Resultados da análise").getAttribute("aria-expanded")).toBe("false");
});

it("keeps the card minimal: rounded parameters, one action and no copy button", async () => {
  await render([item]);
  expect(node.textContent).toContain("1,25 ± 0,10");
  expect(node.textContent).toContain("0,500 ± 0,020");
  expect(node.textContent).not.toMatch(/Chi²|NGL|χ²|simulad|fictício/);
  expect(button("Copiar")).toBeUndefined();
  expect(button("Ver detalhes").getAttribute("aria-label")).toBe("Ver detalhes de Ensaio");
  const card = node.querySelector("article");
  await act(async () => card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(highlight).toHaveBeenCalledWith("a");
  await act(async () => card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(highlight).toHaveBeenLastCalledWith(null);
  await act(async () => button("Resultados da análise").click());
  expect(node.textContent).toContain("1 ajuste(s)");
});

it("lists at most four parameters on the card and counts the rest", async () => {
  await render([many]);
  expect(node.textContent).toContain("+ 2 parâmetros");
  await render([
    { ...many, result: { ...many.result, parameters: many.result.parameters.slice(0, 5) } },
  ]);
  expect(node.textContent).toContain("+ 1 parâmetro");
  expect(node.textContent).not.toContain("+ 1 parâmetros");
});

it("shows a red card with the reason and no action when the fit fails", async () => {
  await render([{ id: "x", name: "Falho", color: "#c00", error: "O ajuste não convergiu." }]);
  expect(node.querySelector('[role="alert"]').textContent).toContain("Falha no ajuste");
  expect(node.textContent).toContain("O ajuste não convergiu.");
  expect(button("Ver detalhes")).toBeUndefined();
});

it("labels the report with Chi² and NGL when the points have uncertainties", async () => {
  const dlg = await openDetails();
  expect(dlg.textContent).toContain("Chi²");
  expect(dlg.textContent).toContain("NGL");
  expect(dlg.textContent).not.toContain("Somatória");
  expect(dlg.textContent).not.toContain("Incerteza considerada");
  expect(dlg.textContent).toContain("2,5");
  expect(dlg.querySelector('svg[role="img"]')).not.toBeNull();
  expect(dlg.querySelector('table[aria-label="Matriz de correlação"]')).not.toBeNull();
  expect(dlg.querySelector('table[aria-label="Matriz de covariância"]')).not.toBeNull();
});

it("uses the V1 labels and note when the points have no uncertainty", async () => {
  const dlg = await openDetails([noUncertainty]);
  expect(dlg.textContent).toContain("Somatória dos resíduos absolutos ao quadrado");
  expect(dlg.textContent).toContain("Incerteza considerada");
  expect(dlg.textContent).toContain("0,912871");
  expect(dlg.textContent).toContain("Os pontos não têm incerteza");
  expect(dlg.textContent).not.toMatch(/Chi²/);
});

it("colours the correlation cells by sign and leaves the covariance plain", async () => {
  const dlg = await openDetails();
  const corr = [...dlg.querySelectorAll('table[aria-label="Matriz de correlação"] td')];
  expect(corr[0].textContent).toBe("1,000");
  expect(corr[0].style.backgroundColor).toContain("54, 76, 255");
  expect(corr[1].textContent).toBe("-0,250");
  expect(corr[1].style.backgroundColor).toContain("242, 90, 60");
  const cov = dlg.querySelector('table[aria-label="Matriz de covariância"] td');
  expect(cov.style.backgroundColor).toBe("");
});

it("copies parameters with the chosen separator, decimal mark and header", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const dlg = await openDetails();
  await act(async () => button("Copiar parâmetros", dlg).click());
  expect(writeText).toHaveBeenLastCalledWith("\tValor\tIncerteza\na\t1.25\t0.1\nb\t0.5\t0.02");
  expect(notify.success).toHaveBeenLastCalledWith("Parâmetros de Ensaio copiados.");
  await act(async () => choose(dlg.querySelector("#copy-separator"), ";"));
  await act(async () => choose(dlg.querySelector("#copy-decimal"), "Vírgula"));
  await act(async () => dlg.querySelector('input[type="checkbox"]').click());
  await act(async () => button("Copiar parâmetros", dlg).click());
  expect(writeText).toHaveBeenLastCalledWith("a;1,25;0,1\nb;0,5;0,02");
  writeText.mockRejectedValueOnce(new Error("denied"));
  await act(async () => button("Copiar parâmetros", dlg).click());
  expect(notify.error).toHaveBeenLastCalledWith("Não foi possível copiar.");
});

it("copies each matrix as LaTeX", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const dlg = await openDetails();
  const [corr, cov] = [...dlg.querySelectorAll("button")].filter((b) =>
    b.textContent.includes("Copiar LaTeX"),
  );
  await act(async () => corr.click());
  expect(writeText.mock.calls[0][0]).toContain("1 & -0{,}25");
  await act(async () => cov.click());
  expect(writeText.mock.calls[1][0]).toContain("\\begin{pmatrix}");
  expect(notify.success).toHaveBeenLastCalledWith("LaTeX copiado.");
});

it("lists every parameter in the report even when the card collapses them", async () => {
  const dlg = await openDetails([many]);
  expect(dlg.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(6);
  expect(dlg.querySelectorAll('table[aria-label="Matriz de correlação"] tbody tr')).toHaveLength(6);
});

it("closes the report", async () => {
  const dlg = await openDetails();
  await act(async () => button("Fechar", dlg).click());
  expect(dialog()).toBeNull();
});
