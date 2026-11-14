/**
 * Parse and validate the release notes in `docs/releases/`.
 *
 * Every version needs a `docs/releases/vM.m.p.md` file. The format is documented in
 * `docs/releases/README.md`: a small front matter (`title`, `date`, `summary`, optional `cover`)
 * followed by up to three fixed sections. Features (`### title` under `## Novidades`) may carry
 * images and one YouTube video. The notes reach users inside the app, so the format is strict:
 * no raw HTML, links only to places the app can open (see {@link isAllowedLink}), and images
 * must be local files within size limits.
 *
 * CLI: `node check-release-notes.mjs [--root docs/releases] [--version M.m.p]`. Without
 * `--version`, the version is read from `src/desktop/tauri.conf.json`. Exits non-zero and prints
 * every problem when a file is invalid or the notes for the version are missing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Section headings, in the order they must appear, mapped to their key in the parsed notes. */
export const SECTIONS = { Novidades: 'features', Melhorias: 'improvements', 'Correções': 'fixes' };
/** Maximum file size, in bytes, per image extension. */
export const IMAGE_LIMITS = { png: 2 * 1024 * 1024, jpg: 2 * 1024 * 1024, jpeg: 2 * 1024 * 1024, webp: 2 * 1024 * 1024, svg: 2 * 1024 * 1024, gif: 5 * 1024 * 1024 };

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FRONT_MATTER_KEYS = ['title', 'date', 'summary', 'cover'];
const YOUTUBE = /^https:\/\/(?:youtu\.be\/[A-Za-z0-9_-]{11}(?:\?t=\d+s?)?|(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:&t=\d+s?)?)$/;
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const VIDEO_LINE = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/;
const POSTER_LINE = /^\[!\[([^\]]*)\]\(([^)\s]+)\)\]\((https:\/\/[^)\s]+)\)$/;
const MAX_IMAGES = 8;

/**
 * Check that a file name is `vM.m.p.md` and return its version.
 * @param {string} name File name, such as `v0.3.0.md`.
 * @returns {string|null} The version, or null when the name does not match.
 */
export function versionFromFileName(name) {
  const match = /^v(.+)\.md$/.exec(name);
  return match && VERSION.test(match[1]) ? match[1] : null;
}

/**
 * Parse release notes and report every structural problem.
 * File checks (image existence, size and type) are done by {@link checkImages}.
 * @param {string} text Contents of the notes file.
 * @param {string} [file] Name used to prefix error messages.
 * @returns {{notes: object|null, errors: string[]}} Parsed notes (null when invalid) and errors as `file:line: message`.
 * @example
 * const { notes, errors } = parseReleaseNotes(readFileSync('docs/releases/v0.3.0.md', 'utf8'), 'v0.3.0.md');
 */
