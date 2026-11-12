/**
 * @file Builds the single GitHub Actions run summary from per-job test logs and job metadata.
 *
 * Jobs record raw test output (`<suite>.log`) or Vitest JSON (`<suite>.vitest.json`) with
 * `record.sh`; the final `summary` job parses those files and renders one Markdown report.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @typedef {{suite: string, name: string, status: 'passed'|'failed'|'skipped', duration: number|null}} TestResult */

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const MAX_NAME = 110;
const MAX_BYTES = 900_000;

/**
 * Remove ANSI escape sequences from CI output.
 * @param {string} text Raw log text.
 * @returns {string} Text without colour codes.
 */
export function stripAnsi(text) {
  return text.replace(ANSI, '');
}

/**
 * Parse `cargo test` result lines such as `test project::tests::saves ... ok`.
 * @param {string} text Log text.
 * @returns {Array<Omit<TestResult, 'suite'>>} One entry per test line, in order.
 */
export function parseCargoOutput(text) {
  const found = [];
  for (const line of stripAnsi(text).split(/\r?\n/)) {
    const match = /^test (\S+) \.\.\. (ok|FAILED|ignored)\b/.exec(line);
    if (match) found.push({ name: match[1], status: match[2] === 'ok' ? 'passed' : match[2] === 'FAILED' ? 'failed' : 'skipped', duration: null });
  }
  return found;
}

/**
 * Parse the Node.js test runner `spec` reporter (`✔ name (1.2ms)` lines).
 * @param {string} text Log text.
 * @returns {Array<Omit<TestResult, 'suite'>>} One entry per test line, in order; the repeated failure recap is removed by {@link parseLog}.
 */
