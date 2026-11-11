/** Regression test for the Rust coverage collector's toolchain check. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('refuses LLVM tools that do not match rustc before generating a report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-coverage-'));
  try {
    const output = join(dir, 'coverage.lcov');
    const result = spawnSync('bash', ['scripts/coverage/rust-llvm.sh', output], {
      encoding: 'utf8', env: { ...process.env, LLVM_COV: process.execPath },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match rustc LLVM major version/);
    assert.equal(existsSync(output), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
