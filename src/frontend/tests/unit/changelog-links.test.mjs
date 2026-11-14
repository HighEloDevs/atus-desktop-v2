/** Which links a note may carry: the same table as the release checks, which hold the notes to it. */
import { expect, it } from "vitest";
import { isAllowedLink } from "../../src/features/news/changelog";

/** The same table is in `.github/tests/scripts/shared/release/check-release-notes.test.mjs`: keep the two equal. */
const LINK_CASES = [
  ["https://github.com/HighEloDevs/atus-desktop-v2/releases/latest", true],
  ["https://github.com/HighEloDevs", true],
  ["https://github.com/HighEloDevs/atus-desktop-v2", true],
  ["https://github.com/HighEloDevsX/atus", false],
  ["https://github.com/OtherOrg/atus", false],
  ["https://github.com/", false],
  ["https://youtu.be/dQw4w9WgXcQ", true],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", true],
  ["https://youtube.com/watch?v=dQw4w9WgXcQ", false],
  ["https://atusweb.com.br/about", true],
  ["https://www.atusweb.com.br/", true],
  ["https://evil.atusweb.com.br/", false],
  ["https://atusweb.com.br.evil.com/", false],
  ["http://atusweb.com.br/", false],
  ["https://user:pass@atusweb.com.br/", false],
  ["https://atusweb.com.br:8443/", false],
  ["javascript:alert(1)", false],
  ["//atusweb.com.br/", false],
  ["", false],
  ["not a url", false],
];

it.each(LINK_CASES)("%s is allowed: %s", (link, allowed) => {
  expect(isAllowedLink(link)).toBe(allowed);
});

it("does not let `..` step out of the project's place", () => {
  // The address the app opens is normalized, which resolves the segments first.
  expect(isAllowedLink("https://github.com/HighEloDevs/../Evil/x")).toBe(false);
  expect(isAllowedLink("https://github.com/HighEloDevs/%2e%2e/Evil/x")).toBe(false);
});
