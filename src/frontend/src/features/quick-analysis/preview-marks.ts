/**
 * @module
 * Placement of pasted points in the quick analysis preview.
 */

import type { ChartPoint } from "@/components/chart/Chart";

/** Default drawing width, used until the container is measured. */
export const WIDTH = 300;
/** Default drawing height, used until the container is measured. */
export const HEIGHT = 200;
const PAD = 18;

/** Point position in the preview, in SVG units, with the y error bar ends when present. */
export type PreviewMark = { cx: number; cy: number; low?: number; high?: number };

/**
 * Maps points to the preview area, keeping a margin and the error bars inside it. A single x or y
 * value is centred instead of dividing by zero.
 *
 * @param points - Points to place.
 * @param width - Drawing width.
 * @param height - Drawing height.
 * @returns One mark per point, in input order.
 * @example
 * previewMarks([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 100); // corners inside the padding
 */
export function previewMarks(points: ChartPoint[], width = WIDTH, height = HEIGHT): PreviewMark[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.flatMap((p) => [p.y - (p.sy ?? 0), p.y + (p.sy ?? 0)]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (v: number) =>
    x1 === x0 ? width / 2 : PAD + ((v - x0) / (x1 - x0)) * (width - 2 * PAD);
  const sy = (v: number) =>
    y1 === y0 ? height / 2 : height - PAD - ((v - y0) / (y1 - y0)) * (height - 2 * PAD);
  return points.map((p) => ({
    cx: sx(p.x),
    cy: sy(p.y),
    ...(p.sy ? { low: sy(p.y - p.sy), high: sy(p.y + p.sy) } : {}),
  }));
}
