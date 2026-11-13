// @vitest-environment jsdom
/** Components shared with the quick analysis window: equation field, points table and preview. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { EquationField } from "../../src/features/analysis/fit/EquationField";
import { DataPointsTable } from "../../src/features/analysis/DataPointsTable";
import { PointsPreview } from "../../src/features/quick-analysis/PointsPreview";
import { previewMarks } from "../../src/features/quick-analysis/preview-marks";
import {
  DataValidationError,
  parseValidPoints,
} from "../../src/features/analysis/data-import/parse-valid-points";

let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

async function render(element) {
  await act(async () => root.render(element));
}

const preview = () => node.querySelector('[aria-label="Pré-visualização da equação em LaTeX"]');

it("previews the placeholder faded while the equation is empty", async () => {
  await render(createElement(EquationField, { label: "Função", value: "", onChange: () => {} }));
  expect(preview().className).toContain("opacity-40");
  expect(preview().textContent).toContain("b");
  expect(node.querySelector("input").getAttribute("aria-invalid")).toBeNull();
});

it("forwards edits, keys and pastes and exposes the invalid state", async () => {
  const onChange = vi.fn();
  const onKeyDown = vi.fn();
  const onPaste = vi.fn();
  await render(
    createElement(EquationField, {
      id: "eq",
      label: "Função",
      value: "a*x",
      size: "large",
      invalid: true,
      describedBy: "erro",
      onChange,
      onKeyDown,
      onPaste,
    }),
  );
  const input = node.querySelector("input#eq");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe("erro");
  expect(input.className).toContain("text-[16px]");
  expect(node.firstElementChild.dataset.invalid).toBe("true");
  expect(preview().className).not.toContain("opacity-40");
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, "a*x+b");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.dispatchEvent(new Event("paste", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith("a*x+b");
  expect(onKeyDown).toHaveBeenCalled();
  expect(onPaste).toHaveBeenCalled();
});

it("keeps σ lowercase in the uppercase table header", async () => {
  await render(createElement(DataPointsTable, { points: [{ x: 1, y: 2 }] }));
  const sigma = [...node.querySelectorAll("th span.normal-case")].map((item) => item.textContent);
  expect(sigma).toEqual(["σ", "σ"]);
  expect(node.querySelectorAll("tbody tr")).toHaveLength(1);
});

it("parses valid points and rejects unusable values", () => {
  expect(parseValidPoints("1\t2\t0,1\n2\t4\t0,2", "auto")).toEqual([
    { x: 1, y: 2, sx: 0, sy: 0.1 },
    { x: 2, y: 4, sx: 0, sy: 0.2 },
  ]);
  expect(() => parseValidPoints("1;2;-1", ";")).toThrow(DataValidationError);
  expect(() => parseValidPoints("1;2;3;4;5", ";")).toThrow(/4 colunas/);
});

it("places preview marks inside the padding and centres degenerate ranges", () => {
  const marks = previewMarks(
    [
      { x: 0, y: 0, sy: 1 },
      { x: 10, y: 10 },
    ],
    100,
    100,
  );
  expect(marks[0].cx).toBe(18);
  expect(marks[1].cx).toBe(82);
  expect(marks[0].low).toBe(82);
  expect(marks[1].high).toBeUndefined();
  expect(previewMarks([{ x: 3, y: 3 }], 100, 60)).toEqual([{ cx: 50, cy: 30 }]);
  expect(previewMarks([])).toEqual([]);
});

it("draws the preview at the measured size of its container", async () => {
  let notifySize;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        notifySize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const points = [
    { x: 0, y: 0, sy: 0.5 },
    { x: 1, y: 1 },
  ];
  await render(createElement(PointsPreview, { points, label: "Prévia" }));
  const svg = node.querySelector('svg[aria-label="Prévia"]');
  expect(svg.getAttribute("viewBox")).toBe("0 0 300 200");
  expect(svg.querySelectorAll("circle")).toHaveLength(2);
  expect(svg.querySelectorAll(".quick-point line")).toHaveLength(1);
  await act(async () => notifySize([{ contentRect: { width: 0, height: 0 } }]));
  expect(svg.getAttribute("viewBox")).toBe("0 0 300 200");
  await act(async () => notifySize([{ contentRect: { width: 400, height: 120 } }]));
  expect(svg.getAttribute("viewBox")).toBe("0 0 400 120");
  await render(createElement(PointsPreview, { points: [], label: "Prévia" }));
  expect(node.querySelectorAll("circle")).toHaveLength(0);
});
