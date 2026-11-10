import { parseLocaleNumber } from "./parse-locale-number";

export const AUTO_DELIMITERS = [",", ";", "\t", " "] as const;
export type AutoDelimiter = (typeof AUTO_DELIMITERS)[number];

const SAMPLE_LINE_LIMIT = 10;

export function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === " ") {
    return line
      .trim()
      .split(/\s+/)
      .filter((p) => p !== "");
  }

  return line.split(delimiter).map((p) => p.trim());
}

export function sampleDataLines(content: string): string[] {
  const lines: string[] = [];
  for (const rawLine of content.trim().split("\n")) {
    const line = rawLine.trim();
    if (!line || !/\d/.test(line)) continue;
    lines.push(line);
    if (lines.length >= SAMPLE_LINE_LIMIT) break;
  }
  return lines;
}

// A line is valid for a delimiter only if it yields 2-4 tokens that ALL
// parse as numbers. This disambiguates decimal commas from column commas:
// "1,5\t2,3" split by "," yields the non-numeric token "5\t2", so comma
// is rejected and tab wins without any special-casing.
function isNumericLine(parts: string[]): boolean {
  return parts.length >= 2 && parts.length <= 4 && parts.every((p) => !isNaN(parseLocaleNumber(p)));
}

export function detectDelimiter(content: string): AutoDelimiter {
  const sampleLines = sampleDataLines(content);
  if (sampleLines.length === 0) return ",";

  let bestDelimiter: AutoDelimiter = ",";
  let bestScore = -1;
  let bestAvgColumns = Infinity;

  for (const delimiter of AUTO_DELIMITERS) {
    let validLines = 0;
    let totalColumns = 0;

    for (const line of sampleLines) {
      const parts = splitLine(line, delimiter);
      totalColumns += parts.length;
      if (isNumericLine(parts)) validLines++;
    }

    const avgColumns = totalColumns / sampleLines.length;

    // Tie-break: fewer average columns (a delimiter that fragments decimal
    // separators inflates the column count); persistent tie keeps the
    // earlier delimiter in AUTO_DELIMITERS order.
    if (validLines > bestScore || (validLines === bestScore && avgColumns < bestAvgColumns)) {
      bestScore = validLines;
      bestDelimiter = delimiter;
      bestAvgColumns = avgColumns;
    }
  }

  return bestDelimiter;
}
