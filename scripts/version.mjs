/**
 * Synchronize application versions and validate a proposed release against a Git base.
 * Run from the repository root; `check` requires complete local tags and a fetched base.
 * Build metadata is deliberately rejected because it does not change SemVer precedence.
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
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  if (!match || (match[4] && match[4].split('.').some((id) => /^\d+$/.test(id) && id.length > 1 && id.startsWith('0')))) throw new Error(`Invalid supported SemVer: ${value}`);
  return { core: match.slice(1, 4).map(BigInt), pre: match[4]?.split('.') };
}
function compare(left, right) {
  const a = parseVersion(left); const b = parseVersion(right);
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  if (!a.pre || !b.pre) return a.pre ? -1 : b.pre ? 1 : 0;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    if (a.pre[i] === b.pre[i]) continue;
    const an = /^\d+$/.test(a.pre[i]); const bn = /^\d+$/.test(b.pre[i]);
    if (an && bn) return BigInt(a.pre[i]) > BigInt(b.pre[i]) ? 1 : -1;
    if (an !== bn) return an ? -1 : 1;
    return a.pre[i] > b.pre[i] ? 1 : -1;
  }
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
  const baseConfig = JSON.parse(execFileSync('git', ['show', `${base}:${paths.config}`], { encoding: 'utf8' }));
  if (compare(version, baseConfig.version) <= 0) throw new Error(`Version ${version} must be greater than base ${baseConfig.version}`);
  const tag = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/v${version}`]);
  if (tag.error || (tag.status !== 0 && tag.status !== 1)) throw new Error('Could not inspect tags');
  if (tag.status === 0) throw new Error(`Tag v${version} already exists`);
  console.log(`Version ${version} is valid against ${base}`);
}
try {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === 'bump') bump(args[1]);
  else if (args.length === 3 && args[0] === 'check' && args[1] === '--base' && args[2]) check(args[2]);
  else throw new Error('Usage: version.mjs bump <version> | check --base <git-ref>');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
