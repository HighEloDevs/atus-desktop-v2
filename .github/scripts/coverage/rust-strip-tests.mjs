/** @module Removes inline `#[cfg(test)] mod tests` blocks from a Rust LCOV report. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = /^#\[cfg\(test\)\]\s*\n(?:\s*#\[[^\n]*\]\s*\n)*\s*mod tests\b/m;

/**
 * Find the 1-based line where the inline unit-test module of a Rust source begins.
 * The module must be the last item of the file, so everything from this line on is test code.
 * @param {string} source Rust source text.
 * @returns {number|null} First line of the `#[cfg(test)]` attribute, or null when the file has no such module.
 * @throws {Error} If more than one test module exists, it is not a braced block, or code follows it.
 */
export function testModuleStart(source) {
  const match = MARKER.exec(source);
  if (!match) return null;
  const rest = source.slice(match.index + match[0].length);
  if (MARKER.test(rest)) throw new Error('More than one `#[cfg(test)] mod tests` block');
  if (!/^\s*\{/.test(rest)) throw new Error('`mod tests` must be an inline block');
  // Braces inside strings and comments make brace counting unreliable, so rely on rustfmt indentation:
  // every line of the module is indented except the closing brace, which must end the file.
  const lines = rest.split('\n').slice(1).filter((line) => line.trim());
  const closing = lines.pop();
  if (closing !== '}') throw new Error('`mod tests` must end the file with a closing brace at column 0');
  if (lines.some((line) => !/^\s/.test(line))) throw new Error('Code follows `mod tests`; it must be the last item of the file');
  return source.slice(0, match.index).split('\n').length;
}

/**
 * Drop coverage records at or after each file's inline test module and recompute the counters.
 * @param {string} report LCOV report contents.
 * @param {(path: string) => string} read Returns the source text for an absolute SF path.
 * @returns {string} The filtered report.
 * @throws {Error} If a source's test module is malformed (see {@link testModuleStart}).
 */
export function stripTestModules(report, read) {
  const out = [];
  let record = [];
  const flush = () => {
    const sf = record[0].slice(3);
    const cut = testModuleStart(read(sf));
    out.push(...(cut === null ? record : filterRecord(record, cut)));
    record = [];
  };
  for (const line of report.split(/\r?\n/)) {
    if (!line) continue;
    record.push(line);
    if (line === 'end_of_record') flush();
  }
  if (record.length) throw new Error('Truncated LCOV record');
  return out.join('\n') + '\n';
}

function filterRecord(record, cut) {
  const dropped = new Set();
  const keep = record.filter((line) => {
    const fn = /^FN:(\d+),(?:\d+,)?(.+)$/.exec(line);
    if (fn && Number(fn[1]) >= cut) { dropped.add(fn[2]); return false; }
    const line1 = /^(?:DA|BRDA):(\d+),/.exec(line);
    return !(line1 && Number(line1[1]) >= cut);
  }).filter((line) => {
    const fnda = /^FNDA:\d+,(.+)$/.exec(line);
    return !(fnda && dropped.has(fnda[1]));
  });
  const count = (re) => keep.filter((l) => re.test(l)).length;
  const set = { LF: count(/^DA:/), LH: keep.filter((l) => /^DA:\d+,[1-9]/.test(l)).length,
    FNF: count(/^FN:/), FNH: keep.filter((l) => /^FNDA:[1-9]/.test(l)).length,
    BRF: count(/^BRDA:/), BRH: keep.filter((l) => /^BRDA:\d+,\d+,\d+,[1-9]/.test(l)).length };
  return keep.map((l) => {
    const m = /^(LF|LH|FNF|FNH|BRF|BRH):/.exec(l);
    return m ? `${m[1]}:${set[m[1]]}` : l;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: rust-strip-tests.mjs <report.lcov>');
    const file = process.argv[2];
    writeFileSync(file, stripTestModules(readFileSync(file, 'utf8'), (path) => readFileSync(path, 'utf8')));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
