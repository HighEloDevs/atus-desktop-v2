// @vitest-environment jsdom
/** Home screen and news page: the sidebar item, the unseen marker, opening after an update and from the banner. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
const bridge = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri, invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: bridge.listen }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../../src/features/projects/ProjectTables", () => ({ ProjectTables: () => null }));
import App from "../../src/App";
import { parseChangelog } from "../../src/features/news/changelog";
import { NEWS_SEEN_KEY, UPDATE_SEEN_KEY } from "../../src/features/news/news-seen";
import { INERT_UPDATE, UpdateContext } from "../../src/features/updates/update-context";
import { APP_VERSION } from "../../src/lib/app-version";
import { rawChangelog } from "../fixtures/changelog-fixture.mjs";

const versions = parseChangelog(rawChangelog());
const ready = { kind: "ready", version: "0.3.0", notes: "Resumo." };
let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  bridge.isTauri.mockReturnValue(false);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  localStorage.clear();
});

async function render(value = {}) {
  await act(async () =>
    root.render(
      createElement(
        UpdateContext.Provider,
        { value: { ...INERT_UPDATE, changelog: versions, ...value } },
        createElement(App),
      ),
    ),
  );
}
const button = (name) =>
  [...node.querySelectorAll("button")].find(
    (item) => item.textContent.trim() === name || item.getAttribute("aria-label") === name,
  );
const sidebarItem = (label) =>
  [...node.querySelectorAll("aside nav button")].find((item) => item.textContent.includes(label));
const click = (element) => act(async () => element.click());
const articleTitle = () => node.querySelector("article h2")?.textContent;

it("replaces the disabled Changelog item with a working Novidades page", async () => {
  await render();
  expect(node.querySelector("aside").textContent).not.toContain("Changelog");
  expect(node.querySelector("aside [aria-disabled]").textContent).toContain("Ajuda");
  await click(sidebarItem("Novidades"));
  expect(node.querySelector("header").textContent).toContain("Novidades");
  expect(sidebarItem("Novidades").getAttribute("aria-current")).toBe("page");
  expect(node.querySelectorAll("aside[aria-label='Versões'] li")).toHaveLength(3);
  // The installed version is not in the notes, so the newest is shown.
  expect(articleTitle()).toBe("Resíduos à vista");
});

it("still opens the About page from its own item", async () => {
  await render();
  await click(sidebarItem("Sobre"));
  expect(node.textContent).toContain("Sobre o ATUS");
  expect(sidebarItem("Sobre").getAttribute("aria-current")).toBe("page");
  await click(sidebarItem("Novidades"));
  expect(node.textContent).not.toContain("Sobre o ATUS");
});

it("marks the news as unseen while an update waits, and clears it when they are opened", async () => {
  await render({ state: ready });
  expect(sidebarItem("Novidades").textContent).toContain("há uma versão nova");
  await click(sidebarItem("Novidades"));
  expect(localStorage.getItem(UPDATE_SEEN_KEY)).toBe("0.3.0");
  expect(articleTitle()).toBe("Resíduos à vista");
  await click(sidebarItem("Início"));
  expect(sidebarItem("Novidades").textContent).not.toContain("há uma versão nova");
});

it("does not mark anything while no update waits", async () => {
  await render({ state: { kind: "upToDate" } });
  expect(sidebarItem("Novidades").textContent).not.toContain("há uma versão nova");
});

it("opens the news of the running version on the first launch after an update, once", async () => {
  localStorage.setItem(NEWS_SEEN_KEY, "0.2.0");
  await render();
  expect(node.querySelector("header").textContent).toContain("Novidades");
  expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe(APP_VERSION);
  await act(async () => root.unmount());
  root = createRoot(node);
  await render();
  expect(node.querySelector("header").textContent).toContain("Início");
});

it("starts on the home screen on the very first run, and remembers the version", async () => {
  await render();
  expect(node.querySelector("header").textContent).toContain("Início");
  expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe(APP_VERSION);
});

it("opens the news of the waiting update from the banner, which then steps aside", async () => {
  await render({ state: ready, bannerVisible: true });
  expect(node.textContent).toContain("Nova versão · 0.3.0");
  await click(button("Ver novidades"));
  expect(node.querySelector("header").textContent).toContain("Novidades");
  expect(articleTitle()).toBe("Resíduos à vista");
  expect(node.textContent).not.toContain("Nova versão · 0.3.0");
  expect(localStorage.getItem(UPDATE_SEEN_KEY)).toBe("0.3.0");
});

it("keeps the update button in the header of the news page", async () => {
  const openDialog = vi.fn();
  await render({ state: ready, openDialog });
  await click(sidebarItem("Novidades"));
  await click(node.querySelector("header button"));
  expect(openDialog).toHaveBeenCalledTimes(1);
});
