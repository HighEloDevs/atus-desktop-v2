/** Curve sampling for nonlinear scales. */
import { expect, it } from "vitest";
import { densifyCurve } from "../../src/components/chart/curvePath";

it("fills each segment with points interpolated in data space", () => {
  const curve = [
    { x: 1, y: 1 },
    { x: 3, y: 5 },
  ];
  expect(densifyCurve(curve, 1)).toBe(curve);
  expect(densifyCurve(curve, 4)).toEqual([
    { x: 1, y: 1 },
    { x: 1.5, y: 2 },
    { x: 2, y: 3 },
    { x: 2.5, y: 4 },
    { x: 3, y: 5 },
  ]);
  expect(densifyCurve([{ x: 1, y: 1 }], 4)).toEqual([{ x: 1, y: 1 }]);
});

it("keeps gaps instead of interpolating across invalid samples", () => {
  const curve = [
    { x: 1, y: 1 },
    { x: Number.NaN, y: 2 },
    { x: 3, y: 3 },
  ];
  expect(densifyCurve(curve, 3)).toEqual(curve);
});
