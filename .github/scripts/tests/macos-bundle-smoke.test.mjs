/** Check isolated macOS bundle smoke setup without launching the application. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve('.github/scripts/ci/smoke-macos-bundle.sh');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'atus-macos-smoke-test-'));
  const bin = join(root, 'bin'); const bundle = join(root, 'Input.app');
  mkdirSync(bin); mkdirSync(join(bundle, 'Contents', 'MacOS'), { recursive: true });
  writeFileSync(join(bundle, 'Contents', 'Info.plist'), 'fake');
  writeFileSync(join(bundle, 'Contents', 'MacOS', 'ATUS'), '#!/bin/sh\nexec sleep 60\n', { mode: 0o755 });
  for (const [name, body] of Object.entries({ ditto: 'cp -R "$1" "$2"', plutil: 'printf "%s" "${TEST_EXECUTABLE:-ATUS}"', swift: 'exit 0' })) {
    const path = join(bin, name); writeFileSync(path, `#!/bin/sh\n${body}\n`); chmodSync(path, 0o755);
  }
  return { root, bin, bundle };
}
test('runs a temporary copy and removes it after window detection', () => {
  const { root, bin, bundle } = fixture();
  try {
    const result = spawnSync('bash', [script, bundle], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: root }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /window detected/);
    assert.deepEqual(readdirSync(root).sort(), ['Input.app', 'bin']);
    assert.ok(existsSync(join(bundle, 'Contents', 'Info.plist')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('rejects executable paths outside the copied bundle', () => {
  const { root, bin, bundle } = fixture();
  try {
    const result = spawnSync('bash', [script, bundle], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: root, TEST_EXECUTABLE: '../outside' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.match(result.stderr, /Invalid bundle executable/);
    assert.deepEqual(readdirSync(root).sort(), ['Input.app', 'bin']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
