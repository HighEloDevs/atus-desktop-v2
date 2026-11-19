/** Fit range band on the chart: rounding dragged edges and keeping them in order. */
import { expect, it } from "vitest";
import {
  moveRangeEdge,
  rangeFieldText,
  snapRangeValue,
} from "../../src/components/chart/rangeBand";

it("rounds a dragged value to about a hundredth of the visible span", () => {
  expect(snapRangeValue(0.2483117, 10)).toBe(0.2);
  expect(snapRangeValue(123.456, 600)).toBe(120);
  expect(snapRangeValue(123.456, 150)).toBe(124);
  expect(snapRangeValue(0.30000000000000004, 1)).toBe(0.3);
  expect(snapRangeValue(-0.0123, 0.2)).toBe(-0.012);
  expect(snapRangeValue(7, 0)).toBe(7);
  expect(snapRangeValue(Number.NaN, 10)).toBeNaN();
});

it("moves one edge and stops it at the other", () => {
  expect(moveRangeEdge({}, "min", 2, [0, 10])).toEqual({ min: 2 });
  expect(moveRangeEdge({ min: 2 }, "max", 1, [0, 10])).toEqual({ min: 2, max: 2 });
  expect(moveRangeEdge({ max: 5 }, "min", 8, [0, 10])).toEqual({ min: 5, max: 5 });
  expect(moveRangeEdge({}, "max", 12, [0, 10])).toEqual({ max: 12 });
});

it("writes the shortest field text and leaves a data-following edge empty", () => {
  expect(rangeFieldText(undefined)).toBe("");
  expect(rangeFieldText(Number.POSITIVE_INFINITY)).toBe("");
  expect(rangeFieldText(0.1 + 0.2)).toBe("0.3");
  expect(rangeFieldText(120)).toBe("120");
});