export function parseReleaseNotes(text, file = 'notes') {
  const errors = [];
  const fail = (line, message) => errors.push(`${file}:${line}: ${message}`);
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const notes = { title: '', date: '', summary: '', cover: null, features: [], improvements: [], fixes: [] };

  if (lines[0] !== '---') {
    fail(1, 'must start with a front matter block (---)');
    return { notes: null, errors };
  }
  const end = lines.indexOf('---', 1);
  if (end < 0) {
    fail(1, 'front matter is not closed with ---');
    return { notes: null, errors };
  }
  const seen = new Set();
  for (let i = 1; i < end; i++) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(lines[i]);
    if (!match) { fail(i + 1, 'front matter lines must be "key: value"'); continue; }
    const [, key, value] = match;
    if (!FRONT_MATTER_KEYS.includes(key)) { fail(i + 1, `unknown front matter key "${key}"`); continue; }
    if (seen.has(key)) { fail(i + 1, `duplicate front matter key "${key}"`); continue; }
    seen.add(key);
    if (!value.trim()) { fail(i + 1, `"${key}" is empty`); continue; }
    notes[key] = value.trim();
  }
  for (const key of ['title', 'date', 'summary']) if (!seen.has(key)) fail(1, `missing required "${key}" in front matter`);
  if (notes.date && !validDate(notes.date)) fail(1, `"date" must be a real date as YYYY-MM-DD, got "${notes.date}"`);
  if (notes.cover) checkPath(notes.cover, 1, fail, 'cover');
  for (const key of ['title', 'summary']) if (notes[key]) checkInline(notes[key], 1, fail);

  let section = null;
  let order = -1;
  let feature = null;
  const names = Object.keys(SECTIONS);
  for (let i = end + 1; i < lines.length; i++) {
    const line = lines[i];
    const number = i + 1;
    if (!line.trim()) continue;
    if (/<[A-Za-z!/]/.test(line)) { fail(number, 'raw HTML is not allowed'); continue; }
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      const index = names.indexOf(h2[1].trim());
      if (index < 0) fail(number, `unknown section "${h2[1].trim()}"; use ${names.join(', ')}`);
      else if (index <= order) fail(number, `section "${names[index]}" is repeated or out of order (${names.join(', ')})`);
      else { order = index; section = SECTIONS[names[index]]; feature = null; }
      continue;
    }
    if (/^#/.test(line) && !/^### /.test(line)) { fail(number, 'only "## section" and "### feature" headings are allowed'); continue; }
    if (!section) { fail(number, 'text before the first section'); continue; }

    if (section === 'features') {
      const h3 = /^### (.+)$/.exec(line);
      if (h3) {
        feature = { title: h3[1].trim(), text: [], images: [], video: null, line: number };
        checkInline(feature.title, number, fail);
        notes.features.push(feature);
        continue;
      }
      if (!feature) { fail(number, 'start each feature with "### title"'); continue; }
      const trimmed = line.trim();
      const poster = POSTER_LINE.exec(trimmed);
      const video = !poster && VIDEO_LINE.exec(trimmed);
      const image = IMAGE_LINE.exec(trimmed);
      if (poster || (video && video[2].includes('youtu'))) {
        const url = poster ? poster[3] : video[2];
        if (!YOUTUBE.test(url)) { fail(number, `video links must be youtu.be/ID or youtube.com/watch?v=ID, got "${url}"`); continue; }
        if (feature.video) { fail(number, `feature "${feature.title}" already has a video`); continue; }
        feature.video = { title: poster ? poster[1].trim() : video[1].trim(), url, poster: poster ? poster[2] : null };
        if (!feature.video.title) fail(number, 'the video needs a title (the image alt text or link text)');
        if (poster) checkPath(poster[2], number, fail, 'poster');
      } else if (image) {
        if (!image[1].trim()) fail(number, 'images need a caption: ![caption](path)');
        checkPath(image[2], number, fail, 'image');
        feature.images.push({ alt: image[1].trim(), src: image[2] });
        if (feature.images.length > MAX_IMAGES) fail(number, `a feature can have at most ${MAX_IMAGES} images`);
      } else if (/!\[/.test(line)) {
        fail(number, 'images must be on their own line');
      } else {
        checkInline(trimmed, number, fail);
        feature.text.push(trimmed);
      }
      continue;
    }

    const item = /^- (.+)$/.exec(line);
    const list = notes[section];
    if (item) { checkInline(item[1], number, fail); list.push(item[1].trim()); }
    else if (/^ {2,}\S/.test(line) && list.length) { checkInline(line.trim(), number, fail); list[list.length - 1] += ` ${line.trim()}`; }
    else fail(number, 'Melhorias and Correções only accept "- item" lists');
  }

  for (const item of notes.features) {
    if (!item.text.length) fail(item.line, `feature "${item.title}" needs a description`);
    delete item.line;
  }
  if (order >= 0) {
    for (const [name, key] of Object.entries(SECTIONS)) {
      const present = lines.some((line) => line.trim() === `## ${name}`);
      if (present && !notes[key].length) fail(1, `section "${name}" is empty`);
    }
  }
  if (!notes.features.length && !notes.improvements.length && !notes.fixes.length) fail(1, 'notes need at least one section with content');
  return { notes: errors.length ? null : notes, errors };
}

/**
 * Check that every image referenced by parsed notes exists, stays inside the notes folder,
 * has content matching its extension and respects {@link IMAGE_LIMITS}.
 * @param {object} notes Notes returned by {@link parseReleaseNotes}.
 * @param {string} root Folder holding the notes, such as `docs/releases`.
 * @param {string} [file] Name used to prefix error messages.
 * @returns {string[]} Errors as `file: message`.
 */
