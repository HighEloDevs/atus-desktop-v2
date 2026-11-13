/** Prepare and publish artifacts from a previously verified CI run. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, lstatSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createManifest, formatChecksums, verifyManifest } from './check-release-artifacts.mjs';
import { parseReleaseNotes, renderReleaseBody, versionFromFileName } from './check-release-notes.mjs';
import { checkSignature } from './check-updater-signatures.mjs';
import { pathToFileURL } from 'node:url';

/**
 * Release assets, the build job folder they come from, the suffix that finds them and whether the
 * bundler signs them for the updater (a `.sig` file next to the asset).
 */
export const ARTIFACTS = [
  { folder: 'linux-bundles', suffix: '.deb', name: 'atus-linux.deb', signed: true },
  { folder: 'linux-bundles', suffix: '.rpm', name: 'atus-linux.rpm', signed: true },
  { folder: 'linux-bundles', suffix: '.AppImage', name: 'atus-linux.AppImage', signed: true },
  { folder: 'windows-installer', suffix: '.exe', name: 'atus-windows.exe', signed: true },
  { folder: 'windows-installer', suffix: '.msi', name: 'atus-windows.msi', signed: true },
  { folder: 'macos-arm64-app', suffix: '.app.tar.gz', name: 'atus-macos-arm64.app.tar.gz', signed: true },
  { folder: 'macos-intel-app', suffix: '.app.tar.gz', name: 'atus-macos-intel.app.tar.gz', signed: true },
  { folder: 'macos-arm64-app', suffix: '.zip', name: 'atus-macos-arm64.zip', signed: false },
  { folder: 'macos-intel-app', suffix: '.zip', name: 'atus-macos-intel.zip', signed: false },
  { folder: 'macos-arm64-app', suffix: '.dmg', name: 'atus-macos-arm64.dmg', signed: false },
  { folder: 'macos-intel-app', suffix: '.dmg', name: 'atus-macos-intel.dmg', signed: false },
];

/**
 * Updater targets in `latest.json`, mapped to the asset that updates them. The updater looks up
 * `{os}-{arch}-{bundle}` first, so each installed format receives its own package; the bare
 * `{os}-{arch}` keys are the fallback for an app that cannot tell how it was installed.
 */
export const UPDATER_TARGETS = {
  'darwin-aarch64-app': 'atus-macos-arm64.app.tar.gz',
  'darwin-aarch64': 'atus-macos-arm64.app.tar.gz',
  'darwin-x86_64-app': 'atus-macos-intel.app.tar.gz',
  'darwin-x86_64': 'atus-macos-intel.app.tar.gz',
  'windows-x86_64-nsis': 'atus-windows.exe',
  'windows-x86_64-msi': 'atus-windows.msi',
  'windows-x86_64': 'atus-windows.exe',
  'linux-x86_64-appimage': 'atus-linux.AppImage',
  'linux-x86_64-deb': 'atus-linux.deb',
  'linux-x86_64-rpm': 'atus-linux.rpm',
  'linux-x86_64': 'atus-linux.AppImage',
};

/**
 * Select exactly one regular file per expected build artifact, and its updater signature.
 * @param {string} root Directory holding the downloaded artifacts, one folder per build job.
 * @param {string} version Release version, such as `0.2.4`.
 * @returns {Array<{path: string, name: string, signature: string|null}>} The selected files, their
 *   release asset names and, for signed assets, the path of the `.sig` file.
 * @throws {Error} When the version is not `M.m.p` or a file or signature is missing or ambiguous.
 */
export function selectArtifacts(root, version) {
  assertStableVersion(version);
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink in artifacts');
      return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
    });
  }
  return ARTIFACTS.map(({ folder, suffix, name, signed }) => {
    const files = walk(join(root, folder));
    const candidates = files.filter((path) => basename(path).endsWith(suffix));
    if (candidates.length !== 1 || !lstatSync(candidates[0]).isFile()) throw new Error(`Expected exactly one ${folder} ${suffix}`);
    if (!signed) return { path: candidates[0], name, signature: null };
    const signature = `${candidates[0]}.sig`;
    if (!files.includes(signature)) throw new Error(`Missing updater signature for ${folder} ${suffix}`);
    return { path: candidates[0], name, signature };
  });
}

