import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RELEASE_GATES, requireReleaseGates } from '../release-gates.mjs';

const sha = 'a'.repeat(40);
const passing = () => [...new Set(REQUIRED_RELEASE_GATES.map((name) => ({ 'coverage-frontend': 'test-linux', 'coverage-cpp': 'test-linux', 'desktop-macos-arm64': 'coverage-rust', 'install-windows': 'build-windows', 'install-macos-arm64': 'build-macos-arm64', 'install-linux-deb': 'build-linux', 'install-linux-rpm': 'build-linux', 'install-linux-appimage': 'build-linux' })[name] ?? name))].map((name) => ({ name, sha, conclusion: 'success' }));

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
