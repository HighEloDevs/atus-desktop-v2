/**
 * @module
 * Parsing of pasted or imported text into points that a fit can use.
 */

import type { ChartPoint } from "@/components/chart/Chart";
import { textParser, type SeparatorType } from "./text-data-parser";

/** Parsed data that is readable but invalid, so a different separator cannot fix it. */
export class DataValidationError extends Error {}

/**
 * Parses text into points and checks that values and uncertainties are usable.
 * @param text - Delimited text.
 * @param separator - Selected or automatic separator.
 * @returns The parsed points.
 * @throws {DataValidationError} When values are not finite or uncertainties are negative.
 * @throws {Error} When the text cannot be parsed with the separator.
 * @example
 * parseValidPoints("1\t2\n2\t4", "auto"); // [{ x: 1, y: 2 }, { x: 2, y: 4 }]
 */
export function parseValidPoints(text: string, separator: SeparatorType): ChartPoint[] {
  const points = textParser.parse(text, { separator });
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.sx ?? 0) ||
        !Number.isFinite(p.sy ?? 0) ||
        (p.sx ?? 0) < 0 ||
        (p.sy ?? 0) < 0,
    )
  ) {
    throw new DataValidationError(
      "Os dados devem ser finitos e as incertezas não podem ser negativas.",
    );
  }
  return points;
}
