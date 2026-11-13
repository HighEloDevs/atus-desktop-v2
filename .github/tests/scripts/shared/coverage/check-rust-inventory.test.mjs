/** Regression tests for Rust coverage source inventory. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyInventory } from '../../../../scripts/shared/coverage/check-rust-inventory.mjs';

test('requires every executable production source and reviewed unchanged exceptions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-inventory-'));
  try {
    mkdirSync(join(dir, 'project'));
    writeFileSync(join(dir, 'main.rs'), 'fn main() {}');
    writeFileSync(join(dir, 'project/model.rs'), 'pub struct Model;');
    writeFileSync(join(dir, 'project/tests.rs'), '#[test] fn test() {}');
    const digest = createHash('sha256').update('pub struct Model;').digest('hex');
    const policy = { testOnly: ['project/tests.rs'], noExecutableLines: { 'project/model.rs': digest } };
    const report = `SF:${join(dir, 'main.rs')}\nDA:1,1\nLF:1\nLH:1\nend_of_record\n`;
    assert.doesNotThrow(() => verifyInventory(dir, report, policy));
    writeFileSync(join(dir, 'new.rs'), 'fn hidden() {}');
    assert.throws(() => verifyInventory(dir, report, policy), /Production source missing/);
    rmSync(join(dir, 'new.rs'));
    writeFileSync(join(dir, 'project/model.rs'), 'pub fn executable() {}');
    assert.throws(() => verifyInventory(dir, report, policy), /changed and needs review/);
    assert.throws(() => verifyInventory(dir, '', policy), /Empty Rust coverage/);
    writeFileSync(join(dir, 'project/model.rs'), 'pub struct Model;');
    assert.throws(() => verifyInventory(dir, report + `SF:${join(dir, 'project/tests.rs')}\n`, policy), /Test-only source included/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
