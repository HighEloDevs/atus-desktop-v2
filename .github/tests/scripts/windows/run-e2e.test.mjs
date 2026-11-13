/** Regression: Windows runners expose several node.exe entries; the E2E script must pick exactly one path. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Windows desktop E2E script resolves a single node executable', () => {
  const script = readFileSync(new URL('../../../scripts/windows/run-e2e.ps1', import.meta.url), 'utf8');
  const line = script.split(/\r?\n/).find((entry) => entry.startsWith('$node ='));
  assert.ok(line, 'node resolution line not found');
  assert.match(line, /Get-Command node[^|]*\|\s*Select-Object -First 1\)\.Source/);
});
