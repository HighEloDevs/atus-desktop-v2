/** Pure legend settings: defaults, clamping and the corner grid. */
import { expect, it } from "vitest";
import {
  clampLegendValue,
  LEGEND_DEFAULTS,
  legendAnchor,
  restoreLegendStyle,
} from "../../src/components/chart/legendSettings";

it("fills missing legend settings with the defaults", () => {
  expect(restoreLegendStyle(undefined)).toEqual(LEGEND_DEFAULTS);
  expect(restoreLegendStyle({ border: true })).toEqual({ ...LEGEND_DEFAULTS, border: true });
});

it("clamps bounded legend values", () => {
  expect(clampLegendValue("columns", 9)).toBe(4);
  expect(clampLegendValue("fontSize", 2.4)).toBe(8);
  expect(clampLegendValue("markerSize", Number.NaN)).toBe(LEGEND_DEFAULTS.markerSize);
});

it("matches a position to a corner of the 3 × 3 grid only when it sits on one", () => {
  expect(legendAnchor({ x: 1, y: 0.5 })).toEqual({ x: 1, y: 0.5 });
  expect(legendAnchor({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 });
  expect(legendAnchor({ x: 0.37, y: 0 })).toBeNull();
});
