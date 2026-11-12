/** Verify release artifacts against independently supplied identity and inventory. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function validateExpected(expected) {
  if (!expected || !/^[0-9a-f]{40}$/.test(expected.sha) || typeof expected.version !== 'string' || !expected.version ||
      !Array.isArray(expected.names) || expected.names.length === 0 ||
      new Set(expected.names).size !== expected.names.length ||
      expected.names.some((name) => typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(name) || basename(name) !== name)) {
    throw new Error('Invalid trusted release metadata');
  }
}

function artifactDigest(directory, name) {
  const path = join(directory, name);
  if (!lstatSync(path).isFile()) throw new Error(`Not a regular artifact: ${name}`);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Create a manifest from a trusted inventory after its build jobs succeed.
 *
 * @param {string} directory Directory containing artifact files.
 * @param {{sha: string, version: string, names: string[]}} expected Trusted release identity and exact inventory.
 * @returns {{sha: string, version: string, artifacts: Array<{name: string, sha256: string}>}} Manifest of artifact digests.
 * @throws {Error} If identity, inventory, or an artifact is invalid.
 */
export function createManifest(directory, expected) {
  validateExpected(expected);
  return {
    sha: expected.sha,
    version: expected.version,
    artifacts: [...expected.names].sort().map((name) => ({ name, sha256: artifactDigest(directory, name) })),
  };
}

/**
 * Format validated artifact digests in the conventional SHA-256 checksum format.
 *
 * @param {{sha: string, version: string, artifacts: Array<{name: string, sha256: string}>}} manifest Created manifest.
 * @returns {string} Sorted checksums ending in a newline.
 * @throws {Error} If metadata, names, or digests are invalid.
 */
export function formatChecksums(manifest) {
  if (!manifest || !Array.isArray(manifest.artifacts)) throw new Error('Invalid manifest');
  validateExpected({ sha: manifest.sha, version: manifest.version, names: manifest.artifacts.map((item) => item?.name) });
  if (manifest.artifacts.some((item) => !/^[0-9a-f]{64}$/.test(item.sha256))) throw new Error('Invalid SHA-256');
  return [...manifest.artifacts].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .map(({ name, sha256 }) => `${sha256}  ${name}\n`).join('');
}

/**
 * Verify a manifest against trusted release metadata and artifact bytes.
 *
 * @param {{sha: string, version: string, artifacts: Array<{name: string, sha256: string}>}} manifest Untrusted manifest.
 * @param {string} directory Directory containing the artifact files.
 * @param {{sha: string, version: string, names: string[]}} expected Trusted commit, version, and exact artifact names.
 * @returns {void}
 * @throws {Error} If metadata, inventory, file type, or SHA-256 does not match.
 */
export function verifyManifest(manifest, directory, expected) {
  validateExpected(expected);
  if (!manifest || manifest.sha !== expected.sha || manifest.version !== expected.version || !Array.isArray(manifest.artifacts)) {
    throw new Error('Release identity does not match');
  }
  const names = manifest.artifacts.map((item) => item?.name);
  if (names.length !== expected.names.length || new Set(names).size !== names.length || expected.names.some((name) => !names.includes(name))) {
    throw new Error('Artifact inventory does not match');
  }
  for (const artifact of manifest.artifacts) {
    if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) throw new Error('Invalid SHA-256');
    const digest = artifactDigest(directory, artifact.name);
    if (digest !== artifact.sha256) throw new Error(`SHA-256 mismatch: ${artifact.name}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, manifestPath, sha, version, ...names] = process.argv.slice(2);
    if (command !== 'verify' || !manifestPath || !sha || !version || names.length === 0) {
      throw new Error('Usage: release.mjs verify <manifest.json> <sha> <version> <artifact-name>...');
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    verifyManifest(manifest, dirname(resolve(manifestPath)), { sha, version, names });
    console.log('Release manifest verified');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
