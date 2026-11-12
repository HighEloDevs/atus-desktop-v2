import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RELEASE_GATES, requireReleaseGates } from '../release-gates.mjs';

const sha = 'a'.repeat(40);
const passing = () => [...new Set(REQUIRED_RELEASE_GATES.map((name) => ({ 'coverage-frontend': 'test-linux', 'coverage-cpp': 'test-linux', 'coverage-rust': 'test-macos-arm64', 'install-windows': 'build-windows', 'install-macos-arm64': 'build-macos-arm64', 'install-linux-deb': 'build-linux', 'install-linux-rpm': 'build-linux', 'install-linux-appimage': 'build-linux', 'install-macos-intel': 'build-macos-intel' })[name] ?? name))].map((name) => ({ name, sha, conclusion: 'success' }));

test('accepts only complete successful results from the release commit', () => {
  assert.doesNotThrow(() => requireReleaseGates(passing(), sha));
  assert.throws(() => requireReleaseGates(passing().slice(1), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates([...passing(), passing()[0]], sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, conclusion: 'skipped' }), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, sha: 'b'.repeat(40) }), sha), /not satisfied/);
});

test('accepts existing Linux jobs as evidence for their included checks', () => {
  const jobs = passing().filter((job) => !['coverage-frontend', 'coverage-cpp', 'install-linux-deb', 'install-linux-rpm', 'install-linux-appimage'].includes(job.name));
  assert.doesNotThrow(() => requireReleaseGates(jobs, sha));
  assert.throws(() => requireReleaseGates(jobs.map((job) => job.name === 'test-linux' ? { ...job, conclusion: 'failure' } : job), sha), /coverage-frontend/);
  assert.throws(() => requireReleaseGates(jobs.filter((job) => job.name !== 'build-linux'), sha), /install-linux-deb/);
  assert.throws(() => requireReleaseGates(jobs.filter((job) => job.name !== 'build-windows'), sha), /install-windows/);
  assert.throws(() => requireReleaseGates(jobs.filter((job) => job.name !== 'build-macos-arm64'), sha), /install-macos-arm64/);
});

test('the command line check reads the needs context of the publishing job', async () => {
  const { spawnSync } = await import('node:child_process');
  const needs = Object.fromEntries(passing().map(({ name }) => [name, { result: 'success' }]));
  const run = (value) => spawnSync(process.execPath, ['.github/scripts/release-gates.mjs'], { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: JSON.stringify(value), RELEASE_SHA: sha } });
  assert.equal(run(needs).status, 0);
  assert.notEqual(run({ ...needs, 'build-linux': { result: 'cancelled' } }).status, 0);
  const { 'release-version': _omitted, ...incomplete } = needs;
  assert.notEqual(run(incomplete).status, 0);
  assert.notEqual(spawnSync(process.execPath, ['.github/scripts/release-gates.mjs'], { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: '', RELEASE_SHA: sha } }).status, 0);
});

test('publication no longer waits for a native version order gate', () => {
  assert.ok(!REQUIRED_RELEASE_GATES.includes('native-version-order'));
});
