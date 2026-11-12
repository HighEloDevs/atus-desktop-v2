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

it("shows point values and uncertainties in the tooltip", async () => {
  await act(async () => root.render(createElement(Harness)));
  const point = node.querySelector('circle[fill="#123456"]');
  await act(async () => point.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(node.textContent).toContain("Primeira · x: 2 · y: 3 · σx: 0,5 · σy: 0,25");
  await act(async () => point.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(node.textContent).not.toContain("σx: 0,5");
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
