// @vitest-environment jsdom
/** Axis click targets on the chart and the axis settings popover, in sync with the sidebar. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../../src/components/chart/Chart";
import { ChartSettingsPanel } from "../../src/components/chart/ChartSettingsPanel";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

const series = {
  id: "one",
  name: "Medidas",
  points: [
    { x: 0.5, y: 3.5 },
    { x: 3, y: 0.5 },
    { x: 6, y: -3 },
  ],
  linePoints: [
    { x: 0.5, y: 3.5 },
    { x: 6, y: -3 },
  ],
  color: "#123456",
  radius: 4,
  symbol: "circle",
  lineStyle: "solid",
  lineWidth: 2,
  visible: true,
  residuals: [
    { x: 0.5, residual: 0.1 },
    { x: 3, residual: -0.1 },
    { x: 6, residual: 0.05 },
  ],
};
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
    createElement(Chart, { series: [series], label: "Experimento", settings, graphicRef }),
    createElement(ChartSettingsPanel, { settings, section: "chart" }),
  );
}
const render = (props) => act(async () => root.render(createElement(Harness, props)));
const strip = (axis) => node.querySelector(`button[aria-label="Configurar eixo ${axis}"]`);
const popover = () => document.querySelector('[data-slot="popover-content"]');
const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
const type = (input, value) =>
  act(async () => {
    nativeSet.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const click = (element) => act(async () => element.click());
const byText = (selector, text, scope = document) =>
  [...scope.querySelectorAll(selector)].find((element) => element.textContent.includes(text));
const openTab = (name) =>
  act(async () =>
    byText('[role="tab"]', name).dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, button: 0 }),
    ),
  );
const option = (group, text) =>
  byText("button", text, popover().querySelector(`[aria-label="${group}"]`));
const main = () => node.querySelector('svg[aria-label="Experimento"]');
const xLabels = () => [...main().querySelectorAll('[data-testid="x-tick-labels"] text')];
const yLabels = () => [...main().querySelectorAll('[data-testid="y-tick-labels"] text')];

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

it("highlights an axis on hover and leaves the click target out of exports", async () => {
  await render();
  const y = strip("Y");
  expect(y.dataset.html2canvasIgnore).toBe("true");
  expect(yLabels()[0].getAttribute("fill")).toBe("#78857d");
  // jsdom has no PointerEvent; React only needs the event type.
  await act(async () =>
    y.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 5, clientY: 5 })),
  );
  expect(y.textContent).toBe("Eixo Y · clique para ajustar");
  expect(yLabels()[0].getAttribute("fill")).toBe("#20272c");
  await act(async () =>
    y.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })),
  );
  expect(yLabels()[0].getAttribute("fill")).toBe("#78857d");
});

it("edits the limits and scale of an axis and mirrors them in the sidebar", async () => {
  await render();
  await click(strip("X"));
  expect(popover().querySelector("h2").textContent).toBe("Eixo X");
  const min = popover().querySelector("#axis-x-min");
  await type(min, "1");
  expect(latest.xMin).toBe("1");
  const sidebarMin = byText("fieldset", "Intervalo do eixo X", node).querySelector("input");
  expect(sidebarMin.value).toBe("1");
  await type(sidebarMin, "2");
  expect(popover().querySelector("#axis-x-min").value).toBe("2");
  await type(popover().querySelector("#axis-x-max"), "1");
  expect(popover().querySelector('[role="alert"]').textContent).toBe(
    "O mínimo precisa ser menor que o máximo.",
  );
  await click(byText('[role="switch"]', "Escala logarítmica", popover()));
  expect(latest.xLog).toBe(true);
  expect([latest.xMin, latest.xMax]).toEqual(["", ""]);
  expect(
    byText('[role="switch"]', "Escala logarítmica no eixo X", node).getAttribute("aria-checked"),
  ).toBe("true");
  await click(byText('[role="switch"]', "Inverter sentido", popover()));
  await click(byText('[role="switch"]', "Eixo na borda", popover()));
  expect(latest.xAxis).toMatchObject({ invert: true, edge: true });
});

it("sets ticks, subdivisions and grids from the Marcações tab", async () => {
  await render();
  await click(strip("Y"));
  await openTab("Marcações");
  await click(popover().querySelector('button[aria-label="Aumentar divisões"]'));
  expect(latest.yAxis.ticks).toBe(6);
  const secondary = byText('[role="switch"]', "Grade secundária", popover());
  expect(secondary.getAttribute("aria-disabled")).toBe("true");
  await click(popover().querySelector('button[aria-label="Aumentar subdivisões"]'));
  expect(latest.yAxis.minor).toBe(1);
  await click(byText('[role="switch"]', "Grade secundária", popover()));
  expect(latest.yAxis.minorGrid).toBe(true);
  expect(main().querySelectorAll('line[stroke="#eef1ec"]').length).toBeGreaterThan(0);
  const marks = () => main().querySelectorAll('[data-testid="y-tick-marks"] line').length;
  const before = marks();
  await click(popover().querySelector('button[aria-label="Diminuir subdivisões"]'));
  expect(latest.yAxis).toMatchObject({ minor: 0, minorGrid: false });
  expect(marks()).toBeLessThan(before);
  await click(popover().querySelector('button[aria-label="Cruzados"]'));
  expect(latest.yAxis.tickDirection).toBe("cross");
  await click(byText('[role="radio"], button', "Passo fixo", popover()));
  const step = popover().querySelector("#axis-y-step");
  await type(step, "0");
  expect(popover().querySelector('[role="alert"]').textContent).toBe(
    "Use um passo maior que zero.",
  );
  await type(step, "1");
  expect(yLabels().map((label) => label.textContent)).toEqual(
    expect.arrayContaining(["-3", "-2", "-1", "0", "1", "2", "3"]),
  );
  await click(byText('[role="switch"]', "Grade principal", popover()));
  expect(latest.yAxis.grid).toBe(false);
});

it("changes the title and the number text from the Texto tab", async () => {
  await render();
  await click(strip("X"));
  await openTab("Texto");
  await type(popover().querySelector("#axis-x-title"), "t (s)");
  expect(latest.xLabel).toBe("t (s)");
  expect(node.querySelector('button[aria-label="Editar título do eixo X"]').textContent).toBe(
    "t (s)",
  );
  await click(popover().querySelector('button[aria-label="Aumentar fonte do título"]'));
  expect(latest.xAxis.titleSize).toBe(12);
  expect(node.querySelector('button[aria-label="Editar título do eixo X"]').style.fontSize).toBe(
    "12px",
  );
  const format = popover().querySelector("#axis-x-format");
  await act(async () => {
    format.value = "decimal";
    format.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(xLabels().every((label) => /,\d\d$/.test(label.textContent))).toBe(true);
  await click(popover().querySelector('button[aria-label="Diminuir casas decimais"]'));
  expect(latest.xAxis.decimals).toBe(1);
  await click(popover().querySelector('button[aria-label="Aumentar fonte dos números"]'));
  expect(xLabels()[0].getAttribute("font-size")).toBe("11");
  await click(option("Rotação", "45°"));
  expect(popover().querySelector('[aria-label="Rotação do título"]')).toBeNull();
  expect(xLabels()[0].getAttribute("transform")).toMatch(/^rotate\(-45 /);
  await click(byText("button", "Copiar estilo para Y", popover()));
  expect(latest.yAxis).toMatchObject({ format: "decimal", decimals: 1, fontSize: 11 });
  expect(popover().textContent).toContain("Copiado");
  await click(byText("button", "Restaurar padrão", popover()));
  expect(latest.xAxis.fontSize).toBe(10);
  expect(latest.xLabel).toBe("t (s)");
});

it("moves the X click target into the residuals panel when it is on", async () => {
  await render({ initial: { residuals: true } });
  const panel = node.querySelector('svg[aria-label="Resíduos de cada ponto em função de x"]');
  expect(panel.querySelector('[data-testid="x-tick-labels"]')).not.toBeNull();
  expect(main().querySelector('[data-testid="x-tick-labels"]')).toBeNull();
  expect(node.querySelectorAll('button[aria-label="Configurar eixo X"]')).toHaveLength(1);
  await click(strip("X"));
  expect(popover().querySelector("h2").textContent).toBe("Eixo X");
  await click(popover().querySelector('button[aria-label="Fechar"]'));
  expect(popover()).toBeNull();
});

it("shares the axis title size between the wheel on the title and the popover", async () => {
  await render();
  const title = node.querySelector('button[aria-label="Editar título do eixo Y"]');
  await act(async () => {
    title.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, bubbles: true, cancelable: true }));
    title.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, bubbles: true, cancelable: true }));
  });
  expect(latest.yAxis.titleSize).toBe(13);
  await click(strip("Y"));
  await openTab("Texto");
  expect(byText("output", "13 px", popover())).toBeTruthy();
});

it("turns the Y numbers vertical from the Texto tab", async () => {
  await render();
  await click(strip("Y"));
  await openTab("Texto");
  await click(option("Rotação", "90°"));
  expect(latest.yAxis.rotation).toBe(90);
  expect(yLabels()[0].getAttribute("transform")).toMatch(/^rotate\(-90 /);
  expect(yLabels()[0].getAttribute("text-anchor")).toBe("middle");
  const title = () => node.querySelector('button[aria-label="Editar título do eixo Y"]');
  expect(title().style.transform).toBe("");
  await click(option("Rotação do título", "90°"));
  expect(latest.yAxis.titleRotation).toBe(90);
  expect(title().style.transform).toBe("rotate(-90deg)");
});

it("configures the residual axis like the others, in sync with the residual options", async () => {
  await render({ initial: { residuals: true, residualYMin: "-0.5" } });
  const residualLabels = () => [
    ...node.querySelectorAll('[data-testid="residual-tick-labels"] text'),
  ];
  expect(latest.residualAxis.min).toBe("-0.5");
  expect(residualLabels().some((label) => label.textContent.startsWith("−"))).toBe(true);
  await click(strip("dos resíduos"));
  expect(popover().querySelector("#axis-residual-min").value).toBe("-0.5");
  expect(popover().querySelector("h2").textContent).toBe("Eixo dos resíduos");
  expect(byText('[role="switch"]', "Escala logarítmica", popover())).toBeUndefined();
  expect(byText('[role="switch"]', "Eixo na borda", popover())).toBeUndefined();
  await type(popover().querySelector("#axis-residual-max"), "0.5");
  expect(latest.residualYMax).toBe("0.5");
  await click(byText('[role="switch"]', "Inverter sentido", popover()));
  expect(latest.residualAxis.invert).toBe(true);
  await openTab("Texto");
  await click(option("Rotação", "90°"));
  await click(option("Rotação do título", "90°"));
  expect(
    node.querySelector('button[aria-label="Editar título do eixo Y dos resíduos"]').style.transform,
  ).toBe("rotate(-90deg)");
  expect(residualLabels()[0].getAttribute("transform")).toMatch(/^rotate\(-90 /);
  await type(popover().querySelector("#axis-residual-title"), "Desvio");
  expect(latest.residualYLabel).toBe("Desvio");
  await click(byText("button", "Copiar estilo para Y", popover()));
  expect(latest.yAxis.rotation).toBe(0);
  await click(popover().querySelector('button[aria-label="Aumentar fonte dos números"]'));
  await click(byText("button", "Copiar estilo para Y", popover()));
  expect(latest.yAxis.fontSize).toBe(11);
});

it("shares the residual limits with the residual options popover", async () => {
  await render({ initial: { residuals: true } });
  await click(node.querySelector('button[aria-label="Opções do painel de resíduos"]'));
  await type(document.querySelector("#residual-ymax"), "0.4");
  expect(latest.residualAxis.max).toBe("0.4");
  await act(async () => latest.updateAxis("residual", { min: "-0.4" }));
  expect(document.querySelector("#residual-ymin").value).toBe("-0.4");
});
