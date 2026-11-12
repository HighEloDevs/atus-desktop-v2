import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { REQUIRED_RELEASE_GATES, requireReleaseGates } from '../release-gates.mjs';

const sha = 'a'.repeat(40);
const passing = () => REQUIRED_RELEASE_GATES.map((name) => ({ name, sha, conclusion: 'success' }));

test('requires exactly the four package jobs', () => {
  assert.deepEqual([...REQUIRED_RELEASE_GATES].sort(), ['build-linux', 'build-macos-arm64', 'build-macos-intel', 'build-windows']);
});

test('accepts only complete successful results from the release commit', () => {
  assert.doesNotThrow(() => requireReleaseGates(passing(), sha));
  assert.throws(() => requireReleaseGates(passing().slice(1), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates([...passing(), passing()[0]], sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, conclusion: 'skipped' }), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, conclusion: 'cancelled' }), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, sha: 'b'.repeat(40) }), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing(), 'not-a-sha'), /Invalid release gate input/);
});

test('the command line check reads the needs context of the publishing job', () => {
  const needs = Object.fromEntries(passing().map(({ name }) => [name, { result: 'success' }]));
  const run = (value) => spawnSync(process.execPath, ['.github/scripts/release-gates.mjs'], { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: JSON.stringify(value), RELEASE_SHA: sha } });
  assert.equal(run(needs).status, 0);
  assert.notEqual(run({ ...needs, 'build-linux': { result: 'cancelled' } }).status, 0);
  const { 'build-windows': _omitted, ...incomplete } = needs;
  assert.notEqual(run(incomplete).status, 0);
  assert.notEqual(spawnSync(process.execPath, ['.github/scripts/release-gates.mjs'], { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: '', RELEASE_SHA: sha } }).status, 0);
});
