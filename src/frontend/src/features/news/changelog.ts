/**
 * @module
 * The notes of every version (the changelog) and the rules that make them safe to show.
 *
 * The notes of the installed version and the older ones are embedded in the build; the ones of
 * newer versions arrive inside the update manifest, which is downloaded over the network and is
 * not signed. Everything is therefore validated before use: anything unexpected is dropped, text
 * is only ever rendered as text, and links, images and videos are limited to fixed places.
 */

/** An image of a feature. */
export interface ChangelogImage {
  alt: string;
  url: string;
}

/** A video of a feature, opened on YouTube. */
export interface ChangelogVideo {
  title: string;
  url: string;
  /** Image shown before opening it; null uses a generic one. */
  poster: string | null;
}

/** One feature of a version: a heading, paragraphs and at most a video or some images. */
export interface ChangelogFeature {
  title: string;
  text: string[];
  images: ChangelogImage[];
  video: ChangelogVideo | null;
}

/** The notes of one version. */
export interface ChangelogVersion {
  version: string;
  /** Publication day, `YYYY-MM-DD`. */
  date: string;
  title: string;
  summary: string;
  /** Banner image, or null. */
  cover: string | null;
  features: ChangelogFeature[];
  improvements: string[];
  fixes: string[];
}

/** Where images of the notes live: the project's files on GitHub, pinned to a commit. */
export const IMAGE_PREFIX = "https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/";

const MAX_VERSIONS = 200;
const MAX_FEATURES = 30;
const MAX_IMAGES = 8;
const MAX_PARAGRAPHS = 20;
const MAX_ITEMS = 50;
const MAX_TITLE = 200;
const MAX_TEXT = 2000;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const LINK_HOSTS = ["youtu.be", "www.youtube.com", "atusweb.com.br", "www.atusweb.com.br"];
const YOUTUBE =
  /^https:\/\/(?:youtu\.be\/[A-Za-z0-9_-]{11}(?:\?t=\d+s?)?|www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:&t=\d+s?)?)$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a link may be shown as a link: `https` to the project on GitHub, YouTube or the ATUS
 * site. These are the places the app is allowed to open (`opener` permission), and the release
 * checks hold the notes to the same set (`check-release-notes.mjs`).
 * @param value - Link target.
 * @returns True when it may be opened.
 */
export function isAllowedLink(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host === "github.com") {
    return url.pathname === "/HighEloDevs" || url.pathname.startsWith("/HighEloDevs/");
  }
  return LINK_HOSTS.includes(host);
}

/**
 * Whether an address is an image of the notes: a picture file in the project's GitHub files.
 * @param value - Image address.
 * @returns True when it may be loaded.
 */
export function isAllowedImage(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // The address must already be in its normalized form: a `..` (or `%2e%2e`) that resolves out of
  // the project's folder would otherwise pass a check on the text and load from somewhere else.
  if (url.href !== value || !url.href.startsWith(IMAGE_PREFIX)) return false;
  const extension = url.pathname.split(".").pop()?.toLowerCase() ?? "";
  return url.search === "" && url.hash === "" && IMAGE_EXTENSIONS.includes(extension);
}

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() !== "" && value.length <= max ? value : null;

function list(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).flatMap((item) => {
    const valid = text(item, maxLength);
    return valid === null ? [] : [valid];
  });
}

function parseFeature(value: unknown): ChangelogFeature | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const title = text(item.title, MAX_TITLE);
  if (title === null) return null;
  const images = (Array.isArray(item.images) ? item.images.slice(0, MAX_IMAGES) : []).flatMap(
    (image): ChangelogImage[] => {
      if (typeof image !== "object" || image === null) return [];
      const { alt, url } = image as Record<string, unknown>;
      return typeof url === "string" && isAllowedImage(url)
        ? [{ alt: typeof alt === "string" ? alt.slice(0, MAX_TITLE) : "", url }]
        : [];
    },
  );
  let video: ChangelogVideo | null = null;
  if (typeof item.video === "object" && item.video !== null) {
    const { title: videoTitle, url, poster } = item.video as Record<string, unknown>;
    const name = text(videoTitle, MAX_TITLE);
    if (name !== null && typeof url === "string" && YOUTUBE.test(url)) {
      video = {
        title: name,
        url,
        poster: typeof poster === "string" && isAllowedImage(poster) ? poster : null,
      };
    }
  }
  return { title, text: list(item.text, MAX_PARAGRAPHS, MAX_TEXT), images, video };
}

function parseVersion(value: unknown): ChangelogVersion | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const version = text(item.version, 32);
  const title = text(item.title, MAX_TITLE);
  const summary = text(item.summary, MAX_TEXT);
  if (version === null || !VERSION.test(version) || title === null || summary === null) return null;
  const date = typeof item.date === "string" && DAY.test(item.date) ? item.date : "";
  const features = (
    Array.isArray(item.features) ? item.features.slice(0, MAX_FEATURES) : []
  ).flatMap((feature) => {
    const parsed = parseFeature(feature);
    return parsed ? [parsed] : [];
  });
  return {
    version,
    date,
    title,
    summary,
    cover: typeof item.cover === "string" && isAllowedImage(item.cover) ? item.cover : null,
    features,
    improvements: list(item.improvements, MAX_ITEMS, MAX_TEXT),
    fixes: list(item.fixes, MAX_ITEMS, MAX_TEXT),
  };
}

/**
 * Validates a changelog received from outside (embedded in the build or in the update manifest).
 * Versions and features that do not have the expected shape are dropped, as are images, covers
 * and videos that point anywhere but the allowed places; text is kept only as plain strings.
 * @param value - The parsed JSON, of unknown shape.
 * @returns The versions that passed, newest first. Empty for anything that is not a changelog.
 */
export function parseChangelog(value: unknown): ChangelogVersion[] {
  if (typeof value !== "object" || value === null) return [];
  const { schema, versions } = value as Record<string, unknown>;
  if (schema !== 1 || !Array.isArray(versions)) return [];
  const parsed = versions.slice(0, MAX_VERSIONS).flatMap((item) => {
    const version = parseVersion(item);
    return version ? [version] : [];
  });
  return sortNewestFirst(dedupe(parsed));
}

/**
 * Compares two `M.m.p` versions.
 * @param a - First version.
 * @param b - Second version.
 * @returns Negative when `a` is older, positive when newer, zero when equal.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function dedupe(versions: ChangelogVersion[]): ChangelogVersion[] {
  const seen = new Set<string>();
  return versions.filter(({ version }) => !seen.has(version) && seen.add(version));
}

function sortNewestFirst(versions: ChangelogVersion[]): ChangelogVersion[] {
  return [...versions].sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Joins the notes embedded in the build with the ones announced by the update manifest. For a
 * version in both, the embedded notes win: they were checked when the app was built.
 * @param embedded - Notes embedded in the build.
 * @param remote - Notes from the update manifest (already validated).
 * @returns Every version once, newest first.
 */
export function mergeChangelogs(
  embedded: ChangelogVersion[],
  remote: ChangelogVersion[],
): ChangelogVersion[] {
  return sortNewestFirst(dedupe([...embedded, ...remote]));
}

/** Formats a `YYYY-MM-DD` day as, for example, `13 de nov. de 2026`. */
export function formatDay(day: string): string {
  if (!day) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
