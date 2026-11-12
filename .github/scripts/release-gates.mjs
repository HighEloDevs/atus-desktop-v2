/** Validate the results of the jobs a release depends on before it may be published. */
export const REQUIRED_RELEASE_GATES = Object.freeze([
  'release-version', 'release-artifacts', 'coverage-rust', 'coverage-frontend',
  'coverage-cpp', 'integration-linux', 'integration-windows', 'integration-macos-arm64',
  'integration-macos-intel', 'install-linux-deb', 'install-linux-rpm',
  'install-linux-appimage', 'install-windows', 'install-macos-arm64',
  'install-macos-intel',
]);

const JOB_EVIDENCE = Object.freeze({
  'coverage-frontend': 'test-linux',
  'coverage-cpp': 'test-linux',
  'coverage-rust': 'test-macos-arm64',
  'install-windows': 'build-windows',
  'install-macos-arm64': 'build-macos-arm64',
  'install-macos-intel': 'build-macos-intel',
  'install-linux-deb': 'build-linux',
  'install-linux-rpm': 'build-linux',
  'install-linux-appimage': 'build-linux',
});

/**
 * Require each named release gate to finish successfully for the same commit.
 * @param {Array<{name: string, conclusion: string, sha: string}>} jobs Trusted job results from the release workflow.
 * @param {string} sha Exact commit to publish.
 * @returns {void}
 * @throws {Error} When a result is missing, ambiguous, unsuccessful or belongs to another commit.
 */
export function requireReleaseGates(jobs, sha) {
  if (!Array.isArray(jobs) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release gate input');
  for (const name of REQUIRED_RELEASE_GATES) {
    const matching = jobs.filter((job) => job?.name === (JOB_EVIDENCE[name] ?? name));
    if (matching.length !== 1 || matching[0].conclusion !== 'success' || matching[0].sha !== sha) {
      throw new Error(`Release gate not satisfied: ${name}`);
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    // NEEDS_JSON is `toJSON(needs)` from the publishing job: { "<job>": { "result": "success" }, ... }.
    const needs = JSON.parse(process.env.NEEDS_JSON ?? '');
    const sha = process.env.RELEASE_SHA ?? '';
    requireReleaseGates(Object.entries(needs).map(([name, job]) => ({ name, conclusion: job.result, sha })), sha);
    console.log('Release gates verified');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