export function parseSpecOutput(text) {
  const found = [];
  for (const line of stripAnsi(text).split(/\r?\n/)) {
    const match = /^\s*(✔|✖|﹣)\s+(.+?)\s+\(([\d.]+)ms\)(?:\s+#\s*SKIP.*)?\s*$/.exec(line);
    if (match) found.push({ name: match[2], status: match[1] === '✔' ? 'passed' : match[1] === '✖' ? 'failed' : 'skipped', duration: Number(match[3]) });
  }
  return found;
}

/**
 * Parse TAP version 13 output, the default `node --test` reporter on Node 22 when not attached to a terminal.
 * File-level entries (names that are script paths) are ignored; `# SKIP` marks a skipped test and the
 * `duration_ms` field of the YAML block that follows each result gives the duration.
 * @param {string} text Log text.
 * @returns {Array<Omit<TestResult, 'suite'>>} One entry per `ok` / `not ok` line, in order.
 */
export function parseTapOutput(text) {
  const found = [];
  let current = null;
  for (const line of stripAnsi(text).split(/\r?\n/)) {
    const result = /^\s*(not ok|ok) \d+ - (.+?)(\s+# (SKIP|TODO)\b.*)?\s*$/.exec(line);
    if (result) {
      current = null;
      if (/\.(mjs|cjs|js|ts)$/.test(result[2])) continue;
      current = { name: result[2], status: result[4] ? 'skipped' : result[1] === 'ok' ? 'passed' : 'failed', duration: null };
      found.push(current);
      continue;
    }
    const duration = current && /^\s*duration_ms: ([\d.]+)\s*$/.exec(line);
    if (duration) { current.duration = Number(duration[1]); current = null; }
  }
  return found;
}

/**
 * Parse a Vitest JSON report (Jest-compatible `testResults` layout).
 * @param {unknown} report Parsed JSON document.
 * @returns {Array<Omit<TestResult, 'suite'>>} One entry per assertion.
 */
export function parseVitestJson(report) {
  const found = [];
  const files = Array.isArray(report?.testResults) ? report.testResults : [];
  for (const file of files) {
    const base = String(file.name ?? '').replace(/^.*[\\/]tests[\\/]/, 'tests/').replaceAll('\\', '/');
    for (const test of file.assertionResults ?? []) {
      const status = test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'skipped';
      found.push({ name: `${base} › ${test.fullName ?? test.title}`, status, duration: Number.isFinite(test.duration) ? test.duration : null });
    }
  }
  return found;
}

/**
 * Parse any recorded text log (cargo, Node `spec` and/or TAP lines) and drop duplicate names.
 * @param {string} text Log text.
 * @returns {Array<Omit<TestResult, 'suite'>>} Unique tests; the first occurrence wins.
 */
export function parseLog(text) {
  const seen = new Set();
  return [...parseCargoOutput(text), ...parseSpecOutput(text), ...parseTapOutput(text)].filter((test) => !seen.has(test.name) && seen.add(test.name));
}

/**
 * Read every `results-<job>/` directory produced by `actions/download-artifact`.
 * @param {string} dir Root directory containing one sub-directory per job artifact.
 * @returns {Map<string, TestResult[]>} Tests keyed by job name; unreadable files are skipped.
 */
export function loadResults(dir) {
  const results = new Map();
  for (const entry of readdirSync(dir)) {
    const jobDir = join(dir, entry);
    if (!entry.startsWith('results-') || !statSync(jobDir).isDirectory()) continue;
    const tests = [];
    for (const file of readdirSync(jobDir)) {
      try {
        const body = readFileSync(join(jobDir, file), 'utf8');
        const json = file.endsWith('.vitest.json');
        const suite = file.replace(/\.vitest\.json$|\.log$/, '');
        const parsed = json ? parseVitestJson(JSON.parse(body)) : file.endsWith('.log') ? parseLog(body) : [];
        for (const test of parsed) tests.push({ suite, ...test });
      } catch { /* A damaged log must not hide the other results. */ }
    }
    results.set(entry.slice('results-'.length), tests);
  }
  return results;
}

/**
 * Format a duration in seconds for people.
 * @param {number|null} seconds Duration, or null when unknown.
 * @returns {string} For example `2 min 05 s`.
 */
export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${String(Math.round(seconds % 60)).padStart(2, '0')} s` : `${Math.round(seconds)} s`;
}

const JOB_ICON = { success: '✅', failure: '❌', cancelled: '🚫', skipped: '⏭️', timed_out: '⏱️' };
const TEST_ICON = { passed: '✅', failed: '❌', skipped: '⏭️' };
const ORDER = { failed: 0, skipped: 1, passed: 2 };

const cell = (value) => String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').slice(0, MAX_NAME);
const jobSeconds = (job) => (job.started_at && job.completed_at ? (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000 : null);
const count = (tests, status) => tests.filter((test) => test.status === status).length;

/**
 * Render the single run summary.
 * @param {{jobs: Array<{name: string, conclusion: string|null, status?: string, started_at?: string, completed_at?: string, html_url?: string, steps?: Array<{name: string, conclusion: string|null}>}>, results: Map<string, TestResult[]>}} input Job metadata from the Actions API and parsed tests keyed by job name.
 * @returns {string} Markdown, kept below the GitHub summary size limit.
 */
export function buildSummary({ jobs, results }) {
  const visible = jobs.filter((job) => job.name !== 'summary');
  const ran = visible.filter((job) => job.conclusion !== 'skipped');
  const skipped = visible.filter((job) => job.conclusion === 'skipped').map((job) => job.name).sort();
  const failedRank = (job) => (['failure', 'cancelled', 'timed_out'].includes(job.conclusion) ? 0 : 1);
  ran.sort((a, b) => failedRank(a) - failedRank(b) || a.name.localeCompare(b.name));

  const all = [...results.values()].flat();
  const failedJobs = ran.filter((job) => failedRank(job) === 0).length;
  const lines = ['# Resultado da execução', ''];
  lines.push(`**Jobs:** ${ran.length - failedJobs} ✅ · ${failedJobs} ❌ · ${skipped.length} ⏭️ — **Testes:** ${count(all, 'passed')} ✅ · ${count(all, 'failed')} ❌ · ${count(all, 'skipped')} ⏭️`, '');

  let compact = false;
  const render = () => {
    const out = [...lines];
    for (const job of ran) {
      const tests = (results.get(job.name) ?? []).slice().sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.suite.localeCompare(b.suite) || a.name.localeCompare(b.name));
      out.push(`## ${JOB_ICON[job.conclusion] ?? '⏳'} ${job.name} — ${formatSeconds(jobSeconds(job))}`, '');
      if (job.html_url) out.push(`[Ver logs do job](${job.html_url})`, '');
      const badSteps = (job.steps ?? []).filter((step) => step.conclusion === 'failure').map((step) => `\`${step.name}\``);
      if (badSteps.length) out.push(`**Etapas com falha:** ${badSteps.join(', ')}`, '');
      if (!tests.length) { out.push('_Nenhum teste registrado neste job._', ''); continue; }
      const suites = [...new Set(tests.map((test) => test.suite))].sort();
      out.push('| Suíte | ✅ Passou | ❌ Falhou | ⏭️ Pulou |', '| --- | ---: | ---: | ---: |');
      for (const suite of suites) {
        const own = tests.filter((test) => test.suite === suite);
        out.push(`| ${cell(suite)} | ${count(own, 'passed')} | ${count(own, 'failed')} | ${count(own, 'skipped')} |`);
      }
      out.push('');
      const bad = tests.filter((test) => test.status !== 'passed');
      const shown = compact ? bad : tests;
      if (shown.length) {
        out.push(`<details${count(tests, 'failed') ? ' open' : ''}><summary>${compact ? 'Falhas e pulados' : 'Testes executados'} (${shown.length})</summary>`, '', '| Status | Suíte | Teste | Duração |', '| :---: | --- | --- | ---: |');
        for (const test of shown) out.push(`| ${TEST_ICON[test.status]} | ${cell(test.suite)} | ${cell(test.name)} | ${test.duration == null ? '–' : `${test.duration.toFixed(1)} ms`} |`);
        out.push('', '</details>', '');
      }
    }
    if (skipped.length) out.push(`_Jobs pulados: ${skipped.join(', ')}._`, '');
    if (compact) out.push('_A lista completa de testes aprovados foi omitida para respeitar o limite de tamanho da summary._', '');
    return out.join('\n');
  };
  let markdown = render();
  if (Buffer.byteLength(markdown) > MAX_BYTES) { compact = true; markdown = render(); }
  return markdown;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [jobsFile, resultsDir] = process.argv.slice(2);
    if (!jobsFile || !resultsDir) throw new Error('Usage: node summary.mjs <jobs.json> <results-dir>');
    const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
    process.stdout.write(buildSummary({ jobs, results: loadResults(resultsDir) }));
  } catch (error) {
    console.error(`Summary failed: ${error.message}`);
    process.exitCode = 1;
  }
}
