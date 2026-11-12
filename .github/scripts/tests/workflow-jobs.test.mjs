/** Check the desktop workflow exposes each supported platform separately. */
import { existsSync, readFileSync } from 'node:fs';
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
    assert.ok(job.includes(`needs: [test-${platform}, integration-${platform}]`), platform);
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

test('desktop smoke jobs cover both macOS architectures', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /^  coverage-rust:$/m);
  assert.match(workflow, /^  test-macos-arm64:\n(?:    .*\n)*?    runs-on: macos-15$/m);
  assert.match(workflow, /^  integration-macos-intel:\n(?:    .*\n)*?    runs-on: macos-15-intel$/m);
  assert.match(workflow, /^  integration-macos-arm64:\n(?:    .*\n)*?    runs-on: macos-15$/m);
  // arm64 coverage gate plus the plain smoke on each macOS architecture.
  assert.equal((workflow.match(/\.github\/scripts\/coverage\/rust-desktop-macos\.sh/g) ?? []).length, 3);
  assert.equal((workflow.match(/rust-desktop-macos\.sh --no-coverage/g) ?? []).length, 2);
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
  assert.deepEqual(names.sort(), ['integration-linux', 'integration-macos-arm64', 'integration-macos-intel', 'integration-windows', 'test-linux', 'test-macos-arm64', 'test-macos-intel', 'test-windows']);
  for (const name of names) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.ok(job.includes('needs: [check-version, release-version]'), name);
    assert.ok(job.includes('if: ${{ !failure() && !cancelled()'), name);
  }
});

test('macOS integration smoke runs without coverage instrumentation', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const name of ['integration-macos-intel', 'integration-macos-arm64']) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.ok(job.includes('rust-desktop-macos.sh --no-coverage'), name);
    assert.ok(!job.includes('llvm-tools-preview'), name);
  }
});

test('every Rust-compiling job restores the Cargo cache from the desktop workspace', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const names = [...workflow.matchAll(/^  ((?:test|integration|build)-[\w-]+):$/gm)].map((m) => m[1]);
  assert.equal(names.length, 12);
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

test('Linux desktop smoke retries temporary directory removal while helper processes exit', () => {
  const runner = readFileSync('.github/scripts/desktop-e2e/run-linux.sh', 'utf8');
  assert.match(runner, /rmSync\(process\.argv\[1\], \{[^}]*maxRetries: \d+[^}]*retryDelay: \d+/);
  assert.match(runner, /Warning: could not fully remove/);
});

test('each Rust-compiling job keeps its own Cargo cache', () => {
  // Measured: sharing one cache between test-* and integration-* made the test jobs slower,
  // because the desktop-e2e feature changes the feature set of shared dependencies.
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /shared-key:|save-if:/);
});

test('every test and integration job records its results and the summary job is the only report writer', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const names = [...workflow.matchAll(/^  ((?:test|integration)-[\w-]+):$/gm)].map((m) => m[1]);
  assert.equal(names.length, 8);
  for (const name of names) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.ok(job.includes('record.sh'), `${name} must record its test output`);
    assert.match(job, /- uses: \.\/\.github\/actions\/upload-test-logs\n\s+if: \$\{\{ always\(\) \}\}\n*$/, name);
  }
  const summary = workflow.split('  summary:\n')[1];
  assert.ok(summary.includes('continue-on-error: true'));
  assert.ok(summary.includes('if: ${{ always() }}'));
  assert.match(summary, /^ {4}needs: \[publish-release\]$/m);
  assert.equal((workflow.match(/GITHUB_STEP_SUMMARY/g) ?? []).length, 1);
});

test('macOS test and integration jobs run for pull requests only when they target main', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const guard = "if: ${{ !failure() && !cancelled() && (github.event_name != 'pull_request' || github.base_ref == 'main') }}";
  for (const name of ['test-macos-arm64', 'test-macos-intel', 'integration-macos-arm64', 'integration-macos-intel']) {
    assert.ok(workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0].includes(guard), name);
  }
  for (const name of ['test-linux', 'test-windows', 'integration-linux', 'integration-windows']) {
    assert.ok(!workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0].includes('base_ref'), name);
  }
});

test('package jobs and the release gate survive the skipped pull-request version check', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  // A skipped ancestor (check-version on pushes, release-version on dispatch) skips dependents
  // unless their condition calls a status function.
  for (const name of ['build-linux', 'build-windows', 'build-macos-intel', 'build-macos-arm64']) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.match(job, /^ {4}if: \$\{\{ !failure\(\) && !cancelled\(\) && /m, name);
  }
});

