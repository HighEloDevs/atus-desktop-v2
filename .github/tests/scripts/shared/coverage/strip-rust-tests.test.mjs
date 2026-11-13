/** Regression tests for removing inline Rust test modules from LCOV reports. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTestModules, testModuleStart } from '../../../../scripts/shared/coverage/strip-rust-tests.mjs';

const source = [
  '//! docs',          // 1
  'pub fn run() {}',  // 2
  '',                 // 3
  '#[cfg(test)]',     // 4
  'mod tests {',      // 5
  '    #[test]',      // 6
  '    fn it() { if true { } }', // 7
  '}',                // 8
  '',
].join('\n');

test('finds the line where the test module starts', () => {
  assert.equal(testModuleStart(source), 4);
  assert.equal(testModuleStart('pub fn a() {}\n'), null);
});

test('accepts extra attributes between cfg(test) and mod tests', () => {
  assert.equal(testModuleStart('fn a() {}\n#[cfg(test)]\n#[allow(dead_code)]\nmod tests {\n}\n'), 2);
});

test('is not confused by braces inside strings', () => {
  const text = 'fn a() {}\n#[cfg(test)]\nmod tests {\n    fn t() { let _ = "{invalid"; }\n}\n';
  assert.equal(testModuleStart(text), 2);
});

test('rejects code after the test module, repeated modules and out-of-line modules', () => {
  assert.throws(() => testModuleStart(source + 'fn late() {}\n'), /closing brace/);
  assert.throws(() => testModuleStart(source + '#[cfg(test)]\nmod tests {\n}\n'), /More than one/);
  assert.throws(() => testModuleStart('#[cfg(test)]\nmod tests;\n'), /inline block/);
  assert.throws(() => testModuleStart('#[cfg(test)]\nmod tests {\n'), /closing brace/);
});

test('rejects an item placed between the module header and its closing brace', () => {
  assert.throws(() => testModuleStart('#[cfg(test)]\nmod tests {\n}\nfn late() {}\n}\n'), /last item/);
});

test('drops test lines, functions and branches and recomputes the counters', () => {
  const report = [
    'SF:/src/a.rs',
    'FN:2,a::run', 'FN:7,a::tests::it',
    'FNDA:1,a::run', 'FNDA:1,a::tests::it',
    'FNF:2', 'FNH:2',
    'DA:2,1', 'DA:7,3',
    'BRDA:2,0,0,1', 'BRDA:7,0,0,1',
    'BRF:2', 'BRH:2',
    'LF:2', 'LH:2',
    'end_of_record',
  ].join('\n');
  assert.equal(stripTestModules(report, () => source), [
    'SF:/src/a.rs', 'FN:2,a::run', 'FNDA:1,a::run', 'FNF:1', 'FNH:1',
    'DA:2,1', 'BRDA:2,0,0,1', 'BRF:1', 'BRH:1', 'LF:1', 'LH:1', 'end_of_record', '',
  ].join('\n'));
});

test('counts uncovered production lines after stripping', () => {
  const report = 'SF:/src/a.rs\nDA:2,0\nDA:7,5\nLF:2\nLH:1\nend_of_record\n';
  assert.match(stripTestModules(report, () => source), /LF:1\nLH:0\n/);
});

test('leaves files without a test module unchanged and rejects truncated reports', () => {
  const report = 'SF:/src/b.rs\nDA:1,1\nLF:1\nLH:1\nend_of_record\n';
  assert.equal(stripTestModules(report, () => 'fn a() {}\n'), report);
  assert.throws(() => stripTestModules('SF:/src/b.rs\nDA:1,1\n', () => ''), /Truncated/);
});
