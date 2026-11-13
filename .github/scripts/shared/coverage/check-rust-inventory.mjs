/** @module Verifies that a Rust LCOV report includes each executable source file. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Check report sources against every Rust source under root.
 * @param {string} root Rust source directory.
 * @param {string} report LCOV report contents.
 * @param {{testOnly: string[], noExecutableLines: Record<string,string>}} policy Reviewed exceptions.
 * @throws {Error} If a source is missing, an exception changed, or the report is invalid.
 */
export function verifyInventory(root, report, policy) {
  const base = realpathSync(root);
  const found = new Set();
  for (const line of report.split(/\r?\n/)) {
    if (!line.startsWith('SF:')) continue;
    const source = line.slice(3);
    if (!isAbsolute(source)) throw new Error(`Non-absolute LCOV source: ${source}`);
    const rel = relative(base, realpathSync(source)).replaceAll('\\', '/');
    if (rel.startsWith('../') || rel === '..') throw new Error(`Source outside Rust directory: ${source}`);
    found.add(rel);
  }
  if (!found.size) throw new Error('Empty Rust coverage report');
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.rs')) files.push(relative(base, path).replaceAll('\\', '/'));
    }
  }
  walk(base);
  const testOnly = new Set(policy.testOnly);
  for (const file of files) {
    if (testOnly.has(file)) {
      if (found.has(file)) throw new Error(`Test-only source included in report: ${file}`);
      continue;
    }
    if (found.has(file)) continue;
    const expected = policy.noExecutableLines[file];
    if (!expected) throw new Error(`Production source missing from report: ${file}`);
    const digest = createHash('sha256').update(readFileSync(join(base, file))).digest('hex');
    if (digest !== expected) throw new Error(`Source without coverage changed and needs review: ${file}`);
  }
  for (const file of found) if (!files.includes(file)) throw new Error(`Unknown source in report: ${file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 5) throw new Error('Usage: rust-inventory.mjs <source-dir> <report.lcov> <policy.json>');
    verifyInventory(process.argv[2], readFileSync(process.argv[3], 'utf8'), JSON.parse(readFileSync(process.argv[4], 'utf8')));
    console.log('Rust source inventory verified');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
