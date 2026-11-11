import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { missingAssets, prerelease, selectArtifacts } from '../publish-release.mjs';

test('recognizes stable and RC versions and rejects ambiguous versions', () => {
  assert.equal(prerelease('0.2.0'), false);
  assert.equal(prerelease('0.2.0-rc.1'), true);
  assert.throws(() => prerelease('0.2.0-rc.01'));
  assert.throws(() => prerelease('v0.2.0'));
});
test('requires exact artifact types in each platform directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'atus-artifacts-'));
  for (const name of ['linux-bundles', 'windows-installer', 'macos-arm64-app', 'macos-intel-app']) mkdirSync(join(root, name));
  for (const [dir, name] of [['linux-bundles','a.deb'], ['linux-bundles','a.rpm'], ['linux-bundles','a.AppImage'], ['windows-installer','a.exe'], ['macos-arm64-app','a.zip'], ['macos-intel-app','a.zip']]) writeFileSync(join(root, dir, name), 'x');
  assert.equal(selectArtifacts(root).length, 6);
  writeFileSync(join(root, 'linux-bundles', 'b.deb'), 'x');
  assert.throws(() => selectArtifacts(root));
});

test('resumes matching draft assets without overwriting conflicting uploads', () => {
  const digest = 'a'.repeat(64);
  const asset = { name: 'a', state: 'uploaded', digest: `sha256:${digest}` };
  assert.deepEqual(missingAssets(['a', 'b'], [asset], { a: digest, b: digest }), ['b']);
  assert.throws(() => missingAssets(['a'], [{ ...asset, digest: `sha256:${'b'.repeat(64)}` }], { a: digest }));
  assert.throws(() => missingAssets(['a'], [asset, asset], { a: digest }));
});
