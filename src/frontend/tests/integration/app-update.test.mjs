// @vitest-environment jsdom
/** Home screen: the update button in the header, the banner, and the real version number. */
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
import { INERT_UPDATE, UpdateContext } from "../../src/features/updates/update-context";
import { APP_VERSION } from "../../src/lib/app-version";

let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  bridge.isTauri.mockReturnValue(false);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

const ready = { kind: "ready", version: "0.3.0", notes: "Resumo da versão." };

async function render(value) {
  await act(async () =>
    root.render(
      createElement(
        UpdateContext.Provider,
        { value: { ...INERT_UPDATE, ...value } },
        createElement(App),
      ),
    ),
  );
}
const button = (name) =>
  [...node.querySelectorAll("button")].find(
    (item) => item.textContent.trim() === name || item.getAttribute("aria-label") === name,
  );

it("shows the update button in the header and the banner under it", async () => {
  const openDialog = vi.fn();
  const install = vi.fn();
  await render({ state: ready, bannerVisible: true, openDialog, install });
  const header = node.querySelector("header");
  expect(header.textContent).toContain("Atualizar");
  expect(node.textContent).toContain("Nova versão · 0.3.0");
  await act(async () => header.querySelector("button").click());
  expect(openDialog).toHaveBeenCalledTimes(1);
  await act(async () => button("Atualizar e reiniciar").click());
  expect(install).toHaveBeenCalledTimes(1);
});

it("shows no update controls while the app is up to date", async () => {
  await render({ state: { kind: "upToDate" } });
  expect(node.querySelector("header button")).toBeNull();
  expect(node.textContent).not.toContain("Nova versão");
});

it("shows the real version in the sidebar and on the About page", async () => {
  await render({});
  expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  expect(node.querySelector("aside").textContent).toContain(`v${APP_VERSION}`);
  expect(node.textContent).not.toContain("0.1.0");
  await act(async () => button("Sobre").click());
  expect(node.textContent).toContain(`Desktop · v${APP_VERSION}`);
  expect(node.querySelector("dl").textContent).toContain(APP_VERSION);
});
