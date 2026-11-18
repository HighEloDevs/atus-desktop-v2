// @vitest-environment jsdom
/**
 * The Como medir track inside the app: the cards on the Aprender tab open the instrument
 * lessons on the same page, without a project, and the sidebar or the back button return.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: vi.fn() }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../../src/features/projects/ProjectTables", () => ({ ProjectTables: () => null }));
vi.mock("driver.js", () => ({ driver: () => ({ highlight: vi.fn(), destroy: vi.fn() }) }));
vi.mock("driver.js/dist/driver.css", () => ({}));
import App from "../../src/App";

let root;
let node;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

const buttons = () => [...node.querySelectorAll("button")];
const click = (element) => act(async () => element.click());
const nav = (name) =>
  [...node.querySelectorAll("aside nav button")].find((b) => b.textContent.includes(name));

it("opens the ruler and the caliper from the Aprender tab and returns", async () => {
  await act(async () => root.render(createElement(App)));
  await click(nav("Aprender"));
  expect(node.textContent).toContain("Como medir");
  expect(node.textContent).toContain("Micrômetro");
  // Each card draws its own instrument.
  expect(node.querySelectorAll('[data-instrument="ruler"]')).toHaveLength(1);
  expect(node.querySelectorAll('[data-instrument="caliper"]')).toHaveLength(1);

  await click(buttons().find((b) => b.textContent.includes("Régua")));
  expect(node.querySelector("h1").textContent).toBe("Régua");
  expect(node.querySelector("header").textContent).toContain("Aprender");
  await click(buttons().find((b) => b.textContent.trim() === "Aprender"));
  expect(node.querySelector("h1").textContent).toBe("Aprender");

  await click(buttons().find((b) => b.textContent.includes("Paquímetro")));
  expect(node.querySelector("h1").textContent).toBe("Paquímetro");
  // Leaving through the sidebar closes the lesson, so coming back shows the tab.
  await click(nav("Início"));
  await click(nav("Aprender"));
  expect(node.querySelector("h1").textContent).toBe("Aprender");
});
