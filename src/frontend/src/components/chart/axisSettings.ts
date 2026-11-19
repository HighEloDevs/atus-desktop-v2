/**
 * @module
 * Per-axis chart settings: defaults, legacy migration, tick generation, tick label
 * formatting, validation, and the layout estimates the chart margins depend on.
 */

import { tickStep } from "d3";
import { formatSignificant, superscript } from "@/features/analysis/fit/result-format";
import { formatTick } from "./residuals";

/** Which chart axis a setting belongs to; `residual` is the Y axis of the residuals panel. */
export type AxisKey = "x" | "y" | "residual";
/** Where tick marks point relative to the plot. */
export type TickDirection = "out" | "in" | "cross";
/** How tick labels are written. */
export type TickFormat = "auto" | "decimal" | "scientific";
/** Rotation of the X tick labels, in degrees counterclockwise. */
export type TickRotation = 0 | 45 | 90;

/** Every setting of one chart axis. Limits are kept as typed text; empty means automatic. */
export type AxisSettings = {
  /** Lower limit as typed; empty for automatic. */
  min: string;
  /** Upper limit as typed; empty for automatic. */
  max: string;
  /** Logarithmic scale. */
  log: boolean;
  /** Values grow toward the left (X) or downward (Y). */
  invert: boolean;
  /** Draw the axis line on the plot border instead of through zero. */
  edge: boolean;
  /** Automatic tick count or a fixed step between ticks. */
  spacing: "auto" | "step";
  /** Approximate number of major ticks in automatic spacing. */
  ticks: number;
  /** Fixed step between major ticks, as typed. */
  step: string;
  /** Minor ticks between two major ticks. */
  minor: number;
  /** Direction of the tick marks. */
  tickDirection: TickDirection;
  /** Major grid lines. */
  grid: boolean;
  /** Minor grid lines (needs `minor` > 0). */
  minorGrid: boolean;
  /** Tick label format. */
  format: TickFormat;
  /** Decimal places for the decimal and scientific formats. */
  decimals: number;
  /** Tick label font size, in pixels. */
  fontSize: number;
  /** Axis title font size, in pixels. */
  titleSize: number;
  /** Tick label rotation, counterclockwise; 90° turns Y labels vertical. */
  rotation: TickRotation;
  /** Axis title rotation; only the Y axes use it (90° reads bottom to top). */
  titleRotation: 0 | 90;
};

/** Settings of a fresh axis; they reproduce the chart before per-axis settings existed. */
export const AXIS_DEFAULTS: AxisSettings = {
  min: "",
  max: "",
  log: false,
  invert: false,
  edge: false,
  spacing: "auto",
  ticks: 5,
  step: "",
  minor: 0,
  tickDirection: "out",
  grid: true,
  minorGrid: false,
  format: "auto",
  decimals: 2,
  fontSize: 10,
  titleSize: 11,
  rotation: 0,
  titleRotation: 0,
};

/**
 * Defaults of one axis. The residuals panel is short, so its axis starts with fewer
 * divisions.
 * @param axis - Axis.
 * @returns A fresh settings object.
 */
export function axisDefaults(axis: AxisKey): AxisSettings {
  return axis === "residual" ? { ...AXIS_DEFAULTS, ticks: 3 } : { ...AXIS_DEFAULTS };
}

/** Inclusive bounds of the numeric settings, shared by the popover and the sidebar. */
export const AXIS_BOUNDS = {
  ticks: [2, 20],
  minor: [0, 9],
  decimals: [0, 6],
  fontSize: [6, 24],
  titleSize: [8, 48],
} as const satisfies Partial<Record<keyof AxisSettings, readonly [number, number]>>;

/** Settings that "Copiar estilo" carries to the other axis (no limits, scale, or spacing). */
export const AXIS_STYLE_KEYS = [
  "minor",
  "tickDirection",
  "grid",
  "minorGrid",
  "format",
  "decimals",
  "fontSize",
  "titleSize",
] as const satisfies readonly (keyof AxisSettings)[];

/** Upper bound of generated ticks, so a tiny step cannot freeze the chart. */
export const MAX_TICKS = 200;

/** Settings saved before per-axis objects existed. */
export type LegacyAxisValues = {
  xMin?: string;
  xMax?: string;
  yMin?: string;
  yMax?: string;
  xLog?: boolean;
  yLog?: boolean;
  ticks?: number;
  grid?: boolean;
  residualYMin?: string;
  residualYMax?: string;
};

/**
 * Clamps a numeric setting to its bounds and rounds it to an integer.
 * @param key - Bounded setting.
 * @param value - Requested value.
 * @returns The value inside the bounds; non-finite input falls back to the default.
 * @example
 * clampAxisValue("ticks", 40); // 20
 */
export function clampAxisValue(key: keyof typeof AXIS_BOUNDS, value: number): number {
  const [low, high] = AXIS_BOUNDS[key];
  if (!Number.isFinite(value)) return AXIS_DEFAULTS[key];
  return Math.max(low, Math.min(high, Math.round(value)));
}

