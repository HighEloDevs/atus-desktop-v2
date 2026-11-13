/** Guards the shape of the release pipeline: platform jobs, dependency graph, gating and publishing. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
const PLATFORMS = ['linux', 'windows', 'macos-intel', 'macos-arm64'];

/** Return the text of one top-level job. */
function job(name) {
  const body = workflow.split(`\n  ${name}:\n`)[1];
  assert.ok(body, `missing job ${name}`);
  return body.split(/^  [\w-]+:/m)[0];
}

/** Return the sorted `needs` list of a job. */
function needs(name) {
  return job(name).match(/^ {4}needs: \[([^\]]*)\]$/m)?.[1].split(',').map((item) => item.trim()).sort();
}

test('each platform has its own test, integration and build jobs, without a matrix', () => {
  for (const platform of PLATFORMS) {
    for (const kind of ['test', 'integration', 'build']) assert.ok(job(`${kind}-${platform}`));
  }
  assert.doesNotMatch(workflow, /matrix\./);
});

test('jobs form test/integration -> build -> publish', () => {
  for (const platform of PLATFORMS) {
    for (const kind of ['test', 'integration']) assert.deepEqual(needs(`${kind}-${platform}`), ['check-version', 'release-version'], `${kind}-${platform}`);
    assert.deepEqual(needs(`build-${platform}`), [`integration-${platform}`, `test-${platform}`].sort(), `build-${platform}`);
  }
  assert.deepEqual(needs('publish-release'), PLATFORMS.map((platform) => `build-${platform}`).sort());
});

test('packages are built outside pull requests and survive the skipped version check', () => {
  for (const platform of PLATFORMS) {
    const text = job(`build-${platform}`);
    assert.ok(text.includes("github.event_name != 'pull_request'"), platform);
    // A skipped ancestor skips dependents unless the condition calls a status function.
    assert.match(text, /^ {4}if: \$\{\{ !failure\(\) && !cancelled\(\) && /m, platform);
  }
});

test('macOS test and integration jobs run for pull requests only when they target main', () => {
  const guard = "if: ${{ !failure() && !cancelled() && (github.event_name != 'pull_request' || github.base_ref == 'main') }}";
  for (const name of ['test-macos-arm64', 'test-macos-intel', 'integration-macos-arm64', 'integration-macos-intel']) {
    assert.ok(job(name).includes(guard), name);
  }
  for (const name of ['test-linux', 'test-windows', 'integration-linux', 'integration-windows']) {
    assert.ok(!job(name).includes('base_ref'), name);
  }
});

test('releases are published only from main, after the four builds, by the only job that can write contents', () => {
  const text = job('publish-release');
  assert.match(text, /^ {4}if: \$\{\{ !cancelled\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/m);
  for (const platform of PLATFORMS) assert.ok(text.includes(`needs.build-${platform}.result == 'success'`), platform);
  assert.match(text, /^ {4}permissions:\n {6}contents: write$/m);
  assert.equal([...workflow.matchAll(/contents: write/g)].length, 1);
  assert.ok(text.includes('publish-release.mjs'));
  // Pushes to main compare the version with the previous commit before anything is released.
  const version = job('release-version');
  assert.ok(version.includes("github.event_name == 'push'") && version.includes("github.ref == 'refs/heads/main'") && version.includes('check --base HEAD^'));
});
