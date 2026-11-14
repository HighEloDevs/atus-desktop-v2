// @vitest-environment jsdom
/** User-visible defaults and interactions for chart settings. */
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ChartSettingsPanel } from "../../src/components/chart/ChartSettingsPanel";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

let root;
let node;
let values;

function Harness({ initial, section }) {
  values = useChartSettings(initial);
  return createElement(ChartSettingsPanel, { settings: values, section });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render(props = {}) {
  await act(async () => root.render(createElement(Harness, props)));
}

function byText(tag, text) {
  return [...node.querySelectorAll(tag)].find((element) => element.textContent.includes(text));
}

it("shows chart defaults and separates series settings from chart settings", async () => {
  await render({ section: "series" });
  expect(node.textContent).toContain("Pontos");
  expect(node.textContent).toContain("Linha de ajuste");
  expect(node.textContent).not.toContain("Intervalo do eixo X");
  expect(values.radius).toBe(5);
  expect(values.color).toBe("#f25a3c");
  expect(values.lineStyle).toBe("solid");
  await render({ section: "chart" });
  expect(node.textContent).toContain("Intervalo do eixo X");
  expect(node.textContent).not.toContain("Linha de ajuste");
  expect(values.ticks).toBe(5);
  expect(values.grid).toBe(true);
});

it("restores persisted false and zero-like values instead of replacing them with defaults", async () => {
  await render({ initial: { grid: false, legend: false, xLog: true, title: "", xMin: "0" } });
  expect(values.title).toBe("");
  expect(values.xMin).toBe("0");
  expect(values.grid).toBe(false);
  expect(values.legend).toBe(false);
  expect(values.xLog).toBe(true);
  expect(node.textContent).not.toContain("Orientação");
  expect(byText('[role="switch"]', "Linhas de grade").getAttribute("aria-checked")).toBe("false");
});

it("toggles legend, grid and logarithmic axes and updates the visible settings", async () => {
  await render();
  await act(async () => byText('[role="switch"]', "Mostrar legenda").click());
  expect(values.legend).toBe(false);
  expect(node.textContent).not.toContain("Orientação");
  await act(async () => byText('[role="switch"]', "Linhas de grade").click());
  await act(async () => byText('[role="switch"]', "Escala logarítmica no eixo X").click());
  expect(values.grid).toBe(false);
  expect(values.xLog).toBe(true);
});

it("changes marker and line style using the user controls", async () => {
  await render();
  await act(async () => node.querySelector('input[aria-label="Losango"]').click());
  expect(values.symbol).toBe("diamond");
  const select = node.querySelector("select");
  await act(async () => {
    select.value = "dashed";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(values.lineStyle).toBe("dashed");
});

it("clamps marker radius, line width and axis division counts to supported limits", async () => {
  await render();
  const inputs = [...node.querySelectorAll('input[type="number"]')];
  const setInput = async (input, value) => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => {
      nativeSet.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await setInput(inputs[0], "25");
  expect(values.radius).toBe(10);
  await setInput(inputs[1], "0");
  expect(values.lineWidth).toBe(1);
  await setInput(inputs[6], "100");
  expect(values.ticks).toBe(20);
});

it("updates axis bounds and legend orientation from the chart controls", async () => {
  await render({ section: "chart" });
  const bounds = [...node.querySelectorAll('input[placeholder="Auto"]')];
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  for (const [input, value] of bounds.map((input, index) => [
    input,
    ["1", "10", "2", "20"][index],
  ])) {
    await act(async () => {
      nativeSet.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  expect([values.xMin, values.xMax, values.yMin, values.yMax]).toEqual(["1", "10", "2", "20"]);
  const horizontal = [...node.querySelectorAll('input[name="legend-orientation"]')][0];
  await act(async () => horizontal.click());
  expect(values.legendOrientation).toBe("horizontal");
});

it("updates the marker color", async () => {
  await render({ section: "series" });
  const input = node.querySelector('input[type="color"]');
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    nativeSet.call(input, "#364cff");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(values.color).toBe("#364cff");
});

it("keeps the sidebar and the per-axis settings in sync", async () => {
  await render({ section: "chart" });
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const divisions = () => byText("label", "Divisões").querySelector("input");
  await act(async () => {
    nativeSet.call(divisions(), "8");
    divisions().dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect([values.xAxis.ticks, values.yAxis.ticks]).toEqual([8, 8]);
  await act(async () => values.updateAxis("y", { ticks: 3, grid: false, min: "-1", log: true }));
  expect(divisions().value).toBe("");
  expect(divisions().placeholder).toBe("X 8 · Y 3");
  expect(values.yMin).toBe("-1");
  expect(values.yLog).toBe(true);
  expect(
    byText('[role="switch"]', "Escala logarítmica no eixo Y").getAttribute("aria-checked"),
  ).toBe("true");
  // The grid switch shows on while one axis has a grid, and writes both.
  expect(byText('[role="switch"]', "Linhas de grade").getAttribute("aria-checked")).toBe("true");
  await act(async () => byText('[role="switch"]', "Linhas de grade").click());
  expect([values.xAxis.grid, values.yAxis.grid]).toEqual([false, false]);
});

it("saves the axes and reopens them as they were", async () => {
  await render();
  await act(async () => {
    values.updateAxis("x", { min: "2", minor: 4, format: "scientific", rotation: 45 });
    values.updateAxis("y", { invert: true, tickDirection: "cross" });
  });
  const saved = JSON.parse(JSON.stringify(values));
  const before = { x: values.xAxis, y: values.yAxis };
  await act(async () => root.unmount());
  root = createRoot(node);
  await render({ initial: saved });
  expect({ x: values.xAxis, y: values.yAxis }).toEqual(before);
  expect(values.xMin).toBe("2");
});

it("copies the style to the other axis and restores an axis without touching its title", async () => {
  await render();
  await act(async () => {
    values.setXLabel("t (s)");
    values.updateAxis("x", { min: "1", fontSize: 14, format: "decimal", grid: false });
  });
  await act(async () => values.copyAxisStyle("x"));
  await act(async () => values.copyAxisStyle("y", "residual"));
  expect(values.residualAxis).toMatchObject({ min: "", fontSize: 14, format: "decimal" });
  expect(values.yAxis).toMatchObject({ min: "", fontSize: 14, format: "decimal", grid: false });
  await act(async () => values.resetAxis("x"));
  expect(values.xAxis.fontSize).toBe(10);
  expect(values.xMin).toBe("");
  expect(values.xLabel).toBe("t (s)");
});
