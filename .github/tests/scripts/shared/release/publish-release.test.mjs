import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { ARTIFACTS, UPDATER_TARGETS, assertStableVersion, createChangelog, createUpdateManifest, missingAssets, pickRelease, releaseText, selectArtifacts, verifySignatures } from '../../../../scripts/shared/release/publish-release.mjs';
import { parseReleaseNotes } from '../../../../scripts/shared/release/check-release-notes.mjs';

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
  'linux-bundles': ['a.deb', 'a.deb.sig', 'a.rpm', 'a.rpm.sig', 'a.AppImage', 'a.AppImage.sig'],
  'macos-arm64-app': ['a.zip', 'a.dmg', 'A.app.tar.gz', 'A.app.tar.gz.sig'],
  'macos-intel-app': ['a.zip', 'a.dmg', 'A.app.tar.gz', 'A.app.tar.gz.sig'],
};
const WINDOWS = ['a.exe', 'a.exe.sig', 'a.msi', 'a.msi.sig'];

test('every release needs all installers, the macOS updater packages and their signatures', () => {
  const root = tree({ ...COMMON, 'windows-installer': WINDOWS });
  const selected = selectArtifacts(root, '0.2.1');
  assert.deepEqual(selected.map(({ name }) => name).sort(), ['atus-linux.AppImage', 'atus-linux.deb', 'atus-linux.rpm', 'atus-macos-arm64.app.tar.gz', 'atus-macos-arm64.dmg', 'atus-macos-arm64.zip', 'atus-macos-intel.app.tar.gz', 'atus-macos-intel.dmg', 'atus-macos-intel.zip', 'atus-windows.exe', 'atus-windows.msi']);
  assert.equal(selected.find(({ name }) => name === 'atus-windows.msi').signature, join(root, 'windows-installer', 'a.msi.sig'));
  assert.equal(selected.find(({ name }) => name === 'atus-macos-arm64.dmg').signature, null);
  assert.throws(() => selectArtifacts(tree({ ...COMMON, 'windows-installer': ['a.exe', 'a.exe.sig'] }), '0.2.1'), /windows-installer \.msi/);
  assert.throws(() => selectArtifacts(tree({ ...COMMON, 'windows-installer': ['a.exe', 'a.exe.sig', 'a.msi'] }), '0.2.1'), /Missing updater signature for windows-installer \.msi/);
  assert.throws(() => selectArtifacts(tree({ ...COMMON, 'macos-intel-app': ['a.zip', 'A.app.tar.gz', 'A.app.tar.gz.sig'], 'windows-installer': WINDOWS }), '0.2.1'), /macos-intel-app \.dmg/);
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
  const root = tree({ ...COMMON, 'windows-installer': WINDOWS });
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

/** Sign a file the way the Tauri bundler does and write `<file>.sig`; returns the public key value. */
function signer() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const id = Buffer.from('0011223344556677', 'hex');
  const pub = Buffer.from(`untrusted comment: k\n${Buffer.concat([Buffer.from('Ed'), id, publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)]).toString('base64')}\n`).toString('base64');
  const signFile = (path, data) => {
    const sig = sign(null, createHash('blake2b512').update(data).digest(), privateKey);
    const global = sign(null, Buffer.concat([sig, Buffer.from('c')]), privateKey);
    writeFileSync(`${path}.sig`, Buffer.from(`untrusted comment: s\n${Buffer.concat([Buffer.from('ED'), id, sig]).toString('base64')}\ntrusted comment: c\n${global.toString('base64')}\n`).toString('base64'));
  };
  return { pub, signFile };
}

test('verifies every updater signature and reports each bad one', () => {
  const root = tree({ ...COMMON, 'windows-installer': WINDOWS });
  const { pub, signFile } = signer();
  const selected = selectArtifacts(root, '0.2.1');
  for (const entry of selected.filter((item) => item.signature)) signFile(entry.path, 'x');
  const signatures = verifySignatures(selected, pub);
  assert.deepEqual(Object.keys(signatures).sort(), ARTIFACTS.filter((item) => item.signed).map((item) => item.name).sort());
  writeFileSync(join(root, 'windows-installer', 'a.msi'), 'changed');
  writeFileSync(join(root, 'linux-bundles', 'a.deb'), 'changed');
  assert.throws(() => verifySignatures(selected, pub), /Invalid updater signatures.*\natus-linux\.deb: the signature does not match the file\natus-windows\.msi:/s);
  // A different key with the same id is still caught by the signature itself.
  assert.throws(() => verifySignatures(selected, signer().pub), /atus-linux\.rpm: the signature does not match the file/);
  assert.throws(() => verifySignatures(selected, undefined), /not a base64 minisign box/);
});

test('latest.json points each installed format to its own signed package', () => {
  const signatures = Object.fromEntries(ARTIFACTS.filter((item) => item.signed).map((item) => [item.name, `sig-${item.name}`]));
  const manifest = createUpdateManifest({ version: '0.2.5', notes: 'Resumo.', pubDate: '2026-11-13T20:00:00-03:00', repository: 'o/r', signatures });
  assert.deepEqual(Object.keys(manifest), ['version', 'notes', 'pub_date', 'platforms']);
  assert.deepEqual(Object.keys(manifest.platforms).sort(), Object.keys(UPDATER_TARGETS).sort());
  assert.deepEqual(manifest.platforms['windows-x86_64-msi'], { signature: 'sig-atus-windows.msi', url: 'https://github.com/o/r/releases/download/v0.2.5/atus-windows.msi' });
  assert.equal(manifest.platforms['windows-x86_64'].url.endsWith('atus-windows.exe'), true);
  assert.equal(manifest.platforms['linux-x86_64-rpm'].url.endsWith('atus-linux.rpm'), true);
  assert.equal(manifest.platforms['linux-x86_64'].url.endsWith('atus-linux.AppImage'), true);
  assert.equal(manifest.platforms['darwin-x86_64-app'].url.endsWith('atus-macos-intel.app.tar.gz'), true);
  delete signatures['atus-linux.deb'];
  assert.throws(() => createUpdateManifest({ version: '0.2.5', notes: '', pubDate: '', repository: 'o/r', signatures }), /No signature for atus-linux\.deb \(linux-x86_64-deb\)/);
});

test('changelog.json lists every version, newest first, with absolute media URLs', () => {
  const parse = (text) => parseReleaseNotes(text).notes;
  const head = (title) => `---\ntitle: ${title}\ndate: 2026-11-13\nsummary: Resumo ${title}.\n`;
  const entries = [
    { version: '0.2.3', notes: parse(`${head('A')}---\n## Correções\n- x\n`) },
    { version: '0.10.0', notes: parse(`${head('C')}cover: assets/v0.10.0/c.svg\n---\n## Novidades\n### F\nTexto.\n![Leg](assets/v0.10.0/f.png)\n[![V](assets/v0.10.0/p.png)](https://youtu.be/dQw4w9WgXcQ)\n## Melhorias\n- y\n`) },
    { version: '0.2.10', notes: parse(`${head('B')}---\n## Novidades\n### G\nTexto.\n[V](https://youtu.be/dQw4w9WgXcQ)\n`) },
  ];
  const sha = 'b'.repeat(40);
  const changelog = createChangelog(entries, { repository: 'o/r', sha });
  assert.equal(changelog.schema, 1);
  assert.deepEqual(changelog.versions.map((item) => item.version), ['0.10.0', '0.2.10', '0.2.3']);
  const [newest, middle, oldest] = changelog.versions;
  const raw = `https://raw.githubusercontent.com/o/r/${sha}/docs/releases/assets/v0.10.0`;
  assert.equal(newest.cover, `${raw}/c.svg`);
  assert.deepEqual(newest.features[0], { title: 'F', text: ['Texto.'], images: [{ alt: 'Leg', url: `${raw}/f.png` }], video: { title: 'V', url: 'https://youtu.be/dQw4w9WgXcQ', poster: `${raw}/p.png` } });
  assert.deepEqual(newest.improvements, ['y']);
  assert.equal(middle.features[0].video.poster, null);
  assert.deepEqual(oldest, { version: '0.2.3', date: '2026-11-13', title: 'A', summary: 'Resumo A.', cover: null, features: [], improvements: [], fixes: ['x'] });
});
