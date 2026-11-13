/** Placement of the chart axes so they cross at the origin. */
import { expect, it } from "vitest";
import { axisPosition } from "../../src/components/chart/axisPosition";

// x in [-5, 15] over 200px; y in [-10, 10] over 100px (pixel y grows downward).
const xPixel = (v) => ((v + 5) / 20) * 200;
const yPixel = (v) => 100 - ((v + 10) / 20) * 100;

it("crosses the axes at the origin when zero is visible", () => {
  expect(axisPosition(xPixel, yPixel, 200, 100, false, false)).toEqual({ x: 50, y: 50 });
});

it("sticks each axis to the nearest edge when its zero is out of range", () => {
  const right = (v) => xPixel(v) - 500;
  const left = (v) => xPixel(v) + 500;
  const below = (v) => yPixel(v) + 500;
  const above = (v) => yPixel(v) - 500;
  expect(axisPosition(right, yPixel, 200, 100, false, false).x).toBe(0);
  expect(axisPosition(left, yPixel, 200, 100, false, false).x).toBe(200);
  expect(axisPosition(xPixel, below, 200, 100, false, false).y).toBe(100);
  expect(axisPosition(xPixel, above, 200, 100, false, false).y).toBe(0);
});

it("keeps the classic edges on logarithmic scales, which have no zero", () => {
  expect(axisPosition(xPixel, yPixel, 200, 100, true, true)).toEqual({ x: 0, y: 100 });
  expect(axisPosition(xPixel, yPixel, 200, 100, true, false)).toEqual({ x: 0, y: 50 });
});

it("falls back to the classic edges when zero has no finite position", () => {
  expect(
    axisPosition(
      () => Number.NaN,
      () => Number.NaN,
      200,
      100,
      false,
      false,
    ),
  ).toEqual({
    x: 0,
    y: 100,
  });
});
