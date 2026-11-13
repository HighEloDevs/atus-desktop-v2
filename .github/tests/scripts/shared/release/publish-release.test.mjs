import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertStableVersion, missingAssets, pickRelease, releaseText, selectArtifacts } from '../../../../scripts/shared/release/publish-release.mjs';

test('publishes only stable M.m.p versions', () => {
  assert.doesNotThrow(() => assertStableVersion('0.2.0'));
  for (const version of ['0.2.0-rc.1', 'v0.2.0', '0.2', '0.02.0']) assert.throws(() => assertStableVersion(version), /only M\.m\.p/, version);
});
/** Build an artifact tree with the given files per job folder. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'atus-artifacts-'));
  for (const [dir, names] of Object.entries(files)) {
    mkdirSync(join(root, dir));
    for (const name of names) writeFileSync(join(root, dir, name), 'x');
  }
  return root;
}
const COMMON = {
  'linux-bundles': ['a.deb', 'a.rpm', 'a.AppImage'],
  'macos-arm64-app': ['a.zip', 'a.dmg'],
  'macos-intel-app': ['a.zip', 'a.dmg'],
};

test('every release needs the exe, the msi and both macOS formats', () => {
  const root = tree({ ...COMMON, 'windows-installer': ['a.exe', 'a.msi'] });
  const names = selectArtifacts(root, '0.2.1').map(({ name }) => name).sort();
  assert.deepEqual(names, ['atus-linux.AppImage', 'atus-linux.deb', 'atus-linux.rpm', 'atus-macos-arm64.dmg', 'atus-macos-arm64.zip', 'atus-macos-intel.dmg', 'atus-macos-intel.zip', 'atus-windows.exe', 'atus-windows.msi']);
  assert.throws(() => selectArtifacts(tree({ ...COMMON, 'windows-installer': ['a.exe'] }), '0.2.1'), /windows-installer \.msi/);
  assert.throws(() => selectArtifacts(tree({ ...COMMON, 'macos-intel-app': ['a.zip'], 'windows-installer': ['a.exe', 'a.msi'] }), '0.2.1'), /macos-intel-app \.dmg/);
  assert.throws(() => selectArtifacts(root, '0.2.1-rc.1'), /only M\.m\.p/);
});

test('titles the release and renders its body from the notes', () => {
  const notes = '---\ntitle: Instaladores\ndate: 2026-11-13\nsummary: Novos formatos.\n---\n\n## Correções\n\n- MSI na pasta certa.\n';
  const { title, body } = releaseText(notes, { version: '0.2.3', repository: 'o/r', sha: 'a'.repeat(40) });
  assert.equal(title, 'ATUS 0.2.3 · Instaladores');
  assert.equal(body, 'Novos formatos.\n\n## Correções\n\n- MSI na pasta certa.\n');
  assert.throws(() => releaseText('## Correções\n- x\n', { version: '0.2.3', repository: 'o/r', sha: 'a'.repeat(40) }), /Invalid release notes:\nv0\.2\.3\.md:1:/);
});

test('rejects an ambiguous artifact', () => {
  const root = tree({ ...COMMON, 'windows-installer': ['a.exe', 'a.msi'] });
  writeFileSync(join(root, 'linux-bundles', 'b.deb'), 'x');
  assert.throws(() => selectArtifacts(root, '0.2.1'), /linux-bundles \.deb/);
});

test('resumes matching draft assets without overwriting conflicting uploads', () => {
  const digest = 'a'.repeat(64);
  const asset = { name: 'a', state: 'uploaded', digest: `sha256:${digest}` };
  assert.deepEqual(missingAssets(['a', 'b'], [asset], { a: digest, b: digest }), ['b']);
  assert.throws(() => missingAssets(['a'], [{ ...asset, digest: `sha256:${'b'.repeat(64)}` }], { a: digest }));
  assert.throws(() => missingAssets(['a'], [asset, asset], { a: digest }));
});

test('finds a draft release by tag in the release list', () => {
  const draft = { id: 1, tag_name: 'v0.2.5', draft: true };
  assert.equal(pickRelease([{ id: 2, tag_name: 'v0.2.4' }, draft], 'v0.2.5'), draft);
  assert.equal(pickRelease([{ id: 2, tag_name: 'v0.2.4' }], 'v0.2.5'), null);
  assert.equal(pickRelease([], 'v0.2.5'), null);
  assert.throws(() => pickRelease([draft, { ...draft, id: 3 }], 'v0.2.5'), /Several releases/);
});

test('publish never looks releases up through the tag endpoint, which hides drafts', async () => {
  const { readFileSync } = await import('node:fs');
  assert.doesNotMatch(readFileSync('.github/scripts/shared/release/publish-release.mjs', 'utf8'), /releases\/tags/);
});
