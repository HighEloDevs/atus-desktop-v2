/** Prepare and publish artifacts from a previously verified CI run. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, lstatSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createManifest, formatChecksums, verifyManifest } from './release.mjs';
import { pathToFileURL } from 'node:url';

/** Select exactly one regular file per expected build artifact. */
export function selectArtifacts(root) {
  const specs = [
    ['linux-bundles', '.deb', 'atus-linux.deb'], ['linux-bundles', '.rpm', 'atus-linux.rpm'],
    ['linux-bundles', '.AppImage', 'atus-linux.AppImage'], ['windows-installer', '.exe', 'atus-windows.exe'],
    ['macos-arm64-app', '.zip', 'atus-macos-arm64.zip'], ['macos-intel-app', '.zip', 'atus-macos-intel.zip'],
  ];
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink in artifacts');
      return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
    });
  }
  return specs.map(([folder, suffix, name]) => {
    const candidates = walk(join(root, folder)).filter((path) => basename(path).endsWith(suffix));
    if (candidates.length !== 1 || !lstatSync(candidates[0]).isFile()) throw new Error(`Expected exactly one ${folder} ${suffix}`);
    return { path: candidates[0], name };
  });
}

/** Validate a version and return whether it is a prerelease. */
export function prerelease(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.test(version)) throw new Error('Invalid release version');
  const part = version.split('-').slice(1).join('-');
  if (part.split('.').some((id) => /^\d+$/.test(id) && id.length > 1 && id.startsWith('0'))) throw new Error('Invalid prerelease identifier');
  return Boolean(part);
}
/** Return files absent from a draft, rejecting collisions with different bytes. */
export function missingAssets(files, assets, digests) {
  return files.filter((name) => {
    const matches = assets.filter((asset) => asset.name === name);
    if (matches.length > 1 || (matches.length === 1 && (matches[0].state !== 'uploaded' || matches[0].digest !== `sha256:${digests[name]}`))) {
      throw new Error(`Existing asset conflicts: ${name}`);
    }
    return matches.length === 0;
  });
}
/**
 * Select the release with a given tag from a list of releases.
 * The get-release-by-tag endpoint never returns drafts, so drafts must be found by listing releases.
 * @param {Array<{tag_name: string}>} releases Releases as returned by `GET /repos/{repo}/releases`.
 * @param {string} tag Tag name, such as `v0.2.0`.
 * @returns {object|null} The matching release, or null when there is none.
 * @throws {Error} When several releases share the tag.
 */
export function pickRelease(releases, tag) {
  const matches = releases.filter((release) => release.tag_name === tag);
  if (matches.length > 1) throw new Error(`Several releases use tag ${tag}`);
  return matches[0] ?? null;
}
function gh(args) { return execFileSync('gh', args, { encoding: 'utf8' }); }
function findRelease(repository, tag) {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`]));
  return pickRelease(pages.flat(), tag);
}
function apiOptional(path) {
  const result = spawnSync('gh', ['api', path], { encoding: 'utf8' });
  if (result.status === 0) return JSON.parse(result.stdout);
  if (/HTTP 404\b/.test(result.stderr)) return null;
  throw new Error(`GitHub API failed: ${result.stderr}`);
}

/** Publish only the exact verified commit and artifact inventory. */
export function publish({ run, artifacts, repository }) {
  const sha = run.head_sha;
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid trusted release identity');
  execFileSync('git', ['fetch', '--no-tags', 'origin', sha], { stdio: 'inherit' });
  const config = JSON.parse(execFileSync('git', ['show', `${sha}:src/desktop/tauri.conf.json`], { encoding: 'utf8' }));
  const version = config.version;
  const isPrerelease = prerelease(version);
  const tag = `v${version}`;
  const selected = selectArtifacts(artifacts);
  const directory = mkdtempSync(join(tmpdir(), 'atus-release-'));
  for (const entry of selected) copyFileSync(entry.path, join(directory, entry.name));
  const names = selected.map(({ name }) => name);
  const manifest = createManifest(directory, { sha, version, names });
  verifyManifest(manifest, directory, { sha, version, names });
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(directory, 'SHA256SUMS'), formatChecksums(manifest));
  const ref = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  if (ref && (ref.object.type !== 'commit' || ref.object.sha !== sha)) throw new Error('Tag points to another object');
  const existing = findRelease(repository, tag);
  if (existing && (!existing.draft || (!ref && existing.target_commitish !== sha))) throw new Error('Release exists or draft target does not match');
  if (!existing) {
    if (ref) throw new Error('Tag already exists without matching draft');
    const args = ['release', 'create', tag, '--repo', repository, '--target', sha, '--draft', '--generate-notes'];
    if (isPrerelease) args.push('--prerelease');
    gh(args);
  }
  let verifiedRef = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  if (!verifiedRef) {
    gh(['api', '--method', 'POST', `repos/${repository}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`]);
    verifiedRef = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  }
  if (!verifiedRef || verifiedRef.object.type !== 'commit' || verifiedRef.object.sha !== sha) throw new Error('Created tag does not match commit');
  const files = [...names, 'manifest.json', 'SHA256SUMS'];
  const draft = findRelease(repository, tag);
  if (!draft?.draft) throw new Error('Expected draft release');
  const digests = Object.fromEntries(files.map((name) => [name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')]));
  for (const name of missingAssets(files, draft.assets, digests)) {
    gh(['release', 'upload', tag, '--repo', repository, join(directory, name)]);
  }
  const release = findRelease(repository, tag);
  if (!release?.draft || release.prerelease !== isPrerelease || release.assets.length !== files.length || files.some((name) => !release.assets.some((asset) => asset.name === name && asset.state === 'uploaded'))) throw new Error('Draft assets do not match expected inventory');
  for (const name of files) {
    const asset = release.assets.find((item) => item.name === name);
    const digest = createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
    if (asset.digest !== `sha256:${digest}`) throw new Error(`Remote digest mismatch: ${name}`);
  }
  gh(['release', 'edit', tag, '--repo', repository, '--draft=false']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readFileSync } = await import('node:fs');
  try { publish({ run: JSON.parse(readFileSync(process.env.RELEASE_RUN_JSON, 'utf8')), artifacts: process.env.RELEASE_ARTIFACTS, repository: process.env.REPOSITORY }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