export function checkImages(notes, root, file = 'notes') {
  const paths = [notes.cover, ...notes.features.flatMap((item) => [...item.images.map((image) => image.src), item.video?.poster])].filter(Boolean);
  const errors = [];
  for (const path of new Set(paths)) {
    const full = join(root, path);
    if (!existsSync(full) || !statSync(full).isFile()) { errors.push(`${file}: image "${path}" does not exist`); continue; }
    const extension = path.split('.').pop().toLowerCase();
    const size = statSync(full).size;
    if (size > IMAGE_LIMITS[extension]) errors.push(`${file}: image "${path}" has ${(size / 1024 / 1024).toFixed(1)} MB; the limit for .${extension} is ${IMAGE_LIMITS[extension] / 1024 / 1024} MB`);
    const data = readFileSync(full);
    if (extension === 'svg') errors.push(...checkSvg(data.toString('utf8')).map((problem) => `${file}: image "${path}" ${problem}`));
    else if (!matchesSignature(data.subarray(0, 12), extension)) errors.push(`${file}: image "${path}" is not a real .${extension} file`);
  }
  return errors;
}

/**
 * Validate every notes file in a folder and require the notes for one version.
 * @param {{root: string, version: string}} options Notes folder and the version that must have notes.
 * @returns {{errors: string[], notes: Map<string, object>}} All problems found, and the valid notes by version.
 */
export function checkReleaseNotes({ root, version }) {
  const errors = [];
  const notes = new Map();
  if (!VERSION.test(version)) errors.push(`version "${version}" must be M.m.p`);
  if (!existsSync(root)) return { errors: [...errors, `${root} does not exist`], notes };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === 'assets') continue;
    if (entry.isFile() && entry.name === 'README.md') continue;
    const fileVersion = entry.isFile() ? versionFromFileName(entry.name) : null;
    if (!fileVersion) { errors.push(`${entry.name}: notes files must be named vM.m.p.md`); continue; }
    const parsed = parseReleaseNotes(readFileSync(join(root, entry.name), 'utf8'), entry.name);
    errors.push(...parsed.errors);
    if (parsed.notes) {
      const imageErrors = checkImages(parsed.notes, root, entry.name);
      errors.push(...imageErrors);
      if (!imageErrors.length) notes.set(fileVersion, parsed.notes);
    }
  }
  if (VERSION.test(version) && !existsSync(join(root, `v${version}.md`))) {
    errors.push(`missing release notes for ${version}: create ${posix.join(root, `v${version}.md`)} (see docs/releases/README.md)`);
  }
  return { errors, notes };
}

/**
 * Render parsed notes as the Markdown body of a GitHub release.
 * Local images point to the raw file at the released commit, so they render on GitHub.
 * @param {object} notes Notes returned by {@link parseReleaseNotes}.
 * @param {{repository: string, sha: string, root?: string}} source Repository (`owner/name`), commit and notes folder.
 * @returns {string} Markdown body.
 */
export function renderReleaseBody(notes, { repository, sha, root = 'docs/releases' }) {
  const raw = (path) => `https://raw.githubusercontent.com/${repository}/${sha}/${posix.join(root, path)}`;
  const out = [notes.summary, ''];
  if (notes.cover) out.push(`![${notes.title}](${raw(notes.cover)})`, '');
  if (notes.features.length) {
    out.push('## Novidades', '');
    for (const item of notes.features) {
      out.push(`### ${item.title}`, '', ...item.text.flatMap((paragraph) => [paragraph, '']));
      for (const image of item.images) out.push(`![${image.alt}](${raw(image.src)})`, '');
      if (item.video) out.push(item.video.poster ? `[![${item.video.title}](${raw(item.video.poster)})](${item.video.url})` : `▶ [${item.video.title}](${item.video.url})`, '');
    }
  }
  for (const [name, key] of [['Melhorias', 'improvements'], ['Correções', 'fixes']]) {
    if (notes[key].length) out.push(`## ${name}`, '', ...notes[key].map((item) => `- ${item}`), '');
  }
  return out.join('\n').trimEnd() + '\n';
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function checkPath(path, line, fail, what) {
  const extension = path.split('.').pop().toLowerCase();
  if (/^[a-z]+:/i.test(path) || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
    fail(line, `${what} "${path}" must be a relative path inside docs/releases`);
  } else if (!(extension in IMAGE_LIMITS)) {
    fail(line, `${what} "${path}" must be ${Object.keys(IMAGE_LIMITS).join(', ')}`);
  }
}

/** Hosts, besides `github.com/HighEloDevs`, that notes may link to. */
const LINK_HOSTS = ['youtu.be', 'www.youtube.com', 'atusweb.com.br', 'www.atusweb.com.br'];

/**
 * Whether a note may link to an address. The desktop app opens links in the browser only for a
 * fixed set of places (its `opener` permission), so the notes are held to the same set and no
 * link dies silently: the project on GitHub, YouTube and the ATUS site.
 * @param {string} value Link target.
 * @returns {boolean} True for an `https` link, without credentials or a port, to an allowed place.
 */
export function isAllowedLink(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'github.com') return url.pathname === '/HighEloDevs' || url.pathname.startsWith('/HighEloDevs/');
  return LINK_HOSTS.includes(host);
}

