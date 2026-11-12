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
    const integration = platform === 'macos-arm64' ? '' : `, integration-${platform}`;
    assert.ok(job.includes(integration ? `needs: [test-${platform}${integration}]` : `needs: test-${platform}`), platform);
    assert.ok(job.includes("github.event_name != 'pull_request'"));
  }
});

test('main pushes validate version against the previous commit before release', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  release-version:\n')[1]?.split(/^  [\w-]+:/m)[0];
  assert.ok(job);
  assert.ok(job.includes("github.event_name == 'push'"));
  assert.ok(job.includes("github.ref == 'refs/heads/main'"));
  assert.ok(job.includes('check --base HEAD^'));
});

test('release artifact gate waits for every platform package', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  release-artifacts:\n')[1]?.split(/^  [\w-]+:/m)[0];
  assert.ok(job);
  for (const platform of ['linux', 'windows', 'macos-intel', 'macos-arm64']) {
    assert.ok(job.includes(`build-${platform}`));
  }
});

test('desktop smoke jobs cover both macOS architectures', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /^  coverage-rust:$/m);
  assert.match(workflow, /^  test-macos-arm64:\n(?:    .*\n)*?    runs-on: macos-latest$/m);
  assert.match(workflow, /^  integration-macos-intel:\n(?:    .*\n)*?    runs-on: macos-15-intel$/m);
  assert.equal((workflow.match(/\.github\/scripts\/coverage\/rust-desktop-macos\.sh/g) ?? []).length, 2);
});

test('package builds check platform applications before uploading', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const platform of ['macos-intel', 'macos-arm64', 'windows']) {
    const job = workflow.split(`  build-${platform}:\n`)[1].split(/^  [\w-]+:/m)[0];
    const smoke = platform === 'windows' ? 'smoke-windows-installer.ps1' : 'smoke-macos-bundle.sh';
    assert.ok(job.indexOf(smoke) > 0 && job.indexOf(smoke) < job.indexOf('actions/upload-artifact'));
  }
});

test('Linux desktop smoke locates the repository after relocation to .github', () => {
  const runner = readFileSync('.github/scripts/desktop-e2e/run-linux.sh', 'utf8');
  assert.match(runner, /\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/\.\.\/\.\./);
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8');
  assert.match(workflow, /^  integration-linux:$/m);
  assert.ok(workflow.includes('xvfb-run -a .github/scripts/desktop-e2e/run-linux.sh'));
});

test('Windows desktop smoke runs only after building the test application', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  integration-windows:\n')[1]?.split(/^  [\w-]+:/m)[0];
  assert.ok(job);
  assert.ok(job.indexOf('cargo build --manifest-path') < job.indexOf('desktop-e2e/run-windows.ps1'));
});

test('test and integration jobs wait for the version checks and skip only when they are skipped', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const names = [...workflow.matchAll(/^  ((?:test|integration)-[\w-]+):$/gm)].map((m) => m[1]);
  assert.deepEqual(names.sort(), ['integration-linux', 'integration-macos-intel', 'integration-windows', 'test-linux', 'test-macos-arm64', 'test-macos-intel', 'test-windows']);
  for (const name of names) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.ok(job.includes('needs: [check-version, release-version]'), name);
    assert.ok(job.includes('if: ${{ !failure() && !cancelled()'), name);
  }
});

test('Intel desktop smoke runs without coverage instrumentation and only for PRs to main', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  integration-macos-intel:\n')[1].split(/^  [\w-]+:/m)[0];
  assert.ok(job.includes('rust-desktop-macos.sh --no-coverage'));
  assert.ok(!job.includes('llvm-tools-preview'));
  assert.ok(job.includes("github.base_ref == 'main'"));
});

test('every Rust-compiling job restores the Cargo cache from the desktop workspace', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const names = [...workflow.matchAll(/^  ((?:test|integration|build)-[\w-]+):$/gm)].map((m) => m[1]);
  assert.equal(names.length, 11);
  for (const name of names) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.match(job, /uses: Swatinem\/rust-cache@v2\.\d+\.\d+\n\s+with:\n\s+workspaces: src\/desktop/, name);
  }
});

test('helper script tests run on Linux; Windows keeps the checkout and formatting checks', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = (name) => workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
  assert.ok(job('test-linux').includes('Test CI helper scripts'));
  for (const name of ['test-macos-arm64', 'test-macos-intel']) assert.ok(!job(name).includes('Test CI helper scripts'), name);
  assert.ok(job('test-windows').includes('git-attributes.test.mjs'));
  assert.ok(job('test-windows').includes('npm run format:check'));
});
