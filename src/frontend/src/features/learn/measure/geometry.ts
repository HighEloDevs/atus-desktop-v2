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

/** Geometry of the micrometer drawing, in SVG units. */
export const MICROMETER = {
  /** Units per millimetre along the axis. */
  scale: 24,
  /** x of the anvil face, where the piece rests. */
  anvil: 60,
  /** x of the sleeve zero line. */
  x0: 712,
  /** y of the axis and the sleeve reference line. */
  axis: 140,
  /** Radius of the thimble, which sets how its lines crowd towards the edges. */
  radius: 46,
  viewBox: "0 60 1660 230",
} as const;

/** Size of the loupe window, in SVG units (3 : 2). */
export const LENS = { width: 96, height: 64 } as const;

/** x of a ruler millimetre. */
export const rulerX = (mm: number) => RULER.x0 + mm * RULER.scale;
/** x of a micrometer sleeve millimetre. */
export const micrometerX = (mm: number) => MICROMETER.x0 + mm * MICROMETER.scale;
/** x of a caliper main-scale millimetre. */
export const caliperX = (mm: number) => CALIPER.x0 + mm * CALIPER.scale;

/**
 * Loupe window around a scale position.
 * @param instrument - Instrument drawn.
 * @param mm - Scale position at the centre, in millimetres.
 * @returns The window rectangle in SVG units.
 */
export function lensRect(instrument: "ruler" | "caliper" | "micrometer", mm: number) {
  const x =
    (instrument === "ruler"
      ? rulerX(mm)
      : instrument === "caliper"
        ? caliperX(mm)
        : micrometerX(mm)) -
    LENS.width / 2;
  const y =
    instrument === "ruler"
      ? RULER.top - 20
      : instrument === "caliper"
        ? CALIPER.base - 32
        : MICROMETER.axis - LENS.height / 2;
  return { x, y, width: LENS.width, height: LENS.height };
}
