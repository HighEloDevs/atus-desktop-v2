// @vitest-environment jsdom
/** Residuals panel inside the chart: availability notice, options and editable title. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../../src/components/chart/Chart";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

const fitted = {
  id: "one",
  name: "Primeira",
  points: [
    { x: 1, y: 2, sy: 0.1 },
    { x: 2, y: 4, sy: 0.1 },
    { x: 3, y: 6.2, sy: 0.1 },
  ],
  linePoints: [
    { x: 1, y: 2 },
    { x: 3, y: 6 },
  ],
  color: "#123456",
  radius: 4,
  symbol: "circle",
  lineStyle: "solid",
  lineWidth: 2,
  visible: true,
  residuals: [
    { x: 1, residual: 0.05, sy: 0.1 },
    { x: 2, residual: -0.1, sy: 0.1 },
    { x: 3, residual: 0.2, sy: 0.1 },
  ],
};
const unfitted = { ...fitted, residuals: undefined };
let root;
let node;
let latest;

function Harness({ initial = {}, series = [fitted], fitShortcut }) {
  const settings = useChartSettings(initial);
  latest = settings;
  const graphicRef = useRef(null);
  return createElement(Chart, { series, label: "Experimento", settings, graphicRef, fitShortcut });
}
const render = (props) => act(async () => root.render(createElement(Harness, props)));
const panel = () => node.querySelector('svg[aria-label="Resíduos de cada ponto em função de x"]');
const count = (testid) => panel().querySelectorAll(`[data-testid="${testid}"]`).length;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 640, height: 240 } }]);
      }
      disconnect() {}
    },
  );
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

it("explains that residuals are unavailable when no series has them", async () => {
  await render({ series: [unfitted], initial: { residuals: true }, fitShortcut: "⌘ ↵" });
  expect(panel()).toBeNull();
  const notice = node.querySelector('[role="status"]');
  expect(notice.textContent).toBe(
    "Resíduos desabilitados porque ainda não há resíduos. Execute o ajuste com ⌘ ↵.",
  );
  expect(notice.closest("[data-html2canvas-ignore]") ?? notice.parentElement).not.toBeNull();
});

it("shows no notice and no panel while the panel is off, even with residuals", async () => {
  await render();
  expect(panel()).toBeNull();
  expect(node.querySelector('[role="status"]')).toBeNull();
});

it("draws one stem and one point per residual by default, without the band or the histogram", async () => {
  await render({ initial: { residuals: true } });
  expect(count("residual-stem")).toBe(3);
  expect(count("residual-band")).toBe(0);
  expect(count("residual-histogram")).toBe(0);
  expect(count("residual-error")).toBe(0);
  expect(panel().querySelectorAll('circle[fill="#123456"]')).toHaveLength(3);
});

it("applies each display option from the settings", async () => {
  await render({
    initial: {
      residuals: true,
      residualStems: false,
      residualBand: true,
      residualHistogram: true,
      residualErrorBars: true,
    },
  });
  expect(count("residual-stem")).toBe(0);
  expect(count("residual-band")).toBe(1);
  expect(count("residual-histogram")).toBe(1);
  expect(count("residual-error")).toBe(3);
});

it("omits the band and uncertainty bars when the residuals carry no uncertainty", async () => {
  const bare = {
    ...fitted,
    residuals: fitted.residuals.map(({ x, residual }) => ({ x, residual })),
  };
  await render({
    series: [bare],
    initial: { residuals: true, residualBand: true, residualErrorBars: true },
  });
  expect(count("residual-band")).toBe(0);
  expect(count("residual-error")).toBe(0);
});

it("keeps the panel aligned with the main plot when the histogram column is reserved", async () => {
  await render({ initial: { residuals: true, residualHistogram: true } });
  const translate = (svg) => svg.querySelector("g").getAttribute("transform");
  const main = node.querySelector('svg[aria-label="Experimento"]');
  expect(translate(panel())).toMatch(/^translate\(65,/);
  expect(translate(main)).toMatch(/^translate\(65,/);
});

it("hides the main plot tick labels while the panel carries them", async () => {
  await render();
  const mainTicks = node.querySelector('svg[aria-label="Experimento"]').querySelectorAll("text");
  await act(async () => latest.setResiduals(true));
  const withPanel = node.querySelector('svg[aria-label="Experimento"]').querySelectorAll("text");
  expect(withPanel.length).toBeLessThan(mainTicks.length);
});

it("edits the residuals Y title like the other labels", async () => {
  await render({ initial: { residuals: true } });
  const button = node.querySelector('button[aria-label="Editar título do eixo Y dos resíduos"]');
  expect(button.textContent).toBe("Resíduo");
  await act(async () => button.click());
  const input = node.querySelector('input[aria-label="Editar título do eixo Y dos resíduos"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, "Resíduo (V)");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.blur());
  expect(latest.residualYLabel).toBe("Resíduo (V)");
  expect(
    node.querySelector('button[aria-label="Editar título do eixo Y dos resíduos"]').textContent,
  ).toBe("Resíduo (V)");
});

it("sets the Y limits and switches elements from the options popover", async () => {
  await render({ initial: { residuals: true } });
  await act(async () =>
    node.querySelector('button[aria-label="Opções do painel de resíduos"]').click(),
  );
  const typed = async (id, value) => {
    const input = document.getElementById(id);
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => {
      set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await typed("residual-ymin", "-2");
  await typed("residual-ymax", "3");
  expect(latest.residualYMin).toBe("-2");
  expect(latest.residualYMax).toBe("3");
  expect(document.body.textContent).toContain("manual");
  const toggle = (label) =>
    [...document.querySelectorAll('[role="switch"]')].find((s) => s.textContent.includes(label));
  await act(async () => toggle("Hastes até o zero").click());
  expect(count("residual-stem")).toBe(0);
  expect(count("residual-histogram")).toBe(0);
  await act(async () => toggle("Histograma lateral").click());
  expect(count("residual-histogram")).toBe(1);
  await act(async () => toggle("Faixa ±σ").click());
  expect(count("residual-band")).toBe(1);
  await act(async () => toggle("Barras de incerteza").click());
  expect(count("residual-error")).toBe(3);
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Restaurar padrão")
      .click(),
  );
  expect(latest.residualYMin).toBe("");
  expect(latest.residualStems).toBe(true);
  expect(latest.residualErrorBars).toBe(false);
  expect(latest.residualHistogram).toBe(false);
  expect(latest.residualBand).toBe(false);
  expect(count("residual-stem")).toBe(3);
  expect(count("residual-histogram")).toBe(0);
});

it("disables the uncertainty options and says why when there is no Y uncertainty", async () => {
  const bare = {
    ...fitted,
    residuals: fitted.residuals.map(({ x, residual }) => ({ x, residual })),
  };
  await render({ series: [bare], initial: { residuals: true, residualBand: true } });
  await act(async () =>
    node.querySelector('button[aria-label="Opções do painel de resíduos"]').click(),
  );
  const band = [...document.querySelectorAll('[role="switch"]')].find((s) =>
    s.textContent.includes("Faixa ±σ"),
  );
  expect(band.getAttribute("aria-disabled")).toBe("true");
  expect(band.textContent).toContain("Requer incertezas em Y nos dados.");
  await act(async () => band.click());
  expect(latest.residualBand).toBe(true);
});

it("does not include the options button in the exported image", async () => {
  await render({ initial: { residuals: true } });
  const trigger = node.querySelector('button[aria-label="Opções do painel de resíduos"]');
  expect(trigger.closest("[data-html2canvas-ignore]")).not.toBeNull();
});

it("has no divider bar between the main chart and the residuals panel", async () => {
  await render({ initial: { residuals: true } });
  const container = panel().closest(".flex-\\[32_1_0\\%\\]");
  expect(container).not.toBeNull();
  expect(container.className).not.toMatch(/\bborder/);
});

it("labels the band and the histogram, and animates stems and points", async () => {
  await render({ initial: { residuals: true, residualBand: true, residualHistogram: true } });
  const text = [...panel().querySelectorAll("text")].map((node) => node.textContent);
  expect(text).toContain("±σ");
  expect(text).toContain("distr.");
  const stem = panel().querySelector('[data-testid="residual-stem"]');
  expect(stem.getAttribute("class")).toBe("residual-stem");
  expect(stem.getAttribute("stroke-linecap")).toBe("round");
  expect(stem.style.getPropertyValue("--length")).not.toBe("");
  expect(panel().querySelectorAll(".residual-point")).toHaveLength(3);
});

it("clears manual Y limits and closes the options menu from its own buttons", async () => {
  await render({ initial: { residuals: true, residualYMin: "-1", residualYMax: "1" } });
  await act(async () =>
    node.querySelector('button[aria-label="Opções do painel de resíduos"]').click(),
  );
  expect(document.body.textContent).toContain("manual");
  await act(async () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Limpar").click(),
  );
  expect(latest.residualYMin).toBe("");
  expect(latest.residualYMax).toBe("");
  expect(document.body.textContent).toContain("automática");
  await act(async () => document.querySelector('button[aria-label="Fechar"]').click());
  expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
});

it("draws the panel grid exactly like the main chart grid", async () => {
  await render({ initial: { residuals: true } });
  const grid = (svg) => [
    ...new Set(
      [...svg.querySelectorAll('line[stroke="#e8ece7"]')].map(
        (line) => `${line.getAttribute("stroke-width")}|${line.getAttribute("stroke-dasharray")}`,
      ),
    ),
  ];
  const main = node.querySelector('svg[aria-label="Experimento"]');
  expect(grid(panel()).length).toBeGreaterThan(0);
  expect(grid(panel())).toEqual(grid(main));
});

it("paints the option switches with the general-control colors, not cobalt or coral", async () => {
  await render({ initial: { residuals: true } });
  await act(async () =>
    node.querySelector('button[aria-label="Opções do painel de resíduos"]').click(),
  );
  const rows = [...document.querySelectorAll('[role="switch"]')];
  const on = rows.find((row) => row.getAttribute("aria-checked") === "true");
  const off = rows.find((row) => row.getAttribute("aria-checked") === "false");
  const track = (row) => row.querySelector("span[aria-hidden]:last-child");
  expect(track(on).className).toContain("bg-foreground");
  expect(track(off).className).toContain("bg-muted");
  for (const row of rows) expect(row.innerHTML).not.toMatch(/364cff|brand-coral|f25a3c/i);
});

it("paints each band with its series color at low alpha, one band per series", async () => {
  const second = {
    ...fitted,
    id: "two",
    name: "Segunda",
    color: "#abcdef",
    residuals: [
      { x: 1, residual: 0.3, sy: 0.4 },
      { x: 2, residual: -0.2, sy: 0.4 },
    ],
  };
  await render({ series: [fitted, second], initial: { residuals: true, residualBand: true } });
  const bands = [...panel().querySelectorAll('[data-testid="residual-band"]')];
  expect(bands.map((band) => band.getAttribute("fill"))).toEqual(["#123456", "#abcdef"]);
  for (const band of bands) expect(Number(band.getAttribute("opacity"))).toBeLessThan(0.2);
  const [narrow, wide] = bands.map((band) => Number(band.getAttribute("height")));
  expect(wide).toBeGreaterThan(narrow);
  expect([...panel().querySelectorAll("text")].map((node) => node.textContent)).not.toContain("±σ");
});

it("uses the series color for the single band and keeps its ±σ label", async () => {
  await render({ initial: { residuals: true, residualBand: true } });
  const band = panel().querySelector('[data-testid="residual-band"]');
  expect(band.getAttribute("fill")).toBe("#123456");
  expect([...panel().querySelectorAll("text")].map((node) => node.textContent)).toContain("±σ");
});
