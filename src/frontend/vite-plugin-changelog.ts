/**
 * @module
 * Vite plugin that embeds the release notes (`docs/releases/`) in the build as the virtual module
 * `virtual:changelog`.
 *
 * It runs the notes through the same parser and generator the release pipeline uses
 * (`.github/scripts/shared/release/`), so the embedded changelog has exactly the shape published
 * in `changelog.json` and `latest.json`, and notes that the release would refuse also fail the
 * build. Image paths become `raw.githubusercontent.com` addresses at the commit being built.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
// Static imports on purpose: with `--configLoader runner` the module runner that loads this file is
// closed once the configuration is read, so a dynamic `import()` inside a hook would fail.
import { checkReleaseNotes } from "../../.github/scripts/shared/release/check-release-notes.mjs";
import { createChangelog } from "../../.github/scripts/shared/release/publish-release.mjs";

const VIRTUAL_ID = "virtual:changelog";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const REPOSITORY = "HighEloDevs/atus-desktop-v2";

/** Options of {@link changelogPlugin}; every one has a default for the repository layout. */
export interface ChangelogPluginOptions {
  /** Folder with `vM.m.p.md` files and their assets. */
  notesRoot?: string;
  /** Version that must have notes; defaults to the one in `package.json`. */
  version?: string;
  /** Commit the image addresses point to; defaults to `GITHUB_SHA` or the current commit. */
  sha?: string;
  /** Repository (`owner/name`) of the images. */
  repository?: string;
}

function currentSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "main";
  }
}

/**
 * Creates the plugin.
 * @param options - Where the notes are and which commit the images belong to.
 * @returns A Vite plugin serving `virtual:changelog` as `{ schema: 1, versions: [...] }`.
 */
export function changelogPlugin(options: ChangelogPluginOptions = {}): Plugin {
  const notesRoot =
    options.notesRoot ?? fileURLToPath(new URL("../../docs/releases", import.meta.url));
  let building = true;
  return {
    name: "atus-changelog",
    configResolved(config) {
      building = config.command === "build";
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const version =
        options.version ??
        JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
      const { errors, notes } = checkReleaseNotes({ root: notesRoot, version }) as {
        errors: string[];
        notes: Map<string, unknown>;
      };
      if (errors.length > 0) {
        // The release would refuse these notes, so a build must too; while developing, the page
        // simply shows what is valid.
        if (building) this.error(`Invalid release notes:\n${errors.join("\n")}`);
        this.warn(`Invalid release notes:\n${errors.join("\n")}`);
      }
      const changelog = createChangelog(
        [...notes].map(([noteVersion, value]) => ({ version: noteVersion, notes: value })),
        { repository: options.repository ?? REPOSITORY, sha: options.sha ?? currentSha() },
      );
      return `export default ${JSON.stringify(changelog)};`;
    },
  };
}
