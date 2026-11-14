// @vitest-environment jsdom
/** Legend popover on the chart, in sync with the sidebar legend fields. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../../src/components/chart/Chart";
import { ChartSettingsPanel } from "../../src/components/chart/ChartSettingsPanel";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

const base = {
  points: [
    { x: 1, y: 2 },
    { x: 2, y: 3 },
  ],
  linePoints: [
    { x: 1, y: 2 },
    { x: 2, y: 3 },
  ],
  radius: 4,
  lineWidth: 2,
  visible: true,
};
const series = [
  {
    ...base,
    id: "a",
    name: "Carrinho A",
    color: "#123456",
    symbol: "square",
    lineStyle: "dashed",
    legendEquation: "f(x) = {1{,}0} \\cdot x",
  },
  { ...base, id: "b", name: "Carrinho B", color: "#654321", symbol: "circle", lineStyle: "solid" },
];
let root;
let node;
let latest;

function Harness({ initial = {} }) {
  const settings = useChartSettings(initial);
  latest = settings;
  const graphicRef = useRef(null);
  return createElement(
    Fragment,
    null,
    createElement(Chart, { series, label: "Experimento", settings, graphicRef }),
    createElement(ChartSettingsPanel, { settings, section: "chart" }),
  );
}
const render = (props) => act(async () => root.render(createElement(Harness, props)));
const legend = () => node.querySelector('button[aria-label="Legenda"]');
const popover = () => document.querySelector('[data-slot="popover-content"]');
const click = (element) => act(async () => element.click());
const byText = (selector, text, scope = document) =>
  [...scope.querySelectorAll(selector)].find((element) => element.textContent.includes(text));
const openTab = (name) =>
  act(async () =>
    byText('[role="tab"]', name).dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, button: 0 }),
    ),
  );
const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 640, height: 360 } }]);
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

it("keeps the previous legend look by default and shows a hint on hover", async () => {
  await render();
  expect(legend().textContent).toBe("Carrinho ACarrinho B");
  expect(legend().className).toContain("bg-white/90");
  expect(legend().style.fontSize).toBe("11px");
  expect(legend().querySelector("rect")).not.toBeNull();
  expect(legend().querySelector("line")).toBeNull();
  await act(async () =>
    legend().dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 5, clientY: 5 }),
    ),
  );
  expect(legend().textContent).toContain("Legenda · clique para ajustar, arraste para mover");
});

it("adds the fitted line, the equation and a title from the Conteúdo tab", async () => {
  await render();
  await click(legend());
  expect(popover().querySelector("h2").textContent).toBe("Legenda");
  await click(byText('[role="switch"]', "Linha de ajuste", popover()));
  expect(legend().querySelector('line[stroke-dasharray="8 5"]')).not.toBeNull();
  await click(byText('[role="switch"]', "Equação do ajuste", popover()));
  expect(legend().querySelectorAll(".katex")).toHaveLength(1);
  const title = popover().querySelector("#legend-title");
  await act(async () => {
    nativeSet.call(title, "Medidas");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(legend().firstElementChild.textContent).toBe("Medidas");
  expect(latest.legendStyle).toMatchObject({ fitLine: true, equation: true, title: "Medidas" });
});

it("places, lays out and styles the legend, in sync with the sidebar", async () => {
  await render();
  await click(legend());
  await openTab("Posição");
  expect(popover().querySelector('[aria-label="Meio direito"]').getAttribute("aria-pressed")).toBe(
    "true",
  );
  await click(popover().querySelector('[aria-label="Superior esquerdo"]'));
  expect(latest.legendPosition).toEqual({ x: 0, y: 0 });
  expect(legend().style.left).toBe("0%");
  await click(byText("button", "Horizontal", popover()));
  expect(latest.legendOrientation).toBe("horizontal");
  expect(node.querySelector('input[name="legend-orientation"]').checked).toBe(true);
  await click(popover().querySelector('button[aria-label="Aumentar colunas"]'));
  expect(legend().style.gridTemplateColumns).toBe("repeat(1, auto)");
  await openTab("Aparência");
  const background = popover().querySelector("#legend-background");
  await act(async () => {
    background.value = "solid";
    background.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(legend().className).toContain("shadow-sm");
  await click(byText('[role="switch"]', "Borda", popover()));
  expect(legend().className).toContain("border-border");
  await click(popover().querySelector('button[aria-label="Aumentar fonte da legenda"]'));
  await click(popover().querySelector('button[aria-label="Aumentar marcadores"]'));
  expect(legend().style.fontSize).toBe("12px");
  expect(legend().querySelector("svg").getAttribute("width")).toBe("10");
  await click(byText("button", "Restaurar padrão", popover()));
  expect(latest.legendPosition).toEqual({ x: 1, y: 0.5 });
  expect(latest.legendOrientation).toBe("vertical");
  expect(latest.legendStyle.background).toBe("light");
});

it("hides the legend from the popover and brings it back from the chart", async () => {
  await render();
  await click(legend());
  await click(byText("button", "Ocultar legenda", popover()));
  expect(latest.legend).toBe(false);
  expect(legend()).toBeNull();
  expect(byText('[role="switch"]', "Mostrar legenda", node).getAttribute("aria-checked")).toBe(
    "false",
  );
  const restore = byText("button", "Mostrar legenda", node);
  expect(restore.dataset.html2canvasIgnore).toBe("true");
  await click(restore);
  expect(latest.legend).toBe(true);
  expect(legend()).not.toBeNull();
});

it("restores a saved legend style and fills in what older projects lack", async () => {
  await render({ initial: { legendStyle: { equation: true } } });
  expect(latest.legendStyle).toMatchObject({ equation: true, background: "light", fontSize: 11 });
  expect(legend().querySelectorAll(".katex")).toHaveLength(1);
});
