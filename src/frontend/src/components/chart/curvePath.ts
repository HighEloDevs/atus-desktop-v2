/**
 * @module
 * Sampling of fitted curves for drawing on nonlinear scales.
 */

/** A point of a fitted curve, in data units. */
export type CurvePoint = { x: number; y: number };

/**
 * Fills each segment of a curve with evenly spaced points in data space.
 *
 * A fitted curve arrives as samples that are joined by straight lines. On a linear
 * scale that is exact between samples; on a log scale a straight segment in the data
 * is curved on screen, so drawing the samples directly cuts across the measurements.
 * Interpolating in data space before mapping keeps the drawn curve on the model.
 * @param points - Curve samples in ascending drawing order.
 * @param steps - Pieces each segment is split into; 1 returns the input unchanged.
 * @returns The samples with `steps − 1` interpolated points inside each segment.
 * @example
 * densifyCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }], 2); // [(0,0), (0.5,0.5), (1,1)]
 */
export function densifyCurve<T extends CurvePoint>(points: T[], steps: number): CurvePoint[] {
  if (steps <= 1 || points.length < 2) return points;
  const out: CurvePoint[] = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    out.push(point);
    if (!next || ![point.x, point.y, next.x, next.y].every(Number.isFinite)) return;
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      out.push({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t });
    }
  });
  return out;
}
