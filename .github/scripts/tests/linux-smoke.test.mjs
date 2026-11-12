/** Reject invalid smoke-test requests before installing any system packages. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = '.github/scripts/ci/smoke-linux-container.sh';

test('rejects an unsupported Linux bundle type', () => {
  const result = spawnSync('bash', [script, 'other', '/missing'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Expected bundle type/);
});

test('rejects a missing bundle before attempting installation', () => {
  for (const kind of ['deb', 'rpm', 'appimage']) {
    const result = spawnSync('bash', [script, kind, '/nonexistent/atus-smoke-bundle'], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Bundle not found/);
  }
});
