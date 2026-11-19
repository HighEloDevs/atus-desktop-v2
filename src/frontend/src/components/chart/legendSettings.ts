/**
 * @module
 * Legend presentation settings beyond visibility, orientation and position (which
 * keep their own fields): content, columns, box and sizes.
 */

/** Background of the legend box. */
export type LegendBackground = "none" | "light" | "solid";

/** Legend settings edited in the legend popover. */
export type LegendStyle = {
  /** Optional title above the items; empty for none. */
  title: string;
  /** Show a sample of each series' fitted line next to its marker. */
  fitLine: boolean;
  /** Show each series' fitted equation, with its parameters, after the name. */
  equation: boolean;
  /** Items per row in the horizontal orientation; 0 lets them wrap freely. */
  columns: number;
  /** Box background. */
  background: LegendBackground;
  /** Box border. */
  border: boolean;
  /** Text size, in pixels. */
  fontSize: number;
  /** Marker radius, in pixels. */
  markerSize: number;
};

/** Defaults; they reproduce the legend before these settings existed. */
export const LEGEND_DEFAULTS: LegendStyle = {
  title: "",
  fitLine: false,
  equation: false,
  columns: 0,
  background: "light",
  border: false,
  fontSize: 11,
  markerSize: 4,
};

/** Inclusive bounds of the numeric legend settings. */
export const LEGEND_BOUNDS = {
  columns: [0, 4],
  fontSize: [8, 24],
  markerSize: [2, 10],
} as const satisfies Partial<Record<keyof LegendStyle, readonly [number, number]>>;

/** Legend position the sidebar has always used: right border, vertically centered. */
export const LEGEND_DEFAULT_POSITION = { x: 1, y: 0.5 };

/**
 * Builds the legend style from a persisted value; missing fields take the default.
 * @param saved - Persisted legend style, if any.
 * @returns A complete legend style.
 */
export function restoreLegendStyle(saved: Partial<LegendStyle> | undefined): LegendStyle {
  return { ...LEGEND_DEFAULTS, ...saved };
}

/**
 * Clamps a numeric legend setting to its bounds and rounds it to an integer.
 * @param key - Bounded setting.
 * @param value - Requested value.
 * @returns The value inside the bounds; non-finite input falls back to the default.
 */
export function clampLegendValue(key: keyof typeof LEGEND_BOUNDS, value: number): number {
  const [low, high] = LEGEND_BOUNDS[key];
  if (!Number.isFinite(value)) return LEGEND_DEFAULTS[key];
  return Math.max(low, Math.min(high, Math.round(value)));
}

/**
 * Tells which cell of the 3 × 3 corner grid a position matches, if any.
 * @param position - Legend position as fractions of the plot (0 to 1).
 * @returns The matching anchor, or null when the legend was dragged elsewhere.
 */
export function legendAnchor(position: { x: number; y: number }): { x: number; y: number } | null {
  const snap = (value: number) =>
    [0, 0.5, 1].find((anchor) => Math.abs(anchor - value) < 1e-6) ?? null;
  const x = snap(position.x);
  const y = snap(position.y);
  return x === null || y === null ? null : { x, y };
}
