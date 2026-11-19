/**
 * @module
 * Several fits over the points of one dataset (decision 0016): the fit entry type, restoring
 * saved state (older projects keep a single fit in the dataset itself), stable letters,
 * duplication, the colour and line pattern of each fit, and grouping for the comparison view.
 */

import type { ChartPoint } from "@/components/chart/Chart";
import { chartLinePatterns } from "@/components/chart/useChartSettings";
import { defaultFitConfig, type FitConfig } from "./fit-config";
import type { FitResponse } from "./fit-service";
import { formatSignificant } from "./result-format";

/** Line pattern name, as in the chart settings. */
export type LinePattern = keyof typeof chartLinePatterns;

/** One fit of a dataset: its configuration, how it is drawn and its latest outcome. */
export type FitEntry = FitConfig & {
  /** Unique within the dataset. */
  id: string;
  /** Stable letter (A, B, …); never reused in the dataset, even after a removal. */
  letter: string;
  /** Optional name typed by the user; the letter is shown when empty. */
  label: string;
  /** Whether the curve is drawn. The points belong to the dataset and stay visible. */
  visible: boolean;
  linePoints: ChartPoint[];
  fitState: "idle" | "mock" | "error";
  fitError?: string;
  result?: FitResponse;
};

/** The fits of one dataset, with the fit being edited and the letter counter. */
export type DatasetFits = {
  fits: FitEntry[];
  /** Fit whose controls are open and whose residuals are drawn. */
  activeFitId: string;
  /** How many letters were handed out; the next fit gets letter number `fitCounter`. */
  fitCounter: number;
};

const FIT_CONFIG_KEYS = Object.keys(defaultFitConfig) as (keyof FitConfig)[];
const LINE_PATTERNS = Object.keys(chartLinePatterns) as LinePattern[];

/**
 * Letter of the n-th fit of a dataset, spreadsheet style: A…Z, then AA, AB…
 * @param index - Zero-based position in creation order.
 * @returns The letter.
 * @example
 * fitLetter(0); // "A"
 * fitLetter(26); // "AA"
 */
export function fitLetter(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

/**
 * Creates a fit with the default configuration and no result.
 * @param id - Identifier, unique within the dataset.
 * @param letter - Stable letter.
 * @param config - Configuration to start from.
 * @returns The new fit.
 */
export function createFit(id: string, letter: string, config: Partial<FitConfig> = {}): FitEntry {
  return {
    ...defaultFitConfig,
    ...pickConfig(config),
    id,
    letter,
    label: "",
    visible: true,
    linePoints: [],
    fitState: "idle",
  };
}

function pickConfig(source: Partial<Record<string, unknown>>): Partial<FitConfig> {
  const config: Partial<Record<keyof FitConfig, unknown>> = {};
  for (const key of FIT_CONFIG_KEYS)
    if (typeof source[key] === typeof defaultFitConfig[key]) config[key] = source[key];
  return config as Partial<FitConfig>;
}

function restoreFit(raw: unknown, index: number): FitEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const saved = raw as Record<string, unknown>;
  const fit = createFit(
    typeof saved.id === "string" && saved.id ? saved.id : `fit-${index}`,
    typeof saved.letter === "string" && saved.letter ? saved.letter : fitLetter(index),
    pickConfig(saved),
  );
  if (typeof saved.label === "string") fit.label = saved.label;
  if (typeof saved.visible === "boolean") fit.visible = saved.visible;
  if (Array.isArray(saved.linePoints)) fit.linePoints = saved.linePoints as ChartPoint[];
  if (saved.fitState === "mock" || saved.fitState === "error") fit.fitState = saved.fitState;
  if (typeof saved.fitError === "string") fit.fitError = saved.fitError;
  if (saved.result && typeof saved.result === "object") fit.result = saved.result as FitResponse;
  return fit;
}

