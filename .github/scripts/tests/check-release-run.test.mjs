import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RELEASE_GATES } from '../release-gates.mjs';
import { checkReleaseRun } from '../check-release-run.mjs';

const run = { name: 'Build desktop', path: '.github/workflows/build.yml', event: 'push', head_branch: 'main', status: 'completed', conclusion: 'success', head_sha: 'a'.repeat(40) };
const jobs = [...new Set(REQUIRED_RELEASE_GATES.map((name) => ({ 'coverage-frontend': 'test-linux', 'coverage-cpp': 'test-linux', 'coverage-rust': 'test-macos-arm64', 'install-windows': 'build-windows', 'install-macos-arm64': 'build-macos-arm64', 'install-linux-deb': 'build-linux', 'install-linux-rpm': 'build-linux', 'install-linux-appimage': 'build-linux' })[name] ?? name))].map((name) => ({ name, conclusion: 'success' }));

test('requires the successful main push and every release gate', () => {
  assert.doesNotThrow(() => checkReleaseRun(run, jobs));
  assert.throws(() => checkReleaseRun({ ...run, event: 'pull_request' }, jobs));
  assert.throws(() => checkReleaseRun({ ...run, head_branch: 'other' }, jobs));
  assert.throws(() => checkReleaseRun({ ...run, conclusion: 'failure' }, jobs));
  assert.throws(() => checkReleaseRun(run, jobs.slice(1)));
  assert.throws(() => checkReleaseRun(run, jobs.map((j, i) => i ? j : { ...j, conclusion: 'skipped' })));
});
