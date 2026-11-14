/** Pure per-axis settings: migration, validation, ticks, labels and layout estimates. */
import { expect, it } from "vitest";
import { scaleLinear, scaleLog } from "d3";
import {
  AXIS_DEFAULTS,
  axisLimitsError,
  axisStepError,
  changedAxisSettings,
  clampAxisValue,
  formatAxisTick,
  labelWidth,
  majorTicks,
  minorTicks,
  restoreAxis,
  tickSpan,
  xLabelHeight,
  xLabelSpace,
  yLabelGap,
} from "../../src/components/chart/axisSettings";

const axis = (patch = {}) => ({ ...AXIS_DEFAULTS, ...patch });

it("migrates legacy flat values and lets a saved axis object win", () => {
  const legacy = { xMin: "1", xMax: "9", yLog: true, ticks: 40, grid: false };
  expect(restoreAxis("x", undefined, legacy)).toEqual(
    axis({ min: "1", max: "9", ticks: 20, grid: false }),
  );
  expect(restoreAxis("y", undefined, legacy)).toEqual(axis({ log: true, ticks: 20, grid: false }));
  expect(restoreAxis("x", undefined)).toEqual(AXIS_DEFAULTS);
  expect(restoreAxis("x", { fontSize: 14 }, legacy)).toEqual(axis({ fontSize: 14 }));
});

it("clamps bounded values and counts changed settings", () => {
  expect(clampAxisValue("ticks", 1)).toBe(2);
  expect(clampAxisValue("minor", 3.6)).toBe(4);
  expect(clampAxisValue("decimals", Number.NaN)).toBe(AXIS_DEFAULTS.decimals);
  expect(changedAxisSettings(AXIS_DEFAULTS)).toBe(0);
  expect(changedAxisSettings(axis({ min: "2", log: true }))).toBe(2);
});

it("explains unusable limits and steps", () => {
  expect(axisLimitsError(axis({ min: "5", max: "5" }))).toBe(
    "O mínimo precisa ser menor que o máximo.",
  );
  expect(axisLimitsError(axis({ log: true, min: "0" }))).toBe(
    "Na escala log, os limites precisam ser maiores que zero.",
  );
  expect(axisLimitsError(axis({ min: "1", max: "2" }))).toBeNull();
  const step = (value) => axis({ spacing: "step", step: value });
  expect(axisStepError(step("0"), [0, 1])).toBe("Use um passo maior que zero.");
  expect(axisStepError(step("0.001"), [0, 1])).toBe("Passo pequeno demais para o intervalo.");
  expect(axisStepError(step(""), [0, 1])).toBeNull();
  expect(axisStepError(step("0.1"), [0, 1])).toBeNull();
  expect(axisStepError({ ...step("0"), log: true }, [1, 10])).toBeNull();
});

it("places major ticks automatically or at a fixed step, and minor ticks between them", () => {
  const scale = scaleLinear().domain([0, 1]);
  expect(majorTicks(scale, axis({ ticks: 2 }))).toEqual([0, 0.5, 1]);
  const fixed = axis({ spacing: "step", step: "0.25" });
  expect(majorTicks(scale, fixed)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  // A step too small for the range falls back to automatic ticks.
  expect(majorTicks(scale, axis({ spacing: "step", step: "0.0001", ticks: 2 }))).toEqual([
    0, 0.5, 1,
  ]);
  // An inverted domain still yields ascending ticks.
  expect(majorTicks(scaleLinear().domain([1, 0]), axis({ ticks: 2 }))).toEqual([0, 0.5, 1]);
  expect(minorTicks(scale, axis(), [0, 0.5, 1])).toEqual([]);
  expect(minorTicks(scale, axis({ minor: 1 }), [0, 0.5, 1])).toEqual([0.25, 0.75]);
  // With a single major tick the spacing comes from the automatic step (0.1 here).
  expect(minorTicks(scaleLinear().domain([0, 0.4]), axis({ minor: 1 }), [0.2])).toHaveLength(8);
});

it("uses the integer multiples of each decade as minor ticks on a log scale", () => {
  const scale = scaleLog().domain([1, 100]);
  const log = axis({ log: true, minor: 1 });
  const majors = majorTicks(scale, log);
  const minors = minorTicks(scale, log, majors);
  expect(minors.every((value) => !majors.includes(value))).toBe(true);
  expect([...majors, ...minors].sort((a, b) => a - b)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
  ]);
});

it("formats tick labels as automatic, decimal or scientific with a decimal comma", () => {
  expect(formatAxisTick(1234.5678, axis())).toBe("1.234,6");
  expect(formatAxisTick(1.5, axis({ format: "decimal", decimals: 2 }))).toBe("1,50");
  expect(formatAxisTick(0, axis({ format: "decimal", decimals: 1 }))).toBe("0,0");
  expect(formatAxisTick(1500, axis({ format: "scientific", decimals: 1 }))).toBe("1,5×10³");
  expect(formatAxisTick(-0.00025, axis({ format: "scientific", decimals: 0 }))).toBe("-3×10⁻⁴");
  expect(formatAxisTick(0, axis({ format: "scientific" }))).toBe("0");
});

it("measures tick marks and the room labels need", () => {
  expect(tickSpan("out", 5)).toEqual([0, 5]);
  expect(tickSpan("in", 5)).toEqual([-5, 0]);
  expect(tickSpan("cross", 5)).toEqual([-5, 5]);
  expect(labelWidth("12345", 10)).toBe(30);
  const labels = ["10", "100"];
  expect(xLabelHeight(labels, axis())).toBe(10);
  expect(xLabelHeight(labels, axis({ rotation: 90 }))).toBe(18);
  expect(xLabelHeight(labels, axis({ rotation: 45 }))).toBeCloseTo(28 * Math.SQRT1_2);
  // With the defaults the chart keeps its previous label position (h + 16).
  expect(xLabelSpace(labels, axis())).toBe(27);
  expect(xLabelSpace(labels, axis({ rotation: 90 }))).toBe(32);
  expect(yLabelGap(axis())).toBe(10);
  expect(yLabelGap(axis({ tickDirection: "in" }))).toBe(8);
});
