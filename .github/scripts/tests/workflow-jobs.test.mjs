/** Check the desktop workflow exposes each supported platform separately. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('desktop workflow has explicit platform jobs and artifacts', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const name of ['build-linux', 'build-windows', 'build-macos-intel', 'build-macos-arm64']) {
    assert.match(workflow, new RegExp(`^  ${name}:$`, 'm'));
  }
  for (const artifact of ['linux-bundles', 'windows-installer', 'macos-intel-app', 'macos-arm64-app']) {
    assert.ok(workflow.includes(`name: ${artifact}`));
  }
  assert.doesNotMatch(workflow, /matrix\./);
});

test('platform tests run independently and packages run only after tests outside pull requests', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const platform of ['linux', 'windows', 'macos-intel', 'macos-arm64']) {
    assert.match(workflow, new RegExp(`^  test-${platform}:$`, 'm'));
    const job = workflow.split(`  build-${platform}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.ok(job.includes(`needs: test-${platform}`));
    assert.ok(job.includes("github.event_name != 'pull_request'"));
  }
});
