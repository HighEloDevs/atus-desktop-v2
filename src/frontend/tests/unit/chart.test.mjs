// @vitest-environment jsdom
/** Rendering of series, uncertainties, and log-scale filtering in the chart. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../../src/components/chart/Chart";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

const visible = {
  id: "one",
  name: "Primeira",
  points: [
    { x: 2, y: 3, sx: 0.5, sy: 0.25 },
    { x: -1, y: 2 },
    { x: Number.NaN, y: 1 },
  ],
  linePoints: [
    { x: 1, y: 1 },
    { x: 2, y: 3 },
  ],
  color: "#123456",
  radius: 4,
  symbol: "circle",
  lineStyle: "dashed",
  lineWidth: 2,
  visible: true,
};
const hidden = { ...visible, id: "two", name: "Oculta", visible: false };
let root;
let node;

function Harness({ initial = {}, series = [visible, hidden] }) {
  const settings = useChartSettings(initial);
  const graphicRef = useRef(null);
  return createElement(Chart, { series, label: "Experimento", settings, graphicRef });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 640, height: 480 } }]);
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
  vi.unstubAllGlobals();
});

it("plots visible finite points, uncertainty bars and the selected line style", async () => {
  await act(async () => root.render(createElement(Harness)));
  const svg = node.querySelector('svg[role="img"]');
  expect(svg.getAttribute("aria-label")).toBe("Experimento");
  expect(svg.querySelectorAll('circle[fill="#123456"]')).toHaveLength(2);
  expect(svg.querySelectorAll('line[stroke="#123456"]')).toHaveLength(2);
  expect(svg.querySelector('path[stroke="#123456"]').getAttribute("stroke-dasharray")).toBe("8 5");
  expect(node.textContent).toContain("Primeira");
  expect(node.textContent).not.toContain("Oculta");
});

it("excludes non-positive values from logarithmic axes", async () => {
  await act(async () => root.render(createElement(Harness, { initial: { xLog: true } })));
  const svg = node.querySelector('svg[role="img"]');
  expect(svg.querySelectorAll('circle[fill="#123456"]')).toHaveLength(1);
  for (const point of svg.querySelectorAll('circle[fill="#123456"]')) {
    expect(Number.isFinite(Number(point.getAttribute("cx")))).toBe(true);
  }
});

const axisLines = (svg) => [...svg.querySelectorAll('line[stroke="#aebbb0"]')];

it("draws the axes as a cross through zero, sticking to an edge when zero is out of range", async () => {
  await act(async () => root.render(createElement(Harness)));
  const [horizontal, vertical] = axisLines(node.querySelector('svg[role="img"]'));
  // x spans negative to positive values, so the Y axis passes through x = 0 inside the plot.
  expect(horizontal.getAttribute("y1")).toBe(horizontal.getAttribute("y2"));
  expect(vertical.getAttribute("x1")).toBe(vertical.getAttribute("x2"));
  expect(Number(vertical.getAttribute("x1"))).toBeGreaterThan(0);
  // y stays positive, so the X axis sticks to the bottom edge of the plot.
  expect(Number(horizontal.getAttribute("y1"))).toBe(Number(vertical.getAttribute("y2")));
});

it("keeps the axes on the left and bottom edges on logarithmic scales", async () => {
  await act(async () =>
    root.render(createElement(Harness, { initial: { xLog: true, yLog: true } })),
  );
  const [horizontal, vertical] = axisLines(node.querySelector('svg[role="img"]'));
  expect(Number(vertical.getAttribute("x1"))).toBe(0);
  expect(Number(horizontal.getAttribute("y1"))).toBe(Number(vertical.getAttribute("y2")));
});

const tooltip = () => node.querySelector('[role="tooltip"]');
const plot = () => node.querySelector('[role="group"][tabindex="0"]');
const press = (key) =>
  act(async () => plot().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
const hover = (element, type = "mouseover") =>
  act(async () => element.dispatchEvent(new MouseEvent(type, { bubbles: true })));
const stacked = (id, name, extra = {}) => ({
  ...visible,
  id,
  name,
  linePoints: [],
  points: [{ x: 2, y: 3 }],
  ...extra,
});

it("shows point values and uncertainties in a tooltip beside the point", async () => {
  await act(async () => root.render(createElement(Harness)));
  expect(tooltip()).toBeNull();
  await hover(node.querySelector('circle[fill="#123456"]'));
  expect(tooltip().textContent).toBe("Primeiranº 1x2± 0,5y3± 0,25");
  expect(tooltip().hasAttribute("data-html2canvas-ignore")).toBe(true);
  expect(tooltip().style.left).toMatch(/px$/);
  const svg = node.querySelector('svg[role="img"]');
  expect(svg.querySelectorAll('circle[fill="none"][stroke="#123456"]')).toHaveLength(1);
  expect(svg.querySelectorAll('path[stroke-dasharray="3 3"]')).toHaveLength(1);
  await hover(node.querySelector('circle[fill="#123456"]'), "mouseout");
  expect(tooltip()).toBeNull();
  expect(svg.querySelectorAll('circle[fill="none"]')).toHaveLength(0);
});

it("gives every point a pointer target larger than its marker", async () => {
  await act(async () => root.render(createElement(Harness)));
  const targets = node.querySelectorAll('svg[role="img"] circle[fill="transparent"]');
  expect(targets).toHaveLength(2);
  expect(Number(targets[0].getAttribute("r"))).toBe(12);
  await hover(targets[1]);
  expect(tooltip().textContent).toBe("Primeiranº 2x−1y2");
});

it("labels tooltip rows with the axis titles, including LaTeX", async () => {
  const initial = { xLabel: "Tempo $t$ (s)", yLabel: "" };
  await act(async () => root.render(createElement(Harness, { initial })));
  await hover(node.querySelector('circle[fill="#123456"]'));
  expect(tooltip().querySelector(".katex")).not.toBeNull();
  expect(tooltip().textContent).toContain("Tempo");
  expect(tooltip().textContent).toContain("y3");
});

it("lists coincident points from several series in one tooltip", async () => {
  const series = [
    stacked("a", "Série A"),
    stacked("b", "Série B", { symbol: "square" }),
    stacked("c", "Série C", {
      symbol: "diamond",
      points: [
        { x: 9, y: 9 },
        { x: 2, y: 3, sy: 1 },
      ],
    }),
  ];
  await act(async () => root.render(createElement(Harness, { series })));
  await hover(node.querySelector('rect[fill="#123456"]'));
  const text = tooltip().textContent;
  expect(text.startsWith("3 pontos próximosSérie Bnº 1")).toBe(true);
  expect(text).toContain("Série Anº 1");
  expect(text).toContain("Série Cnº 2x2y3± 1");
  expect(text).not.toContain("outro");
  expect(tooltip().querySelectorAll("svg rect")).toHaveLength(2);
  expect(tooltip().querySelectorAll("svg rect[transform]")).toHaveLength(1);
});

it("counts coincident points beyond the first three", async () => {
  const names = ["A", "B", "C", "D"];
  const four = names.map((name) => stacked(name, `Série ${name}`));
  await act(async () => root.render(createElement(Harness, { series: four })));
  await hover(node.querySelector('circle[fill="#123456"]'));
  expect(tooltip().textContent).toContain("4 pontos próximos");
  expect(tooltip().textContent).toContain("+ 1 outro ponto");
  expect(tooltip().textContent).not.toContain("Série D");
  const five = [...four, stacked("E", "Série E")];
  await act(async () => root.render(createElement(Harness, { series: five })));
  await hover(node.querySelector('circle[fill="#123456"]'));
  expect(tooltip().textContent).toContain("+ 2 outros pontos");
});

it("walks through the points with the keyboard and announces them", async () => {
  await act(async () => root.render(createElement(Harness)));
  const live = node.querySelector('[aria-live="polite"]');
  await press("ArrowRight");
  expect(tooltip().textContent).toContain("nº 2");
  expect(live.textContent).toBe("Primeira, ponto 2: x −1; y 2");
  await press("ArrowDown");
  expect(tooltip().textContent).toContain("nº 1");
  expect(live.textContent).toBe("Primeira, ponto 1: x 2 ± 0,5; y 3 ± 0,25");
  await press("ArrowRight");
  expect(tooltip().textContent).toContain("nº 2");
  await press("ArrowLeft");
  expect(tooltip().textContent).toContain("nº 1");
  await press("Home");
  expect(tooltip().textContent).toContain("nº 2");
  await press("End");
  expect(tooltip().textContent).toContain("nº 1");
  await press("a");
  expect(tooltip().textContent).toContain("nº 1");
  await press("Escape");
  expect(tooltip()).toBeNull();
  expect(live.textContent).toBe("");
  await press("ArrowUp");
  expect(tooltip().textContent).toContain("nº 1");
  await act(async () => plot().dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(tooltip()).toBeNull();
});

it("ignores keys pressed on controls inside the plot and plots without points", async () => {
  await act(async () => root.render(createElement(Harness)));
  const button = plot().querySelector("button");
  await act(async () =>
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
  );
  expect(tooltip()).toBeNull();
  await press("ArrowRight");
  await act(async () => button.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(tooltip()).not.toBeNull();
  await act(async () => root.render(createElement(Harness, { series: [hidden] })));
  await press("ArrowRight");
  expect(tooltip()).toBeNull();
});

it("dismisses the tooltip when a zoom or pan gesture starts", async () => {
  await act(async () => root.render(createElement(Harness)));
  await press("ArrowRight");
  expect(tooltip()).not.toBeNull();
  const svg = node.querySelector('svg[role="img"]');
  // jsdom rejects `view` in the constructor here, and d3-zoom reads it from the event.
  const gesture = (type) =>
    Object.defineProperty(new MouseEvent(type, { bubbles: true, button: 0 }), "view", {
      value: document.defaultView,
    });
  // jsdom has no SVG length API, which d3-zoom uses to size the gesture extent.
  for (const side of ["width", "height"])
    Object.defineProperty(svg, side, { value: { baseVal: { value: 480 } } });
  await act(async () => svg.dispatchEvent(gesture("mousedown")));
  expect(tooltip()).toBeNull();
  await act(async () => document.defaultView.dispatchEvent(gesture("mouseup")));
});

it("renders diamond markers, hides grid and legend, and dims non-selected series", async () => {
  const series = [{ ...visible, symbol: "diamond", linePoints: [], points: [{ x: 3, y: 4 }] }];
  function Dimmed() {
    const settings = useChartSettings({ grid: false, legend: false });
    const graphicRef = useRef(null);
    return createElement(Chart, {
      series,
      label: "Séries",
      settings,
      graphicRef,
      highlightedSeriesId: "other",
    });
  }
  await act(async () => root.render(createElement(Dimmed)));
  const svg = node.querySelector('svg[role="img"]');
  const marker = svg.querySelector('rect[fill="#123456"]');
  expect(marker.getAttribute("transform")).toContain("rotate(45");
  expect(marker.closest("g[opacity]").getAttribute("opacity")).toBe("0.15");
  expect(svg.querySelectorAll('line[stroke="#e8ece7"]')).toHaveLength(0);
  expect(node.textContent).not.toContain("Primeira");
});

it("moves the legend within the chart bounds when dragged", async () => {
  await act(async () => root.render(createElement(Harness)));
  const legend = [...node.querySelectorAll("div")].find(
    (element) =>
      element.className.includes?.("cursor-grab") && element.textContent.includes("Primeira"),
  );
  expect(legend).toBeDefined();
  legend.setPointerCapture = () => {};
  legend.getBoundingClientRect = () => ({ left: 20, top: 20, width: 100, height: 40 });
  legend.parentElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 480 });
  const event = (type, x, y) => {
    const e = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: 1 });
    return e;
  };
  await act(async () => legend.dispatchEvent(event("pointerdown", 30, 30)));
  await act(async () => legend.dispatchEvent(event("pointermove", 300, 250)));
  expect(legend.style.left).not.toBe("100%");
  expect(legend.style.top).not.toBe("50%");
  await act(async () => legend.dispatchEvent(event("pointerup", 300, 250)));
});