test('pre-release versions are packaged as RPM Version plus Release', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  build-linux:\n')[1].split(/^  [\w-]+:/m)[0];
  assert.ok(job.includes('--bundles deb,appimage'));
  assert.ok(job.includes('"release":"0.%s"'), 'RPM release carries the pre-release identifier');
  assert.ok(job.includes('--bundles rpm --config'));
  assert.doesNotMatch(job, /--bundles deb,rpm/);
});

test('Windows smoke waits for the asynchronous NSIS uninstaller', () => {
  const script = readFileSync('.github/scripts/ci/smoke-windows-installer.ps1', 'utf8').replaceAll('\r\n', '\n');
  const wait = script.indexOf('Start-Sleep -Milliseconds 500', script.indexOf('Start-Process -FilePath $uninstaller'));
  assert.ok(wait > 0 && wait < script.indexOf("throw 'Application remained installed after uninstall.'"));
});

test('releases are published by a job of the build workflow, not by a separate workflow', () => {
  assert.equal(existsSync('.github/workflows/release.yml'), false);
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  publish-release:\n')[1].split(/^  [\w-]+:/m)[0];
  assert.match(job, /^ {4}if: \$\{\{ !cancelled\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && needs\.build-linux\.result == 'success'/m);
  assert.match(job, /^ {4}permissions:\n {6}contents: write$/m);
  for (const name of ['build-linux', 'build-windows', 'build-macos-intel', 'build-macos-arm64']) {
    assert.ok(job.includes(`needs.${name}.result == 'success'`), name);
  }
  assert.ok(job.includes('release-gates.mjs') && job.includes('publish-release.mjs'));
  // Write access to repository contents must stay confined to this job.
  assert.equal([...workflow.matchAll(/contents: write/g)].length, 1);
});

test('job dependencies form test/integration -> build -> publish -> summary', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /release-artifacts/);
  const needs = (name) => {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    return job.match(/^ {4}needs: \[([^\]]*)\]$/m)?.[1].split(',').map((item) => item.trim()).sort();
  };
  const platforms = ['linux', 'windows', 'macos-intel', 'macos-arm64'];
  for (const platform of platforms) {
    for (const kind of ['test', 'integration']) assert.deepEqual(needs(`${kind}-${platform}`), ['check-version', 'release-version'], `${kind}-${platform}`);
    assert.deepEqual(needs(`build-${platform}`), [`integration-${platform}`, `test-${platform}`].sort(), `build-${platform}`);
  }
  assert.deepEqual(needs('publish-release'), platforms.map((platform) => `build-${platform}`).sort());
  assert.deepEqual(needs('summary'), ['publish-release']);
});

test('macOS jobs use explicit runner labels, a job timeout and an architecture check', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /macos-latest/);
  for (const [name, arch] of [['integration-macos-intel', 'x86_64'], ['test-macos-intel', 'x86_64'], ['build-macos-intel', 'x86_64'],
    ['integration-macos-arm64', 'arm64'], ['test-macos-arm64', 'arm64'], ['build-macos-arm64', 'arm64']]) {
    const job = workflow.split(`  ${name}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.match(job, /^ {4}timeout-minutes: \d+$/m, name);
    assert.ok(job.includes(`test "$(uname -m)" = ${arch}`), name);
  }
});

test('pull requests into main are accepted only from the staging branch of this repository', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  check-source-branch:\n')[1]?.split(/^  [\w-]+:/m)[0];
  assert.ok(job);
  assert.ok(job.includes("github.event_name == 'pull_request'"));
  assert.ok(job.includes("github.base_ref == 'main'"));
  assert.ok(job.includes('HEAD_REF: ${{ github.head_ref }}'));
  assert.ok(job.includes('HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}'));
  assert.ok(job.includes('"$HEAD_REF" != "staging"'));
  assert.ok(job.includes('"$HEAD_REPOSITORY" != "$GITHUB_REPOSITORY"'));
  // Branch names are attacker-controlled: they must reach the shell through env, never inline.
  assert.doesNotMatch(job.split('run:')[1], /\$\{\{/);
});

test('only pull requests into main run the macOS jobs, so staging gates on Linux and Windows', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  for (const platform of ['linux', 'windows']) {
    const job = workflow.split(`  test-${platform}:\n`)[1].split(/^  [\w-]+:/m)[0];
    assert.doesNotMatch(job, /github\.base_ref/, platform);
  }
  const macos = workflow.split('  test-macos-arm64:\n')[1].split(/^  [\w-]+:/m)[0];
  assert.ok(macos.includes("github.base_ref == 'main'"));
});
