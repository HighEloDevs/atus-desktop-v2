/**
 * @module
 * Parsing of localized numeric input.
 */

// Matches a normalized numeric token: sign, digits with optional dot
// decimal, optional scientific notation exponent.
const NUMERIC_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Converts a numeric string to a number, accepting both decimal point
 * (en-US) and decimal comma (pt-BR), with optional thousands separators
 * and scientific notation.
 * @param value - Numeric token to parse.
 * @returns The numeric value, or NaN for malformed input.
 *
 * Disambiguation by the LAST occurrence of "," vs ".":
 * - "1.234,56" → pt-BR (dots = thousands, comma = decimal) → 1234.56
 * - "1,234.56" → en-US (commas = thousands, dot = decimal) → 1234.56
 * - "1,5"      → lone comma is treated as decimal (pt-BR data context)
 * - "1.5"      → unchanged
 */
export function parseLocaleNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return NaN;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1) {
    normalized = trimmed;
  } else if (lastDot === -1) {
    // Only commas: a single comma is the decimal separator; multiple commas
    // in one token are malformed (e.g. "1,5,6").
    if (trimmed.indexOf(",") !== lastComma) return NaN;
    normalized = trimmed.replace(",", ".");
  } else if (lastComma > lastDot) {
    // pt-BR: dots are thousands separators, comma is decimal
    if (trimmed.indexOf(",") !== lastComma) return NaN;
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    // en-US: commas are thousands separators, dot is decimal
    if (trimmed.indexOf(".") !== lastDot) return NaN;
    normalized = trimmed.replace(/,/g, "");
  }

  if (!NUMERIC_PATTERN.test(normalized)) return NaN;
  return parseFloat(normalized);
}
