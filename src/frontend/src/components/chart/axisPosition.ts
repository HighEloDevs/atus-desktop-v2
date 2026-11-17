/**
 * @module
 * Pure helper that places the chart axes so they cross at the origin.
 */

/** Pixel position of the axes inside the plot area. */
export type AxisPosition = {
  /** Horizontal position of the Y axis, between 0 (left edge) and `width`. */
  x: number;
  /** Vertical position of the X axis, between 0 (top edge) and `height`. */
  y: number;
};

/**
 * Places the axes at the zero of each scale, forming a cross.
 *
 * An axis sticks to the nearest plot edge when its zero is outside the visible
 * range, so it never disappears. A logarithmic scale has no zero, so its axis
 * stays on the classic edge: left for Y and bottom for X.
 *
 * @param xPixel - Maps an X data value to its horizontal pixel position.
 * @param yPixel - Maps a Y data value to its vertical pixel position.
 * @param width - Plot area width in pixels.
 * @param height - Plot area height in pixels.
 * @param xLog - Whether the X scale is logarithmic.
 * @param yLog - Whether the Y scale is logarithmic.
 * @param edges - Axes pinned to the plot border by the user: `x` keeps the X axis at
 * the bottom and `y` keeps the Y axis at the left, wherever zero is.
 * @returns The Y axis horizontal position and the X axis vertical position.
 * @example
 * axisPosition((v) => 50 + v * 10, (v) => 100 - v * 10, 200, 100, false, false);
 * // => { x: 50, y: 100 }
 */
export function axisPosition(
  xPixel: (value: number) => number,
  yPixel: (value: number) => number,
  width: number,
  height: number,
  xLog: boolean,
  yLog: boolean,
  edges: { x?: boolean; y?: boolean } = {},
): AxisPosition {
  const place = (value: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;
  return {
    x: xLog || edges.y ? 0 : place(xPixel(0), width, 0),
    y: yLog || edges.x ? height : place(yPixel(0), height, height),
  };
}
