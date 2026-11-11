/** Regression test for the Rust coverage collector's toolchain check. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('refuses LLVM tools that do not match rustc before generating a report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-coverage-'));
  try {
    const output = join(dir, 'coverage.lcov');
    const result = spawnSync('bash', ['.github/scripts/coverage/rust-llvm.sh', output], {
      encoding: 'utf8', env: { ...process.env, LLVM_COV: process.execPath },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match rustc LLVM major version/);
    assert.equal(existsSync(output), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('excludes only the explicitly separated test files from LLVM export', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-rust-tools-'));
  try {
    const script = (name, content) => writeFileSync(join(dir, name), `#!/bin/sh\n${content}\n`, { mode: 0o755 });
    script('rustc', 'echo "LLVM version: 23.0.0"');
    script('cargo', `printf '%s\\n' '{"reason":"compiler-artifact","profile":{"test":true},"executable":"/fake/test","package_id":"atus-desktop"}'`);
    script('llvm-profdata', 'if [ "$1" = "--version" ]; then echo "LLVM version 23.0.0"; fi');
    script('llvm-cov', 'if [ "$1" = "--version" ]; then echo "LLVM version 23.0.0"; else printf "%s\\n" "$@" > "$ATUS_ARG_LOG"; printf "SF:/project/src.rs\\nDA:1,1\\nLF:1\\nLH:1\\nend_of_record\\n"; fi');
    const log = join(dir, 'args');
    const output = join(dir, 'coverage.lcov');
    const result = spawnSync('bash', ['.github/scripts/coverage/rust-llvm.sh', output], {
      encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, LLVM_COV: join(dir, 'llvm-cov'), LLVM_PROFDATA: join(dir, 'llvm-profdata'), ATUS_ARG_LOG: log },
    });
    assert.equal(result.status, 0, result.stderr);
    const args = readFileSync(log, 'utf8');
    assert.match(args, /-ignore-filename-regex=.*project\/tests.*project\/additional_tests.*project\/menu_tests.*project\/e2e.*project\/store_test_support.*main_tests/);
    assert.match(result.stderr, /platform cfg paths and unlinked code may be absent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
