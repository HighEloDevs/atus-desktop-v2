/**
 * @module
 * Pure helpers that format fit results for display and for the clipboard.
 *
 * Nothing here computes a fit statistic. The functions only round, label and
 * lay out values that the fit service already returned.
 */

const SUPERSCRIPT: Record<string, string> = {
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

const GREEK = new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "theta",
  "lambda",
  "mu",
  "nu",
  "pi",
  "rho",
  "sigma",
  "tau",
  "phi",
  "chi",
  "psi",
  "omega",
]);

/** Largest number of parameters a result card lists before collapsing the rest. */
export const CARD_PARAMETER_LIMIT = 4;

/** Parameter value and uncertainty rounded to the same decimal place. */
export type RoundedParameter = {
  /** Value text with a comma as the decimal separator. */
  value: string;
  /** Uncertainty text in the same decimal place as {@link RoundedParameter.value}. */
  uncertainty: string;
  /** Common power of ten factored out of both numbers (0 when none). */
  exponent: number;
};

/**
 * Converts an integer to Unicode superscript digits.
 * @param value - Integer exponent.
 * @returns The exponent written with superscript characters.
 * @example
 * superscript(-4); // "⁻⁴"
 */
export function superscript(value: number): string {
  return String(value)
    .split("")
    .map((char) => SUPERSCRIPT[char] ?? char)
    .join("");
}

/**
 * Formats a number with a decimal comma and a fixed count of significant digits.
 * Values outside [1e-3, 1e4) use scientific notation ("1,325×10⁻⁴").
 * @param value - Number to format.
 * @param significant - Significant digits to keep. Defaults to 4.
 * @returns The formatted text, or "–" for a missing or non-finite value.
 * @example
 * formatSignificant(0.00013251); // "1,325×10⁻⁴"
 */
export function formatSignificant(value: number | null | undefined, significant = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e4) {
    const [mantissa, exponent] = value.toExponential(significant - 1).split("e");
    return `${mantissa.replace(".", ",")}×10${superscript(Number(exponent))}`;
  }
  return Number(value.toPrecision(significant)).toString().replace(".", ",");
}

/**
 * Rounds a parameter to its uncertainty: one significant digit of uncertainty,
 * or two when the leading digit is 1 or 2, with the value in the same decimal place.
 * Very small or very large values factor out a common power of ten.
 * @param value - Fitted parameter value.
 * @param uncertainty - Parameter uncertainty (non-negative).
 * @returns Rounded texts and the factored exponent. An unusable uncertainty falls
 * back to {@link formatSignificant} for both numbers.
 * @example
 * roundToUncertainty(4.8213, 0.0702); // { value: "4,82", uncertainty: "0,07", exponent: 0 }
 */
export function roundToUncertainty(value: number, uncertainty: number): RoundedParameter {
  if (!Number.isFinite(value) || !Number.isFinite(uncertainty) || uncertainty <= 0) {
    return {
      value: formatSignificant(value),
      uncertainty: formatSignificant(Number.isFinite(uncertainty) ? uncertainty : null),
      exponent: 0,
    };
  }
  const abs = Math.abs(value);
  const exponent = abs !== 0 && (abs < 1e-3 || abs >= 1e6) ? Math.floor(Math.log10(abs)) : 0;
  const scale = 10 ** exponent;
  const v = value / scale;
  const u = uncertainty / scale;
  const magnitude = Math.floor(Math.log10(u));
  const lead = Math.floor(u / 10 ** magnitude + 1e-9);
  const significant = lead <= 2 ? 2 : 1;
  const decimals = Math.max(significant - 1 - magnitude, 0);
  return {
    value: v.toFixed(decimals).replace(".", ","),
    uncertainty: u.toFixed(decimals).replace(".", ","),
    exponent,
  };
}

/**
 * Writes a rounded parameter as plain text.
 * @param parameter - Output of {@link roundToUncertainty}.
 * @returns "4,82 ± 0,07", or "(1,2 ± 0,3)×10⁻⁴" when an exponent was factored out.
 */
export function parameterToText(parameter: RoundedParameter): string {
  const body = `${parameter.value} ± ${parameter.uncertainty}`;
  return parameter.exponent ? `(${body})×10${superscript(parameter.exponent)}` : body;
}

/**
 * Derives the correlation matrix from a covariance matrix.
 * @param covariance - Square covariance matrix.
 * @returns The correlation matrix; entries whose variance is zero are NaN.
 */
