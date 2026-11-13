/**
 * Guards the layout of the pipeline files: tests mirror the files they test, scripts follow the
 * `<verb>-<object>` naming rule, and every path the workflow mentions exists.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const VERBS = ['install', 'configure', 'run', 'smoke', 'check', 'collect', 'report', 'strip', 'publish', 'press'];
const DATA_FILES = ['rust-source-inventory.json'];

/** List every file below a directory, as POSIX paths relative to the repository root. */
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [relative('.', path).replaceAll('\\', '/')];
  });
}

const scripts = files('.github/scripts').filter((file) => !file.endsWith('README.md'));
const tests = files('.github/tests');
const workflow = readFileSync('.github/workflows/build.yml', 'utf8');

test('every script is named <verb>-<object> and lives in shared, linux, macos or windows', () => {
  for (const file of scripts) {
    const [, , group, ...rest] = file.split('/');
    assert.ok(['shared', 'linux', 'macos', 'windows'].includes(group), file);
    const name = rest.at(-1);
    if (DATA_FILES.includes(name)) continue;
    assert.match(name, new RegExp(`^(${VERBS.join('|')})-[a-z0-9]+(-[a-z0-9]+)*\\.(mjs|sh|ps1|py)$`), file);
  }
});

test('every test mirrors a script, a workflow or a repository file', () => {
  for (const file of tests.filter((item) => item !== '.github/tests/layout.test.mjs')) {
    assert.match(file, /\.test\.(mjs|ps1|py)$/, file);
    const stem = file.replace(/\.test\.(mjs|ps1|py)$/, '');
    const [, , area, ...rest] = stem.split('/');
    if (area === 'scripts') {
      const mirrored = scripts.some((script) => script.replace(/\.[^.]+$/, '') === join('.github/scripts', ...rest).replaceAll('\\', '/'));
      assert.ok(mirrored, `${file} has no script to test`);
    } else {
      assert.ok(['repo', 'rulesets', 'workflows'].includes(area), file);
    }
  }
});

test('every path the workflow mentions under .github exists', () => {
  const mentioned = new Set(workflow.match(/\.github\/(?:scripts|tests)\/[\w./-]+/g));
  for (const path of mentioned) {
    if (path.includes('*')) continue;
    assert.ok(existsSync(path), path);
  }
});

test('the workflow runs every test file', () => {
  // Turn each quoted or bare .github/tests glob of the workflow into a regular expression.
  const globs = [...workflow.matchAll(/\.github\/tests\/[\w./*-]+/g)].map((match) => match[0]);
  const patterns = globs.map((glob) => new RegExp(`^${glob.replaceAll('.', '\\.').replaceAll('**/', '(.+/)?').replaceAll('*', '[^/]*')}$`));
  for (const file of tests.filter((item) => item !== '.github/tests/layout.test.mjs')) {
    assert.ok(patterns.some((pattern) => pattern.test(file)), `${file} is not run by any job`);
  }
});
