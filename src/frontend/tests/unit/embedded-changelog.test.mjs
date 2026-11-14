/** The notes embedded in the build are the real release notes of the repository, valid for the app. */
import { expect, it } from "vitest";
import { EMBEDDED_CHANGELOG } from "../../src/features/news/embedded-changelog";
import { APP_VERSION } from "../../src/lib/app-version";

it("embeds the notes of the version being built and of the older ones, newest first", () => {
  const versions = EMBEDDED_CHANGELOG.map((item) => item.version);
  expect(versions[0]).toBe(APP_VERSION);
  expect(versions).toContain("0.2.0");
  expect(versions).toEqual(
    [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  );
});

it("keeps each version's covers and images in the project's files on GitHub", () => {
  const prefix = "https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/";
  const [newest] = EMBEDDED_CHANGELOG;
  expect(newest.title.length).toBeGreaterThan(0);
  expect(newest.cover?.startsWith(prefix)).toBe(true);
});
