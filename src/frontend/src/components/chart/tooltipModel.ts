/**
 * @module
 * Pure helpers behind the chart tooltip: value formatting, grouping of
 * coincident points, placement, keyboard order, and screen-reader text.
 */

/** A plotted point with the series identity and pixel position the tooltip needs. */
export type TooltipPoint = {
  seriesId: string;
  seriesName: string;
  color: string;
  symbol: string;
  /** One-based position of the point in its series data. */
  row: number;
  x: number;
  y: number;
  sx?: number;
  sy?: number;
  /** Horizontal pixel position relative to the chart container. */
  px: number;
  /** Vertical pixel position relative to the chart container. */
  py: number;
};

/** Axis names shown beside the tooltip values. */
export type TooltipLabels = { x: string; y: string };

/** Distance, in pixels, under which points are shown in the same tooltip. */
export const NEARBY_RADIUS = 7;
/** Gap, in pixels, between the anchor point and the tooltip. */
const ANCHOR_GAP = 14;
/** Minimum distance, in pixels, kept between the tooltip and the chart edges. */
const EDGE_GAP = 4;

const numberFormat = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 5 });
const superscripts: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/**
 * Formats a value for the tooltip with up to five significant digits.
 *
 * Magnitudes outside `[1e-4, 1e6)` use `m × 10ⁿ` so that very large or very
 * small values stay readable. Negative values use the typographic minus sign.
 * @param value - Number to format.
 * @returns The formatted text, or an em dash for non-finite values.
 * @example
 * formatTooltipValue(0.25); // "0,25"
 * formatTooltipValue(1.602176e-19); // "1,6022 × 10⁻¹⁹"
 */
export function formatTooltipValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  let text: string;
  if (magnitude >= 1e6 || magnitude < 1e-4) {
    const [mantissa, exponent] = value.toExponential(4).split("e");
    const power = [...String(Number(exponent))].map((digit) => superscripts[digit]).join("");
    text = `${numberFormat.format(Number(mantissa))} × 10${power}`;
  } else {
    text = numberFormat.format(value);
  }
  return text.replace("-", "−");
}

/**
 * Collects the points drawn on top of, or right next to, a target point.
 * @param points - Every plotted point, with pixel positions.
 * @param target - The point under the pointer or keyboard cursor.
 * @param radius - Maximum pixel distance to the target.
 * @returns The target first, followed by its neighbours in plotting order.
 */
export function groupNearbyPoints(
  points: TooltipPoint[],
  target: TooltipPoint,
  radius = NEARBY_RADIUS,
): TooltipPoint[] {
  const neighbours = points.filter(
    (point) => point !== target && Math.hypot(point.px - target.px, point.py - target.py) <= radius,
  );
  return [target, ...neighbours];
}

/**
 * Orders points for keyboard navigation: left to right, then top to bottom.
 * @param points - Plotted points with pixel positions.
 * @returns A new sorted array; the input is not modified.
 */
export function keyboardOrder(points: TooltipPoint[]): TooltipPoint[] {
  return [...points].sort((a, b) => a.px - b.px || a.py - b.py);
}

/**
 * Positions the tooltip beside its anchor without leaving the chart.
 *
 * The tooltip prefers the upper right of the anchor, flips to the left or
 * below when it would overflow, and is finally clamped to the bounds.
 * @param anchor - Pixel position of the active point.
 * @param size - Measured tooltip size.
 * @param bounds - Size of the chart container.
 * @returns The top-left corner of the tooltip, in container pixels.
 */
export function placeTooltip(
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  bounds: { width: number; height: number },
): { left: number; top: number } {
  let left = anchor.x + ANCHOR_GAP;
  if (left + size.width > bounds.width - EDGE_GAP) left = anchor.x - ANCHOR_GAP - size.width;
  let top = anchor.y - size.height - ANCHOR_GAP;
  if (top < EDGE_GAP) top = anchor.y + ANCHOR_GAP;
  return {
    left: Math.max(EDGE_GAP, Math.min(left, bounds.width - size.width - EDGE_GAP)),
    top: Math.max(EDGE_GAP, Math.min(top, bounds.height - size.height - EDGE_GAP)),
  };
}

/**
 * Describes the tooltip contents as plain text for assistive technology.
 * @param points - Points shown in the tooltip.
 * @param labels - Axis names; empty names fall back to `x` and `y`.
 * @returns One sentence per point, in Portuguese.
 */
export function describeTooltip(points: TooltipPoint[], labels: TooltipLabels): string {
  const part = (label: string, value: number, sigma?: number) =>
    `${label} ${formatTooltipValue(value)}${sigma === undefined ? "" : ` ± ${formatTooltipValue(sigma)}`}`;
  return points
    .map(
      (point) =>
        `${point.seriesName}, ponto ${point.row}: ${part(labels.x || "x", point.x, point.sx)}; ${part(labels.y || "y", point.y, point.sy)}`,
    )
    .join(". ");
}
