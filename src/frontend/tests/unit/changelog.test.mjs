/** Changelog: validation of notes that come from outside, merging, ordering and dates. */
import { expect, it } from "vitest";
import {
  IMAGE_PREFIX,
  compareVersions,
  formatDay,
  isAllowedImage,
  mergeChangelogs,
  parseChangelog,
} from "../../src/features/news/changelog";
import { RAW, SHA, VIDEO_URL, rawChangelog } from "../fixtures/changelog-fixture.mjs";

it("accepts a well-formed changelog and keeps its content", () => {
  const versions = parseChangelog(rawChangelog());
  expect(versions.map((item) => item.version)).toEqual(["0.3.0", "0.2.4", "0.2.3"]);
  const [newest, middle] = versions;
  expect(newest.title).toBe("Resíduos à vista");
  expect(newest.cover).toBe(`${RAW}/assets/v0.3.0/cover.svg`);
  expect(newest.features[0].video).toEqual({
    title: "Resíduos em 40 segundos",
    url: VIDEO_URL,
    poster: `${RAW}/assets/v0.3.0/poster.png`,
  });
  expect(newest.features[1].video.poster).toBeNull();
  expect(newest.improvements).toEqual(["O tooltip responde às setas do teclado."]);
  expect(middle.features[0].images).toHaveLength(3);
});

it.each([
  undefined,
  null,
  "text",
  42,
  [],
  {},
  { schema: 2, versions: [] },
  { schema: 1 },
  { schema: 1, versions: "x" },
])("returns nothing for what is not a changelog (%j)", (value) => {
  expect(parseChangelog(value)).toEqual([]);
});

it("drops versions that lack what a version needs", () => {
  const good = rawChangelog().versions[0];
  const versions = parseChangelog({
    schema: 1,
    versions: [
      null,
      "x",
      { ...good, version: "0.3" },
      { ...good, version: "v0.3.0" },
      { ...good, version: "0.3.0-rc.1" },
      { ...good, title: "" },
      { ...good, summary: 5 },
      { ...good, title: "x".repeat(201) },
      good,
    ],
  });
  expect(versions.map((item) => item.version)).toEqual(["0.3.0"]);
});

it("keeps only the first of a repeated version and orders numerically, newest first", () => {
  const base = rawChangelog().versions[2];
  const versions = parseChangelog({
    schema: 1,
    versions: [
      { ...base, version: "0.2.9", title: "first" },
      { ...base, version: "0.10.0" },
      { ...base, version: "0.2.9", title: "second" },
      { ...base, version: "0.2.10" },
    ],
  });
  expect(versions.map((item) => item.version)).toEqual(["0.10.0", "0.2.10", "0.2.9"]);
  expect(versions[2].title).toBe("first");
});

const NOT_PROJECT_IMAGES = [
  "http://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/x/a.png",
  "https://evil.example.com/a.png",
  "https://raw.githubusercontent.com/Other/repo/x/a.png",
  `${RAW}/../../secret.png`,
  `${IMAGE_PREFIX}../../Other/repo/a.png`,
  `${IMAGE_PREFIX}%2e%2e/%2e%2e/Other/repo/a.png`,
  `${RAW}/a.png?x=1`,
  `${RAW}/a.exe`,
  `${RAW}/a b.png`,
  "data:image/png;base64,AAAA",
  "javascript:alert(1)",
  "",
];

it.each(NOT_PROJECT_IMAGES)("drops the image, cover and poster at %j", (url) => {
  const raw = rawChangelog();
  raw.versions[0].cover = url;
  raw.versions[0].features[0].video.poster = url;
  raw.versions[1].features[0].images = [
    { alt: "ok", url: `${RAW}/ok.png` },
    { alt: "x", url },
  ];
  const [newest, middle] = parseChangelog(raw);
  expect(newest.cover).toBeNull();
  expect(newest.features[0].video.poster).toBeNull();
  expect(middle.features[0].images).toEqual([{ alt: "ok", url: `${RAW}/ok.png` }]);
});

it("drops images that are not objects with an address", () => {
  const raw = rawChangelog();
  raw.versions[1].features[0].images = [null, "x", { alt: "no url" }, { alt: "n", url: 5 }];
  expect(parseChangelog(raw)[1].features[0].images).toEqual([]);
});

