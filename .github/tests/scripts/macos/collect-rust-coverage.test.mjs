/** Regression tests for safe startup of the exploratory macOS coverage runner. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('rejects missing output before starting processes', () => {
  const result = spawnSync('bash', ['.github/scripts/macos/collect-rust-coverage.sh'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
});

test('rejects non-macOS before creating an output report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-desktop-'));
  try {
    writeFileSync(join(dir, 'uname'), '#!/bin/sh\necho Linux\n', { mode: 0o755 });
    const output = join(dir, 'report.lcov');
    const result = spawnSync('bash', ['.github/scripts/macos/collect-rust-coverage.sh', output], {
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
    const result = spawnSync('bash', ['.github/scripts/macos/collect-rust-coverage.sh', '--no-coverage'], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires macOS/);
    assert.doesNotMatch(result.stderr, /Usage:|LLVM tool/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--no-coverage builds without instrumentation flags', () => {
  const script = readFileSync('.github/scripts/macos/collect-rust-coverage.sh', 'utf8');
  const plain = script.split('\nelse\ncargo build')[1].split('\nfi\n')[0];
  assert.match(`cargo build${plain}`, /cargo build .*--features desktop-e2e --bin atus-desktop/);
  assert.doesNotMatch(plain, /instrument-coverage|link-dead-code/);
});

