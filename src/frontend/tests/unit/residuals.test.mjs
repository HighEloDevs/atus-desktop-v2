/** Availability, scale, band and histogram helpers of the residuals panel. */
import { describe, expect, it } from "vitest";
import {
  hasResiduals,
  residualDomain,
  residualHistogram,
  residualSigma,
} from "../../src/components/chart/residuals.ts";

const series = (visible, residuals) => ({ visible, residuals });

describe("hasResiduals", () => {
  it("is false without series, residuals, or visible series", () => {
    expect(hasResiduals([])).toBe(false);
    expect(hasResiduals([series(true, undefined)])).toBe(false);
    expect(hasResiduals([series(true, [])])).toBe(false);
    expect(hasResiduals([series(false, [{ x: 1, residual: 0.1 }])])).toBe(false);
  });
  it("ignores non-finite residuals and accepts any visible series with a finite one", () => {
    expect(hasResiduals([series(true, [{ x: 1, residual: Number.NaN }])])).toBe(false);
    expect(hasResiduals([series(false, []), series(true, [{ x: 1, residual: -0.2 }])])).toBe(true);
  });
});

describe("residualSigma", () => {
  it("averages the positive uncertainties of visible series only", () => {
    expect(
      residualSigma([
        series(true, [
          { x: 1, residual: 0, sy: 0.1 },
          { x: 2, residual: 0, sy: 0.3 },
          { x: 3, residual: 0 },
          { x: 4, residual: 0, sy: 0 },
        ]),
        series(false, [{ x: 1, residual: 0, sy: 9 }]),
      ]),
    ).toBeCloseTo(0.2);
  });
  it("is null when no point has an uncertainty", () => {
    expect(residualSigma([series(true, [{ x: 1, residual: 0.1 }])])).toBeNull();
  });
});

describe("residualDomain", () => {
  it("is symmetric and rounded when automatic", () => {
    expect(residualDomain([0.028, -0.01], "", "")).toEqual([-0.03, 0.03]);
  });
  it("replaces only the side that was typed", () => {
    expect(residualDomain([0.028, -0.01], "-0.5", "")).toEqual([-0.5, 0.03]);
    expect(residualDomain([0.028, -0.01], "", "1")).toEqual([-0.03, 1]);
    expect(residualDomain([0.028, -0.01], "-1", "2")).toEqual([-1, 2]);
  });
  it("falls back to the automatic domain for invalid or non-increasing limits", () => {
    expect(residualDomain([0.028], "abc", "")).toEqual([-0.03, 0.03]);
    expect(residualDomain([0.028], "2", "1")).toEqual([-0.03, 0.03]);
    expect(residualDomain([0.028], "1", "1")).toEqual([-0.03, 0.03]);
  });
});

describe("residualHistogram", () => {
  it("counts values into equal bins and ignores values outside the domain", () => {
    const bins = residualHistogram([-0.9, -0.1, 0.1, 0.1, 1, 5, Number.NaN], [-1, 1], 4);
    expect(bins.map((bin) => bin.count)).toEqual([1, 1, 2, 1]);
    expect(bins[0].from).toBe(-1);
    expect(bins[3].to).toBe(1);
  });
  it("always returns at least one bin", () => {
    expect(residualHistogram([0], [-1, 1], 0)).toHaveLength(1);
  });
});
