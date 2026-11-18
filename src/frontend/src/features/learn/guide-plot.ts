/**
 * @module
 * Pure helpers of the guide page plot: axis ticks and fitted curves.
 */

import { FunctionInterpreter } from "@/features/analysis/fit/function-interpreter";
import type { GuideSeries } from "./lesson";

/**
 * Round tick values covering a range.
 * @param max - Largest value to cover; the axis starts at zero.
 * @returns About five ticks at 1, 2 or 5 times a power of ten.
 */
export function niceTicks(max: number): number[] {
  const raw = max / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * power).find((s) => s >= raw) ?? raw;
  return Array.from(
    { length: Math.ceil(max / step - 1e-9) + 1 },
    (_, i) => +(i * step).toPrecision(12),
  );
}

/**
 * Samples a fitted curve.
 * @param series - Series with a fit.
 * @param from - First x.
 * @param to - Last x.
 * @returns Points along the curve, or none when the series has no fit.
 */
export function sampleFit(series: GuideSeries, from: number, to: number): [number, number][] {
  if (!series.fit) return [];
  const model = new FunctionInterpreter(series.fit.equation);
  const values = Object.fromEntries(series.fit.parameters.map((p) => [p.name, p.value]));
  return Array.from({ length: 61 }, (_, i) => {
    const x = from + ((to - from) * i) / 60;
    return [x, model.executeWithNames({ ...values, x })];
  });
}
