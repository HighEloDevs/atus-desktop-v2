/** The Vite plugin that embeds the release notes: same parser and shape as the release. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { changelogPlugin } from "../../vite-plugin-changelog";
import { parseChangelog } from "../../src/features/news/changelog";

const NOTES = `---
title: Resíduos à vista
date: 2026-12-02
summary: O ajuste agora mostra onde ele erra.
cover: assets/v0.3.0/cover.svg
---

## Novidades

### Painel de resíduos

Fica sob o gráfico.

![Painel](assets/v0.3.0/residuos.png)

## Correções

- O MSI instala na pasta certa.
`;
const OLDER = `---
title: Instaladores
date: 2026-11-13
summary: Novos formatos.
---

## Melhorias

- Imagem .dmg.
`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SHA = "b".repeat(40);

let folder;
afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
  vi.restoreAllMocks();
});

/** A notes folder with the given version notes and their images. */
function notes(files = {}) {
  folder = mkdtempSync(join(tmpdir(), "atus-plugin-"));
  mkdirSync(join(folder, "assets", "v0.3.0"), { recursive: true });
  writeFileSync(join(folder, "assets", "v0.3.0", "cover.svg"), SVG);
  writeFileSync(join(folder, "assets", "v0.3.0", "residuos.png"), PNG);
  for (const [name, text] of Object.entries({ "v0.3.0.md": NOTES, "v0.2.3.md": OLDER, ...files })) {
    writeFileSync(join(folder, name), text);
  }
  return folder;
}

/** Runs the plugin the way Vite does and returns the module it serves. */
async function serve({ command = "build", ...options } = {}) {
  const plugin = changelogPlugin({ version: "0.3.0", sha: SHA, ...options });
  plugin.configResolved({ command });
  const context = {
    error: (message) => {
      throw new Error(message);
    },
    warn: vi.fn(),
  };
  return {
    plugin,
    context,
    resolved: plugin.resolveId("virtual:changelog"),
    code: await plugin.load.call(context, "\0virtual:changelog"),
  };
}

it("serves the notes with the shape the release publishes, with images at the built commit", async () => {
  const { resolved, code } = await serve({ notesRoot: notes() });
  expect(resolved).toBe("\0virtual:changelog");
  const data = JSON.parse(code.replace(/^export default /, "").replace(/;$/, ""));
  expect(data.schema).toBe(1);
  expect(data.versions.map((item) => item.version)).toEqual(["0.3.0", "0.2.3"]);
  const raw = `https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/${SHA}/docs/releases`;
  expect(data.versions[0].cover).toBe(`${raw}/assets/v0.3.0/cover.svg`);
  expect(data.versions[0].features[0].images[0].url).toBe(`${raw}/assets/v0.3.0/residuos.png`);
  // The app accepts exactly what the plugin produces.
  const parsed = parseChangelog(data);
  expect(parsed.map((item) => item.version)).toEqual(["0.3.0", "0.2.3"]);
  expect(parsed[0].cover).toBe(`${raw}/assets/v0.3.0/cover.svg`);
  expect(parsed[0].features[0].images).toHaveLength(1);
});

it("ignores ids that are not its own", async () => {
  const plugin = changelogPlugin({ version: "0.3.0", notesRoot: notes() });
  expect(plugin.resolveId("something-else")).toBeUndefined();
  expect(await plugin.load.call({}, "something-else")).toBeUndefined();
});

it("fails a build when the release would refuse the notes", async () => {
  const bad = notes({ "v0.2.3.md": "no front matter" });
  await expect(serve({ notesRoot: bad })).rejects.toThrow(
    /Invalid release notes[\s\S]*v0\.2\.3\.md/,
  );
});

it("fails a build when the notes of the version are missing", async () => {
  await expect(serve({ notesRoot: notes(), version: "0.4.0" })).rejects.toThrow(
    /missing release notes for 0\.4\.0/,
  );
});

it("only warns while developing, and serves what is valid", async () => {
  const { code, context } = await serve({
    command: "serve",
    notesRoot: notes({ "v0.2.3.md": "no front matter" }),
    version: "0.3.0",
  });
  expect(context.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid release notes"));
  expect(
    JSON.parse(code.replace(/^export default /, "").replace(/;$/, "")).versions.map(
      (item) => item.version,
    ),
  ).toEqual(["0.3.0"]);
});

it("reads the version from package.json and the commit from the environment by default", async () => {
  vi.stubEnv("GITHUB_SHA", SHA);
  const plugin = changelogPlugin({ notesRoot: notes() });
  plugin.configResolved({ command: "serve" });
  const context = { error: vi.fn(), warn: vi.fn() };
  const code = await plugin.load.call(context, "\0virtual:changelog");
  // The notes folder only has 0.3.0 and 0.2.3, so the real package version has none.
  expect(context.warn).toHaveBeenCalled();
  expect(code).toContain(SHA);
  vi.unstubAllEnvs();
});

it("embeds the real release notes of the repository", async () => {
  const { code } = await serve({
    version: JSON.parse(
      (await import("node:fs")).readFileSync(
        new URL("../../package.json", import.meta.url),
        "utf8",
      ),
    ).version,
  });
  const versions = parseChangelog(
    JSON.parse(code.replace(/^export default /, "").replace(/;$/, "")),
  );
  expect(versions.length).toBeGreaterThanOrEqual(6);
  expect(versions[0].title.length).toBeGreaterThan(0);
  for (const item of versions) expect(item.summary.length).toBeGreaterThan(0);
});
