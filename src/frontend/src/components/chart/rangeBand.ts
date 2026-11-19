/**
 * @module
 * Pure helpers for the fit range band drawn on the chart: rounding a dragged edge to a
 * readable value and keeping the two edges in order.
 */

/** Range edges; `undefined` means the edge follows the data. */
export type RangeEdges = { min?: number; max?: number };

/**
 * Rounds a dragged value to a step about 1/100 of the visible span (1, 2 or 5 times a power of
 * ten), so the fields receive values such as 0.2 instead of 0.2483117.
 * @param value - Value under the pointer.
 * @param span - Width of the visible X domain; must be positive.
 * @returns The rounded value, free of binary noise (no 0.30000000000000004).
 * @example
 * snapRangeValue(0.2483117, 10); // 0.2
 */
export function snapRangeValue(value: number, span: number): number {
  if (!Number.isFinite(value) || !(span > 0)) return value;
  const raw = span / 100;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

/**
 * Moves one edge of the range, keeping it on its side of the other edge.
 * @param edges - Current edges.
 * @param side - Edge being moved.
 * @param value - New value for that edge.
 * @param bounds - Data extent, used for an edge that follows the data.
 * @returns The new edges; an edge pushed past the other one stops at it.
 */
export function moveRangeEdge(
  edges: RangeEdges,
  side: "min" | "max",
  value: number,
  bounds: [number, number],
): RangeEdges {
  const min = edges.min ?? bounds[0];
  const max = edges.max ?? bounds[1];
  return side === "min"
    ? { ...edges, min: Math.min(value, max) }
    : { ...edges, max: Math.max(value, min) };
}

/**
 * Text written into a range field for a value: the shortest decimal form, with no exponent for
 * everyday magnitudes.
 * @param value - Edge value, or `undefined` when the edge follows the data.
 * @returns The field text ("" for `undefined`).
 */
export function rangeFieldText(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value)
    ? ""
    : String(Number(value.toPrecision(12)));
}
