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
  assert.match(workflow, /^  integration-macos-arm64:\n(?:    .*\n)*?    runs-on: macos-latest$/m);
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
  const all = [...workflow.matchAll(/^  ([a-z][\w-]*):\n(?:    .*\n)*?    (?:runs-on|needs):/gm)].map((m) => m[1]).filter((n) => n !== 'summary');
  for (const name of all) assert.ok(new RegExp(`needs: \\[[^\\]]*\\b${name}\\b`).test(summary), `summary must wait for ${name}`);
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

test('release artifact gate requires every package job to have succeeded', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replaceAll('\r\n', '\n');
  const job = workflow.split('  release-artifacts:\n')[1].split(/^  [\w-]+:/m)[0];
  // failure() and cancelled() ignore a cancelled or skipped dependency, so check each result.
  assert.match(job, /^ {4}if: \$\{\{ !cancelled\(\) && /m);
  assert.doesNotMatch(job, /!failure\(\)/);
  for (const name of ['release-version', 'build-linux', 'build-windows', 'build-macos-intel', 'build-macos-arm64']) {
    assert.ok(job.includes(`needs.${name}.result == 'success'`), name);
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
  assert.match(job, /^ {4}if: \$\{\{ !cancelled\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && needs\.release-artifacts\.result == 'success' \}\}$/m);
  assert.match(job, /^ {4}permissions:\n {6}contents: write$/m);
  for (const name of ['release-version', 'release-artifacts', 'test-linux', 'test-macos-arm64', 'integration-linux', 'integration-windows', 'integration-macos-arm64', 'integration-macos-intel', 'build-linux', 'build-windows', 'build-macos-intel', 'build-macos-arm64']) {
    assert.match(job, new RegExp(`needs: \\[[^\\]]*\\b${name}\\b`), name);
  }
  assert.ok(job.includes('release-gates.mjs') && job.includes('publish-release.mjs'));
  // Write access to repository contents must stay confined to this job.
  assert.equal([...workflow.matchAll(/contents: write/g)].length, 1);
});
