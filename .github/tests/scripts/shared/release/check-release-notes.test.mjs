import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkReleaseNotes, parseReleaseNotes, renderReleaseBody, versionFromFileName } from '../../../../scripts/shared/release/check-release-notes.mjs';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const GIF = Buffer.from('GIF89a\0\0\0\0\0\0', 'latin1');
const FULL = `---
title: Resíduos à vista
date: 2026-12-02
summary: O ajuste agora mostra onde ele erra.
cover: assets/v0.3.0/cover.png
---

## Novidades

### Painel de resíduos

Fica sob o gráfico e acompanha o zoom.
Veja também [a documentação](https://github.com/HighEloDevs/atus-desktop-v2).

![Painel com faixa ±σ](assets/v0.3.0/residuos.png)
![Atalho em ação](assets/v0.3.0/atalho.gif)

### Análise rápida

Cole os dados de qualquer lugar.

[![Análise rápida em 1 minuto](assets/v0.3.0/quick.png)](https://youtu.be/dQw4w9WgXcQ)

### Ajuste pelo teclado

Cmd+Enter roda os ajustes.

[Ajuste em 20 segundos](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s)

## Melhorias

- O tooltip responde às setas do teclado.
- A tabela mostra todos os dígitos
  que preservam o valor.

## Correções

- O MSI instala na pasta certa.
`;

