/**
 * @module
 * Cell ranges of the simulated spreadsheet used by lessons.
 *
 * Row 0 is the header; rows 1..n hold the data. Columns are 0-based (A = 0).
 */

/** A rectangular selection, with corners in any order. */
export type SheetRange = { r0: number; c0: number; r1: number; c1: number };

/** Normalized bounds of a range. */
export function bounds(range: SheetRange) {
  return {
    top: Math.min(range.r0, range.r1),
    bottom: Math.max(range.r0, range.r1),
    left: Math.min(range.c0, range.c1),
    right: Math.max(range.c0, range.c1),
  };
}

/**
 * Tells whether a cell is inside a range.
 * @param range - Selection, or null for none.
 * @returns True when the cell is selected.
 */
export function contains(range: SheetRange | null, row: number, column: number): boolean {
  if (!range) return false;
  const b = bounds(range);
  return row >= b.top && row <= b.bottom && column >= b.left && column <= b.right;
}

/**
 * Tells whether a selection holds every data row and exactly the lesson's columns.
 * The header row may be included or not.
 * @param range - Selection.
 * @param dataRows - Number of data rows below the header.
 * @param columns - Number of columns the lesson needs (x, y and σy).
 */
export function coversData(range: SheetRange | null, dataRows: number, columns: number): boolean {
  if (!range) return false;
  const b = bounds(range);
  return b.top <= 1 && b.bottom === dataRows && b.left === 0 && b.right === columns - 1;
}

/**
 * Writes the cell under a 0-based position the way a spreadsheet names it.
 * @example
 * cellName(0, 1); // "B1"
 */
export function cellName(row: number, column: number): string {
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

/**
 * Formats a number as a Brazilian spreadsheet shows it, with a decimal comma.
 * @param value - Cell value.
 */
export function cellText(value: number): string {
  return String(value).replace(".", ",");
}

/**
 * Builds the text a spreadsheet puts in the clipboard: tabs between cells, one line per row.
 * @param header - Column titles (row 0).
 * @param rows - Data rows (rows 1..n).
 * @param range - Selection to copy.
 * @returns The copied text.
 */
export function rangeToTsv(header: string[], rows: number[][], range: SheetRange): string {
  const b = bounds(range);
  const lines: string[] = [];
  for (let r = b.top; r <= b.bottom; r++) {
    const cells: string[] = [];
    for (let c = b.left; c <= b.right; c++) {
      const value = r === 0 ? header[c] : rows[r - 1]?.[c];
      cells.push(value === undefined ? "" : typeof value === "number" ? cellText(value) : value);
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}
