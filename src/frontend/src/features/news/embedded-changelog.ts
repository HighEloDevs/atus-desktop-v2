/**
 * @module
 * The notes embedded in the build, generated from `docs/releases/` by the Vite plugin
 * (`vite-plugin-changelog.ts`), with the same parser and the same shape the release publishes.
 */

import embedded from "virtual:changelog";
import { parseChangelog, type ChangelogVersion } from "./changelog";

/** The notes of every version up to the one that was built, newest first. */
export const EMBEDDED_CHANGELOG: ChangelogVersion[] = parseChangelog(embedded);