it("drops videos that are not on YouTube, and features without a title", () => {
  const raw = rawChangelog();
  raw.versions[0].features = [
    {
      ...raw.versions[0].features[0],
      video: { title: "v", url: "https://vimeo.com/1", poster: null },
    },
    { ...raw.versions[0].features[0], video: { title: "", url: VIDEO_URL, poster: null } },
    {
      ...raw.versions[0].features[0],
      video: { title: "v", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s", poster: null },
    },
    { ...raw.versions[0].features[0], video: "x" },
    { ...raw.versions[0].features[0], title: "" },
    null,
    "feature",
  ];
  const [newest] = parseChangelog(raw);
  expect(newest.features.map((feature) => feature.video?.url ?? null)).toEqual([
    null,
    null,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s",
    null,
  ]);
});

it("limits how much a manifest can make the page hold", () => {
  const base = rawChangelog().versions[2];
  const feature = {
    title: "F",
    text: Array(30).fill("t"),
    images: Array(12).fill({ alt: "i", url: `${RAW}/i.png` }),
    video: null,
  };
  const many = parseChangelog({
    schema: 1,
    versions: Array.from({ length: 250 }, (_, index) => ({
      ...base,
      version: `1.0.${index}`,
      features: Array(40).fill(feature),
      improvements: Array(80).fill("x"),
      fixes: ["x".repeat(2001), "ok", 5, ""],
    })),
  });
  expect(many).toHaveLength(200);
  expect(many[0].features).toHaveLength(30);
  expect(many[0].features[0].text).toHaveLength(20);
  expect(many[0].features[0].images).toHaveLength(8);
  expect(many[0].improvements).toHaveLength(50);
  expect(many[0].fixes).toEqual(["ok"]);
});

it("keeps a missing or malformed day empty and text as plain strings", () => {
  const raw = rawChangelog();
  raw.versions[0].date = "ontem";
  raw.versions[1].features[0].images = "not a list";
  raw.versions[1].improvements = "not a list";
  raw.versions[2].features = "nothing";
  const [newest, middle, oldest] = parseChangelog(raw);
  expect(newest.date).toBe("");
  expect(middle.features[0].images).toEqual([]);
  expect(middle.improvements).toEqual([]);
  expect(oldest.features).toEqual([]);
});

it("recognizes images only by their exact home and extension", () => {
  expect(IMAGE_PREFIX).toBe("https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/");
  for (const extension of ["png", "jpg", "jpeg", "webp", "gif", "svg", "PNG"]) {
    expect(isAllowedImage(`${RAW}/a.${extension}`)).toBe(true);
  }
  expect(isAllowedImage(`${IMAGE_PREFIX}${SHA}/docs/releases/assets/v1/c.png`)).toBe(true);
  expect(isAllowedImage(`${RAW}/noextension`)).toBe(false);
  expect(isAllowedImage(`${RAW}/a.png#frag`)).toBe(false);
  expect(isAllowedImage("https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/")).toBe(
    false,
  );
});

it("compares versions numerically", () => {
  expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
  expect(compareVersions("0.2.3", "0.2.10")).toBeLessThan(0);
  expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
});

it("merges embedded and announced notes, preferring the embedded ones", () => {
  const [newest, middle, oldest] = parseChangelog(rawChangelog());
  const embedded = [middle, oldest];
  const remote = [newest, { ...middle, title: "changed by the network" }];
  const merged = mergeChangelogs(embedded, remote);
  expect(merged.map((item) => item.version)).toEqual(["0.3.0", "0.2.4", "0.2.3"]);
  expect(merged[1].title).toBe("Gráfico pronto para o relatório");
  expect(mergeChangelogs([], [])).toEqual([]);
});

it("formats a day for Portuguese readers, and nothing for no day", () => {
  expect(formatDay("2026-11-13")).toMatch(/13 de nov\.? de 2026/);
  expect(formatDay("2026-12-02")).toMatch(/2 de dez\.? de 2026/);
  expect(formatDay("")).toBe("");
});
