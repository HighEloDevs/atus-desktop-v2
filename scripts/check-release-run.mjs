/** Check a GitHub Actions run and its jobs before release processing. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { requireReleaseGates } from './release-gates.mjs';

/**
 * Check the trusted API response for a successful main-branch push run.
 * @param {object} run GitHub Actions run metadata.
 * @param {Array<object>} jobs All jobs for the run, including pagination.
 * @returns {void}
 * @throws {Error} When run metadata or required gates are invalid.
 */
export function checkReleaseRun(run, jobs) {
  if (!run || run.name !== 'Build desktop' || run.path !== '.github/workflows/build.yml' || run.event !== 'push' || run.head_branch !== 'main' || run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('Release requires a successful Build desktop push to main');
  }
  requireReleaseGates(jobs.map((job) => ({ name: job.name, conclusion: job.conclusion, sha: run.head_sha })), run.head_sha);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [runPath, jobsPath] = process.argv.slice(2);
    if (!runPath || !jobsPath) throw new Error('Usage: check-release-run.mjs <run.json> <jobs.json>');
    checkReleaseRun(JSON.parse(readFileSync(runPath)), JSON.parse(readFileSync(jobsPath)));
    console.log('Release gates verified');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
