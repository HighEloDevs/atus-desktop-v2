// @vitest-environment jsdom
/** Fit range band on the chart: drawing, fading outside points, dragging and the keyboard. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../../src/components/chart/Chart";
import { useChartSettings } from "../../src/components/chart/useChartSettings";

const points = {
  id: "d",
  name: "Queda · A",
  points: [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x })),
  linePoints: [],
  color: "#123456",
  radius: 4,
  symbol: "circle",
  lineStyle: "solid",
  lineWidth: 2,
  visible: true,
};
const curve = {
  ...points,
  id: "d:b",
  name: "Queda · B",
  points: [],
  linePoints: [
    { x: 1, y: 2 },
    { x: 3, y: 6 },
  ],
  color: "#abcdef",
  lineStyle: "dashed",
  lineOnly: true,
};
let root;
let node;

function Harness({ rangeEditor }) {
  const settings = useChartSettings({});
  const graphicRef = useRef(null);
  return createElement(Chart, {
    series: [points, curve],
    label: "Queda",
    settings,
    graphicRef,
    rangeEditor,
  });
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

const editor = (overrides = {}) => ({
  pointsSeriesId: "d",
  color: "#abcdef",
  label: "B",
  min: 1,
  max: 3,
  onChange: vi.fn(),
  ...overrides,
});
const handle = (side) => node.querySelector(`[data-range-handle="${side}"]`);
const faded = () =>
  [...node.querySelectorAll('svg[role="img"] g[opacity="0.3"]')].filter((g) =>
    g.querySelector('circle[fill="#123456"]'),
  );

it("draws no band without an editor", async () => {
  await act(async () => root.render(createElement(Harness, { rangeEditor: null })));
  expect(node.querySelector('[data-testid="fit-range-band"]')).toBeNull();
  expect(faded()).toHaveLength(0);
});

it("draws the band of the active fit and fades the points outside it", async () => {
  await act(async () => root.render(createElement(Harness, { rangeEditor: editor() })));
  const band = node.querySelector('[data-testid="fit-range-band"]');
  expect(band.getAttribute("fill")).toBe("#abcdef");
  expect(Number(band.getAttribute("width"))).toBeGreaterThan(0);
  expect(faded()).toHaveLength(2);
  expect(handle("min").getAttribute("aria-label")).toBe("Início do intervalo do ajuste B");
  expect(handle("max").getAttribute("aria-valuenow")).toBe("3");
  expect(node.querySelector('svg[role="img"]').textContent).toContain("B");
});

it("follows the data on an edge with no typed value", async () => {
  await act(async () =>
    root.render(
      createElement(Harness, { rangeEditor: editor({ min: undefined, max: undefined }) }),
    ),
  );
  expect(handle("min").getAttribute("aria-valuenow")).toBe("0");
  expect(handle("max").getAttribute("aria-valuenow")).toBe("4");
  expect(faded()).toHaveLength(0);
});

it("previews a drag locally and reports the edges once, on release", async () => {
  const rangeEditor = editor();
  await act(async () => root.render(createElement(Harness, { rangeEditor })));
  const min = handle("min");
  const at = (x) => ({ bubbles: true, clientX: x, pointerId: 1 });
  await act(async () => min.dispatchEvent(new MouseEvent("pointerdown", at(100))));
  await act(async () => min.dispatchEvent(new MouseEvent("pointermove", at(5000))));
  // Pushed past the other edge, it stops there.
  expect(handle("min").getAttribute("aria-valuenow")).toBe("3");
  expect(rangeEditor.onChange).not.toHaveBeenCalled();
  await act(async () => min.dispatchEvent(new MouseEvent("pointermove", at(0))));
  await act(async () => handle("min").dispatchEvent(new MouseEvent("pointerup", at(0))));
  expect(rangeEditor.onChange).toHaveBeenCalledOnce();
  const [{ min: value, max }] = rangeEditor.onChange.mock.calls[0];
  expect(value).toBeLessThan(1);
  expect(max).toBe(3);
  // A move after release does nothing.
  await act(async () => handle("min").dispatchEvent(new MouseEvent("pointermove", at(300))));
  expect(rangeEditor.onChange).toHaveBeenCalledOnce();
});

it("cancels a drag without reporting it", async () => {
  const rangeEditor = editor();
  await act(async () => root.render(createElement(Harness, { rangeEditor })));
  const max = handle("max");
  await act(async () => max.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
  await act(async () => max.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true })));
  await act(async () => max.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
  expect(rangeEditor.onChange).not.toHaveBeenCalled();
});

it("moves an edge with the arrow keys and ignores other keys", async () => {
  const rangeEditor = editor();
  await act(async () => root.render(createElement(Harness, { rangeEditor })));
  const key = (side, name) =>
    act(async () =>
      handle(side).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: name })),
    );
  await key("max", "Enter");
  expect(rangeEditor.onChange).not.toHaveBeenCalled();
  await key("max", "ArrowRight");
  await key("min", "ArrowLeft");
  await key("min", "ArrowUp");
  await key("max", "ArrowDown");
  const calls = rangeEditor.onChange.mock.calls.map(([edges]) => edges);
  expect(calls[0].max).toBeGreaterThan(3);
  expect(calls[1].min).toBeLessThan(1);
  expect(calls[2].min).toBeGreaterThan(1);
  expect(calls[3].max).toBeLessThan(3);
});

it("shows another fit in the legend by its line, without a point marker", async () => {
  await act(async () => root.render(createElement(Harness, { rangeEditor: null })));
  const entry = [...node.querySelectorAll("span")].find(
    (span) => span.textContent === "Queda · B" && span.querySelector(":scope > svg"),
  );
  expect(entry.querySelector("circle")).toBeNull();
  expect(entry.querySelector('line[stroke="#abcdef"]').getAttribute("stroke-dasharray")).toBe(
    "8 5",
  );
});
