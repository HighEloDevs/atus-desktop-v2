/**
 * @module
 * Locale-aware number formatting for the data table.
 */

/**
 * Formats a number with the most digits that preserve its exact value.
 *
 * Uses the shortest decimal string that round-trips the IEEE 754 double (up to 17 significant
 * digits), with a decimal comma (pt-BR) and no thousands separator, which would be ambiguous
 * next to decimal commas. Very large or small magnitudes use scientific notation
 * (for example `6,62607015e−34`) with a real minus sign.
 *
 * @param value - Finite number to format.
 * @returns The formatted text; `NaN` and infinities are returned as `String(value)`.
 * @example
 * formatFullPrecision(0.30000000000000004); // "0,30000000000000004"
 * formatFullPrecision(6.62607015e-34); // "6,62607015e−34"
 */
export function formatFullPrecision(value: number): string {
  return String(value).replace(".", ",").replace("e-", "e−").replace("e+", "e");
}