function checkInline(text, line, fail) {
  for (const match of text.matchAll(/\]\(([^)]*)\)/g)) {
    if (!isAllowedLink(match[1])) fail(line, `links must be https to github.com/HighEloDevs, YouTube or atusweb.com.br, got "${match[1]}"`);
  }
  if (/!\[/.test(text)) fail(line, 'images must be on their own line inside a feature');
}

/**
 * Check that an SVG is a self-contained static image. The app shows images with `<img>`, which
 * already blocks scripts, but the notes are published widely, so unsafe or external content is
 * refused at the source: scripts, event handlers, `foreignObject`, DTDs and any reference that
 * is not an internal `#id` or an embedded raster `data:` image. Text depends on the viewer's
 * fonts, so draw text as paths.
 * @param {string} text SVG source.
 * @returns {string[]} Problems found, empty when the SVG is acceptable.
 */
export function checkSvg(text) {
  const problems = [];
  const body = text.replace(/^\uFEFF/, '').replace(/^\s*<\?xml[^>]*\?>/, '').replace(/^(\s*<!--[\s\S]*?-->)*/, '').trimStart();
  if (!/^<svg[\s>]/.test(body)) return ['is not a real .svg file'];
  if (!/<svg[^>]*\sviewBox=/.test(body)) problems.push('needs a viewBox so it can scale');
  const rules = [
    [/<script/i, 'must not contain scripts'],
    [/\son[a-z]+\s*=/i, 'must not contain event handlers'],
    [/<foreignObject/i, 'must not contain foreignObject'],
    [/<!(DOCTYPE|ENTITY)/i, 'must not declare a DTD or entities'],
    [/javascript:/i, 'must not contain javascript: links'],
    [/@import/i, 'must not import stylesheets'],
    [/<text[\s>]/i, 'must draw text as paths (fonts vary between computers)'],
  ];
  for (const [pattern, message] of rules) if (pattern.test(body)) problems.push(message);
  for (const match of body.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^#|^data:image\/(png|jpeg|webp|gif);base64,/i.test(match[1])) problems.push(`must not reference "${match[1].slice(0, 40)}"`);
  }
  for (const match of body.matchAll(/url\(\s*["']?([^"')]*)/gi)) {
    if (!match[1].startsWith('#')) problems.push(`must not reference "${match[1].slice(0, 40)}"`);
  }
  return problems;
}

function matchesSignature(head, extension) {
  const ascii = (start, end) => head.subarray(start, end).toString('latin1');
  if (extension === 'png') return head[0] === 0x89 && ascii(1, 4) === 'PNG';
  if (extension === 'jpg' || extension === 'jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (extension === 'gif') return ascii(0, 4) === 'GIF8';
  if (extension === 'webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  try {
    const version = option('--version') ?? JSON.parse(readFileSync('src/desktop/tauri.conf.json', 'utf8')).version;
    const { errors, notes } = checkReleaseNotes({ root: option('--root') ?? 'docs/releases', version });
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(`Release notes are valid (${notes.size} versions, including ${version})`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
