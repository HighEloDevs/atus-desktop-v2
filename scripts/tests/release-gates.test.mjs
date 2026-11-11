import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RELEASE_GATES, requireReleaseGates } from '../release-gates.mjs';

const sha = 'a'.repeat(40);
const passing = () => REQUIRED_RELEASE_GATES.map((name) => ({ name, sha, conclusion: 'success' }));

test('accepts only complete successful results from the release commit', () => {
  assert.doesNotThrow(() => requireReleaseGates(passing(), sha));
  assert.throws(() => requireReleaseGates(passing().slice(1), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates([...passing(), passing()[0]], sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, conclusion: 'skipped' }), sha), /not satisfied/);
  assert.throws(() => requireReleaseGates(passing().map((j, i) => i ? j : { ...j, sha: 'b'.repeat(40) }), sha), /not satisfied/);
});