/**
 * Builds an axis from a persisted value, falling back to the legacy flat fields.
 *
 * A saved per-axis object wins. Without one, limits, log scale, tick count and grid
 * come from the legacy fields, and everything else takes its default. The residual
 * axis only had limits and followed the shared grid switch.
 * @param axis - Axis to build.
 * @param saved - Persisted per-axis object, if any.
 * @param legacy - Legacy flat values of the chart.
 * @returns A complete axis.
 */
export function restoreAxis(
  axis: AxisKey,
  saved: Partial<AxisSettings> | undefined,
  legacy: LegacyAxisValues = {},
): AxisSettings {
  if (saved) return { ...axisDefaults(axis), ...saved };
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  if (axis === "residual")
    return {
      ...axisDefaults("residual"),
      min: pick(legacy.residualYMin, ""),
      max: pick(legacy.residualYMax, ""),
      grid: pick(legacy.grid, true),
    };
  return {
    ...AXIS_DEFAULTS,
    min: pick(axis === "x" ? legacy.xMin : legacy.yMin, ""),
    max: pick(axis === "x" ? legacy.xMax : legacy.yMax, ""),
    log: pick(axis === "x" ? legacy.xLog : legacy.yLog, false),
    ticks: legacy.ticks === undefined ? AXIS_DEFAULTS.ticks : clampAxisValue("ticks", legacy.ticks),
    grid: pick(legacy.grid, true),
  };
}

/**
 * Counts the settings that differ from the defaults.
 * @param settings - Axis settings.
 * @returns How many settings were changed.
 */
export function changedAxisSettings(settings: AxisSettings): number {
  return (Object.keys(AXIS_DEFAULTS) as (keyof AxisSettings)[]).filter(
    (key) => settings[key] !== AXIS_DEFAULTS[key],
  ).length;
}

const parse = (text: string) => (text.trim() === "" ? null : Number(text));

/**
 * Explains why the typed limits cannot be used, if they cannot.
 * @param settings - Axis settings with the typed limits.
 * @returns A message for the user, or null when the limits are usable.
 */
export function axisLimitsError(settings: AxisSettings): string | null {
  const low = parse(settings.min);
  const high = parse(settings.max);
  if (settings.log && ((low !== null && low <= 0) || (high !== null && high <= 0)))
    return "Na escala log, os limites precisam ser maiores que zero.";
  if (low !== null && high !== null && Number.isFinite(low) && Number.isFinite(high) && low >= high)
    return "O mínimo precisa ser menor que o máximo.";
  return null;
}

/**
 * Explains why the fixed step cannot be used over the visible range, if it cannot.
 * @param settings - Axis settings with the typed step.
 * @param domain - Visible data range.
 * @returns A message for the user, or null when the step is usable or unused.
 */
export function axisStepError(settings: AxisSettings, domain: [number, number]): string | null {
  if (settings.log || settings.spacing !== "step" || settings.step.trim() === "") return null;
  const step = Number(settings.step);
  if (!Number.isFinite(step) || step <= 0) return "Use um passo maior que zero.";
  if (Math.abs(domain[1] - domain[0]) / step > MAX_TICKS)
    return "Passo pequeno demais para o intervalo.";
  return null;
}

/** The part of a D3 scale the tick generators need. */
export type TickScale = { domain(): number[]; ticks(count?: number): number[] };

/** Multiples of `step` inside [low, high], at most {@link MAX_TICKS} of them. */
function multiples(low: number, high: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(low / step - 1e-9);
  for (let i = first; i * step <= high + step * 1e-9 && out.length < MAX_TICKS; i++)
    out.push(Math.abs(i * step) < step * 1e-9 ? 0 : i * step);
  return out;
}

const sortedDomain = (scale: TickScale): [number, number] => {
  const [a, b] = scale.domain();
  return a <= b ? [a, b] : [b, a];
};

/**
 * Major tick values over the scale's current (zoomed) domain.
 * @param scale - Linear or log scale.
 * @param settings - Axis settings.
 * @returns Tick values in ascending order.
 * @example
 * majorTicks(scaleLinear().domain([0, 1]), { ...AXIS_DEFAULTS, spacing: "step", step: "0.25" });
 * // [0, 0.25, 0.5, 0.75, 1]
 */
export function majorTicks(scale: TickScale, settings: AxisSettings): number[] {
  const domain = sortedDomain(scale);
  if (!settings.log && settings.spacing === "step" && !axisStepError(settings, domain)) {
    const step = Number(settings.step);
    if (step > 0) return multiples(domain[0], domain[1], step);
  }
  return [...scale.ticks(settings.ticks)].sort((a, b) => a - b);
}

/**
 * Minor tick values between the major ticks.
 *
 * On a linear scale each major interval is split into `minor + 1` parts. On a log scale
 * the minor ticks are the integer multiples of each decade that are not major ticks.
 * @param scale - Linear or log scale.
 * @param settings - Axis settings.
 * @param majors - Major tick values from {@link majorTicks}.
 * @returns Minor tick values, without the major ones.
 */
