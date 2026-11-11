/** Verify release artifacts against independently supplied identity and inventory. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  if (!/^[0-9a-f]{40}$/.test(expected.sha) || !expected.version ||
      !Array.isArray(expected.names) || expected.names.length === 0 ||
      new Set(expected.names).size !== expected.names.length ||
      expected.names.some((name) => typeof name !== 'string' || !name || name === '.' || name === '..' || basename(name) !== name || name.includes('\\'))) {
    throw new Error('Invalid trusted release metadata');
  }
  if (!manifest || manifest.sha !== expected.sha || manifest.version !== expected.version || !Array.isArray(manifest.artifacts)) {
    throw new Error('Release identity does not match');
  }
  const names = manifest.artifacts.map((item) => item?.name);
  if (names.length !== expected.names.length || new Set(names).size !== names.length || expected.names.some((name) => !names.includes(name))) {
    throw new Error('Artifact inventory does not match');
  }
  for (const artifact of manifest.artifacts) {
    if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) throw new Error('Invalid SHA-256');
    const path = join(directory, artifact.name);
    if (!lstatSync(path).isFile()) throw new Error(`Not a regular artifact: ${artifact.name}`);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
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