/**
 * Verify every updater signature against the public key the released app trusts.
 * @param {Array<{path: string, name: string, signature: string|null}>} selected Result of {@link selectArtifacts}.
 * @param {string} publicKey `plugins.updater.pubkey` at the released commit.
 * @param {string} version Release version, which every signature must name.
 * @returns {Record<string, string>} Signature text by asset name.
 * @throws {Error} When a signature is invalid, listing every failing asset.
 */
export function verifySignatures(selected, publicKey, version) {
  const signatures = {};
  const problems = [];
  for (const { path, name, signature } of selected.filter((entry) => entry.signature)) {
    const text = readFileSync(signature, 'utf8');
    const problem = checkSignature(readFileSync(path), text, publicKey, version);
    if (problem) problems.push(`${name}: ${problem}`);
    signatures[name] = text.trim();
  }
  if (problems.length) throw new Error(`Invalid updater signatures (check TAURI_SIGNING_PRIVATE_KEY against plugins.updater.pubkey):\n${problems.join('\n')}`);
  return signatures;
}

/**
 * Create the `latest.json` manifest the updater downloads from the latest release.
 * @param {{version: string, notes: string, pubDate: string, repository: string, signatures: Record<string, string>}} release
 *   Version, short notes, RFC 3339 publication date, `owner/name` and signatures by asset name.
 * @returns {object} Manifest in the Tauri static JSON format.
 * @throws {Error} When an updater target has no signature.
 */
export function createUpdateManifest({ version, notes, pubDate, repository, signatures }) {
  const platforms = {};
  for (const [target, name] of Object.entries(UPDATER_TARGETS)) {
    if (!signatures[name]) throw new Error(`No signature for ${name} (${target})`);
    platforms[target] = { signature: signatures[name], url: `https://github.com/${repository}/releases/download/v${version}/${name}` };
  }
  return { version, notes, pub_date: pubDate, platforms };
}

/**
 * Create `changelog.json`, the notes of every version for the app's Novidades page.
 * Image paths become raw URLs at the released commit, so older notes keep working.
 * @param {Array<{version: string, notes: object}>} entries Parsed notes by version.
 * @param {{repository: string, sha: string}} source Repository (`owner/name`) and released commit.
 * @returns {{schema: number, versions: object[]}} Versions from newest to oldest.
 */
export function createChangelog(entries, { repository, sha }) {
  const raw = (path) => (path ? `https://raw.githubusercontent.com/${repository}/${sha}/docs/releases/${path}` : null);
  const order = (version) => version.split('.').map(Number);
  const versions = [...entries].sort((a, b) => {
    const [x, y] = [order(a.version), order(b.version)];
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  }).map(({ version, notes }) => ({
    version,
    date: notes.date,
    title: notes.title,
    summary: notes.summary,
    cover: raw(notes.cover),
    features: notes.features.map((feature) => ({
      title: feature.title,
      text: feature.text,
      images: feature.images.map((image) => ({ alt: image.alt, url: raw(image.src) })),
      video: feature.video && { title: feature.video.title, url: feature.video.url, poster: raw(feature.video.poster) },
    })),
    improvements: notes.improvements,
    fixes: notes.fixes,
  }));
  return { schema: 1, versions };
}

/**
 * Read and parse every notes file at a commit.
 * @param {string} sha Released commit.
 * @returns {Array<{version: string, notes: object}>} Parsed notes.
 * @throws {Error} When a notes file is invalid.
 */
function notesAt(sha) {
  const names = execFileSync('git', ['ls-tree', '--name-only', `${sha}:docs/releases`], { encoding: 'utf8' }).split('\n');
  return names.filter((name) => versionFromFileName(name)).map((name) => {
    const { notes, errors } = parseReleaseNotes(execFileSync('git', ['show', `${sha}:docs/releases/${name}`], { encoding: 'utf8' }), name);
    if (!notes) throw new Error(`Invalid release notes:\n${errors.join('\n')}`);
    return { version: versionFromFileName(name), notes };
  });
}

