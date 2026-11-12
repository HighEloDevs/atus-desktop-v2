/** Regression tests for safe startup of the exploratory macOS coverage runner. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('rejects missing output before starting processes', () => {
  const result = spawnSync('bash', ['.github/scripts/coverage/rust-desktop-macos.sh'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
});

test('rejects non-macOS before creating an output report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-desktop-'));
  try {
    writeFileSync(join(dir, 'uname'), '#!/bin/sh\necho Linux\n', { mode: 0o755 });
    const output = join(dir, 'report.lcov');
    const result = spawnSync('bash', ['.github/scripts/coverage/rust-desktop-macos.sh', output], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires macOS/);
    assert.equal(existsSync(output), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--no-coverage skips output and LLVM requirements but still requires macOS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-desktop-'));
  try {
    writeFileSync(join(dir, 'uname'), '#!/bin/sh\necho Linux\n', { mode: 0o755 });
    const result = spawnSync('bash', ['.github/scripts/coverage/rust-desktop-macos.sh', '--no-coverage'], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires macOS/);
    assert.doesNotMatch(result.stderr, /Usage:|LLVM tool/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--no-coverage builds without instrumentation flags', () => {
  const script = readFileSync('.github/scripts/coverage/rust-desktop-macos.sh', 'utf8');
  const plain = script.split('\nelse\ncargo build')[1].split('\nfi\n')[0];
  assert.match(`cargo build${plain}`, /cargo build .*--features desktop-e2e --bin atus-desktop/);
  assert.doesNotMatch(plain, /instrument-coverage|link-dead-code/);
});

test('--unit-only requires an output, requires macOS and never starts the app or smoke', () => {
  const missing = spawnSync('bash', ['.github/scripts/coverage/rust-desktop-macos.sh', '--unit-only'], { encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Usage:/);
  const script = readFileSync('.github/scripts/coverage/rust-desktop-macos.sh', 'utf8');
  const unitBranch = script.split('if (( unit_only )); then\n')[1].split('\nfi\n')[0];
  assert.match(unitBranch, /exit 0/);
  assert.ok(script.indexOf('if (( unit_only )); then\n  "$profdata"') < script.indexOf('vite.js'));
  assert.match(script, /if \(\( ! unit_only \)\); then\ncargo rustc .*--bin atus-desktop/);
});
