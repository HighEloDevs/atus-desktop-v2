/** @module Prints the lines that an LCOV report did not execute, grouped by source file. */
import { readFileSync } from 'node:fs';

/**
 * List uncovered lines per file in an LCOV report.
 * @param {string} report LCOV report contents.
 * @returns {Map<string, number[]>} Source file to its lines with zero hits, in report order.
 */
export function uncoveredLines(report) {
  const files = new Map();
  let file = null;
  for (const line of report.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      file = line.slice(3);
      files.set(file, []);
    } else if (file && line.startsWith('DA:')) {
      const [number, hits] = line.slice(3).split(',').map(Number);
      if (hits === 0) files.get(file).push(number);
    }
  }
  return files;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  if (process.argv.length !== 3) {
    console.error('Usage: uncovered-lines.mjs <report.lcov>');
    process.exitCode = 1;
  } else {
    for (const [file, lines] of uncoveredLines(readFileSync(process.argv[2], 'utf8'))) {
      if (lines.length) console.log(`${file.split('/src/desktop/').pop()}: ${lines.length} uncovered: ${lines.join(',')}`);
    }
  }
}