export function minorTicks(scale: TickScale, settings: AxisSettings, majors: number[]): number[] {
  if (settings.minor <= 0) return [];
  const [low, high] = sortedDomain(scale);
  const isMajor = (value: number, tolerance: number) =>
    majors.some((major) => Math.abs(major - value) <= tolerance);
  if (settings.log) {
    const out: number[] = [];
    for (let k = Math.floor(Math.log10(low)); k <= Math.ceil(Math.log10(high)); k++)
      for (let m = 1; m <= 9; m++) {
        const value = m * 10 ** k;
        if (value >= low && value <= high && !isMajor(value, value * 1e-9)) out.push(value);
      }
    return out.slice(0, MAX_TICKS);
  }
  const step = majors.length > 1 ? majors[1] - majors[0] : tickStep(low, high, settings.ticks);
  if (!(step > 0)) return [];
  const sub = step / (settings.minor + 1);
  return multiples(low, high, sub).filter((value) => !isMajor(value, sub * 1e-6));
}

/**
 * Writes a tick label in the chosen format, with a decimal comma.
 * @param value - Tick value.
 * @param settings - Axis settings (format and decimals).
 * @returns The label text.
 * @example
 * formatAxisTick(1500, { ...AXIS_DEFAULTS, format: "scientific", decimals: 1 }); // "1,5×10³"
 */
export function formatAxisTick(value: number, settings: AxisSettings): string {
  if (settings.format === "decimal")
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: settings.decimals,
      maximumFractionDigits: settings.decimals,
    }).format(value === 0 ? 0 : value);
  if (settings.format === "scientific") {
    if (value === 0) return "0";
    const [mantissa, exponent] = value.toExponential(settings.decimals).split("e");
    return `${mantissa.replace(".", ",")}×10${superscript(Number(exponent))}`;
  }
  return formatTick(value);
}

/**
 * Writes a residual tick label: the automatic format shows the sign ("+0,1", "−0,2").
 * @param value - Tick value.
 * @param settings - Residual axis settings.
 * @returns The label text.
 */
export function formatResidualTick(value: number, settings: AxisSettings): string {
  if (settings.format !== "auto") return formatAxisTick(value, settings);
  return value === 0 ? "0" : `${value > 0 ? "+" : "−"}${formatSignificant(Math.abs(value), 2)}`;
}

/**
 * Offsets of a tick mark from the axis line, measured outward from the plot.
 * @param direction - Tick direction.
 * @param length - Tick length in pixels.
 * @returns Start and end offsets (negative points into the plot).
 */
export function tickSpan(direction: TickDirection, length: number): [number, number] {
  if (direction === "in") return [-length, 0];
  if (direction === "cross") return [-length, length];
  return [0, length];
}

/**
 * Rough width of a tick label; the chart uses it to size its margins.
 * @param text - Label text.
 * @param fontSize - Font size in pixels.
 * @returns Estimated width in pixels.
 */
export function labelWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

/**
 * Horizontal room the Y tick labels need left of the axis, given their rotation.
 * @param labels - Label texts.
 * @param settings - Y axis settings (font size and rotation).
 * @returns Width in pixels.
 */
export function yLabelWidth(labels: string[], settings: AxisSettings): number {
  const widest = Math.max(0, ...labels.map((label) => labelWidth(label, settings.fontSize)));
  if (settings.rotation === 90) return settings.fontSize;
  if (settings.rotation === 45) return (widest + settings.fontSize) * Math.SQRT1_2;
  return widest;
}

/**
 * Vertical room the X tick labels need below the axis, given their rotation.
 * @param labels - Label texts.
 * @param settings - X axis settings (font size and rotation).
 * @returns Height in pixels.
 */
export function xLabelHeight(labels: string[], settings: AxisSettings): number {
  const widest = Math.max(0, ...labels.map((label) => labelWidth(label, settings.fontSize)));
  if (settings.rotation === 90) return widest;
  if (settings.rotation === 45) return (widest + settings.fontSize) * Math.SQRT1_2;
  return settings.fontSize;
}

/** Colors of the axis pieces; labels darken while their axis is highlighted. */
export const AXIS_COLORS = {
  label: "#78857d",
  labelHighlight: "#20272c",
  grid: "#e8ece7",
  minorGrid: "#eef1ec",
  line: "#aebbb0",
  lineHighlight: "#66716e",
  tick: "#aebbb0",
} as const;

/** Length, in pixels, of major and minor tick marks. */
export const TICK_LENGTH = { major: 5, minor: 3 } as const;

/**
 * Vertical room below the plot that the X tick labels need, before the axis title.
 * @param labels - X tick label texts.
 * @param settings - X axis settings.
 * @returns Height in pixels measured from the bottom border of the plot.
 */
export function xLabelSpace(labels: string[], settings: AxisSettings): number {
  return settings.rotation === 0
    ? 17 + settings.fontSize
    : 14 + Math.ceil(xLabelHeight(labels, settings));
}

/**
 * Horizontal gap between the plot border and the Y tick labels.
 * @param settings - Y axis settings.
 * @returns Gap in pixels; it clears outward tick marks.
 */
export function yLabelGap(settings: AxisSettings): number {
  return Math.max(8, tickSpan(settings.tickDirection, TICK_LENGTH.major)[1] + 5);
}
