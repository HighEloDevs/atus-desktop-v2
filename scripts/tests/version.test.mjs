import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const cli = resolve('scripts/version.mjs');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'atus-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'src/desktop'), { recursive: true });
  mkdirSync(join(dir, 'src/frontend'), { recursive: true });
  const files = {
    'src/desktop/tauri.conf.json': '{"version":"0.1.0"}\n',
    'src/desktop/Cargo.toml': '[package]\nname = "atus-desktop"\nversion = "0.1.0"\n',
    'src/desktop/Cargo.lock': 'version = 4\n\n[[package]]\nname = "atus-desktop"\nversion = "0.1.0"\n',
    'src/frontend/package.json': '{"version":"0.1.0"}\n',
    'src/frontend/package-lock.json': '{"version":"0.1.0","packages":{"":{"version":"0.1.0"}}}\n',
  };
  for (const [path, content] of Object.entries(files)) writeFileSync(join(dir, path), content);
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init'); git('config', 'user.email', 'test@example.test'); git('config', 'user.name', 'Test');
  git('add', '.'); git('commit', '-m', 'base'); git('branch', 'base');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  return { dir, git, run };
}
test('bump synchronizes all manifests and checks precedence', (t) => {
  const { dir, run } = fixture(t);
  assert.equal(run('bump', '0.2.0-rc.1').status, 0);
  for (const path of ['src/desktop/tauri.conf.json', 'src/desktop/Cargo.toml', 'src/desktop/Cargo.lock', 'src/frontend/package.json', 'src/frontend/package-lock.json']) assert.match(readFileSync(join(dir, path), 'utf8'), /0\.2\.0-rc\.1/);
  assert.equal(run('check', '--base', 'base').status, 0);
  assert.equal(run('bump', '0.2.0-rc.2').status, 0);
  assert.equal(run('check', '--base', 'base').status, 0);
  assert.equal(run('bump', '0.2.0').status, 0);
  assert.equal(run('check', '--base', 'base').status, 0);
});
test('rejects divergence, stale versions, existing tags and invalid versions', (t) => {
  const { dir, git, run } = fixture(t);
  assert.notEqual(run('check', '--base', 'base').status, 0);
  for (const value of ['v1.0.0', '1.0.0-rc.01', '1.0.0+build']) assert.notEqual(run('bump', value).status, 0);
  assert.equal(run('bump', '0.2.0').status, 0);
  writeFileSync(join(dir, 'src/frontend/package.json'), '{"version":"0.1.0"}\n');
  assert.notEqual(run('check', '--base', 'base').status, 0);
  assert.equal(run('bump', '0.2.0').status, 0);
  git('tag', 'v0.2.0');
  assert.notEqual(run('check', '--base', 'base').status, 0);
  git('tag', '-d', 'v0.2.0'); git('add', '.'); git('commit', '-m', 'other merge'); git('branch', '-f', 'base');
  assert.notEqual(run('check', '--base', 'base').status, 0);
});
test('uses semver ordering for release candidates', (t) => {
  const { git, run } = fixture(t);
  assert.equal(run('bump', '0.2.0-rc.2').status, 0);
  git('add', '.'); git('commit', '-m', 'rc2'); git('branch', '-f', 'base');
  assert.equal(run('bump', '0.2.0-rc.1').status, 0);
  assert.notEqual(run('check', '--base', 'base').status, 0);
  assert.equal(run('bump', '0.2.0-rc.10').status, 0);
  assert.equal(run('check', '--base', 'base').status, 0);
  assert.equal(run('bump', '0.2.0').status, 0);
  assert.equal(run('check', '--base', 'base').status, 0);
});
