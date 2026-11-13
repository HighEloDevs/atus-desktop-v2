/**
 * Synchronize application versions and validate a proposed release against a Git base.
 * Run from the repository root; `check` requires complete local tags and a fetched base.
 * Only stable `M.m.p` versions are accepted: every merge to main is published to every user,
 * and pre-releases are no longer made. Build metadata is rejected because it does not change precedence.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const paths = {
  config: 'src/desktop/tauri.conf.json',
  cargo: 'src/desktop/Cargo.toml',
  cargoLock: 'src/desktop/Cargo.lock',
  frontend: 'src/frontend/package.json',
  frontendLock: 'src/frontend/package-lock.json',
};

function parseVersion(value) {
  if (typeof value !== 'string') throw new Error('Version must be a string');
  if (/^\d+\.\d+\.\d+-/.test(value)) throw new Error(`Pre-release versions are not published; use M.m.p instead of ${value}`);
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) throw new Error(`Invalid version: ${value} (use M.m.p)`);
  return match.slice(1, 4).map(BigInt);
}
function compare(left, right) {
  const a = parseVersion(left); const b = parseVersion(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
function packageVersion(text, path) {
  const packageSection = path.endsWith('Cargo.lock')
    ? text.match(/\[\[package\]\]\s*\nname = "atus-desktop"\s*\nversion = "([^"]+)"/)
    : text.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  if (!packageSection) throw new Error(`Could not locate application version in ${path}`);
  return packageSection[1];
}
function load() {
  const raw = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
  const config = JSON.parse(raw.config); const frontend = JSON.parse(raw.frontend); const lock = JSON.parse(raw.frontendLock);
  if (!lock.packages?.['']) throw new Error('Missing frontend root lockfile package');
  const versions = [config.version, packageVersion(raw.cargo, paths.cargo), packageVersion(raw.cargoLock, paths.cargoLock), frontend.version, lock.version, lock.packages[''].version];
  versions.forEach(parseVersion);
  return { raw, config, frontend, lock, versions };
}
function updateCargo(text, path, version) {
  const old = packageVersion(text, path);
  if (path.endsWith('Cargo.lock')) return text.replace(/(\[\[package\]\]\s*\nname = "atus-desktop"\s*\nversion = ")[^"]+("\s*)/, `$1${version}$2`);
  const section = text.match(/^\[package\][\s\S]*?(?=^\[|$(?![\s\S]))/m)?.[0];
  if (!section) throw new Error('Missing Cargo package section');
  return text.replace(section, section.replace(/^(version\s*=\s*")[^"]+(".*)$/m, `$1${version}$2`));
}
function bump(version) {
  parseVersion(version);
  const { raw, config, frontend, lock } = load();
  config.version = version; frontend.version = version; lock.version = version; lock.packages[''].version = version;
  const contents = { config: JSON.stringify(config, null, 2) + '\n', frontend: JSON.stringify(frontend, null, 2) + '\n', frontendLock: JSON.stringify(lock, null, 2) + '\n', cargo: updateCargo(raw.cargo, paths.cargo, version), cargoLock: updateCargo(raw.cargoLock, paths.cargoLock, version) };
  for (const [key, path] of Object.entries(paths)) writeFileSync(path, contents[key]);
}
function check(base) {
  const { versions } = load(); const version = versions[0];
  if (!versions.every((current) => current === version)) throw new Error('Application versions are inconsistent');
  execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], { stdio: 'pipe' });
  // A base that predates the application manifest has no version to exceed (first release).
  const baseHasConfig = spawnSync('git', ['cat-file', '-e', `${base}:${paths.config}`]);
  if (baseHasConfig.error) throw new Error('Could not inspect base');
  if (baseHasConfig.status === 0) {
    const baseConfig = JSON.parse(execFileSync('git', ['show', `${base}:${paths.config}`], { encoding: 'utf8' }));
    if (compare(version, baseConfig.version) <= 0) throw new Error(`Version ${version} must be greater than base ${baseConfig.version}`);
  }
  const tag = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/v${version}`]);
  if (tag.error || (tag.status !== 0 && tag.status !== 1)) throw new Error('Could not inspect tags');
  if (tag.status === 0) throw new Error(`Tag v${version} already exists`);
  console.log(`Version ${version} is valid against ${base}`);
}
try {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === 'bump') bump(args[1]);
  else if (args.length === 3 && args[0] === 'check' && args[1] === '--base' && args[2]) check(args[2]);
  else throw new Error('Usage: check-version.mjs bump <version> | check --base <git-ref>');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