/**
 * Require a stable `M.m.p` version. Pre-releases are no longer published.
 * @param {string} version Version from `tauri.conf.json`.
 * @throws {Error} When the version has a pre-release part or is not `M.m.p`.
 */
export function assertStableVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Invalid release version ${version}: only M.m.p is published`);
}

/**
 * Read the release notes of a version at a commit and render the release title and body.
 * @param {string} text Contents of `docs/releases/vM.m.p.md` at the released commit.
 * @param {{version: string, repository: string, sha: string}} release Version, `owner/name` and commit.
 * @returns {{title: string, body: string}} Release title and Markdown body.
 * @throws {Error} When the notes are invalid.
 */
export function releaseText(text, { version, repository, sha }) {
  const { notes, errors } = parseReleaseNotes(text, `v${version}.md`);
  if (!notes) throw new Error(`Invalid release notes:\n${errors.join('\n')}`);
  return { title: `ATUS ${version} · ${notes.title}`, body: renderReleaseBody(notes, { repository, sha }) };
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
  const tag = `v${version}`;
  const selected = selectArtifacts(artifacts, version);
  // The release-version job already validated the notes and their images at this commit.
  const { title, body } = releaseText(execFileSync('git', ['show', `${sha}:docs/releases/${tag}.md`], { encoding: 'utf8' }), { version, repository, sha });
  const signatures = verifySignatures(selected, config.plugins?.updater?.pubkey, version);
  const history = notesAt(sha);
  const current = history.find((entry) => entry.version === version);
  const directory = mkdtempSync(join(tmpdir(), 'atus-release-'));
  for (const entry of selected) copyFileSync(entry.path, join(directory, entry.name));
  const names = selected.map(({ name }) => name);
  const manifest = createManifest(directory, { sha, version, names });
  verifyManifest(manifest, directory, { sha, version, names });
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(directory, 'SHA256SUMS'), formatChecksums(manifest));
  const updateManifest = createUpdateManifest({ version, notes: current.notes.summary, pubDate: execFileSync('git', ['show', '-s', '--format=%cI', sha], { encoding: 'utf8' }).trim(), repository, signatures });
  writeFileSync(join(directory, 'latest.json'), JSON.stringify(updateManifest, null, 2) + '\n');
  writeFileSync(join(directory, 'changelog.json'), JSON.stringify(createChangelog(history, { repository, sha }), null, 2) + '\n');
  const ref = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  if (ref && (ref.object.type !== 'commit' || ref.object.sha !== sha)) throw new Error('Tag points to another object');
  const existing = findRelease(repository, tag);
  if (existing && (!existing.draft || (!ref && existing.target_commitish !== sha))) throw new Error('Release exists or draft target does not match');
  if (!existing) {
    if (ref) throw new Error('Tag already exists without matching draft');
    const notesFile = join(mkdtempSync(join(tmpdir(), 'atus-notes-')), 'release-notes.md');
    writeFileSync(notesFile, body);
    gh(['release', 'create', tag, '--repo', repository, '--target', sha, '--draft', '--title', title, '--notes-file', notesFile]);
  }
  let verifiedRef = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  if (!verifiedRef) {
    gh(['api', '--method', 'POST', `repos/${repository}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`]);
    verifiedRef = apiOptional(`repos/${repository}/git/ref/tags/${tag}`);
  }
  if (!verifiedRef || verifiedRef.object.type !== 'commit' || verifiedRef.object.sha !== sha) throw new Error('Created tag does not match commit');
  // Every file must be identical when a draft is resumed, so latest.json uses the commit date, not the clock.
  const files = [...names, 'manifest.json', 'SHA256SUMS', 'changelog.json', 'latest.json'];
  const draft = findRelease(repository, tag);
  if (!draft?.draft) throw new Error('Expected draft release');
  const digests = Object.fromEntries(files.map((name) => [name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')]));
  for (const name of missingAssets(files, draft.assets, digests)) {
    gh(['release', 'upload', tag, '--repo', repository, join(directory, name)]);
  }
  const release = findRelease(repository, tag);
  if (!release?.draft || release.prerelease || release.assets.length !== files.length || files.some((name) => !release.assets.some((asset) => asset.name === name && asset.state === 'uploaded'))) throw new Error('Draft assets do not match expected inventory');
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
