/** The desktop configuration that decides what the web content may load and open. */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const config = read("../../../desktop/tauri.conf.json");
const main = read("../../../desktop/capabilities/default.json");

/** The directives of the content security policy by name. */
function policy() {
  return Object.fromEntries(
    config.app.security.csp.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

it("lets images load only from the app and from the project's files on GitHub", () => {
  const csp = policy();
  expect(csp["img-src"]).toEqual(["'self'", "https://raw.githubusercontent.com"]);
  // Nothing else is opened up: scripts and requests stay as strict as they were.
  expect(csp["default-src"]).toEqual(["'self'"]);
  expect(csp["connect-src"]).toEqual(["ipc:", "http://ipc.localhost"]);
  expect(config.app.security.csp).not.toMatch(/unsafe-/);
});

it("opens links in the browser only for the places the release notes may link to", () => {
  const opener = main.permissions.find(
    (permission) =>
      typeof permission === "object" && permission.identifier === "opener:allow-open-url",
  );
  const urls = opener.allow.map((rule) => rule.url);
  for (const url of [
    "https://github.com/HighEloDevs/*",
    "https://youtu.be/*",
    "https://www.youtube.com/*",
    "https://atusweb.com.br/*",
    "https://www.atusweb.com.br/*",
  ]) {
    expect(urls).toContain(url);
  }
  // Every allowed address is a precise place, never a whole scheme.
  for (const url of urls) expect(url).toMatch(/^https:\/\/[a-z.]+\/(\S*)$/i);
});

it("does not give the web content the updater plugin", () => {
  const identifiers = main.permissions.map((permission) =>
    typeof permission === "string" ? permission : permission.identifier,
  );
  expect(identifiers.filter((item) => item.startsWith("updater:"))).toEqual([]);
  expect(identifiers.filter((item) => item.startsWith("process:"))).toEqual([]);
});