/**
 * Restores the fits of a saved dataset. Projects saved before decision 0016 keep one fit in
 * the dataset state itself (`equation`, `parameters`, `minX`…, `result`); they become fit A,
 * with nothing lost. Unknown or malformed entries are skipped, and an empty list gets fit A.
 * @param state - The saved dataset state (any shape).
 * @returns The fits, the active fit and the letter counter.
 */
export function restoreDatasetFits(state: unknown): DatasetFits {
  const saved = (state && typeof state === "object" ? state : {}) as Record<string, unknown>;
  const fits = Array.isArray(saved.fits)
    ? saved.fits.flatMap((raw, index) => restoreFit(raw, index) ?? [])
    : [];
  if (fits.length === 0) fits.push(restoreFit({ ...saved, id: "fit-0", letter: "A" }, 0)!);
  // The first fit is also mirrored in the legacy fields. A version without multiple fits edits
  // only those fields (and carries `fits` along unchanged), so they win: identical when this
  // version wrote them, newer when an older one did.
  else if (typeof saved.equation === "string") {
    const mirror = restoreFit({ ...saved, id: fits[0].id, letter: fits[0].letter }, 0)!;
    fits[0] = { ...mirror, label: fits[0].label, visible: fits[0].visible };
  }
  // Duplicate ids or letters would make two fits indistinguishable; renumber the later ones.
  const ids = new Set<string>();
  const letters = new Set<string>();
  let counter = Math.max(
    typeof saved.fitCounter === "number" && Number.isInteger(saved.fitCounter)
      ? saved.fitCounter
      : 0,
    fits.length,
  );
  for (const fit of fits) {
    if (ids.has(fit.id)) fit.id = `${fit.id}-${ids.size}`;
    ids.add(fit.id);
    while (letters.has(fit.letter)) fit.letter = fitLetter(counter++);
    letters.add(fit.letter);
  }
  const active =
    typeof saved.activeFitId === "string" && ids.has(saved.activeFitId)
      ? saved.activeFitId
      : fits[0].id;
  return { fits, activeFitId: active, fitCounter: counter };
}

/**
 * State saved for the fits of a dataset. Fit A is also written in the legacy fields, so a
 * version without decision 0016 still opens the project with its first fit.
 * @param fits - The fits of the dataset.
 * @returns Plain data to merge into the dataset state.
 */
export function serializeDatasetFits({ fits, activeFitId, fitCounter }: DatasetFits) {
  const first = fits[0];
  return {
    ...Object.fromEntries(FIT_CONFIG_KEYS.map((key) => [key, first[key]])),
    linePoints: first.linePoints,
    fitState: first.fitState,
    fitError: first.fitError,
    result: first.result,
    fits,
    activeFitId,
    fitCounter,
  };
}

/**
 * Copies a fit with a new id and letter. The configuration, visibility and, since the
 * configuration is identical, the result are kept; the label is not, so the copy shows its
 * letter.
 * @param source - Fit to copy.
 * @param id - Identifier of the copy.
 * @param letter - Letter of the copy.
 * @returns The copy.
 */
export function duplicateFit(source: FitEntry, id: string, letter: string): FitEntry {
  return { ...source, id, letter, label: "", visible: true };
}

/**
 * Line pattern of a fit. Fit A uses the dataset pattern; the others cycle through the remaining
 * patterns, so a fit never depends on colour alone. The pattern follows the letter, so a fit
 * keeps its look when another one is removed.
 * @param base - Pattern chosen for the dataset.
 * @param letter - Letter of the fit.
 * @returns The pattern name.
 */
export function fitLinePattern(base: LinePattern, letter: string): LinePattern {
  const index = letterIndex(letter);
  if (index <= 0) return base;
  const others = LINE_PATTERNS.filter((pattern) => pattern !== base);
  return others[(index - 1) % others.length];
}

function letterIndex(letter: string): number {
  return [...letter].reduce((n, char) => n * 26 + (char.charCodeAt(0) - 64), 0) - 1;
}

