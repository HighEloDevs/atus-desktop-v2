/**
 * @module
 * Geometry shared by the instrument drawings and the loupe: SVG units per millimetre and
 * where each scale starts.
 */

/** Geometry of the ruler drawing, in SVG units. */
export const RULER = {
  /** Units per millimetre. */
  scale: 12,
  /** x of the zero line. */
  x0: 40,
  /** y of the scale edge, where the piece rests. */
  top: 96,
  viewBox: "0 0 800 170",
} as const;

/** Geometry of the caliper drawing, in SVG units. */
export const CALIPER = {
  /** Units per millimetre. */
  scale: 10,
  /** x of the fixed jaw face, the zero of the main scale. */
  x0: 70,
  /** y of the line where the main scale meets the vernier. */
  base: 120,
  /** Main scale length in millimetres. */
  scaleMm: 100,
  viewBox: "0 40 1100 270",
} as const;

/** Size of the loupe window, in SVG units (3 : 2). */
export const LENS = { width: 96, height: 64 } as const;

/** x of a ruler millimetre. */
export const rulerX = (mm: number) => RULER.x0 + mm * RULER.scale;
/** x of a caliper main-scale millimetre. */
export const caliperX = (mm: number) => CALIPER.x0 + mm * CALIPER.scale;

/**
 * Loupe window around a scale position.
 * @param instrument - Instrument drawn.
 * @param mm - Scale position at the centre, in millimetres.
 * @returns The window rectangle in SVG units.
 */
export function lensRect(instrument: "ruler" | "caliper", mm: number) {
  const x = (instrument === "ruler" ? rulerX(mm) : caliperX(mm)) - LENS.width / 2;
  const y = instrument === "ruler" ? RULER.top - 20 : CALIPER.base - 32;
  return { x, y, width: LENS.width, height: LENS.height };
}