/** Create a notes folder with the given files; Buffers are written as-is. */
function folder(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'atus-notes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
const IMAGES = { 'assets/v0.3.0/cover.png': PNG, 'assets/v0.3.0/residuos.png': PNG, 'assets/v0.3.0/atalho.gif': GIF, 'assets/v0.3.0/quick.png': PNG };

test('parses features with images, poster videos and plain videos, and both lists', () => {
  const { notes, errors } = parseReleaseNotes(FULL, 'v0.3.0.md');
  assert.deepEqual(errors, []);
  assert.equal(notes.title, 'Resíduos à vista');
  assert.equal(notes.cover, 'assets/v0.3.0/cover.png');
  assert.equal(notes.features.length, 3);
  assert.deepEqual(notes.features[0].images.map((image) => image.alt), ['Painel com faixa ±σ', 'Atalho em ação']);
  assert.equal(notes.features[0].text.length, 2);
  assert.deepEqual(notes.features[1].video, { title: 'Análise rápida em 1 minuto', url: 'https://youtu.be/dQw4w9WgXcQ', poster: 'assets/v0.3.0/quick.png' });
  assert.equal(notes.features[2].video.poster, null);
  assert.deepEqual(notes.improvements, ['O tooltip responde às setas do teclado.', 'A tabela mostra todos os dígitos que preservam o valor.']);
  assert.deepEqual(notes.fixes, ['O MSI instala na pasta certa.']);
});

test('accepts notes with a single list section and Windows line endings', () => {
  const text = '---\r\ntitle: Correções\r\ndate: 2026-11-13\r\nsummary: Ajustes no instalador.\r\n---\r\n\r\n## Correções\r\n\r\n- Um item.\r\n';
  assert.deepEqual(parseReleaseNotes(text).errors, []);
});

test('reports front matter problems', () => {
  const cases = [
    ['## Novidades\n', /front matter block/],
    ['---\ntitle: a\n', /not closed/],
    ['---\ntitle: a\ndate: 2026-02-30\nsummary: b\n---\n## Correções\n- x\n', /real date/],
    ['---\ntitle: a\nsummary: b\n---\n## Correções\n- x\n', /missing required "date"/],
    ['---\ntitle: a\ntitle: b\ndate: 2026-01-01\nsummary: b\n---\n## Correções\n- x\n', /duplicate/],
    ['---\ntitle: a\ndate: 2026-01-01\nsummary: b\nauthor: c\n---\n## Correções\n- x\n', /unknown front matter key "author"/],
    ['---\ntitle:\ndate: 2026-01-01\nsummary: b\n---\n## Correções\n- x\n', /"title" is empty/],
    ['---\ntitle a\ndate: 2026-01-01\nsummary: b\n---\n## Correções\n- x\n', /key: value/],
    ['---\ntitle: a\ndate: 2026-01-01\nsummary: b\ncover: https://example.com/a.png\n---\n## Correções\n- x\n', /relative path/],
    ['---\ntitle: a\ndate: 2026-01-01\nsummary: b\ncover: ../a.png\n---\n## Correções\n- x\n', /relative path/],
    ['---\ntitle: a\ndate: 2026-01-01\nsummary: b\ncover: a.bmp\n---\n## Correções\n- x\n', /must be png/],
  ];
  for (const [text, pattern] of cases) {
    const { notes, errors } = parseReleaseNotes(text, 'v1.0.0.md');
    assert.equal(notes, null, text);
    assert.ok(errors.some((error) => pattern.test(error)), `${text}\n${errors.join('\n')}`);
  }
});

test('reports body problems with line numbers', () => {
  const head = '---\ntitle: a\ndate: 2026-01-01\nsummary: b\n---\n';
  const cases = [
    ['', /at least one section/],
    ['Solto\n## Correções\n- x\n', /before the first section/],
    ['## Extras\n- x\n', /unknown section "Extras"/],
    ['## Correções\n- x\n## Novidades\n### A\nTexto\n', /out of order/],
    ['## Correções\n- x\n## Correções\n- y\n', /repeated or out of order/],
    ['## Novidades\nTexto\n', /start each feature/],
    ['## Novidades\n### A\n', /needs a description/],
    ['## Novidades\n### A\nTexto <b>forte</b>\n', /raw HTML/],
    ['## Novidades\n### A\n<!-- onde: x -->\nTexto\n', /raw HTML/],
    ['## Novidades\n### A\nTexto\n![](a.png)\n', /need a caption/],
    ['## Novidades\n### A\nTexto com ![a](a.png) no meio\n', /own line/],
    ['## Novidades\n### A\nTexto [link](http://example.com)\n', /https/],
    ['## Novidades\n### A\nTexto\n[V](https://youtube.com/shorts/abc)\n', /youtu\.be\/ID/],
    ['## Novidades\n### A\nTexto\n[V](https://youtu.be/dQw4w9WgXcQ)\n[W](https://youtu.be/dQw4w9WgXcQ)\n', /already has a video/],
    ['## Novidades\n### A\nTexto\n[![](p.png)](https://youtu.be/dQw4w9WgXcQ)\n', /needs a title/],
    ['## Correções\nsem hífen\n', /"- item" lists/],
    ['## Correções\n', /section "Correções" is empty/],
    ['# Título\n## Correções\n- x\n', /headings/],
    ['## Novidades\n### A\nTexto\n' + '![c](a.png)\n'.repeat(9), /at most 8 images/],
  ];
  for (const [body, pattern] of cases) {
    const { notes, errors } = parseReleaseNotes(head + body, 'v1.0.0.md');
    assert.equal(notes, null, body);
    assert.ok(errors.some((error) => pattern.test(error)), `${body}\n${errors.join('\n')}`);
    assert.ok(errors.every((error) => /^v1\.0\.0\.md:\d+: /.test(error)), errors.join('\n'));
  }
});

test('names files after stable versions only', () => {
  assert.equal(versionFromFileName('v0.3.0.md'), '0.3.0');
  for (const name of ['v0.3.0-rc.1.md', '0.3.0.md', 'v0.03.0.md', 'v0.3.0.txt']) assert.equal(versionFromFileName(name), null, name);
});

test('validates every file, its images and requires the notes of the version', (t) => {
  const root = folder(t, { 'v0.3.0.md': FULL, 'README.md': '# formato', ...IMAGES });
  assert.deepEqual(checkReleaseNotes({ root, version: '0.3.0' }).errors, []);
  assert.equal(checkReleaseNotes({ root, version: '0.3.0' }).notes.get('0.3.0').title, 'Resíduos à vista');
  assert.match(checkReleaseNotes({ root, version: '0.3.1' }).errors.join('\n'), /missing release notes for 0\.3\.1/);
  assert.match(checkReleaseNotes({ root, version: '0.3.0-rc.1' }).errors.join('\n'), /must be M\.m\.p/);
  assert.match(checkReleaseNotes({ root: join(root, 'nope'), version: '0.3.0' }).errors.join('\n'), /does not exist/);
});

test('rejects missing, oversized and disguised images and stray files', (t) => {
  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  const bigGif = Buffer.concat([GIF, Buffer.alloc(5 * 1024 * 1024)]);
  const root = folder(t, { 'v0.3.0.md': FULL, ...IMAGES, 'assets/v0.3.0/residuos.png': big, 'assets/v0.3.0/atalho.gif': bigGif, 'assets/v0.3.0/quick.png': GIF, 'notes.md': 'x', 'v0.2.0-rc.1.md': 'x' });
  writeFileSync(join(root, 'v0.2.0.md'), FULL.replace('assets/v0.3.0/cover.png', 'assets/missing.png'));
  const errors = checkReleaseNotes({ root, version: '0.3.0' }).errors.join('\n');
  assert.match(errors, /residuos\.png" has 2\.0 MB; the limit for \.png is 2 MB/);
  assert.match(errors, /atalho\.gif" has 5\.0 MB; the limit for \.gif is 5 MB/);
  assert.match(errors, /quick\.png" is not a real \.png file/);
  assert.match(errors, /v0\.2\.0\.md: image "assets\/missing\.png" does not exist/);
  assert.match(errors, /notes\.md: notes files must be named/);
  assert.match(errors, /v0\.2\.0-rc\.1\.md: notes files must be named/);
});

test('accepts each image format by its signature', (t) => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
  const text = FULL.replace('cover.png', 'cover.jpg').replace('residuos.png', 'residuos.webp').replace('quick.png', 'quick.jpeg');
  const root = folder(t, { 'v0.3.0.md': text, 'assets/v0.3.0/cover.jpg': jpeg, 'assets/v0.3.0/residuos.webp': webp, 'assets/v0.3.0/quick.jpeg': jpeg, 'assets/v0.3.0/atalho.gif': GIF });
  assert.deepEqual(checkReleaseNotes({ root, version: '0.3.0' }).errors, []);
});

test('renders a GitHub release body with images at the released commit', () => {
  const { notes } = parseReleaseNotes(FULL);
  const body = renderReleaseBody(notes, { repository: 'owner/repo', sha: 'a'.repeat(40) });
  const raw = `https://raw.githubusercontent.com/owner/repo/${'a'.repeat(40)}/docs/releases/assets/v0.3.0`;
  assert.ok(body.startsWith('O ajuste agora mostra onde ele erra.\n'));
  assert.ok(body.includes(`![Resíduos à vista](${raw}/cover.png)`));
  assert.ok(body.includes(`![Painel com faixa ±σ](${raw}/residuos.png)`));
  assert.ok(body.includes(`[![Análise rápida em 1 minuto](${raw}/quick.png)](https://youtu.be/dQw4w9WgXcQ)`));
  assert.ok(body.includes('▶ [Ajuste em 20 segundos](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s)'));
  assert.ok(body.includes('## Melhorias\n\n- O tooltip responde às setas do teclado.'));
  assert.ok(body.endsWith('- O MSI instala na pasta certa.\n'));
  const fixesOnly = parseReleaseNotes('---\ntitle: a\ndate: 2026-01-01\nsummary: b\n---\n## Correções\n- x\n').notes;
  assert.equal(renderReleaseBody(fixesOnly, { repository: 'o/r', sha: 'b'.repeat(40) }), 'b\n\n## Correções\n\n- x\n');
});

test('the command line reads the version from the app manifest', (t) => {
  const cli = resolve('.github/scripts/shared/release/check-release-notes.mjs');
  const root = folder(t, { 'docs/releases/v0.3.0.md': FULL, ...Object.fromEntries(Object.entries(IMAGES).map(([path, data]) => [`docs/releases/${path}`, data])), 'src/desktop/tauri.conf.json': '{"version":"0.3.0"}' });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  const ok = run();
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /including 0\.3\.0/);
  const missing = run('--version', '0.4.0');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing release notes for 0\.4\.0/);
  assert.equal(run('--root', 'elsewhere').status, 1);
  writeFileSync(join(root, 'src/desktop/tauri.conf.json'), 'not json');
  assert.equal(run().status, 1);
});