/** Mixes of the dataset colour for fits after the first: [target, share of target]. */
const SHADES: [string, number][] = [
  ["#ffffff", 0.38],
  ["#20272c", 0.3],
  ["#ffffff", 0.58],
  ["#20272c", 0.48],
];

/**
 * Curve colour of a fit: the dataset colour for fit A, and lighter or darker shades of it for
 * the others, so every curve still reads as part of its dataset.
 * @param base - Dataset colour as #rgb or #rrggbb; other formats are returned unchanged.
 * @param letter - Letter of the fit.
 * @returns The colour (#rrggbb for a mixed shade).
 */
export function fitColor(base: string, letter: string): string {
  const rgb = parseHex(base);
  const index = letterIndex(letter);
  if (index <= 0 || !rgb) return base;
  const [target, share] = SHADES[(index - 1) % SHADES.length];
  const to = parseHex(target)!;
  return `#${rgb
    .map((c, i) =>
      Math.round(c + (to[i] - c) * share)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function parseHex(color: string): number[] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/**
 * Name of a fit in the results and the legend: the dataset name alone while it has one fit,
 * then `"<dataset> · <label or letter>"`.
 * @param datasetName - Name of the dataset.
 * @param fit - The fit.
 * @param multiple - Whether the dataset has more than one fit.
 * @returns The name.
 */
export function fitDisplayName(datasetName: string, fit: FitEntry, multiple: boolean): string {
  return multiple ? `${datasetName} · ${fit.label.trim() || fit.letter}` : datasetName;
}

/**
 * Text of the X range of a fit, as typed: "todos os pontos", "x ≥ 2", "x ≤ 5" or "2 a 5".
 * @param fit - Configuration with the range strings.
 * @returns The description.
 */
export function describeRange({ minX, maxX }: Pick<FitConfig, "minX" | "maxX">): string {
  const min = minX.trim().replace(".", ",");
  const max = maxX.trim().replace(".", ",");
  if (min && max) return `${min} a ${max}`;
  if (min) return `x ≥ ${min}`;
  if (max) return `x ≤ ${max}`;
  return "todos os pontos";
}

/** Rows of the comparison view for the fits that share one equation. */
export type ParameterGroup = {
  /** Equation as typed by the first fit of the group. */
  equation: string;
  /** Fits with this equation, in list order. */
  fitIds: string[];
  /** Free parameter names, in the order the results list them. */
  parameters: string[];
};

/**
 * Groups fits by equation for the comparison table. Parameter rows line up only inside a
 * group: `a` in `a*x+b` and `a` in `a*exp(-x/t)` are different quantities.
 * @param fits - Fits of one dataset; only those with a result contribute parameter names.
 * @returns One group per distinct equation (spaces ignored), in order of first appearance.
 */
export function groupParametersByEquation(fits: FitEntry[]): ParameterGroup[] {
  const groups = new Map<string, ParameterGroup>();
  for (const fit of fits) {
    if (!fit.equation.trim()) continue;
    const key = fit.equation.replace(/\s+/g, "");
    const group = groups.get(key) ?? { equation: fit.equation.trim(), fitIds: [], parameters: [] };
    group.fitIds.push(fit.id);
    for (const p of fit.result?.parameters ?? [])
      if (!group.parameters.includes(p.name)) group.parameters.push(p.name);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Short status of a fit for its closed row: Chi² (or the sum of squared residuals when the
 * points have no uncertainty, as in decision 0009), "Falhou", or a dash.
 * @param fit - The fit.
 * @returns The status text and whether it is a failure.
 */
export function fitStatus(fit: FitEntry): { text: string; failed: boolean } {
  if (fit.fitState === "error") return { text: "Falhou", failed: true };
  if (!fit.result) return { text: "—", failed: false };
  const value = formatSignificant(fit.result.chiSquared, 3);
  return { text: fit.result.hasUncertainty ? `χ² ${value}` : `Σr² ${value}`, failed: false };
}