export function correlationFromCovariance(covariance: number[][]): number[][] {
  return covariance.map((row, i) =>
    row.map((value, j) => {
      const scale = Math.sqrt(covariance[i][i] * covariance[j][j]);
      return i === j && scale > 0 ? 1 : value / scale;
    }),
  );
}

/**
 * Builds a LaTeX `pmatrix` for pasting into documents.
 * @param matrix - Square matrix of numbers.
 * @param significant - Significant digits per entry. Defaults to 4.
 * @returns LaTeX source with a decimal comma written as `{,}`.
 */
export function matrixToLatex(matrix: number[][], significant = 4): string {
  const cell = (value: number) => {
    if (!Number.isFinite(value)) return "\\text{–}";
    if (value === 0) return "0";
    const abs = Math.abs(value);
    if (abs < 1e-3 || abs >= 1e4) {
      const [mantissa, exponent] = value.toExponential(significant - 1).split("e");
      return `${mantissa.replace(".", "{,}")} \\times 10^{${Number(exponent)}}`;
    }
    return Number(value.toPrecision(significant)).toString().replace(".", "{,}");
  };
  return `\\begin{pmatrix}\n${matrix.map((row) => `  ${row.map(cell).join(" & ")}`).join(" \\\\\n")}\n\\end{pmatrix}`;
}

/** Column separators offered when copying parameters, as in ATUS V1. */
export const COPY_SEPARATORS = {
  Tabulação: "\t",
  Espaço: " ",
  ";": ";",
  ",": ",",
  "|": "|",
} as const;

/** Options for {@link parametersToClipboardText}. */
export type CopyOptions = {
  separator: keyof typeof COPY_SEPARATORS;
  decimal: "Ponto" | "Vírgula";
  header: boolean;
};

/**
 * Builds the clipboard text for the fitted parameters, like the V1 copy action:
 * full-precision values, a chosen separator and decimal mark, optional header.
 * @param parameters - Parameters to copy.
 * @param options - Separator, decimal mark and header choice.
 * @returns Text with one parameter per line.
 */
export function parametersToClipboardText(
  parameters: { name: string; value: number; uncertainty: number }[],
  options: CopyOptions,
): string {
  const separator = COPY_SEPARATORS[options.separator];
  const number = (value: number) =>
    options.decimal === "Vírgula" ? String(value).replace(".", ",") : String(value);
  const lines = parameters.map((p) =>
    [p.name, number(p.value), number(p.uncertainty)].join(separator),
  );
  return (options.header ? [["", "Valor", "Incerteza"].join(separator), ...lines] : lines).join(
    "\n",
  );
}

/**
 * Converts a parameter name to a LaTeX fragment: Greek names become symbols and
 * trailing digits become subscripts.
 * @param name - Parameter name such as "tau", "V0" or "V_0".
 * @returns A KaTeX-ready fragment.
 * @example
 * parameterToLatex("V0"); // "V_{0}"
 */
export function parameterToLatex(name: string): string {
  const match = /^([A-Za-z]+)_?(\d+)$/.exec(name);
  const base = match ? match[1] : name;
  const symbol = GREEK.has(base.toLowerCase()) ? `\\${base.toLowerCase()}` : base;
  return match ? `${symbol}_{${match[2]}}` : symbol;
}

/**
 * Picks a symmetric residual axis with round limits.
 * @param residuals - Residual values.
 * @returns The axis limit and its tick values (top, half, zero, and mirrored).
 */
export function residualAxis(residuals: number[]): { limit: number; ticks: number[] } {
  const largest = Math.max(0, ...residuals.map((value) => Math.abs(value)));
  if (!Number.isFinite(largest) || largest === 0) return { limit: 1, ticks: [1, 0.5, 0, -0.5, -1] };
  const step = 10 ** Math.floor(Math.log10(largest));
  const limit = (Math.ceil((largest / step) * 2) / 2) * step;
  return { limit, ticks: [limit, limit / 2, 0, -limit / 2, -limit] };
}

const COBALT = "#364cff";
const CORAL = "#f25a3c";

/**
 * Background that paints a correlation cell: cobalt for positive, coral for negative,
 * with intensity proportional to the magnitude.
 * @param value - Correlation in [-1, 1].
 * @returns A CSS color, or undefined when the value is not finite.
 */
export function heatColor(value: number): string | undefined {
  if (!Number.isFinite(value)) return undefined;
  const intensity = Math.round(Math.min(Math.abs(value), 1) * 62);
  return `color-mix(in srgb, ${value < 0 ? CORAL : COBALT} ${intensity}%, white)`;
}
