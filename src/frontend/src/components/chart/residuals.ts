/**
 * @module
 * Pure helpers for the residuals panel: availability, scale, uncertainty band and histogram.
 */

import { residualAxis } from "@/features/analysis/fit/result-format";

/** Residual (y − curve) of one fitted point, with its optional Y uncertainty. */
export type ChartResidual = { x: number; residual: number; sy?: number };

/** The minimum a series must expose for residuals. */
export type ResidualSource = { visible: boolean; residuals?: ChartResidual[] };

/** One histogram bin over the residual axis. */
export type HistogramBin = { from: number; to: number; count: number };

/**
 * Formats a tick label in the app locale with up to five significant digits.
 * @param value - Tick value.
 * @returns The localized text.
 */
export const formatTick = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 5 }).format(value);

/**
 * Y range of the residuals panel: symmetric around zero unless limits are typed.
 * @param series - Series that may carry residuals.
 * @param errorBars - Whether the uncertainty bars are drawn (they widen the range).
 * @param min - Typed lower limit; empty for automatic.
 * @param max - Typed upper limit; empty for automatic.
 * @returns The [low, high] range.
 */
export function residualYDomain(
  series: ResidualSource[],
  errorBars: boolean,
  min: string,
  max: string,
): [number, number] {
  const values = series
    .filter((item) => item.visible)
    .flatMap((item) =>
      (item.residuals ?? [])
        .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.residual))
        .flatMap((r) => [
          r.residual,
          ...(errorBars && r.sy ? [r.residual - r.sy, r.residual + r.sy] : []),
        ]),
    );
  return residualDomain(values, min, max);
}

/**
 * Tells whether any visible series has at least one finite residual.
 * @param series - Series that may carry residuals.
 * @returns True when the residuals panel has something to draw.
 */
export function hasResiduals(series: ResidualSource[]): boolean {
  return series.some(
    (item) =>
      item.visible &&
      (item.residuals ?? []).some((r) => Number.isFinite(r.x) && Number.isFinite(r.residual)),
  );
}

/**
 * Mean Y uncertainty of the visible residual points that have one.
 * @param series - Series that may carry residuals.
 * @returns The mean σ, or null when no point has a positive uncertainty.
 */
export function residualSigma(series: ResidualSource[]): number | null {
  const values = series
    .filter((item) => item.visible)
    .flatMap((item) => item.residuals ?? [])
    .flatMap((r) => (r.sy !== undefined && Number.isFinite(r.sy) && r.sy > 0 ? [r.sy] : []));
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/**
 * Resolves the Y domain of the residuals panel.
 *
 * The automatic domain is symmetric around zero (see `residualAxis`). A manual bound
 * replaces only its own side; an empty or invalid bound keeps the automatic one, and
 * a manual pair that is not increasing is ignored.
 * @param values - Values the domain must contain (residuals, optionally widened by σ).
 * @param min - Manual minimum as typed, or an empty string.
 * @param max - Manual maximum as typed, or an empty string.
 * @returns The `[min, max]` domain.
 */
export function residualDomain(values: number[], min: string, max: string): [number, number] {
  const { limit } = residualAxis(values);
  const parse = (text: string, fallback: number) =>
    text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : fallback;
  const lo = parse(min, -limit);
  const hi = parse(max, limit);
  return lo < hi ? [lo, hi] : [-limit, limit];
}

/**
 * Counts values into equal-width bins across a domain; values outside it are ignored.
 * @param values - Residual values.
 * @param domain - Axis `[min, max]`.
 * @param bins - Number of bins (at least 1).
 * @returns The bins from low to high.
 */
export function residualHistogram(
  values: number[],
  domain: [number, number],
  bins = 8,
): HistogramBin[] {
  const count = Math.max(1, Math.floor(bins));
  const step = (domain[1] - domain[0]) / count;
  const result = Array.from({ length: count }, (_, i) => ({
    from: domain[0] + i * step,
    to: domain[0] + (i + 1) * step,
    count: 0,
  }));
  for (const value of values) {
    if (!Number.isFinite(value) || value < domain[0] || value > domain[1]) continue;
    result[Math.min(count - 1, Math.floor((value - domain[0]) / step))].count += 1;
  }
  return result;
}
