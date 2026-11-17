/**
 * @module
 * The fitted equation with its parameter values in place, for the chart legend.
 */

import { equationToLatex } from "./equation-to-latex";
import { roundToUncertainty } from "./result-format";

/** A fitted parameter as the fit service returns it. */
export type FittedParameter = { name: string; value: number; uncertainty: number };

/** LaTeX of one value, rounded to its uncertainty, with a decimal comma. */
function valueLatex({ value, uncertainty }: FittedParameter): string {
  const usable = Number.isFinite(uncertainty) && uncertainty > 0;
  const rounded = usable ? roundToUncertainty(value, uncertainty) : null;
  let mantissa: string;
  let exponent: number;
  if (rounded) {
    mantissa = rounded.value.replace(",", "{,}");
    exponent = rounded.exponent;
  } else {
    const [m, e] = value.toExponential(3).split("e");
    exponent = Math.abs(value) >= 1e-3 && Math.abs(value) < 1e6 ? 0 : Number(e);
    mantissa = (exponent ? m : String(Number(value.toPrecision(4)))).replace(".", "{,}");
  }
  const body = exponent ? `${mantissa} \\times 10^{${exponent}}` : mantissa;
  return exponent || value < 0 ? `\\left(${body}\\right)` : body;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Writes `f(x) = …` with the free parameters replaced by their fitted values.
 *
 * Values are rounded to their uncertainty, as in the result card. Parameters that are
 * not in the list (fixed ones) keep their symbol.
 * @param equation - Model expression in ATUS (mathjs) syntax.
 * @param parameters - Fitted free parameters.
 * @returns A KaTeX-ready fragment, or null for an empty equation.
 * @example
 * fittedEquationLatex("a*x+b", [{ name: "a", value: 2, uncertainty: 0.1 }, …]);
 * // "f(x) = 2{,}0 \\cdot x + …"
 */
export function fittedEquationLatex(
  equation: string,
  parameters: FittedParameter[],
): string | null {
  // Placeholders survive the LaTeX conversion untouched and are swapped afterwards.
  const placeholder = (index: number) => `PARAMETERVALUE${index}Z`;
  const ordered = parameters
    .map((parameter, index) => ({ parameter, index }))
    .sort((a, b) => b.parameter.name.length - a.parameter.name.length);
  let text = equation;
  for (const { parameter, index } of ordered)
    text = text.replace(
      new RegExp(`(?<![\\w.])${escape(parameter.name)}(?![\\w(])`, "g"),
      placeholder(index),
    );
  const base = equationToLatex(text);
  if (base === null) return null;
  const latex = parameters.reduce(
    (current, parameter, index) =>
      current.split(placeholder(index)).join(`{${valueLatex(parameter)}}`),
    base,
  );
  return `f(x) = ${latex}`;
}
