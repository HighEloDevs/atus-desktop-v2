import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyManifest } from '../release.mjs';

const sha = 'a'.repeat(40);
const digest = (value) => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'atus-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'app.zip'), 'contents');
  return { dir, manifest: { sha, version: '0.2.0-rc.1', artifacts: [{ name: 'app.zip', sha256: digest('contents') }] }, expected: { sha, version: '0.2.0-rc.1', names: ['app.zip'] } };
}

test('accepts artifacts matching the independently supplied release identity', (t) => {
  const { dir, manifest, expected } = fixture(t);
  assert.doesNotThrow(() => verifyManifest(manifest, dir, expected));
});
test('rejects wrong commit, version, digest, missing and unexpected artifacts', (t) => {
  const { dir, manifest, expected } = fixture(t);
  for (const altered of [
    { ...manifest, sha: 'b'.repeat(40) },
    { ...manifest, version: '0.2.0' },
    { ...manifest, artifacts: [{ name: 'app.zip', sha256: 'f'.repeat(64) }] },
    { ...manifest, artifacts: [] },
    { ...manifest, artifacts: [...manifest.artifacts, manifest.artifacts[0]] },
    { ...manifest, artifacts: [{ name: '../app.zip', sha256: digest('contents') }] },
  ]) assert.throws(() => verifyManifest(altered, dir, expected));
  rmSync(join(dir, 'app.zip'));
  assert.throws(() => verifyManifest(manifest, dir, expected));
});
test('rejects empty expected artifact lists', (t) => {
  const { dir, manifest, expected } = fixture(t);
  assert.throws(() => verifyManifest(manifest, dir, { ...expected, names: [] }));
});
test('rejects symlink artifacts when supported', (t) => {
  const { dir, manifest, expected } = fixture(t);
  rmSync(join(dir, 'app.zip'));
  writeFileSync(join(dir, 'target.zip'), 'contents');
  try {
    symlinkSync(join(dir, 'target.zip'), join(dir, 'app.zip'));
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'].includes(error.code)) {
      t.skip(`Symbolic links unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  assert.throws(() => verifyManifest(manifest, dir, expected));
});
