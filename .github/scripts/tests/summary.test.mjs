/** Regression tests for the single run summary built from recorded test logs. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSummary, formatSeconds, loadResults, parseCargoOutput, parseLog, parseSpecOutput, parseVitestJson } from '../summary/summary.mjs';

const cargo = `running 3 tests
test project::tests::saves ... \u001b[32mok\u001b[0m
test project::tests::reopens ... FAILED
test project::tests::slow ... ignored, reason
test result: FAILED. 1 passed; 1 failed; 1 ignored
`;
const spec = `✔ opens the window (12.5ms)
✖ saves a project (3.2ms)
﹣ skipped on purpose (0.1ms) # SKIP
ℹ tests 3
✖ failing tests:
✖ saves a project (3.2ms)
`;

test('parses cargo results including colours, failures and ignored tests', () => {
  assert.deepEqual(parseCargoOutput(cargo).map((t) => [t.name, t.status]), [
    ['project::tests::saves', 'passed'], ['project::tests::reopens', 'failed'], ['project::tests::slow', 'skipped'],
  ]);
});

test('parses spec results and drops the repeated failure recap', () => {
  assert.equal(parseSpecOutput(spec).length, 4);
  const tests = parseLog(spec);
  assert.deepEqual(tests.map((t) => [t.name, t.status, t.duration]), [
    ['opens the window', 'passed', 12.5], ['saves a project', 'failed', 3.2], ['skipped on purpose', 'skipped', 0.1],
  ]);
});

test('parses a Vitest JSON report', () => {
  const tests = parseVitestJson({ testResults: [{ name: '/repo/src/frontend/tests/unit/a.test.mjs', assertionResults: [
    { fullName: 'a works', status: 'passed', duration: 4 }, { title: 'b breaks', status: 'failed' }, { fullName: 'c', status: 'pending' },
  ] }] });
  assert.deepEqual(tests.map((t) => [t.name, t.status]), [
    ['tests/unit/a.test.mjs › a works', 'passed'], ['tests/unit/a.test.mjs › b breaks', 'failed'], ['tests/unit/a.test.mjs › c', 'skipped'],
  ]);
});

test('formats durations', () => {
  assert.equal(formatSeconds(42), '42 s');
  assert.equal(formatSeconds(125), '2 min 05 s');
  assert.equal(formatSeconds(null), '–');
});

const jobs = [
  { name: 'test-linux', conclusion: 'success', started_at: '2026-11-12T00:00:00Z', completed_at: '2026-11-12T00:02:05Z', html_url: 'https://example.test/1' },
  { name: 'integration-linux', conclusion: 'failure', started_at: '2026-11-12T00:00:00Z', completed_at: '2026-11-12T00:00:40Z', steps: [{ name: 'Run desktop smoke on Linux', conclusion: 'failure' }] },
  { name: 'build-linux', conclusion: 'skipped' },
  { name: 'summary', conclusion: null },
];
const suite = (name, status, extra = {}) => ({ suite: 'rust', name, status, duration: null, ...extra });

test('groups by job, lists failed jobs first and failing tests first inside each job', () => {
  const results = new Map([
    ['test-linux', [suite('b::ok', 'passed'), suite('a::ok', 'passed'), suite('z|pipe', 'failed')]],
    ['integration-linux', [{ suite: 'smoke', name: 'creates a project', status: 'failed', duration: 7 }]],
  ]);
  const md = buildSummary({ jobs, results });
  assert.ok(md.indexOf('## ❌ integration-linux') < md.indexOf('## ✅ test-linux'));
  assert.ok(md.includes('**Etapas com falha:** `Run desktop smoke on Linux`'));
  assert.ok(md.indexOf('z\\|pipe') < md.indexOf('a::ok') && md.indexOf('a::ok') < md.indexOf('b::ok'));
  assert.ok(md.includes('<details open>'));
  assert.ok(md.includes('_Jobs pulados: build-linux._'));
  assert.ok(!md.includes('## ✅ summary') && !md.includes('## ⏳ summary'));
  assert.match(md, /\*\*Testes:\*\* 2 ✅ · 2 ❌ · 0 ⏭️/);
  assert.match(md, /\| rust \| 2 \| 1 \| 0 \|/);
});

test('omits passing tests only when the summary would exceed the size limit', () => {
  const many = Array.from({ length: 12000 }, (_, i) => suite(`module::very_long_test_name_number_${i}_${'x'.repeat(60)}`, 'passed'));
  const md = buildSummary({ jobs, results: new Map([['test-linux', [...many, suite('only::failure', 'failed')]]]) });
  assert.ok(Buffer.byteLength(md) < 1_000_000);
  assert.ok(md.includes('only::failure'));
  assert.ok(md.includes('lista completa de testes aprovados foi omitida'));
});

test('loads recorded logs and Vitest JSON from downloaded artifacts and tolerates damaged files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-summary-'));
  try {
    mkdirSync(join(dir, 'results-test-linux'));
    writeFileSync(join(dir, 'results-test-linux', 'rust.log'), cargo);
    writeFileSync(join(dir, 'results-test-linux', 'frontend.vitest.json'), JSON.stringify({ testResults: [{ name: 'x.test.mjs', assertionResults: [{ fullName: 't', status: 'passed' }] }] }));
    writeFileSync(join(dir, 'results-test-linux', 'broken.vitest.json'), '{ not json');
    mkdirSync(join(dir, 'unrelated'));
    const results = loadResults(dir);
    assert.deepEqual([...results.keys()], ['test-linux']);
    assert.deepEqual(results.get('test-linux').map((t) => t.suite).sort(), ['frontend', 'rust', 'rust', 'rust']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('record.sh keeps the exit status and appends the command output to the suite log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-record-'));
  try {
    const env = { ...process.env, RUNNER_TEMP: dir };
    const ok = spawnSync('bash', ['.github/scripts/summary/record.sh', 'demo', 'echo', 'hello'], { encoding: 'utf8', env });
    assert.equal(ok.status, 0);
    const bad = spawnSync('bash', ['.github/scripts/summary/record.sh', 'demo', 'bash', '-c', 'echo boom; exit 3'], { encoding: 'utf8', env });
    assert.equal(bad.status, 3);
    const log = spawnSync('cat', [join(dir, 'test-logs', 'demo.log')], { encoding: 'utf8' }).stdout;
    assert.equal(log, 'hello\nboom\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
